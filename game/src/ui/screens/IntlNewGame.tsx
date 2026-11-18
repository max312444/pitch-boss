// 새 게임 · 세계 대회 모드: 세계 대회 주기 (2002 ~ 2026) · 나라 고르기 → 대표팀 감독
//  시작 시즌 = 그 세계 대회가 열리는 시즌 (예: 2002 → 2001/02, 9월 예선 → 3월 플레이오프 → 6월 본선)
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/app';
import { useGame } from '../../store/game';
import { availableSeasons, leagues, loadWcSquads, nationKo, playerKo, worldCupsMeta } from '../../data/db';
import { ALL_NATIONS, confedOf, type Confed } from '../../engine/national';
import type { WcSquads } from '../../engine/wcsquads';
import { estimateOvr } from '../../engine/wcsquads';
import { Crest } from '../components/Crest';
import { Icon } from '../components/Icon';
import { ManagerSetup, useManagerSetup } from '../components/ManagerSetup';
import { ratingTone } from '../format';

const CONFEDS: Confed[] = ['UEFA', 'CONMEBOL', 'AFC', 'CAF', 'CONCACAF', 'OFC'];
const CONF_KO: Record<Confed, string> = { UEFA: '유럽', CONMEBOL: '남미', AFC: '아시아', CAF: '아프리카', CONCACAF: '북중미', OFC: '오세아니아' };

export function IntlNewGame() {
  const go = useApp((s) => s.go);
  const setTab = useApp((s) => s.setTab);
  const { newGame, loading } = useGame();
  const mgr = useManagerSetup();
  const seasons = useMemo(() => new Set(leagues.filter((l) => l.level <= 2).flatMap((l) => availableSeasons(l.id))), []);
  const cycles = [2002, 2006, 2010, 2014, 2018, 2022, 2026].filter((y) => seasons.has(`${y - 1}-${String(y % 100).padStart(2, '0')}`));
  const [year, setYear] = useState(cycles.at(-1) ?? 2026);
  const [conf, setConf] = useState<Confed>('AFC');
  const [nation, setNation] = useState('KOR');
  const [squads, setSquads] = useState<WcSquads | undefined>();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { void loadWcSquads().then((x) => { setSquads(x); setLoaded(true); }); }, []);
  const real = worldCupsMeta[String(year)];
  const finalists = new Set(Object.values(real?.groups ?? {}).flat());
  const list = ALL_NATIONS.filter((n) => confedOf(n) === conf).sort((a, b) => +finalists.has(b) - +finalists.has(a) || nationKo(a).localeCompare(nationKo(b), 'ko'));
  const rows = squads?.[String(year)]?.[nation] ?? [];
  const top = [...rows].sort((a, b) => estimateOvr(b, year) - estimateOvr(a, year)).slice(0, 8);
  const season = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
  const host = real?.hosts?.includes(nation);
  const start = async () => {
    await newGame(season, '', '', { manager: mgr.m, intl: { nation } });
    setTab('home');
    go('hub');
  };

  return (
    <div className="flex h-full animate-[fade_0.3s_ease-out] flex-col overflow-y-auto bg-ink-950 pb-[env(safe-area-inset-bottom)] lg:flex-row lg:overflow-hidden lg:pb-0">
      <aside className="flex w-full shrink-0 flex-col border-b border-line bg-ink-900 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-5 lg:w-[260px] lg:border-r lg:border-b-0 lg:px-7 lg:py-8">
        <button onClick={() => go('title')} className="tap mb-4 flex items-center gap-2 text-[13px] text-lo hover:text-hi lg:mb-10"><Icon name="back" size={15} /> 메인 메뉴</button>
        <h1 className="mt-2 text-[22px] font-semibold lg:text-[26px]">새 게임</h1>
        <div className="mt-3 inline-flex w-fit rounded-md bg-neon-ghost px-2.5 py-1 text-[12px] font-semibold text-neon">세계 대회 모드</div>
        <div className="mt-1.5 text-[11px] leading-relaxed text-lo">대표팀 감독이 되어 예선 → 본선 → 다음 세계 대회를 이어 갑니다. 이적시장은 없고 대표 소집 · 전술만 다룹니다.</div>
        <p className="mt-auto hidden text-[12px] leading-relaxed text-lo lg:block">그 세계 대회가 열리는 시즌 7월에 시작합니다. 9 · 10 · 11월 예선, 3월 플레이오프, 6월 본선 (개최국은 친선경기 후 본선).</p>
      </aside>

      <main className="flex min-w-0 flex-col lg:flex-1 lg:overflow-hidden">
        <section className="border-b border-line px-4 pt-5 pb-5 lg:px-8 lg:pt-7">
          <h2 className="mb-3 text-[13px] font-semibold text-mid">시작할 세계 대회</h2>
          <div className="flex flex-wrap gap-2">
            {cycles.map((y) => (
              <button key={y} onClick={() => setYear(y)} className={`tnum h-9 rounded-md px-3.5 text-[13px] ${y === year ? 'bg-neon font-semibold text-ink-950' : 'bg-ink-850 text-mid ring-1 ring-line hover:text-hi'}`}>{y}</button>
            ))}
          </div>
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {CONFEDS.map((c) => (
              <button key={c} onClick={() => setConf(c)} className={`h-9 shrink-0 rounded-lg px-3.5 text-[13px] font-semibold ${c === conf ? 'bg-ink-700 text-hi ring-1 ring-line-strong' : 'bg-ink-850 text-mid ring-1 ring-line hover:text-hi'}`}>{CONF_KO[c]}</button>
            ))}
          </div>
        </section>
        <section className="px-4 py-5 lg:min-h-0 lg:flex-1 lg:overflow-auto lg:px-8">
          <h2 className="mb-3 text-[13px] font-semibold text-mid">나라 <span className="text-lo">· 초록 표시 = 실제 {year} 세계 대회 본선</span></h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(170px,100%),1fr))] gap-1.5">
            {list.map((n) => (
              <button key={n} onClick={() => setNation(n)} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] ${n === nation ? 'bg-neon-ghost ring-1 ring-line-strong' : 'bg-ink-850 ring-1 ring-line hover:bg-ink-800'}`}>
                <Crest clubId={`nt-${n}`} size={22} />
                <span className="min-w-0 flex-1 truncate font-semibold">{nationKo(n)}</span>
                {finalists.has(n) && <span className="h-2 w-2 shrink-0 rounded-full bg-neon" />}
              </button>
            ))}
          </div>
        </section>
      </main>

      <aside className="flex w-full shrink-0 flex-col border-t border-line bg-ink-900 lg:w-[340px] lg:border-t-0 lg:border-l lg:overflow-auto">
        <div className="px-6 pt-6 pb-4">
          <Crest clubId={`nt-${nation}`} size={54} />
          <div className="mt-3 text-[22px] font-semibold">{nationKo(nation)} 대표팀</div>
          <div className="text-[12px] text-lo">{CONF_KO[confedOf(nation) ?? 'UEFA']} · {year} 세계 대회 {host ? '개최국 (예선 없음)' : finalists.has(nation) ? '실제 본선 진출국' : '실제로는 본선 못 나감 · 예선부터 도전'}</div>
        </div>
        <div className="border-y border-line px-6 py-4">
          <div className="mb-2 text-[11px] font-semibold text-lo">{rows.length ? `실제 ${year} 세계 대회 명단 (${rows.length}명) 중` : '실제 세계 대회 명단 없음 · 게임 속 선수와 국내파로 소집'}</div>
          {top.map((r) => (
            <div key={r.id ?? r.wc} className="flex items-center gap-3 py-1 text-[13px]">
              <span className="w-8 text-[11px] font-semibold text-lo">{r.pos}</span>
              <span className="flex-1 truncate">{playerKo(r.id ?? r.wc!, r.name)}</span>
              <span className={`tnum font-semibold ${ratingTone(estimateOvr(r, year))}`}>{r.id ? '' : '~'}{estimateOvr(r, year)}</span>
            </div>
          ))}
          {rows.length > 0 && <div className="mt-1 text-[11px] text-lo">~ 는 게임에 없던 선수의 추정 능력 (게임 속 선수는 실제 능력으로 계산)</div>}
        </div>
        {loaded && !squads && <div className="mx-6 mt-4 rounded-lg border border-amber/50 bg-amber/10 px-4 py-3 text-[12px] leading-relaxed text-amber">이 데이터에는 실제 세계 대회 명단 · 대표 선수 풀이 없습니다. 이대로 시작하면 소집 후보가 가상 선수로 채워집니다. 실명 데이터라면 데이터베이스에서 실명 데이터를 다시 넣어 주세요 (v2.0 이후 데이터에 들어 있음).</div>}
        <ManagerSetup {...mgr} />
        <div className="sticky bottom-0 mt-auto border-t border-line bg-ink-900 p-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:p-5">
          <button onClick={start} disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-neon text-[15px] font-semibold text-ink-950 hover:bg-[#5bff3d] disabled:opacity-60">
            {loading ? '세계를 만드는 중…' : '대표팀 감독 시작'}{!loading && <Icon name="arrow" size={18} />}
          </button>
        </div>
      </aside>
    </div>
  );
}
