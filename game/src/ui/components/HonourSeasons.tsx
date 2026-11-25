// 선수 프로필 수상 경력: 시즌별 한 줄 (예: 24/25 · 득점왕 · MVP). 한 시즌 개인상 2개 이상이면 더블 · 트레블 표시
import { compKo } from '../../data/db';
import { AWARD_RANK, AWARD_SHORT, isTrophy, type AwardKind } from '../../engine/awards';
import { comboName } from '../awardSlides';

type Honour = { season: string; kind: AwardKind; league: string };

export function HonourSeasons({ honours }: { honours: Honour[] }) {
  const bySeason = new Map<string, Honour[]>();
  for (const h of honours) bySeason.set(h.season, [...(bySeason.get(h.season) ?? []), h]);
  const seasons = [...bySeason.keys()].sort().reverse();
  return (
    <ul className="space-y-1.5 text-[12px]" data-testid="honour-seasons">
      {seasons.map((s) => {
        const hs = bySeason.get(s)!;
        const trophies = hs.filter((h) => isTrophy(h.kind));
        const solos = hs.filter((h) => !isTrophy(h.kind)).sort((a, b) => (AWARD_RANK[b.kind] ?? 0) - (AWARD_RANK[a.kind] ?? 0));
        return (
          <li key={s} className="flex items-start gap-2">
            <span className="tnum w-[42px] shrink-0 pt-0.5 text-lo">{s.slice(2, 4)}/{s.slice(5, 7)}</span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {solos.length >= 2 && <span className="rounded bg-[#f2c94c] px-1.5 py-0.5 text-[10px] font-bold text-ink-950">{comboName(solos.length)}</span>}
              {solos.map((h) => (
                <span key={h.kind} className={`rounded px-1.5 py-0.5 font-semibold ${h.kind === 'world' ? 'bg-[#f2c94c]/25 text-[#ffe08a]' : 'bg-ink-800 text-hi'}`}>{AWARD_SHORT[h.kind]}</span>
              ))}
              {trophies.map((h, i) => (
                <span key={`${h.kind}-${i}`} className="rounded bg-[#f2c94c]/10 px-1.5 py-0.5 text-[#f2c94c]">{AWARD_SHORT[h.kind]}{compKo(h.league) ? ` · ${compKo(h.league)}` : ''}</span>
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
