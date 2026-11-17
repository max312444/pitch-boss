// 나의 구단 만들기 모드
//  인수 방식 (takeover, 새 게임에서 고름)
//  - plain 그대로 인수: 꼴찌 구단을 이름 · 엠블럼만 바꿔 인수. 선수단 · 재정 · 명성 · 시설 모두 그대로 → 밑에서부터
//  - invest 투자 인수: 부자 구단주가 인수. 선수단은 그대로, 재정은 리그 상위 1/3 수준 (이적 자금은 한 번 크게, 주급은 리그 중간 정도)
//    대신 구단주 조건: 3시즌 안에 리그 6위 이내 (팀이 18개 미만이면 상위 1/3). 못 지키면 시즌 끝에 감독 해임 (다른 구단으로)
//  - (예전 세이브) takeover 없음: 아래 방식 — 선수는 FA 로 풀리고 유스로 시작
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
import { levelOf } from './pyramid';

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
export function swapInput(input: SeasonInput, st: Pick<MyClubState, 'id' | 'replaced'>, mine: Omit<ClubSeasonFile, 'season' | 'club' | 'league' | 'squad'>, keepSquad = false): { input: SeasonInput; freed: SquadPlayer[] } {
  let freed: SquadPlayer[] = [];
  const leagues = input.leagues.map((lg) => ({
    ...lg,
    clubs: lg.clubs.map((c) => {
      if (c.club !== st.replaced) return c;
      if (keepSquad) return { ...mine, season: input.season, club: st.id, league: lg.id, squad: c.squad } as ClubSeasonFile;   // 인수: 선수단 그대로
      freed = c.squad;
      return { ...mine, season: input.season, club: st.id, league: lg.id, squad: [] } as ClubSeasonFile;
    }),
  }));
  const prevStandings = input.prevStandings && Object.fromEntries(Object.entries(input.prevStandings).map(([k, v]) => [k, v.map((id) => (id === st.replaced ? st.id : id))]));
  return { input: { ...input, leagues, ...(prevStandings ? { prevStandings } : {}) }, freed };
}

/** 그대로 인수: 대신한 구단 값 그대로 */
export const plainStart = (c: ClubSeasonFile) => ({ reputation: c.reputation, finance: { ...c.finance }, facilities: c.facilities ?? { training: 3, youth: 3 }, stadiumCapacity: c.stadiumCapacity, formation: c.formation || '4-3-3' });

/** 투자 인수: 리그 상위 1/3 구단 중간값 (잔고 · 이적 예산), 주급 예산은 리그 중간값 ×1.1 (주급은 매주 나가므로 조금만), 매출 ×1.25 (새 구단주 상업 수입), 명성 +3 */
export function investStart(clubs: ClubSeasonFile[], replaced: ClubSeasonFile) {
  const byRep = [...clubs].sort((a, b) => b.reputation - a.reputation);
  const top = byRep.slice(0, Math.max(1, Math.ceil(clubs.length / 3)));
  const r5 = (v: number) => Math.round(v / 1e5) * 1e5;
  const base = plainStart(replaced);
  const rev = replaced.finance.revenue ?? replaced.finance.wageBudget * 52 * 1.6;
  return {
    ...base,
    reputation: Math.min(99, replaced.reputation + 3),
    finance: {
      balance: r5(Math.max(replaced.finance.balance, median(top.map((c) => c.finance.balance)))),
      transferBudget: r5(Math.max(replaced.finance.transferBudget, median(top.map((c) => c.finance.transferBudget)))),
      wageBudget: Math.round(Math.max(replaced.finance.wageBudget, median(clubs.map((c) => c.finance.wageBudget)) * 1.1) / 1000) * 1000,
      revenue: r5(rev * 1.25),
    },
    facilities: { training: Math.min(5, base.facilities.training + 1), youth: base.facilities.youth },
  };
}

/** 투자 인수 조건: 3시즌 (시작 시즌 포함) 안에 pos 위 이내 */
export const GOAL_SEASONS = 3;
export function investGoal(teams: number, season: string, level = 1): NonNullable<MyClubState['goal']> {
  const y = +season.slice(0, 4) + GOAL_SEASONS - 1;
  if (level >= 2) return { pos: 2, level: 2, from: season, by: `${y}-${String((y + 1) % 100).padStart(2, '0')}` };   // 2부: 승격 (2위 이내 또는 1부에 올라가 있으면)
  return { pos: teams >= 18 ? 6 : Math.ceil(teams / 3), from: season, by: `${y}-${String((y + 1) % 100).padStart(2, '0')}` };
}

/** 조건 문구 */
export const goalText = (g: NonNullable<MyClubState['goal']>) => (g.level === 2 ? `${g.by} 시즌까지 1부 승격` : `${g.by} 시즌까지 리그 ${g.pos}위 이내`);

/** 시즌 끝: 투자 인수 조건 확인 → 받은편지함 알림. 실패면 true (감독 해임) */
export function ownerGoalSeasonEnd(w: World, recs: { league: string; table: { club: string }[] }[]): boolean {
  const g = w.myClub?.goal;
  if (!g || g.met || g.failed || w.userClubId !== w.myClub!.id) return false;
  const c = w.clubs[w.userClubId];
  const rec = recs.find((r) => r.league === c.league);
  const pos = rec ? rec.table.findIndex((r) => r.club === c.id) + 1 : 0;
  const top = levelOf(c.league) === 1;
  const ok = g.level === 2 ? top || (pos > 0 && pos <= g.pos) : top && pos > 0 && pos <= g.pos;
  if (ok) {
    g.met = true;
    if (w.manager) w.manager.relation = Math.min(100, (w.manager.relation ?? 55) + 15);
    w.inbox.push({ type: 'info', date: w.date, text: `구단주 조건 달성! ${w.season} 시즌 ${pos}위로 '${goalText(g)}' 약속을 지켰습니다. 구단주가 크게 만족합니다 (이사회 관계 ↑)` });
    return false;
  }
  if (w.season >= g.by) {
    g.failed = true;
    w.inbox.push({ type: 'info', date: w.date, text: `구단주 조건 실패: '${goalText(g)}'를 지키지 못했습니다${pos ? ` (이번 시즌 ${pos}위)` : ''}. 구단주가 감독을 해임합니다 — 새 구단을 골라야 합니다` });
    return true;
  }
  const left = (+g.by.slice(0, 4)) - (+w.season.slice(0, 4));
  w.inbox.push({ type: 'info', date: w.date, text: `구단주 조건: ${goalText(g)} · 이번 시즌 ${pos || '-'}위 · 남은 시즌 ${left}` });
  return false;
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
  if (st.takeover) return;   // 인수: 선수단 그대로 (FA 로 풀지 않고 유스도 따로 안 받음)
  for (const sp of freed) {
    if (w.players[sp.id]) continue;
    const p = newPlayer(sp, null, w.seed, w.season);
    p.contract = null;
    w.players[sp.id] = p;
  }
  youthIntake(w, [w.clubs[st.id]], w.season, 40, { count: MY_YOUTH });
}
