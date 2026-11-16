// 승부차기 한 번씩 (화면 연출용): 이미 정해진 승자(cup.shootout)에 맞는 키커 · 성공/실패 순서를 만든다
//  - 키커: 경기 끝에 뛰던 선수 중 슈팅 · 침착성 높은 순 (골키퍼는 마지막), 11명이 다 차면 처음부터
//  - 성공 확률: 키커 슈팅 · 침착성 vs 상대 골키퍼 반사 신경 · 1:1 (55~90%)
//  - 5명씩 → 이미 결과가 정해지면 바로 끝, 동점이면 서든데스. 정해진 승자와 다르면 다시 뽑는다
import type { MatchState, OnPitch } from './match';
import type { PlayerState, Side } from './types';
import { attr } from './ratings';
import { createRng } from './rng';

export interface Kick { id: string; scored: boolean; saved: boolean }
export interface ShootoutSeq { home: Kick[]; away: Kick[]; score: [number, number] }

const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

function takers(onPitch: OnPitch[], players: Record<string, PlayerState>): string[] {
  const gk = onPitch.filter((o) => o.slot === 'GK').map((o) => o.id);
  const field = onPitch.filter((o) => o.slot !== 'GK').map((o) => players[o.id])
    .sort((a, b) => attr(b, 'sho') + attr(b, 'com') - (attr(a, 'sho') + attr(a, 'com'))).map((p) => p.id);
  return [...field, ...gk];
}

export function shootoutSeq(m: MatchState, players: Record<string, PlayerState>, winner: Side, key: string): ShootoutSeq {
  const order = { home: takers(m.home.onPitch, players), away: takers(m.away.onPitch, players) };
  const keeper = (side: Side) => players[(side === 'home' ? m.away : m.home).onPitch.find((o) => o.slot === 'GK')?.id ?? ''];
  const chance = (id: string, side: Side) => {
    const p = players[id], gk = keeper(side);
    const kick = (attr(p, 'sho') + attr(p, 'com')) / 2, save = gk ? (attr(gk, 'ref') + attr(gk, 'one')) / 2 : 50;
    return Math.max(0.55, Math.min(0.9, 0.75 + (kick - 70) / 200 - (save - 70) / 250));
  };
  for (let tryN = 0; tryN < 200; tryN++) {
    const rng = createRng(hash(`${key}#${tryN}`));
    const seq: ShootoutSeq = { home: [], away: [], score: [0, 0] };
    const kick = (side: Side) => {
      const list = seq[side];
      const id = order[side][list.length % order[side].length];
      const scored = rng.chance(chance(id, side));
      list.push({ id, scored, saved: !scored && rng.chance(0.6) });
      if (scored) seq.score[side === 'home' ? 0 : 1]++;
    };
    // 5명씩: 남은 차기로 따라잡을 수 없으면 끝
    for (let k = 0; k < 5; k++) {
      kick('home');
      if (seq.score[0] > seq.score[1] + (5 - k) || seq.score[1] > seq.score[0] + (5 - k - 1)) break;
      kick('away');
      if (Math.abs(seq.score[0] - seq.score[1]) > 4 - k) break;
    }
    // 서든데스
    while (seq.score[0] === seq.score[1] && seq.home.length < 30) { kick('home'); kick('away'); }
    const won: Side = seq.score[0] > seq.score[1] ? 'home' : 'away';
    if (won === winner) return seq;
  }
  // 거의 없지만: 마지막 차기를 결과에 맞게
  const id = (s: Side) => order[s][0];
  return winner === 'home'
    ? { home: [{ id: id('home'), scored: true, saved: false }], away: [{ id: id('away'), scored: false, saved: true }], score: [1, 0] }
    : { home: [{ id: id('home'), scored: false, saved: true }], away: [{ id: id('away'), scored: true, saved: false }], score: [0, 1] };
}

// ── 직접 하는 승부차기 (내 경기) ─────────────────────────────
//  내 키커는 방향 (왼쪽 · 가운데 · 오른쪽), 상대 키커는 내 골키퍼가 몸을 날릴 방향을 고른다.
//  성공 기본 확률 = 키커 슈팅 · 침착성 vs 골키퍼 반사 신경 · 1:1 (위 chance 와 같은 식, 55~90%)
//  - 골키퍼가 맞는 쪽으로 날면: 구석이면 30% · 가운데면 10% 만 들어감 (나머지 선방)
//  - 다른 쪽이면: 기본 확률만큼 실축 위험 (빗나감 · 골대)만 남는다 → 기본 확률의 1/3 정도가 빗나감
export type Dir = 'L' | 'C' | 'R';
export const DIRS: Dir[] = ['L', 'C', 'R'];
export const DIR_KO: Record<Dir, string> = { L: '왼쪽', C: '가운데', R: '오른쪽' };

/** 승부차기 키커 순서 (슈팅 · 침착성 순, 골키퍼는 마지막) */
export const kickOrder = (onPitch: OnPitch[], players: Record<string, PlayerState>) => takers(onPitch, players);

/** 이 키커 · 골키퍼의 기본 성공 확률 */
export function kickChance(kicker: PlayerState, keeper: PlayerState | undefined): number {
  const kick = (attr(kicker, 'sho') + attr(kicker, 'com')) / 2, save = keeper ? (attr(keeper, 'ref') + attr(keeper, 'one')) / 2 : 50;
  return Math.max(0.55, Math.min(0.9, 0.75 + (kick - 70) / 200 - (save - 70) / 250));
}

/** AI 의 방향 (차는 쪽 · 막는 쪽 모두): 구석 42% · 가운데 16% */
export const aiDir = (r: number): Dir => (r < 0.42 ? 'L' : r < 0.84 ? 'R' : 'C');

/** 한 번 차기 결과 */
export function resolveKick(base: number, shot: Dir, dive: Dir, r1: number, r2: number): { scored: boolean; saved: boolean } {
  if (shot === dive) { const ok = r1 < (shot === 'C' ? 0.1 : 0.3); return { scored: ok, saved: !ok }; }
  const miss = (1 - base) / 3 + (shot === 'C' ? 0 : 0.02);   // 구석은 조금 더 빗나갈 위험
  const scored = r2 >= miss;
  return { scored, saved: false };
}

/** 승부차기가 끝났는지 (5명씩 → 서든데스) · 승자 */
export function shootoutOver(home: Kick[], away: Kick[]): 'home' | 'away' | null {
  const hs = home.filter((k) => k.scored).length, as = away.filter((k) => k.scored).length;
  const hn = home.length, an = away.length;
  if (hn <= 5 && an <= 5) {
    if (hs > as + (5 - an)) return 'home';
    if (as > hs + (5 - hn)) return 'away';
    if (hn === 5 && an === 5) return hs === as ? null : hs > as ? 'home' : 'away';
    return null;
  }
  if (hn === an && hs !== as) return hs > as ? 'home' : 'away';
  return null;
}
