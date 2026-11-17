// 게임 깊이 더하기: 내 선수 강등 조항 · 포지션 전환 훈련 · 유스 아카데미
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { relClauseAllowed, relegationRisk, relWageFactor, setRelClause } from './clauses';
import { relClauseOf, triggerRelClauses } from './firesale';
import { playerWillJoin, wageDemand } from './transfer';
import { canRetrain, retrainMonth, retrainRate, startRetrain, stopRetrain } from './retrain';
import { familiarity, overall, playerFamiliarity, ratingAt, slotRating } from './ratings';
import { academyMonth, academyOf, academySeason, potentialRange, promote } from './academy';
import { createRng } from './rng';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const LIV = 'c83d96l';

describe('내 선수 강등 조항', () => {
  it('넣으면 주급을 깎아 주고, 강등 위험 구단이 안 넣으면 선수가 망설인다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    const small = Object.values(w.clubs).filter((c) => c.league === 'eng1').sort((a, b) => a.reputation - b.reputation)[0];
    w.userClubId = small.id;
    expect(relClauseAllowed(w, small.id)).toBe(true);
    expect(relegationRisk(w, small.id)).toBe(true);
    const p = Object.values(w.players).find((x) => !x.clubId && overall(x) >= 60) ?? Object.values(w.players).find((x) => x.clubId === LIV)!;
    const fee = Math.round(wageDemand(w, p, small.id) * 1.2);
    expect(relWageFactor(w, p, 1e7)).toBeLessThan(1);
    // 같은 주급이라도 조항이 있으면 더 쉽게 온다 (점수 비교: 아주 낮은 주급 대신 수요 주급으로)
    const withRel = playerWillJoin(w, p, small.id, fee, undefined, undefined, undefined, 5e6);
    const noRel = playerWillJoin(w, p, small.id, fee, undefined, undefined, undefined, 0);
    expect(withRel.ok || !noRel.ok).toBe(true);
  });
  it('내 선수에게는 무작위로 붙지 않고, 정한 조항은 강등되면 발동한다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    const mine = w.players[w.clubs[LIV].squad[0]];
    mine.relClub = undefined; mine.relClause = undefined;
    expect(relClauseOf(w, mine)).toBe(0);
    setRelClause(mine, LIV, 2e7);
    expect(relClauseOf(w, mine)).toBe(2e7);
    const out = triggerRelClauses(w, [LIV], '2026-27');
    expect(out).toContain(mine.id);
    expect(w.bargains?.some((b) => b.player === mine.id && b.price === 2e7)).toBe(true);
    expect(w.inbox.some((e) => e.type === 'info' && e.text.includes('강등 조항'))).toBe(true);
  });
});

describe('포지션 전환 훈련', () => {
  it('매달 진행 → 다 익히면 그 자리 능력이 깎이지 않는다 (가까운 자리일수록 빠름)', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    const p = w.clubs[LIV].squad.map((id) => w.players[id]).find((x) => x.pos === 'CB')!;
    const target = (['RB', 'DM', 'LB'] as const).find((x) => canRetrain(p, x))!;
    const far = (['ST', 'LW', 'AM'] as const).find((x) => canRetrain(p, x))!;
    expect(retrainRate(w, p, target)).toBeGreaterThan(retrainRate(w, p, far) - (familiarity(p.pos, target) >= familiarity(p.pos, far) ? 0 : 99));
    const before = slotRating(p, target);
    expect(startRetrain(w, p, target).ok).toBe(true);
    let months = 0;
    while (p.retrain && months < 24) { retrainMonth(w); months++; if (months === 1) expect(playerFamiliarity(p, target)).toBeGreaterThan(familiarity(p.pos, target)); }
    console.log(`${p.pos} → ${target}: ${months}달 · 능력 ${before.toFixed(1)} → ${slotRating(p, target).toFixed(1)}`);
    expect(p.learned).toContain(target);
    expect(slotRating(p, target)).toBeCloseTo(ratingAt(p, target), 5);
    expect(months).toBeLessThanOrEqual(10);
    expect(w.inbox.some((e) => e.type === 'retrain' && e.player === p.id)).toBe(true);
  });
  it('한 번에 3명까지 · 멈추면 진행도를 기억한다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    const ps = w.clubs[LIV].squad.map((id) => w.players[id]).filter((x) => x.pos !== 'GK').slice(0, 4);
    const pos = (p: typeof ps[0]) => (['DM', 'CM', 'RB', 'ST', 'AM'] as const).find((x) => canRetrain(p, x))!;
    for (const p of ps.slice(0, 3)) expect(startRetrain(w, p, pos(p)).ok).toBe(true);
    expect(startRetrain(w, ps[3], pos(ps[3])).ok).toBe(false);
    retrainMonth(w);
    const prog = ps[0].retrain!.progress, tp = ps[0].retrain!.pos;
    stopRetrain(ps[0]);
    expect(ps[0].retrain).toBeUndefined();
    startRetrain(w, ps[0], tp);
    expect(ps[0].retrain!.progress).toBe(prog);
  });
});

describe('유스 아카데미', () => {
  it('시즌마다 유망주 입단 · 매달 성장 · 잠재력은 범위 안 · 1군 승격 · 19세 떠남', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    const r = academySeason(w, '2025-26');
    const ac = academyOf(w);
    expect(r.joined.length).toBeGreaterThanOrEqual(3);
    expect(Object.values(w.players).some((p) => r.joined.includes(p.id))).toBe(false);   // 1군 · 전체 선수 밖
    const p = ac.players[0];
    const [lo, hi] = potentialRange(w, p);
    expect(p.potential!).toBeGreaterThanOrEqual(lo); expect(p.potential!).toBeLessThanOrEqual(hi);
    const o0 = overall(p);
    const rng = createRng(5);
    w.date = '2025-08-01';
    for (let i = 0; i < 10; i++) academyMonth(w, rng);
    console.log('유망주', p.pos, `능력 ${o0} → ${overall(p)} · 잠재력 ${p.potential} (보이는 범위 ${potentialRange(w, p).join('–')})`);
    expect(overall(p)).toBeGreaterThan(o0);
    expect(potentialRange(w, p)[1] - potentialRange(w, p)[0]).toBeLessThan(hi - lo + 1);
    const n = w.clubs[LIV].squad.length;
    const res = promote(w, p.id, 40);
    expect(res.ok).toBe(true);
    expect(w.clubs[LIV].squad.length).toBe(n + 1);
    expect(w.players[p.id].clubId).toBe(LIV);
    // 18세 선수는 2년 뒤 시즌에 떠난다
    const old = ac.players[0];
    if (old) { old.birth = '2007-01-01'; const r2 = academySeason(w, '2026-27'); expect(r2.left).toContain(old.id); }
  });
});
