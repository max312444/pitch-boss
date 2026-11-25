// 시즌 말 내 구단 수상 연출
//  1) 우승 트로피 (리그 · 컵 · 유럽 · 세계 대회) — 트로피마다 다른 모양
//  2) 개인상: 같은 선수의 상을 이어서 (가벼운 상 → 큰 상), 같은 시즌 몇 번째 상인지에 따라 연출이 점점 커진다
//  3) 한 시즌 개인상 2개 이상이면 그 선수 요약 화면: 더블 · 트레블 · 쿼드러플 · 전설의 시즌
//  이미지 파일 없이 SVG + CSS. Space · Enter 로 다음
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../store/game';
import { useWorld } from '../hooks';
import { clubs, clubKo, compKo, playerKo } from '../../data/db';
import { AWARD_KO, type Award } from '../../engine/awards';
import { ceremonySlides, comboName, type Slide } from '../awardSlides';
import { Crest } from './Crest';
import { PosTag } from './bits';
import { AWARD_KEYFRAMES, AwardArt, AwardIcon, Confetti, Fireworks, Rays, Sparkles, Spotlights } from './AwardArt';

const colorOf = (id: string) => clubs.get(id)?.crest?.colors[0] ?? clubs.get(id)?.kits?.home.primary ?? '#39ff14';


export function AwardCeremony() {
  const list = useGame((s) => s.awards);
  const close = useGame((s) => s.closeAwards);
  const hasNews = useGame((s) => !!s.news?.length);
  const slides = useMemo(() => ceremonySlides(list ?? []), [list]);
  const [i, setI] = useState(0);
  const next = () => (i < slides.length - 1 ? setI(i + 1) : (setI(0), close()));
  useEffect(() => {
    if (!slides.length) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); next(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!slides.length) return null;
  const s = slides[Math.min(i, slides.length - 1)];
  return (
    <div className="aa-anim fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-ink-950/90 p-3 backdrop-blur-sm" onClick={next} data-testid="award-ceremony">
      <style>{AWARD_KEYFRAMES}</style>
      <div key={i} className="relative my-auto w-full max-w-[600px]" onClick={(e) => e.stopPropagation()}>
        {s.t === 'trophy' ? <Trophy a={s.a} /> : s.t === 'solo' ? <Individual a={s.a} step={s.step} total={s.total} /> : <Combo s={s} />}
        <div className="mt-4 flex items-center justify-between">
          <span className="tnum text-[12px] text-lo">{i + 1} / {slides.length}</span>
          <button onClick={next} className="h-11 rounded-lg bg-neon px-8 text-[14px] font-semibold text-ink-950 transition-colors hover:bg-[#5bff3d]">
            {i < slides.length - 1 ? '다음' : hasNews ? '시즌 소식 보기' : '시즌 결산 보기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Rewards({ a, delay = 0.9 }: { a: Award; delay?: number }) {
  return (
    <ul className="mx-auto mt-5 flex max-w-[440px] flex-wrap justify-center gap-2 text-[12px]" style={{ animation: `aa-rise .5s ${delay}s both` }}>
      {a.rewards.map((r) => <li key={r} className="rounded-md bg-ink-800 px-2.5 py-1 text-mid">{r}</li>)}
    </ul>
  );
}

function Trophy({ a }: { a: Award }) {
  const lg = compKo(a.league) ?? a.league;
  const c = colorOf(a.club);
  const big = a.kind === 'euro' || a.kind === 'wc';
  return (
    <div className="panel relative overflow-hidden px-5 pt-8 pb-7 text-center sm:px-10 sm:pt-10 sm:pb-9" data-award={a.kind}>
      <Confetti colors={[c, '#39ff14', '#f2c94c', '#e9eeea']} n={big ? 60 : 40} />
      {big && <Spotlights />}
      <div className="relative">
        <div className="text-[12px] font-semibold text-neon">{a.season.replace('-', '/')} · {lg}</div>
        <div className="relative mt-3">
          <Rays color={a.kind === 'cup' || a.kind === 'euro' ? '#dfe7ea' : '#f2c94c'} />
          <div className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" style={{ background: '#f2c94c', animation: 'aa-pulse 2.4s ease-in-out infinite' }} />
          <div className="relative"><AwardArt kind={a.kind} color={c} /></div>
          <Sparkles n={big ? 10 : 6} />
        </div>
        <div className="mt-2 flex items-center justify-center gap-3" style={{ animation: 'aa-rise .5s .45s both' }}>
          <Crest clubId={a.club} size={40} />
          <div className="text-[26px] font-semibold sm:text-[30px]">{clubKo(a.club)}</div>
        </div>
        <div className="mt-1 text-[18px] font-semibold text-[#f2c94c]" style={{ animation: 'aa-rise .5s .6s both' }}>{AWARD_KO[a.kind]}</div>
        <div className="tnum mt-1 text-[13px] text-mid" style={{ animation: 'aa-rise .5s .7s both' }}>{a.value}</div>
        <Rewards a={a} />
      </div>
    </div>
  );
}

function Individual({ a, step, total }: { a: Award; step: number; total: number }) {
  const w = useWorld();
  const p = w.players[a.player!];
  const lg = a.kind === 'world' ? '모든 1부 리그' : compKo(a.league) ?? a.league;
  const c = colorOf(a.club);
  const world = a.kind === 'world';
  // 같은 시즌 몇 번째 상인지: 뒤로 갈수록 색종이 · 반짝이 · 빛이 많아진다
  const heat = step - 1 + (world ? 2 : 0);
  return (
    <div className="panel relative overflow-hidden px-5 pt-7 pb-7 text-center sm:px-10 sm:pt-9 sm:pb-9" data-award={a.kind} data-step={step}
      style={heat >= 3 ? { animation: 'aa-shake .5s .9s both' } : undefined}>
      <Confetti colors={[c, '#39ff14', '#e9eeea', '#f2c94c']} n={30 + heat * 18} />
      {(world || step >= 3) && <Spotlights />}
      {heat >= 2 && <Fireworks n={Math.min(4, heat - 1)} colors={['#f2c94c', c, '#fff4cc']} />}
      <div className="relative">
        <div className="text-[12px] font-semibold text-neon">{a.season.replace('-', '/')} · {lg}</div>
        {total >= 2 && (
          <div className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#f2c94c]/15 px-3 py-1 text-[12px] font-semibold text-[#f2c94c]" style={{ animation: 'aa-pop .6s .2s both' }}>
            이번 시즌 {step}번째 수상{step === total ? '!' : ''}
            <span className="flex gap-0.5">{Array.from({ length: total }, (_, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${k < step ? 'bg-[#f2c94c]' : 'bg-ink-700'}`} />)}</span>
          </div>
        )}
        <div className="relative mt-3">
          {(heat >= 1 || world) && <Rays speed={world ? 10 : 16} />}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ width: 120 + heat * 30, height: 120 + heat * 30, background: world ? '#ffe08a' : '#f2c94c', animation: 'aa-pulse 2.2s ease-in-out infinite' }} />
          <div className="relative"><AwardArt kind={a.kind} color={c} /></div>
          <Sparkles n={4 + heat * 3} />
        </div>
        <div className="mt-3 text-[18px] font-semibold text-[#f2c94c]" style={{ animation: 'aa-rise .5s .35s both' }}>{AWARD_KO[a.kind]}</div>
        <div className="mt-2 text-[26px] font-semibold sm:text-[30px]" style={{ animation: 'aa-rise .5s .5s both' }}>{playerKo(p.id, p.name)}</div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[13px] text-mid" style={{ animation: 'aa-rise .5s .6s both' }}>
          <PosTag pos={p.pos} /><Crest clubId={a.club} size={18} />{clubKo(a.club)} · <span className="tnum">{a.value}</span>
        </div>
        <Rewards a={a} />
      </div>
    </div>
  );
}

function Combo({ s }: { s: Extract<Slide, { t: 'combo' }> }) {
  const w = useWorld();
  const p = w.players[s.player];
  const n = s.awards.length;
  const c = colorOf(s.club);
  const name = comboName(n);
  return (
    <div className="panel relative overflow-hidden px-5 pt-8 pb-8 text-center sm:px-10" data-combo={n}
      style={{ background: 'radial-gradient(circle at 50% 30%, rgba(242,201,76,.22), transparent 70%)', ...(n >= 4 ? { animation: 'aa-shake .6s 1.2s both' } : {}) }}>
      <Spotlights />
      <Fireworks n={Math.min(5, n + 1)} colors={['#f2c94c', c, '#fff4cc', '#39ff14']} />
      <Confetti colors={['#f2c94c', '#ffe08a', c, '#e9eeea']} n={60 + n * 20} />
      <div className="relative">
        <div className="text-[12px] font-semibold text-neon">{s.awards[0].season.replace('-', '/')} 시즌</div>
        <div className="mt-2 bg-gradient-to-b from-[#fff4cc] to-[#d4a72c] bg-clip-text text-[40px] leading-none font-black tracking-tight text-transparent sm:text-[52px]"
          style={{ animation: 'aa-pop .9s .1s var(--ease-out-quart) both' }}>{name}</div>
        <div className="mt-1 text-[13px] text-mid" style={{ animation: 'aa-rise .5s .4s both' }}>한 시즌 개인상 {n}개</div>
        {/* 받은 상이 하나씩 날아와 줄 선다 */}
        <div className="mt-5 flex flex-wrap items-end justify-center gap-3">
          {s.awards.map((a, k) => (
            <div key={a.kind} className="flex w-[84px] flex-col items-center" style={{ animation: `aa-pop .6s ${0.4 + k * 0.15}s var(--ease-out-quart) both` }}>
              <AwardIcon kind={a.kind} size={64} />
              <span className="mt-1 text-[11px] font-semibold text-[#f2c94c]">{AWARD_KO[a.kind]}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 text-[26px] font-semibold sm:text-[30px]" style={{ animation: `aa-rise .5s ${0.5 + n * 0.12}s both` }}>{playerKo(p.id, p.name)}</div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[13px] text-mid" style={{ animation: `aa-rise .5s ${0.6 + n * 0.12}s both` }}>
          <PosTag pos={p.pos} /><Crest clubId={s.club} size={18} />{clubKo(s.club)}
        </div>
        <Sparkles n={10 + n * 3} />
      </div>
    </div>
  );
}
