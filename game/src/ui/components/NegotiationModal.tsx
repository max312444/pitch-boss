// 영입 협상 창 (화면 가운데)
//  ① 이적료: 파는 구단과 합의 (자유계약 선수는 건너뜀)
//  ② 개인 계약: 선수와 주급 · 계약 기간 합의
// 이적료는 밀고 당기기 (engine/negotiation.ts: 역제안 · 인내심 · 최저선, 4번), 주급은 3번 안에 합의 못 하면 결렬 → 이번 이적시장 동안 이 선수와 다시 협상 불가
import { BONUS_APPS, bonusCap, SELL_ON_PCTS, termsWorth, type DealTerms } from '../../engine/addons';
import { appealOf } from '../../engine/appeal';
import { autoRole, ROLE_KO, ROLES, type Role } from '../../engine/roles';
import { OvrText } from './Scout';
import { hiddenKnown, seenOverall } from '../../engine/scout';
import { useEffect, useRef, useState } from 'react';
import type { PlayerState } from '../../engine/types';
import { ageOn } from '../../engine/condition';
import { JOIN_LINE, joinFactors, MAX_TRIES, marketValue, talkBanned, wageDemand } from '../../engine/transfer';
import { FEE_TRIES, feeState, sellerHint } from '../../engine/negotiation';
import { wageRoomInfo } from '../../engine/rules';
import { clubKo, playerKo } from '../../data/db';
import { useGame } from '../../store/game';
import { useWorld } from '../hooks';
import { Crest } from './Crest';
import { PosTag } from './bits';
import { money } from '../format';
import { buyoutOf, buyoutOptions, buyoutWageFactor, relClauseAllowed, relegationRisk, relOptions, relWageFactor } from '../../engine/clauses';
import { bosmanEligible } from '../../engine/bosman';
import { bargainOf, relClauseOf } from '../../engine/firesale';
import type { World } from '../../engine/types';

/** 계약에 거는 바이아웃 선택 (낮을수록 선수가 주급을 덜 요구 · 다른 구단이 내고 데려가기 쉬움) */
export function BuyoutSelect({ w, p, value, onChange }: { w: World; p: PlayerState; value: number; onChange: (v: number) => void }) {
  const opts = buyoutOptions(w, p, w.userClubId);
  if (!opts.some((o) => o.fee === value)) opts.unshift({ mult: -1, fee: value });   // 지금 계약 조건 (재계약)
  return (
    <select value={value} onChange={(e) => onChange(+e.target.value)} title="바이아웃 (선택): 넣으면 선수가 주급을 깎아 줍니다 (낮을수록 더). 대신 이 금액 이상을 내는 구단에는 거절 못 하고 보내야 합니다"
      className="h-11 rounded-lg border border-line bg-ink-850 px-3 text-[13px] text-hi max-sm:flex-1">
      {opts.map((o) => <option key={o.mult} value={o.fee}>{o.fee ? `바이아웃 ${money(o.fee)}` : '바이아웃 없음'}{o.mult < 0 ? ' (지금)' : ''}</option>)}
    </select>
  );
}
/** 강등 조항 고르기 (1부 리그 구단만): 넣으면 선수가 주급을 조금 깎아 주고 오려는 마음도 커진다. 강등되면 그 금액에 보내야 한다 */
export function RelSelect({ w, p, value, onChange, current }: { w: World; p: PlayerState; value: number; onChange: (v: number) => void; current?: number }) {
  if (!relClauseAllowed(w, w.userClubId)) return null;
  const opts = relOptions(w, p);
  if (current != null && !opts.some((o) => o.fee === current)) opts.unshift({ mult: -1, fee: current });
  return (
    <select value={value} onChange={(e) => onChange(+e.target.value)} title={`강등 조항 (선택): 넣으면 선수가 주급을 조금 깎아 주고 오려는 마음도 커집니다. 대신 구단이 강등되면 다음 여름 이 금액을 내는 구단에 거절할 수 없습니다${relegationRisk(w, w.userClubId) ? ' · 우리 구단은 강등 위험 구단이라 조항이 없으면 선수가 망설입니다' : ''}`}
      className="h-11 rounded-lg border border-line bg-ink-850 px-3 text-[13px] text-hi max-sm:flex-1">
      {opts.map((o) => <option key={o.mult} value={o.fee}>{o.fee ? `강등 조항 ${money(o.fee)}` : '강등 조항 없음'}{o.mult < 0 ? ' (지금)' : ''}</option>)}
    </select>
  );
}
/** 기본 선택: 바이아웃 없음 (일반 계약). 스페인처럼 의무인 리그는 가장 높은 값 */
export const defaultBuyout = (w: World, p: PlayerState) => buyoutOptions(w, p, w.userClubId).find((o) => o.mult === 0)?.fee ?? buyoutOptions(w, p, w.userClubId).at(-1)!.fee;

export type Who = 'me' | 'club' | 'player' | 'sys';
export interface Msg { who: Who; text: string; tone?: 'ok' | 'warn' | 'bad' }

/** 금액 입력 + 조금씩 올리고 내리기 */
function Amount({ label, unit, value, step, onChange, onEnter }: { label: string; unit: string; value: number; step: number[]; onChange: (v: number) => void; onEnter: () => void }) {
  const fix = (v: number) => Math.max(0, Math.round(v * 10) / 10);
  return (
    <div className="flex items-stretch gap-1.5">
      {[...step].reverse().map((s) => <button key={-s} onClick={() => onChange(fix(value - s))} className="tap h-11 w-10 shrink-0 rounded-lg bg-ink-800 text-[12px] text-mid ring-1 ring-line hover:text-hi max-sm:w-9">−{s}</button>)}
      <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-ink-850 px-3 text-[12px] text-lo">
        <span className="shrink-0 max-sm:hidden">{label}</span>
        <input type="number" step={step[0]} min={0} value={value} onChange={(e) => onChange(+e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onEnter()} className="tnum w-full min-w-0 flex-1 bg-transparent text-right text-[17px] font-semibold text-hi outline-none" />
        <span className="shrink-0">{unit}</span>
      </label>
      {step.map((s) => <button key={s} onClick={() => onChange(fix(value + s))} className="tap h-11 w-10 shrink-0 rounded-lg bg-ink-800 text-[12px] text-mid ring-1 ring-line hover:text-hi max-sm:w-9">+{s}</button>)}
    </div>
  );
}

/** 0~100 막대 (인내심 · 선수 마음) */
function Meter({ pct, tone, mark }: { pct: number; tone: string; mark?: number }) {
  return (
    <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
      <div className={`h-full rounded-full transition-all duration-300 ${tone}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      {mark != null && <span className="absolute top-0 h-full w-0.5 bg-hi/60" style={{ left: `${mark}%` }} />}
    </div>
  );
}

function Chip({ children, on, onClick, title }: { children: React.ReactNode; on?: boolean; onClick: () => void; title?: string }) {
  return <button onClick={onClick} title={title} className={`tap h-7 rounded-md px-2.5 text-[12px] transition-colors ${on ? 'bg-neon-ghost font-semibold text-neon ring-1 ring-neon/40' : 'bg-ink-800 text-mid ring-1 ring-line hover:text-hi'}`}>{children}</button>;
}

export function NegotiationModal({ p, onClose }: { p: PlayerState; onClose: () => void }) {
  const w = useWorld();
  const { bid, sign, precontract } = useGame();
  const [bosman] = useState(() => bosmanEligible(w, p, w.userClubId));   // 보스만 사전 계약: 이적료 없이 개인 계약만 (7월 합류). 창을 연 때 기준
  const fa = !p.clubId || bosman;
  const club = p.clubId;
  const talk = w.talks?.[p.id];
  const value = marketValue(w, p);
  const budget = w.clubs[w.userClubId].finance.transferBudget;
  const [clause, setClause] = useState(() => defaultBuyout(w, p));
  const [rel, setRel] = useState(0);   // 강등 조항 (1부 리그 구단만)
  const demandOf = (c: number, r: number) => wageDemand(w, p, w.userClubId) * buyoutWageFactor(w, p, c) * relWageFactor(w, p, r);
  const demand = Math.round(demandOf(clause, rel) / 500) * 500;
  const theirClause = club ? buyoutOf(w, p) : 0;
  const bargain = club ? bargainOf(w, p) : null;   // 급매물 (강제 매각 · 강등 조항 발동)
  const relClause = club && !bargain ? relClauseOf(w, p) : 0;
  const [stage, setStage] = useState<'fee' | 'contract'>(fa || talk?.agreed != null ? 'contract' : 'fee');
  const [fee, setFee] = useState(Math.round((talk?.agreed ?? value * 0.9) / 1e5) / 10);
  // 이적 조건 (선택): 셀온 % · 보너스 (출전 경기 수 · 금액 M)
  const [extra, setExtra] = useState(false);
  const [sellOn, setSellOn] = useState(0);
  const [bApps, setBApps] = useState(0);
  const [bAmt, setBAmt] = useState(0);
  const terms = (): DealTerms | undefined => (sellOn || (bApps && bAmt > 0) ? { ...(sellOn ? { sellOn } : {}), ...(bApps && bAmt > 0 ? { bonus: { amount: Math.round(bAmt * 1e6), apps: bApps } } : {}) } : undefined);
  const termsText = (t?: DealTerms) => (t ? [t.sellOn ? `셀온 ${t.sellOn}%` : '', t.bonus ? `보너스 ${money(t.bonus.amount)} (출전 ${t.bonus.apps}경기)` : ''].filter(Boolean).join(' · ') : '');
  const [wage, setWage] = useState(Math.round(demand / 1000));
  const [years, setYears] = useState(3);
  const [role, setRole] = useState<Role>(() => autoRole(w, p, w.userClubId));
  const [broken, setBroken] = useState(!!talkBanned(w, p.id));
  const hint = club && !fa ? sellerHint(w, p) : null;
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    bosman ? { who: 'sys', text: `계약이 이번 시즌 끝에 끝나는 선수입니다 (보스만). 이적료 없이 사전 계약하면 ${p.contract?.slice(0, 4)}년 7월에 합류합니다.` }
      : fa ? { who: 'sys', text: '자유계약 선수입니다. 이적료 없이 주급과 계약 기간만 협상하면 됩니다.' }
      : talk?.agreed != null ? { who: 'sys', text: `${clubKo(club!)}와 이적료 ${money(talk.agreed)}${talk.terms ? ` (${termsText(talk.terms)})` : ''}에 합의한 상태입니다. 선수와 개인 계약을 협상하세요.` }
      : bargain ? { who: 'sys', tone: 'warn', text: bargain.kind === 'fire' ? `${clubKo(club!)}가 재정 위기로 ${money(bargain.price)}에 내놓은 선수입니다 (시장 가치보다 싸게). 이 금액이면 핵심 선수라도 보냅니다.` : `강등 조항이 발동한 선수입니다. ${money(bargain.price)}이면 ${clubKo(club!)}는 거절할 수 없습니다.` }
      : { who: 'sys', text: `${clubKo(club!)}에 이적료를 제안하세요. 구단은 원하는 금액을 처음부터 말하지 않고, 낮게 부르면 조금씩 내려오는 역제안을 합니다. 너무 낮으면 (무례한 제안) 인내심이 크게 깎이고, 바닥나면 협상이 끝납니다.` },
    ...(talkBanned(w, p.id) ? [{ who: 'sys' as Who, tone: 'bad' as const, text: '이미 협상이 결렬된 선수입니다. 이번 이적시장 동안은 다시 협상할 수 없습니다.' }] : []),
  ]);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' }); }, [msgs]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fst = feeState(w, p, terms());
  const tries = stage === 'fee' ? FEE_TRIES : MAX_TRIES;
  const used = stage === 'fee' ? fst.used : w.talks?.[p.id]?.wage ?? 0;
  const left = broken ? 0 : tries - used;
  const push = (...m: Msg[]) => setMsgs((x) => [...x, ...m]);
  const fail = () => { setBroken(true); push({ who: 'sys', tone: 'bad', text: '협상 결렬 — 이번 이적시장 동안 이 선수와는 다시 협상할 수 없습니다.' }); };

  const sendFee = (f = fee, cashOnly = false) => {
    const tm = cashOnly ? undefined : terms();
    const r = bid(p.id, f * 1e6, tm);
    push({ who: 'me', text: f * 1e6 >= theirClause && theirClause > 0 ? `바이아웃 ${money(f * 1e6)} 지불` : `이적료 ${money(f * 1e6)} 제안${tm ? ` + ${termsText(tm)}` : ''}` });
    if (r.blocked) return push({ who: 'sys', tone: 'warn', text: r.blocked });
    if (r.decision === 'accept') {
      push(f * 1e6 >= theirClause && theirClause > 0 ? { who: 'club', tone: 'warn', text: '바이아웃 조항이라 거절할 수 없습니다. 선수와 이야기해 보시죠.' } : { who: 'club', tone: 'ok', text: `좋습니다. ${money(f * 1e6)}에 보내겠습니다.` }, { who: 'sys', text: '이적료 합의 완료 — 이제 선수와 개인 계약을 협상하세요.' });
      setStage('contract');
      return;
    }
    push({ who: 'club', tone: r.insult ? 'bad' : 'warn', text: r.reason });
    if (r.counterCash) setFee(Math.round(r.counterCash / 1e5) / 10);
    if (r.broken) fail();
  };
  const sendContract = () => {
    const r = bosman ? precontract(p.id, wage * 1000, years, role, clause) : sign(p.id, wage * 1000, years, role, clause, relClauseAllowed(w, w.userClubId) ? rel : undefined);
    push({ who: 'me', text: `주급 ${money(wage * 1000)} · ${years}년 · ${ROLE_KO[role]} · ${clause ? `바이아웃 ${money(clause)}` : '바이아웃 없음'}${!bosman && rel ? ` · 강등 조항 ${money(rel)}` : ''} 제안` });
    if (r.ok) { if (bosman) { push({ who: 'player', tone: 'ok', text: r.reason }); setBroken(true); return; } onClose(); return; }
    push({ who: r.left === undefined ? 'sys' : 'player', tone: 'warn', text: r.reason });
    if (r.broken) fail();
  };
  // 계약 후 여유: 예산 · 규정 중 좁은 쪽. 규정에는 합의한 이적료의 상각 (이적료 ÷ 계약 연수)도 들어간다
  const ri = wageRoomInfo(w, w.userClubId, fa ? 0 : w.talks?.[p.id]?.agreed ?? 0, years);
  const room = ri.room - wage * 1000;
  // 선수 마음 (실시간): 요인 합. 숨은 성향(야망 · 충성)은 스카우트로 알아야 이름이 보인다
  const join = joinFactors(w, p, w.userClubId, wage * 1000, role, clause, bosman, bosman ? undefined : rel, years);
  const known = hiddenKnown(w, p) || !p.clubId;
  const factors = known ? join.factors : (() => {
    const hid = join.factors.filter((x) => /야망|충성/.test(x.label)).reduce((a, x) => a + x.v, 0);
    return [...join.factors.filter((x) => !/야망|충성/.test(x.label)), ...(Math.abs(hid) >= 0.05 ? [{ label: '성향 (스카우트하면 자세히)', v: hid }] : [])].sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  })();
  const want = Math.round(join.demand / 500) * 500;
  const lowWage = wage * 1000 < join.demand * 0.9;
  const joinPct = ((join.score + 3) / 6) * 100, linePct = ((JOIN_LINE + 3) / 6) * 100;
  const joinOk = !lowWage && join.score > JOIN_LINE;
  const joinLabel = lowWage ? '주급이 너무 낮다고 느낌' : join.score > JOIN_LINE + 1.2 ? '오고 싶어 함' : join.score > JOIN_LINE ? '마음이 기움' : join.score > JOIN_LINE - 0.8 ? '망설임' : '오기 싫어함';
  const joinTone = !joinOk ? 'bg-amber' : join.score > JOIN_LINE + 1.2 ? 'bg-neon' : 'bg-sky';
  const moodTone = fst.mood >= 60 ? 'bg-neon' : fst.mood >= 30 ? 'bg-amber' : 'bg-red';
  const t = terms();

  return (
    <div className="fixed inset-0 z-50 grid animate-[fade_0.2s_ease-out] place-items-center bg-ink-950/80 p-2 sm:p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="panel flex max-h-[min(94dvh,880px)] w-full max-w-[620px] flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 선수 */}
        <header className="flex items-center gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="tnum grid h-12 min-w-12 shrink-0 place-items-center rounded-lg border border-line bg-ink-900 px-1.5 text-[22px]"><OvrText w={w} p={p} className={seenOverall(w, p)[0] === seenOverall(w, p)[1] ? '' : 'text-[15px]'} /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[19px] font-semibold">{playerKo(p.id, p.name)}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-lo">
              <PosTag pos={p.pos} />{ageOn(p.birth, w.date)}세 ·
              {club ? <><Crest clubId={club} size={14} />{clubKo(club)}</> : <span className="text-neon">자유계약 (FA)</span>}{bosman && <span className="rounded bg-neon-ghost px-1 text-[11px] font-semibold text-neon">보스만</span>}
              {appealOf(w, p) && <span className="rounded bg-neon/15 px-1.5 text-[11px] font-semibold text-neon" title="이적 어필: 우리 구단에 오고 싶어 해서 주급을 15% 덜 요구합니다">우리 구단 희망</span>}
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-md text-[18px] text-lo transition-colors hover:bg-ink-800 hover:text-hi" aria-label="닫기">×</button>
        </header>

        {/* 단계 · 남은 기회 */}
        <div className="flex items-center gap-2 border-b border-line px-5 py-2.5 text-[12px] sm:px-6">
          {!fa && <Step n={1} label="이적료 (구단)" on={stage === 'fee'} done={stage === 'contract'} />}
          {!fa && <span className="h-px w-5 bg-line-strong" />}
          <Step n={fa ? 1 : 2} label="개인 계약 (선수)" on={stage === 'contract'} done={false} />
          <span className="ml-auto flex items-center gap-1.5 text-lo"><span className="max-sm:hidden">남은 기회</span>
            {Array.from({ length: tries }, (_, i) => <span key={i} className={`h-2 w-2 rounded-full ${i < left ? 'bg-neon' : 'bg-ink-700'}`} />)}
          </span>
        </div>

        {/* 상황판 */}
        {!broken && (stage === 'fee' ? (
          <div className="grid shrink-0 grid-cols-3 gap-px border-b border-line bg-line text-[12px]">
            <div className="bg-ink-900 px-3 py-2.5 sm:px-4">
              <div className="text-lo">구단 요구</div>
              <div className={`tnum mt-0.5 text-[15px] font-semibold ${fst.final ? 'text-amber' : fst.counterCash ? 'text-hi' : 'text-lo'}`}>{fst.counterCash ? money(fst.counterCash) : '아직 모름'}</div>
              <div className="text-[11px] text-lo">{fst.final ? '마지막 양보' : fst.counterCash ? '역제안 · 이 조건 기준' : '제안하면 역제안'}</div>
            </div>
            <div className="bg-ink-900 px-3 py-2.5 sm:px-4">
              <div className="flex justify-between text-lo"><span>구단 인내심</span><span className="tnum">{fst.mood}</span></div>
              <Meter pct={fst.mood} tone={moodTone} />
              <div className="mt-1 text-[11px] text-lo">{fst.mood >= 60 ? '여유 있음' : fst.mood >= 30 ? '짜증 내는 중' : '곧 협상을 끝냄'}</div>
            </div>
            <div className="bg-ink-900 px-3 py-2.5 sm:px-4">
              <div className="text-lo">시장 가치</div>
              <div className="tnum mt-0.5 text-[15px] font-semibold">{money(value)}</div>
              <div className="text-[11px] text-lo">예산 <span className="tnum">{money(budget)}</span></div>
            </div>
            {hint && !fst.counterCash && !bargain && <div className={`col-span-3 bg-ink-900 px-3 py-2 text-[12px] sm:px-4 ${hint.level === 'high' ? 'text-amber' : hint.level === 'low' ? 'text-neon' : 'text-mid'}`}>구단 분위기 · {hint.text}</div>}
          </div>
        ) : (
          <div className="shrink-0 border-b border-line bg-ink-900 px-5 py-3 text-[12px] sm:px-6">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-lo">선수 마음 <span className={`ml-1 font-semibold ${!joinOk ? 'text-amber' : joinTone === 'bg-neon' ? 'text-neon' : 'text-sky'}`}>{joinLabel}</span></span>
              <span className="text-lo">원하는 주급 <span className="tnum font-semibold text-hi">{money(want)}</span></span>
            </div>
            <Meter pct={joinPct} tone={joinTone} mark={linePct} />
            <div className="mt-2 flex flex-wrap gap-1">
              {factors.slice(0, 6).map((x) => (
                <span key={x.label} className={`rounded px-1.5 py-px text-[11px] ${x.v > 0 ? 'bg-neon/10 text-neon' : 'bg-amber/10 text-amber'}`}>{x.v > 0 ? '+' : '−'} {x.label}</span>
              ))}
            </div>
          </div>
        ))}

        {/* 대화 */}
        <div ref={log} className="min-h-[96px] flex-1 space-y-2 overflow-auto px-5 py-4 sm:px-6">
          {msgs.map((m, i) => <Bubble key={i} m={m} club={club} />)}
        </div>

        {/* 입력 */}
        <footer className="shrink-0 border-t border-line bg-ink-900/50 px-5 py-4 sm:px-6">
          {broken ? (
            <button onClick={onClose} className="h-11 w-full rounded-lg bg-ink-700 text-[14px] font-semibold text-hi transition-colors hover:bg-ink-750">닫기</button>
          ) : stage === 'fee' ? (
            <div className="space-y-2.5">
              <Amount label="이적료" unit="백만 유로" value={fee} step={[0.5, 2]} onChange={setFee} onEnter={() => sendFee()} />
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip onClick={() => setFee(Math.round(value / 1e5) / 10)}>시장 가치 {money(value)}</Chip>
                {fst.counterCash && <Chip on onClick={() => setFee(Math.round(fst.counterCash! / 1e5) / 10)} title="구단 역제안 금액 (지금 고른 셀온 · 보너스 기준)">역제안 맞추기 {money(fst.counterCash)}</Chip>}
                <Chip on={extra || !!t} onClick={() => setExtra((v) => !v)} title="셀온 · 보너스를 걸면 구단이 그만큼 현금을 덜 받습니다">추가 조건{t ? ` · ${termsText(t)}` : ''} {extra ? '▴' : '▾'}</Chip>
              </div>
              {extra && (
                <div className="space-y-1.5 rounded-lg bg-ink-850 p-2.5 text-[12px] text-lo ring-1 ring-line">
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={sellOn} onChange={(e) => setSellOn(+e.target.value)} title="셀온: 나중에 이 선수를 다시 팔면 그 이적료의 몇 %를 지금 구단에 줍니다. 어린 선수일수록 구단이 반깁니다" className="h-9 rounded-lg border border-line bg-ink-900 px-2 text-[12px] text-hi max-sm:flex-1">
                      {SELL_ON_PCTS.map((x) => <option key={x} value={x}>{x ? `셀온 ${x}%` : '셀온 없음'}</option>)}
                    </select>
                    <select value={bApps} onChange={(e) => { setBApps(+e.target.value); if (+e.target.value && !bAmt) setBAmt(Math.min(Math.round(fee * 0.15 * 2) / 2 || 0.5, bonusCap(fee * 1e6) / 1e6)); }} title="보너스: 이 선수가 우리 구단에서 그만큼 출전하면 이 금액을 더 냅니다 (리그 · 컵, 교체 포함)" className="h-9 rounded-lg border border-line bg-ink-900 px-2 text-[12px] text-hi max-sm:flex-1">
                      <option value={0}>보너스 없음</option>
                      {BONUS_APPS.map((x) => <option key={x} value={x}>보너스: 출전 {x}경기</option>)}
                    </select>
                    {bApps > 0 && (
                      <label className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-2 text-[12px] max-sm:flex-1"><span className="shrink-0">금액</span>
                        <input type="number" step={0.5} min={0} max={bonusCap(fee * 1e6) / 1e6} value={bAmt} onChange={(e) => setBAmt(+e.target.value)} className="tnum w-14 min-w-0 flex-1 bg-transparent text-right font-semibold text-hi outline-none" />백만 유로
                      </label>
                    )}
                  </div>
                  <div>{t ? <>구단이 보는 조건 값어치 약 <span className="tnum text-mid">{money(termsWorth(w, p, fee * 1e6, t))}</span> — 그만큼 현금을 덜 받습니다 (어린 선수일수록 셀온 값어치 ↑ · 보너스는 이적료의 절반까지)</> : '셀온 · 보너스를 걸면 구단이 그 값어치만큼 현금을 덜 받습니다'}</div>
                </div>
              )}
              <button onClick={() => sendFee()} disabled={fee * 1e6 > budget || fee <= 0} className="h-11 w-full rounded-lg bg-neon text-[14px] font-semibold text-ink-950 transition-colors hover:bg-[#5bff3d] disabled:bg-ink-700 disabled:text-lo">
                {fee * 1e6 > budget ? '이적 예산 부족' : `${money(fee * 1e6)}${t ? ` + ${termsText(t)}` : ''} 제안하기`}
              </button>
              {bargain && (
                <button onClick={() => { setFee(bargain.price / 1e6); sendFee(bargain.price / 1e6, true); }} disabled={bargain.price > budget}
                  className="h-10 w-full rounded-lg border border-red/50 text-[13px] font-semibold text-red transition-colors hover:bg-red/10 disabled:border-line disabled:text-lo">
                  {bargain.kind === 'fire' ? '강제 매각가' : '강등 조항'} {money(bargain.price)} 제안{bargain.price > budget ? ' (이적 예산 부족)' : ''}
                </button>
              )}
              {relClause > 0 && <div className="text-[12px] text-amber">강등 조항: {clubKo(club!)}가 강등되면 {money(relClause)}에 거절할 수 없는 이적이 가능해집니다</div>}
              {theirClause > 0 && (
                <button onClick={() => { setFee(theirClause / 1e6); sendFee(theirClause / 1e6, true); }} disabled={theirClause > budget}
                  title="바이아웃 금액을 내면 구단은 거절할 수 없습니다 (선수 동의는 따로)"
                  className="h-10 w-full rounded-lg border border-amber/50 text-[13px] font-semibold text-amber transition-colors hover:bg-amber/10 disabled:border-line disabled:text-lo">
                  바이아웃 {money(theirClause)} 지불{theirClause > budget ? ' (이적 예산 부족)' : ''}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <Amount label="주급" unit="천 유로" value={wage} step={[1, 10]} onChange={setWage} onEnter={sendContract} />
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <Chip on={Math.round(want / 1000) === wage} onClick={() => setWage(Math.round(want / 1000))}>요구 주급 맞추기 {money(want)}</Chip>
                <Chip onClick={() => setWage(Math.round(p.wage / 1000))}>지금 주급 {money(p.wage)}</Chip>
                <span className={`ml-auto ${room < 0 ? 'text-red' : 'text-lo'}`}>계약 후 주급 여유 <span className="tnum">{room < 0 ? `−${money(-room)}` : money(room)}</span></span>
              </div>
              <div className="grid grid-cols-2 gap-2 [&>select]:w-full">
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} title="약속하는 역할: 높을수록 선수가 오려고 하지만, 약속만큼 못 뛰면 불만이 빨리 생깁니다" className="h-11 rounded-lg border border-line bg-ink-850 px-3 text-[13px] text-hi">
                  {ROLES.map((x) => <option key={x} value={x}>역할: {ROLE_KO[x]}</option>)}
                </select>
                <select value={years} onChange={(e) => setYears(+e.target.value)} title="30세 이상은 긴 계약을, 어린 선수는 너무 길지 않은 계약을 반깁니다" className="h-11 rounded-lg border border-line bg-ink-850 px-3 text-[13px] text-hi">
                  {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>계약 {y}년</option>)}
                </select>
                <BuyoutSelect w={w} p={p} value={clause} onChange={(v) => { setClause(v); setWage(Math.round(demandOf(v, rel) / 1000)); }} />
                {!bosman && <RelSelect w={w} p={p} value={rel} onChange={(v) => { setRel(v); setWage(Math.round(demandOf(clause, v) / 1000)); }} />}
              </div>
              <button onClick={sendContract} disabled={room < 0} className="h-11 w-full rounded-lg bg-neon text-[14px] font-semibold text-ink-950 transition-colors hover:bg-[#5bff3d] disabled:bg-ink-700 disabled:text-lo">
                {room < 0 ? '주급 여유 부족' : bosman ? '사전 계약 제안' : joinOk ? '계약 제안' : '계약 제안 (지금은 거절할 가능성이 큼)'}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}


function Step({ n, label, on, done }: { n: number; label: string; on: boolean; done: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${on ? 'font-semibold text-hi' : done ? 'text-neon' : 'text-lo'}`}>
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${on ? 'bg-neon text-ink-950' : done ? 'bg-neon-ghost text-neon' : 'bg-ink-800'}`}>{done ? '✓' : n}</span>{label}
    </span>
  );
}

export function Bubble({ m, club }: { m: Msg; club: string | null }) {
  if (m.who === 'sys') {
    const cls = m.tone === 'bad' ? 'border-red/40 bg-red/10 text-red' : m.tone === 'warn' ? 'border-amber/40 bg-amber/10 text-amber' : 'border-line bg-ink-850 text-mid';
    return <div className={`rounded-lg border px-4 py-2.5 text-center text-[13px] ${cls}`}>{m.text}</div>;
  }
  const me = m.who === 'me';
  const tone = m.tone === 'ok' ? 'text-neon' : m.tone === 'warn' ? 'text-amber' : 'text-hi';
  return (
    <div className={`flex animate-[fade_0.2s_ease-out] ${me ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-[13px] ${me ? 'bg-ink-700 text-hi' : 'bg-ink-850 ring-1 ring-line'}`}>
        {!me && <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-lo">{m.who === 'club' && club ? <><Crest clubId={club} size={12} />{clubKo(club)}</> : '선수 측 에이전트'}</div>}
        <span className={me ? '' : tone}>{m.text}</span>
      </div>
    </div>
  );
}
