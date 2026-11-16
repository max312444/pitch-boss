// 이적 조건: 셀온 · 보너스 (조건부 추가 이적료)
//  - 셀온: 파는 구단이 "다음에 이 선수가 다시 팔리면 그 이적료의 pct% 를 우리에게"를 건다.
//    다음 이적 때 그 이적의 파는 구단 몫에서 떼어 원래 구단에 준다 (completeTransfer → settleSellOn)
//  - 보너스: 사는 구단이 "이 선수가 우리 구단에서 apps 경기에 나오면 amount 를 더 낸다"를 건다 (리그 · 컵, 선발 · 교체 모두).
//    채우면 그날 바로 지급 (world.ts 경기 기록 → addOnApp). 그 전에 선수가 떠나면 없어짐
//  - 파는 구단은 조건을 이적료에 더해 판단한다 (termsWorth): 셀온은 어린 선수일수록, 보너스는 기준 경기 수가 적을수록 값어치가 크다
//  - AI 끼리 이적에도 가끔 붙는다 (aiTerms) → 셀온이 걸린 선수를 사 오면 나중에 팔 때 원래 구단에 떼어 준다
import type { PlayerState, World } from './types';
import type { Rng } from './rng';
import { book } from './finance';
import { ageOn } from './condition';

export interface DealTerms {
  /** 셀온 % (파는 구단이 받음) */
  sellOn?: number;
  /** 보너스: 사는 구단이 이 선수 출전 apps 경기를 채우면 amount 를 더 낸다 */
  bonus?: { amount: number; apps: number };
}

export const SELL_ON_PCTS = [0, 10, 15, 20] as const;
export const BONUS_APPS = [20, 50, 100] as const;
/** 보너스는 이적료의 절반까지 */
export const bonusCap = (fee: number) => Math.floor((fee * 0.5) / 5e5) * 5e5;

/** 셀온의 값어치 (이적료 대비): 어릴수록 다시 비싸게 팔릴 가능성이 커서 */
export function sellOnFactor(w: World, p: PlayerState): number {
  const age = ageOn(p.birth, w.date);
  return age <= 21 ? 0.75 : age <= 24 ? 0.5 : age <= 27 ? 0.3 : 0.1;
}
/** 보너스가 실제로 나갈 가능성 (기준 경기 수가 많을수록 낮게) */
export const bonusChance = (apps: number) => (apps <= 20 ? 0.75 : apps <= 50 ? 0.55 : 0.35);

/** 파는 구단이 보는 조건의 값 (이적료에 더해 판단) */
export function termsWorth(w: World, p: PlayerState, fee: number, t?: DealTerms): number {
  if (!t) return 0;
  let v = 0;
  if (t.sellOn) v += fee * (t.sellOn / 100) * sellOnFactor(w, p);
  if (t.bonus?.amount) v += t.bonus.amount * bonusChance(t.bonus.apps);
  return Math.round(v);
}

/** 조건이 정상인지 (화면 · 저장 값 검사). 잘못이면 이유 */
export function termsError(fee: number, t?: DealTerms): string | null {
  if (!t) return null;
  if (t.sellOn && !SELL_ON_PCTS.includes(t.sellOn as never)) return '셀온은 10 · 15 · 20% 중에서 고릅니다';
  if (t.bonus?.amount) {
    if (!BONUS_APPS.includes(t.bonus.apps as never)) return '보너스 기준 경기 수가 잘못됐습니다';
    if (t.bonus.amount > bonusCap(fee)) return `보너스는 이적료의 절반(${Math.round(bonusCap(fee) / 1e5) / 10}M 유로)까지만 걸 수 있습니다`;
  }
  return null;
}

const M = (v: number) => `${Math.round(v / 1e5) / 10}M 유로`;

/**
 * 이적 때 정산 (completeTransfer 에서 장부 처리 전에): 이 선수에게 걸린 셀온을 원래 구단에 준다.
 * 파는 구단(from)이 실제로 받을 금액을 돌려준다. 내 구단이 관련되면 받은편지함에 알림
 */
export function settleSellOn(w: World, p: PlayerState, from: string | null, to: string, fee: number): number {
  const so = p.sellOn;
  if (!so || !from || fee <= 0 || so.club === from || so.club === to || !w.clubs[so.club]) return fee;
  const cut = Math.round((fee * so.pct) / 100);
  book(w, so.club, 'sales', cut);
  const c = w.clubs[so.club];
  c.sales = (c.sales ?? 0) + cut;
  c.finance.transferBudget += Math.round(cut * 0.5);
  if (so.club === w.userClubId) w.inbox.push({ type: 'clause', date: w.date, player: p.id, kind: 'sellOn', dir: 'in', amount: cut, club: to, pct: so.pct, fee });
  else if (from === w.userClubId) w.inbox.push({ type: 'clause', date: w.date, player: p.id, kind: 'sellOn', dir: 'out', amount: cut, club: so.club, pct: so.pct, fee });
  return fee - cut;
}

/** 이적이 끝난 뒤 이번 계약의 조건 기록 (이전 조건은 이번 이적으로 끝남) */
export function setTerms(p: PlayerState, from: string | null, to: string, t?: DealTerms) {
  p.sellOn = from && t?.sellOn ? { club: from, pct: t.sellOn } : undefined;
  p.addOn = from && t?.bonus?.amount ? { club: from, payer: to, amount: Math.round(t.bonus.amount), apps: t.bonus.apps, done: 0 } : undefined;
}

/** 출전 1경기 (world.ts): 보너스 진행, 채우면 지급 */
export function addOnApp(w: World, p: PlayerState) {
  const a = p.addOn;
  if (!a) return;
  if (a.payer !== p.clubId || !w.clubs[a.club] || !w.clubs[a.payer]) { p.addOn = undefined; return; }
  a.done++;
  if (a.done < a.apps) return;
  p.addOn = undefined;
  book(w, a.payer, 'purchases', a.amount);
  const payer = w.clubs[a.payer];
  payer.finance.transferBudget = Math.max(0, payer.finance.transferBudget - a.amount);
  book(w, a.club, 'sales', a.amount);
  const rc = w.clubs[a.club];
  rc.sales = (rc.sales ?? 0) + a.amount;
  rc.finance.transferBudget += Math.round(a.amount * 0.5);
  if (a.payer === w.userClubId) w.inbox.push({ type: 'clause', date: w.date, player: p.id, kind: 'bonus', dir: 'out', amount: a.amount, club: a.club, apps: a.apps });
  else if (a.club === w.userClubId) w.inbox.push({ type: 'clause', date: w.date, player: p.id, kind: 'bonus', dir: 'in', amount: a.amount, club: a.payer, apps: a.apps });
}

/** AI 끼리 이적 조건 (가끔): 어린 선수는 셀온, 이적료가 크면 보너스 */
export function aiTerms(w: World, rng: Rng, p: PlayerState, fee: number): DealTerms | undefined {
  if (fee < 1e6) return undefined;
  const t: DealTerms = {};
  if (ageOn(p.birth, w.date) <= 24 && rng.chance(0.45)) t.sellOn = rng.pick([10, 15, 20]);
  if (fee >= 5e6 && rng.chance(0.25)) t.bonus = { amount: Math.max(5e5, Math.round((fee * (0.1 + rng.next() * 0.15)) / 5e5) * 5e5), apps: rng.pick([20, 50]) };
  return t.sellOn || t.bonus ? t : undefined;
}

/** 사는 구단(AI)이 내 선수 제안에 붙이는 보너스 (가끔) */
export function aiOfferBonus(rng: Rng, fee: number): DealTerms['bonus'] | undefined {
  if (fee < 2e6 || !rng.chance(0.3)) return undefined;
  return { amount: Math.max(5e5, Math.round((fee * (0.1 + rng.next() * 0.15)) / 5e5) * 5e5), apps: rng.pick([20, 50]) };
}

/** 선수 정보에 보일 조건 한 줄 (없으면 빈 문자열) */
export function termsLine(w: World, p: PlayerState, clubName: (id: string) => string): string {
  const out: string[] = [];
  if (p.sellOn && w.clubs[p.sellOn.club]) out.push(`셀온 ${p.sellOn.pct}% (${clubName(p.sellOn.club)})`);
  if (p.addOn && p.addOn.payer === p.clubId) out.push(`보너스 ${M(p.addOn.amount)} → ${clubName(p.addOn.club)} (출전 ${p.addOn.done}/${p.addOn.apps})`);
  return out.join(' · ');
}
