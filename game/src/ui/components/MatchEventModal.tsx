// 경기 중 사건 (세계 대회 모드): 하프타임 연설 · 통증 호소 · 페널티 (키커 · 방향 / 골키퍼 방향) · 막판 선택
import { useState } from 'react';
import type { MatchEvent } from '../../engine/matchEvents';
import type { PlayerState } from '../../engine/types';
import { kickChance } from '../../engine/shootoutSeq';
import { playerKo } from '../../data/db';
import { useGame } from '../../store/game';

export function MatchEventModal({ ev, players }: { ev: MatchEvent; players: Record<string, PlayerState> }) {
  const { resolveEvent, closeEvent } = useGame();
  const [taker, setTaker] = useState(ev.takers?.[0]);
  const name = (id: string) => playerKo(id, players[id]?.name ?? id);
  const tone = ev.kind === 'penAgainst' || ev.kind === 'knock' ? 'border-amber/60' : 'border-neon/60';
  return (
    <div className="fixed inset-0 z-50 grid animate-[fade_0.2s_ease-out] place-items-end bg-ink-950/70 p-3 backdrop-blur-sm sm:place-items-center">
      <div className={`panel w-full max-w-[460px] border ${tone} px-5 py-5`}>
        <div className="flex items-baseline justify-between">
          <div className="text-[18px] font-semibold">{ev.title}</div>
          <div className="tnum text-[12px] text-lo">{ev.minute}'</div>
        </div>
        <div className="mt-1 text-[13px] leading-relaxed text-mid">
          {ev.player && ev.kind === 'knock' && <b className="text-hi">{name(ev.player)} · </b>}
          {ev.player && ev.kind === 'penAgainst' && <span>키커 <b className="text-hi">{name(ev.player)}</b> · </span>}
          {ev.body}
        </div>
        {ev.result ? (
          <>
            <div className={`mt-4 rounded-lg px-4 py-3 text-[15px] font-semibold ${ev.good ? 'bg-neon/10 text-neon' : 'bg-red/10 text-red'}`}>{ev.result}</div>
            <button onClick={closeEvent} className="mt-4 h-12 w-full rounded-lg bg-neon text-[15px] font-semibold text-ink-950 hover:bg-[#5bff3d]">계속</button>
          </>
        ) : (
          <>
            {ev.kind === 'penFor' && ev.takers && (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] text-lo">키커</div>
                <div className="grid gap-1.5">
                  {ev.takers.map((id) => (
                    <button key={id} onClick={() => setTaker(id)} className={`flex h-10 items-center justify-between rounded-lg px-3 text-[13px] ${taker === id ? 'bg-neon-ghost font-semibold text-hi ring-1 ring-neon/50' : 'bg-ink-850 text-mid ring-1 ring-line'}`}>
                      <span>{name(id)} <span className="text-[11px] text-lo">{players[id]?.pos}</span></span>
                      <span className="tnum text-[11px] text-lo">성공률 {Math.round(kickChance(players[id], undefined) * 100)}%</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 mb-1.5 text-[11px] text-lo">방향</div>
              </div>
            )}
            {ev.kind === 'penAgainst' && <div className="mt-3 mb-1.5 text-[11px] text-lo">우리 골키퍼가 몸을 날릴 방향</div>}
            <div className={`mt-2 grid gap-2 ${ev.choices.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {ev.choices.map((c) => (
                <button key={c.k} onClick={() => resolveEvent(c.k, taker)} className="flex min-h-14 flex-col items-center justify-center rounded-lg bg-ink-700 px-2 py-2 text-[14px] font-semibold text-hi hover:bg-ink-750">
                  {c.label}{c.hint && <span className="mt-0.5 text-[10px] font-normal text-lo">{c.hint}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
