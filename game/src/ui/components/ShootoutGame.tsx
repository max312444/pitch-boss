// 직접 하는 승부차기 (내 경기, 비긴 녹아웃): 키커 순서 → 내 차례는 차는 방향, 상대 차례는 골키퍼가 몸을 날릴 방향
//  결과는 engine/shootoutSeq.ts resolveKick (키커 · 골키퍼 능력 + 방향이 맞았는지)
import { useMemo, useState } from 'react';
import type { MatchState } from '../../engine/match';
import type { PlayerState, Side } from '../../engine/types';
import { aiDir, DIR_KO, DIRS, kickChance, kickOrder, resolveKick, shootoutOver, type Dir, type Kick } from '../../engine/shootoutSeq';
import { clubKo, playerKo } from '../../data/db';
import { Crest } from './Crest';

const X: Record<Dir, string> = { L: '18%', C: '50%', R: '82%' };

export function ShootoutGame({ st, side, players, onDone }: { st: MatchState; side: Side; players: Record<string, PlayerState>; onDone: (res: { home: Kick[]; away: Kick[] } | null) => void }) {
  const opp: Side = side === 'home' ? 'away' : 'home';
  const club = (s: Side) => st[s].clubId;
  const gk = (s: Side) => players[st[s].onPitch.find((o) => o.slot === 'GK')?.id ?? ''];
  const [order, setOrder] = useState(() => kickOrder(st[side].onPitch, players));
  const theirs = useMemo(() => kickOrder(st[opp].onPitch, players), [st, opp, players]);
  const [stage, setStage] = useState<'order' | 'play'>('order');
  const [kicks, setKicks] = useState<{ home: Kick[]; away: Kick[] }>({ home: [], away: [] });
  const [shown, setShown] = useState<{ side: Side; shot: Dir; dive: Dir; scored: boolean; saved: boolean; who: string } | null>(null);
  const turn: Side = kicks.home.length <= kicks.away.length ? 'home' : 'away';
  const winner = shootoutOver(kicks.home, kicks.away);
  const mine = turn === side;
  const takerOf = (s: Side) => { const list = s === side ? order : theirs; return list[kicks[s].length % list.length]; };
  const score = (s: Side) => kicks[s].filter((k) => k.scored).length;

  const play = (choice: Dir) => {
    if (shown || winner) return;
    const kid = takerOf(turn);
    const kicker = players[kid], keeper = gk(turn === 'home' ? 'away' : 'home');
    const shot = mine ? choice : aiDir(Math.random());
    const dive = mine ? aiDir(Math.random()) : choice;
    const r = resolveKick(kickChance(kicker, keeper), shot, dive, Math.random(), Math.random());
    setShown({ side: turn, shot, dive, ...r, who: kid });
    setTimeout(() => {
      setKicks((k) => ({ ...k, [turn]: [...k[turn], { id: kid, scored: r.scored, saved: r.saved }] }));
      setShown(null);
    }, 1300);
  };
  const up = (i: number) => { if (i <= 0) return; const o = [...order]; [o[i - 1], o[i]] = [o[i], o[i - 1]]; setOrder(o); };

  return (
    <div className="fixed inset-0 z-50 flex animate-[fade_0.2s_ease-out] flex-col bg-ink-950/95 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col">
        <div className="text-center text-[13px] font-semibold text-amber">승부차기</div>
        {/* 점수 */}
        <div className="mt-2 flex items-center justify-center gap-4">
          {(['home', 'away'] as Side[]).map((s, i) => (
            <div key={s} className={`flex items-center gap-2 ${i ? 'flex-row-reverse' : ''}`}>
              <Crest clubId={club(s)} size={30} />
              <div className={i ? 'text-left' : 'text-right'}>
                <div className="max-w-[110px] truncate text-[13px] font-semibold">{clubKo(club(s))}</div>
                <div className="flex gap-1">{Array.from({ length: Math.max(5, kicks[s].length) }, (_, k) => { const x = kicks[s][k]; return <span key={k} className={`h-2.5 w-2.5 rounded-full ${!x ? 'bg-ink-700' : x.scored ? 'bg-neon' : 'bg-red'}`} />; })}</div>
              </div>
              {i === 0 && <span className="led tnum text-[30px] font-semibold">{score('home')}</span>}
              {i === 1 && <span className="led tnum text-[30px] font-semibold">{score('away')}</span>}
            </div>
          ))}
        </div>

        {stage === 'order' ? (
          <div className="mt-5 flex min-h-0 flex-1 flex-col">
            <div className="text-[14px] font-semibold">키커 순서 <span className="text-[12px] font-normal text-lo">위 5명이 차례로 찹니다 (▲ 로 순서 바꾸기)</span></div>
            <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg bg-ink-900">
              {order.map((id, i) => (
                <div key={id} className={`flex items-center gap-3 px-4 py-2 text-[13px] shadow-[inset_0_-1px_0_var(--color-line)] ${i < 5 ? '' : 'opacity-60'}`}>
                  <span className="tnum w-5 text-lo">{i + 1}</span>
                  <span className="flex-1 truncate">{playerKo(id, players[id].name)} <span className="text-[11px] text-lo">{players[id].pos}</span></span>
                  <span className="tnum text-[11px] text-lo">성공률 {Math.round(kickChance(players[id], gk(opp)) * 100)}%</span>
                  <button disabled={i === 0} onClick={() => up(i)} className="h-8 w-8 rounded-md text-mid ring-1 ring-line disabled:opacity-30">▲</button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onDone(null)} className="h-12 rounded-lg px-4 text-[13px] text-lo ring-1 ring-line hover:text-hi">자동으로</button>
              <button onClick={() => setStage('play')} className="h-12 flex-1 rounded-lg bg-neon text-[15px] font-semibold text-ink-950 hover:bg-[#5bff3d]">승부차기 시작</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-1 flex-col">
            {/* 골문 */}
            <div className="relative mx-auto h-[150px] w-full max-w-[420px] overflow-hidden rounded-t-lg border-x-4 border-t-4 border-white/80 bg-[repeating-linear-gradient(90deg,#1b2a1f_0_14px,#162219_14px_28px)]">
              {shown && (
                <>
                  <div className="absolute bottom-2 h-[46px] w-[46px] -translate-x-1/2 rounded-md bg-amber/90 transition-all duration-500" style={{ left: X[shown.dive], transform: `translateX(-50%) rotate(${shown.dive === 'L' ? -40 : shown.dive === 'R' ? 40 : 0}deg)` }} />
                  <div className="absolute h-6 w-6 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_#fff] transition-all duration-500" style={{ left: shown.scored || shown.saved ? X[shown.shot] : shown.shot === 'C' ? '50%' : shown.shot === 'L' ? '-6%' : '106%', top: shown.scored ? '30%' : shown.saved ? '60%' : '-20%' }} />
                </>
              )}
            </div>
            <div className="mx-auto h-1 w-full max-w-[460px] bg-white/60" />
            <div className="mt-4 min-h-[56px] text-center">
              {shown ? (
                <div className={`text-[22px] font-semibold ${shown.scored ? (shown.side === side ? 'text-neon' : 'text-red') : shown.side === side ? 'text-red' : 'text-neon'}`}>
                  {shown.scored ? '골!' : shown.saved ? '선방!' : '실축!'}
                  <div className="text-[12px] font-normal text-lo">{playerKo(shown.who, players[shown.who].name)} → {DIR_KO[shown.shot]} · 골키퍼 {DIR_KO[shown.dive]}</div>
                </div>
              ) : winner ? (
                <div className={`text-[22px] font-semibold ${winner === side ? 'text-neon' : 'text-red'}`}>{winner === side ? '승부차기 승리!' : '승부차기 패배'}</div>
              ) : (
                <div className="text-[14px]">
                  <span className="text-lo">{mine ? '우리 키커' : '상대 키커'}</span> <b>{playerKo(takerOf(turn), players[takerOf(turn)].name)}</b>
                  <div className="mt-1 text-[13px] text-mid">{mine ? '어느 쪽으로 찰까요?' : '우리 골키퍼는 어느 쪽으로 몸을 날릴까요?'}</div>
                </div>
              )}
            </div>
            <div className="mt-auto">
              {winner && !shown ? (
                <button onClick={() => onDone(kicks)} className="h-12 w-full rounded-lg bg-neon text-[15px] font-semibold text-ink-950 hover:bg-[#5bff3d]">결과 확인</button>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {DIRS.map((d) => (
                    <button key={d} disabled={!!shown} onClick={() => play(d)} className={`h-14 rounded-lg text-[15px] font-semibold disabled:opacity-40 ${mine ? 'bg-neon/15 text-neon ring-1 ring-neon/40' : 'bg-amber/15 text-amber ring-1 ring-amber/40'}`}>{DIR_KO[d]}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
