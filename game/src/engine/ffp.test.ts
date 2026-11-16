// 재정 규정 징계: 초과율 · 위반 횟수에 따라 경고 → 벌금 → 감점 → 영입 금지, 새 시즌 적용, 한 시즌 돌렸을 때 빈도
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { advanceDay, createWorld, type SeasonInput } from './world';
import { ffpNewSeason, ffpOf, ffpSeasonEnd, judge, transferBan } from './ffp';
import { costLimit, squadCost } from './rules';
import { canAfford } from './transfer';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';
import type { World } from './types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const LIV = 'c83d96l';

/** 선수단 비용이 한도의 (1 + over) 배가 되게 매출을 줄인다 */
function setOver(w: World, id: string, over: number) {
  const c = w.clubs[id];
  const cost = squadCost(w, id);
  for (let i = 0; i < 40; i++) {
    const { limit } = costLimit(w, id);
    const cur = cost / limit - 1;
    if (Math.abs(cur - over) < 0.005) return;
    c.finance.revenue = Math.round((c.finance.revenue ?? 1e8) * (1 + cur) / (1 + over));
  }
}

describe('재정 규정 징계', () => {
  it('초과율 · 위반 횟수에 따라 단계별', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 81);
    const id = Object.keys(w.clubs).find((x) => x !== LIV)!;
    const c = w.clubs[id];
    expect(judge(w, c).kind).toBe('clean');
    setOver(w, id, 0.08);
    expect(judge(w, c).kind).toBe('warn');           // 처음 · 10% 이하
    setOver(w, id, 0.18);
    const v = judge(w, c);
    expect(v.kind).toBe('fine');                     // 처음 · 18%
    expect(v.fine).toBeGreaterThan(0);
    ffpOf(w, c).strikes = 1;
    expect(judge(w, c)).toMatchObject({ kind: 'deduct' });   // 두 번째
    expect(judge(w, c).deduct).toBeGreaterThanOrEqual(3);
    ffpOf(w, c).strikes = 0;
    setOver(w, id, 0.6);
    const big = judge(w, c);
    expect(big.ban).toBe(true);                      // 50% 넘음
    expect(big.deduct).toBe(10);
  });

  it('시즌 끝: 벌금 · 감점 예약 → 새 시즌 적용 · 영입 금지 중엔 이적료 영입 불가 (자유계약은 가능)', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 82);
    const id = Object.keys(w.clubs).find((x) => x !== LIV)!;   // AI 구단 (내 구단은 매출 기준이 장부에 고정)
    setOver(w, id, 0.6);
    const bal = w.clubs[id].finance.balance;
    ffpSeasonEnd(w);
    const v = w.clubs[id].ffp!;
    expect(v.strikes).toBe(1);
    expect(bal - w.clubs[id].finance.balance).toBeGreaterThan(0);   // 벌금
    expect(w.clubs[id].ffp!.pending).toMatchObject({ ban: true });
    const pts = w.competitions.eng1.table[id].pts;
    ffpNewSeason(w);
    expect(w.competitions.eng1.table[id].pts).toBe(pts - 10);
    expect(transferBan(w, id)).toBeTruthy();
    setOver(w, id, -0.3);   // 매출이 돌아와 한도 안이어도 영입 금지는 기한까지
    w.clubs[id].finance.transferBudget = 1e9;
    expect(canAfford(w, id, 1e6, 0, 3)).toBe(false);
    expect(canAfford(w, id, 0, 0, 3)).toBe(true);
  });

  it('보통 시즌을 돌리면 대부분 구단은 문제없음 (징계는 소수)', () => {
    const w = createWorld(load('2025-26', ['eng1', 'esp1']), LIV, 83);
    while (w.date < '2026-05-31') { advanceDay(w); w.sagaPrompt = undefined; w.scandalPrompt = undefined; if (w.manager) { w.manager.press = undefined; w.manager.boardEvent = undefined; } }
    const kinds: Record<string, number> = {};
    for (const c of Object.values(w.clubs)) { const k = judge(w, c).kind; kinds[k] = (kinds[k] ?? 0) + 1; }
    console.log('시즌 끝 심사 (40구단)', kinds);
    expect((kinds.clean ?? 0) / Object.keys(w.clubs).length).toBeGreaterThan(0.8);
  }, 120_000);
});
