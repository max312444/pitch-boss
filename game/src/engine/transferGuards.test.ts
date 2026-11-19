// 이적 안전장치: 임대 중 · 사전 계약 선수를 이적시킬 때 소속 · 돈이 꼬이지 않게
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { endLoans, loanMove } from './loan';
import { completeTransfer } from './transfer';
import { overall } from './ratings';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const LIV = 'c83d96l';
const fresh = () => { const w = createWorld(load('2025-26', ['eng1']), LIV, 21); w.date = '2025-08-10'; return w; };

describe('이적 안전장치', () => {
  it('임대 중인 선수를 사면: 이적료는 원소속 구단에, 시즌 끝에 원소속으로 돌아가지 않는다', () => {
    const w = fresh();
    const [owner, borrower] = Object.keys(w.clubs).filter((id) => id !== LIV && w.competitions[w.clubs[id].league]);
    const p = w.clubs[owner].squad.map((id) => w.players[id]).sort((a, b) => overall(a) - overall(b))[0];
    loanMove(w, p, borrower, { share: 1, fee: 0 });
    const ob = w.clubs[owner].finance.balance, bb = w.clubs[borrower].finance.balance;
    completeTransfer(w, p, LIV, 5_000_000, p.wage, 3);
    expect(p.clubId).toBe(LIV);
    expect(p.loan).toBeUndefined();
    expect(w.clubs[owner].finance.balance).toBeGreaterThan(ob);         // 원소속 구단이 판 돈을 받음
    expect(w.clubs[borrower].finance.balance).toBe(bb);                 // 빌린 구단은 돈을 못 받음
    expect(w.clubs[owner].loanedOut ?? []).not.toContain(p.id);
    expect(w.clubs[borrower].squad).not.toContain(p.id);
    endLoans(w);
    expect(p.clubId).toBe(LIV);
  });

  it('사전 계약한 선수를 사면 사전 계약은 사라진다 (시즌 끝에 공짜로 떠나지 않음)', () => {
    const w = fresh();
    const [x, y] = Object.keys(w.clubs).filter((id) => id !== LIV && w.competitions[w.clubs[id].league]);
    const p = w.players[w.clubs[LIV].squad[0]];
    p.precontract = { club: x, wage: p.wage, years: 3, date: w.date };
    completeTransfer(w, p, y, 10_000_000, p.wage, 4);
    expect(p.precontract).toBeUndefined();
    expect(p.clubId).toBe(y);
  });
});
