// 재정 규정 위반 징계 (모든 구단, rules.ts 의 규정 기준)
//  - 영입 · 재계약은 한도 안에서만 되지만, 매출이 줄면(강등 · 유럽 대회 탈락 · 팬 감소) 한도를 넘을 수 있고
//    손실 한도 규정(PSR · P&S · 옛 UEFA FFP)은 3시즌 누적 손실로도 위반한다
//  - 1월 1일: 지금 한도를 넘었으면 내 구단에 경고 (시즌 끝까지 줄이면 괜찮음)
//  - 시즌 끝 심사 (closeSeason): 초과율 = 선수단 비용 ÷ 한도 − 1, 손실 규정이면 3시즌 누적 손실 초과분도
//      처음 · 10% 이하  → 경고
//      그 밖            → 벌금 (초과액의 50%, 매출의 10%까지)
//      다시 위반 · 25% 넘음 → 다음 시즌 승점 감점 (3 ~ 10점)
//      50% 넘음 · 세 번째 → 다음 여름 이적시장 영입 금지 (자유계약 · 유스 · 재계약은 가능)
//    규정을 지킨 시즌이면 위반 횟수 −1
import type { ClubState, GameEvent, World } from './types';
import { book, clubRevenue } from './finance';
import { costLimit, squadCost } from './rules';
import { windowEnd } from './transfer';

export interface FfpState {
  /** 최근 위반 횟수 (지킨 시즌마다 −1) */
  strikes: number;
  /** 이번 시즌 시작 잔고 (손익 계산) */
  startBalance?: number;
  /** 최근 3시즌 손익 */
  nets?: number[];
  /** 다음 시즌 시작에 적용할 징계 */
  pending?: { deduct?: number; ban?: boolean };
  /** 영입 금지 기한 */
  banUntil?: string;
}
export interface FfpVerdict { kind: 'clean' | 'warn' | 'fine' | 'deduct' | 'ban'; over: number; excess: number; fine: number; deduct: number; ban: boolean; rule: string }

export const ffpOf = (_w: World, c: ClubState): FfpState => (c.ffp ??= { strikes: 0, startBalance: c.finance.balance, nets: [] });

/** 지금 초과율 (선수단 비용 기준) */
export function costOver(w: World, clubId: string) {
  const { rule, limit } = costLimit(w, clubId);
  const cost = squadCost(w, clubId);
  return { rule, limit, cost, over: limit > 0 ? cost / limit - 1 : cost > 0 ? 1 : 0 };
}

/** 시즌 끝 심사 (한 구단) */
export function judge(w: World, c: ClubState): FfpVerdict {
  const f = ffpOf(w, c);
  const { rule, limit, cost, over: costOv } = costOver(w, c.id);
  let over = costOv, excess = Math.max(0, cost - limit);
  // 손실 한도 규정: 3시즌 누적 손실이 허용치를 넘으면
  const net = c.finance.balance - (f.startBalance ?? c.finance.balance);
  const nets = [...(f.nets ?? []), net].slice(-3);
  if (rule.kind === 'loss' && rule.loss) {
    const loss = -nets.reduce((a, b) => a + b, 0), allowed = rule.loss * 3;
    if (loss > allowed) {
      const lo = (loss - allowed) / Math.max(allowed, clubRevenue(w, c.id) * 0.1);
      if (lo > over) { over = lo; excess = loss - allowed; }
    }
  }
  f.nets = nets;
  if (over <= 0) return { kind: 'clean', over: 0, excess: 0, fine: 0, deduct: 0, ban: false, rule: rule.name };
  const first = f.strikes === 0;
  if (first && over <= 0.1) return { kind: 'warn', over, excess, fine: 0, deduct: 0, ban: false, rule: rule.name };
  const fine = Math.round(Math.min(excess * 0.5, clubRevenue(w, c.id) * 0.1) / 1e5) * 1e5;
  const deduct = !first || over > 0.25 ? Math.max(3, Math.min(10, Math.round(3 + over * 20))) : 0;
  const ban = over > 0.5 || f.strikes >= 2;
  return { kind: ban ? 'ban' : deduct ? 'deduct' : 'fine', over, excess, fine, deduct, ban, rule: rule.name };
}

/** 시즌 끝 (closeSeason): 모든 구단 심사 · 벌금 · 다음 시즌 징계 예약. 내 구단 · 같은 리그 감점은 소식 */
export function ffpSeasonEnd(w: World): GameEvent[] {
  const out: GameEvent[] = [];
  const myLeague = w.clubs[w.userClubId]?.league;
  for (const c of Object.values(w.clubs)) {
    if (!w.competitions[c.league] || c.id.startsWith('nt-')) continue;
    const f = ffpOf(w, c);
    const v = judge(w, c);
    if (v.kind === 'clean') { f.strikes = Math.max(0, f.strikes - 1); continue; }
    f.strikes += 1;
    if (v.fine) book(w, c.id, 'fine', v.fine);
    if (v.deduct || v.ban) f.pending = { deduct: v.deduct || undefined, ban: v.ban || undefined };
    if (c.id === w.userClubId || (c.league === myLeague && v.deduct))
      out.push({ type: 'ffp', date: w.date, club: c.id, kind: v.kind, over: Math.round(v.over * 1000) / 10, fine: v.fine, deduct: v.deduct, ban: v.ban, rule: v.rule });
  }
  return out;
}

/** 새 시즌 (startNextSeason 끝): 감점 · 영입 금지 적용, 손익 기준 잔고 새로 */
export function ffpNewSeason(w: World): GameEvent[] {
  const out: GameEvent[] = [];
  for (const c of Object.values(w.clubs)) {
    const f = c.ffp;
    if (!f) continue;
    f.startBalance = c.finance.balance;
    if (f.banUntil && f.banUntil < w.date) f.banUntil = undefined;
    if (!f.pending) continue;
    const comp = w.competitions[c.league];
    if (f.pending.deduct && comp?.table[c.id]) comp.table[c.id].pts -= f.pending.deduct;
    if (f.pending.ban) f.banUntil = windowEnd(w.season, w.date) ?? `${w.season.slice(0, 4)}-09-01`;
    if (c.id === w.userClubId) out.push({ type: 'ffp', date: w.date, club: c.id, kind: 'applied', over: 0, fine: 0, deduct: f.pending.deduct ?? 0, ban: !!f.pending.ban, rule: '' });
    f.pending = undefined;
  }
  return out;
}

/** 영입 금지 중이면 이유 (이적료 · 임대 영입만, 자유계약 · 유스 · 재계약은 가능) */
export function transferBan(w: World, clubId: string): string | null {
  const until = w.clubs[clubId]?.ffp?.banUntil;
  return until && until >= w.date ? `재정 규정 위반 징계로 ${until.slice(5).replace('-', '/')}까지 이적료 · 임대 영입이 금지됐습니다 (자유계약 선수는 가능)` : null;
}

/** 1월 1일: 내 구단이 지금 한도를 넘었으면 경고 */
export function ffpMidSeason(w: World): GameEvent[] {
  if (w.date.slice(5) !== '01-01') return [];
  const c = w.clubs[w.userClubId];
  if (!c || !w.competitions[c.league]) return [];
  const { over, rule } = costOver(w, c.id);
  if (over <= 0) return [];
  return [{ type: 'ffp', date: w.date, club: c.id, kind: 'midwarn', over: Math.round(over * 1000) / 10, fine: 0, deduct: 0, ban: false, rule: rule.name }];
}
