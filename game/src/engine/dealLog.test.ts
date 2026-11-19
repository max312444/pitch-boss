// 거래 기록: 내 구단이 낀 거래만 · 성사와 무산 · 포지션 요약
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { breakTalks, completeTransfer, releasePlayer } from './transfer';
import { loanMove } from './loan';
import { dealSummary } from './dealLog';
import { joinPrecontract, signPrecontract } from './bosman';
import { posGroup } from '../data/rating';
import { overall } from './ratings';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const LIV = 'c83d96l';

describe('거래 기록', () => {
  it('내 구단 영입 · 판매 · 임대 · 방출 · 결렬을 남기고, AI 끼리 거래는 남기지 않는다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 4);
    w.date = '2025-08-10';
    const [a, b] = Object.keys(w.clubs).filter((id) => id !== LIV && w.competitions[w.clubs[id].league]);
    const pick = (club: string, n = 0) => w.clubs[club].squad.map((id) => w.players[id]).sort((x, y) => overall(x) - overall(y))[n];
    const buy = pick(a), ai = pick(b), broke = pick(a, 1), loanIn = pick(b, 1);
    const sell = w.players[w.clubs[LIV].squad[0]];
    completeTransfer(w, buy, LIV, 3_000_000, buy.wage, 3);
    completeTransfer(w, ai, a, 1_000_000, ai.wage, 3);          // AI 끼리: 기록 없음
    completeTransfer(w, sell, b, 20_000_000, sell.wage, 4);
    breakTalks(w, broke.id, '이적료 합의 실패');
    loanMove(w, loanIn, LIV, { share: 1, fee: 0 });
    const rel = w.players[w.clubs[LIV].squad.find((id) => !w.players[id].loan && id !== buy.id)!];
    releasePlayer(w, rel);
    const log = w.dealLog ?? [];
    expect(log.map((e) => [e.dir, e.kind, e.ok])).toEqual([
      ['in', 'transfer', true], ['out', 'transfer', true], ['in', 'transfer', false], ['in', 'loan', true], ['out', 'release', true],
    ]);
    expect(log[0]).toMatchObject({ player: buy.id, club: a, fee: 3_000_000, season: '2025-26' });
    expect(log[2].why).toBe('이적료 합의 실패');
    const s = dealSummary(log, posGroup);
    const total = Object.values(s).reduce((t, g) => ({ in: t.in + g.in, out: t.out + g.out, failed: t.failed + g.failed }), { in: 0, out: 0, failed: 0 });
    expect(total).toEqual({ in: 2, out: 2, failed: 1 });
  });

  it('같은 날 같은 선수의 무산은 한 줄로', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 4);
    const other = Object.keys(w.clubs).find((id) => id !== LIV)!;
    const p = w.players[w.clubs[other].squad[0]];
    breakTalks(w, p.id, '하나'); breakTalks(w, p.id, '둘');
    expect((w.dealLog ?? []).length).toBe(1);
    expect(w.dealLog![0].why).toBe('둘');
  });

  it('사전 계약 (보스만): 계약한 시즌에 성사로 세고, 합류하면 같은 줄에 합류 날짜 (줄이 늘지 않음)', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 4);
    w.date = '2026-01-10';
    const other = Object.keys(w.clubs).find((id) => id !== LIV && w.competitions[w.clubs[id].league])!;
    const p = w.players[w.clubs[other].squad[0]];
    signPrecontract(w, p, LIV, p.wage, 3);
    const s = dealSummary(w.dealLog ?? [], posGroup);
    expect(Object.values(s).reduce((t, g) => t + g.in, 0)).toBe(1);
    w.date = '2026-07-01';
    joinPrecontract(w, p);
    expect(p.clubId).toBe(LIV);
    expect(w.dealLog!.length).toBe(1);
    expect(w.dealLog![0]).toMatchObject({ kind: 'precontract', ok: true, joined: '2026-07-01', season: '2025-26' });
  });
});
