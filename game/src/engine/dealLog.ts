// 거래 기록 (내 구단): 이적 · 임대 · 사전 계약 · 방출, 성사된 것과 무산된 것 (결렬 · 거절 · 철회) 을 함께 남긴다
//  이적 화면 「거래 현황」 탭: 내가 어떤 거래를 했는지, 어느 포지션을 덜 보강했는지 보기
import type { World } from './types';
import type { Position } from '../data/types';

export type DealKind = 'transfer' | 'free' | 'loan' | 'precontract' | 'release';
export interface DealEntry {
  date: string;
  season: string;
  /** in = 우리에게 오는 거래, out = 우리 선수가 나가는 거래 */
  dir: 'in' | 'out';
  kind: DealKind;
  player: string;
  /** 상대 구단 (자유계약 · 방출이면 null) */
  club: string | null;
  fee?: number;
  ok: boolean;
  /** 무산 이유 (결렬 · 거절 · 철회 …) */
  why?: string;
  /** 사전 계약 (보스만): 실제로 합류한 날. 없으면 합류 예정 */
  joined?: string;
  /** 그때 포지션 (나중에 포지션이 바뀌어도 그대로) */
  pos: Position;
}

const MAX = 400;

export function logDeal(w: World, e: Omit<DealEntry, 'date' | 'season' | 'pos'>) {
  const p = w.players[e.player];
  if (!p || w.intl) return;
  const log = (w.dealLog ??= []);
  // 같은 날 같은 선수의 같은 무산 기록은 하나로 (조건을 바꿔 여러 번 눌러도 줄이 쌓이지 않게)
  const last = log.at(-1);
  if (!e.ok && last && !last.ok && last.date === w.date && last.player === e.player && last.dir === e.dir && last.kind === e.kind) log.pop();
  log.push({ date: w.date, season: w.season, pos: p.pos, ...e });
  if (log.length > MAX) log.splice(0, log.length - MAX);
}

/** 사전 계약한 선수가 합류: 따로 줄을 만들지 않고 사전 계약 줄에 합류 날짜를 적는다 (성사는 계약한 시즌에 센다) */
export function markJoined(w: World, playerId: string) {
  const e = [...(w.dealLog ?? [])].reverse().find((x) => x.player === playerId && x.kind === 'precontract' && x.ok && !x.joined);
  if (e) e.joined = w.date;
  return !!e;
}

/** 포지션 그룹별 요약 (그 시즌 또는 전체) */
export type DealGroup = 'GK' | 'DF' | 'MF' | 'FW';
export const DEAL_GROUPS: DealGroup[] = ['GK', 'DF', 'MF', 'FW'];
export function dealSummary(entries: DealEntry[], groupOf: (pos: Position) => string) {
  const out = Object.fromEntries(DEAL_GROUPS.map((g) => [g, { in: 0, out: 0, failed: 0 }])) as Record<DealGroup, { in: number; out: number; failed: number }>;
  for (const e of entries) {
    const g = groupOf(e.pos) as DealGroup;
    if (!out[g]) continue;
    if (!e.ok) { if (e.dir === 'in') out[g].failed++; continue; }
    if (e.dir === 'in') out[g].in++; else out[g].out++;
  }
  return out;
}
