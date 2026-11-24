// 이적 조건: 셀온 · 보너스 (조건부 추가 이적료)
//  - 셀온: 파는 구단이 "다음에 이 선수가 다시 팔리면 그 이적료의 pct% 를 우리에게"를 건다.
//    다음 이적 때 그 이적의 파는 구단 몫에서 떼어 원래 구단에 준다 (completeTransfer → settleSellOn)
//  - 보너스: 사는 구단이 "이 선수가 우리 구단에서 조건을 채우면 amount 를 더 낸다"를 건다. 조건 3가지 (v2.19):
//    출전 N경기 (리그 · 컵, 선발 · 교체 모두 → addOnApp) · 골 N개 (리그 · 컵 → addOnGoal) · 리그 우승 (시즌 마감 → addOnTitles).
//    채우면 그날 바로 지급. 그 전에 선수가 떠나면 없어짐. 내는 구단이 임대 보낸 동안은 멈췄다가 돌아오면 이어서 센다
//  - 파는 구단은 조건을 이적료에 더해 판단한다 (termsWorth): 셀온은 어린 선수일수록, 보너스는 나갈 가능성이 클수록 값어치가 크다
//  - 우리가 팔 때도 셀온 · 보너스를 요구할 수 있다 (transfer.ts counterOffer)
//  - AI 끼리 이적에도 가끔 붙는다 (aiTerms) → 셀온이 걸린 선수를 사 오면 나중에 팔 때 원래 구단에 떼어 준다
//  - 받은 돈은 재정 장부 「조항 수입」, 낸 보너스는 「조항 지출」 (finance.ts clauseIn · clauseOut)
import type { PlayerState, World } from './types';
import type { Rng } from './rng';
import { book } from './finance';
import { ageOn } from './condition';
import { overall } from './ratings';

/** 보너스 조건: 출전 경기 수 (없으면 이것) · 골 수 · 리그 우승 */
export type BonusKind = 'apps' | 'goals' | 'title';
/** 보너스: apps = 채울 수 (출전 경기 · 골, 우승은 1) */
export interface Bonus { amount: number; apps: number; kind?: BonusKind }

export interface DealTerms {
  /** 셀온 % (파는 구단이 받음) */
  sellOn?: number;
  /** 보너스: 사는 구단이 이 선수로 조건을 채우면 amount 를 더 낸다 */
  bonus?: Bonus;
}

export const SELL_ON_PCTS = [0, 10, 15, 20] as const;
export const BONUS_APPS = [20, 50, 100] as const;
export const BONUS_GOALS = [5, 10, 20] as const;
/** 화면 선택지 (조건 · 채울 수) */
export const BONUS_OPTS: { kind: BonusKind; n: number }[] = [
  ...BONUS_APPS.map((n) => ({ kind: 'apps' as const, n })),
  ...BONUS_GOALS.map((n) => ({ kind: 'goals' as const, n })),
  { kind: 'title', n: 1 },
];
export const bonusKind = (b: { kind?: BonusKind }): BonusKind => b.kind ?? 'apps';
/** 보너스 조건 짧은 말: 출전 20경기 · 10골 · 리그 우승 */
export function bonusLabel(b: { kind?: BonusKind; apps: number }): string {
  const k = bonusKind(b);
  return k === 'goals' ? `${b.apps}골` : k === 'title' ? '리그 우승' : `출전 ${b.apps}경기`;
}
/** 보너스는 이적료의 절반까지 */
export const bonusCap = (fee: number) => Math.floor((fee * 0.5) / 5e5) * 5e5;

/** 셀온의 값어치 (이적료 대비): 어릴수록 다시 비싸게 팔릴 가능성이 커서 */
export function sellOnFactor(w: World, p: PlayerState): number {
  const age = ageOn(p.birth, w.date);
  return age <= 21 ? 0.75 : age <= 24 ? 0.5 : age <= 27 ? 0.3 : 0.1;
}

/** 포지션별 한 시즌 골 기대 (능력 75 기준) */
const GOAL_RATE: Partial<Record<string, number>> = { ST: 12, LW: 7, RW: 7, AM: 6, LM: 3.5, RM: 3.5, CM: 3, DM: 1.2, LWB: 1.2, RWB: 1.2, LB: 1, RB: 1, CB: 1, GK: 0 };
/** 리그에서 명성 순위 (1 = 가장 높음) */
function repRank(w: World, clubId: string): number {
  const c = w.clubs[clubId];
  if (!c) return 99;
  return Object.values(w.clubs).filter((x) => x.league === c.league && x.reputation > c.reputation).length + 1;
}
/**
 * 보너스가 실제로 나갈 가능성 (계약 기간 몇 시즌 동안)
 *  - 출전: 기준 경기 수가 많을수록 낮게
 *  - 골: 포지션 · 능력으로 본 한 시즌 골 기대 × 3시즌 ÷ 기준 골
 *  - 우승: 내는 구단(payer)의 리그 명성 순위 (1위 0.55 · 2위 0.35 · 3~4위 0.15 · 그 아래 0.04)
 */
export function bonusChance(apps: number, kind: BonusKind = 'apps', w?: World, p?: PlayerState, payer?: string): number {
  if (kind === 'goals') {
    if (!p) return 0.4;
    const rate = (GOAL_RATE[p.pos] ?? 2) * Math.max(0.6, Math.min(1.3, overall(p) / 75));
    return Math.max(0.03, Math.min(0.8, ((rate * 3) / apps) * 0.6));
  }
  if (kind === 'title') {
    if (!w || !payer) return 0.2;
    const r = repRank(w, payer);
    return r <= 1 ? 0.55 : r <= 2 ? 0.35 : r <= 4 ? 0.15 : 0.04;
  }
  return apps <= 20 ? 0.75 : apps <= 50 ? 0.55 : 0.35;
}
/** 보너스의 값어치 (금액 × 나갈 가능성) */
export const bonusWorth = (w: World, p: PlayerState, b: Bonus | undefined, payer?: string) =>
  b?.amount ? b.amount * bonusChance(b.apps, bonusKind(b), w, p, payer) : 0;

/** 파는 구단이 보는 조건의 값 (이적료에 더해 판단). payer = 사는 구단 (우승 보너스 가능성) */
export function termsWorth(w: World, p: PlayerState, fee: number, t?: DealTerms, payer?: string): number {
  if (!t) return 0;
  let v = 0;
  if (t.sellOn) v += fee * (t.sellOn / 100) * sellOnFactor(w, p);
  v += bonusWorth(w, p, t.bonus, payer);
  return Math.round(v);
}

/** 조건이 정상인지 (화면 · 저장 값 검사). 잘못이면 이유 */
export function termsError(fee: number, t?: DealTerms): string | null {
  if (!t) return null;
  if (t.sellOn && !SELL_ON_PCTS.includes(t.sellOn as never)) return '셀온은 10 · 15 · 20% 중에서 고릅니다';
  if (t.bonus?.amount) {
    const k = bonusKind(t.bonus);
    if (!BONUS_OPTS.some((o) => o.kind === k && o.n === t.bonus!.apps)) return '보너스 조건이 잘못됐습니다';
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
  book(w, so.club, 'clauseIn', cut);
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
  const b = t?.bonus;
  p.addOn = from && b?.amount ? { club: from, payer: to, amount: Math.round(b.amount), apps: b.apps, done: 0, ...(b.kind && b.kind !== 'apps' ? { kind: b.kind } : {}) } : undefined;
}

/** 보너스 상태: live = 세는 중 · paused = 내는 구단이 임대 보내 멈춤 · gone = 선수가 떠나 없어짐 */
function addOnState(w: World, p: PlayerState): 'live' | 'paused' | 'gone' {
  const a = p.addOn;
  if (!a || !w.clubs[a.club] || !w.clubs[a.payer]) return 'gone';
  if (a.payer === p.clubId && !p.loan) return 'live';
  if (p.loan?.from === a.payer) return 'paused';
  return 'gone';
}
/** 보너스가 임대 때문에 멈춰 있는가 (화면) */
export const addOnPaused = (w: World, p: PlayerState) => addOnState(w, p) === 'paused';

/** 보너스 조건을 채움: 지급 + 알림 */
function payAddOn(w: World, p: PlayerState) {
  const a = p.addOn!;
  p.addOn = undefined;
  book(w, a.payer, 'clauseOut', a.amount);
  const payer = w.clubs[a.payer];
  payer.finance.transferBudget = Math.max(0, payer.finance.transferBudget - a.amount);
  book(w, a.club, 'clauseIn', a.amount);
  const rc = w.clubs[a.club];
  rc.sales = (rc.sales ?? 0) + a.amount;
  rc.finance.transferBudget += Math.round(a.amount * 0.5);
  const bk = a.kind ? { bk: a.kind } : {};
  if (a.payer === w.userClubId) w.inbox.push({ type: 'clause', date: w.date, player: p.id, kind: 'bonus', dir: 'out', amount: a.amount, club: a.club, apps: a.apps, ...bk });
  else if (a.club === w.userClubId) w.inbox.push({ type: 'clause', date: w.date, player: p.id, kind: 'bonus', dir: 'in', amount: a.amount, club: a.payer, apps: a.apps, ...bk });
}

/** 출전 · 골 하나씩 (world.ts): 그 조건의 보너스 진행, 채우면 지급 */
function tick(w: World, p: PlayerState, kind: 'apps' | 'goals') {
  const a = p.addOn;
  if (!a) return;
  const st = addOnState(w, p);
  if (st === 'gone') { p.addOn = undefined; return; }
  if (st === 'paused' || bonusKind(a) !== kind) return;
  a.done++;
  if (a.done >= a.apps) payAddOn(w, p);
}
/** 출전 1경기 (world.ts) */
export const addOnApp = (w: World, p: PlayerState) => tick(w, p, 'apps');
/** 골 1개 (world.ts) */
export const addOnGoal = (w: World, p: PlayerState) => tick(w, p, 'goals');
/** 시즌 마감 (season.ts closeSeason): 리그 우승 구단 선수의 우승 보너스 지급 */
export function addOnTitles(w: World, champions: (string | undefined)[]) {
  const set = new Set(champions.filter(Boolean));
  if (!set.size) return;
  for (const p of Object.values(w.players)) {
    const a = p.addOn;
    if (!a || bonusKind(a) !== 'title' || !set.has(a.payer)) continue;
    if (addOnState(w, p) === 'live') { a.done = 1; payAddOn(w, p); }
  }
}

export interface ClauseRow {
  player: string;
  kind: 'sellOn' | 'bonus';
  /** in = 우리가 받을 것 · out = 우리가 낼 것 */
  dir: 'in' | 'out';
  /** 상대 구단 */
  club: string;
  pct?: number;
  amount?: number;
  bk?: BonusKind;
  apps?: number;
  done?: number;
  paused?: boolean;
}
/**
 * 이 구단에 걸린 조항 목록 (화면 「거래 현황」):
 *  - 받을 셀온: 우리가 판 선수 (지금 다른 구단 소속) · 낼 셀온: 우리 선수에 걸린 원래 구단 몫
 *  - 받을 보너스 · 낼 보너스 (진행 · 임대로 멈춤 표시)
 */
export function clauseRows(w: World, clubId: string): ClauseRow[] {
  const out: ClauseRow[] = [];
  for (const p of Object.values(w.players)) {
    if (p.retired) continue;
    const so = p.sellOn;
    if (so && w.clubs[so.club] && p.clubId) {
      const owner = p.loan?.from ?? p.clubId;
      if (so.club === clubId && owner !== clubId) out.push({ player: p.id, kind: 'sellOn', dir: 'in', club: owner, pct: so.pct });
      else if (owner === clubId && so.club !== clubId) out.push({ player: p.id, kind: 'sellOn', dir: 'out', club: so.club, pct: so.pct });
    }
    const a = p.addOn;
    if (a && (a.club === clubId || a.payer === clubId)) {
      const st = addOnState(w, p);
      if (st === 'gone') continue;
      out.push({ player: p.id, kind: 'bonus', dir: a.club === clubId ? 'in' : 'out', club: a.club === clubId ? a.payer : a.club, amount: a.amount, bk: bonusKind(a), apps: a.apps, done: a.done, ...(st === 'paused' ? { paused: true } : {}) });
    }
  }
  return out;
}

/** AI 가 거는 보너스 조건: 공격수는 골 보너스도, 명성 상위 구단은 가끔 우승 보너스 */
function aiBonus(w: World, rng: Rng, p: PlayerState, fee: number, payer: string): Bonus {
  const amount = Math.max(5e5, Math.round((fee * (0.1 + rng.next() * 0.15)) / 5e5) * 5e5);
  const roll = rng.next();
  if (roll < 0.35 && (GOAL_RATE[p.pos] ?? 0) >= 6) return { amount, apps: rng.pick([5, 10]), kind: 'goals' };
  if (roll > 0.85 && repRank(w, payer) <= 4) return { amount, apps: 1, kind: 'title' };
  return { amount, apps: rng.pick([20, 50]) };
}

/** AI 끼리 이적 조건 (가끔): 어린 선수는 셀온, 이적료가 크면 보너스 */
export function aiTerms(w: World, rng: Rng, p: PlayerState, fee: number, payer: string): DealTerms | undefined {
  if (fee < 1e6) return undefined;
  const t: DealTerms = {};
  if (ageOn(p.birth, w.date) <= 24 && rng.chance(0.45)) t.sellOn = rng.pick([10, 15, 20]);
  if (fee >= 5e6 && rng.chance(0.25)) t.bonus = aiBonus(w, rng, p, fee, payer);
  return t.sellOn || t.bonus ? t : undefined;
}

/** 사는 구단(AI)이 내 선수 제안에 붙이는 보너스 (가끔) */
export function aiOfferBonus(w: World, rng: Rng, p: PlayerState, fee: number, payer: string): Bonus | undefined {
  if (fee < 2e6 || !rng.chance(0.3)) return undefined;
  return aiBonus(w, rng, p, fee, payer);
}

/** 선수 정보에 보일 조건 한 줄 (없으면 빈 문자열) */
export function termsLine(w: World, p: PlayerState, clubName: (id: string) => string): string {
  const out: string[] = [];
  if (p.sellOn && w.clubs[p.sellOn.club]) out.push(`셀온 ${p.sellOn.pct}% (${clubName(p.sellOn.club)})`);
  const a = p.addOn, st = a ? addOnState(w, p) : 'gone';
  if (a && st !== 'gone') out.push(`보너스 ${M(a.amount)} → ${clubName(a.club)} (${addOnProgress(a)}${st === 'paused' ? ' · 임대 중 멈춤' : ''})`);
  return out.join(' · ');
}
/** 보너스 진행 짧은 말: 출전 12/20 · 골 3/10 · 리그 우승 때 */
export function addOnProgress(a: { kind?: BonusKind; apps: number; done?: number }): string {
  const k = bonusKind(a);
  return k === 'title' ? '리그 우승 때' : `${k === 'goals' ? '골' : '출전'} ${a.done ?? 0}/${a.apps}`;
}
