// 패러디 이름(공개 데이터)으로 하던 세이브를 실명 데이터로 바꾸기
//  공개 데이터는 실명 데이터의 선수 · 구단 번호를 공개 번호(p…, c…)로 바꾼 것 (파이프라인 publish).
//  실명 데이터에 들어 있는 번호 대응표 (data/canonical/public-map.json: 실명 번호 → 공개 번호)를 거꾸로 써서
//  세이브 안의 모든 공개 번호를 실명 번호로 바꾼다 → 이름 · 엠블럼 · 다음 시즌 실제 데이터가 그대로 이어진다.
//  그 시즌 실명 시즌 파일에 있는 선수는 영문 이름 · 생일(공개는 일을 1일로 바꿈) · 키 · 몸무게 · 주발도 실제 값으로.
//  대응표에 없는 번호 (게임이 만든 유스 · 가상 선수 등)는 그대로 둔다
import type { World } from './types';
import type { ClubSeasonFile } from '../data/types';

export interface PublicMap { clubs: Record<string, string>; players: Record<string, string | { id: string }> }

const ID = /\b([pc][0-9a-z]{5,9})\b/g;

/** 공개 번호 → 실명 번호 */
export function inverseMap(map: PublicMap): Map<string, string> {
  const inv = new Map<string, string>();
  for (const [real, pub] of Object.entries(map.clubs ?? {})) inv.set(pub, real);
  for (const [real, v] of Object.entries(map.players ?? {})) inv.set(typeof v === 'string' ? v : v.id, real);
  return inv;
}

/** 세이브를 실명으로 (새 World 를 돌려준다). files = 그 시즌 실명 구단 시즌 파일들 (있으면 이름 등도 실제 값으로) */
export function convertToReal(world: World, map: PublicMap, files: ClubSeasonFile[] = []): { world: World; ids: number; named: number } {
  const inv = inverseMap(map);
  let ids = 0;
  const text = JSON.stringify(world).replace(ID, (m) => { const r = inv.get(m); if (!r) return m; ids++; return r; });
  const w = JSON.parse(text) as World;
  w.dataset = 'real';
  let named = 0;
  for (const f of files) for (const sp of f.squad) {
    const p = w.players[sp.id];
    if (!p) continue;
    p.name = sp.name;
    if (sp.birth) p.birth = sp.birth;
    if (sp.height) p.height = sp.height;
    if (sp.weight) p.weight = sp.weight;
    if (sp.foot) p.foot = sp.foot;
    named++;
  }
  return { world: w, ids, named };
}
