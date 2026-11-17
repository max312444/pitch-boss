// 선수단 → 유스 아카데미: 1군 밖 유망주 목록 · 잠재력 범위 · 1군 승격 / 방출
import { useState } from 'react';
import { useWorld } from '../hooks';
import { useGame } from '../../store/game';
import { playerKo, nations } from '../../data/db';
import { ageOn } from '../../engine/condition';
import { overall } from '../../engine/ratings';
import { facilityLevel } from '../../engine/facilities';
import { ACADEMY_LEAVE_AGE, ACADEMY_MAX, potentialGrade, potentialRange } from '../../engine/academy';
import { POS_ORDER } from '../../data/rating';
import { PosTag } from '../components/bits';
import { TopAttrs } from '../components/SortTh';
import { ratingTone } from '../format';

export function AcademyList() {
  const w = useWorld();
  const act = useGame((s) => s.academyAct);
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const list = [...(w.academy?.club === w.userClubId ? w.academy.players : [])]
    .sort((a, b) => potentialRange(w, b)[1] - potentialRange(w, a)[1] || POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos));
  const level = facilityLevel(w.clubs[w.userClubId], 'youth');
  return (
    <div className="panel min-h-0 flex-1 overflow-auto">
      <div className="border-b border-line px-4 py-3 text-[12px] leading-relaxed text-lo">
        <span className="font-semibold text-mid">유스 아카데미 {list.length} / {ACADEMY_MAX}명</span> · 유스 시설 {level}단계 · 매 시즌 7월에 새 유망주가 들어오고, 매달 훈련으로 자랍니다.
        잠재력은 범위로만 보이며 시설이 좋고 오래 지켜볼수록 좁아집니다. {ACADEMY_LEAVE_AGE}세가 되는 시즌까지 승격하지 않으면 떠납니다. 아카데미 선수는 선수단 인원 · 주급에 들어가지 않습니다.
      </div>
      {list.length === 0 && <div className="px-4 py-12 text-center text-[13px] text-lo">아카데미에 선수가 없습니다. 다음 시즌 7월에 새 유망주가 들어옵니다.</div>}
      {list.map((p) => {
        const [lo, hi] = potentialRange(w, p);
        const age = ageOn(p.birth, w.date);
        const ovr = overall(p);
        const ko = playerKo(p.id, p.name);
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-line)]">
            <PosTag pos={p.pos} />
            <div className="min-w-0 flex-1 basis-[180px]">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="font-semibold text-hi">{ko}</span>
                <span className="text-[12px] text-lo">{age}세 · {nations.get(p.nation)?.ko ?? p.nation}</span>
                {age >= ACADEMY_LEAVE_AGE - 1 && <span className="rounded bg-amber/15 px-1 text-[11px] text-amber">이번 시즌이 마지막</span>}
              </div>
              <TopAttrs w={w} p={p} className="mt-1" />
            </div>
            <div className="flex items-center gap-4 text-right">
              <div><div className={`tnum text-[16px] font-semibold ${ratingTone(ovr)}`}>{ovr}</div><div className="text-[11px] text-lo">지금 능력{(p.dev ?? 0) > 0.05 ? <span className="text-neon"> ↑</span> : ''}</div></div>
              <div><div className="tnum text-[16px] font-semibold text-sky">{lo === hi ? lo : `${lo}–${hi}`} <span className="text-[12px] text-lo">{potentialGrade(Math.round((lo + hi) / 2))}</span></div><div className="text-[11px] text-lo">잠재력</div></div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button onClick={() => setMsg({ id: p.id, text: act(p.id, 'promote').reason })} className="h-9 flex-1 rounded-lg bg-neon px-3 text-[12px] font-semibold text-ink-950 hover:bg-[#5bff3d] sm:flex-none">1군 승격</button>
              {confirm === p.id
                ? <button onClick={() => { act(p.id, 'release'); setConfirm(null); }} className="h-9 flex-1 rounded-lg bg-red/15 px-3 text-[12px] font-semibold text-red sm:flex-none">정말 내보내기</button>
                : <button onClick={() => setConfirm(p.id)} className="h-9 flex-1 rounded-lg px-3 text-[12px] text-mid ring-1 ring-line hover:text-hi sm:flex-none">방출</button>}
            </div>
            {msg?.id === p.id && <div className="w-full text-[12px] text-sky">{msg.text}</div>}
          </div>
        );
      })}
    </div>
  );
}
