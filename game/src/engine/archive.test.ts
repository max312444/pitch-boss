import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, advanceDay, type SeasonInput } from './world';
import { packWorld, unpackPlayer } from './archive';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';
import type { World } from './types';

const DATA = path.resolve(__dirname, '../../../data-public');
const LIVERPOOL = 'c83d96l';
function loadSeason(season: string, league: string): SeasonInput {
  const dir = path.join(DATA, 'seasons', season, league);
  const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8'));
  return { season, leagues: [{ id: league, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }] };
}

describe('은퇴 선수 보관 (세이브 크기)', () => {
  it('지난 시즌 이전 은퇴 선수만 가볍게 저장하고, 불러오면 그대로 진행된다', () => {
    const w = createWorld(loadSeason('2025-26', 'eng1'), LIVERPOOL, 3);
    const ids = w.clubs[LIVERPOOL].squad.slice(0, 3);
    const [old, recent, virt] = ids.map((id) => w.players[id]);
    for (const p of [old, recent, virt]) { w.clubs[LIVERPOOL].squad = w.clubs[LIVERPOOL].squad.filter((x) => x !== p.id); p.clubId = null; p.retired = true; }
    old.retiredOn = '2023-24';
    old.career = [{ season: '2023-24', club: LIVERPOOL, apps: 30, goals: 5, assists: 0, rating: 7.1 }, { season: '2022-23', club: null, apps: 0, goals: 0, assists: 0, rating: null }];
    old.honours = [{ season: '2023-24', kind: 'potm' as never, league: 'eng1' }];
    recent.retiredOn = w.season;    // 이번 시즌 은퇴: 은퇴 소식 · 보고서용으로 그대로
    virt.intlOnly = true;            // 대표팀 전용 가상 선수: retiredOn 없음 → 그대로

    const text = JSON.stringify(packWorld(w));
    const saved = JSON.parse(text) as World;
    const s = saved.players[old.id] as unknown as Record<string, unknown>;
    expect(s.archived).toBe(true);
    expect(s.base).toBeUndefined();
    expect(s.hidden).toBeUndefined();
    expect(s.name).toBe(old.name);
    expect(saved.players[old.id].career).toHaveLength(1);   // 뛴 시즌만
    expect(saved.players[old.id].honours).toHaveLength(1);
    expect(saved.players[recent.id].hidden).toBeDefined();
    expect(saved.players[virt.id].hidden).toBeDefined();
    expect(w.players[old.id].hidden).toBeDefined();   // 원본 월드는 그대로

    for (const p of Object.values(saved.players)) unpackPlayer(p);
    const back = saved.players[old.id];
    expect(back.stats.apps).toBe(0);
    expect(back.hidden.loyalty).toBe(10);
    expect(back.career).toEqual([{ season: '2023-24', club: LIVERPOOL, apps: 30, goals: 5, assists: 0, rating: null }]);   // 평점은 빠지고 도움 0
    for (let i = 0; i < 20; i++) advanceDay(saved);
    expect(saved.players[old.id].retired).toBe(true);
  });
});

describe('짧은 저장 형식', () => {
  it('저장 → 불러오기 하면 현역 선수는 하나도 다르지 않고, 크기는 줄어든다', () => {
    const w = createWorld(loadSeason('2025-26', 'eng1'), LIVERPOOL, 5);
    for (let i = 0; i < 60; i++) advanceDay(w);
    // 모양이 다른 칸도 섞기: 컵 기록이 있는 경력 · 한쪽만 있는 컵 기록 · pom · 부상 · 일부만 있는 성장
    const [a, b, c] = w.clubs[LIVERPOOL].squad.map((id) => w.players[id]);
    a.career.push({ season: '2024-25', club: LIVERPOOL, apps: 3, goals: 1, assists: 2, rating: 6.8, cupApps: 2, cupGoals: 0 });
    b.career.push({ season: '2024-25', club: null, apps: 0, goals: 0, assists: 0, rating: null, cupApps: 1 });
    a.stats.pom = 2;
    b.injury = { days: 5, label: 'x' };
    c.growth = { sho: 2, one: -1 };
    c.suspension = 1;

    const before = JSON.parse(JSON.stringify(w)) as World;
    const oldSize = JSON.stringify(w).length;
    const text = JSON.stringify(packWorld(w));
    expect(JSON.stringify(w).length).toBe(oldSize);           // 원본 월드는 그대로
    expect(text.length).toBeLessThan(oldSize * 0.75);
    const saved = JSON.parse(text) as World;
    for (const p of Object.values(saved.players)) unpackPlayer(p);
    expect(saved).toEqual(before);
    // 능력치 · 성장 · 숨은 속성 · 경력은 칸 순서까지 같다 (칸 순서대로 난수를 뽑는 코드가 있음)
    for (const [id, p] of Object.entries(before.players)) for (const k of ['base', 'growth', 'hidden', 'career', 'stats'] as const)
      expect(JSON.stringify(saved.players[id][k])).toBe(JSON.stringify(p[k]));
    // 이어서 진행해도 같은 결과 (같은 시드 상태에서)
    for (let i = 0; i < 10; i++) { advanceDay(saved); advanceDay(before); }
    expect(saved).toEqual(before);
  });
});
