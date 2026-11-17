// 나의 구단 인수 방식: 그대로 인수 · 투자 인수 (구단주 조건)
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { investGoal, investStart, newMyClubId, ownerGoalSeasonEnd, plainStart, setupMyClub, squadNeeds, swapInput, weakestClub, type MyClubState } from './myclub';
import { ensureManager, managerNewSeason } from './manager';
import { createRng } from './rng';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });

function make(tk: 'plain' | 'invest') {
  let input = load('2025-26', ['eng1']);
  const lg = input.leagues[0];
  const rep = weakestClub(lg.clubs);
  const st = tk === 'plain' ? plainStart(rep) : investStart(lg.clubs, rep);
  const seed = 7;
  const my: MyClubState = { id: newMyClubId(seed), replaced: rep.club, nation: 'ENG', founded: 2025, setup: false, takeover: tk, ...(tk === 'invest' ? { goal: investGoal(lg.clubs.length, '2025-26') } : {}),
    design: { name: '테스트 FC', short: 'TST', colors: ['#112233', '#ffffff', '#000000'], shape: 'shield', pattern: 'solid', charge: 'letters', stadium: '테스트 구장' } };
  const sw = swapInput(input, my, st, true);
  input = sw.input;
  const w = createWorld(input, my.id, seed);
  setupMyClub(w, my, sw.freed);
  return { w, my, rep, lg };
}

describe('나의 구단 인수', () => {
  it('그대로 인수: 꼴찌 구단 선수단 · 재정을 그대로 받고 바로 시즌을 시작할 수 있다', () => {
    const { w, my, rep } = make('plain');
    const c = w.clubs[my.id];
    expect(c.squad.length).toBe(rep.squad.length);
    expect(c.squad.every((id) => rep.squad.some((p) => p.id === id))).toBe(true);
    expect(c.finance.transferBudget).toBe(rep.finance.transferBudget);
    expect(squadNeeds(w).ok).toBe(true);
    expect(Object.values(w.players).some((p) => rep.squad.some((s) => s.id === p.id) && !p.clubId)).toBe(false);   // FA 로 안 풀림
  });
  it('투자 인수: 이적 자금 · 잔고가 크게 늘고 조건은 3시즌 안에 6위 이내', () => {
    const { w, my, rep, lg } = make('invest');
    const c = w.clubs[my.id];
    console.log(`투자 인수: 이적 예산 ${(rep.finance.transferBudget / 1e6).toFixed(1)}M → ${(c.finance.transferBudget / 1e6).toFixed(1)}M · 잔고 ${(rep.finance.balance / 1e6).toFixed(1)}M → ${(c.finance.balance / 1e6).toFixed(1)}M · 주급 ${(rep.finance.wageBudget / 1e3).toFixed(0)}K → ${(c.finance.wageBudget / 1e3).toFixed(0)}K/주 · 조건 ${JSON.stringify(my.goal)}`);
    expect(c.finance.transferBudget).toBeGreaterThan(rep.finance.transferBudget * 1.5);
    expect(c.squad.length).toBe(rep.squad.length);
    expect(my.goal).toEqual({ pos: lg.clubs.length >= 18 ? 6 : Math.ceil(lg.clubs.length / 3), from: '2025-26', by: '2027-28' });
  });
  it('조건 달성 → 알림 · 관계 ↑ / 기한까지 못 지키면 해임', () => {
    const { w, my } = make('invest');
    const others = Object.keys(w.clubs).filter((id) => id !== my.id && w.clubs[id].league === 'eng1');
    const tableAt = (pos: number) => [{ league: 'eng1', table: [...others.slice(0, pos - 1), my.id, ...others.slice(pos - 1)].map((club) => ({ club })) }];
    ensureManager(w);
    // 1시즌 12위: 진행 알림만
    expect(ownerGoalSeasonEnd(w, tableAt(12))).toBe(false);
    expect(w.inbox.at(-1)).toMatchObject({ type: 'info' });
    // 3시즌째 (기한) 10위: 실패 → 새 시즌에 새 구단 고르기
    w.season = '2027-28';
    expect(ownerGoalSeasonEnd(w, tableAt(10))).toBe(true);
    expect(w.myClub!.goal!.failed).toBe(true);
    w.manager!.sackAtEnd = true;
    const ev = managerNewSeason(w, createRng(1));
    expect(w.manager!.pendingJob?.reason).toBe('sacked');
    expect(ev.length).toBe(1);
    // 다른 게임: 2시즌째 5위 → 달성
    const b = make('invest');
    ensureManager(b.w);
    const rel = b.w.manager!.relation ?? 55;
    b.w.season = '2026-27';
    const o2 = Object.keys(b.w.clubs).filter((id) => id !== b.my.id && b.w.clubs[id].league === 'eng1');
    expect(ownerGoalSeasonEnd(b.w, [{ league: 'eng1', table: [...o2.slice(0, 4), b.my.id, ...o2.slice(4)].map((club) => ({ club })) }])).toBe(false);
    expect(b.w.myClub!.goal!.met).toBe(true);
    expect(b.w.manager!.relation).toBeGreaterThan(rel);
  });
});
