import { IntlNewGame } from './IntlNewGame';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/app';
import { useGame } from '../../store/game';
import { availableSeasons, clubKo, compKo, clubs as clubMasters, dataset, leagues, loadLeagueSeason, playerKo, realAvailable, setDataset } from '../../data/db';
import { ageAt, overall, posGroup } from '../../data/rating';
import type { ClubSeasonFile } from '../../data/types';
import { Crest } from '../components/Crest';
import { Icon } from '../components/Icon';
import { ManagerSetup, useManagerSetup } from '../components/ManagerSetup';
import { money, ratingTone } from '../format';
import { DEFAULT_DESIGN, designError, MyClubForm } from '../components/MyClubForm';
import { GOAL_SEASONS, goalText, investGoal, investStart, plainStart, weakestClub } from '../../engine/myclub';
import type { MyClubDesign } from '../../engine/myclubDesign';



const fmtSeason = (s: string) => s.replace('-', '/');

export function NewGameScreen() {
  if (useApp.getState().newMode === 'wc') return <IntlNewGame />;   // 세계 대회 모드는 따로 (나라 · 주기)
  return <ClubNewGame />;
}

function ClubNewGame() {
  const go = useApp((s) => s.go);
  const setTab = useApp((s) => s.setTab);
  const { newGame, loading } = useGame();

  const top = useMemo(() => leagues.filter((l) => l.level <= 2 && availableSeasons(l.id).length), []);
  const allSeasons = useMemo(() => [...new Set(top.flatMap((l) => availableSeasons(l.id)))].sort(), [top]);

  const [season, setSeason] = useState<string>(allSeasons[allSeasons.length - 1]);
  const lgOptions = top.filter((l) => availableSeasons(l.id).includes(season));
  const [league, setLeague] = useState<string>(lgOptions[0]?.id ?? 'eng1');
  const [clubsData, setClubsData] = useState<ClubSeasonFile[] | null>(null);
  const [club, setClub] = useState<string | null>(null);

  useEffect(() => { if (!lgOptions.some((l) => l.id === league)) setLeague(lgOptions[0]?.id); }, [season]); // eslint-disable-line
  useEffect(() => {
    let alive = true;
    setClubsData(null);
    loadLeagueSeason(season, league).then((r) => {
      if (!alive) return;
      const sorted = [...r.clubs].sort((a, b) => b.reputation - a.reputation);
      setClubsData(sorted);
      setClub((c) => (sorted.some((x) => x.club === c) ? c : sorted[0]?.club ?? null));
    });
    return () => { alive = false; };
  }, [season, league]);

  const strength = (c: ClubSeasonFile) => {
    const t = c.squad.map(overall).sort((a, b) => b - a).slice(0, 11);
    return Math.round(t.reduce((a, b) => a + b, 0) / Math.max(1, t.length));
  };
  const mode = useApp((s) => s.newMode);   // 타이틀의 모드 고르기 팝업에서
  const [design, setDesign] = useState<MyClubDesign>(DEFAULT_DESIGN);
  const [takeover, setTakeover] = useState<'plain' | 'invest' | null>(null);   // 나의 구단: 인수 방식 (먼저 고름)
  const weakest = clubsData?.length ? weakestClub(clubsData) : null;
  const sel = clubsData?.find((c) => c.club === club);
  const mgr = useManagerSetup();   // 내 감독 이름 · 철학 · 압박 · 강점
  // 휴대폰: 구단을 누르면 팝업 (닫기 · 뒤로 가기로 닫힘)
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const onPop = () => setSheet(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openSheet = () => { if (window.innerWidth >= 1024) return; setSheet(true); history.pushState({ pbSheet: 1 }, ''); };
  const closeSheet = () => { if (history.state?.pbSheet) history.back(); else setSheet(false); };

  /** 완전 랜덤: 시즌 · 리그 · 구단 모두 무작위 (첫 시즌만 예산 · 샐러리 캡 보정) */
  const [rolling, setRolling] = useState(false);
  const randomStart = async () => {
    setRolling(true);
    const s = allSeasons[Math.floor(Math.random() * allSeasons.length)];
    const lgs = top.filter((l) => availableSeasons(l.id).includes(s));
    const lg = lgs[Math.floor(Math.random() * lgs.length)];
    const r = await loadLeagueSeason(s, lg.id);
    const c = r.clubs[Math.floor(Math.random() * r.clubs.length)];
    setSeason(s); setLeague(lg.id); setClub(c.club);
    await newGame(s, lg.id, c.club, { random: true, manager: mgr.m });
    setRolling(false);
    setTab('home');
    go('hub');
  };

  const start = async () => {
    if (mode === 'my') {
      if (designError(design)) return;
      if (!takeover) return;
      await newGame(season, league, '', { manager: mgr.m, takeover, myClub: { ...design, name: design.name.trim(), short: design.short.trim(), stadium: design.stadium.trim() } });
      setTab('home');
      go('hub');
      return;
    }
    if (!club) return;
    await newGame(season, league, club, { manager: mgr.m });
    setTab('home');
    go('hub');
  };

  const decades = [['2000년대', '2000', '2009'], ['2010년대', '2010', '2019'], ['2020년대', '2020', '2029']] as const;
  if (mode === 'my' && !takeover) return <TakeoverPick onPick={setTakeover} onBack={() => go('title')} />;
  const lvl = leagues.find((l) => l.id === league)?.level ?? 1;
  const tkStart = weakest && clubsData ? (takeover === 'invest' ? investStart(clubsData, weakest) : plainStart(weakest)) : null;
  const tkGoal = takeover === 'invest' && clubsData ? investGoal(clubsData.length, season, lvl) : null;

  return (
    <div className="flex h-full animate-[fade_0.3s_ease-out] flex-col overflow-y-auto bg-ink-950 pb-[env(safe-area-inset-bottom)] lg:flex-row lg:overflow-hidden lg:pb-0">
      {/* 왼쪽: 단계 */}
      <aside className="flex w-full shrink-0 flex-col border-b border-line bg-ink-900 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-5 lg:w-[260px] lg:border-r lg:border-b-0 lg:px-7 lg:py-8">
        <button onClick={() => go('title')} className="tap mb-4 flex items-center gap-2 text-[13px] text-lo hover:text-hi lg:mb-10">
          <Icon name="back" size={15} /> 메인 메뉴
        </button>
        <h1 className="mt-2 text-[22px] font-semibold lg:text-[26px]">새 게임</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2"><span className="inline-flex w-fit items-center gap-2 rounded-md bg-neon-ghost px-2.5 py-1 text-[12px] font-semibold text-neon">{mode === 'my' ? `나의 구단 · ${takeover === 'invest' ? '투자 인수' : '그대로 인수'}` : '기본 모드'}</span>{mode === 'my' && <button onClick={() => setTakeover(null)} className="text-[12px] text-lo underline-offset-2 hover:text-hi hover:underline">인수 방식 바꾸기</button>}</div>
        <div className="mt-1.5 text-[11px] leading-relaxed text-lo">{mode === 'base' ? '실제 구단을 골라 감독으로 시작합니다' : takeover === 'invest' ? '그 리그 꼴찌 구단을 부자 구단주와 함께 인수합니다. 선수단은 그대로, 재정은 크게 늘지만 구단주 조건이 붙습니다' : '그 리그 꼴찌 구단을 그대로 인수합니다. 선수단 · 재정 그대로 밑에서부터 올라갑니다'}</div>
        {mode === 'base' && <button onClick={randomStart} disabled={loading || rolling} title="시즌 · 리그 · 구단을 모두 무작위로 고릅니다"
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neon/50 text-[13px] font-semibold text-neon transition-colors hover:bg-neon-ghost disabled:opacity-50">
          {rolling ? '구단 고르는 중…' : '완전 랜덤으로 시작'}
        </button>}
        {mode === 'base' && <div className="mt-1.5 text-[11px] leading-relaxed text-lo">시즌 · 리그 · 구단 모두 무작위 · 첫 시즌만 살짝 보정 (이적 예산 +10% · 주급 예산 +5% · 샐러리 캡 +5%)</div>}
        <ol className="mt-10 hidden space-y-6 lg:block">
          {[['시즌', fmtSeason(season)], ['리그', compKo(league)], ['구단', mode === 'my' ? design.name || '나의 구단' : club ? clubKo(club) : '–']].map(([k, v], i) => (
            <li key={k} className="flex gap-4">
              <span className="tnum mt-0.5 text-[12px] font-semibold text-neon">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="text-[12px] text-lo">{k}</div>
                <div className="text-[15px] font-semibold">{v}</div>
              </div>
            </li>
          ))}
        </ol>
        {realAvailable && (
          <div className="mt-10">
            <div className="mb-2 text-[12px] text-lo">이름 데이터</div>
            <div className="flex gap-1 rounded-lg bg-ink-850 p-1">
              {([['public', '가상 이름'], ['real', '실명 (내 PC)']] as const).map(([k, label]) => (
                <button key={k} onClick={() => k !== dataset && setDataset(k)}
                  className={`h-8 flex-1 rounded-md text-[12px] transition-colors ${dataset === k ? 'bg-ink-700 font-semibold text-hi' : 'text-mid hover:text-hi'}`}>{label}</button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-lo">실명 데이터는 이 PC에서 파이프라인으로 만든 것이며 저장소에는 없습니다.</p>
          </div>
        )}
        <p className="mt-auto hidden text-[12px] leading-relaxed text-lo lg:block">
          고른 시즌의 실제 선수단으로 시작합니다. 7월 1일 프리시즌부터 진행되며, 여름 이적시장이 열려 있습니다.
        </p>
      </aside>

      {/* 가운데: 선택 */}
      <main className="flex min-w-0 flex-col lg:flex-1 lg:overflow-hidden">
        <section className="border-b border-line px-4 pt-5 pb-5 lg:px-8 lg:pt-7 lg:pb-6">
          <h2 className="mb-4 text-[13px] font-semibold text-mid">시작 시즌</h2>
          <div className="space-y-2.5">
            {decades.map(([label, from, to]) => {
              const list = allSeasons.filter((s) => s.slice(0, 4) >= from && s.slice(0, 4) <= to);
              if (!list.length) return null;
              return (
                <div key={label} className="flex items-center gap-4">
                  <span className="w-16 shrink-0 text-[12px] text-lo">{label}</span>
                  <div className="flex flex-wrap gap-2">
                    {list.map((s) => (
                      <button key={s} onClick={() => setSeason(s)}
                        className={`tnum h-8 rounded-md px-3 text-[13px] transition-colors ${
                          s === season ? 'bg-neon font-semibold text-ink-950' : 'bg-ink-850 text-mid ring-1 ring-line hover:text-hi hover:ring-line-strong'}`}>
                        {fmtSeason(s)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:mt-6 lg:px-0 lg:pb-0">
            {lgOptions.map((l) => (
              <button key={l.id} onClick={() => setLeague(l.id)}
                className={`h-10 shrink-0 rounded-lg px-4 text-[14px] font-semibold whitespace-nowrap transition-colors lg:px-5 ${
                  l.id === league ? 'bg-ink-700 text-hi ring-1 ring-line-strong' : 'bg-ink-850 text-mid ring-1 ring-line hover:text-hi'}`}>
                {l.ko}
              </button>
            ))}
          </div>
        </section>

        <section className="px-4 py-5 lg:min-h-0 lg:flex-1 lg:overflow-auto lg:px-8 lg:py-6">
          <h2 className="mb-3 text-[13px] font-semibold text-mid lg:mb-4">구단 <span className="text-lo">· 명성 순 · 숫자는 주전 평균 능력</span></h2>
          {mode === 'my' && weakest && (
            <button onClick={() => { setClub(weakest.club); openSheet(); }} className="mb-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-neon/50 px-4 py-3 text-left text-[13px] text-neon hover:bg-neon-ghost lg:pointer-events-none">
              <span className="font-semibold">{takeover === 'invest' ? '투자 인수' : '그대로 인수'}</span><span className="text-lo">· {clubKo(weakest.club)}를 인수해 이름 · 엠블럼을 새로 정합니다</span><span className="ml-auto lg:hidden">만들기 →</span>
            </button>
          )}
          {!clubsData ? <div className="text-[13px] text-lo">불러오는 중…</div> : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-1.5 lg:gap-2">
              {clubsData.map((c) => {
                const on = c.club === club;
                const st = strength(c);
                return (
                  <button key={c.club} onClick={() => { setClub(c.club); openSheet(); }} title={mode === 'my' && c.club === weakest?.club ? '이 구단을 인수합니다' : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      on ? 'bg-neon-ghost ring-1 ring-line-strong' : 'bg-ink-850 ring-1 ring-line hover:bg-ink-800 hover:ring-line-strong'}`}>
                    <Crest clubId={c.club} size={26} />
                    <div className={`min-w-0 flex-1 truncate text-[14px] font-semibold ${mode === 'my' && c.club === weakest?.club ? 'text-neon' : ''}`}>{clubKo(c.club)}</div>
                    {mode === 'my' && c.club === weakest?.club && <span className="shrink-0 rounded bg-neon/15 px-1.5 text-[11px] font-semibold text-neon">인수</span>}
                    <div className={`tnum text-[17px] font-semibold ${ratingTone(st)}`}>{st}</div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 오른쪽: 요약 (휴대폰은 구단을 눌렀을 때 팝업) */}
      {sheet && <div className="fixed inset-0 z-40 animate-[fade_0.2s_ease-out] bg-ink-950/75 lg:hidden" onClick={closeSheet} />}
      <aside className={`flex w-full shrink-0 flex-col border-line bg-ink-900 lg:static lg:w-[340px] lg:overflow-y-auto lg:border-l ${sheet ? 'fixed inset-x-0 top-[6dvh] bottom-0 z-50 animate-[rise_0.25s_ease-out] overflow-y-auto rounded-t-2xl border-t' : 'max-lg:hidden'}`}>
        {mode === 'my' && clubsData ? (
          <>
            <button onClick={closeSheet} className="flex h-11 shrink-0 items-center justify-between border-b border-line px-5 text-[14px] text-mid lg:hidden"><span>나의 구단 만들기</span><span>닫기 ✕</span></button>
            <div className="lg:flex-1">
              {weakest && tkStart && (
                <div className="border-b border-line px-5 py-4">
                  <div className="text-[12px] text-lo">{clubKo(weakest.club)} 인수 · 선수단 {weakest.squad.length}명 · 주전 전력 {strength(weakest)}</div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                    {([['이적 예산', weakest.finance.transferBudget, tkStart.finance.transferBudget], ['잔고', weakest.finance.balance, tkStart.finance.balance], ['주급 예산 (주)', weakest.finance.wageBudget, tkStart.finance.wageBudget], ['명성', weakest.reputation, tkStart.reputation]] as const).map(([k, a, b]) => (
                      <div key={k}><div className="text-lo">{k}</div><div className="tnum text-[14px] font-semibold">{k === '명성' ? b : money(b)}{b > a && <span className="ml-1 text-[11px] font-normal text-neon">↑ {k === '명성' ? `+${b - a}` : `원래 ${money(a)}`}</span>}</div></div>
                    ))}
                  </div>
                  {tkGoal ? <div className="mt-3 rounded-lg bg-amber/10 px-3 py-2 text-[12px] leading-relaxed text-amber">구단주 조건: <b>{goalText(tkGoal)}</b> ({GOAL_SEASONS}시즌). 못 지키면 그 시즌이 끝날 때 해임되어 다른 구단으로 옮겨야 합니다.</div>
                    : <div className="mt-3 text-[12px] leading-relaxed text-lo">조건 없음 · 내 구단이라 해임되지 않습니다. 선수 판매 · 유스 아카데미로 키워 올라가세요.</div>}
                </div>
              )}
              <MyClubForm clubsData={clubsData} d={design} setD={setDesign} />
              <ManagerSetup {...mgr} />
            </div>
            <div className="sticky bottom-0 border-t border-line bg-ink-900 p-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:p-5">
              <button onClick={start} disabled={loading || !!designError(design)}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-neon px-5 text-[15px] font-semibold text-ink-950 transition-colors hover:bg-[#5bff3d] disabled:opacity-60">
                {loading ? '세계를 만드는 중…' : '인수하고 시작'}
                {!loading && <Icon name="arrow" size={18} className="transition-transform" />}
              </button>
            </div>
          </>
        ) : sel ? (
          <>
            <button onClick={closeSheet} className="flex h-11 shrink-0 items-center justify-between border-b border-line px-5 text-[14px] text-mid lg:hidden"><span>구단 정보</span><span>닫기 ✕</span></button>
            <div className="relative shrink-0 overflow-hidden px-7 pt-8 pb-6">
              <div className="absolute -top-10 -right-10 opacity-[0.07]"><Crest clubId={sel.club} size={200} /></div>
              <Crest clubId={sel.club} size={54} />
              <div className="mt-4 text-[24px] font-semibold">{clubKo(sel.club)}</div>
              <div className="text-[13px] text-lo">
                {clubMasters.get(sel.club)?.city ?? ''}{clubMasters.get(sel.club)?.founded ? ` · ${clubMasters.get(sel.club)!.founded}년 창단` : ''}
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-px border-y border-line bg-line">
              {[
                ['명성', `${sel.reputation}`],
                ['주전 전력', `${strength(sel)}`],
                ['이적 예산', money(sel.finance.transferBudget)],
                ['주급 예산', money(sel.finance.wageBudget)],
                ['선수단', `${sel.squad.length}명`],
                ['경기장', sel.stadiumCapacity ? `${sel.stadiumCapacity.toLocaleString()}석` : '–'],
              ].map(([k, v]) => (
                <div key={k} className="bg-ink-900 px-6 py-4">
                  <div className="text-[11px] text-lo">{k}</div>
                  <div className="tnum mt-0.5 text-[15px] font-semibold">{v}</div>
                </div>
              ))}
            </div>
            <ManagerSetup {...mgr} />
            <div className="px-7 py-5 lg:flex-1">
              <div className="mb-1 text-[11px] font-semibold text-lo">선수단 {sel.squad.length}명</div>
              {(['GK', 'DF', 'MF', 'FW'] as const).map((g) => {
                const list = [...sel.squad].filter((p) => posGroup(p.pos) === g).sort((a, b) => overall(b) - overall(a));
                return list.length ? (
                  <div key={g} className="mt-3">
                    <div className="mb-1 text-[11px] text-lo">{({ GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수' } as const)[g]} {list.length}</div>
                    {list.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 py-1 text-[13px]">
                        <span className="w-9 text-[11px] font-semibold text-lo">{p.pos}</span>
                        <span className="flex-1 truncate">{playerKo(p.id, p.name)}</span>
                        <span className="tnum text-[11px] text-lo">{ageAt(p.birth, `${season.slice(0, 4)}-07-01`)}세</span>
                        <span className={`tnum w-7 text-right font-semibold ${ratingTone(overall(p))}`}>{overall(p)}</span>
                      </div>
                    ))}
                  </div>
                ) : null;
              })}
            </div>
            {/* 휴대폰 팝업: 시작 버튼은 팝업 아래에 붙어 있음 */}
            <div className="sticky bottom-0 border-t border-line bg-ink-900 p-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:p-5">
              <button onClick={start} disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-neon px-5 text-[15px] font-semibold text-ink-950 transition-colors hover:bg-[#5bff3d] disabled:opacity-60">
                {loading ? '세계를 만드는 중…' : '감독 커리어 시작'}
                {!loading && <Icon name="arrow" size={18} className="transition-transform" />}
              </button>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}

/** 나의 구단: 인수 방식 고르기 (모드를 고른 다음) */
function TakeoverPick({ onPick, onBack }: { onPick: (t: 'plain' | 'invest') => void; onBack: () => void }) {
  const card = (t: 'plain' | 'invest', title: string, sub: string, pros: string[], cons: string[]) => (
    <button onClick={() => onPick(t)} className="group flex flex-col rounded-xl bg-ink-900 p-5 text-left ring-1 ring-line transition-colors hover:bg-ink-850 hover:ring-neon/60 lg:p-7">
      <div className="text-[20px] font-semibold text-hi lg:text-[22px]">{title}</div>
      <div className="mt-1 text-[13px] text-mid">{sub}</div>
      <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed">
        {pros.map((x) => <li key={x} className="flex gap-2"><span className="text-neon">+</span><span className="text-mid">{x}</span></li>)}
        {cons.map((x) => <li key={x} className="flex gap-2"><span className="text-amber">−</span><span className="text-mid">{x}</span></li>)}
      </ul>
      <div className="mt-auto flex items-center gap-2 pt-5 text-[14px] font-semibold text-neon">이 방식으로 <Icon name="arrow" size={16} className="transition-transform group-hover:translate-x-0.5" /></div>
    </button>
  );
  return (
    <div className="flex h-full animate-[fade_0.3s_ease-out] flex-col overflow-y-auto bg-ink-950 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] lg:px-10 lg:py-10">
      <button onClick={onBack} className="tap flex w-fit items-center gap-2 text-[13px] text-lo hover:text-hi"><Icon name="back" size={15} /> 메인 메뉴</button>
      <div className="mx-auto mt-6 w-full max-w-[920px] lg:mt-12">
        <div className="inline-flex rounded-md bg-neon-ghost px-2.5 py-1 text-[12px] font-semibold text-neon">나의 구단 모드</div>
        <h1 className="mt-3 text-[24px] font-semibold lg:text-[30px]">어떻게 인수할까요?</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-lo">고른 리그의 꼴찌 구단을 인수해 이름 · 엠블럼 · 경기장을 새로 정합니다. 선수단은 그 구단 선수 그대로입니다.</p>
        <div className="mt-6 grid gap-3 lg:mt-8 lg:grid-cols-2 lg:gap-5">
          {card('plain', '그대로 인수', '있는 그대로 받아 밑에서부터',
            ['선수단 · 재정 · 시설을 그대로 이어받습니다', '구단주 조건 없음 · 해임되지 않습니다', '유스 · 선수 판매로 천천히 키우는 재미'],
            ['돈이 적어 처음 몇 시즌은 강등권 싸움'])}
          {card('invest', '투자 인수', '부자 구단주와 함께 빠르게',
            ['이적 자금 · 잔고가 리그 상위권 구단 수준', '첫 시즌부터 좋은 선수 몇 명을 데려올 수 있습니다'],
            ['주급 예산은 리그 중간 정도 (스타를 많이 모으면 재정이 무너짐)', `구단주 조건: ${GOAL_SEASONS}시즌 안에 리그 6위 이내 (2부면 승격) · 못 지키면 해임`])}
        </div>
      </div>
    </div>
  );
}
