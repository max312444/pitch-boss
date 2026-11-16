// 나의 구단 만들기 모드
//  - 고른 리그의 꼴찌 자리(명성이 가장 낮은 구단, 같으면 전력이 약한 쪽)를 내 구단이 대신한다.
//    그 구단은 이 세계에서 사라지고 선수들은 자유계약(FA)으로 풀린다 → 내가 주워 올 수 있음
//  - 다음 시즌 실제 데이터에 그 구단이 나오면 그 자리를 내 구단으로 바꿔 읽는다 (swapInput) → 리그 크기 · 승강 수가 그대로
//  - 시작 재정: 그 리그 아래쪽 절반 구단의 중간값 기준, 사용자 구단 혜택으로 넉넉하게 (선수단을 처음부터 채워야 하므로)
//    이적 예산 ×1.6 · 주급 예산 ×1.25 · 잔고 ×1.3 · 매출 ×1.1, 명성은 대신한 구단과 아래쪽 중간값 중 높은 쪽 (+2)
//  - 선수단: 유스 MY_YOUTH 명으로 시작. 나머지는 영입 · 자유계약으로 채워야 시즌을 시작할 수 있다 (squadNeeds)
//  - 스폰서: 다른 구단처럼 첫 계약이 자동으로 붙는다 (sponsors.ts ensureSponsors, 매출 기준)
import type { ClubSeasonFile, SquadPlayer } from '../data/types';
import type { MyClubState } from './myclubDesign';
export { myClubMaster, type MyClubDesign, type MyClubState } from './myclubDesign';
import type { SeasonInput } from './world';
import type { ClubState, World } from './types';
import { overall, posGroup } from '../data/rating';
import { matchRules } from './squad';
import { newPlayer } from './world';
import { youthIntake } from './youth';

export const MY_YOUTH = 6;
/** 포지션 묶음별 최소 인원 (시즌 시작 조건) */
export const MY_MIN: Record<string, number> = { GK: 2, DF: 6, MF: 6, FW: 3 };
export const GROUP_KO: Record<string, string> = { GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수' };

const strength = (c: ClubSeasonFile) => { const t = c.squad.map(overall).sort((a, b) => b - a).slice(0, 11); return t.reduce((a, b) => a + b, 0) / Math.max(1, t.length); };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** 이 리그의 꼴찌 자리 (명성이 가장 낮은 구단 · 같으면 전력이 약한 쪽) */
export function weakestClub(clubs: ClubSeasonFile[]): ClubSeasonFile {
  return [...clubs].sort((a, b) => a.reputation - b.reputation || strength(a) - strength(b))[0];
}

/** 시작 재정 · 명성 · 시설 (그 리그 아래쪽 절반 기준, 넉넉하게) */
export function myStart(clubs: ClubSeasonFile[], replaced: ClubSeasonFile) {
  const low = [...clubs].sort((a, b) => a.reputation - b.reputation).slice(0, Math.max(1, Math.ceil(clubs.length / 2)));
  const m = (f: (c: ClubSeasonFile) => number) => median(low.map(f));
  const r5 = (v: number) => Math.round(v / 1e5) * 1e5;
  const revenue = m((c) => c.finance.revenue ?? c.finance.wageBudget * 52 * 1.6);
  return {
    reputation: Math.min(99, Math.max(replaced.reputation, m((c) => c.reputation)) + 2),
    finance: {
      balance: r5(m((c) => c.finance.balance) * 1.3),
      transferBudget: r5(m((c) => c.finance.transferBudget) * 1.6),
      wageBudget: Math.round(m((c) => c.finance.wageBudget) * 1.25 / 1000) * 1000,
      revenue: r5(revenue * 1.1),
    },
    facilities: { training: Math.max(2, Math.round(m((c) => c.facilities?.training ?? 3))), youth: Math.max(3, Math.round(m((c) => c.facilities?.youth ?? 3))) },
    stadiumCapacity: replaced.stadiumCapacity ?? Math.round(m((c) => c.stadiumCapacity ?? 25000)),
  };
}

/**
 * 시즌 데이터에서 대신한 구단 자리를 내 구단으로 바꾼다.
 *  첫 시즌: 내 구단 시작값 (start) · 대신한 구단 선수들은 freed 로 돌려줌 (FA 로 풀기)
 *  다음 시즌부터: 지금 내 구단 값 그대로 (명성 · 재정은 게임 속 값을 이어감), 선수단 데이터 없음
 */
export function swapInput(input: SeasonInput, st: Pick<MyClubState, 'id' | 'replaced'>, mine: Omit<ClubSeasonFile, 'season' | 'club' | 'league' | 'squad'>): { input: SeasonInput; freed: SquadPlayer[] } {
  let freed: SquadPlayer[] = [];
  const leagues = input.leagues.map((lg) => ({
    ...lg,
    clubs: lg.clubs.map((c) => {
      if (c.club !== st.replaced) return c;
      freed = c.squad;
      return { ...mine, season: input.season, club: st.id, league: lg.id, squad: [] } as ClubSeasonFile;
    }),
  }));
  const prevStandings = input.prevStandings && Object.fromEntries(Object.entries(input.prevStandings).map(([k, v]) => [k, v.map((id) => (id === st.replaced ? st.id : id))]));
  return { input: { ...input, leagues, ...(prevStandings ? { prevStandings } : {}) }, freed };
}

/** 지금 내 구단 값 → 다음 시즌 데이터 자리에 넣을 값 */
export const currentAsData = (c: ClubState): Omit<ClubSeasonFile, 'season' | 'club' | 'league' | 'squad'> => ({
  reputation: c.reputation, finance: { ...c.finance }, facilities: c.facilities ?? { training: 3, youth: 3 }, stadiumCapacity: c.stadium ?? null, formation: c.tactics.formation,
});

/** 시즌을 시작할 수 있는지: 포지션 묶음별 최소 인원 + 선발 11명과 후보 전원 */
export function squadNeeds(w: World): { ok: boolean; total: number; need: number; groups: { g: string; have: number; need: number }[] } {
  const c = w.clubs[w.userClubId];
  const counts: Record<string, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const id of c.squad) { const p = w.players[id]; if (p) counts[posGroup(p.pos)]++; }
  const need = 11 + matchRules(w.season).benchSize;
  const groups = Object.entries(MY_MIN).map(([g, n]) => ({ g, have: counts[g], need: n }));
  const total = c.squad.length;
  return { ok: total >= need && groups.every((x) => x.have >= x.need), total, need, groups };
}

/** 이 세계에 쓸 새 구단 ID */
export const newMyClubId = (seed: number) => `my-${(seed >>> 0).toString(36)}`;

/** 새 게임 직후: 대신한 구단 선수들을 자유계약으로 풀고, 유스 몇 명으로 시작 */
export function setupMyClub(w: World, st: MyClubState, freed: SquadPlayer[]) {
  w.myClub = st;
  for (const sp of freed) {
    if (w.players[sp.id]) continue;
    const p = newPlayer(sp, null, w.seed, w.season);
    p.contract = null;
    w.players[sp.id] = p;
  }
  youthIntake(w, [w.clubs[st.id]], w.season, 40, { count: MY_YOUTH });
}
