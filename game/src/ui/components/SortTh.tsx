// 정렬되는 표 머리 · 주요 능력치 칩 (이적시장 · 선수단 · 구단 창 공용)
import type { ReactNode } from 'react';
import type { AttrKey } from '../../data/types';
import type { PlayerState, World } from '../../engine/types';
import { attr } from '../../engine/ratings';
import { knowledge, seenRange } from '../../engine/scout';
import { ATTR_KO, ratingTone } from '../format';

export interface SortState<K extends string> { k: K; desc: boolean }

/** 같은 항목을 다시 누르면 방향만 바꾸고, 새 항목은 숫자면 높은 순 · 글자면 가나다 순부터 */
export const nextSort = <K extends string>(cur: SortState<K>, k: K, ascFirst: readonly string[]): SortState<K> =>
  cur.k === k ? { k, desc: !cur.desc } : { k, desc: !ascFirst.includes(k) };

/** 표 머리: 누르면 정렬 (▼ 높은 순 · ▲ 낮은 순), 안 고른 항목은 흐린 ↕ */
export function SortTh<K extends string>({ k, s, on, right, className = '', children, title }: { k: K; s: SortState<K>; on: (k: K) => void; right?: boolean; className?: string; children: ReactNode; title?: string }) {
  const active = s.k === k;
  return (
    <th className={`font-medium ${right ? 'text-right' : ''} ${className}`} aria-sort={active ? (s.desc ? 'descending' : 'ascending') : undefined}>
      <button onClick={() => on(k)} title={title ?? '눌러서 정렬 (다시 누르면 반대로)'} className={`tap inline-flex items-center gap-0.5 whitespace-nowrap ${active ? 'text-hi' : 'hover:text-mid'}`}>
        {children}<span className={`w-2.5 text-[9px] ${active ? 'text-neon' : 'opacity-50'}`}>{active ? (s.desc ? '▼' : '▲') : '↕'}</span>
      </button>
    </th>
  );
}

/** 휴대폰: 숨은 열이 많아 고르기 + 방향 버튼 */
export function SortPicker<K extends string>({ s, options, onPick, onFlip, className = '' }: { s: SortState<K>; options: [K, string][]; onPick: (k: K) => void; onFlip: () => void; className?: string }) {
  return (
    <div className={`flex items-center justify-end gap-2 text-[12px] text-lo ${className}`}>정렬
      <select value={s.k} onChange={(e) => onPick(e.target.value as K)} className="h-8 max-w-[150px] rounded-md border border-line bg-ink-850 px-2 text-[12px] text-hi">
        {options.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <button onClick={onFlip} className="h-8 rounded-md px-2.5 text-mid ring-1 ring-line">{s.desc ? '높은 순 ▼' : '낮은 순 ▲'}</button>
    </div>
  );
}

const GK_KEYS: AttrKey[] = ['ref', 'han', 'one', 'aer', 'pos', 'pas', 'com'];
const FIELD_KEYS: AttrKey[] = ['sho', 'pas', 'dri', 'tac', 'pos', 'aer', 'pac', 'sta', 'str', 'vis', 'com'];
/** 정렬 · 칩에 쓰는 능력치 목록 */
export const STAT_KEYS: AttrKey[] = ['sho', 'pas', 'dri', 'tac', 'pos', 'aer', 'pac', 'sta', 'str', 'vis', 'com', 'ldr', 'ref', 'han', 'one'];

/** 보이는 능력치 (스카우트 범위 가운데 값) */
export function seenAttr(w: World, p: PlayerState, k: AttrKey): number {
  if (p.base[k] == null) return 0;
  const [lo, hi] = seenRange(w, p, k, Math.round(attr(p, k)), knowledge(w, p));
  return (lo + hi) / 2;
}

/** 가장 좋은 능력치 n개 (first 를 고르면 그것을 맨 앞에) */
export function topAttrs(p: PlayerState, n = 2, first?: AttrKey): AttrKey[] {
  const keys = (p.pos === 'GK' ? GK_KEYS : FIELD_KEYS).filter((k) => p.base[k] != null);
  const best = [...keys].sort((a, b) => attr(p, b) - attr(p, a));
  const out = first && p.base[first] != null ? [first, ...best.filter((k) => k !== first)] : best;
  return out.slice(0, n);
}

/** 주요 능력치 칩: "속도 92 · 드리블 88" (스카우트를 덜 했으면 범위) */
export function TopAttrs({ w, p, first, n = 2, className = '' }: { w: World; p: PlayerState; first?: AttrKey; n?: number; className?: string }) {
  const kn = knowledge(w, p);
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {topAttrs(p, n, first).map((k) => {
        const v = Math.round(attr(p, k));
        const [lo, hi] = seenRange(w, p, k, v, kn);
        return (
          <span key={k} className={`rounded px-1 text-[11px] whitespace-nowrap ring-1 ${k === first ? 'ring-neon/50' : 'ring-line'}`}>
            <span className="text-lo">{ATTR_KO[k]}</span> <span className={`tnum font-semibold ${lo === hi ? ratingTone(v) : 'text-mid'}`}>{lo === hi ? v : `${lo}–${hi}`}</span>
          </span>
        );
      })}
    </span>
  );
}
