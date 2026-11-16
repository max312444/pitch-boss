// 나의 구단 만들기 테스트
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { advanceDay, createWorld, seasonOver, type SeasonInput } from './world';
import { closeSeason, startNextSeason } from './season';
import { completeTransfer, wageDemand } from './transfer';
import { currentAsData, MY_YOUTH, myStart, newMyClubId, setupMyClub, squadNeeds, swapInput, weakestClub, type MyClubState } from './myclub';
import { overall } from './ratings';
import { ensureManager, managerDay, managerNewSeason } from './manager';
import { createRng } from './rng';
import { posGroup } from '../data/rating';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';
import type { World } from './types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({
  season, leagues: ids.map((id) => {
    const dir = path.join(DATA, 'seasons', season, id);
    const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8'));
    return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) };
  }),
});

function makeMine(season: string, league: string, seed: number) {
  let input = load(season, [league]);
  const lg = input.leagues[0];
  const rep = weakestClub(lg.clubs);
  const st = myStart(lg.clubs, rep);
  const my: MyClubState = { id: newMyClubId(seed), replaced: rep.club, nation: 'ENG', founded: +season.slice(0, 4), setup: true,
    design: { name: '테스트 FC', short: 'TST', colors: ['#112233', '#ffffff', '#000000'], shape: 'shield', pattern: 'solid', charge: 'letters', stadium: '테스트 구장' } };
  const sw = swapInput(input, my, { ...st, formation: '4-3-3' });
  input = sw.input;
  const w = createWorld(input, my.id, seed, { skipFill: [my.id] });
  setupMyClub(w, my, sw.freed);
  return { w, my, rep, st, freed: sw.freed, lg };
}

/** 자유계약 선수로 포지션별 · 전체 인원 채우기 (능력 순) */
function fillFromFA(w: World) {
  const me = w.clubs[w.userClubId];
  const want: Record<string, number> = { GK: 3, DF: 8, MF: 8, FW: 5 };
  const fa = Object.values(w.players).filter((p) => !p.clubId && !p.retired).sort((a, b) => overall(b) - overall(a));
  for (const p of fa) {
    const g = posGroup(p.pos);
    const have = me.squad.filter((id) => posGroup(w.players[id].pos) === g).length;
    if (have >= want[g]) continue;
    completeTransfer(w, p, me.id, 0, wageDemand(w, p, me.id), 2);
  }
}

describe('나의 구단 만들기', () => {
  it('꼴찌 자리를 대신: 그 구단은 사라지고 선수는 FA, 유스로 시작 · 재정은 넉넉하게', () => {
    const { w, my, rep, st, freed, lg } = makeMine('2025-26', 'eng1', 21);
    expect(w.clubs[rep.club]).toBeUndefined();
    expect(Object.keys(w.competitions.eng1.table)).toHaveLength(lg.clubs.length);
    expect(w.competitions.eng1.table[my.id]).toBeTruthy();
    expect(freed.length).toBe(rep.squad.length);
    for (const sp of freed) expect(w.players[sp.id].clubId).toBeNull();
    const me = w.clubs[my.id];
    expect(me.squad).toHaveLength(MY_YOUTH);
    expect(me.squad.every((id) => w.players[id].generated)).toBe(true);
    // 리그 아래쪽 중간값보다 넉넉하게
    const low = [...lg.clubs].sort((a, b) => a.reputation - b.reputation).slice(0, 10);
    const med = [...low.map((c) => c.finance.transferBudget)].sort((a, b) => a - b)[5];
    expect(st.finance.transferBudget).toBeGreaterThan(med * 1.5);
    expect(me.reputation).toBeGreaterThanOrEqual(rep.reputation);
    // 아직 시즌 시작 불가
    expect(squadNeeds(w).ok).toBe(false);
    console.log('대신한 구단', rep.club, '명성', rep.reputation, '→ 내 구단', me.reputation, '· 이적 예산', st.finance.transferBudget / 1e6, 'M · FA', freed.length, '명');
  });

  it('내가 만든 구단에서는 경질되지 않고 감독 계약은 자동 연장', () => {
    const { w } = makeMine('2025-26', 'eng1', 23);
    fillFromFA(w);
    const m = ensureManager(w);
    // 시즌 중: 신뢰도 바닥 · 11월 1일 · 꼴찌
    w.date = '2025-11-01';
    for (const r of Object.values(w.competitions.eng1.table)) r.p = 10;
    m.confidence = 0;
    managerDay(w, createRng(1));
    expect(m.pendingJob).toBeUndefined();
    // 시즌 끝 경질 표시 없음 · 계약이 끝나도 새 시즌에 자동 연장
    m.contract = '2025-06-30';
    w.date = '2026-07-01';
    expect(managerNewSeason(w, createRng(2))).toEqual([]);
    expect(m.pendingJob).toBeUndefined();
    expect(m.contract > w.date).toBe(true);
    // 비교: 일반 구단이면 경질
    const w2 = createWorld(load('2025-26', ['eng1']), w.competitions.eng1 && Object.keys(w.competitions.eng1.table).find((id) => id !== w.userClubId)!, 23);
    const m2 = ensureManager(w2);
    w2.date = '2025-11-01';
    for (const r of Object.values(w2.competitions.eng1.table)) r.p = 10;
    m2.confidence = 0;
    managerDay(w2, createRng(1));
    expect(m2.pendingJob?.reason).toBe('sacked');
  });

  it('자유계약으로 채우면 시작 가능 → 한 시즌 → 다음 시즌 실제 데이터에서도 그 자리가 내 구단', () => {
    const { w, my, rep } = makeMine('2012-13', 'eng1', 22);
    fillFromFA(w);
    const n = squadNeeds(w);
    expect(n.ok).toBe(true);
    w.myClub!.setup = false;
    let guard = 0;
    while (!seasonOver(w) && guard++ < 400) advanceDay(w);
    expect(seasonOver(w)).toBe(true);
    closeSeason(w);
    const next = swapInput(load('2013-14', ['eng1']), my, currentAsData(w.clubs[my.id])).input;
    startNextSeason(w, next);
    expect(w.season).toBe('2013-14');
    expect(w.clubs[rep.club]).toBeUndefined();          // 대신한 구단은 다시 나오지 않음
    expect(w.clubs[my.id]).toBeTruthy();
    expect(Object.keys(w.competitions.eng1.table)).toHaveLength(20);
    console.log('2013/14 내 구단 리그', w.clubs[my.id].league, '· 선수단', w.clubs[my.id].squad.length);
  }, 120000);
});
