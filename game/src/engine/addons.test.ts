// 이적 조건 (셀온 · 보너스) 테스트
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { completeTransfer, counterOffer, evaluateBid, askingPrice } from './transfer';
import { addOnApp, addOnGoal, addOnTitles, bonusChance, clauseRows, termsError, termsLine, termsWorth } from './addons';
import { loanMove, loanReturn } from './loan';
import { ledgerOf } from './finance';
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

  it('셀온 · 보너스를 넣으면 구단이 알려 주는 금액(역제안)이 내려가고, 그 금액을 내면 받아들인다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 3);
    const pool = Object.values(w.players).filter((p) => p.clubId && p.clubId !== LIV && w.competitions[w.clubs[p.clubId].league] && ageOn(p.birth, w.date) <= 24);
    let n = 0;
    for (const p of pool.slice(0, 200)) {
      const ask = askingPrice(w, p);
      if (ask < 3e6) continue;
      const cash = Math.round(ask * 0.8);
      const terms = { sellOn: 20, bonus: { amount: Math.floor(cash * 0.3 / 5e5) * 5e5, apps: 20 } };
      const a = evaluateBid(w, p, LIV, cash), b = evaluateBid(w, p, LIV, cash, terms);
      if (a.decision !== 'counter' || b.decision !== 'counter') continue;
      expect(b.ask).toBeLessThan(a.ask);                                       // 조건만큼 덜 요구
      expect(b.reason).toContain(`${Math.round(b.ask / 1e5) / 10}M`);
      expect(evaluateBid(w, p, LIV, b.ask, terms).decision).toBe('accept');   // 알려 준 금액이면 성사
      n++;
    }
    expect(n).toBeGreaterThan(3);
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

describe('보너스 종류 (v2.19): 골 · 리그 우승', () => {
  it('골 보너스: 출전으로는 안 늘고, 골 수를 채우면 지급 (재정 장부 「조항」 항목)', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 11);
    const [x] = others(w);
    const p = w.players[w.clubs[x].squad[3]];
    completeTransfer(w, p, LIV, 10e6, 50000, 4, { bonus: { amount: 3e6, apps: 5, kind: 'goals' } });
    expect(p.addOn).toMatchObject({ kind: 'goals', apps: 5, done: 0 });
    for (let i = 0; i < 30; i++) addOnApp(w, p);
    expect(p.addOn?.done).toBe(0);
    const bl = bal(w, LIV), bx = bal(w, x);
    for (let i = 0; i < 4; i++) addOnGoal(w, p);
    expect(bal(w, LIV)).toBe(bl);
    expect(termsLine(w, p, (id) => id)).toContain('골 4/5');
    addOnGoal(w, p);
    expect(bl - bal(w, LIV)).toBe(3e6);
    expect(bal(w, x) - bx).toBe(3e6);
    expect(p.addOn).toBeUndefined();
    expect(ledgerOf(w).current.expense.clauseOut).toBe(3e6);
    expect(w.inbox.filter((e) => e.type === 'clause')).toMatchObject([{ kind: 'bonus', dir: 'out', amount: 3e6, bk: 'goals' }]);
  });

  it('우승 보너스: 내는 구단이 리그 우승하면 지급, 다른 구단 우승이면 그대로', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 12);
    const [x, y] = others(w);
    const p = w.players[w.clubs[x].squad[4]];
    completeTransfer(w, p, LIV, 10e6, 50000, 4, { bonus: { amount: 2e6, apps: 1, kind: 'title' } });
    const bl = bal(w, LIV);
    addOnTitles(w, [y]);
    expect(p.addOn).toBeDefined();
    expect(bal(w, LIV)).toBe(bl);
    addOnTitles(w, [LIV]);
    expect(bl - bal(w, LIV)).toBe(2e6);
    expect(p.addOn).toBeUndefined();
  });

  it('보너스 값어치: 골은 공격수가 수비수보다, 우승은 명성 1위 구단이 하위 구단보다 크다', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 13);
    const all = Object.values(w.players).filter((p) => p.clubId && w.competitions[w.clubs[p.clubId].league]);
    const st = all.find((p) => p.pos === 'ST')!, cb = all.find((p) => p.pos === 'CB')!;
    expect(bonusChance(10, 'goals', w, st)).toBeGreaterThan(bonusChance(10, 'goals', w, cb) * 3);
    const clubs = Object.values(w.clubs).filter((c) => c.league === 'eng1').sort((a, b) => b.reputation - a.reputation);
    expect(bonusChance(1, 'title', w, st, clubs[0].id)).toBeGreaterThan(bonusChance(1, 'title', w, st, clubs.at(-1)!.id) * 5);
    expect(termsError(10e6, { bonus: { amount: 2e6, apps: 10, kind: 'goals' } })).toBeNull();
    expect(termsError(10e6, { bonus: { amount: 2e6, apps: 7, kind: 'goals' } })).not.toBeNull();
    expect(termsError(10e6, { bonus: { amount: 2e6, apps: 1, kind: 'title' } })).toBeNull();
  });
});

describe('임대 중 보너스 (v2.19)', () => {
  it('내는 구단이 임대 보내면 멈췄다가 돌아오면 이어서 센다 (없어지지 않음)', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 14);
    const [x, y] = others(w);
    const p = w.players[w.clubs[x].squad[5]];
    completeTransfer(w, p, LIV, 10e6, 50000, 4, { bonus: { amount: 1e6, apps: 20 } });
    for (let i = 0; i < 5; i++) addOnApp(w, p);
    loanMove(w, p, y, { share: 1, fee: 0 });
    for (let i = 0; i < 30; i++) addOnApp(w, p);   // 임대 가서 뛴 경기는 안 셈
    expect(p.addOn).toMatchObject({ done: 5 });
    expect(termsLine(w, p, (id) => id)).toContain('임대 중 멈춤');
    expect(clauseRows(w, LIV).find((r) => r.player === p.id)).toMatchObject({ kind: 'bonus', dir: 'out', paused: true });
    loanReturn(w, p);
    for (let i = 0; i < 15; i++) addOnApp(w, p);
    expect(p.addOn).toBeUndefined();               // 5 + 15 = 20 → 지급
    expect(w.inbox.filter((e) => e.type === 'clause')).toMatchObject([{ kind: 'bonus', dir: 'out', amount: 1e6 }]);
  });
});

describe('팔 때 보너스 요구 (v2.19)', () => {
  const setup = (seed: number) => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, seed);
    const p = w.players[w.clubs[LIV].squad.find((id) => w.players[id].pos === 'ST') ?? w.clubs[LIV].squad[0]];
    const [y] = others(w);
    const mk = (): TransferOffer => ({ id: 'o', player: p.id, from: y, fee: 10e6, max: 12e6, tries: 0, date: w.date, expires: '2099-01-01' });
    return { w, p, y, mk };
  };
  it('보너스를 요구하면 사는 구단이 그만큼 덜 내고, 합의하면 제안에 붙어 이적 뒤 선수에 걸린다', () => {
    const { w, p, y, mk } = setup(15);
    expect(counterOffer(w, mk(), 12e6).result).toBe('accept');
    const big = counterOffer(w, mk(), 12e6, 0, { amount: 5e6, apps: 20 });
    expect(big.result).not.toBe('accept');           // 보너스까지면 12M 은 비쌈
    const o = mk();
    const ok = counterOffer(w, o, 10e6, 0, { amount: 2e6, apps: 10, kind: 'goals' });
    expect(ok.result).toBe('accept');
    expect(ok.reason).toContain('10골');
    expect(o.bonus).toEqual({ amount: 2e6, apps: 10, kind: 'goals' });
    completeTransfer(w, p, y, o.fee, 60000, 3, { bonus: o.bonus });
    expect(p.addOn).toMatchObject({ club: LIV, payer: y, kind: 'goals', apps: 10 });
    expect(clauseRows(w, LIV)).toContainEqual(expect.objectContaining({ player: p.id, kind: 'bonus', dir: 'in', club: y, bk: 'goals' }));
    const bl = bal(w, LIV);
    for (let i = 0; i < 10; i++) addOnGoal(w, p);
    expect(bal(w, LIV) - bl).toBe(2e6);
    expect(ledgerOf(w).current.income.clauseIn).toBe(2e6);
  });
  it('이적료 절반을 넘는 보너스는 거절 (기회는 안 씀)', () => {
    const { w, mk } = setup(16);
    const o = mk();
    const r = counterOffer(w, o, 10e6, 0, { amount: 6e6, apps: 20 });
    expect(r.result).toBe('reject');
    expect(r.reason).toContain('절반');
    expect(o.tries).toBe(0);
  });
});

describe('조항 한눈에 보기 (v2.19)', () => {
  it('받을 셀온 · 낼 셀온 · 받은 셀온은 장부 「조항 수입」', () => {
    const w = createWorld(load('2025-26', ['eng1']), LIV, 17);
    const [x, y, z] = others(w);
    const sold = w.players[w.clubs[LIV].squad[6]];
    completeTransfer(w, sold, y, 20e6, 50000, 4, { sellOn: 15 });
    const bought = w.players[w.clubs[x].squad[6]];
    completeTransfer(w, bought, LIV, 10e6, 50000, 4, { sellOn: 10 });
    const rows = clauseRows(w, LIV);
    expect(rows).toContainEqual(expect.objectContaining({ player: sold.id, kind: 'sellOn', dir: 'in', club: y, pct: 15 }));
    expect(rows).toContainEqual(expect.objectContaining({ player: bought.id, kind: 'sellOn', dir: 'out', club: x, pct: 10 }));
    const before = ledgerOf(w).current.income.clauseIn ?? 0;
    completeTransfer(w, sold, z, 30e6, 60000, 4);
    expect(ledgerOf(w).current.income.clauseIn - before).toBe(4.5e6);
    expect(clauseRows(w, LIV).some((r) => r.player === sold.id)).toBe(false);
  });
});
