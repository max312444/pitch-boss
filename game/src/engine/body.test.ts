// 키 · 체형 · 피지컬 대결 (수비 실책)
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, prepareMatch, type SeasonInput } from './world';
import { playToEnd } from './match';
import { createRng } from './rng';
import { bodyType, heightOf } from './body';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const LIV = 'c83d96l';

describe('키 · 체형', () => {
  const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
  it('데이터의 키가 선수에게 들어가고, 없으면 추정', () => {
    const ps = Object.values(w.players);
    expect(ps.filter((p) => p.height).length / ps.length).toBeGreaterThan(0.9);
    const p = { ...ps[0], height: undefined };
    const h = heightOf(p);
    expect(h).toBeGreaterThanOrEqual(163); expect(h).toBeLessThanOrEqual(202);
    expect(heightOf(p)).toBe(h);   // 같은 선수는 늘 같은 추정
  });
  it('체형은 능력치가 바뀌면 바뀐다 (몸싸움 벌크업)', () => {
    const p = structuredClone(Object.values(w.players).find((x) => x.pos === 'CM' && (x.height ?? 0) <= 178 && (x.base.str ?? 0) < 70)!);
    p.weight = undefined;   // 몸무게가 없으면 몸싸움 능력치로
    const before = bodyType(p);
    p.base.str = 85;
    expect(bodyType(p)).not.toBe(before);
    expect(bodyType(p)).toBe('stocky');
    const kinds = new Set(Object.values(w.players).map(bodyType));
    console.log('체형 종류', [...kinds].join(','));
    expect(kinds.size).toBeGreaterThanOrEqual(5);
  });
});

describe('몸무게', () => {
  it('몸무게가 있으면 실제 체격으로: 같은 키 · 능력치라도 무거우면 근육질 · 다부진, 가벼우면 날렵 · 호리호리', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    const p = structuredClone(Object.values(w.players).find((x) => x.pos === 'CB')!);
    p.height = 191; p.base.str = 70; p.base.pac = 60;
    p.weight = 92; expect(bodyType(p)).toBe('tower');
    p.weight = 74; expect(bodyType(p)).toBe('lanky');
    p.height = 178; p.base.str = 74; p.weight = 82; expect(bodyType(p)).toBe('stocky');
  });
});

describe('피지컬 대결 · 수비 실책', () => {
  it('경기마다 가끔 (팀당 0.1 ~ 0.6회), 느린 수비수는 속도 실책이 크게 늘어난다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 5);
    const comp = Object.values(w.competitions)[0];
    const fx = comp.fixtures.filter((f) => f.home === LIV).slice(0, 6);
    const run = (n: number) => {
      let errs = 0, goals = 0, pace = 0, games = 0;
      fx.forEach((f, j) => { for (let i = 0; i < n; i++) {
        const s = playToEnd(prepareMatch(w, f, createRng(i + 1 + j * 100)), { players: w.players, rng: createRng(i + 9 + j * 100) });
        for (const e of s.errors ?? []) if (e.side === 'home') { errs++; if (e.goal) goals++; if (e.kind === 'pace') pace++; }
        games++;
        for (const p of Object.values(w.players)) p.injury = null;
      } });
      return { errs: errs / games, goals: goals / games, pace: pace / games };
    };
    const base = run(40);
    // 리버풀 수비진 속도를 크게 낮춤 → 속도 실책 증가
    for (const id of w.clubs[LIV].squad) { const p = w.players[id]; if (['CB', 'LB', 'RB'].includes(p.pos)) p.base.pac = 45; }
    const slow = run(40);
    console.log('리버풀 실책/경기', base.errs.toFixed(2), '(실점', base.goals.toFixed(2), '속도', base.pace.toFixed(2), ') → 느린 수비', slow.errs.toFixed(2), '속도', slow.pace.toFixed(2));
    expect(base.errs).toBeGreaterThan(0.05); expect(base.errs).toBeLessThan(0.6);
    expect(slow.pace).toBeGreaterThan(base.pace * 1.5);
  }, 120000);
});
