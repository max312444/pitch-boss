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

// ── 짧은 저장 형식 (v2.18.2): 같은 이름표가 수만 번 되풀이되는 칸을 이름표 없는 목록으로 ──────────
//  원래 값은 절대 목록이 아니므로 (객체 · 숫자) 목록이면 짧은 형식이라고 알아본다. 모양이 다르면 그대로 둔다 (정확히 되살리기)
const HIDDEN = ['consistency', 'bigMatch', 'professionalism', 'injuryProne', 'adaptability', 'ambition', 'temperament', 'loyalty'] as const;
const STATS = ['apps', 'subApps', 'goals', 'assists', 'yellow', 'red', 'cleanSheets', 'ratingSum'] as const;   // + pom (있으면 9번째)
const ATTRS = ['sho', 'pas', 'dri', 'tac', 'pos', 'aer', 'pac', 'sta', 'str', 'vis', 'com', 'ldr', 'ref', 'han', 'one'] as const;
const CAREER = ['season', 'club', 'apps', 'goals', 'assists', 'rating'] as const;      // + cupApps, cupGoals (둘 다 있을 때)
/** 기본값이면 저장하지 않는 칸 (불러올 때 채움). 이 칸을 뺀 선수에는 표시 z: 1 */
const DEFAULTS = { suspension: 0, yellowCount: 0, benchStreak: 0, injury: null } as const;

type Obj = Record<string, unknown>;
const sameKeys = (o: Obj, keys: readonly string[]) => { const k = Object.keys(o); return k.length === keys.length && keys.every((x) => typeof o[x] === 'number'); };

function packFixed(o: unknown, keys: readonly string[], extra?: string): unknown {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const v = o as Obj;
  if (sameKeys(v, keys)) return keys.map((k) => v[k]);
  if (extra && typeof v[extra] === 'number' && sameKeys(v, [...keys, extra])) return [...keys, extra].map((k) => v[k]);
  return o;
}
function unpackFixed(a: unknown, keys: readonly string[], extra?: string): unknown {
  if (!Array.isArray(a)) return a;
  const all = extra ? [...keys, extra] : keys;
  return Object.fromEntries(a.map((x, i) => [all[i], x]));
}
/** 능력치 · 성장: ['칸 순서 글자', 값…] — 칸마다 한 글자 (a = sho …). 칸 순서를 그대로 지킨다
 *  (시즌 노화 ageAttributes 등이 칸 순서대로 난수를 뽑으므로, 순서가 바뀌면 불러온 게임의 결과가 달라짐) */
function packAttrs(o: unknown): unknown {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const e = Object.entries(o as Obj);
  if (!e.length || !e.every(([k, x]) => (ATTRS as readonly string[]).includes(k) && typeof x === 'number')) return o;
  return [e.map(([k]) => String.fromCharCode(97 + (ATTRS as readonly string[]).indexOf(k))).join(''), ...e.map(([, x]) => x)];
}
function unpackAttrs(a: unknown): unknown {
  if (!Array.isArray(a) || typeof a[0] !== 'string') return a;
  const code = a[0] as string;
  return Object.fromEntries([...code].map((ch, i) => [ATTRS[ch.charCodeAt(0) - 97], a[i + 1]]));
}

function packCareerRow(c: Obj): unknown {
  const k = Object.keys(c);
  const base = CAREER.every((x) => x in c);
  if (base && k.length === 6) return CAREER.map((x) => c[x]);
  if (base && k.length === 8 && 'cupApps' in c && 'cupGoals' in c) return [...CAREER.map((x) => c[x]), c.cupApps, c.cupGoals];
  return c;
}
function unpackCareerRow(r: unknown): unknown {
  if (!Array.isArray(r)) return r;
  const o: Obj = Object.fromEntries(CAREER.map((x, i) => [x, r[i]]));
  if (r.length === 8) { o.cupApps = r[6]; o.cupGoals = r[7]; }
  return o;
}

/** 저장용 선수: 짧은 형식 (원본은 바꾸지 않음) */
function compactPlayer(p: Obj): Obj {
  const out: Obj = { ...p };
  if (Array.isArray(p.career)) out.career = (p.career as Obj[]).map(packCareerRow);
  out.hidden = packFixed(p.hidden, HIDDEN);
  for (const k of ['stats', 'cupStats', 'intlStats']) if (k in p) out[k] = packFixed(p[k], STATS, 'pom');
  if ('base' in p) out.base = packAttrs(p.base);
  if ('growth' in p) out.growth = packAttrs(p.growth);
  let z = false;
  for (const [k, d] of Object.entries(DEFAULTS)) if (k in out && out[k] === d) { delete out[k]; z = true; }
  if (z) out.z = 1;
  return out;
}
/** 짧은 형식 되살리기 (이미 원래 형식이면 그대로) */
function expandPlayer(p: Obj) {
  if (Array.isArray(p.career)) p.career = (p.career as unknown[]).map(unpackCareerRow);
  p.hidden = unpackFixed(p.hidden, HIDDEN);
  for (const k of ['stats', 'cupStats', 'intlStats']) if (k in p) p[k] = unpackFixed(p[k], STATS, 'pom');
  if ('base' in p) p.base = unpackAttrs(p.base);
  if ('growth' in p) p.growth = unpackAttrs(p.growth);
  if (p.z === 1) { for (const [k, d] of Object.entries(DEFAULTS)) if (!(k in p)) p[k] = d; delete p.z; }
}

/** 저장용 월드: 보관할 은퇴 선수는 가벼운 기록으로, 모든 선수는 짧은 형식으로 (원본 월드는 바꾸지 않음) */
export function packWorld(w: World): World {
  const players: Record<string, PlayerState> = {};
  for (const [id, p] of Object.entries(w.players)) {
    if (!archivable(w, p)) { players[id] = compactPlayer(p as unknown as Obj) as unknown as PlayerState; continue; }
    const slim: Obj = { ...p, archived: true };
    for (const k of DROP) delete slim[k];
    // 경력: 뛴 시즌만 · 평점은 뺀다 (불러올 때 null · 도움 없으면 0 — 예전 보관 형식과 같은 결과)
    slim.career = p.career.filter((c) => c.apps || c.cupApps).map((c) => ({ ...c, assists: c.assists ?? 0, rating: null }));
    players[id] = compactPlayer(slim) as unknown as PlayerState;
  }
  return { ...w, players };
}

/** 불러온 선수: 짧은 형식을 되살리고, 보관 기록이면 빠진 칸을 기본값으로 채운다 */
export function unpackPlayer(p: PlayerState): PlayerState {
  expandPlayer(p as unknown as Obj);
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
