// 유스 아카데미 (내 구단): 1군 밖에서 유망주를 키우고, 감독이 승격 · 방출을 정한다
//  - 매 시즌 시작 (7월 1일 · 새 게임)에 15~17세 유망주 3명 (+ 유스 시설 4단계 1명 · 5단계 1명) 입단. 실제 데이터 시즌에도 (가상 선수)
//  - 아카데미 선수는 w.players 밖 (w.academy) 에 있어 선수단 인원 · 주급 · 재정 규정 · 다른 구단 영입과 무관하다
//  - 매달 1일 훈련(8월~5월) 때 잠재력을 향해 자란다: 21세 무렵 잠재력에 닿는 속도 × 유스 시설 × 프로의식 (+ 흔들림)
//  - 잠재력은 범위로만 보인다: 유스 시설이 좋고 아카데미에 오래 있을수록 좁아진다 (진짜 값은 범위 안)
//  - 1군 승격: 3년 유스 계약 (능력 기준 주급의 60%), 선수단 최대 인원 안에서만. 방출: 바로 떠남
//  - 19세가 된 시즌 시작에 승격하지 않은 선수는 아카데미를 떠난다 (받은편지함 알림)
//  - 감독이 다른 구단으로 옮기면 새 구단 아카데미로 (예전 구단 선수는 두고 감)
import type { AttrKey, Position } from '../data/types';
import type { PlayerState, World } from './types';
import { createRng, hashSeed, type Rng } from './rng';
import { newPlayer } from './world';
import { overall } from './ratings';
import { ageOn } from './condition';
import { facilityLevel } from './facilities';
import { makeAttrs, namePools, pickName, rollPotential } from './youth';
import { wageForAbility } from './transfer';
import { withinRules } from './rules';

export interface AcademyState { club: string; players: PlayerState[]; months?: Record<string, number> }

export const ACADEMY_LEAVE_AGE = 19;
export const ACADEMY_MAX = 12;
const POS: [Position, number][] = [['GK', 8], ['CB', 16], ['LB', 7], ['RB', 7], ['DM', 8], ['CM', 14], ['AM', 8], ['LW', 8], ['RW', 8], ['ST', 16]];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 내 구단 아카데미 (감독이 구단을 옮겼으면 새로) */
export function academyOf(w: World): AcademyState {
  if (!w.academy || w.academy.club !== w.userClubId) w.academy = { club: w.userClubId, players: [], months: {} };
  return w.academy;
}
export const academyOn = (w: World) => !w.intl && !!w.clubs[w.userClubId];

/** 시즌 시작: 19세 이상 떠남 → 새 유망주 입단 */
export function academySeason(w: World, season: string): { joined: string[]; left: string[] } {
  if (!academyOn(w)) return { joined: [], left: [] };
  const ac = academyOf(w);
  const start = `${season.slice(0, 4)}-07-01`;
  const left = ac.players.filter((p) => ageOn(p.birth, start) >= ACADEMY_LEAVE_AGE);
  ac.players = ac.players.filter((p) => !left.includes(p));
  const club = w.clubs[w.userClubId];
  const rng = createRng((w.seed ^ hashSeed(`academy:${season}:${club.id}`)) >>> 0);
  const youth = facilityLevel(club, 'youth');
  const n = Math.min(ACADEMY_MAX - ac.players.length, 3 + (youth >= 4 ? 1 : 0) + (youth >= 5 ? 1 : 0));
  const joined: PlayerState[] = [];
  const pools = namePools(w);
  const nats = club.squad.map((id) => w.players[id]?.nation).filter(Boolean) as string[];
  const home = w.myClub?.nation ?? (nats.length ? mostCommon(nats) : 'ENG');
  const y = +season.slice(0, 4);
  for (let i = 0; i < n; i++) {
    const pos = rng.weighted(POS, ([, wt]) => wt)[0];
    const potential = rollPotential(club.reputation, rng, youth);
    const age = rng.int(15, 17);
    const ovr = clamp(potential - rng.int(18, 32) + (age - 15) * 2, 35, 62);
    // 국적: 대부분 구단 나라 (70%), 나머지는 선수단 국적에서
    let nation = rng.chance(0.7) || !nats.length ? home : rng.pick(nats);
    if ((pools.get(nation)?.last.length ?? 0) < 5) nation = nats.find((x) => (pools.get(x)?.last.length ?? 0) >= 5) ?? nation;
    const pool = pools.get(nation);
    const nm = pool ? pickName(pool, rng, new Set(ac.players.map((p) => p.name))) : { name: `Youth ${i + 1}`, nameFrom: [null, ''] as [string | null, string] };
    let id = `aca-${season}-${club.id}-${i}`;
    for (let k = 2; w.players[id] || ac.players.some((p) => p.id === id); k++) id = `aca-${season}-${club.id}-${i}-${k}`;
    const p = newPlayer({ id, name: nm.name, birth: birthFor(y, age, rng), nation, height: null, foot: null, number: null, pos, attrs: makeAttrs(ovr, pos, rng), wage: 0, contract: null }, club.id, w.seed);
    p.generated = true;
    p.potential = potential;
    p.nameFrom = [nm.nameFrom[0], nm.nameFrom[1] || null];
    p.sharpness = 40;
    joined.push(p);
  }
  ac.players.push(...joined);
  for (const p of joined) (ac.months ??= {})[p.id] = 0;
  if (joined.length || left.length) {
    const star = [...joined].sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))[0];
    w.inbox.push({ type: 'academy', date: start, joined: joined.map((p) => p.id), left: left.map((p) => p.ko ?? p.name), ...(star && (star.potential ?? 0) >= 80 ? { star: star.id } : {}) });
  }
  return { joined: joined.map((p) => p.id), left: left.map((p) => p.id) };
}
/** 7월 1일 기준 나이가 정확히 age 가 되는 생일 */
function birthFor(y: number, age: number, rng: Rng): string {
  const late = rng.chance(0.5);   // 7~12월생이면 한 해 앞
  const m = late ? rng.int(7, 12) : rng.int(1, 6);
  return `${late ? y - age - 1 : y - age}-${String(m).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
}
function mostCommon(xs: string[]): string {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** 매달 훈련 (training.ts): 잠재력을 향해 */
export function academyMonth(w: World, rng: Rng) {
  if (!academyOn(w) || !w.academy || w.academy.club !== w.userClubId) return;
  const club = w.clubs[w.userClubId];
  const fac = 1 + (facilityLevel(club, 'youth') - 3) * 0.12;
  for (const p of w.academy.players) {
    const age = ageOn(p.birth, w.date);
    const gap = (p.potential ?? overall(p)) - overall(p);
    (w.academy.months ??= {})[p.id] = (w.academy.months[p.id] ?? 0) + 1;
    p.dev = 0;
    if (gap <= 0) continue;
    const months = Math.max(4, (21 - age) * 10);
    const step = (gap / months) * fac * (0.8 + p.hidden.professionalism / 50) * 1.15 + rng.normal() * 0.15;
    p.dev = Math.round(step * 100) / 100;
    for (const k of Object.keys(p.base) as AttrKey[]) p.base[k] = clamp(Math.round(((p.base[k] ?? 40) + step) * 100) / 100, 15, 97);
  }
}

/** 보이는 잠재력 범위: 유스 시설 · 아카데미에 있던 달 수에 따라 좁아짐 */
export function potentialRange(w: World, p: PlayerState): [number, number] {
  const pot = p.potential ?? overall(p);
  const level = facilityLevel(w.clubs[w.userClubId], 'youth');
  const months = w.academy?.months?.[p.id] ?? 0;
  const span = Math.max(2, Math.round(18 - level * 2 - months * 0.35));
  let h = 2166136261;
  for (const ch of p.id + '|pot') { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const lo = Math.max(40, pot - Math.round((((h >>> 0) % 1000) / 1000) * span));
  return [lo, Math.min(99, lo + span)];
}
export const potentialGrade = (v: number) => (v >= 86 ? 'S' : v >= 80 ? 'A' : v >= 74 ? 'B' : v >= 68 ? 'C' : 'D');

/** 1군 승격 */
export function promote(w: World, id: string, maxSquad: number): { ok: boolean; reason: string } {
  const ac = academyOf(w);
  const p = ac.players.find((x) => x.id === id);
  if (!p) return { ok: false, reason: '아카데미에 없는 선수입니다' };
  const club = w.clubs[w.userClubId];
  if (club.squad.length >= maxSquad) return { ok: false, reason: `선수단이 가득 찼습니다 (최대 ${maxSquad}명). 먼저 선수를 정리하세요` };
  const ovr = overall(p);
  const wage = Math.max(500, Math.round((wageForAbility(w, ovr) * 0.6) / 500) * 500);
  const rule = withinRules(w, club.id, wage);
  if (!rule.ok) return { ok: false, reason: rule.reason ?? '재정 규정 때문에 계약할 수 없습니다' };
  const y = +w.season.slice(0, 4);
  p.clubId = club.id;
  p.wage = wage;
  p.contract = `${y + 3}-06-30`;
  p.contractGen = undefined;
  p.sharpness = 50;
  w.players[p.id] = p;
  club.squad.push(p.id);
  ac.players = ac.players.filter((x) => x !== p);
  return { ok: true, reason: `1군으로 승격 · 3년 유스 계약 (주급 ${Math.round(wage / 100) / 10}K)` };
}
export function releaseAcademy(w: World, id: string) {
  const ac = academyOf(w);
  ac.players = ac.players.filter((x) => x.id !== id);
}
