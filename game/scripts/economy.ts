// 여러 시즌 경제 · 자유계약(FA) 점검: FA 가 쌓이는지 · 나이 많은 FA 가 남는지 · 구단 잔고가 끝없이 쌓이는지
//   npm run economy -- [시즌 수 5] [시드 1]
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, advanceDay, seasonOver } from '../src/engine/world';
import { closeSeason, nextSeasonOf, startNextSeason } from '../src/engine/season';
import { overall } from '../src/engine/ratings';
import { ageOn } from '../src/engine/condition';
import { levelOf } from '../src/engine/pyramid';
import type { ClubSeasonFile, LeagueSeasonFile } from '../src/data/types';
import type { World } from '../src/engine/types';

const DATA = path.resolve(__dirname, '../../data-public');
const NUMS = process.argv.slice(2).filter((x) => /^\d+$/.test(x));
const SEASONS = +(NUMS[0] ?? 5), SEED = +(NUMS[1] ?? 1);
const season0 = '2025-26';
const LEAGUES = ['eng1', 'esp1', 'ger1', 'ita1', 'fra1', 'ger2'];
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8'));
const input = {
  season: season0,
  leagues: LEAGUES.map((id) => {
    const dir = path.join(DATA, 'seasons', season0, id);
    const meta = readJson<LeagueSeasonFile>(path.join(dir, '_league.json'));
    return { id, clubs: meta.clubs.map((c) => readJson<ClubSeasonFile>(path.join(dir, `${c}.json`))) };
  }),
};
const M = (v: number) => `${(v / 1e6).toFixed(0)}M`.padStart(6);
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

function snap(w: World, label: string) {
  const fa = Object.values(w.players).filter((p) => !p.clubId && !p.retired);
  const age = (p: typeof fa[number]) => ageOn(p.birth, w.date);
  const b = (lo: number, hi: number) => fa.filter((p) => age(p) >= lo && age(p) <= hi).length;
  const good = fa.filter((p) => overall(p) >= 70);
  const ai = Object.values(w.clubs).filter((c) => c.id !== w.userClubId && w.competitions[c.league]);
  const sq = ai.map((c) => c.squad.length);
  const tiers = [1, 2].map((lv) => ai.filter((c) => levelOf(c.league) === lv));
  console.log(`  ${label.padEnd(16)} FA ${String(fa.length).padStart(5)} (≤22 ${b(0, 22)} · 23~28 ${b(23, 28)} · 29~32 ${b(29, 32)} · 33↑ ${b(33, 99)}) · 70↑ ${String(good.length).padStart(3)}명 (33↑ ${good.filter((p) => age(p) >= 33).length})`
    + ` · 선수단 평균 ${(sq.reduce((a, x) => a + x, 0) / sq.length).toFixed(1)} 최소 ${Math.min(...sq)}`
    + tiers.map((t, i) => t.length ? ` · ${i + 1}부 잔고 중간 ${M(med(t.map((c) => c.finance.balance)))} 최대 ${M(Math.max(...t.map((c) => c.finance.balance)))}` : '').join(''));
  return { fa: fa.length, good: good.length };
}

const w = createWorld(input, input.leagues[0].clubs[0].club, SEED);
let moves = { fa: 0, fee: 0 };
const t0 = Date.now();
console.log(`■ ${SEASONS}시즌 경제 · FA 점검 (${LEAGUES.join(' · ')}, 시드 ${SEED})`);
snap(w, `${w.season} 시작`);
for (let s = 0; s < SEASONS; s++) {
  let d = 0, mid = false;
  while (!seasonOver(w) && d < 400) {
    for (const e of advanceDay(w)) if (e.type === 'transfer') { if (e.from) moves.fee++; else moves.fa++; }
    d++;
    if (!mid && w.date.slice(5) >= '01-05' && w.date.slice(5) < '06-01') { snap(w, `${w.season} 1월`); mid = true; }
  }
  snap(w, `${w.season} 끝`);
  console.log(`    이번 시즌 이적: 이적료 있는 이적 ${moves.fee} · FA 영입 ${moves.fa}`);
  moves = { fa: 0, fee: 0 };
  closeSeason(w);
  const r = startNextSeason(w, { season: nextSeasonOf(w.season), leagues: [] });
  snap(w, `${w.season} 시작`);
  console.log(`    은퇴 ${r.retired.length} · 새 선수 ${r.debuts.length}`);
}
console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)}초)`);
