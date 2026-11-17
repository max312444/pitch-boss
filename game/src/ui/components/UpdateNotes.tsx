// 첫 화면 '업데이트 소식': 새 버전을 처음 본 뒤 24시간 동안 표시, 그 뒤 자동으로 사라짐
//  여러 버전을 건너뛰었으면 마지막으로 본 버전 이후 내역을 모두 보여 준다. 이 브라우저에만 기록 (localStorage)
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CHANGELOG, changesSince, GAME_VERSION, type ChangeEntry } from '../../version';

const KEY = 'pitchboss.update';
const DAY = 24 * 60 * 60 * 1000;
interface Seen { v: string; from: string | null; at: number }

function notesToShow(): ChangeEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const seen: Seen | null = raw ? JSON.parse(raw) : null;
    const now = Date.now();
    if (!seen || seen.v !== GAME_VERSION) {
      const next: Seen = { v: GAME_VERSION, from: seen?.v ?? null, at: now };
      localStorage.setItem(KEY, JSON.stringify(next));
      return changesSince(next.from);
    }
    return now - seen.at < DAY ? changesSince(seen.from) : [];
  } catch { return []; }
}
function dismiss() {
  try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(raw), at: 0 })); } catch { /* 무시 */ }
}

/** 전체 업데이트 내역 (설정 창 '업데이트 내역' 탭): 최신이 위, 지금 버전 표시 */
export function ChangelogList() {
  return (
    <div className="space-y-5">
      {CHANGELOG.map((e) => (
        <div key={e.version}>
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="tnum text-[15px] font-semibold">v{e.version}</span>
            <span className="tnum text-[11px] text-lo">{e.date.replace(/-/g, '.')}</span>
            {e.version === GAME_VERSION && <span className="rounded bg-neon-ghost px-1.5 py-px text-[11px] font-semibold text-neon">지금 버전</span>}
          </div>
          <ul className="space-y-1 text-[13px] leading-relaxed text-mid">
            {e.items.map((t) => <li key={t} className="flex gap-2"><span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-neon/70" />{t}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** inline: 휴대폰 첫 화면에서 메뉴 아래 흐름 안에 */
export function UpdateNotes({ inline }: { inline?: boolean }) {
  const [list, setList] = useState(notesToShow);
  if (!list.length) return null;
  return (
    <aside className={inline ? 'mb-6 rounded-xl border border-line bg-ink-900/90 p-5 sm:hidden' : 'absolute top-8 right-8 z-20 hidden w-[360px] animate-[fade_0.4s_ease-out] rounded-xl border border-line bg-ink-900/90 p-5 backdrop-blur-sm sm:block'}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-neon">업데이트 소식</span>
        <button onClick={() => { dismiss(); setList([]); }} className="text-[11px] text-lo hover:text-hi">닫기</button>
      </div>
      <div className={inline ? 'space-y-4' : 'max-h-[420px] space-y-4 overflow-auto pr-1'}>
        {list.map((e) => (
          <div key={e.version}>
            <div className="mb-1.5 flex items-baseline gap-2"><span className="tnum text-[14px] font-semibold">v{e.version}</span><span className="tnum text-[11px] text-lo">{e.date.replace(/-/g, '.')}</span></div>
            <ul className="space-y-1 text-[12px] leading-relaxed text-mid">
              {e.items.map((t) => <li key={t} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-neon/70" />{t}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-lo">하루가 지나면 자동으로 사라집니다</div>
    </aside>
  );
}

/** 휴대폰 첫 화면: 내역을 펼쳐 두지 않고 위쪽 한 줄 바 → 누르면 내역 창 (바로 게임할 수 있게) */
export function UpdateBar() {
  const [list, setList] = useState(notesToShow);
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const close = () => { dismiss(); setList([]); setOpen(false); };
  return (
    <>
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-line bg-ink-900/90 py-1 pr-1 pl-3 text-[12px] sm:hidden">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon" />
        <button onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left">
          <span className="font-semibold text-neon">업데이트 v{list[0].version}</span>
          <span className="truncate text-lo">· 새 소식 {list.reduce((n, e) => n + e.items.length, 0)}개</span>
          <span className="ml-auto shrink-0 text-mid">보기 ›</span>
        </button>
        <button onClick={close} aria-label="업데이트 알림 닫기" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-lo hover:text-hi">✕</button>
      </div>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex animate-[fade_0.2s_ease-out] items-end bg-ink-950/80 backdrop-blur-sm sm:hidden" onClick={() => setOpen(false)}>
          <div className="panel flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-b-none pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
              <span className="text-[14px] font-semibold">업데이트 소식</span>
              <button onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-[13px] text-mid ring-1 ring-line">닫기</button>
            </div>
            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
              {list.map((e) => (
                <div key={e.version}>
                  <div className="mb-1.5 flex items-baseline gap-2"><span className="tnum text-[14px] font-semibold">v{e.version}</span><span className="tnum text-[11px] text-lo">{e.date.replace(/-/g, '.')}</span></div>
                  <ul className="space-y-1 text-[12px] leading-relaxed text-mid">
                    {e.items.map((t) => <li key={t} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-neon/70" />{t}</li>)}
                  </ul>
                </div>
              ))}
              <div className="text-[11px] text-lo">전체 내역은 설정 → 업데이트 내역에서 볼 수 있습니다</div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
