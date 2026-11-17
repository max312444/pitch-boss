// 포지션 전환 훈련 (내 선수): 다른 포지션을 몇 달 동안 익혀 그 자리에서도 능력이 깎이지 않게 한다
//  - 한 번에 최대 3명. 매달 1일 훈련(8월 ~ 5월) 때 진행도가 오른다 → 100% 가 되면 익힌 포지션 (p.learned, 시즌이 바뀌어도 유지)
//  - 빠르기: 가까운 포지션 (예: RB → RWB · RM, 친숙도 0.8 이상) 약 3달 · 조금 먼 곳 (0.7) 약 5달 · 먼 곳 약 8달
//    × 나이 (어릴수록 빠름) × 프로의식 × 훈련 시설 효율
//  - 훈련 중에도 진행도만큼 그 자리 친숙도가 오른다 (playerFamiliarity). 대신 훈련 중인 달은 일반 성장이 조금 줄어든다 (×0.7)
//  - 골키퍼 ↔ 필드 선수는 안 됨
import type { Position } from '../data/types';
import type { PlayerState, World } from './types';
import { ageOn } from './condition';
import { altPositions, familiarity } from './ratings';
import { facilityLevel } from './facilities';
import { facilityEfficiency } from './training';

export const MAX_RETRAIN = 3;
export const RETRAIN_GROWTH = 0.7;

/** 이 포지션으로 전환 훈련을 할 수 있나 */
export function canRetrain(p: PlayerState, pos: Position): boolean {
  if (pos === p.pos || (p.pos === 'GK') !== (pos === 'GK')) return false;
  return !altPositions(p).includes(pos) && !(p.learned ?? []).includes(pos);
}

/** 한 달 진행도 (%) */
export function retrainRate(w: World, p: PlayerState, pos: Position): number {
  const fam = familiarity(p.pos, pos);
  const base = fam >= 0.8 ? 34 : fam >= 0.7 ? 22 : 13;
  const age = ageOn(p.birth, w.date);
  const ageMul = age <= 21 ? 1.3 : age <= 25 ? 1.1 : age <= 29 ? 1 : age <= 32 ? 0.8 : 0.6;
  const pro = 0.8 + p.hidden.professionalism / 50;
  const club = p.clubId ? w.clubs[p.clubId] : null;
  const fac = club ? facilityEfficiency(facilityLevel(club, 'training')) : 1;
  return Math.round(base * ageMul * pro * fac * 10) / 10;
}
/** 남은 달 수 (예상) */
export const retrainMonthsLeft = (w: World, p: PlayerState, pos: Position, progress = 0) => Math.max(1, Math.ceil((100 - progress) / Math.max(1, retrainRate(w, p, pos))));

/** 지금 전환 훈련 중인 내 선수 수 */
export const retrainCount = (w: World) => (w.clubs[w.userClubId]?.squad ?? []).filter((id) => w.players[id]?.retrain).length;

export function startRetrain(w: World, p: PlayerState, pos: Position): { ok: boolean; reason: string } {
  if (p.clubId !== w.userClubId) return { ok: false, reason: '내 선수만 훈련할 수 있습니다' };
  if (!canRetrain(p, pos)) return { ok: false, reason: '이미 뛸 수 있는 포지션이거나 바꿀 수 없는 포지션입니다' };
  if (!p.retrain && retrainCount(w) >= MAX_RETRAIN) return { ok: false, reason: `전환 훈련은 한 번에 ${MAX_RETRAIN}명까지입니다` };
  // 같은 포지션을 하다 멈췄다 다시 시작하면 진행도를 이어 간다
  const kept = p.retrainSaved?.[pos] ?? 0;
  if (p.retrain) (p.retrainSaved ??= {})[p.retrain.pos] = p.retrain.progress;
  p.retrain = { pos, progress: kept, since: w.date };
  return { ok: true, reason: `${pos} 전환 훈련을 시작했습니다 · 약 ${retrainMonthsLeft(w, p, pos, kept)}달` };
}
export function stopRetrain(p: PlayerState) {
  if (!p.retrain) return;
  (p.retrainSaved ??= {})[p.retrain.pos] = p.retrain.progress;   // 나중에 다시 하면 이어서
  p.retrain = undefined;
}

/** 매달 훈련 때 (training.ts trainingMonth): 진행 · 완료 */
export function retrainMonth(w: World) {
  for (const id of w.clubs[w.userClubId]?.squad ?? []) {
    const p = w.players[id];
    if (!p?.retrain) continue;
    if (p.injury && p.injury.days > 14) continue;   // 오래 다친 동안은 멈춤
    p.retrain.progress = Math.min(100, Math.round((p.retrain.progress + retrainRate(w, p, p.retrain.pos)) * 10) / 10);
    if (p.retrain.progress >= 100) {
      const pos = p.retrain.pos;
      p.learned = [...new Set([...(p.learned ?? []), pos])];
      p.retrain = undefined;
      if (p.retrainSaved) delete p.retrainSaved[pos];
      p.alt = undefined;   // 보조 포지션 다시 계산
      w.inbox.push({ type: 'retrain', date: w.date, player: p.id, pos });
    }
  }
}
