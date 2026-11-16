// 실제 월드컵 명단 (data/worldcups/squads.json, 파이프라인 wcsquads): 본선 대표 선발 · 월드컵 모드 국내파
//  - 게임에 이미 있는 선수는 그 선수 (id), 없는 선수는 실명으로 만든다 (능력은 소속 리그 수준 · A매치 출전 · 나이로 추정)
//  - 만든 선수는 retired · intlOnly 표시 → 이적 · 자유계약 · 시즌 처리 등 클럽 일에서 빠지고 대표팀에서만 뛴다
//  - 명단 데이터는 store 가 불러 넣는다 (세이브에는 없음)
import type { PlayerState, World } from './types';
import type { Position } from '../data/types';
import { createRng, hashSeed } from './rng';
import { makeAttrs } from './youth';
import { newPlayer } from './world';

export interface WcSquadRow { id?: string; wc?: string; name: string; birth: string | null; pos: string; no: number | null; caps: number; goals: number; clubnat: string; club?: string }
export type WcSquads = Record<string, Record<string, WcSquadRow[]>>;
let SQUADS: WcSquads = {};
export const setWcSquads = (s: WcSquads | undefined) => { SQUADS = s ?? {}; };
export const wcSquadsOf = (year: number, nation: string): WcSquadRow[] | undefined => SQUADS[String(year)]?.[nation];
export const hasWcSquads = () => Object.keys(SQUADS).length > 0;

const TIER: [number, string[]][] = [
  [72, ['ENG', 'ESP', 'GER', 'ITA', 'FRA']],
  [69, ['NED', 'POR', 'BEL', 'TUR', 'RUS', 'BRA', 'ARG', 'MEX', 'UKR', 'SCO', 'GRE', 'KSA']],
  [65, ['USA', 'JPN', 'KOR', 'QAT', 'UAE', 'CHN', 'SUI', 'AUT', 'DEN', 'SWE', 'NOR', 'CZE', 'CRO', 'SRB', 'POL', 'ROU', 'COL', 'URU', 'CHI', 'EGY', 'ISR', 'CYP', 'IRN', 'PAR', 'ECU', 'RSA', 'TUN', 'MAR', 'ALG', 'CAN', 'AUS']],
];
const tierOf = (clubnat: string) => TIER.find(([, xs]) => xs.includes(clubnat))?.[0] ?? 61;
const POS_OF: Record<string, Position[]> = { GK: ['GK'], DF: ['CB', 'CB', 'LB', 'RB'], MF: ['CM', 'CM', 'DM', 'AM', 'LM', 'RM'], FW: ['ST', 'ST', 'LW', 'RW'] };

/** 게임에 없는 실제 명단 선수의 능력: 소속 리그 수준 + A매치 출전 + 나이 */
export function estimateOvr(row: WcSquadRow, year: number): number {
  const age = row.birth ? year - +row.birth.slice(0, 4) : 27;
  const ageAdj = age < 21 ? -3 : age <= 24 ? -1 : age <= 30 ? 1 : age <= 33 ? -1 : -3;
  return Math.max(50, Math.min(84, Math.round(tierOf(row.clubnat) + (Math.min(row.caps, 80) / 80) * 6 + ageAdj)));
}

/** 실제 명단 한 줄 → 선수 (게임에 있으면 그 선수, 없으면 실명 대표 전용 선수를 만든다) */
export function playerFromRow(w: World, row: WcSquadRow, nation: string, year: number): PlayerState {
  const id = row.id ?? row.wc!;
  const have = w.players[id];
  if (have) return have;
  const rng = createRng((w.seed ^ hashSeed(`wcp:${id}`)) >>> 0);
  const g = row.pos in POS_OF ? row.pos : 'MF';
  const pos = rng.pick(POS_OF[g]);
  const p = newPlayer({
    id, name: row.name, birth: row.birth ?? `${year - 27}-06-15`, nation, height: null, foot: null, number: row.no, pos,
    attrs: makeAttrs(estimateOvr(row, year), pos, rng), wage: 0, contract: null,
  }, null, w.seed);
  p.retired = true;
  p.intlOnly = true;
  w.players[id] = p;
  return p;
}
