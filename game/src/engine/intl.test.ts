// 세계 대회 모드 (대표팀 감독) 테스트
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { advanceDay, createWorld, seasonOver, type SeasonInput } from './world';
import { closeSeason, nextSeasonOf, startNextSeason } from './season';
import { autoCallUp, callUpPool, cycleStage, intlNextSeason, repairIntl, setupIntl, STAGE_KO, switchNation } from './intl';
import { setWcPools, setWcSquads, type WcPools, type WcSquads } from './wcsquads';
import { NT } from './worldcup';
import { sortTable } from './standings';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const LEAGUES = ['eng1', 'esp1'];   // 빠르게: 두 리그만 (나머지 나라 선수는 국내파로)
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'meta', 'worldcups.json'), 'utf8'));
setWcSquads(JSON.parse(fs.readFileSync(path.join(DATA, 'worldcups', 'squads.json'), 'utf8')) as WcSquads);
setWcPools(JSON.parse(fs.readFileSync(path.join(DATA, 'worldcups', 'pools.json'), 'utf8')) as WcPools);
const loadAll = (season: string): SeasonInput => ({
  season, worldCups: meta, leagues: LEAGUES.filter((l) => fs.existsSync(path.join(DATA, 'seasons', season, l))).map((id) => {
    const dir = path.join(DATA, 'seasons', season, id);
    const m: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8'));
    return { id, clubs: m.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) };
  }),
});

function playSeason(w: ReturnType<typeof createWorld>) {
  let guard = 0;
  while (!seasonOver(w) && guard++ < 450) advanceDay(w);
  return guard;
}

describe('세계 대회 모드', () => {
  it('잉글랜드 2005/06: 예선 6경기 → 통과면 본선 (실제 명단으로 다른 나라) → 다음 주기', () => {
    const input = loadAll('2005-06');
    const w = createWorld(input, input.leagues[0].clubs[0].club, 31);
    setupIntl(w, 'ENG');
    const me = NT('ENG');
    expect(w.userClubId).toBe(me);
    expect(w.clubs[me].squad).toHaveLength(23);
    expect(w.intl!.fixtures.filter((f) => f.name?.startsWith('세계 대회 예선'))).toHaveLength(6);
    playSeason(w);
    const it = w.intl!;
    expect(it.quali?.done).toBe(true);
    const tbl = sortTable(it.quali!.group.table);
    expect(tbl.every((r) => r.p === 6)).toBe(true);   // 같은 조 다른 경기도 모두 계산
    const inCup = w.worldCup!.groups.some((g) => g.teams.includes(me));
    expect(inCup).toBe(it.quali!.result === 'qualified');
    expect(w.worldCup!.winner).toBeTruthy();
    // 다른 나라는 실제 명단 (게임에 없는 선수는 실명으로 만든 대표 전용 선수)
    const kor = w.clubs[NT('KOR')] ?? null;
    const stage = cycleStage(w);
    console.log('잉글랜드 예선', tbl.map((r) => `${r.club.slice(3)} ${r.pts}`).join(' · '), '→', it.quali!.result, '· 본선 성적', STAGE_KO[stage], '· 목표', STAGE_KO[it.objective], '· 우승', w.worldCup!.winner, '· 한국 명단', kor?.squad.length ?? '없음');
    closeSeason(w);
    startNextSeason(w, loadAll(nextSeasonOf(w.season)));
    intlNextSeason(w, stage);
    expect(w.intl!.cycle).toBe(2010);
    expect(w.intl!.history).toHaveLength(1);
    expect(w.clubs[me].squad.length).toBeGreaterThanOrEqual(23);
    expect(w.intl!.fixtures.every((f) => f.name === '친선경기')).toBe(true);
    expect(Object.keys(w.clubs).filter((id) => id.startsWith('nt-'))).toEqual([me]);   // 상대 대표팀 정리
  }, 300000);

  it('한국 2001/02: 개최국이라 예선 없이 친선 → 본선 · 실제 2002 명단 선수가 소집 후보', () => {
    const input = loadAll('2001-02');
    const w = createWorld(input, input.leagues[0].clubs[0].club, 32);
    setupIntl(w, 'KOR');
    expect(w.intl!.host).toBe(true);
    expect(w.intl!.fixtures.every((f) => f.name === '친선경기')).toBe(true);
    const pool = callUpPool(w);
    expect(pool.length).toBeGreaterThanOrEqual(23);
    expect(w.intl!.domestic.length).toBeGreaterThan(40);   // 실제 2002 명단 + 그 시즌 대표 풀 (게임에 없는 선수)
    console.log('한국 2001/02 소집 후보', pool.length, '명 (국내파', w.intl!.domestic.length, ')');
    expect(autoCallUp(w)).toHaveLength(23);
    playSeason(w);
    expect(w.worldCup!.groups.some((g) => g.teams.includes(NT('KOR')))).toBe(true);
    console.log('한국 2002 본선 성적', STAGE_KO[cycleStage(w)], '· 친선', w.intl!.fixtures.filter((f) => f.result).map((f) => `${f.result!.homeGoals}-${f.result!.awayGoals}`).join(' '));
  }, 300000);

  it('협회 평가: 목표보다 2단계 아래면 경질 → 다른 나라 3곳 중 고르기, 2단계 위면 더 큰 나라 제안', () => {
    const input = loadAll('2009-10');
    const w = createWorld(input, input.leagues[0].clubs[0].club, 33);
    setupIntl(w, 'KOR');
    w.intl!.objective = 'qf';
    intlNextSeason(w, 'group');
    const job = w.intl!.job!;
    expect(job.reason).toBe('sacked');
    expect(job.offers).toHaveLength(3);
    switchNation(w, job.offers[0]);
    expect(w.userClubId).toBe(NT(job.offers[0]));
    expect(w.clubs[w.userClubId].squad.length).toBeGreaterThanOrEqual(20);
    expect(w.intl!.fixtures.length).toBeGreaterThan(0);
    expect(w.intl!.job).toBeUndefined();
    // 목표를 크게 넘으면 제안
    w.intl!.objective = 'group';
    intlNextSeason(w, 'sf');
    expect(w.intl!.job?.reason).toBe('offer');
    console.log('경질 뒤 제안', job.offers.join(', '), '→', job.offers[0], '· 잘하면 제안', w.intl!.job!.offers.join(', '));
  }, 120000);

  it('대표 전용 선수가 다음 시즌 실제 데이터에 나오면 실제 구단 선수로 이어진다 · 불러올 때 고치기', () => {
    const input = loadAll('2002-03');
    const w = createWorld(input, input.leagues[0].clubs[0].club, 34);
    setupIntl(w, 'KOR');
    const next = loadAll('2003-04');
    const nextIds = new Set(next.leagues.flatMap((l) => l.clubs.flatMap((c) => c.squad.map((s) => s.id))));
    const moving = w.intl!.domestic.filter((id) => nextIds.has(id));
    let guard = 0; while (!seasonOver(w) && guard++ < 450) advanceDay(w);
    const stage = cycleStage(w);
    closeSeason(w); startNextSeason(w, next); intlNextSeason(w, stage);
    for (const id of moving) { const p = w.players[id]; expect(p.intlOnly).toBeFalsy(); expect(p.retired).toBeFalsy(); expect(p.clubId).toBeTruthy(); }
    console.log('다음 시즌 실제 구단으로 간 대표 전용 선수', moving.length, '명');
    // 불러올 때 고치기: 데이터 없이 만든 것처럼 가상 국내파만 → 고침
    const sq = w.clubs[w.userClubId];
    expect(repairIntl(w)).toBe(false);   // 이미 정상
    sq.squad = sq.squad.slice(0, 5);
    repairIntl(w);
    expect(sq.squad.length).toBeGreaterThanOrEqual(23);
  }, 180000);
});
