// 이용자 피드백 고침: 윙어 ↔ 측면 미드필더 · 후보 직접 정하기 · 자리 고르기 순서
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { bySlotFit, ratingAt, slotRating } from './ratings';
import { pickLineup } from './squad';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const LIV = 'c83d96l';
const load = (season: string): SeasonInput => ({ season, leagues: ['eng1'].map((id) => { const dir = path.join(DATA, 'seasons', season, id); const m: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: m.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const w = createWorld(load('2025-26'), LIV, 3);

describe('피드백 고침', () => {
  it('윙어를 측면 미드필더 자리에 넣어도 능력이 1 넘게 떨어지지 않는다 (반대도)', () => {
    const wings = Object.values(w.players).filter((p) => ['LW', 'RW', 'LM', 'RM'].includes(p.pos)).slice(0, 200);
    const pair: Record<string, 'LW' | 'LM' | 'RW' | 'RM'> = { LW: 'LM', LM: 'LW', RW: 'RM', RM: 'RW' };
    let worst = 0;
    for (const p of wings) worst = Math.max(worst, ratingAt(p, p.pos) - ratingAt(p, pair[p.pos]));
    expect(worst).toBeLessThanOrEqual(1.0001);
    const p = wings.find((x) => x.pos === 'LW')!;
    console.log('예: LW', Math.round(slotRating(p, 'LW')), '→ LM', Math.round(slotRating(p, 'LM')));
  });
  it('후보를 직접 정하면 뺀 자리를 자동으로 채우지 않는다', () => {
    const players = w.clubs[LIV].squad.map((id) => w.players[id]);
    const auto = pickLineup(players, '4-3-3', 9);
    const fewer = auto.bench.slice(1);
    expect(pickLineup(players, '4-3-3', 9, undefined, fewer).bench).toHaveLength(9);          // 예전처럼: 다시 채움
    expect(pickLineup(players, '4-3-3', 9, undefined, fewer, undefined, true).bench).toEqual(fewer);   // 직접 정함: 빈자리 그대로
  });
  it('자리 고르기: 그 포지션 선수가 먼저', () => {
    const players = w.clubs[LIV].squad.map((id) => w.players[id]);
    const list = [...players].sort(bySlotFit('CB'));
    const firstNonCb = list.findIndex((p) => p.pos !== 'CB' && slotRating(p, 'CB') > 0 && !['CB'].includes(p.pos));
    const lastCb = list.map((p) => p.pos).lastIndexOf('CB');
    expect(lastCb).toBeLessThan(firstNonCb === -1 ? Infinity : list.length);
    expect(list.slice(0, list.filter((p) => p.pos === 'CB').length).every((p) => p.pos === 'CB' || (p.alt ?? []).includes('CB'))).toBe(true);
  });
});
