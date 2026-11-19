// 휴대폰 접는 카드: 좁거나 낮은 화면에서 카드 제목을 누르면 접고 펼친다. 상태는 이 브라우저에 기억 (localStorage)
import { useEffect, useState, useSyncExternalStore } from 'react';

const QUERY = '(max-width: 767px), (max-height: 500px)';
const KEY = 'pitchboss.fold';

function subscribe(cb: () => void) {
  if (typeof matchMedia === 'undefined') return () => {};
  const m = matchMedia(QUERY);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}
/** 휴대폰처럼 좁거나 낮은 화면 */
export const useCompact = () => useSyncExternalStore(subscribe, () => typeof matchMedia !== 'undefined' && matchMedia(QUERY).matches, () => false);

let saved: Record<string, boolean> | null = null;
const load = (): Record<string, boolean> => {
  if (saved) return saved;
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { saved = {}; }
  return saved ??= {};
};

/** key 카드가 펼쳐져 있는지 (처음에는 shut 이면 접힘) · 바꾸기 */
export function useFold(key: string | undefined, shut = false): [boolean, () => void] {
  const [open, setOpen] = useState(() => (key ? load()[key] ?? !shut : true));
  useEffect(() => { if (key) setOpen(load()[key] ?? !shut); }, [key, shut]);
  const toggle = () => setOpen((o) => {
    if (key) { const all = load(); all[key] = !o; try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* 무시 */ } }
    return !o;
  });
  return [open, toggle];
}
