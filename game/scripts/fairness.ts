// 경기 형평성 점검: 전력 차별 점수 차 분포 · 대승/대패 비율 · 내 전술 선택에 따른 차이
//   npm run fairness -- [시즌 수 3] [전술별 경기 수 1000]
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, advanceDay, seasonOver, prepareMatch } from '../src/engine/world';
import { playToEnd } from '../src/engine/match';
import { teamStrength } from '../src/engine/ai';
import { createRng } from '../src/engine/rng';
import type { ClubSeasonFile, LeagueSeasonFile } from '../src/data/types';
import type { Fixture, Tactics } from '../src/engine/types';

const DATA = path.resolve(__dirname, '../../data-public');
const season = '2025-26';
const LEAGUES = ['eng1', 'esp1', 'ger1', 'ita1', 'fra1', 'ger2'];
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8'));
const input = {
  season,
  leagues: LEAGUES.map((id) => {
    const dir = path.join(DATA, 'seasons', season, id);
    const meta = readJson<LeagueSeasonFile>(path.join(dir, '_league.json'));
    return { id, clubs: meta.clubs.map((c) => readJson<ClubSeasonFile>(path.join(dir, `${c}.json`))) };
  }),
};
const pct = (a: number, n: number) => `${((a / Math.max(1, n)) * 100).toFixed(1)}%`.padStart(6);

// ── A. 시즌 전체: 전력 차 구간별 결과 ──
type Row = { gap: number; gd: number; tot: number; user: boolean };
const rows: Row[] = [];
const NUMS = process.argv.slice(2).filter((x) => /^\d+$/.test(x));
const SEEDS = +(NUMS[0] ?? 3);
for (let s = 0; s < SEEDS; s++) {
  const w = createWorld(input, input.leagues[0].clubs[0].club, 100 + s);
  const str: Record<string, number> = {};
  for (const id of Object.keys(w.clubs)) str[id] = teamStrength(w, id);
  let d = 0;
  while (!seasonOver(w) && d < 400) { advanceDay(w); d++; }
  for (const lg of LEAGUES) for (const f of w.competitions[lg]?.fixtures ?? []) {
    const r = f.result; if (!r) continue;
    rows.push({ gap: str[f.home] - str[f.away], gd: r.homeGoals - r.awayGoals, tot: r.homeGoals + r.awayGoals, user: f.home === w.userClubId || f.away === w.userClubId });
  }
}
console.log(`\n■ A. 리그 경기 ${rows.length}개 (${LEAGUES.length}리그 × ${SEEDS}시즌) — 전력 = 상위 11명 평균 오버롤 차 (홈 − 원정)`);
console.log('  전력 차         경기   홈승   무   원정승  평균득실  4골차↑  5골차↑  6골차↑  최대');
const bins: [string, (g: number) => boolean][] = [
  ['원정이 8↑ 강함', (g) => g <= -8], ['원정이 4~8 강함', (g) => g > -8 && g <= -4], ['비슷 (±4)', (g) => Math.abs(g) < 4],
  ['홈이 4~8 강함', (g) => g >= 4 && g < 8], ['홈이 8↑ 강함', (g) => g >= 8],
];
const line = (name: string, rs: Row[]) => {
  const n = rs.length;
  console.log(`  ${name.padEnd(14)} ${String(n).padStart(5)} ${pct(rs.filter((r) => r.gd > 0).length, n)} ${pct(rs.filter((r) => r.gd === 0).length, n)} ${pct(rs.filter((r) => r.gd < 0).length, n)}  ${(rs.reduce((a, r) => a + r.gd, 0) / Math.max(1, n)).toFixed(2).padStart(6)}  ${pct(rs.filter((r) => Math.abs(r.gd) >= 4).length, n)}  ${pct(rs.filter((r) => Math.abs(r.gd) >= 5).length, n)}  ${pct(rs.filter((r) => Math.abs(r.gd) >= 6).length, n)}  ${Math.max(0, ...rs.map((r) => Math.abs(r.gd)))}`);
};
for (const [name, f] of bins) line(name, rows.filter((r) => f(r.gap)));
line('전체', rows);
line('(내 구단 경기)', rows.filter((r) => r.user));
console.log(`  경기당 골 ${(rows.reduce((a, r) => a + r.tot, 0) / rows.length).toFixed(2)} · 실제 축구 참고: 4골차↑ 약 6~7%, 5골차↑ 약 2%, 6골차↑ 약 0.6%`);

// ── B. 내 전술 선택: 같은 두 팀, 같은 선수, 전술만 바꿔서 ──
const w = createWorld(input, input.leagues[0].clubs[0].club, 7);
const lg = input.leagues[0].clubs.map((c) => c.club).sort((a, b) => teamStrength(w, b) - teamStrength(w, a));
const pairs: [string, string, string][] = [
  ['비슷한 팀 (중위권끼리)', lg[8], lg[10]],
  ['내가 강팀 (1위권 vs 하위권)', lg[0], lg[lg.length - 2]],
  ['내가 약팀 (하위권 vs 1위권)', lg[lg.length - 2], lg[0]],
];
const N = +(NUMS[1] ?? 1000);
const variants: [string, Partial<Tactics>][] = [
  ['AI 추천 그대로', {}],
  ['매우 공격 · 강한 압박', { mentality: 2, pressing: 2 }],
  ['매우 수비 · 낮은 압박', { mentality: -2, pressing: 0 }],
  ['보통 · 보통', { mentality: 0, pressing: 1 }],
];
console.log(`\n■ B. 내 전술에 따른 결과 (홈 경기, 같은 선발, 조합마다 ${N}경기)`);
console.log('  조합                       전술                  승     무     패   득    실   4골차↑ 대승 / 대패');
for (const [label, me, opp] of pairs) {
  const fx = { id: 'x', home: me, away: opp, league: 'eng1', date: w.date } as unknown as Fixture;
  for (const [vn, tac] of variants) {
    let W = 0, D = 0, L = 0, gf = 0, ga = 0, bw = 0, bl = 0;
    for (let i = 0; i < N; i++) {
      const rng = createRng(1000 + i);
      const saved = Object.fromEntries(Object.values(w.players).map((p) => [p.id, { f: p.fitness, inj: p.injury, s: p.suspension }]));
      const m = prepareMatch(w, fx, rng, Object.keys(tac).length ? { tactics: { home: tac as Tactics } } : {});
      const r = playToEnd(m, { players: w.players, rng });
      for (const p of Object.values(w.players)) { const v = saved[p.id]; p.fitness = v.f; p.injury = v.inj; p.suspension = v.s; }
      const gd = r.homeGoals - r.awayGoals;
      gf += r.homeGoals; ga += r.awayGoals;
      if (gd > 0) W++; else if (gd === 0) D++; else L++;
      if (gd >= 4) bw++; if (gd <= -4) bl++;
    }
    console.log(`  ${label.padEnd(24)} ${vn.padEnd(18)} ${pct(W, N)} ${pct(D, N)} ${pct(L, N)}  ${(gf / N).toFixed(2)}  ${(ga / N).toFixed(2)}  ${pct(bw, N)} / ${pct(bl, N)}`);
  }
}
