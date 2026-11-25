// 수상 연출 순서 (AwardCeremony): 우승 트로피 → 선수별 개인상 (가벼운 상부터) → 한 시즌 2개 이상이면 요약
import { AWARD_RANK, isTrophy, type Award } from '../engine/awards';

export type Slide =
  | { t: 'trophy'; a: Award }
  | { t: 'solo'; a: Award; step: number; total: number }
  | { t: 'combo'; player: string; club: string; awards: Award[] };

/** 수상 목록 → 보여 줄 순서: 우승 트로피 → 선수별 개인상 (가벼운 상부터) + 2개 이상이면 요약 */
export function ceremonySlides(list: Award[]): Slide[] {
  const out: Slide[] = list.filter((a) => isTrophy(a.kind)).map((a) => ({ t: 'trophy', a }));
  const byPlayer = new Map<string, Award[]>();
  for (const a of list) if (!isTrophy(a.kind) && a.player) byPlayer.set(a.player, [...(byPlayer.get(a.player) ?? []), a]);
  // 상을 많이 받은 선수 · 큰 상을 받은 선수가 뒤에 (마지막이 가장 큰 축하)
  const groups = [...byPlayer.values()].map((xs) => xs.sort((x, y) => (AWARD_RANK[x.kind] ?? 0) - (AWARD_RANK[y.kind] ?? 0)))
    .sort((x, y) => x.length - y.length || (AWARD_RANK[x.at(-1)!.kind] ?? 0) - (AWARD_RANK[y.at(-1)!.kind] ?? 0));
  for (const g of groups) {
    g.forEach((a, i) => out.push({ t: 'solo', a, step: i + 1, total: g.length }));
    if (g.length >= 2) out.push({ t: 'combo', player: g[0].player!, club: g[0].club, awards: g });
  }
  return out;
}

export const comboName = (n: number) => (n >= 5 ? '전설의 시즌' : n === 4 ? '쿼드러플' : n === 3 ? '트레블' : '더블');
