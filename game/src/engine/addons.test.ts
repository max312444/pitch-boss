// 이적 조건 (셀온 · 보너스) 테스트
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { completeTransfer, counterOffer, evaluateBid, askingPrice } from './transfer';
import { addOnApp, termsError, termsWorth } from './addons';
import { ageOn } from './condition';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';
import type { TransferOffer, World } from './types';

const DATA = path.resolve(__dirname, '../../../data-public');
const LIV = 'c83d96l';
const load = (season: string, ids: string[]): SeasonInput => ({
  season, leagues: ids.map((id) => {
    const dir = path.join(DATA, 'seasons', season, id);
    const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8'));
    return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) };
  }),
});
const bal = (w: World, c: string) => w.clubs[c].finance.balance;
const others = (w: World) => Object.values(w.clubs).filter((c) => c.id !== LIV && w.competitions[c.league]).map((c) => c.id);

describe('셀온', () => {
  it('내가 사 온 선수에 걸린 셀온: 내가 다시 팔면 원래 구단 몫이 빠진다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    const [x, y] = others(w);
    const p = w.players[w.clubs[x].squad[0]];
    completeTransfer(w, p, LIV, 10e6, 50000, 4, { sellOn: 15 });
    expect(p.sellOn).toEqual({ club: x, pct: 15 });
    const bx = bal(w, x), bl = bal(w, LIV), by = bal(w, y);
    completeTransfer(w, p, y, 40e6, 60000, 4);
    expect(bal(w, x) - bx).toBe(6e6);           // 원래 구단 15%
    expect(bal(w, LIV) - bl).toBe(34e6);        // 나는 나머지
    expect(by - bal(w, y)).toBe(40e6);          // 사는 구단은 전액
    expect(p.sellOn).toBeUndefined();           // 이번 이적으로 끝
    const ev = w.inbox.filter((e) => e.type === 'clause');
    expect(ev).toMatchObject([{ kind: 'sellOn', dir: 'out', amount: 6e6, club: x, pct: 15 }]);
  });

  it('내가 셀온을 걸고 판 선수가 다시 팔리면 내가 받는다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 4);
    const [y, z] = others(w);
    const p = w.players[w.clubs[LIV].squad[5]];
    completeTransfer(w, p, y, 20e6, 50000, 4, { sellOn: 20 });
    const bl = bal(w, LIV), by = bal(w, y);
    completeTransfer(w, p, z, 30e6, 60000, 4);
    expect(bal(w, LIV) - bl).toBe(6e6);
    expect(bal(w, y) - by).toBe(24e6);
    expect(w.inbox.filter((e) => e.type === 'clause')).toMatchObject([{ kind: 'sellOn', dir: 'in', amount: 6e6, club: z }]);
  });

  it('파는 구단은 셀온 · 보너스를 이적료에 더해 본다 (어린 선수일수록 셀온 값어치가 크다)', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 5);
    const pool = Object.values(w.players).filter((p) => p.clubId && p.clubId !== LIV && w.competitions[w.clubs[p.clubId].league]);
    const young = pool.find((p) => ageOn(p.birth, w.date) <= 21)!, old = pool.find((p) => ageOn(p.birth, w.date) >= 30)!;
    expect(termsWorth(w, young, 10e6, { sellOn: 20 })).toBeGreaterThan(termsWorth(w, old, 10e6, { sellOn: 20 }) * 3);
    // 원하는 가격의 90% 현금 + 셀온 · 보너스면 받아들이는 선수가 있다 (현금만이면 역제안)
    let flipped = 0;
    for (const p of pool.slice(0, 300)) {
      const ask = askingPrice(w, p);
      if (ask < 2e6) continue;
      const cash = Math.round(ask * 0.9);
      const a = evaluateBid(w, p, LIV, cash), b = evaluateBid(w, p, LIV, cash, { sellOn: 20, bonus: { amount: Math.round(cash * 0.2), apps: 20 } });
      if (a.decision === 'counter' && b.decision === 'accept') flipped++;
    }
    expect(flipped).toBeGreaterThan(5);
  });

  it('받은 제안에 셀온을 요구하면 사는 구단은 그만큼 덜 낸다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 6);
    const p = w.players[w.clubs[LIV].squad.find((id) => ageOn(w.players[id].birth, w.date) <= 23)!];
    const [y] = others(w);
    const mk = (): TransferOffer => ({ id: 'o', player: p.id, from: y, fee: 10e6, max: 12e6, tries: 0, date: w.date, expires: '2099-01-01' });
    const plain = counterOffer(w, mk(), 12e6);
    expect(plain.result).toBe('accept');
    const o = mk();
    const withSo = counterOffer(w, o, 12e6, 20);
    expect(withSo.result).not.toBe('accept');      // 셀온까지면 12M 은 너무 비쌈
    const o2 = mk();
    const ok = counterOffer(w, o2, 10e6, 10);
    expect(ok.result).toBe('accept');
    expect(o2.sellOn).toBe(10);
  });

  it('조건 검사: 셀온 10/15/20 · 보너스는 이적료 절반까지', () => {
    expect(termsError(10e6, { sellOn: 15 })).toBeNull();
    expect(termsError(10e6, { sellOn: 12 })).not.toBeNull();
    expect(termsError(10e6, { bonus: { amount: 5e6, apps: 50 } })).toBeNull();
    expect(termsError(10e6, { bonus: { amount: 6e6, apps: 50 } })).not.toBeNull();
  });
});

describe('보너스 (조건부 추가 이적료)', () => {
  it('출전 경기 수를 채우면 그날 원래 구단에 지급, 그 전에 떠나면 없어짐', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 7);
    const [x, y] = others(w);
    const p = w.players[w.clubs[x].squad[1]];
    completeTransfer(w, p, LIV, 10e6, 50000, 4, { bonus: { amount: 2e6, apps: 20 } });
    expect(p.addOn).toMatchObject({ club: x, payer: LIV, amount: 2e6, apps: 20, done: 0 });
    const bx = bal(w, x), bl = bal(w, LIV);
    for (let i = 0; i < 19; i++) addOnApp(w, p);
    expect(bal(w, LIV)).toBe(bl);
    expect(p.addOn?.done).toBe(19);
    addOnApp(w, p);
    expect(bl - bal(w, LIV)).toBe(2e6);
    expect(bal(w, x) - bx).toBe(2e6);
    expect(p.addOn).toBeUndefined();
    expect(w.inbox.filter((e) => e.type === 'clause')).toMatchObject([{ kind: 'bonus', dir: 'out', amount: 2e6, club: x, apps: 20 }]);

    // 다른 선수: 채우기 전에 떠나면 없어짐
    const q = w.players[w.clubs[x].squad[2]];
    completeTransfer(w, q, LIV, 8e6, 50000, 4, { bonus: { amount: 1e6, apps: 50 } });
    for (let i = 0; i < 10; i++) addOnApp(w, q);
    completeTransfer(w, q, y, 9e6, 50000, 4);
    expect(q.addOn).toBeUndefined();
  });
});
