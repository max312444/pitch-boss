// 영입 협상: 밀고 당기기 (역제안 · 인내심 · 최저선) · 선수 마음 요인
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { askingPrice, joinFactors, playerWillJoin, talkBanned } from './transfer';
import { FEE_TRIES, negotiateFee, sellerFloor, sellerHint } from './negotiation';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';
import type { World } from './types';

const DATA = path.resolve(__dirname, '../../../data-public');
const LIV = 'c83d96l';
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const fresh = () => { const w = createWorld(load('2025-26', ['eng1']), LIV, 21); w.date = '2025-07-10'; w.clubs[LIV].finance.transferBudget = 500e6; return w; };
/** 협상할 만한 선수: 다른 구단 · 핵심 아님 · 선수단 넉넉 */
const target = (w: World, i = 0) => Object.values(w.players).filter((p) => p.clubId && p.clubId !== LIV && w.clubs[p.clubId].squad.length > 20 && askingPrice(w, p) >= 5e6 && !p.loan)
  .sort((a, b) => askingPrice(w, b) - askingPrice(w, a)).filter((p) => sellerFloor(w, p).why.every((x) => x !== '팀의 핵심 선수'))[i];

describe('이적료 협상', () => {
  it('낮게 부르면 구단이 조금씩 내려오는 역제안 · 역제안 금액을 내면 수락', () => {
    const w = fresh(); const p = target(w);
    const ask = askingPrice(w, p);
    const a = negotiateFee(w, p, ask * 0.7);
    expect(a.decision).toBe('counter');
    expect(a.counterCash!).toBeLessThan(ask);           // 원하는 값보다 내려옴
    expect(a.counterCash!).toBeGreaterThan(ask * 0.7);  // 우리 제안보다는 높음
    expect(a.mood).toBeLessThan(100);
    const b = negotiateFee(w, p, ask * 0.75);
    expect(b.counterCash!).toBeLessThanOrEqual(a.counterCash!);   // 역제안은 올라가지 않는다
    const c = negotiateFee(w, p, b.counterCash!);
    expect(c.decision).toBe('accept');
    expect(w.talks?.[p.id]?.agreed).toBe(b.counterCash);
  });

  it('무례한 제안 (원하는 값의 60% 미만): 역제안 없이 인내심이 크게 깎이고, 계속하면 결렬', () => {
    const w = fresh(); const p = target(w, 1);
    const ask = askingPrice(w, p);
    const a = negotiateFee(w, p, ask * 0.3);
    expect(a.insult).toBe(true);
    expect(a.counterCash).toBeUndefined();
    expect(a.mood).toBeLessThanOrEqual(60);
    negotiateFee(w, p, ask * 0.3);
    const c = negotiateFee(w, p, ask * 0.3);
    expect(c.broken).toBe(true);
    expect(talkBanned(w, p.id)).not.toBeNull();
  });

  it('마지막 기회엔 최저선까지 내려와 "마지막" · 최저선은 원하는 값보다 낮다', () => {
    const w = fresh(); const p = target(w, 2);
    const ask = askingPrice(w, p);
    let r = negotiateFee(w, p, ask * 0.8);
    for (let i = 1; i < FEE_TRIES - 1 && !r.final; i++) r = negotiateFee(w, p, ask * 0.82);
    expect(r.final).toBe(true);
    expect(r.counterCash!).toBeLessThan(ask);
    expect(r.counterCash!).toBeGreaterThanOrEqual(Math.floor(ask * 0.78 / 1e5) * 1e5);
    expect(negotiateFee(w, p, r.counterCash!).decision).toBe('accept');
  });

  it('많이 낮게 불러도 첫 역제안에서 바로 최저선을 드러내지 않는다', () => {
    for (let i = 0; i < 6; i++) {
      const w = fresh(); const p = target(w, i);
      const r = negotiateFee(w, p, askingPrice(w, p) * 0.62);
      expect(r.final).toBe(false);
      expect(r.counterCash!).toBeGreaterThan(askingPrice(w, p) * sellerFloor(w, p).f);
    }
  });

  it('원하는 값 이상이면 첫 제안에 바로 수락 · 기회 안 씀', () => {
    const w = fresh(); const p = target(w, 3);
    const r = negotiateFee(w, p, askingPrice(w, p));
    expect(r.decision).toBe('accept');
    expect(r.left).toBe(FEE_TRIES);
  });

  it('구단 분위기 힌트: 핵심 선수는 비싸게, 내놓은 선수는 싸게', () => {
    const w = fresh();
    const club = w.clubs[Object.keys(w.clubs).find((c) => c !== LIV)!];
    const ps = club.squad.map((id) => w.players[id]);
    const best = ps.reduce((a, b) => (askingPrice(w, a) > askingPrice(w, b) ? a : b));
    expect(sellerHint(w, best).level).toBe('high');
    const spare = ps[ps.length - 1];
    w.transferList = [spare.id]; spare.contract = '2026-06-30';
    expect(sellerFloor(w, spare).f).toBeLessThan(sellerFloor(w, best).f);
  });
});

describe('선수 마음', () => {
  it('요인 합 = 점수, 역할 · 주급을 올리면 마음이 커진다 · 거절하면 걸리는 점을 말한다', () => {
    const w = fresh(); const p = target(w);
    const j = joinFactors(w, p, LIV, p.wage, 'rotation');
    expect(j.score).toBeCloseTo(j.factors.reduce((a, x) => a + x.v, 0), 6);
    expect(joinFactors(w, p, LIV, p.wage * 1.5, 'key').score).toBeGreaterThan(j.score);
    // 작은 구단으로 가라고 하면 거절하며 이유를 댄다
    const small = Object.values(w.clubs).filter((c) => w.competitions[c.league]).sort((a, b) => a.reputation - b.reputation)[0];
    const top = Object.values(w.players).filter((x) => x.clubId && w.clubs[x.clubId].reputation >= 85).sort((a, b) => b.loyalty - a.loyalty)[0];
    const r = playerWillJoin(w, top, small.id, joinFactors(w, top, small.id, 0).demand, 'backup', undefined, undefined, undefined, 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('걸리는 점');
  });

  it('계약 기간: 30세 이상은 1년 계약을 싫어하고 긴 계약을 반긴다', () => {
    const w = fresh();
    const old = Object.values(w.players).find((x) => x.clubId && x.clubId !== LIV && +x.birth.slice(0, 4) <= 1994)!;
    const one = joinFactors(w, old, LIV, old.wage, 'regular', undefined, undefined, undefined, 1).score;
    const three = joinFactors(w, old, LIV, old.wage, 'regular', undefined, undefined, undefined, 3).score;
    expect(three).toBeGreaterThan(one);
  });
});
