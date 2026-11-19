import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { altPositions, ratingAt, slotRating } from './ratings';
import { seenOverall, seenRange } from './scout';
import type { ClubSeasonFile, LeagueSeasonFile, Position } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const SLOTS: Position[] = ['ST', 'LW', 'AM', 'RW', 'LM', 'CM', 'RM', 'LWB', 'DM', 'RWB', 'LB', 'CB', 'RB'];
function input(season: string): SeasonInput {
  const dir = path.join(DATA, 'seasons', season);
  const ids = fs.readdirSync(dir).filter((x) => fs.existsSync(path.join(dir, x, '_league.json')));
  return { season, leagues: ids.map((id) => {
    const m: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, id, '_league.json'), 'utf8'));
    return { id, clubs: m.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, id, `${c}.json`), 'utf8')) as ClubSeasonFile) };
  }) };
}

describe('주 포지션 능력 ≥ 다른 모든 자리 (보조 포함)', () => {
  for (const season of ['2005-06', '2025-26']) {
    it(`${season} 모든 선수 · 정확한 값과 스카우트 범위 모두`, () => {
      const w = createWorld(input(season), 'c83d96l', 1);
      const bad: string[] = [];
      for (const p of Object.values(w.players)) {
        if (p.pos === 'GK' || p.retired) continue;
        altPositions(p);
        const main = slotRating(p, p.pos);
        for (const s of SLOTS) {
          if (slotRating(p, s) > main + 1e-9 || ratingAt(p, s) > ratingAt(p, p.pos) + 1e-9) bad.push(`${p.id} ${s}`);
          // 스카우트 정보 0~95% 모든 단계에서 보이는 범위도 주 포지션 범위를 넘지 않는다
          for (let k = 0; k <= 100; k += 5) {
            const [ml, mh] = seenRange(w, p, 'ovr', main, k), [lo, hi] = seenRange(w, p, 'ovr', slotRating(p, s), k);
            if (lo > ml || hi > mh) bad.push(`${p.id} ${s} k${k}`);
          }
        }
        // 주 포지션 범위 = 맨 위 '능력' 범위
        const [ml, mh] = seenRange(w, p, 'ovr', main), [ol, oh] = seenOverall(w, p);
        if (ml !== ol || mh !== oh) bad.push(`${p.id} ovr`);
      }
      expect(bad.slice(0, 10)).toEqual([]);
    }, 120_000);
  }
});
