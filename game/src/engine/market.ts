// 이적시장 매물: 모든 선수가 시장에 나와 있는 것이 아니다
//  - 자유계약 · 급매물 (강제 매각 · 강등 조항) · 이적 희망 (출전 불만 · 이적 요청 태업 · 오래 못 뜀)
//  - 계약 만료 임박 (이번 시즌 끝) · 구단이 팔려는 선수 (선수단 능력 하위 · 21세 이상, 인원이 많으면 더)
//  - 그 밖의 선수는 '비매물': 이적 목록에는 모두 보이고 제안도 할 수 있지만 (웃돈 · 바이아웃 · 보스만) 구단이 비싸게 부른다 (transfer.ts askingPrice)
//  - 화면: 이적 허용 선수에 표시, '이적 허용 선수만' 필터
//  - 내 구단 선수는 내가 이적 명단에 올린 것만
import type { PlayerState, World } from './types';
import { overall } from './ratings';
import { ageOn } from './condition';
import { bargainOf } from './firesale';

export type SaleTag = 'free' | 'bargain' | 'request' | 'expiring' | 'surplus' | 'listed';

export const SALE_KO: Record<SaleTag, { ko: string; how: string }> = {
  free: { ko: '자유계약', how: '소속 구단이 없어 이적료 없이 영입할 수 있습니다' },
  bargain: { ko: '급매물', how: '재정 위기 · 강등 조항으로 싸게 나온 선수입니다' },
  request: { ko: '이적 희망', how: '출전 시간 불만 · 이적 요청으로 팀을 떠나고 싶어 합니다 (구단도 조금 싸게 팝니다)' },
  expiring: { ko: '만료 임박', how: '이번 시즌이 끝나면 계약이 끝나 구단이 지금 팔려고 합니다' },
  surplus: { ko: '구단 판매', how: '구단이 전력 외로 보고 팔려고 내놓은 선수입니다' },
  listed: { ko: '이적 명단', how: '내가 이적 명단에 올린 선수입니다' },
};

/** 선수단 능력 순위 (구단 · 날짜마다 한 번 계산) */
const rankCache = new WeakMap<World, { key: string; rank: Map<string, number> }>();
function squadRank(w: World, p: PlayerState): number {
  const key = `${w.date}|${w.season}`;
  let c = rankCache.get(w);
  if (!c || c.key !== key) { c = { key, rank: new Map() }; rankCache.set(w, c); }
  if (!c.rank.has(p.id) && p.clubId) {
    w.clubs[p.clubId]?.squad.map((id) => w.players[id]).filter(Boolean).sort((a, b) => overall(b) - overall(a)).forEach((x, i) => c!.rank.set(x.id, i + 1));
  }
  return c.rank.get(p.id) ?? 1;
}

/** 이 선수가 시장에 나와 있으면 그 이유 (없으면 null = 비매물) */
export function saleTag(w: World, p: PlayerState): SaleTag | null {
  if (p.retired) return null;
  if (!p.clubId) return 'free';
  if (p.clubId === w.userClubId) return (w.transferList ?? []).includes(p.id) ? 'listed' : null;
  if (p.loan || p.precontract || p.clubId.startsWith('nt-')) return null;
  if (bargainOf(w, p)) return 'bargain';
  if (p.unhappy || p.saga?.kind === 'move' || p.benchStreak >= 6) return 'request';
  if (p.contract && p.contract <= `${+w.season.slice(0, 4) + 1}-06-30`) return 'expiring';
  const club = w.clubs[p.clubId];
  const size = club?.squad.length ?? 0;
  const cut = size > 26 ? size - 6 : 20;   // 인원이 많으면 더 많이 내놓는다
  if (squadRank(w, p) > cut && ageOn(p.birth, w.date) >= 21) return 'surplus';
  return null;
}

/** 시장에 나와 있는가 */
export const onMarket = (w: World, p: PlayerState) => saleTag(w, p) != null;
