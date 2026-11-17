// 저장 슬롯 목록 (저장하기 · 불러오기 공용)
import { useEffect, useState } from 'react';
import { deleteSave, listSaves, SLOTS, type SaveMeta } from '../../store/save';
import { clubKo, realAvailable } from '../../data/db';
import { useGame } from '../../store/game';
import { Crest } from './Crest';

const SLOT_NAME: Record<string, string> = { auto: '자동 저장', 'slot-1': '슬롯 1', 'slot-2': '슬롯 2', 'slot-3': '슬롯 3' };
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function SaveSlots({ mode, onPick, refreshKey = 0 }: { mode: 'save' | 'load'; onPick: (slot: string) => void | Promise<void>; refreshKey?: number }) {
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = () => listSaves().then(setSaves).catch(() => setSaves([]));
  useEffect(() => { void reload(); }, [refreshKey]);

  const slots = mode === 'save' ? SLOTS.filter((s) => s !== 'auto') : SLOTS;
  return (
    <div className="divide-y divide-line">
      {slots.map((slot) => {
        const m = saves?.find((s) => s.slot === slot);
        const disabled = mode === 'load' && !m;
        return (
          <div key={slot} className="flex items-center gap-4 px-5 py-3">
            <button disabled={disabled || !!busy} onClick={async () => { setBusy(slot); await onPick(slot); setBusy(null); void reload(); }}
              className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-1 text-left transition-colors enabled:hover:bg-ink-800 disabled:opacity-50">
              {m ? <Crest clubId={m.clubId} size={28} /> : <div className="h-8 w-7 rounded-md border border-dashed border-line-strong" />}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{SLOT_NAME[slot]}{busy === slot && <span className="ml-2 text-lo">{mode === 'save' ? '저장 중…' : '불러오는 중…'}</span>}</div>
                <div className="truncate text-[12px] text-lo">
                  {m ? `${clubKo(m.clubId)} · ${m.season.replace('-', '/')} · ${m.date.slice(5).replace('-', '.')} · 저장 ${when(m.savedAt)}` : mode === 'save' ? '비어 있음 · 눌러서 저장' : '비어 있음'}
                </div>
              </div>
            </button>
            {m && mode === 'load' && m.dataset === 'public' && realAvailable && (
              <button onClick={() => { if (confirm('이 세이브를 실명 데이터로 바꿀까요?\n선수 · 구단이 실제 이름으로 바뀌고, 앞으로도 실명 데이터로 이어집니다 (패러디로 되돌릴 수 없음).')) useGame.getState().convertToReal(slot); }}
                title="패러디 이름으로 하던 게임을 실명으로" className="shrink-0 rounded-md px-2 py-1 text-[12px] text-neon ring-1 ring-line transition-colors hover:bg-neon-ghost">실명 전환</button>
            )}
            {m && slot !== 'auto' && mode === 'load' && (
              <button onClick={async () => { await deleteSave(slot); void reload(); }} className="text-[12px] text-lo transition-colors hover:text-red">삭제</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
