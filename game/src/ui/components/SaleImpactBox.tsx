// 받은 영입 제안 판단 도우미: 이 선수의 이번 시즌 활약 · 팀 안 자리 · 같은 자리 경쟁자 · 팔면 보강할 포지션
import { useMemo, useState } from 'react';
import { saleImpact, searchPreset, type UnitReport } from '../../engine/analysis';
import { overall } from '../../engine/ratings';
import { ageOn } from '../../engine/condition';
import { ROLE_KO, roleOf } from '../../engine/roles';
import type { PlayerState } from '../../engine/types';
import { playerKo } from '../../data/db';
import { useWorld } from '../hooks';
import { ratingTone } from '../format';

const seasonLine = (p: PlayerState) => {
  const s = p.stats;
  const apps = s.apps + s.subApps;
  const cup = p.cupStats?.apps ? ` · 컵 ${p.cupStats.apps}경기 ${p.cupStats.goals}골` : '';
  return apps ? `${apps}경기 (선발 ${s.apps}) · ${s.goals}골 ${s.assists}도움 · 평점 ${(s.ratingSum / apps).toFixed(2)}${cup}` : `리그 출전 없음${cup}`;
};

export function SaleImpactBox({ playerId, compact, onPick }: { playerId: string; compact?: boolean; onPick?: (r: UnitReport) => void }) {
  const w = useWorld();
  const p = w.players[playerId];
  const [open, setOpen] = useState(false);   // 휴대폰: 경쟁자 · 보강 추천은 접어 둔다
  const im = useMemo(() => (p ? saleImpact(w, playerId) : null), [w, playerId, p]);
  if (!p || !im) return null;
  const spot = `${im.unit.label} ${im.rank}번째 (주전 ${im.need}자리)`;

  if (compact) return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-lo">
      <span className={im.starter ? 'text-neon' : 'text-mid'}>{im.starter ? '주전' : '후보'} · {spot}</span>
      <span>· {seasonLine(p)}</span>
      <span>· 경쟁자 {im.rivals.length}명</span>
      {im.newNeed && <span className="text-amber">· 팔면 {im.unit.label} 보강 필요</span>}
    </div>
  );

  return (
    <div className="space-y-2.5 border-b border-line bg-ink-900/60 px-4 py-3 text-[12px] sm:px-6">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`rounded px-1.5 py-px text-[11px] font-semibold ${im.starter ? 'bg-neon/15 text-neon' : 'bg-ink-700 text-mid'}`}>{im.starter ? '주전' : '후보'}</span>
        <span className="text-hi">{spot}</span>
        <span className="text-lo">· 역할 {ROLE_KO[roleOf(w, p)]}</span>
        <div className="basis-full text-mid">이번 시즌 {seasonLine(p)}</div>
      </div>
      <button onClick={() => setOpen((v) => !v)} className="tap flex h-8 w-full items-center justify-between rounded-md bg-ink-850 px-3 text-mid ring-1 ring-line sm:hidden">
        <span>경쟁자 {im.rivals.length}명 · 보강 추천 {im.after.length}곳{im.newNeed ? <span className="text-amber"> · 팔면 {im.unit.label} 보강 필요</span> : ''}</span><span>{open ? '접기 ▴' : '보기 ▾'}</span>
      </button>
      <div className={open ? '' : 'max-sm:hidden'}>
        <div className="mb-1 text-lo">같은 자리 경쟁자</div>
        {im.rivals.length ? (
          <div className="flex flex-wrap gap-1.5">
            {im.rivals.slice(0, 4).map(({ p: q, rating }) => (
              <span key={q.id} className="flex items-center gap-1.5 rounded-md bg-ink-850 px-2 py-1 ring-1 ring-line">
                <span className={`tnum font-semibold ${ratingTone(overall(q))}`}>{Math.round(rating)}</span>
                <span className="max-w-[120px] truncate text-hi">{playerKo(q.id, q.name)}</span>
                <span className="text-lo">{q.pos} · {ageOn(q.birth, w.date)}세{q.injury ? ' · 부상' : ''}</span>
              </span>
            ))}
            {im.rivals.length > 4 && <span className="self-center text-lo">외 {im.rivals.length - 4}명</span>}
          </div>
        ) : <div className="text-red">없음 — 팔면 이 자리를 맡을 선수가 없습니다</div>}
      </div>
      <div className={open ? '' : 'max-sm:hidden'}>
        <div className="mb-1 text-lo">
          팔면{im.starter && im.drop < -0.5 ? <> {im.unit.label} 주전 수준 <span className="tnum text-amber">{im.drop.toFixed(1)}</span></> : ''} · 보강 추천
        </div>
        {im.after.length ? (
          <div className="flex flex-wrap gap-1.5">
            {im.after.map((r) => {
              const pr = searchPreset(r);
              const mine = r.unit.key === im.unit.key;
              const cls = `rounded-md px-2 py-1 ring-1 ${mine ? 'bg-amber/10 text-amber ring-amber/40' : 'bg-ink-850 text-mid ring-line'}`;
              const text = <>{r.unit.label} · 능력 {pr.minOvr}+{r.notes[0] ? <span className="hidden text-lo sm:inline"> — {r.notes[0]}</span> : null}</>;
              return onPick
                ? <button key={r.unit.key} onClick={() => onPick(r)} className={`${cls} text-left hover:text-hi`}>{text} →</button>
                : <span key={r.unit.key} className={cls}>{text}</span>;
            })}
          </div>
        ) : <div className="text-mid">팔아도 급하게 보강할 포지션은 없습니다</div>}
      </div>
    </div>
  );
}
