// 나의 구단: 선수단 준비 카드 (홈 맨 위) — 포지션별 인원 · 전체 인원(선발 11 + 후보)을 채워야 시즌 시작
import { squadNeeds, GROUP_KO } from '../../engine/myclub';
import type { World } from '../../engine/types';
import { useApp } from '../../store/app';
import { money } from '../format';
import { wageRoomInfo } from '../../engine/rules';

export function MyClubSetup({ w }: { w: World }) {
  const openTransfers = useApp((s) => s.openTransfers);
  if (!w.myClub?.setup) return null;
  const n = squadNeeds(w);
  const c = w.clubs[w.userClubId];
  const room = wageRoomInfo(w, w.userClubId).room;
  const fa = () => openTransfers({ positions: [], label: '자유계약', minOvr: 40, maxAge: 40, league: 'FA' });
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-4">
        <div className="text-[16px] font-semibold">선수단 준비 <span className={n.ok ? 'text-neon' : 'text-amber'}>{n.total} / {n.need}명</span></div>
        <div className="text-[12px] text-lo">{n.ok ? '다 채웠습니다 · 아래 「시즌 시작」을 누르세요' : '포지션별 인원과 후보까지 채워야 시즌을 시작할 수 있습니다'}</div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        {n.groups.map((g) => (
          <div key={g.g} className="bg-ink-900 px-5 py-3">
            <div className="text-[11px] text-lo">{GROUP_KO[g.g]}</div>
            <div className={`tnum text-[18px] font-semibold ${g.have >= g.need ? 'text-neon' : 'text-amber'}`}>{g.have}<span className="text-[13px] text-lo"> / {g.need}</span></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <span className="mr-auto text-[12px] text-lo">이적 예산 <b className="tnum text-mid">{money(c.finance.transferBudget)}</b> · 주급 여유 <b className="tnum text-mid">{money(Math.max(0, room))}</b></span>
        <button onClick={fa} className="h-9 rounded-lg bg-neon px-4 text-[13px] font-semibold text-ink-950 hover:bg-[#5bff3d]">자유계약 선수 보기</button>
        <button onClick={() => openTransfers(null)} className="h-9 rounded-lg bg-ink-700 px-4 text-[13px] font-semibold text-hi hover:bg-ink-750">영입하기</button>
      </div>
    </section>
  );
}
