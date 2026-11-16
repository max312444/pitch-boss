// 월드컵 모드 화면: 대표팀 홈 · 대표 명단(소집) · 순위(예선 조 + 월드컵)
import { useMemo, useState } from 'react';
import type { Fixture, PlayerState, World } from '../../engine/types';
import { callUpPool, squadSize, STAGE_KO, stageRank, type IntlStage } from '../../engine/intl';
import { NT } from '../../engine/worldcup';
import { confedOf } from '../../engine/national';
import { overall } from '../../engine/ratings';
import { ageOn } from '../../engine/condition';
import { sortTable } from '../../engine/standings';
import { posGroup } from '../../data/rating';
import { clubKo, nationKo, playerKo } from '../../data/db';
import { Crest } from '../components/Crest';
import { Card, PosTag, ResultDot } from '../components/bits';
import { koDate, ratingTone } from '../format';
import { useWorld } from '../hooks';
import { useApp } from '../../store/app';
import { useGame } from '../../store/game';
import { WorldCupView } from './WorldCupView';

const GROUPS = ['GK', 'DF', 'MF', 'FW'] as const;
const GROUP_KO: Record<string, string> = { GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수' };
const resultOf = (f: Fixture, me: string): 'W' | 'D' | 'L' => { const s = f.result!; const [g, o] = f.home === me ? [s.homeGoals, s.awayGoals] : [s.awayGoals, s.homeGoals]; return g > o ? 'W' : g < o ? 'L' : s.pens ? ((s.pens === 'home') === (f.home === me) ? 'W' : 'L') : 'D'; };

/** 다음 경기 · 협회 목표 · 예선 · 최근 결과 · 지난 주기 */
export function IntlHome() {
  const w = useWorld();
  const it = w.intl!;
  const me = NT(it.nation);
  const setTab = useApp((s) => s.setTab);
  const next = [...it.fixtures, ...(w.worldCup?.fixtures ?? [])].filter((f) => !f.result && (f.home === me || f.away === me)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const played = [...it.fixtures, ...(w.worldCup?.fixtures ?? [])].filter((f) => f.result && (f.home === me || f.away === me)).sort((a, b) => b.date.localeCompare(a.date));
  const inCup = !!w.worldCup?.groups.some((g) => g.teams.includes(me));
  const opp = next ? (next.home === me ? next.away : next.home) : null;
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-3 lg:gap-6 lg:p-6">
        <section className="panel flex flex-wrap items-center gap-4 px-5 py-5 lg:px-7">
          <Crest clubId={me} size={56} />
          <div className="min-w-0 flex-1">
            <div className="text-[22px] font-semibold">{nationKo(it.nation)} 대표팀</div>
            <div className="text-[13px] text-lo">{confedOf(it.nation) ?? ''} · {it.cycle} 월드컵 주기 · 대표 명단 {w.clubs[me].squad.length}/{squadSize(w)}명</div>
          </div>
          <div className="rounded-lg bg-ink-850 px-4 py-2.5 text-right">
            <div className="text-[11px] text-lo">협회 목표</div>
            <div className="text-[16px] font-semibold text-neon">{it.objective === 'playoff' ? '예선 플레이오프 이상' : it.objective === 'group' ? '월드컵 본선 진출' : `월드컵 ${STAGE_KO[it.objective]}`}</div>
          </div>
        </section>

        {next && opp && (
          <section className="panel px-5 py-5 lg:px-7">
            <div className="text-[12px] text-lo">다음 경기 · {next.name ?? ''}</div>
            <div className="mt-1 text-[20px] font-semibold">{koDate(next.date)}</div>
            <div className="mt-4 flex items-center justify-center gap-6">
              {[next.home, next.away].map((id, i) => (
                <div key={id} className="flex w-[40%] flex-col items-center gap-2 text-center">
                  <Crest clubId={id} size={52} />
                  <div className="text-[15px] font-semibold">{clubKo(id)}</div>
                  <div className="text-[11px] text-lo">{i === 0 ? '홈' : '원정'}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
          {it.quali && (
            <Card title={`월드컵 예선 · ${it.quali.group.name}`} action={it.quali.done ? <span className={`text-[12px] font-semibold ${it.quali.result === 'out' ? 'text-red' : 'text-neon'}`}>{it.quali.result === 'qualified' ? '본선 진출' : it.quali.result === 'playoff' ? (it.quali.playoff?.done ? (it.quali.playoff.won ? '플레이오프 통과' : '플레이오프 탈락') : '플레이오프') : '탈락'}</span> : null}>
              <QualiTable w={w} />
              <div className="px-5 py-3 text-[11px] text-lo">1위 본선 진출 · 2위 3월 플레이오프 (준결승 · 결승 단판) · 3 · 4위 탈락</div>
            </Card>
          )}
          {!it.quali && (
            <Card title={it.host ? '개최국' : '친선경기 시즌'}>
              <div className="px-5 py-4 text-[13px] leading-relaxed text-mid">{it.host ? `${it.cycle} 월드컵 개최국이라 예선 없이 본선에 나갑니다. 친선경기로 손발을 맞추세요.` : `이번 시즌은 A매치 기간마다 친선경기 2경기입니다. 월드컵 예선은 ${it.cycle - 1}/${String(it.cycle % 100).padStart(2, '0')} 시즌 9월부터입니다.`}</div>
            </Card>
          )}
          <Card title="최근 결과">
            {played.length ? played.slice(0, 8).map((f) => {
              const o = f.home === me ? f.away : f.home;
              return (
                <div key={f.id} className="flex items-center gap-3 px-5 py-2 text-[13px] shadow-[inset_0_-1px_0_var(--color-line)]">
                  <ResultDot r={resultOf(f, me)} />
                  <Crest clubId={o} size={18} />
                  <span className="min-w-0 flex-1 truncate">{clubKo(o)} <span className="text-lo">· {f.name}</span></span>
                  <span className="tnum font-semibold">{f.result!.homeGoals}-{f.result!.awayGoals}{f.result!.pens ? ' (승부차기)' : ''}</span>
                </div>
              );
            }) : <div className="px-5 py-4 text-[13px] text-lo">아직 치른 경기가 없습니다</div>}
          </Card>
        </div>

        {(inCup || w.worldCup) && (
          <button onClick={() => setTab('table')} className="panel flex items-center justify-between px-5 py-4 text-left text-[14px] hover:bg-ink-850">
            <span><b>{w.worldCup?.year} 월드컵</b> <span className="text-lo">· {inCup ? '본선 진출' : '본선에 나가지 못함'}</span></span><span className="text-neon">순위 · 대진 보기 →</span>
          </button>
        )}

        {it.history.length > 0 && (
          <Card title="지난 월드컵">
            {it.history.slice().reverse().map((h) => (
              <div key={h.year} className="flex items-center gap-3 px-5 py-2.5 text-[13px] shadow-[inset_0_-1px_0_var(--color-line)]">
                <span className="tnum w-12 font-semibold">{h.year}</span>
                <span className="flex-1">{STAGE_KO[h.stage]}</span>
                <span className={stageRank(h.stage) >= stageRank(h.objective) ? 'text-neon' : 'text-red'}>목표 {STAGE_KO[h.objective as IntlStage]} {stageRank(h.stage) >= stageRank(h.objective) ? '달성' : '미달'}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function QualiTable({ w }: { w: World }) {
  const q = w.intl!.quali!;
  const me = NT(w.intl!.nation);
  return (
    <table className="w-full text-[13px]">
      <thead><tr className="text-[11px] text-lo"><th className="px-5 py-2 text-left">#</th><th className="text-left">나라</th><th>경기</th><th>득실</th><th className="pr-5 text-right">승점</th></tr></thead>
      <tbody>
        {sortTable(q.group.table).map((r, i) => (
          <tr key={r.club} className={`shadow-[inset_0_-1px_0_var(--color-line)] ${r.club === me ? 'bg-neon-ghost' : ''}`}>
            <td className="px-5 py-2 text-lo">{i + 1}</td>
            <td><span className="flex items-center gap-2"><Crest clubId={r.club} size={18} />{clubKo(r.club)}</span></td>
            <td className="tnum text-center">{r.p}</td>
            <td className="tnum text-center">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
            <td className="tnum pr-5 text-right font-semibold">{r.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 대표 명단: 지금 명단 (빼기) · 소집 후보 (넣기) · 추천 명단 */
export function IntlSquad() {
  const w = useWorld();
  const { callUp, autoSquad } = useGame();
  const openProfile = useApp((s) => s.openProfile);
  const [msg, setMsg] = useState<string | null>(null);
  const [g, setG] = useState<string>('ALL');
  const me = w.clubs[w.userClubId];
  const size = squadSize(w);
  const inSquad = new Set(me.squad);
  const pool = useMemo(() => callUpPool(w), [w, me.squad.length]);   // eslint-disable-line
  const squad = me.squad.map((id) => w.players[id]).filter(Boolean).sort((a, b) => GROUPS.indexOf(posGroup(a.pos) as typeof GROUPS[number]) - GROUPS.indexOf(posGroup(b.pos) as typeof GROUPS[number]) || overall(b) - overall(a));
  const rest = pool.filter((p) => !inSquad.has(p.id) && (g === 'ALL' || posGroup(p.pos) === g));
  const Row = ({ p, on }: { p: PlayerState; on: boolean }) => (
    <div className="flex items-center gap-2.5 px-4 py-2 text-[13px] shadow-[inset_0_-1px_0_var(--color-line)]">
      <PosTag pos={p.pos} />
      <button onClick={() => openProfile(p.id)} className="min-w-0 flex-1 truncate text-left hover:text-neon">
        {playerKo(p.id, p.name)}{p.injury && <span className="ml-1.5 text-[11px] text-red">부상 {p.injury.days}일</span>}
        <span className="block truncate text-[11px] text-lo">{ageOn(p.birth, w.date)}세 · {p.clubId ? clubKo(p.clubId) : '국내파'}</span>
      </button>
      <span className={`tnum w-8 text-right font-semibold ${ratingTone(overall(p))}`}>{overall(p)}</span>
      <button onClick={() => setMsg(callUp(p.id, !on))} className={`h-8 w-14 shrink-0 rounded-md text-[12px] font-semibold ${on ? 'text-lo ring-1 ring-line hover:text-red' : 'bg-neon/15 text-neon hover:bg-neon/25'}`}>{on ? '빼기' : '넣기'}</button>
    </div>
  );
  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 lg:flex-row lg:overflow-hidden lg:p-6">
      <section className="panel flex min-h-0 flex-col lg:flex-1">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="mr-auto"><div className="text-[15px] font-semibold">대표 명단 <span className={me.squad.length === size ? 'text-neon' : 'text-amber'}>{me.squad.length}/{size}</span></div>
            <div className="text-[11px] text-lo">{GROUPS.map((x) => `${GROUP_KO[x]} ${squad.filter((p) => posGroup(p.pos) === x).length}`).join(' · ')}</div></div>
          <button onClick={() => { autoSquad(); setMsg('능력 · 포지션에 맞춘 추천 명단으로 바꿨습니다'); }} className="h-9 rounded-lg bg-ink-700 px-3 text-[12px] font-semibold text-hi hover:bg-ink-750">추천 명단</button>
        </div>
        {msg && <div className="px-4 py-2 text-[12px] text-amber">{msg}</div>}
        <div className="min-h-0 flex-1 overflow-auto">{squad.map((p) => <Row key={p.id} p={p} on />)}</div>
      </section>
      <section className="panel flex min-h-0 flex-col lg:flex-1">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-3">
          <div className="mr-auto text-[15px] font-semibold">소집 후보 <span className="text-[12px] font-normal text-lo">{nationKo(w.intl!.nation)} 국적 · 능력 순</span></div>
          {['ALL', ...GROUPS].map((x) => <button key={x} onClick={() => setG(x)} className={`h-8 rounded-md px-2.5 text-[12px] ${g === x ? 'bg-ink-700 font-semibold text-hi' : 'text-mid hover:text-hi'}`}>{x === 'ALL' ? '전체' : GROUP_KO[x]}</button>)}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{rest.length ? rest.map((p) => <Row key={p.id} p={p} on={false} />) : <div className="px-4 py-4 text-[13px] text-lo">후보가 없습니다</div>}</div>
      </section>
    </div>
  );
}

/** 순위: 예선 조 + 월드컵 (조 · 대진) */
export function IntlTable() {
  const w = useWorld();
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-3 lg:gap-6 lg:p-6">
        {w.intl?.quali && <Card title={`월드컵 예선 · ${w.intl.quali.group.name}`}><QualiTable w={w} /></Card>}
      </div>
      {w.worldCup ? <WorldCupView /> : <div className="px-6 pb-6 text-[13px] text-lo">이번 시즌에는 월드컵이 없습니다. 다음 월드컵: {w.intl?.cycle}</div>}
    </div>
  );
}
