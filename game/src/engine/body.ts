// 키 · 몸무게 · 체형: 실제 데이터의 키 · 몸무게 (파이프라인 weights, Wikidata) + 그 시즌 능력치(몸싸움 · 속도)로 체형을 정한다
//  - 키는 데이터에 있으면 그 값 (실제 선수), 없으면 포지션 · 공중볼 · 몸싸움으로 추정 (선수마다 고정)
//  - 체형은 시즌마다 능력치가 바뀌면 함께 바뀐다 (벌크업 · 나이 들며 느려짐 등). 바뀐 시즌에는 bodyChange 로 표시
//  - 경기 (match.ts): 키는 공중볼 경합 · 세트피스에, 체형 · 속도 · 몸싸움 차이는 수비 실책 (뒷공간 · 몸싸움 · 공중볼)에 쓰인다
import type { PlayerState } from './types';
import { attr } from './ratings';

export type BodyType = 'tower' | 'lanky' | 'pocket' | 'stocky' | 'power' | 'lean' | 'normal';

export const BODY: Record<BodyType, { ko: string; how: string }> = {
  tower: { ko: '장신 타깃형', how: '키가 크고 힘이 좋아 공중볼 · 세트피스에서 강합니다. 빠른 선수에게 뒷공간을 내주기 쉽습니다' },
  lanky: { ko: '호리호리한 장신', how: '키는 크지만 몸이 가벼워 공중볼은 좋고 몸싸움에서는 밀리기 쉽습니다' },
  pocket: { ko: '단신 날쌘형', how: '작고 빨라 뒷공간 · 돌파에 강합니다. 공중볼 경합은 불리합니다' },
  stocky: { ko: '다부진 체격', how: '키는 크지 않지만 무게중심이 낮고 힘이 좋아 몸싸움에서 잘 버팁니다' },
  power: { ko: '근육질', how: '힘이 아주 좋아 몸싸움에서 강합니다. 체력 소모가 조금 큽니다' },
  lean: { ko: '날렵형', how: '가볍고 빨라 속도 싸움에 강하고, 힘 좋은 상대에게는 밀릴 수 있습니다' },
  normal: { ko: '표준 체형', how: '눈에 띄는 장단점이 없는 균형 잡힌 몸입니다' },
};

/** 선수마다 고정된 0~1 값 (키 추정 흔들림) */
function frac(id: string): number {
  let h = 2166136261;
  for (const ch of id + '|h') { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

const POS_H: Record<string, number> = { GK: 189, CB: 187, LB: 178, RB: 178, LWB: 177, RWB: 177, DM: 181, CM: 179, AM: 176, LM: 176, RM: 176, LW: 175, RW: 175, ST: 182 };

/** 키 (cm): 데이터 값, 없으면 추정 */
export function heightOf(p: PlayerState): number {
  if (p.height && p.height > 150) return p.height;
  const est = (POS_H[p.pos] ?? 180) + ((p.base.aer ?? 60) - 65) * 0.22 + ((p.base.str ?? 60) - 65) * 0.08 + (frac(p.id) - 0.5) * 8;
  return Math.round(Math.max(163, Math.min(202, est)));
}

/** 체질량 지수 (몸무게 데이터가 있을 때만) */
export const bmiOf = (p: PlayerState): number | null => (p.weight && p.weight > 40 ? p.weight / (heightOf(p) / 100) ** 2 : null);

/** 그 시즌 체형: 키 + 몸무게 (있으면, 실제 데이터) + 지금 능력치 (몸싸움 · 속도, 시즌마다 바뀜) */
export function bodyType(p: PlayerState): BodyType {
  const h = heightOf(p), str = attr(p, 'str'), pac = attr(p, 'pac'), bmi = bmiOf(p);
  // 몸무게가 있으면 실제 체격으로, 없으면 몸싸움 능력치로 무겁다 · 가볍다를 정한다
  const heavy = bmi != null ? bmi >= 24.3 : str >= 80;
  const light = bmi != null ? bmi < 22 : str < 66;
  if (h >= 190 && (heavy || str >= 74)) return 'tower';
  if (h >= 188 && light) return 'lanky';
  if (h <= 174 && pac >= 76) return 'pocket';
  if (h <= 180 && heavy && str >= 70) return 'stocky';
  if (heavy && str >= 76) return 'power';
  if (pac >= 84 && (light || str < 70)) return 'lean';
  return 'normal';
}

/** 경기용 신체 값: 공중 경합에서 키 보정 (183cm 기준, 1cm 당 0.6%, 0.88 ~ 1.12) */
export const heightAirMul = (p: PlayerState) => Math.max(0.88, Math.min(1.12, 1 + (heightOf(p) - 183) * 0.006));
/** 체력 소모 배율 (근육질은 조금 더) */
export const bodyTireMul = (p: PlayerState) => (bodyType(p) === 'power' ? 1.05 : 1);
