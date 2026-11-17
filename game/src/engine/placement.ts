// 피치 위 선수 위치 (전술 · 경기 준비 · 경기 중 공통)
//  - 포메이션 버튼을 누르면 그 포메이션의 기본 위치 (slotXY) 로 한꺼번에 맞춘다
//  - 그 뒤로는 선수를 끌어 피치 아무 곳에나 놓을 수 있다 (자유 배치). 놓은 위치가 그대로 저장된다
//  - 포지션은 놓은 위치의 구역 (zonePos: 가로 좌·중·우 × 세로 줄) 으로 정해진다 → 포지션이 바뀌면 포메이션도 그 모양으로
//  - 저장: { formation, pts } — 포메이션 이름이 지금과 다르면 (버튼으로 바꿨으면) 무시하고 기본 위치
import type { Position } from '../data/types';
import { reshape, zonePos } from './squad';

export type XY = [number, number];
export interface Placement { formation: string; pts: XY[]; /** 저장할 때 자리 구성 (★ 내 배치 처럼 같은 이름이 다른 모양이 되면 무시) */ slots?: Position[] }

/** 포메이션 기본 위치 (가로 0~100, 세로 0=상대 골문 ~ 100=우리 골문) */
export function slotXY(slots: Position[]): { x: number; y: number }[] {
  const rowY: Record<string, number> = { GK: 92, CB: 75, LB: 72, RB: 72, LWB: 62, RWB: 62, DM: 63, CM: 47, LM: 44, RM: 44, AM: 32, LW: 24, RW: 24, ST: 13 };
  const rows = new Map<number, number[]>();
  slots.forEach((s, i) => { const y = rowY[s]; rows.set(y, [...(rows.get(y) ?? []), i]); });
  const out: { x: number; y: number }[] = new Array(slots.length);
  const wideNear = (y: number) => slots.some((s) => /^[LR]/.test(s) && Math.abs(rowY[s] - y) <= 4);
  for (const [y, idx] of rows) {
    // 오른쪽(R) 자리는 오른편, 왼쪽(L)은 왼편, 가운데는 고르게 (옆에 측면 선수가 있으면 안쪽으로 모아 이름표가 겹치지 않게)
    const left = idx.filter((i) => slots[i].startsWith('L')), right = idx.filter((i) => slots[i].startsWith('R'));
    const mid = idx.filter((i) => !left.includes(i) && !right.includes(i));
    left.forEach((i) => (out[i] = { x: 12, y }));
    right.forEach((i) => (out[i] = { x: 88, y }));
    const [a, b] = wideNear(y) && mid.length <= 2 ? [34, 66] : wideNear(y) ? [30, 70] : [26, 74];
    mid.forEach((i, k) => (out[i] = { x: mid.length === 1 ? 50 : a + ((b - a) * k) / (mid.length - 1), y }));
  }
  // 같은 세로줄(가로 위치가 가까운)에 있는 선수끼리 너무 붙으면 (예: 4-2-3-1 의 DM 과 CB) 이름표가 아래 선수를 덮으므로 위쪽 줄을 올린다
  const MIN = 15;
  const order = out.map((_, i) => i).sort((a, b) => out[b].y - out[a].y);
  for (let k = 0; k < order.length; k++) {
    const me = out[order[k]];
    for (let j = 0; j < k; j++) { const o = out[order[j]]; if (Math.abs(o.x - me.x) < 12 && o.y - me.y < MIN && o.y >= me.y) me.y = o.y - MIN; }
    me.y = Math.max(7, me.y);
  }
  return out;
}

/** 지금 위치: 저장된 자유 배치가 이 포메이션 것이면 그대로, 아니면 기본 위치 */
export function placeXY(slots: Position[], formation: string, pl?: Placement | null): { x: number; y: number }[] {
  if (pl && pl.formation === formation && pl.pts.length === slots.length && (!pl.slots || pl.slots.join() === slots.join())) return pl.pts.map(([x, y]) => ({ x, y }));
  return slotXY(slots);
}

/**
 * i 번째 자리 선수를 (x, y) 로 옮긴다 → 새 자리 구성 · 순서 · 위치.
 *  pos: 놓은 구역의 포지션. 지금과 같으면 위치만 바뀌고 (formation 그대로), 다르면 reshape (기본 포메이션 이름 또는 null = 내 포메이션)
 */
export function moveFree(slots: Position[], formation: string, pl: Placement | null | undefined, i: number, x: number, y: number):
  { error: string } | { same: true; pts: XY[] } | { same: false; pos: Position; slots: Position[]; formation: string | null; order: number[]; pts: XY[] } {
  if (slots[i] === 'GK') return { error: '골키퍼는 자리를 옮길 수 없습니다' };
  const cx = Math.round(Math.max(6, Math.min(94, x)) * 10) / 10, cy = Math.round(Math.max(6, Math.min(84, y)) * 10) / 10;
  const pos = zonePos(cx, cy);
  if (!pos) return { error: '필드 선수를 골키퍼 자리로 옮길 수 없습니다' };
  const pts: XY[] = placeXY(slots, formation, pl).map((p) => [p.x, p.y]);
  pts[i] = [cx, cy];
  if (pos === slots[i]) return { same: true, pts };
  const r = reshape(slots, i, pos);
  return { same: false, pos, slots: r.slots, formation: r.formation, order: r.order, pts: r.order.map((k) => pts[k]) };
}

/** 구역 안내 (끄는 동안 피치에 흐리게): zonePos 와 같은 경계 (x0, x1, y0, y1, 포지션) */
export const ZONES: [number, number, number, number, Position][] = [
  [0, 30, 0, 38, 'LW'], [30, 70, 0, 27, 'ST'], [30, 70, 27, 38, 'AM'], [70, 100, 0, 38, 'RW'],
  [0, 30, 38, 55, 'LM'], [30, 70, 38, 55, 'CM'], [70, 100, 38, 55, 'RM'],
  [0, 30, 55, 67, 'LWB'], [30, 70, 55, 67, 'DM'], [70, 100, 55, 67, 'RWB'],
  [0, 30, 67, 85, 'LB'], [30, 70, 67, 85, 'CB'], [70, 100, 67, 85, 'RB'],
];
