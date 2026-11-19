// 이적 어필 (역제안): 지금 구단과 사이가 나쁜 선수가 먼저 다른 구단에 "가고 싶다"고 연락 (에이전트를 통해)
//  - 누가: 충성도가 낮거나 · 출전 불만 · 오래 벤치 · 이적 요청 (사가) · 계약 만료 임박인 선수 (troubleOf > 0). 갈등이 클수록 자주
//  - 어디로: 그 포지션 주전과 겨룰 만한 구단 (주전보다 3 낮음 ~ 6 높음, 그 포지션이 비었으면 팀 전력 −6 이상)
//            명성이 지금 구단보다 많이 낮지 않은 곳 (갈등이 크면 더 낮은 곳도)
//  - 우리 구단 (appealDay): 이적시장 기간과 그 직전 한 달, 평균 10일에 한 번 정도, 동시에 2명까지
//      효과: 우리 구단과 계약할 때 원하는 주급 15% 덜 (APPEAL_WAGE), 오려는 마음 ↑. 이적료는 파는 구단 몫이라 그대로
//      기한: 그 이적시장 끝. 우리 구단으로 오면 사라짐. 선수마다 시즌에 한 번. 받은편지함에 겨룰 주전을 알려 준다
//      이적 화면 '이적 희망' 탭에 모인다 (관심 목록은 우리가 고르는 것이라 따로). 동시에 4명까지
//  - 언론 플레이 (pressPlay, 선수마다 한 번): 우리 관심을 언론에 흘려 선수 마음을 흔든다
//      성공: 선수가 공개적으로 이적 요구 (사가, 우리 구단 지목) → 이적료 10% ↓ · 핵심 선수 규칙 없이 협상 · 소속 구단과 갈등 ↑
//      역풍: 파는 구단이 "도발"로 받아들여 우리에게 이적료 15% ↑ (PRESS_ANGRY)
//      무반응: 그대로. 갈등이 큰 선수 · 우리 구단 명성이 높을수록 성공이 잘 된다
//  - 다른 구단 (aiAppealDay): 이적시장 기간에만. 받은 구단이 원하면 시세의 80% 정도로 데려온다 (파는 구단도 갈등 선수라 싸게)
import type { GameEvent, PlayerState, World } from './types';
import type { Position } from '../data/types';
import type { Rng } from './rng';
import { createRng } from './rng';
import { overall } from './ratings';
import { ageOn } from './condition';
import { teamStrength } from './ai';
import { canAfford, marketValue, wageDemand, windowEnd, windowOpen } from './transfer';
import { bargainOf } from './firesale';

export interface Appeal { player: string; club: string; date: string; until: string; /** 겨룰 우리 주전 (없으면 빈 자리) */ rival?: string; /** 언론 플레이 결과 */ press?: PressResult }
export type PressResult = 'ok' | 'angry' | 'none';
/** 언론 플레이 역풍: 파는 구단이 우리에게 부르는 이적료 배율 */
export const PRESS_ANGRY = 1.15;
/** 동시에 유효한 어필 수 */
const MAX_APPEALS = 4;
/** 어필한 선수가 우리 구단에 바라는 주급 배율 */
export const APPEAL_WAGE = 0.85;
/** 다른 구단으로의 역제안 이적료 (시세 대비) */
const AI_APPEAL_FEE = 0.8;

/** 지금 유효한 어필 (우리 구단 대상) */
export function appealOf(w: World, p: PlayerState): Appeal | null {
  const a = w.appeals?.find((x) => x.player === p.id);
  return a && a.until >= w.date && p.clubId === a.club ? a : null;
}

const addDays = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/** 이적시장이 열렸거나 한 달 안에 열림 → 어필 기한 (그 시장 끝), 아니면 null */
function appealUntil(w: World): string | null {
  if (windowOpen(w.season, w.date)) return windowEnd(w.season, w.date);
  const soon = addDays(w.date, 30);
  return windowOpen(w.season, soon) ? windowEnd(w.season, soon) : null;
}

/** 지금 구단과의 갈등 정도 (0 이면 떠날 생각 없음): 충성도 · 불만 · 벤치 · 이적 요청 · 계약 만료 */
export function troubleOf(w: World, p: PlayerState): number {
  let t = 0;
  if (p.loyalty < 55) t += (55 - p.loyalty) / 20;                 // 충성도 30 → 1.25
  if (p.unhappy) t += 1.5;
  if (p.benchStreak >= 4) t += Math.min(1.5, p.benchStreak / 6);
  if (p.saga && p.saga.club === p.clubId) t += p.saga.kind === 'move' ? 1.5 : 0.8;
  if (p.morale < 35) t += 0.5;
  if (p.contract && p.contract <= `${+w.season.slice(0, 4) + 1}-06-30`) t += 0.4;
  return t;
}

/** 이 구단에서 이 선수가 겨룰 주전 (같은 포지션 · 보조 포지션 중 가장 잘하는 선수) */
function rivalIn(w: World, clubId: string, pos: Position): PlayerState | null {
  let best: PlayerState | null = null, bo = -1;
  for (const id of w.clubs[clubId].squad) {
    const q = w.players[id];
    if (q.pos !== pos && !q.alt?.includes(pos)) continue;
    const o = overall(q);
    if (o > bo) { bo = o; best = q; }
  }
  return best;
}

/** 이 구단에서 주전 경쟁이 되는가 (겨룰 주전 · 빈 자리면 팀 전력 기준) */
function competes(w: World, p: PlayerState, clubId: string, ovr: number, str?: number): { ok: boolean; rival: PlayerState | null; gap: number } {
  const rival = rivalIn(w, clubId, p.pos);
  if (rival) { const gap = ovr - overall(rival); return { ok: gap >= -3 && gap <= 6, rival, gap }; }
  const s = str ?? teamStrength(w, clubId);
  return { ok: ovr >= s - 6 && ovr <= s + 6, rival: null, gap: ovr - s };
}

/** 후보 선수의 기본 조건: 다른 구단 소속, 임대 · 사전 계약 · 급매물 · 부상 아님, 33세 이하 */
const movable = (w: World, p: PlayerState) => !!p.clubId && !p.loan && !p.precontract && !p.injury && !p.retired && !bargainOf(w, p) && ageOn(p.birth, w.date) <= 33;

export function appealDay(w: World, rng: Rng): GameEvent[] {
  // 지난 어필 정리: 기한 지남 · 우리 구단으로 옴 · 다른 구단으로 감
  w.appeals = (w.appeals ?? []).filter((a) => a.until >= w.date && w.players[a.player]?.clubId === a.club);
  const until = appealUntil(w);
  if (!until || w.appeals.length >= MAX_APPEALS || !rng.chance(0.1)) return [];
  const me = w.clubs[w.userClubId];
  const str = teamStrength(w, w.userClubId);
  const seen = (w.appealSeen ??= {});
  const cands: { p: PlayerState; wt: number; rival: PlayerState | null }[] = [];
  for (const club of Object.values(w.clubs)) {
    if (club.id === w.userClubId || !w.competitions[club.league] || club.id.startsWith('nt-')) continue;
    for (const id of club.squad) {
      const p = w.players[id];
      if (seen[id] === w.season || !movable(w, p)) continue;
      const trouble = troubleOf(w, p);
      if (trouble <= 0) continue;
      const ovr = overall(p);
      if (ovr < str - 9 || ovr > str + 8) continue;   // 빠른 거르기
      const repGap = me.reputation - club.reputation;
      if (repGap < (trouble >= 2 ? -10 : -5)) continue;   // 갈등이 크면 더 작은 구단에도
      const c = competes(w, p, w.userClubId, ovr, str);
      if (!c.ok) continue;
      const ambition = (p.hidden.ambition - 10) / 10;
      cands.push({ p, rival: c.rival, wt: Math.max(0.1, trouble * 1.2 + repGap / 12 + ambition * 0.5) });
    }
  }
  if (!cands.length) return [];
  const { p, rival } = rng.weighted(cands, (c) => c.wt);
  seen[p.id] = w.season;
  w.appeals.push({ player: p.id, club: p.clubId!, date: w.date, until, ...(rival ? { rival: rival.id } : {}) });
  // 메시지에 그때 주급을 적어 둔다 (기한이 지난 뒤 열어도 그대로 보이게)
  return [{ type: 'appeal', date: w.date, player: p.id, club: p.clubId!, until, ...(rival ? { rival: rival.id } : {}), wage: wageDemand(w, p), cut: wageDemand(w, p, w.userClubId) }];
}

/** 지금 유효한 우리 구단 어필 (이적 희망 탭 · 사이드바 숫자) */
export const activeAppeals = (w: World) => (w.appeals ?? []).filter((a) => a.until >= w.date && w.players[a.player]?.clubId === a.club);

/** 언론 플레이 성공 확률 · 역풍 확률 */
export function pressOdds(w: World, p: PlayerState): { ok: number; angry: number } {
  const t = Math.min(3, troubleOf(w, p));
  const repGap = w.clubs[w.userClubId].reputation - (p.clubId ? w.clubs[p.clubId].reputation : 0);
  const ok = Math.max(0.2, Math.min(0.8, 0.35 + t * 0.1 + repGap / 50 + (p.hidden.ambition - 10) / 50));
  const angry = Math.max(0.1, Math.min(0.4, 0.25 - repGap / 60));
  return { ok, angry: Math.min(angry, 1 - ok) };
}

/** 언론 플레이: 어필한 선수마다 한 번. 결과와 설명을 돌려준다 */
export function pressPlay(w: World, playerId: string, rng: Rng): { ok: boolean; result?: PressResult; text: string } {
  const p = w.players[playerId];
  const a = p ? appealOf(w, p) : null;
  if (!p || !a) return { ok: false, text: '이적 희망 기한이 지났습니다' };
  if (a.press) return { ok: false, text: '이미 언론 플레이를 했습니다' };
  const { ok, angry } = pressOdds(w, p);
  const r = rng.next();
  const club = w.clubs[p.clubId!];
  if (r < ok) {
    a.press = 'ok';
    // 선수가 공개적으로 이적 요구 (우리 구단 지목) → 이적료 10% ↓ · 핵심 선수라도 협상 가능 (evaluateBid forcing)
    p.saga = { kind: 'move', stage: 1, since: w.date, next: addDays(w.date, 7), target: w.userClubId, club: club.id };
    p.loyalty = Math.max(0, p.loyalty - 10);
    p.morale = Math.max(0, p.morale - 5);
    return { ok: true, result: 'ok', text: '성공 — 선수가 인터뷰에서 우리 구단으로 가고 싶다고 공개적으로 말했습니다. 소속 구단과 갈등이 커져 이적료를 10% 깎아 주고, 핵심 선수라도 협상에 응합니다' };
  }
  if (r < ok + angry) {
    a.press = 'angry';
    return { ok: true, result: 'angry', text: `역풍 — 소속 구단이 "선수를 흔드는 도발"이라며 화가 났습니다. 우리에게는 이적료를 ${Math.round((PRESS_ANGRY - 1) * 100)}% 더 부릅니다` };
  }
  a.press = 'none';
  return { ok: true, result: 'none', text: '무반응 — 기사는 났지만 선수도 구단도 별다른 반응이 없습니다' };
}

/**
 * 다른 구단으로의 역제안 (이적시장 기간): 하루 한 번 25% 확률로 갈등 선수 한 명이 겨룰 만한 구단에 연락,
 * 받은 구단이 돈이 되면 데려온다 (act 가 실제 이적). 우리 구단으로의 연락은 appealDay 가 맡는다.
 * 우리 구단 선수도 다른 구단에 연락한다 → 그 구단이 우리에게 이적료 제안 (받은 제안에서 수락 · 거절 · 역제안)
 * 날짜로 만든 난수를 써서 다른 시스템의 난수 순서를 바꾸지 않는다.
 */
export function aiAppealDay(w: World, act: (p: PlayerState, to: string, fee: number) => boolean): GameEvent[] {
  if (w.intl || !windowOpen(w.season, w.date)) return [];
  const rng = createRng((w.seed ^ Number(w.date.replace(/-/g, '')) * 2654435761) >>> 0);
  if (!rng.chance(0.25)) return [];
  const seen = (w.appealSeen ??= {});
  const cands: { p: PlayerState; t: number }[] = [];
  for (const club of Object.values(w.clubs)) {
    // 우리 구단 선수도 연락한다 (그 구단이 우리에게 제안을 보냄, 받을지는 사용자가 정함)
    if (!w.competitions[club.league] || club.id.startsWith('nt-') || club.squad.length <= 20) continue;
    for (const id of club.squad) {
      const p = w.players[id];
      if (seen[id] === w.season || !movable(w, p)) continue;
      const t = troubleOf(w, p);
      if (t >= 1) cands.push({ p, t });
    }
  }
  if (!cands.length) return [];
  const { p, t } = rng.weighted(cands, (c) => c.t);
  seen[p.id] = w.season;   // 한 시즌에 한 번만 (성사 안 돼도)
  const from = w.clubs[p.clubId!];
  const ovr = overall(p);
  const fee = Math.round((Math.max(marketValue(w, p), 200000) * AI_APPEAL_FEE) / 50000) * 50000;
  const wage = Math.max(p.wage, wageDemand(w, p));
  const targets = Object.values(w.clubs).filter((c) => c.id !== from.id && c.id !== w.userClubId && w.competitions[c.league] && !c.id.startsWith('nt-')
    && c.reputation >= from.reputation - (t >= 2 ? 10 : 5) && c.squad.length < 30 && competes(w, p, c.id, ovr).ok && canAfford(w, c.id, fee, wage, 4));
  if (!targets.length) return [];
  const to = rng.weighted(targets, (c) => c.reputation ** 2).id;
  if (p.clubId !== w.userClubId) { act(p, to, fee); return []; }
  // 우리 선수: 연락받은 구단이 이적료 제안 (시세의 85% 정도에서 시작, 협상하면 95%까지)
  const offers = (w.offers ??= []);
  if (offers.some((o) => o.player === p.id && o.from === to)) return [];
  const v = Math.max(marketValue(w, p), 200000);
  const r50 = (x: number) => Math.round(x / 50000) * 50000;
  const budget = w.clubs[to].finance.transferBudget;
  const offerFee = r50(Math.min(v * 0.85, budget));
  offers.push({ id: `${w.date}-${to}-${p.id}`, player: p.id, from: to, fee: offerFee, max: Math.max(offerFee, r50(Math.min(v * 0.95, budget))), tries: 0, date: w.date, expires: addDays(w.date, 10), appeal: true });
  w.inbox.push({ type: 'offer', date: w.date, player: p.id, from: to, fee: offerFee, appeal: true });
  return [];
}
