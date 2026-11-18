// 자유계약 선수: 이적시장 밖에도 AI 가 데려가고, 마감일까지 아무도 안 데려간 선수는 정리된다
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { aiFreeAgentDay, faCleanup, releasePlayer } from './transfer';
import { overall } from './ratings';
import { createRng } from './rng';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const LIV = 'c83d96l';

describe('자유계약 선수', () => {
  it('이적시장 밖에서도 쓸 만한 FA (34세 포함) 는 AI 구단이 데려간다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    w.date = '2025-10-15';
    const ai = Object.values(w.clubs).filter((c) => c.id !== LIV);
    // 구단마다 주전급 한 명씩 풀어 FA 로 (나이를 34세로)
    const freed = ai.map((c) => { const p = c.squad.map((id) => w.players[id]).sort((a, b) => overall(b) - overall(a))[4]; releasePlayer(w, p); p.birth = '1991-03-01'; return p; });
    const rng = createRng(1);
    for (let d = 0; d < 120; d++) aiFreeAgentDay(w, rng);
    const signed = freed.filter((p) => p.clubId);
    expect(signed.length).toBeGreaterThan(freed.length * 0.6);
    expect(signed.every((p) => p.contract && p.contract <= '2027-06-30')).toBe(true);   // 31세 이상은 1년
  });

  it('마감일 정리: 33세 이상 · 능력 낮은 FA 는 은퇴, 쓸 만한 젊은 FA 는 남는다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    w.date = '2025-09-01';
    const ps = w.clubs[Object.keys(w.clubs).find((id) => id !== LIV)!].squad.map((id) => w.players[id]).sort((a, b) => overall(b) - overall(a));
    const old = ps[0], young = ps[1];
    for (const p of [old, young]) releasePlayer(w, p);
    old.birth = '1990-01-01'; young.birth = '2001-01-01';
    const gone = faCleanup(w);
    expect(gone).toContain(old.id);
    expect(old.retired).toBe(true);
    expect(young.retired).toBeFalsy();
  });
});

describe('임대 선수 방출', () => {
  it('빌린 구단이 내보내면 무소속이 아니라 원소속 구단으로 돌아간다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    const [a, b] = Object.keys(w.clubs).filter((id) => id !== LIV);
    const p = w.players[w.clubs[a].squad[5]];
    // a → b 임대
    w.clubs[a].squad = w.clubs[a].squad.filter((id) => id !== p.id);
    w.clubs[a].loanedOut = [p.id];
    w.clubs[b].squad.push(p.id);
    p.clubId = b;
    p.loan = { from: a, until: '2026-06-30', share: 0.5, fee: 0, start: w.date };
    releasePlayer(w, p);
    expect(p.clubId).toBe(a);
    expect(p.loan).toBeUndefined();
    expect(w.clubs[a].squad).toContain(p.id);
    expect(w.clubs[b].squad).not.toContain(p.id);
    expect(w.clubs[a].loanedOut).not.toContain(p.id);
  });
});
