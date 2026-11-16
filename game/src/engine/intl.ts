// 월드컵 모드 (대표팀 감독): 나라 하나를 맡아 A매치 → 예선 → 본선 → 다음 월드컵을 계속
//  - 내 대표팀은 늘 있는 경기용 구단 nt-<나라> (리그 'intl'). 선수는 소속 구단 그대로, 대표 명단(squad)만 내가 정한다
//  - 클럽 리그는 뒤에서 자동으로 진행 (선수 성장 · 이적 · 은퇴). 이적시장 · 재정 · 이사회 등 구단 일은 없음
//  - 일정 (A매치 기간 = intlBreaks: 9 · 10 · 11 · 3월 토요일, 그리고 사흘 뒤 화요일):
//      월드컵이 있는 시즌 (예: 2001/02 → 2002 월드컵): 9 · 10 · 11월 예선 조별리그 6경기 (4팀 홈 · 원정),
//        3월 플레이오프 (조 2위: 준결승 · 결승 단판), 6 · 7월 본선 (worldcup.ts)
//      그 밖의 시즌: 친선경기 (기간마다 2경기, 비슷한 전력의 나라)
//  - 예선은 내 대륙의 내 조만 실제로 치른다 (다른 나라끼리 경기는 전력으로 빠르게 계산). 본선 참가국은 실제 대회면 실제 참가국,
//    내가 통과했는데 실제로는 못 나갔으면 같은 대륙에서 가장 약한 참가국과 자리를 바꾸고, 떨어졌으면 내 자리를 같은 대륙 다른 나라가
//  - 개최국은 예선 없이 본선 (그해는 친선)
//  - 소집 후보: 게임 속 그 나라 선수 + 이번 주기 '국내파' (실제 월드컵 명단 중 게임에 없는 선수는 실명으로 만들고, 그래도 모자라면 가상)
import { ensureManager } from './manager';
import type { Fixture, PlayerState, TableRow, World } from './types';
import type { Position } from '../data/types';
import { createRng, hashSeed, type Rng } from './rng';
import { applyResult, emptyRow, sortTable } from './standings';
import { ALL_NATIONS, confedOf, fillerLevel, intlBreaks, missingSlots, nationPlayers, nationStrength, selectSquad, type Confed } from './national';
import { NT, worldCupYear } from './worldcup';
import { overall } from './ratings';
import { posGroup } from '../data/rating';
import { guessFormation } from './squad';
import { makeAttrs, namePools } from './youth';
import { estimateOvr, playerFromRow, wcSquadsOf, type WcSquadRow } from './wcsquads';
import { newPlayer } from './world';

export { setWcSquads, wcSquadsOf, type WcSquadRow, type WcSquads } from './wcsquads';

export type IntlStage = 'quali' | 'playoff' | 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'champion';
export const STAGE_KO: Record<IntlStage, string> = { quali: '예선 탈락', playoff: '플레이오프 탈락', group: '본선 조별리그', r32: '32강', r16: '16강', qf: '8강', sf: '4강', final: '준우승', champion: '우승' };
const STAGE_ORDER: IntlStage[] = ['quali', 'playoff', 'group', 'r32', 'r16', 'qf', 'sf', 'final', 'champion'];
export const stageRank = (s: IntlStage) => STAGE_ORDER.indexOf(s);

export interface IntlGroup { name: string; teams: string[]; table: Record<string, TableRow> }
export interface IntlState {
  nation: string;
  /** 이번 주기 월드컵 연도 */
  cycle: number;
  /** 협회 목표 (이번 주기) */
  objective: IntlStage;
  /** 이번 주기 국내파 (소집 후보, 게임에 없는 선수 · retired 표시로 클럽 일에서 빠짐) */
  domestic: string[];
  /** 내 대표팀 경기 (친선 · 예선 · 플레이오프) */
  fixtures: Fixture[];
  quali?: { group: IntlGroup; done?: boolean; result?: 'qualified' | 'playoff' | 'out'; /** 같은 조 다른 경기를 계산한 차전 */ simmed?: string[]; playoff?: { done?: boolean; won?: boolean; /** 결승 상대|날짜 */ final?: string } };
  /** 개최국이라 예선 없음 */
  host?: boolean;
  /** 지난 주기 성적 */
  history: { year: number; stage: IntlStage; objective: IntlStage }[];
  /** 협회 평가 (주기가 끝날 때): 경질 → 다른 나라 고르기 (필수) · 목표를 크게 넘으면 더 큰 나라 제안 (선택) */
  job?: { reason: 'sacked' | 'offer'; offers: string[]; stage: IntlStage; objective: IntlStage };
  /** 상대 대표팀 경기용 구단 · 가상 선수 (시즌이 바뀌면 정리) */
  temp: { clubs: string[]; fillers: string[] };
}

export const isIntl = (w: World) => !!w.intl;
export const LEAGUE = 'nt';

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const r1 = (v: number) => Math.round(v * 10) / 10;

// ── 나라 전력 · 상대 대표팀 ───────────────────────────────
/** 경기용 대표팀 구단 만들기 (상대 · 친선): 게임 속 선수 + 모자라면 가상 '국내파' */
export function buildNationTeam(w: World, nation: string, size: 23 | 26, rng: Rng, opts: { real?: WcSquadRow[]; year?: number } = {}): string {
  const id = NT(nation);
  let squad: PlayerState[];
  if (opts.real?.length && opts.year) squad = opts.real.map((r) => playerFromRow(w, r, nation, opts.year!)).filter((p) => !p.injury).slice(0, size);
  else squad = selectSquad(w, nation, size);
  const level = fillerLevel(nationPlayers(w, nation).slice(0, 11).map(overall));
  const pools = namePools(w);
  const fillers: string[] = [];
  missingSlots(squad, size).forEach((pos, i) => {
    const pool = pools.get(nation) ?? [...pools.values()].find((p) => p.last.length > 20)!;
    const f = pool.first.length ? rng.pick(pool.first) : null, l = rng.pick(pool.last);
    const fid = `ntf-${w.date}-${nation}-${i}`;
    const y = +w.date.slice(0, 4);
    const p = newPlayer({ id: fid, name: [f?.v, l.v].filter(Boolean).join(' '), birth: `${y - rng.int(22, 31)}-0${rng.int(1, 9)}-1${rng.int(0, 9)}`, nation, height: null, foot: null, number: null, pos, attrs: makeAttrs(Math.round(level + rng.int(-4, 3)), pos, rng), wage: 0, contract: null }, null, w.seed);
    p.retired = true; p.generated = true; p.nameFrom = [f?.id ?? null, l.id];
    w.players[fid] = p; fillers.push(fid); squad.push(p);
  });
  const top = squad.map(overall).sort((a, b) => b - a).slice(0, 11);
  const str = top.reduce((a, b) => a + b, 0) / Math.max(1, top.length);
  w.clubs[id] = {
    id, league: 'intl', reputation: Math.round(Math.max(50, Math.min(97, 60 + (str - 65) * 1.6))), squad: squad.map((p) => p.id),
    tactics: { formation: guessFormation(squad), mentality: 0, pressing: 1 }, finance: { balance: 0, transferBudget: 0, wageBudget: 0, revenue: 0 }, lineup: null,
  };
  if (w.intl && nation !== w.intl.nation) { w.intl.temp.clubs.push(id); w.intl.temp.fillers.push(...fillers); }
  return id;
}

/** 대표팀 전력 (경기용 구단이 있으면 그 명단, 없으면 게임 속 선수) */
export const teamStrength = (w: World, nation: string) => {
  const c = w.clubs[NT(nation)];
  if (c && c.squad.length >= 11) { const t = c.squad.map((id) => overall(w.players[id])).sort((a, b) => b - a).slice(0, 11); return t.reduce((a, b) => a + b, 0) / 11; }
  return strengthOf(w, nation);
};

/**
 * 나라 전력 (상대 고르기 · 예선 조 · 목표): 게임 속 선수만이 아니라 그 무렵 실제 월드컵 명단까지 (게임에 없는 선수는 추정 능력).
 * 실제 명단이 없으면 게임 속 선수 (모자라면 국내파 수준)
 */
const strCache = new Map<string, number>();
export function strengthOf(w: World, nation: string): number {
  const cy = w.intl?.cycle ?? (+w.season.slice(0, 4) + 1);
  const key = `${w.seed}:${w.season}:${cy}:${nation}`;
  const hit = strCache.get(key);
  if (hit != null) return hit;
  const base = nationStrength(w, nation);
  const year = [cy, cy - 4, cy + 4].find((y) => wcSquadsOf(y, nation)?.length);
  let v = base;
  if (year) {
    const vals = wcSquadsOf(year, nation)!.map((r) => { const p = r.id ? w.players[r.id] : undefined; return p && !p.intlOnly ? overall(p) : estimateOvr(r, year); }).sort((a, b) => b - a).slice(0, 11);
    v = Math.max(base, vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length));
  }
  if (strCache.size > 5000) strCache.clear();
  strCache.set(key, v);
  return v;
}

// ── 소집 후보 · 내 명단 ────────────────────────────────
/** 소집 후보: 게임 속 그 나라 선수 + 이번 주기 국내파 (능력 순) */
export function callUpPool(w: World): PlayerState[] {
  const it = w.intl!;
  const seen = new Set<string>();
  const out: PlayerState[] = [];
  for (const p of [...Object.values(w.players).filter((p) => p.nation === it.nation && !p.retired && p.clubId), ...it.domestic.map((id) => w.players[id]).filter(Boolean)]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id); out.push(p);
  }
  return out.sort((a, b) => overall(b) - overall(a));
}
export const squadSize = (w: World): 23 | 26 => (w.intl && w.intl.cycle >= 2022 ? 26 : 23);

/** 자동 소집 (처음 · 감독이 '추천 명단'을 누를 때): 포지션 묶음별 인원 + 능력 순 */
export function autoCallUp(w: World): string[] {
  const size = squadSize(w);
  const quota: Record<string, number> = size === 26 ? { GK: 3, DF: 9, MF: 9, FW: 5 } : { GK: 3, DF: 8, MF: 8, FW: 4 };
  const pool = callUpPool(w).filter((p) => !p.injury || p.injury.days <= 3);
  const pick: PlayerState[] = [];
  for (const [g, n] of Object.entries(quota)) pick.push(...pool.filter((p) => posGroup(p.pos) === g).slice(0, n));
  for (const p of pool) { if (pick.length >= size) break; if (!pick.includes(p)) pick.push(p); }
  return pick.slice(0, size).map((p) => p.id);
}

/** 이번 주기 국내파: 그 나라 실제 월드컵 명단(이번 주기, 없으면 가까운 대회) 중 게임에 없는 선수 + 모자라면 가상 */
export function refreshDomestic(w: World) {
  const it = w.intl!;
  const near = [it.cycle, it.cycle - 4, it.cycle + 4, it.cycle - 8, it.cycle + 8].find((y) => wcSquadsOf(y, it.nation)?.length);
  const rows = near ? wcSquadsOf(near, it.nation)! : [];
  const dom: string[] = [];
  for (const r of rows) {
    const p = playerFromRow(w, r, it.nation, near!);
    if (p.intlOnly) dom.push(p.id);
  }
  // 그래도 후보가 32명이 안 되면 가상 국내파
  const rng = createRng((w.seed ^ hashSeed(`dom:${it.cycle}:${it.nation}`)) >>> 0);
  const world = Object.values(w.players).filter((p) => p.nation === it.nation && !p.retired && p.clubId).length;
  const need = Math.max(0, 32 - world - dom.length);
  if (need) {
    const level = fillerLevel(nationPlayers(w, it.nation).slice(0, 11).map(overall));
    const pools = namePools(w);
    const groups: Position[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST'];
    for (let i = 0; i < need; i++) {
      const pool = pools.get(it.nation) ?? [...pools.values()].find((p) => p.last.length > 20)!;
      const f = pool.first.length ? rng.pick(pool.first) : null, l = rng.pick(pool.last);
      const pos = groups[i % groups.length];
      const id = `dom-${it.cycle}-${it.nation}-${i}`;
      if (w.players[id]) { dom.push(id); continue; }
      const p = newPlayer({ id, name: [f?.v, l.v].filter(Boolean).join(' '), birth: `${it.cycle - rng.int(21, 32)}-0${rng.int(1, 9)}-1${rng.int(0, 9)}`, nation: it.nation, height: null, foot: null, number: null, pos, attrs: makeAttrs(Math.round(level + rng.int(-5, 4)), pos, rng), wage: 0, contract: null }, null, w.seed);
      p.retired = true; p.intlOnly = true; p.generated = true; p.nameFrom = [f?.id ?? null, l.id];
      w.players[id] = p; dom.push(id);
    }
  }
  it.domestic = dom;
}

// ── 협회 목표 ───────────────────────────────────────
/** 전력 순위로 목표: 세계 4위 안 → 4강, 8위 → 8강, 16위 → 16강, 32위 → 본선, 그 밖 → 예선 플레이오프 */
export function objectiveFor(w: World, nation: string): IntlStage {
  const ranked = ALL_NATIONS.map((n) => [n, strengthOf(w, n)] as const).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const r = ranked.indexOf(nation) + 1;
  const obj: IntlStage = r <= 4 ? 'sf' : r <= 8 ? 'qf' : r <= 16 ? 'r16' : r <= 32 ? 'group' : 'playoff';
  // 실제로 이 대회 본선에 나간 나라는 적어도 본선 진출 (대륙별 본선 자리가 있어서 전력 순위만으로는 낮게 나옴)
  const finalist = !!wcSquadsOf(w.intl?.cycle ?? 0, nation)?.length;
  return finalist && stageRank(obj) < stageRank('group') ? 'group' : obj;
}

// ── 일정 ──────────────────────────────────────────
/** 시즌의 A매치 날짜: 기간마다 토요일 · 화요일 */
export function windowDates(season: string): string[] { return intlBreaks(season).flatMap((d) => [d, addDays(d, 3)]); }

/** 친선 상대: 전력이 비슷한 나라 (±6, 없으면 가까운 순) */
function friendlyOpponents(w: World, n: number, rng: Rng): string[] {
  const me = w.intl!.nation, s0 = strengthOf(w, me);
  const cands = ALL_NATIONS.filter((x) => x !== me).map((x) => [x, Math.abs(strengthOf(w, x) - s0)] as const).sort((a, b) => a[1] - b[1]).slice(0, 16).map(([x]) => x);
  return Array.from({ length: n }, () => rng.pick(cands));
}

/** 예선 조: 내 대륙에서 전력 구간별로 한 나라씩 (4팀). 개최국은 예선 없음 */
function drawQualiGroup(w: World, rng: Rng): IntlGroup {
  const me = w.intl!.nation;
  const conf: Confed = confedOf(me) ?? 'UEFA';
  let pool = ALL_NATIONS.filter((n) => n !== me && confedOf(n) === conf);
  if (pool.length < 3) pool = ALL_NATIONS.filter((n) => n !== me && (confedOf(n) === conf || confedOf(n) === 'AFC'));
  const sorted = pool.map((n) => [n, strengthOf(w, n)] as const).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const q = Math.max(1, Math.floor(sorted.length / 3));
  const picks = [rng.pick(sorted.slice(0, q)), rng.pick(sorted.slice(q, 2 * q)), rng.pick(sorted.slice(2 * q))].filter(Boolean);
  const teams = [me, ...new Set(picks)].map(NT);
  return { name: `${conf} 예선`, teams, table: Object.fromEntries(teams.map((t) => [t, emptyRow(t)])) };
}

/** 시즌 시작: 내 대표팀 일정 (예선 시즌이면 예선 · 아니면 친선) */
export function intlSeasonStart(w: World) {
  const it = w.intl!;
  const year = worldCupYear(w.season);
  const rng = createRng((w.seed ^ hashSeed(`intl:${w.season}:${it.nation}`)) >>> 0);
  const dates = windowDates(w.season);
  it.fixtures = [];
  it.quali = undefined;
  const me = NT(it.nation);
  const hosts = year ? (w.worldCup?.hosts ?? []) : [];
  it.host = !!year && hosts.includes(it.nation);
  if (year && !it.host) {
    // 예선: 9 · 10 · 11월 6경기 (홈 · 원정), 3월 플레이오프 2경기
    const g = drawQualiGroup(w, rng);
    it.quali = { group: g };
    const t = g.teams;
    const rounds: [number, number][][] = [[[0, 1], [2, 3]], [[2, 0], [3, 1]], [[0, 3], [1, 2]], [[1, 0], [3, 2]], [[0, 2], [1, 3]], [[3, 0], [2, 1]]];
    rounds.forEach((pairs, r) => pairs.forEach(([h, a], k) => {
      if (t[h] === undefined || t[a] === undefined || (h !== 0 && a !== 0)) return;   // 내 경기만 (다른 두 나라 경기는 빠르게 계산)
      it.fixtures.push({ id: `nt-${w.season}-q${r + 1}-${k}`, league: LEAGUE, round: r + 1, date: dates[r], home: t[h], away: t[a], stage: 'intl', name: `월드컵 예선 ${r + 1}차전` });
    }));
    // 3월 두 경기는 플레이오프 자리 (예선이 끝나면 정함)
  } else {
    // 친선: 기간마다 2경기
    const opps = friendlyOpponents(w, dates.length, rng);
    dates.forEach((d, i) => it.fixtures.push({ id: `nt-${w.season}-f${i + 1}`, league: LEAGUE, round: i + 1, date: d, home: i % 2 ? NT(opps[i]) : me, away: i % 2 ? me : NT(opps[i]), stage: 'intl', name: '친선경기' }));
  }
}

/** 다른 나라끼리 예선 경기 (빠른 계산): 전력 차 → 골 */
function quickResult(w: World, home: string, away: string, rng: Rng): [number, number] {
  const d = (teamStrength(w, home.slice(3)) - teamStrength(w, away.slice(3)) + 2) / 10;   // 홈 +2
  const goals = (lam: number) => { let k = 0, p = Math.exp(-lam), s = p; const u = rng.next(); while (u > s && k < 9) { k++; p *= lam / k; s += p; } return k; };
  return [goals(Math.max(0.2, 1.3 * Math.exp(d))), goals(Math.max(0.2, 1.3 * Math.exp(-d)))];
}

/** 경기 결과 (applyMatch 에서): 예선 순위표 · 플레이오프 승부차기 */
export function onIntlResult(w: World, f: Fixture, pens: () => 'home' | 'away') {
  const it = w.intl;
  if (!it || f.league !== LEAGUE) return;
  const s = f.result!;
  if (it.quali && f.name?.startsWith('월드컵 예선')) applyResult(it.quali.group.table, f.home, f.away, s.homeGoals, s.awayGoals);
  if (f.name?.startsWith('예선 플레이오프') && s.homeGoals === s.awayGoals) s.pens ??= pens();
}

/** 매일: 예선 같은 조 다른 경기 (빠른 계산) · 예선 마감 → 통과 / 플레이오프 / 탈락 · 플레이오프 마감 · 상대 대표팀 준비 */
export function intlDay(w: World, rng: Rng): import('./types').GameEvent[] {
  const it = w.intl;
  if (!it) return [];
  const ev: import('./types').GameEvent[] = [];
  const me = NT(it.nation);
  // 오늘 내 경기 상대 대표팀 준비 (경기용 구단이 없으면 만든다)
  for (const f of it.fixtures) if (f.date >= w.date && f.date <= addDays(w.date, 3) && !f.result) {
    const opp = f.home === me ? f.away : f.home;
    if (!w.clubs[opp]) buildNationTeam(w, opp.slice(3), squadSize(w), rng);
  }
  const q = it.quali;
  if (q && !q.done) {
    // 같은 날 내 조 다른 두 나라 경기 (내 경기와 같은 날짜 · 같은 차전): 내 경기가 끝난 다음 날 계산
    for (const f of it.fixtures.filter((x) => x.name?.startsWith('월드컵 예선') && x.result && x.date < w.date)) {
      const key = `${f.round}`;
      if (q.simmed?.includes(key)) continue;
      const others = q.group.teams.filter((t) => t !== f.home && t !== f.away);
      if (others.length === 2) {
        const [h, a] = f.round % 2 ? others : [others[1], others[0]];
        const [hg, ag] = quickResult(w, h, a, rng);
        applyResult(q.group.table, h, a, hg, ag);
      }
      (q.simmed ??= []).push(key);
    }
    const mine = it.fixtures.filter((x) => x.name?.startsWith('월드컵 예선'));
    if (mine.length && mine.every((x) => x.result) && (q.simmed?.length ?? 0) >= mine.length) {
      q.done = true;
      const order = sortTable(q.group.table).map((r) => r.club);
      const pos = order.indexOf(me) + 1;
      q.result = pos === 1 ? 'qualified' : pos === 2 ? 'playoff' : 'out';
      ev.push({ type: 'info', date: w.date, text: pos === 1 ? `월드컵 예선 조 1위 · ${it.cycle} 월드컵 본선 진출!` : pos === 2 ? '월드컵 예선 조 2위 · 3월 플레이오프 (준결승 · 결승 단판)' : `월드컵 예선 ${pos}위 탈락 · ${it.cycle} 월드컵에 나가지 못합니다` });
      if (q.result === 'playoff') {
        // 플레이오프: 같은 대륙 다른 조 2위 수준의 나라 둘 (전력이 비슷한)
        const conf = confedOf(it.nation) ?? 'UEFA';
        const s0 = strengthOf(w, it.nation);
        const pool = ALL_NATIONS.filter((n) => confedOf(n) === conf && !q.group.teams.includes(NT(n))).sort((a, b) => Math.abs(strengthOf(w, a) - s0) - Math.abs(strengthOf(w, b) - s0)).slice(0, 6);
        const [d1, d2] = windowDates(w.season).slice(6, 8);
        const o1 = rng.pick(pool), o2 = rng.pick(pool.filter((x) => x !== o1));
        it.fixtures.push({ id: `nt-${w.season}-po1`, league: LEAGUE, round: 7, date: d1, home: me, away: NT(o1), stage: 'intl', name: '예선 플레이오프 준결승' });
        q.playoff = { final: `${o2}|${d2}` };
      }
      applyQualification(w);
    }
  }
  // 플레이오프: 준결승 이기면 결승 경기 추가, 결승까지 끝나면 정리
  if (q?.playoff && !q.playoff.done) {
    const semi = it.fixtures.find((f) => f.id.endsWith('-po1'));
    const fin = it.fixtures.find((f) => f.id.endsWith('-po2'));
    const winOf = (f: Fixture) => { const s = f.result!; return s.homeGoals > s.awayGoals ? f.home : s.homeGoals < s.awayGoals ? f.away : s.pens === 'away' ? f.away : f.home; };
    if (semi?.result && !fin) {
      if (winOf(semi) !== me) { q.playoff.done = true; q.playoff.won = false; q.result = 'out'; ev.push({ type: 'info', date: w.date, text: '예선 플레이오프 준결승 패배 · 월드컵에 나가지 못합니다' }); applyQualification(w); }
      else { const [o2, d2] = q.playoff.final!.split('|'); it.fixtures.push({ id: `nt-${w.season}-po2`, league: LEAGUE, round: 8, date: d2, home: NT(o2), away: me, stage: 'intl', name: '예선 플레이오프 결승' }); }
    }
    if (fin?.result) {
      const won = winOf(fin) === me;
      q.playoff.done = true; q.playoff.won = won; q.result = won ? 'qualified' : 'out';
      ev.push({ type: 'info', date: w.date, text: won ? `예선 플레이오프 우승 · ${it.cycle} 월드컵 본선 진출!` : '예선 플레이오프 결승 패배 · 월드컵에 나가지 못합니다' });
      applyQualification(w);
    }
  }
  return ev;
}

/** 본선 참가국 맞추기: 내가 통과했으면 본선에 넣고 (같은 대륙 가장 약한 나라와 자리 바꿈), 떨어졌으면 내 자리를 같은 대륙 다른 나라에 */
export function applyQualification(w: World) {
  const it = w.intl!, wc = w.worldCup, q = it.quali;
  if (!wc || !q) return;
  const me = NT(it.nation);
  const inCup = wc.groups.some((g) => g.teams.includes(me));
  const swap = (from: string, to: string) => {
    for (const g of wc.groups) { const i = g.teams.indexOf(from); if (i >= 0) { g.teams[i] = to; g.table = Object.fromEntries(g.teams.map((t) => [t, g.table[t === to ? from : t] ? { ...g.table[t === to ? from : t], club: t } : emptyRow(t)])); } }
    for (const f of wc.fixtures) { if (f.home === from) f.home = to; if (f.away === from) f.away = to; }
  };
  const conf = confedOf(it.nation);
  const participants = wc.groups.flatMap((g) => g.teams);
  if (q.result === 'qualified' && !inCup) {
    const same = participants.filter((t) => confedOf(t.slice(3)) === conf && !wc.hosts.includes(t.slice(3)));
    const out = (same.length ? same : participants.filter((t) => !wc.hosts.includes(t.slice(3)))).sort((a, b) => strengthOf(w, a.slice(3)) - strengthOf(w, b.slice(3)))[0];
    if (out) swap(out, me);
  } else if (q.result === 'out' && inCup) {
    const cand = ALL_NATIONS.filter((n) => confedOf(n) === conf && !participants.includes(NT(n)) && !q.group.teams.includes(NT(n))).sort((a, b) => strengthOf(w, b) - strengthOf(w, a))[0]
      ?? ALL_NATIONS.filter((n) => !participants.includes(NT(n)) && n !== it.nation).sort((a, b) => strengthOf(w, b) - strengthOf(w, a))[0];
    if (cand) swap(me, NT(cand));
  }
}

/** 이번 주기 내 성적 (월드컵이 끝난 뒤) */
export function cycleStage(w: World): IntlStage {
  const it = w.intl!, wc = w.worldCup, me = NT(it.nation);
  if (!wc || !wc.groups.some((g) => g.teams.includes(me))) return it.quali?.result === 'out' && it.quali.playoff ? 'playoff' : 'quali';
  if (wc.winner === me) return 'champion';
  if (wc.runnerUp === me) return 'final';
  const lastRound = [...wc.knockout].reverse().find((r) => r.ties.some((t) => t.a === me || t.b === me));
  if (!lastRound) return 'group';
  return lastRound.name === '32강' ? 'r32' : lastRound.name === '16강' ? 'r16' : lastRound.name === '8강' ? 'qf' : 'sf';
}

/** 새 게임: 월드컵 모드 세계 준비 (내 대표팀 · 국내파 · 첫 일정) */
export function setupIntl(w: World, nation: string) {
  const cycle = worldCupYear(w.season) ?? (() => { const y = +w.season.slice(0, 4) + 1; return y + ((2002 - y) % 4 + 4) % 4; })();
  w.intl = { nation, cycle, objective: 'group', domestic: [], fixtures: [], history: [], temp: { clubs: [], fillers: [] } };
  refreshDomestic(w);
  w.intl.objective = objectiveFor(w, nation);
  w.userClubId = NT(nation);
  const rng = createRng((w.seed ^ hashSeed(`intl-setup:${nation}`)) >>> 0);
  buildNationTeam(w, nation, squadSize(w), rng);
  w.clubs[NT(nation)].squad = autoCallUp(w);
  // 감독 경력: 처음부터 이 나라 대표팀 (명예의 전당 · 감독 기록)
  ensureManager(w).history = [{ club: NT(nation), from: w.date, to: null }];
  w.clubs[NT(nation)].reputation = Math.round(Math.max(50, Math.min(97, 60 + (teamStrength(w, nation) - 65) * 1.6)));
  intlSeasonStart(w);
}

/** 시즌 전환 뒤: 상대 대표팀 정리 · 새 주기면 국내파 · 목표 · 기록, 내 명단 다시 확인 · 새 일정 */
export function intlNextSeason(w: World, prevStage?: IntlStage) {
  const it = w.intl!;
  for (const id of it.temp.clubs) if (id !== NT(it.nation)) delete w.clubs[id];
  for (const id of it.temp.fillers) delete w.players[id];
  it.temp = { clubs: [], fillers: [] };
  if (prevStage) {
    it.history.push({ year: it.cycle, stage: prevStage, objective: it.objective });
    // 협회 평가: 목표보다 2단계 이상 낮으면 경질, 2단계 이상 높으면 더 큰 나라 제안
    const gap = stageRank(prevStage) - stageRank(it.objective);
    if (gap <= -2) it.job = { reason: 'sacked', offers: jobOffers(w, 'down'), stage: prevStage, objective: it.objective };
    else if (gap >= 2) it.job = { reason: 'offer', offers: jobOffers(w, 'up'), stage: prevStage, objective: it.objective };
    it.cycle += 4;
    refreshDomestic(w);
    it.objective = objectiveFor(w, it.nation);
  }
  const mine = w.clubs[NT(it.nation)];
  // 은퇴 · 국적 외 선수 빼고, 모자라면 자동으로 채움
  const pool = new Set(callUpPool(w).map((p) => p.id));
  mine.squad = mine.squad.filter((id) => pool.has(id));
  if (mine.squad.length < squadSize(w)) { const auto = autoCallUp(w); for (const id of auto) { if (mine.squad.length >= squadSize(w)) break; if (!mine.squad.includes(id)) mine.squad.push(id); } }
  intlSeasonStart(w);
}

export { r1 };

/** 감독 제안 나라: 경질이면 전력이 비슷하거나 약간 낮은 나라 3곳, 제안이면 더 강한 나라 2곳 */
export function jobOffers(w: World, dir: 'up' | 'down'): string[] {
  const me = w.intl!.nation;
  const ranked = ALL_NATIONS.filter((n) => n !== me).map((n) => [n, strengthOf(w, n)] as const).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const myRank = ALL_NATIONS.map((n) => [n, strengthOf(w, n)] as const).sort((a, b) => b[1] - a[1]).findIndex(([n]) => n === me);
  const rng = createRng((w.seed ^ hashSeed(`job:${w.season}:${me}:${dir}`)) >>> 0);
  const band = dir === 'down' ? ranked.slice(Math.max(0, myRank + 2), myRank + 30) : ranked.slice(Math.max(0, myRank - 16), Math.max(1, myRank - 1));
  const out: string[] = [];
  const pool = band.length ? band : ranked.slice(0, 20);
  for (let i = 0; i < 40 && out.length < (dir === 'down' ? 3 : 2); i++) { const n = rng.pick(pool); if (!out.includes(n)) out.push(n); }
  return out;
}

/** 다른 나라 대표팀으로 옮기기 (경질 · 제안 수락) */
export function switchNation(w: World, nation: string) {
  const it = w.intl!;
  const old = NT(it.nation);
  it.temp.clubs.push(old);
  it.nation = nation;
  it.job = undefined;
  refreshDomestic(w);
  it.objective = objectiveFor(w, nation);
  const rng = createRng((w.seed ^ hashSeed(`switch:${w.season}:${nation}`)) >>> 0);
  buildNationTeam(w, nation, squadSize(w), rng);
  w.clubs[NT(nation)].squad = autoCallUp(w);
  w.userClubId = NT(nation);
  const mg = ensureManager(w);
  const cur = mg.history.find((h) => h.to === null);
  if (cur) cur.to = w.date;
  mg.history.push({ club: NT(nation), from: w.date, to: null });
  intlSeasonStart(w);
}
