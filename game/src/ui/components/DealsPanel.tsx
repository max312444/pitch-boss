// 이적 화면 「거래 현황」: 내 구단이 한 거래 (성사 · 무산) 와 포지션별 보강 요약
import { useMemo, useState } from 'react';
import { DEAL_GROUPS, dealSummary, type DealEntry } from '../../engine/dealLog';
import { posGroup } from '../../data/rating';
import { clubKo, playerKo } from '../../data/db';
import { useWorld } from '../hooks';
import { Crest } from './Crest';
import { PosTag } from './bits';
import { koDate, money } from '../format';

const GROUP_KO = { GK: '골키퍼', DF: '수비', MF: '미드필더', FW: '공격' } as const;
const KIND_KO: Record<DealEntry['kind'], string> = { transfer: '이적', free: '자유계약', loan: '임대', precontract: '사전 계약', release: '방출' };

export function DealsPanel({ onPick }: { onPick: (playerId: string) => void }) {
  const w = useWorld();
  const [scope, setScope] = useState<'season' | 'all'>('season');
  const [show, setShow] = useState<'all' | 'ok' | 'fail'>('all');
  // 사전 계약을 맺고 합류를 기다리는 선수: 기록이 없으면 (이 기능 전에 맺은 계약) 지금 상태로 한 줄 만들어 함께 보인다
  const uc = w.userClubId;
  const saved = w.dealLog ?? [];
  const log = useMemo(() => {
    const extra: DealEntry[] = [];
    for (const p of Object.values(w.players)) {
      const pc = p.precontract;
      if (!pc || (pc.club !== uc && p.clubId !== uc)) continue;
      if (saved.some((e) => e.player === p.id && e.kind === 'precontract' && e.ok && !e.joined)) continue;
      const mine = pc.club === uc;
      extra.push({ date: pc.date, season: w.season, dir: mine ? 'in' : 'out', kind: 'precontract', player: p.id, club: mine ? p.clubId : pc.club, ok: true, pos: p.pos });
    }
    return extra.length ? [...saved, ...extra].sort((a, b) => a.date.localeCompare(b.date)) : saved;
  }, [w, saved, saved.length, uc]);
  const inScope = useMemo(() => (scope === 'season' ? log.filter((e) => e.season === w.season) : log), [log, log.length, scope, w.season]);
  const sum = useMemo(() => dealSummary(inScope, posGroup), [inScope]);
  const squadCount = useMemo(() => {
    const n = { GK: 0, DF: 0, MF: 0, FW: 0 } as Record<string, number>;
    for (const id of w.clubs[w.userClubId].squad) n[posGroup(w.players[id].pos)]++;
    return n;
  }, [w, w.clubs[w.userClubId].squad.length]);
  const rows = inScope.filter((e) => (show === 'all' ? true : show === 'ok' ? e.ok : !e.ok)).slice().reverse();
  // 덜 보강한 포지션: 영입이 가장 적은 그룹 (무산만 있었다면 함께 표시)
  const minIn = Math.min(...DEAL_GROUPS.map((g) => sum[g].in));
  const anyIn = DEAL_GROUPS.some((g) => sum[g].in > 0 || sum[g].failed > 0);
  // 여러 포지션이 똑같이 적으면 (3곳 이상) 표시하지 않음 — 뚜렷하게 덜 보강한 곳만
  const lowCount = DEAL_GROUPS.filter((g) => sum[g].in === minIn).length;

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:flex-1">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <div className="flex gap-1 rounded-lg bg-ink-900 p-1">
          {([['season', `이번 시즌 (${w.season})`], ['all', '전체']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setScope(k)} className={`tap h-7 rounded-md px-3 ${scope === k ? 'bg-ink-700 font-semibold text-hi' : 'text-mid hover:text-hi'}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-ink-900 p-1">
          {([['all', '모두'], ['ok', '성사'], ['fail', '무산']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setShow(k)} className={`tap h-7 rounded-md px-3 ${show === k ? 'bg-ink-700 font-semibold text-hi' : 'text-mid hover:text-hi'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* 포지션별 요약 */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {DEAL_GROUPS.map((g) => {
          const s = sum[g];
          const thin = anyIn && s.in === minIn && lowCount <= 2;
          return (
            <div key={g} className="bg-ink-850 px-4 py-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-lo">{GROUP_KO[g]} <span className="text-mid">· 지금 {squadCount[g]}명</span></span>
                {thin && <span className="rounded bg-amber/15 px-1.5 py-px text-[11px] font-semibold text-amber">덜 보강</span>}
              </div>
              <div className="tnum mt-1 flex items-baseline gap-3 text-[13px]">
                <span><span className="text-[18px] font-semibold text-neon">{s.in}</span> <span className="text-lo">영입</span></span>
                <span><span className="text-[15px] font-semibold text-hi">{s.out}</span> <span className="text-lo">나감</span></span>
                <span><span className={`text-[15px] font-semibold ${s.failed ? 'text-red' : 'text-lo'}`}>{s.failed}</span> <span className="text-lo">무산</span></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 거래 목록 */}
      <div className="panel min-h-0 overflow-auto lg:flex-1">
        {rows.length === 0 && (
          <div className="grid h-full min-h-[160px] place-items-center px-6 text-center text-[13px] text-lo">
            {log.length ? '조건에 맞는 거래가 없습니다' : '아직 거래 기록이 없습니다. 영입 협상 · 판매 · 임대 · 방출을 하면 성사된 것과 무산된 것이 여기에 쌓입니다'}
          </div>
        )}
        {rows.map((e, i) => {
          const p = w.players[e.player];
          return (
            <button key={`${e.date}-${e.player}-${i}`} onClick={() => p && onPick(e.player)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left shadow-[inset_0_-1px_0_var(--color-line)] transition-colors hover:bg-ink-800 lg:px-4">
              <span className={`w-10 shrink-0 rounded py-0.5 text-center text-[11px] font-semibold ${e.dir === 'in' ? 'bg-neon/15 text-neon' : 'bg-sky/15 text-sky'}`}>{e.dir === 'in' ? '영입' : '내보냄'}</span>
              <span className="hidden shrink-0 sm:block"><PosTag pos={e.pos} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">
                  {p ? playerKo(p.id, p.name) : e.player}
                  <span className="ml-2 text-[12px] font-normal whitespace-nowrap text-lo">{KIND_KO[e.kind]}{e.fee ? ` · ${money(e.fee)}` : ''}</span>
                </div>
                <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-lo">
                  <span className="shrink-0 sm:hidden">{e.pos} ·</span>
                  {e.club ? <><Crest clubId={e.club} size={14} /><span className="min-w-0 truncate">{e.dir === 'in' ? '← ' : '→ '}{clubKo(e.club)}</span></> : <span>{e.kind === 'release' ? '자유계약으로' : '소속 없음'}</span>}
                  <span className="shrink-0">· <span className="sm:hidden">{+e.date.slice(5, 7)}.{+e.date.slice(8)}</span><span className="hidden sm:inline">{koDate(e.date)}</span></span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${e.ok ? 'bg-neon/15 text-neon' : 'bg-red/15 text-red'}`}>{e.ok ? '성사' : '무산'}</span>
                {e.ok && e.kind === 'precontract' && <div className={`mt-1 text-[11px] ${e.joined ? 'text-lo' : 'text-amber'}`}>{e.joined ? `합류 완료 · ${+e.joined.slice(5, 7)}월 ${+e.joined.slice(8)}일` : '7월에 합류 예정'}</div>}
                {!e.ok && e.why && <div className="mt-1 max-w-[160px] truncate text-[11px] text-lo lg:max-w-[260px]" title={e.why}>{e.why}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
