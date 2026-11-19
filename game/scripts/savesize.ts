// 세이브 크기 점검: 여러 시즌 자동 진행 후 세이브(JSON) 크기를 항목별로 나눠 본다
//   npm run savesize -- [시즌 수] [시작 연도] [저장할 파일]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createWorld, advanceDay, seasonOver } from '../src/engine/world';
import { closeSeason, nextSeasonOf, startNextSeason } from '../src/engine/season';
import type { ClubSeasonFile, LeagueSeasonFile } from '../src/data/types';
import type { World } from '../src/engine/types';

const DATA = path.resolve(__dirname, '../../data-public');
const args = process.argv.slice(2);
const SEASONS = +(args[0] ?? 8), Y0 = +(args[1] ?? 2023), DUMP = args[2];
const rj = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8'));
const wcPath = path.join(DATA, 'meta/worldcups.json');
const worldCups = fs.existsSync(wcPath) ? rj<Record<string, unknown>>(wcPath) : undefined;
function input(season: string) {
  const dir = path.join(DATA, 'seasons', season);
  const ids = fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => fs.existsSync(path.join(dir, x, '_league.json'))) : [];
  const leagues = ids.map((id) => { const m = rj<LeagueSeasonFile>(path.join(dir, id, '_league.json')); return { id, clubs: m.clubs.map((c) => rj<ClubSeasonFile>(path.join(dir, id, `${c}.json`))) }; });
  // 아래 리그 대기열 (게임 store loadSeasonInput 과 같게): 직전 시즌 2부에 있다가 이번 시즌 없는 구단
  const y = +season.slice(0, 4) - 1, prev = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  const here = new Set(leagues.flatMap((l) => l.clubs.map((c) => c.club)));
  const pools = ids.filter((id) => /2$/.test(id) && fs.existsSync(path.join(DATA, 'seasons', prev, id, '_league.json'))).map((id) => {
    const pd = path.join(DATA, 'seasons', prev, id);
    return { league: `${id}-lower`, clubs: rj<LeagueSeasonFile>(path.join(pd, '_league.json')).clubs.filter((c) => !here.has(c)).map((c) => rj<ClubSeasonFile>(path.join(pd, `${c}.json`))) };
  });
  return { season, worldCups: worldCups as never, leagues, pools };
}
const mb = (n: number) => `${(n / 1e6).toFixed(2)}MB`;
const len = (v: unknown) => JSON.stringify(v ?? null).length;

export function breakdown(w: World) {
  const text = JSON.stringify(w);
  const gz = zlib.gzipSync(text).length;
  console.log(`  전체 ${mb(text.length)} · gzip ${mb(gz)}`);
  const top = Object.entries(w).map(([k, v]) => [k, len(v)] as const).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('  항목:', top.map(([k, n]) => `${k} ${mb(n)}`).join(' · '));
  const ps = Object.values(w.players);
  const retired = ps.filter((p) => p.retired), free = ps.filter((p) => !p.retired && !p.clubId);
  console.log(`  선수 ${ps.length}명 (은퇴 ${retired.length} · ${mb(len(retired))} / 무소속 ${free.length} · ${mb(len(free))} / 소속 ${mb(len(ps.filter((p) => !p.retired && p.clubId)))})`);
  const fields = new Map<string, number>();
  for (const p of ps) for (const [k, v] of Object.entries(p)) fields.set(k, (fields.get(k) ?? 0) + len(v) + k.length + 3);
  console.log('  선수 필드:', [...fields].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${mb(n)}`).join(' · '));
  const rf = new Map<string, number>();
  for (const p of retired) for (const [k, v] of Object.entries(p)) rf.set(k, (rf.get(k) ?? 0) + len(v) + k.length + 3);
  console.log('  은퇴 선수 필드:', [...rf].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k} ${mb(n)}`).join(' · '));
  return { size: text.length, gz };
}

{
  const t0 = Date.now();
  let w = createWorld(input(`${Y0}-${String((Y0 + 1) % 100).padStart(2, '0')}`), 'c83d96l', 1);
  if (!w.clubs['c83d96l']) w = createWorld(input(w.season), Object.keys(w.clubs)[0], 1);
  for (let s = 0; s < SEASONS; s++) {
    let d = 0;
    while (!seasonOver(w) && d < 420) { advanceDay(w); d++; }
    closeSeason(w);
    const next = nextSeasonOf(w.season);
    startNextSeason(w, input(next));
    console.log(`■ ${w.season} 시작 (${Math.round((Date.now() - t0) / 1000)}초)`);
    breakdown(w);
  }
  if (DUMP) fs.writeFileSync(DUMP, JSON.stringify(w));
}
