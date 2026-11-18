// 이적 어필 (역제안): 사이가 나쁜 선수가 주전 경쟁이 될 만한 구단에 먼저 연락 — 우리 구단 · 다른 구단
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { aiAppealDay, appealDay, troubleOf } from './appeal';
import { marketValue } from './transfer';
import { overall } from './ratings';
import { createRng } from './rng';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const LIV = 'c83d96l';

describe('이적 어필 (역제안)', () => {
  it('갈등 정도: 만족한 선수는 0, 불만 · 벤치 · 낮은 충성도면 커진다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 5);
    const p = Object.values(w.players).find((x) => x.clubId && x.clubId !== LIV && !x.contract?.startsWith('2026'))!;
    p.loyalty = 70; p.unhappy = false; p.benchStreak = 0; p.morale = 70; p.saga = undefined;
    expect(troubleOf(w, p)).toBe(0);
    p.loyalty = 25; p.unhappy = true; p.benchStreak = 8;
    expect(troubleOf(w, p)).toBeGreaterThan(3);
  });

  it('우리 구단: 갈등 있는 선수만, 우리 주전과 겨룰 만한 급이 연락한다 (겨룰 주전을 알려 줌)', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 6);
    w.date = '2025-07-10';
    // 다른 구단 선수 전체를 만족 상태로, 몇 명만 갈등 상태로
    for (const p of Object.values(w.players)) if (p.clubId && p.clubId !== LIV) { p.loyalty = 70; p.unhappy = false; p.benchStreak = 0; p.morale = 70; p.saga = undefined; p.contract = '2029-06-30'; }
    const troubled = Object.values(w.players).filter((p) => p.clubId && p.clubId !== LIV).sort((a, b) => overall(b) - overall(a)).slice(10, 80);
    for (const p of troubled) { p.loyalty = 20; p.unhappy = true; p.benchStreak = 7; }
    const got = [];
    for (let i = 0; i < 300 && got.length < 4; i++) {
      w.appeals = [];
      const ev = appealDay(w, createRng(i + 1));
      got.push(...ev);
    }
    expect(got.length).toBeGreaterThan(0);
    for (const e of got) {
      if (e.type !== 'appeal') continue;
      const p = w.players[e.player];
      expect(troubleOf(w, p)).toBeGreaterThan(0);
      if (e.rival) {
        const r = w.players[e.rival];
        expect(r.clubId).toBe(LIV);
        expect(r.pos === p.pos || r.alt?.includes(p.pos)).toBe(true);
        const gap = overall(p) - overall(r);
        expect(gap).toBeGreaterThanOrEqual(-3);
        expect(gap).toBeLessThanOrEqual(6);
      }
    }
    console.log('어필', got.map((e) => e.type === 'appeal' ? `${e.player} ${overall(w.players[e.player])} vs ${e.rival ? overall(w.players[e.rival]) : '빈 자리'}` : '').join(' · '));
  });

  it('다른 구단: 이적시장에 갈등 선수가 겨룰 만한 구단으로 시세의 80% 정도에 옮긴다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 7);
    for (const c of Object.values(w.clubs)) c.finance.transferBudget = 200e6;
    const troubled = Object.values(w.players).filter((p) => p.clubId && p.clubId !== LIV).slice(0, 120);
    for (const p of troubled) { p.loyalty = 15; p.unhappy = true; p.benchStreak = 9; }
    const moves: { id: string; from: string; to: string; fee: number; value: number }[] = [];
    for (let d = 1; d <= 60; d++) {
      w.date = `2025-07-${String(Math.min(d, 31)).padStart(2, '0')}`;
      if (d > 31) w.date = `2025-08-${String(d - 31).padStart(2, '0')}`;
      aiAppealDay(w, (p, to, fee) => { moves.push({ id: p.id, from: p.clubId!, to, fee, value: marketValue(w, p) }); return true; });
    }
    console.log('역제안 이적', moves.length, '건');
    expect(moves.length).toBeGreaterThan(3);
    for (const m of moves) {
      expect(m.to).not.toBe(LIV);
      expect(m.to).not.toBe(m.from);
      expect(m.fee).toBeLessThanOrEqual(Math.max(m.value, 200000) * 0.8 + 50000);
    }
    // 우리 선수도 연락한다: 몰래 이적하지 않고, 그 구단이 우리에게 제안 (받은편지함 · 받은 제안)
    for (const p of Object.values(w.players)) if (p.clubId && p.clubId !== LIV) { p.loyalty = 80; p.unhappy = false; p.benchStreak = 0; p.morale = 70; p.saga = undefined; }
    const mine = w.clubs[LIV].squad.map((id) => w.players[id]).slice(0, 25);
    for (const p of mine) { p.loyalty = 10; p.unhappy = true; p.benchStreak = 10; }
    w.appealSeen = {};
    let forced = 0;
    for (let d = 1; d <= 31; d++) { w.date = `2025-07-${String(d).padStart(2, '0')}`; aiAppealDay(w, () => { forced++; return true; }); }
    const offers = (w.offers ?? []).filter((o) => o.appeal);
    console.log('우리 선수 역제안 → 받은 제안', offers.length, '건');
    expect(forced).toBe(0);
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expect(w.players[o.player].clubId).toBe(LIV);
      expect(w.inbox.some((e) => e.type === 'offer' && e.appeal && e.player === o.player)).toBe(true);
    }
    // 이적시장 밖에는 일어나지 않는다
    w.date = '2025-10-10';
    let n = 0;
    aiAppealDay(w, () => { n++; return true; });
    expect(n).toBe(0);
  });
});
