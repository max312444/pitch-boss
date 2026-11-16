// 나의 구단 만들기: 이름 · 약칭 · 색 · 엠블럼(모양 · 무늬 · 문장 · 별) · 경기장 이름 + 대신할 꼴찌 자리 · 시작 재정 미리 보기
import { useMemo, useState } from 'react';
import type { ClubSeasonFile } from '../../data/types';
import { clubKo, clubs as clubMasters } from '../../data/db';
import { myClubMaster, type MyClubDesign } from '../../engine/myclubDesign';
import { MY_YOUTH, myStart, weakestClub } from '../../engine/myclub';
import type { CrestCharge, CrestPattern, CrestShape } from '../crests/types';
import { Crest } from './Crest';
import { money } from '../format';

const SHAPES: [CrestShape, string][] = [['shield', '방패'], ['round', '원형'], ['oval', '타원'], ['pointed', '뾰족'], ['diamond', '마름모'], ['cut', '모서리']];
const PATTERNS: [CrestPattern, string][] = [['solid', '단색'], ['stripes', '세로 줄'], ['hoops', '가로 줄'], ['halves', '반반'], ['quarters', '4분할'], ['sash', '사선'], ['band', '띠']];
const CHARGES: [CrestCharge, string][] = [['letters', '약칭 글자'], ['ball', '공'], ['star', '별'], ['crown', '왕관'], ['tower', '탑'], ['bird', '새'], ['cannon', '대포'], ['cross', '십자'], ['fleur', '백합']];
const SWATCH = ['#c8102e', '#e4572e', '#f2a900', '#ffd100', '#2e8b57', '#00843d', '#00a3e0', '#1c3f94', '#5b2c83', '#6c1d45', '#111111', '#4a4a4a', '#ffffff', '#d9c7a1'];
const SLOT_KO = ['주색', '보조색', '테두리'];

export const DEFAULT_DESIGN: MyClubDesign = { name: '새 구단 FC', short: 'NEW', colors: ['#1c3f94', '#ffffff', '#111111'], shape: 'shield', pattern: 'solid', charge: 'letters', star: false, stadium: '새 구단 스타디움' };

/** 입력 검사: 잘못이면 이유 */
export function designError(d: MyClubDesign): string | null {
  if (d.name.trim().length < 2) return '구단 이름을 두 글자 이상 넣어 주세요';
  if (d.name.trim().length > 24) return '구단 이름은 24글자까지입니다';
  if (d.short.trim().length < 2 || d.short.trim().length > 4) return '약칭은 2~4글자입니다';
  if (!d.stadium.trim()) return '경기장 이름을 넣어 주세요';
  return null;
}

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className={`h-8 rounded-md px-2.5 text-[12px] transition-colors ${on ? 'bg-neon font-semibold text-ink-950' : 'bg-ink-850 text-mid ring-1 ring-line hover:text-hi'}`}>{children}</button>
);

export function MyClubForm({ clubsData, d, setD }: { clubsData: ClubSeasonFile[]; d: MyClubDesign; setD: (d: MyClubDesign) => void }) {
  const rep = useMemo(() => weakestClub(clubsData), [clubsData]);
  const st = useMemo(() => myStart(clubsData, rep), [clubsData, rep]);
  const [tick, setTick] = useState(0);
  // 미리 보기: 임시 구단으로 등록해 다른 엠블럼과 똑같이 그린다
  clubMasters.set('my-preview', myClubMaster({ id: 'my-preview', replaced: rep.club, nation: clubMasters.get(rep.club)?.nation ?? 'ENG', founded: +rep.season.slice(0, 4), design: d, setup: true }));
  const up = (p: Partial<MyClubDesign>) => { setD({ ...d, ...p }); setTick(tick + 1); };
  const err = designError(d);

  return (
    <div className="space-y-5 px-5 py-5 lg:px-7">
      {/* 미리 보기 */}
      <div className="flex items-center gap-4">
        <Crest key={tick} clubId="my-preview" size={72} />
        <div className="min-w-0">
          <div className="truncate text-[20px] font-semibold">{d.name || '구단 이름'}</div>
          <div className="text-[12px] text-lo">{d.stadium || '경기장'} · {rep.season.slice(0, 4)}년 창단</div>
          <div className="mt-1 text-[12px] text-amber">{clubKo(rep.club)} 자리를 대신합니다 (꼴찌 자리 · 그 선수들은 자유계약으로 풀림)</div>
        </div>
      </div>

      {/* 이름 */}
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-lo">구단 이름
          <input value={d.name} maxLength={24} onChange={(e) => up({ name: e.target.value })} className="h-10 rounded-lg border border-line bg-ink-850 px-3 text-[14px] text-hi outline-none focus:border-neon/60" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-lo">약칭 (2~4)
          <input value={d.short} maxLength={4} onChange={(e) => up({ short: e.target.value.toUpperCase() })} className="h-10 rounded-lg border border-line bg-ink-850 px-3 text-center text-[14px] font-semibold text-hi uppercase outline-none focus:border-neon/60" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[11px] text-lo">경기장 이름
        <input value={d.stadium} maxLength={30} onChange={(e) => up({ stadium: e.target.value })} className="h-10 rounded-lg border border-line bg-ink-850 px-3 text-[14px] text-hi outline-none focus:border-neon/60" />
      </label>

      {/* 색 */}
      <div className="space-y-2">
        {SLOT_KO.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[11px] text-lo">{label}</span>
            <div className="flex flex-wrap gap-1">
              {SWATCH.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => { const cs = [...d.colors] as MyClubDesign['colors']; cs[i] = c; up({ colors: cs }); }}
                  className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-ink-900 ${d.colors[i] === c ? 'ring-2 ring-neon' : 'ring-1 ring-line'}`} style={{ background: c }} />
              ))}
              <input type="color" value={d.colors[i]} onChange={(e) => { const cs = [...d.colors] as MyClubDesign['colors']; cs[i] = e.target.value; up({ colors: cs }); }} className="h-6 w-8 cursor-pointer rounded border border-line bg-transparent" title="직접 고르기" />
            </div>
          </div>
        ))}
      </div>

      {/* 엠블럼 */}
      <div className="space-y-2.5">
        <div className="text-[11px] text-lo">엠블럼 모양</div>
        <div className="flex flex-wrap gap-1.5">{SHAPES.map(([k, l]) => <Chip key={k} on={d.shape === k} onClick={() => up({ shape: k })}>{l}</Chip>)}</div>
        <div className="text-[11px] text-lo">무늬</div>
        <div className="flex flex-wrap gap-1.5">{PATTERNS.map(([k, l]) => <Chip key={k} on={d.pattern === k} onClick={() => up({ pattern: k })}>{l}</Chip>)}</div>
        <div className="text-[11px] text-lo">가운데 문장</div>
        <div className="flex flex-wrap gap-1.5">{CHARGES.map(([k, l]) => <Chip key={k} on={d.charge === k} onClick={() => up({ charge: k })}>{l}</Chip>)}</div>
        <label className="flex items-center gap-2 text-[12px] text-mid"><input type="checkbox" checked={!!d.star} onChange={(e) => up({ star: e.target.checked })} className="accent-[#39ff14]" />별 달기</label>
      </div>

      {/* 시작 조건 */}
      <div className="rounded-lg bg-ink-850 px-4 py-3 text-[12px] leading-relaxed text-mid">
        <div className="mb-1 font-semibold text-hi">시작 조건</div>
        명성 {st.reputation} · 이적 예산 <b className="text-hi">{money(st.finance.transferBudget)}</b> · 주급 예산 {money(st.finance.wageBudget)} · 잔고 {money(st.finance.balance)}
        <div className="text-lo">리그 아래쪽 구단 기준보다 넉넉하게 (사용자 구단 혜택). 첫 스폰서 계약 포함 · 경기장 {st.stadiumCapacity?.toLocaleString()}석</div>
        <div className="mt-1 text-lo">유스 {MY_YOUTH}명으로 시작합니다. 나머지는 영입 · 자유계약으로 채우고, 포지션별 인원과 후보까지 다 채워야 시즌을 시작할 수 있습니다.</div>
      </div>
      {err && <div className="text-[12px] text-red">{err}</div>}
    </div>
  );
}
