// 은퇴 선수 보관: 은퇴하고 한 시즌이 지난 선수는 세이브에 가벼운 기록만 남긴다 (세이브 크기 ↓)
//  - 남기는 것: 이름 · 생일 · 국적 · 포지션 · 경력 (구단 역대 기록) · 호칭 · 수상 · 전성기 등 기록성 정보
//  - 빼는 것: 능력치 · 숨은 속성 · 성장 · 시즌 기록 · 컨디션 · 계약 같은 '뛰는 선수' 정보
//  - 불러올 때 빠진 칸을 기본값으로 채워 (unpackPlayer) 어떤 코드가 읽어도 오류가 나지 않게 한다
//  - 대표팀 전용 가상 선수 (intlOnly) 처럼 retired 표시만 빌려 쓰는 선수는 건드리지 않는다 (retiredOn 이 없음)
import type { PlayerState, World } from './types';
import { emptyStats } from './world';

const DROP = [
  'base', 'growth', 'hidden', 'stats', 'cupStats', 'intlStats', 'recentRatings', 'condition', 'fitness', 'morale', 'sharpness',
  'injury', 'suspension', 'yellowCount', 'loyalty', 'benchStreak', 'startStreak', 'unhappy', 'tlog', 'wage', 'contract', 'contractGen',
  'alt', 'dataAlt', 'retrain', 'retrainSaved', 'learned', 'bodyChange', 'boost', 'saga', 'precontract', 'loan', 'sellOn', 'addOn',
  'buyout', 'buyoutClub', 'relClause', 'relClub', 'amort', 'amortEnd', 'lastFee', 'seedClubSeasons', 'seedOneClub', 'number', 'clubId', 'dev',
] as const;

/** 세이브에서 가볍게 줄일 선수: 지난 시즌 이전에 은퇴 (그 시즌 은퇴 소식 · 시즌 보고서는 그대로 보이게) */
export const archivable = (w: World, p: PlayerState) => !!p.retired && !!p.retiredOn && p.retiredOn < w.season && !p.intlOnly;

/** 저장용 월드: 보관할 은퇴 선수를 가벼운 기록으로 (원본 월드는 바꾸지 않음) */
export function packWorld(w: World): World {
  const players: Record<string, PlayerState> = {};
  let n = 0;
  for (const [id, p] of Object.entries(w.players)) {
    if (!archivable(w, p)) { players[id] = p; continue; }
    const slim: Record<string, unknown> = { ...p, archived: true };
    for (const k of DROP) delete slim[k];
    // 경력: 뛴 시즌만 · 평점 · 도움 0 은 뺀다
    slim.career = p.career.filter((c) => c.apps || c.cupApps).map(({ rating: _r, assists, ...c }) => (assists ? { ...c, assists } : c));
    players[id] = slim as unknown as PlayerState;
    n++;
  }
  return n ? { ...w, players } : w;
}

/** 불러온 선수가 보관 기록이면 빠진 칸을 기본값으로 채운다 */
export function unpackPlayer(p: PlayerState): PlayerState {
  if (!(p as { archived?: boolean }).archived && p.hidden) return p;
  const d: Partial<PlayerState> = {
    number: null, clubId: null, base: {}, growth: {}, wage: 0, contract: null, traits: [],
    hidden: { consistency: 10, bigMatch: 10, professionalism: 10, injuryProne: 10, adaptability: 10, ambition: 10, temperament: 10, loyalty: 10 },
    fitness: 100, condition: 0, morale: 60, sharpness: 60, recentRatings: [], injury: null, suspension: 0, yellowCount: 0,
    loyalty: 50, benchStreak: 0, stats: emptyStats(), career: [],
  };
  for (const [k, v] of Object.entries(d)) if ((p as unknown as Record<string, unknown>)[k] === undefined) (p as unknown as Record<string, unknown>)[k] = v;
  for (const c of p.career) { c.assists ??= 0; c.rating ??= null; }
  return p;
}
