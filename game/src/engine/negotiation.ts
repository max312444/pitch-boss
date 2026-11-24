// 영입 협상 (사용자가 사는 쪽): 파는 구단과 밀고 당기기
//  - 구단은 원하는 값(ask, 셀온 · 보너스 값어치 포함)을 처음부터 다 말하지 않는다. 제안이 낮으면 조금씩 내려오는 역제안을 하고,
//    구단마다 더는 안 내려가는 최저선(floor)이 있다 (사정이 급하면 낮고, 핵심 선수 · 긴 계약이면 높다)
//  - 인내심 (mood 100 → 0): 낮게 부를수록 많이 깎이고, 원하는 값의 60% 미만은 '무례한 제안' (크게 깎이고 역제안 없음). 바닥나면 결렬
//  - 기회는 FEE_TRIES 번. 마지막 기회에는 최저선까지 내려와 "마지막"이라고 말한다
//  - 바이아웃 · 급매물 · 이미 원하는 값 이상이면 바로 수락 (evaluateBid). AI 끼리 이적은 evaluateBid 그대로 (이 파일과 무관)
import type { PlayerState, World } from './types';
import type { DealTerms } from './addons';
import { termsWorth } from './addons';
import { cashNeeded, evaluateBid, rankInClub, breakTalks, talkOf, type BidResult } from './transfer';
import { saleTag } from './market';
import { bargainOf } from './firesale';

/** 이적료 협상 기회 */
export const FEE_TRIES = 4;
/** 원하는 값의 이 비율 미만은 무례한 제안 */
export const INSULT = 0.6;
/** 역제안 때 구단이 우리 쪽으로 다가오는 비율 (기회마다 커짐) */
const STEP = [0.3, 0.42, 0.55, 1];

const M = (v: number) => `${Math.round(v / 1e5) / 10}M 유로`;
const r1 = (v: number) => Math.ceil(v / 1e5) * 1e5;

/** 구단 사정: 최저선 (원하는 값 대비) 과 그 이유 */
export function sellerFloor(w: World, p: PlayerState): { f: number; why: string[] } {
  let f = 0.9;
  const why: string[] = [];
  const tag = saleTag(w, p);
  if ((w.transferList ?? []).includes(p.id) || tag === 'surplus' || tag === 'request') { f -= 0.05; why.push('팔 생각이 있음'); }
  const left = p.contract ? (Date.parse(p.contract) - Date.parse(w.date)) / (365 * 864e5) : 0;
  if (left < 1.2) { f -= 0.05; why.push('계약이 얼마 안 남음'); }
  else if (left >= 3.5) { f += 0.04; why.push('계약이 길게 남음'); }
  const seller = p.clubId ? w.clubs[p.clubId] : null;
  if (seller && seller.finance.balance < 0) { f -= 0.05; why.push('구단 재정이 어려움'); }
  if (rankInClub(w, p) <= 3) { f += 0.05; why.push('팀의 핵심 선수'); }
  return { f: Math.max(0.78, Math.min(0.97, f)), why };
}

/** 첫 제안 전 보이는 구단 분위기 (금액은 모름): 비싸게 부를지 · 싸게 팔지 */
export function sellerHint(w: World, p: PlayerState): { level: 'high' | 'mid' | 'low'; text: string } {
  if (!p.clubId) return { level: 'low', text: '' };
  const rank = rankInClub(w, p);
  const fl = sellerFloor(w, p);
  if (bargainOf(w, p)) return { level: 'low', text: '급매물: 내놓은 가격이면 바로 팝니다' };
  const level = rank <= 3 ? 'high' : fl.f <= 0.85 ? 'low' : 'mid';
  const base = rank <= 3 ? '주전 핵심이라 시장 가치보다 훨씬 비싸게 부를 겁니다' : rank <= 8 ? '주전급이라 시장 가치보다 조금 비싸게 부를 겁니다' : '후보급이라 시장 가치 근처면 협상할 만합니다';
  return { level, text: `${base}${fl.why.length ? ` · ${fl.why.join(' · ')}` : ''}` };
}

export interface FeeResult extends BidResult {
  /** 남은 기회 */
  left: number;
  broken?: boolean;
  /** 구단 인내심 0~100 */
  mood: number;
  /** 이번 조건으로 역제안 맞추려면 낼 현금 */
  counterCash?: number;
  /** 최저선 도달 (더 안 내려감) */
  final?: boolean;
  insult?: boolean;
}

/** 이적료 제안 (사용자): 수락 · 역제안 · 거절. 협상 상태 (talk) 를 바꾼다 */
export function negotiateFee(w: World, p: PlayerState, cash: number, terms?: DealTerms): FeeResult {
  const t = talkOf(w, p.id);
  const mood0 = t.mood ?? 100;
  const r = evaluateBid(w, p, w.userClubId, cash, terms);
  const v = cash + termsWorth(w, p, cash, terms, w.userClubId);
  const done = (reason: string): FeeResult => { t.agreed = cash; t.terms = terms?.sellOn || terms?.bonus?.amount ? terms : undefined; return { decision: 'accept', ask: cash, reason, left: FEE_TRIES - t.fee, mood: mood0 }; };
  if (r.decision === 'accept') return done(r.reason);
  if (r.hard) return { ...r, left: FEE_TRIES - t.fee, mood: mood0 };
  const target = r.full ?? r.ask;              // 구단이 원하는 값 (조건 포함)
  if (t.counter != null && v >= t.counter) return done(`역제안한 금액이라 받아들였습니다`);
  t.fee++;
  const left = FEE_TRIES - t.fee;
  const floor = target * sellerFloor(w, p).f;
  const cur = t.counter ?? target;
  let mood = mood0, reason: string, insult = false;
  if (v < target * INSULT) {
    insult = true;
    mood -= 40;
    reason = r.core ? `팀의 핵심 선수입니다. 이런 금액이면 이야기할 가치도 없다고 합니다` : '무례한 제안이라며 불쾌해합니다. 금액을 크게 올리지 않으면 협상을 끝내겠다고 합니다';
  } else {
    const gap = Math.max(0, (cur - v) / cur);
    mood -= Math.round(8 + gap * 70);
    // 다가오기: 우리 제안 (최저선보다 낮으면 최저선) 쪽으로 조금씩 — 한 번에 바닥을 드러내지 않는다. 마지막 기회엔 최저선까지
    const next = cur - (cur - Math.max(v, floor)) * STEP[Math.min(STEP.length - 1, t.fee - 1)];
    t.counter = Math.min(cur, left <= 1 ? Math.max(floor, Math.min(next, floor)) : next);
    t.final = t.counter <= floor + 1e5;
    const need = r1(cashNeeded(w, p, t.counter, terms));
    reason = `${r.core ? '팀의 핵심 선수라 쉽게 보낼 수 없습니다. ' : ''}${M(need)}면 보내겠다고 합니다${t.final ? ' — 이게 마지막 양보라고 못박습니다' : ''}${need < r1(t.counter) ? ` (셀온 · 보너스 포함)` : ''}`;
  }
  t.mood = Math.max(0, mood);
  const broken = t.mood <= 0 || left <= 0;
  if (broken) {
    breakTalks(w, p.id, t.mood <= 0 ? '구단이 협상을 끝냄 (인내심 바닥)' : '이적료 합의 실패 (기회 4번)');
    reason += t.mood <= 0 ? ' · 인내심이 바닥나 협상을 끝냈습니다' : ' · 기회를 다 써서 협상이 결렬됐습니다';
  }
  return {
    decision: insult ? 'reject' : 'counter', ask: t.counter != null ? r1(cashNeeded(w, p, t.counter, terms)) : r.ask, reason, left: Math.max(0, left), broken, mood: t.mood, insult,
    ...(t.counter != null && !insult ? { counterCash: r1(cashNeeded(w, p, t.counter, terms)), final: t.final } : {}),
  };
}

/** 지금 협상 상태 (화면): 인내심 · 역제안 (이 조건으로 낼 현금) */
export function feeState(w: World, p: PlayerState, terms?: DealTerms): { mood: number; used: number; counterCash?: number; final?: boolean } {
  const t = w.talks?.[p.id];
  if (!t || t.until < w.date) return { mood: 100, used: 0 };
  return { mood: t.mood ?? 100, used: t.fee, ...(t.counter != null ? { counterCash: r1(cashNeeded(w, p, t.counter, terms)), final: t.final } : {}) };
}
