// 이름 바꾸기 (✎): 선수 · 구단 · 감독. 이 기기 브라우저에만 저장 (custom.ts), 비우면 원래 이름
import { useState } from 'react';
import { customName, setCustomName, type NameKind } from '../../data/custom';

export function NameEdit({ kind, id, current }: { kind: NameKind; id: string; current: string }) {
  const [open, setOpen] = useState(false);
  const c = customName(kind, id);
  const [name, setName] = useState(c?.name ?? current);
  const [short, setShort] = useState(c?.short ?? '');
  if (!open) return (
    <button onClick={(e) => { e.stopPropagation(); setName(c?.name ?? current); setShort(c?.short ?? ''); setOpen(true); }} title="이름 바꾸기 (이 기기에만 저장)"
      className="ml-1.5 inline-grid h-6 w-6 place-items-center rounded-md align-middle text-[13px] text-lo hover:bg-ink-800 hover:text-hi">✎</button>
  );
  const save = async (v: { name: string; short?: string } | null) => { await setCustomName(kind, id, v); setOpen(false); };
  return (
    <div className="mt-2 flex w-full basis-full flex-wrap items-center gap-2 rounded-lg bg-ink-900 p-2 text-[12px] ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" maxLength={40} onKeyDown={(e) => e.key === 'Enter' && save({ name, short })}
        className="h-8 min-w-0 flex-[2] rounded-md border border-line bg-ink-850 px-2 text-[13px] text-hi outline-none focus:border-line-strong" />
      {kind !== 'clubs' && <input value={short} onChange={(e) => setShort(e.target.value)} placeholder="짧은 이름 (비우면 마지막 단어)" maxLength={20}
        className="h-8 min-w-0 flex-1 rounded-md border border-line bg-ink-850 px-2 text-[13px] text-hi outline-none focus:border-line-strong" />}
      <button onClick={() => save({ name, short })} className="h-8 rounded-md bg-neon px-3 font-semibold text-ink-950">저장</button>
      {c && <button onClick={() => save(null)} className="h-8 rounded-md px-2 text-lo ring-1 ring-line hover:text-hi" title="바꾼 이름 지우기">원래대로</button>}
      <button onClick={() => setOpen(false)} className="h-8 rounded-md px-2 text-lo hover:text-hi">취소</button>
    </div>
  );
}
