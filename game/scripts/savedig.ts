// 세이브 크기 들여다보기: savesize 로 떨군 월드 파일을 저장 형태(packWorld)로 바꿔 항목별 크기를 본다
//   npx vite-node scripts/savedig.ts -- <월드 JSON 파일>   (npm run savesize -- 8 2023 <파일> 로 떨군 것)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { packWorld } from '../src/engine/archive';
import type { World } from '../src/engine/types';

const w = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as World;
const mb = (n: number) => `${(n / 1e6).toFixed(2)}MB`;
const len = (v: unknown) => JSON.stringify(v ?? null).length;
const packed = packWorld(w);
const text = JSON.stringify(packed);
console.log(`저장 형태 ${mb(text.length)} · gzip ${mb(zlib.gzipSync(text).length)}`);
console.log('최상위:', Object.entries(packed).map(([k, v]) => [k, len(v)] as const).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, n]) => `${k} ${mb(n)}`).join(' · '));

const ps = Object.values(packed.players);
const groups: Record<string, typeof ps> = {
  보관은퇴: ps.filter((p) => (p as { archived?: boolean }).archived),
  은퇴기타: ps.filter((p) => p.retired && !(p as { archived?: boolean }).archived),
  소속: ps.filter((p) => !p.retired && p.clubId),
  무소속: ps.filter((p) => !p.retired && !p.clubId),
};
for (const [g, list] of Object.entries(groups)) {
  const f = new Map<string, number>();
  for (const p of list) for (const [k, v] of Object.entries(p)) f.set(k, (f.get(k) ?? 0) + len(v) + k.length + 3);
  console.log(`\n[${g}] ${list.length}명 · ${mb(len(list))}`);
  console.log('  ', [...f].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, n]) => `${k} ${mb(n)}`).join(' · '));
}
// 경력 줄: 0경기 줄 비율
const car = ps.flatMap((p) => p.career ?? []);
const zero = car.filter((c) => !c.apps && !(c as { cupApps?: number }).cupApps);
console.log(`\n경력 줄 ${car.length}개 · 0경기 ${zero.length}개 (${mb(len(zero))}) · 한 줄 예: ${JSON.stringify(car[car.length - 1])}`);
// stats 안 0 값 비율
const act = groups.소속.concat(groups.무소속);
let zeros = 0, all = 0;
for (const p of act) for (const k of ['stats', 'cupStats', 'intlStats'] as const) { const s = (p as unknown as Record<string, Record<string, unknown>>)[k]; if (s) for (const v of Object.values(s)) { all++; if (v === 0 || v === null) zeros++; } }
console.log(`시즌 기록 칸 ${all}개 중 0 · 빈 값 ${zeros}개`);
console.log('stats 예:', JSON.stringify(act[0]?.stats), '\nhidden 예:', JSON.stringify(act[0]?.hidden), '\ntlog 예:', JSON.stringify(act[0]?.tlog));
// 구단 · 기타 큰 항목 안쪽
for (const k of ['clubs', 'history', 'inbox', 'fixtures', 'results']) {
  const v = (packed as unknown as Record<string, unknown>)[k];
  if (!v || typeof v !== 'object') continue;
  const first = Array.isArray(v) ? v[v.length - 1] : Object.values(v)[0];
  const fields = first && typeof first === 'object' ? Object.entries(first).map(([a, b]) => [a, len(b)] as const).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([a, n]) => `${a} ${n}`).join(' · ') : '';
  console.log(`\n${k}: ${Array.isArray(v) ? v.length : Object.keys(v).length}개 · ${mb(len(v))} · 한 개 필드(바이트): ${fields}`);
}
