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
    expect(saved.players[old.id].career).toEqual([{ season: '2023-24', club: LIVERPOOL, apps: 30, goals: 5 }]);   // 뛴 시즌만, 평점 · 도움 0 뺌
    expect(saved.players[old.id].honours).toHaveLength(1);
    expect(saved.players[recent.id].hidden).toBeDefined();
    expect(saved.players[virt.id].hidden).toBeDefined();
    expect(w.players[old.id].hidden).toBeDefined();   // 원본 월드는 그대로

    for (const p of Object.values(saved.players)) unpackPlayer(p);
    const back = saved.players[old.id];
    expect(back.stats.apps).toBe(0);
    expect(back.hidden.loyalty).toBe(10);
    expect(back.career[0].rating).toBeNull();
    for (let i = 0; i < 20; i++) advanceDay(saved);
    expect(saved.players[old.id].retired).toBe(true);
  });
});
