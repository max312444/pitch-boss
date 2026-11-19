// 게임 진행 상태: 월드(엔진 상태) + 진행 중인 사용자 경기.
// 엔진은 월드를 직접 수정하므로, 화면 갱신은 rev 숫자를 올려서 알린다.
import { applyMatchEvent, rollMatchEvent, type MatchEvent } from '../engine/matchEvents';
import { shootout } from '../engine/cup';
import { worldCupYear } from '../engine/worldcup';
import { autoCallUp, cycleStage, intlNextSeason, repairIntl, setupIntl, squadSize, switchNation } from '../engine/intl';
import { setWcPools, setWcSquads } from '../engine/wcsquads';
import { termsError, type DealTerms } from '../engine/addons';
import { newCareerId, recordCareer } from './careers';
import { changeRole, type Role } from '../engine/roles';
import { create } from 'zustand';
import type { Fixture, GameEvent, Side, Tactics, World } from '../engine/types';
import { advanceDay, advanceToUserMatch, applyMatch, createWorld, prepareMatch, type SeasonInput, decidesOnDraw } from '../engine/world';
import { levelOf, poolOf } from '../engine/pyramid';
import { playToEnd, reshapeTeam, setFormation, setTactics, slotOrder, step, substitute, swapSlots, type MatchState, type TeamInMatch } from '../engine/match';
import type { Instr } from '../engine/types';
import { createRng, type Rng } from '../engine/rng';
import { seedTraits } from '../engine/traits';
import { availableSeasons, clubKo, clubs as clubMasters, dataset, leagues, loadHistory, loadLeagueSeason, loadManagers, loadStandings, playerKo, realAvailable, registerGeneratedNames, registerMyClub, setDataset, worldCupsMeta, loadWcSquads, loadWcPools, loadPublicMap } from '../data/db';
import { currentAsData, investGoal, investStart, myStart, newMyClubId, plainStart, setupMyClub, squadNeeds, swapInput, weakestClub, type MyClubDesign, type MyClubState } from '../engine/myclub';
import type { SquadPlayer } from '../data/types';
import { closeSeason, nextSeasonOf, startNextSeason, type SeasonReport } from '../engine/season';
import { fillContracts, seasonOver } from '../engine/world';
import { ensureManagers } from '../engine/managers';
import { shootoutSeq } from '../engine/shootoutSeq';
import { clinchCheck } from '../engine/clinch';
import { transferBan } from '../engine/ffp';
import { signSponsor as signSponsorDeal } from '../engine/sponsors';
import { recommend, type Recommendation } from '../engine/ai';
import { withinRules } from '../engine/rules';
import { trainingOf, type Training } from '../engine/training';
import { gameSettingsOf, syncWorld, useSettings } from './settings';
import { useApp } from './app';
import { acceptOffer, chooseJob, declineOffer, ensureManager } from '../engine/manager';
import { askBoard, type BoardAsk } from '../engine/board';
import { resolveBoardEvent } from '../engine/boardEvents';
import { answerPress, pressReaction } from '../engine/press';
import { sagaRespond, type SagaAction } from '../engine/saga';
import { pressPlay } from '../engine/appeal';
import { negotiateFee, type FeeResult } from '../engine/negotiation';
import { scandalRespond, type ScandalAction } from '../engine/scandal';
import { evaluateLoan, exerciseBuy, loanMove, loanReturn, playerWillLoan, type LoanTerms } from '../engine/loan';
import { breakTalks, cleanOffers, completeTransfer, counterOffer, offerValid, MAX_TRIES, playerWillJoin, releasePlayer, talkBanned, talkOf, wageDemand, wageRoom, windowOpen } from '../engine/transfer';
import type { RetireNews, TransferOffer } from '../engine/types';
import { applyRenewal, evaluateRenewal } from '../engine/contract';
import { buyoutMandatory, setBuyout, setRelClause } from '../engine/clauses';
import { bosmanEligible, signPrecontract } from '../engine/bosman';
import { logDeal } from '../engine/dealLog';
import { meetingReady, teamMeeting } from '../engine/chemistry';
const addDaysIso = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
import { CUSTOM_MARK, famOf, FORMATIONS, formationShape, guessFormation, matchRules, MAX_CUSTOM, pickLineup, registerFormations, validateFormation } from '../engine/squad';
import { moveFree, type Placement } from '../engine/placement';

/** 한 자리만 바꾼 변형은 원래 포메이션 숙련도에서 10만 깎아 이어받는다 (새 포메이션처럼 30% 로 떨어지지 않게) */
function inheritFam(c: World['clubs'][string], from: string, to: string) {
  if (from === to) return;
  const fam = (c.formFam ??= {});
  fam[to] = Math.max(fam[to] ?? 0, famOf(c, from) - 10);
}

/** 끌어다 놓아 만든 자리 구성이 기본 포메이션에 없으면: 사용자 포메이션 '★ 내 배치'로 저장 (덮어씀). 키 또는 오류 문장 */
/** 경기 중 배치를 한 장면으로 되돌림 (교체 · 퇴장으로 없는 선수는 건너뜀). 오류 문구 또는 null */
function restoreLayout(w: World, st: MatchState, side: Side, snap: LayoutSnap): string | null {
  const t = st[side];
  let key = snap.formation;
  if ((FORMATIONS[key] ?? []).join() !== snap.slots.join()) {   // ★ 내 배치 가 그 뒤 다른 모양으로 바뀌었으면 다시
    const a = autoFormation(w, snap.slots);
    if ('error' in a) return a.error;
    key = a.key;
  }
  const rest = [...t.onPitch];
  const next = snap.ids.flatMap((id, j) => {
    const k = rest.findIndex((o) => o.id === id);
    return k < 0 ? [] : [{ ...rest.splice(k, 1)[0], slot: snap.slots[j], instr: snap.instr[j] }];
  });
  t.onPitch = [...next, ...rest];
  t.tactics = { ...t.tactics, formation: key, xy: snap.xy };
  return null;
}
function autoFormation(w: World, slots: Position[]): { key: string } | { error: string } {
  const errs = validateFormation(slots);
  if (errs.length) return { error: errs[0] };
  const all = (w.customFormations ??= {});
  const same = Object.entries(all).find(([, xs]) => JSON.stringify(xs) === JSON.stringify(slots));
  if (same) return { key: same[0] };
  const key = `${CUSTOM_MARK} 내 배치`;
  if (!all[key] && Object.keys(all).length >= MAX_CUSTOM) return { error: `내 포메이션이 ${MAX_CUSTOM}개로 가득 차 새 배치를 저장할 수 없습니다` };
  all[key] = [...slots];
  registerFormations(all);
  return { key };
}
import type { Position } from '../data/types';
import { startScout } from '../engine/scout';
import type { Mentality, Pressing } from '../engine/types';
import { exportSaveFile, readSave, readSaveFile, writeSave } from './save';
import type { Ceremony } from '../ui/components/TransferCeremony';
import { startRetrain, stopRetrain } from '../engine/retrain';
import { academyOn, academySeason, promote, releaseAcademy } from '../engine/academy';
import { MAX_SQUAD } from '../engine/season';
import type { Award } from '../engine/awards';

/** 시즌 데이터 불러오기: 그 시즌 데이터가 있는 1부 · 2부 리그 전부 */
async function loadSeasonInput(season: string, mustInclude?: string): Promise<SeasonInput> {
  const ids = leagues.filter((l) => l.level <= 2 && availableSeasons(l.id).includes(season)).map((l) => l.id);
  if (mustInclude && !ids.includes(mustInclude) && availableSeasons(mustInclude).includes(season)) ids.unshift(mustInclude);
  const loaded = await Promise.all(ids.map(async (id) => ({ id, clubs: (await loadLeagueSeason(season, id)).clubs })));
  // 첫 시즌 유럽 대회 출전권: 실제 지난 시즌 순위 (있는 리그만)
  const y = +season.slice(0, 4) - 1;
  const prev = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  const prevStandings: Record<string, string[]> = {};
  for (const id of ids) { const st = await loadStandings(prev, id); if (st) prevStandings[id] = st; }
  // 아래 리그 대기열: 직전 시즌 2부에 있다가 이번 시즌 1부 · 2부에 없는 구단 (실제로 3부로 강등) → 데이터가 끝난 뒤 2부를 채운다
  const here = new Set(loaded.flatMap((l) => l.clubs.map((c) => c.club)));
  const pools: NonNullable<SeasonInput['pools']> = [];
  for (const id of ids) {
    if (levelOf(id) !== 2 || !availableSeasons(id).includes(prev)) continue;
    const gone = (await loadLeagueSeason(prev, id)).clubs.filter((c) => !here.has(c.club));
    if (gone.length) pools.push({ league: poolOf(id), clubs: gone });
  }
  return { season, leagues: loaded, prevStandings, worldCups: worldCupsMeta, managers: await loadManagers(), ...(pools.length ? { pools } : {}) };
}

// 자동 저장: 진행 중 연속 호출을 묶어서 한 번만
let autoTimer: ReturnType<typeof setTimeout> | null = null;
/** 자동 저장 (설정: 진행할 때마다 · 1주 · 1달 · 안 함) */
let lastAutoDate = '';
/** 큰 경기: 유럽 대회 · 컵 결승 · 플레이오프 · 비슷하거나 강한 상대 (설정 '중요한 일만' 에서 직접 지휘) */
function bigMatch(w: World, f: Fixture): boolean {
  if (f.stage && f.stage !== 'cup') return true;
  if (f.stage === 'cup' && /결승|준결승/.test(f.name ?? '')) return true;
  const opp = f.home === w.userClubId ? f.away : f.home;
  return (w.clubs[opp]?.reputation ?? 0) >= w.clubs[w.userClubId].reputation - 3;
}

function autosave(w: World, force = false) {
  recordCareer(w);   // 명예의 전당 기록 (저장 간격과 상관없이)
  const every = useSettings.getState().s.autosave;
  if (!force) {
    if (every === 'off') return;
    const gap = every === 'week' ? 7 : every === 'month' ? 30 : 0;
    if (gap && lastAutoDate && Math.abs(Date.parse(w.date) - Date.parse(lastAutoDate)) < gap * 864e5) return;
  }
  lastAutoDate = w.date;
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => { writeSave('auto', w).catch((e) => console.error('자동 저장 실패', e)); }, 800);
}

/** 구단 정보의 B팀 → 모구단 (승격 제한 규칙용) */
const reservesOf = (): Record<string, string> => Object.fromEntries([...clubMasters.values()].filter((m) => m.parent).map((m) => [m.id, m.parent!]));

/** 경기 전 스쿼드 설정 (AI 추천으로 시작, 사용자가 수정) */
/** 이벤트 선택 결과 (팝업 자리에 이어서 보여 줌) */
export interface EventResult { tag: string; tone: string; choice?: string; lines: string[]; next?: string }

export interface MatchDraft {
  formation: string;
  mentality: Mentality;
  pressing: Pressing;
  /** 포메이션 자리 순서대로 선발 */
  starters: (string | null)[];
  bench: string[];
  /** 후보를 직접 정함 (빈자리 자동으로 안 채움) */
  benchExact?: boolean;
  /** 자유 배치 (placement.ts) */
  xy?: Placement;
}

/** 경기 중 배치 한 장면 (자리 순서대로 선수 · 지시, 포메이션 · 자유 배치) */
interface LayoutSnap { formation: string; slots: Position[]; ids: (string | null)[]; instr: (Instr | null)[]; xy?: Placement }
const snapOf = (t: TeamInMatch): LayoutSnap => {
  const order = slotOrder(t);
  return { formation: t.tactics.formation, slots: [...(FORMATIONS[t.tactics.formation] ?? [])], ids: order.map((o) => o?.id ?? null), instr: order.map((o) => o?.instr ?? null), xy: t.tactics.xy };
};
export interface LiveMatch {
  fixture: Fixture;
  side: Side;
  rng: Rng;
  /** squad: 경기 전 스쿼드 설정 · live: 진행 중 · full: 종료 */
  phase: 'squad' | 'live' | 'pens' | 'full';
  /** 세계 대회 모드: 경기 중 사건 (고를 때까지 멈춤) · 이번 경기에 나온 종류 */
  event?: MatchEvent;
  evSeen?: string[];
  rec: Recommendation;
  draft: MatchDraft;
  /** 선발 확정 뒤 생성 */
  state: MatchState | null;
  /** 하프타임 배치 되돌리기: base = 하프타임 시작 배치 · hist = 바꾸기 전 배치들 (교체하면 들어온 선수로 바꿔 둠) */
  layout?: { base: LayoutSnap; hist: LayoutSnap[] };
  /** 이 경기로 리그 우승 확정 (남은 경기 수) */
  clinch?: number;
}

const draftFrom = (r: Recommendation): MatchDraft => ({
  formation: r.lineup.formation, mentality: r.tactics.mentality, pressing: r.tactics.pressing,
  starters: r.lineup.starters.map((x) => x.id), bench: [...r.lineup.bench],
});

interface GameStore {
  world: World | null;
  rev: number;
  loading: boolean;
  match: LiveMatch | null;
  lastEvents: GameEvent[];
  seasonReport: SeasonReport | null;
  /** 이벤트 팝업에서 고른 뒤 보여 줄 결과 (같은 자리에 이어서) */
  eventResult: EventResult | null;
  closeEventResult(): void;
  savedAt: string | null;
  /** 불러오기 실패 이유 (화면 안내용) */
  loadError: string | null;
  /** 이적 확정 연출 */
  ceremony: Ceremony | null;
  closeCeremony(): void;
  nextSeason(): Promise<void>;
  dismissReport(): void;
  save(slot: string): Promise<void>;
  load(slot: string): Promise<boolean>;
  /** 파일로 내보내기 · 파일에서 불러오기 (.pitchboss) */
  exportFile(): Promise<void>;
  importFile(file: File): Promise<boolean>;
  setLineup(starters: (string | null)[] | null, bench?: string[], benchExact?: boolean): void;
  /** 전술 화면: 선수를 빈 곳에 끌어다 놓아 그 자리 포지션을 바꿈 → 포메이션 자동 변경. 결과 문장 */
  /** 피치 자유 배치: i 번째 자리 선수를 (x, y)% 로 → 구역 포지션이 바뀌면 포메이션도 (문구 반환) */
  reshapeTactics(slotIdx: number, x: number, y: number): string;
  /** 경기 준비 화면: 같은 동작을 이번 경기 선발에 */
  reshapeDraft(slotIdx: number, x: number, y: number): string;
  /** random: 완전 랜덤으로 고른 구단 → 첫 시즌만 예산 · 재정 규정 한도 보정 */
  newGame(season: string, league: string, clubId: string, opts?: { random?: boolean; manager?: import('../engine/managers').UserManagerInput; /** 나의 구단 만들기: 이 리그 꼴찌 자리를 대신 (clubId 는 무시) */ myClub?: MyClubDesign; /** 나의 구단 인수 방식 (plain 그대로 · invest 투자) */ takeover?: 'plain' | 'invest'; /** 세계 대회 모드: 이 나라 대표팀 감독 (clubId 는 무시) */ intl?: { nation: string } }): Promise<void>;
  continueGame(): void;
  updateDraft(change: Partial<MatchDraft>): void;
  resetDraft(): void;
  confirmLineup(): void;
  /** 이적: 구단에 이적료 제안 (수락되면 계약 협상 단계로) */
  /** 이적료 제안. left = 남은 기회, broken = 협상 결렬 (이번 이적시장 동안 다시 협상 불가) */
  bid(playerId: string, fee: number, terms?: DealTerms): FeeResult & { blocked?: string };
  /** 이적: 선수에게 계약 제안 (fee는 합의된 이적료, 자유계약이면 0) */
  /** 재계약 요청 팝업 닫기 */
  clearRenewals(): void;
  /** 내 선수 재계약 제안 */
  precontract(playerId: string, wage: number, years: number, role?: Role, clause?: number): { ok: boolean; reason: string; left?: number; broken?: boolean };
  clearDeadline(): void;
  setCaptain(playerId: string | null): void;
  holdMeeting(): { ok: boolean; text: string };
  renew(playerId: string, wage: number, years: number, clause?: number, rel?: number): { ok: boolean; reason: string; left?: number; broken?: boolean };
  /** 개인 계약 제안 (이적료는 합의된 금액, 자유계약은 0) */
  sign(playerId: string, wage: number, years: number, role?: Role, clause?: number, rel?: number): { ok: boolean; reason: string; left?: number; broken?: boolean };
  /** 내 선수 역할 바꾸기 */
  setRole(playerId: string, role: Role): void;
  /** 세계 대회 모드: 대표 소집 (넣기 · 빼기) · 추천 명단. 실패하면 이유 */
  callUp(playerId: string, on: boolean): string | null;
  autoSquad(): void;
  /** 세계 대회 모드 협회 평가: 다른 나라 고르기 (null = 제안 거절, 경질이면 거절 불가) */
  chooseIntlJob(nation: string | null): void;
  /** 경기 중 사건 고르기 (우리 페널티는 키커도) · 결과 확인 뒤 닫기 */
  resolveEvent(choice: string, takerId?: string): void;
  closeEvent(): void;
  /** 직접 한 승부차기 결과 (null 이면 자동) */
  finishShootout(res: { home: import('../engine/shootoutSeq').Kick[]; away: import('../engine/shootoutSeq').Kick[] } | null): void;
  toggleShortlist(playerId: string): void;
  /** 이적 희망 선수 언론 플레이 (선수마다 한 번) */
  pressPlay(playerId: string): string;
  toggleTransferList(playerId: string): void;
  release(playerId: string): void;
  answerOffer(offerId: string, accept: boolean): string;
  /** 받은 제안에 역제안 (이적료). done = 이적 성사, gone = 제안이 사라짐 */
  counter(offerId: string, ask: number, sellOn?: number): { result: 'accept' | 'raise' | 'reject' | 'withdraw' | 'gone'; fee: number; reason: string; done?: boolean };
  stepMatch(n?: number): void;
  /** 포지션 전환 훈련 시작 · 멈춤 (내 선수) */
  retrain(playerId: string, pos: Position | null): { ok: boolean; reason: string };
  /** 유스 아카데미: 1군 승격 · 방출 */
  academyAct(id: string, act: 'promote' | 'release'): { ok: boolean; reason: string };
  /** 패러디 이름 세이브를 실명 데이터로 바꿔 불러오기 (실명 데이터가 있을 때) */
  convertToReal(slot: string): void;
  changeTactics(t: Partial<Tactics>): void;
  /** 경기 중 포메이션 바꾸기 */
  changeFormation(formation: string): void;
  /** 경기 중 피치: 두 선수 자리 맞바꿈 · 한 선수를 빈 곳(새 포지션)으로 → 포메이션 변경 (문구 반환) */
  liveSwap(a: string, b: string): string;
  /** 경기 중 피치 선수를 빈 자리(퇴장 등)로 옮김 → 원래 자리가 빈다 (문구 반환) */
  liveToSlot(id: string, slotIdx: number): string;
  /** 스폰서 제안 수락 */
  signSponsor(offerId: string): void;
  liveReshape(slotIdx: number, x: number, y: number): string;
  /** 하프타임 배치: 시작 (base 저장) · 끝 · 이전으로 · 하프타임 배치로 초기화 (문구 반환) */
  layoutBegin(): void;
  layoutEnd(): void;
  layoutUndo(): string;
  layoutReset(): string;
  sub(outId: string, inId: string): boolean;
  /** 경기 중 자동 교체 켜기 · 끄기 (설정에도 기억) */
  setAutoSub(on: boolean): void;
  setClubTactics(t: Partial<Tactics>): void;
  /** 내 포메이션 저장 (prev: 고치는 포메이션 이름) → 오류 문구 또는 null */
  saveFormation(prev: string | null, name: string, slots: Position[]): string | null;
  deleteFormation(key: string): void;
  /** 스카우트 보내기: 선수 한 명 · 리그 전체 */
  scout(kind: import('../engine/scout').ScoutKind, target: string): { ok: boolean; reason?: string };
  /** 훈련 초점 · 강도 */
  setTraining(t: Partial<Training>): void;
  /** 감독: 제안 수락 · 거절 · 새 구단 고르기 · 다른 구단 제안 받기 */
  managerAccept(idx: number): void;
  managerDecline(idx: number): void;
  managerChoose(club: string): void;
  managerSetOpen(open: boolean): void;
  /** 내 감독: 이름 · 축구 철학 · 선호 압박 바꾸기 */
  editMyManager(c: { name?: string; philosophy?: import('../engine/managers').Philosophy; pressing?: import('../engine/types').Pressing }): void;
  /** 시설 투자 (구단 돈 · 공사 기간) */
  upgradeFacility(kind: 'training' | 'youth'): { ok: boolean; reason?: string };
  /** 이사회에 요청 (추가 예산 · 시설) → 확률로 찬성 · 반대 */
  boardAsk(a: BoardAsk): { ok: boolean; text: string };
  /** 이사회 이벤트 선택 */
  boardChoose(key: string): void;
  /** 기자회견 답변 (질문 하나씩, skip = 불참) */
  pressAnswer(key: string): void;
  /** 선수 언론 플레이 대응 · 창 닫기 · 창 열기 */
  sagaRespond(playerId: string, action: SagaAction, label?: string): string;
  sagaClose(): void;
  sagaOpen(playerId: string): void;
  /** 선수 논란 대응 */
  scandalRespond(action: ScandalAction, label?: string): string;
  /** 임대: 다른 구단 선수 빌려 오기 · 내 선수 보내기 · 완전 영입 옵션 행사 */
  loanIn(playerId: string, terms: LoanTerms): { ok: boolean; msg: string };
  loanOut(playerId: string, club: string, terms: LoanTerms): { ok: boolean; msg: string };
  loanBuy(playerId: string): { ok: boolean; msg: string };
  closeMatch(): void;
  /** 킥오프 전 스쿼드 설정에서 홈으로 (경기는 그대로 남고, 계속을 누르면 다시 열림) */
  leaveMatch(): void;
  /** 시즌 말 내 구단 수상 연출 */
  awards: Award[] | null;
  closeAwards(): void;
  /** 은퇴 소식 (수상 연출 다음, 시즌 결산 전) */
  news: RetireNews[] | null;
  closeNews(): void;
  quit(): void;
}

export const useGame = create<GameStore>((set, get) => {
  const bump = () => set((s) => ({ rev: s.rev + 1 }));
  /** 내 선수를 제안한 구단으로 보낸다 (사는 구단은 선수가 원하는 주급을 맞춰 준다) */
  const sellTo = (o: TransferOffer): { ok: boolean; msg: string } => {
    const w = get().world!;
    const p = w.players[o.player];
    const wage = wageDemand(w, p);
    const fail = (why: string, msg: string) => { logDeal(w, { dir: 'out', kind: 'transfer', player: p.id, club: o.from, fee: o.fee, ok: false, why }); return { ok: false, msg }; };
    if (o.fee > w.clubs[o.from].finance.transferBudget || (o.fee > 0 && transferBan(w, o.from))) return fail('사는 구단 예산 부족으로 철회', '그 사이 사는 구단의 예산이 줄어 제안이 철회됐습니다');
    const r = playerWillJoin(w, p, o.from, wage);
    if (!r.ok) return fail('선수가 이적을 거부', `선수가 이적을 원하지 않아 무산됐습니다 (${r.reason})`);
    w.inbox.push(completeTransfer(w, p, o.from, o.fee, wage, 3, { sellOn: o.sellOn, bonus: o.bonus }));
    set({ ceremony: { player: p.id, playerName: p.name, from: w.userClubId, to: o.from, fee: o.fee, wage, years: 3, kind: 'out' } });
    return { ok: true, msg: `이적이 성사됐습니다 · 이적료 ${Math.round(o.fee / 1e5) / 10}M 유로` };
  };
  return {
    world: null, rev: 0, loading: false, match: null, lastEvents: [], seasonReport: null, eventResult: null, savedAt: null, loadError: null, ceremony: null, awards: null, news: null,

    closeCeremony() { set({ ceremony: null }); },
    closeAwards() { set({ awards: null }); },
    closeNews() { set({ news: null }); },

    async newGame(season, league, clubId, opts = {}) {
      set({ loading: true });
      // 그 시즌 데이터가 있는 1부 리그를 모두 불러와 함께 진행한다
      setWcSquads(await loadWcSquads());   // 실제 세계 대회 명단 (본선 · 세계 대회 모드)
      setWcPools(opts.intl ? await loadWcPools() : undefined);   // 나라별 대표 선수 풀 (세계 대회 모드만, 파일이 커서)
      let input = await loadSeasonInput(season, opts.intl ? undefined : league);
      const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
      // 나의 구단: 이 리그 꼴찌 구단을 인수 (그대로 · 투자). 인수 방식이 없으면 예전처럼 선수는 FA 로 · 유스로 시작
      let my: MyClubState | undefined, freed: SquadPlayer[] = [];
      if (opts.myClub) {
        const lg = input.leagues.find((l) => l.id === league)!;
        const rep = weakestClub(lg.clubs);
        const tk = opts.takeover;
        const st = tk === 'plain' ? plainStart(rep) : tk === 'invest' ? investStart(lg.clubs, rep) : { ...myStart(lg.clubs, rep), formation: '4-3-3' };
        my = { id: newMyClubId(seed), replaced: rep.club, nation: clubMasters.get(rep.club)?.nation ?? leagues.find((l) => l.id === league)?.nation ?? 'ENG', founded: +season.slice(0, 4), design: opts.myClub, setup: !tk,
          ...(tk ? { takeover: tk } : {}), ...(tk === 'invest' ? { goal: investGoal(lg.clubs.length, season, leagues.find((l) => l.id === league)?.level ?? 1) } : {}) };
        const sw = swapInput(input, my, st, !!tk);
        input = sw.input; freed = sw.freed; clubId = my.id;
        registerMyClub(my);
      }
      const world = createWorld(input, clubId, seed, { manager: opts.manager, settings: gameSettingsOf(useSettings.getState().s), ...(my && !my.takeover ? { skipFill: [my.id] } : {}) });
      if (my) setupMyClub(world, my, freed);
      if (opts.intl) setupIntl(world, opts.intl.nation);   // 세계 대회 모드: 내 대표팀 · 국내파 · 첫 일정
      else { academySeason(world, season); registerGeneratedNames(Object.fromEntries((world.academy?.players ?? []).map((x) => [x.id, x]))); }   // 내 구단 유스 아카데미 첫 유망주 (한국어 이름 등록)
      registerGeneratedNames(world.managers ?? {});   // 가상 감독 한국어 이름
      world.dataset = dataset;
      world.reserves = reservesOf();   // B팀 → 모구단 (승격 제한)
      world.careerId = newCareerId();
      // 베테랑 · 스타 선수 시작 호칭 (실제 시즌 기록 기준)
      const hist = await loadHistory();
      if (hist) seedTraits(world, hist, createRng((seed ^ 0x7a17) >>> 0));
      if (opts.random) {
        const f = world.clubs[clubId].finance;
        f.transferBudget = Math.round(f.transferBudget * 1.1);
        f.wageBudget = Math.round(f.wageBudget * 1.05);
        world.randomBonus = { season };
        world.inbox.push({ type: 'info', date: world.date, text: '완전 랜덤으로 맡은 구단 · 이번 시즌만 이적 예산 +10% · 주급 예산 +5% · 재정 규정 한도 +5%' });
      }
      syncWorld(world);
      set({ world, loading: false, match: null, lastEvents: [], seasonReport: null });
      autosave(world);
      bump();
    },

    continueGame() {
      const w = get().world;
      if (!w || get().match || w.manager?.pendingJob) return;   // 감독: 새 구단을 골라야 하면 진행 멈춤
      if (w.myClub?.setup) { if (!squadNeeds(w).ok) return; w.myClub.setup = false; }
      if (w.intl?.job?.reason === 'sacked') return;   // 세계 대회 모드: 경질 → 새 나라를 골라야 진행   // 나의 구단: 선수단을 다 채워야 시즌 시작
      syncWorld(w);   // 설정 (팝업 · 난이도) 을 이 게임에 반영
      const st = useSettings.getState().s;
      const startWindow = windowOpen(w.season, w.date);
      const all: GameEvent[] = [];
      // 설정 '계속이 멈추는 곳': 내 경기마다 (기본) · 중요한 일만 · 이적시장 · 시즌 끝까지
      for (let guard = 0; guard < 400; guard++) {
        const { events, matchToday } = advanceToUserMatch(w);
        registerGeneratedNames({ ...w.players, ...Object.fromEntries((w.academy?.players ?? []).map((x) => [x.id, x])) });   // 세계 대회 국내파 가상 선수 한국어 이름
        all.push(...events);
        const m = w.manager;
        const halt = !!(m?.pendingJob || m?.boardEvent || m?.press || w.sagaPrompt || w.scandalPrompt || w.pendingRenewals?.length || seasonOver(w)
          || events.some((e) => e.type === 'seasonEnd' || (e.type === 'injury' && e.club === w.userClubId && (st.stopAt === 'match' || e.days >= 28))));   // 내 경기마다가 아니면 4주 이상 큰 부상만
        if (!matchToday) { if (halt || st.stopAt === 'match') break; continue; }   // 경기 말고 다른 일로 멈춤 (부상 · 재계약 요청 · 시즌 끝 등)
        const side: Side = matchToday.home === w.userClubId ? 'home' : 'away';
        const rng = createRng(w.rng);
        // 경기 전 스쿼드 설정: 상대에 맞춘 AI 추천을 먼저 채워 둔다
        const opp = side === 'home' ? matchToday.away : matchToday.home;
        const rec = recommend(w, w.userClubId, opp, side === 'home', matchToday);
        set({ match: { fixture: matchToday, side, rng, phase: 'squad', rec, draft: { ...draftFrom(rec), xy: w.clubs[w.userClubId].tactics.xy }, state: null } });
        const big = bigMatch(w, matchToday);
        const auto = st.matchMode === 'result' || (st.stopAt === 'important' && !big) || st.stopAt === 'window';
        if (!auto || halt) break;                 // 직접 지휘 (스쿼드 설정 화면)
        get().closeMatch();                       // 결과만: 지금 선발로 바로 경기
        all.push(...get().lastEvents);
        const after = w.manager;
        if (get().ceremony || after?.pendingJob || after?.boardEvent || after?.press || w.sagaPrompt || w.scandalPrompt || w.pendingRenewals?.length || seasonOver(w)) break;
        if (st.stopAt === 'match') break;         // 내 경기마다: 결과를 보고 멈춤
        if (st.stopAt === 'window' && windowOpen(w.season, w.date) !== startWindow) break;   // 이적시장이 열리거나 닫히면
      }
      set({ lastEvents: all });
      autosave(w);
      bump();
    },

    updateDraft(change) {
      const m = get().match;
      if (!m || m.phase !== 'squad') return;
      // 포메이션이 바뀌면 자리 구성이 달라지므로 그 포메이션 기준 AI 선발로 다시 채운다
      if (change.formation && change.formation !== m.draft.formation) {
        const w = get().world!;
        const l = pickLineup(w.clubs[w.userClubId].squad.map((id) => w.players[id]), change.formation, matchRules(w.season).benchSize);
        m.draft = { ...m.draft, ...change, starters: l.starters.map((x) => x.id), bench: l.bench, xy: undefined };
      } else m.draft = { ...m.draft, ...change };
      bump();
    },

    resetDraft() {
      const m = get().match;
      if (!m || m.phase !== 'squad') return;
      m.draft = draftFrom(m.rec);
      bump();
    },

    /** 선발 확정 → 바로 킥오프 */
    confirmLineup() {
      const { match: m, world: w } = get();
      if (!m || !w || m.phase !== 'squad') return;
      const d = m.draft;
      const players = w.clubs[w.userClubId].squad.map((id) => w.players[id]);
      const lineup = pickLineup(players, d.formation, matchRules(w.season).benchSize, d.starters, d.bench, undefined, !!d.benchExact);
      m.state = prepareMatch(w, m.fixture, m.rng, {
        manualSide: m.side,
        lineups: { [m.side]: lineup },
        tactics: { [m.side]: { formation: lineup.formation, mentality: d.mentality, pressing: d.pressing, ...(d.xy ? { xy: d.xy } : {}) } },
      });
      m.state[m.side].autoSub = useSettings.getState().s.autoSubs;   // 자동 교체 (설정)
      m.phase = 'live';
      bump();
    },

    convertToReal(slot) {
      try { sessionStorage.setItem('pitchboss.convert', slot); sessionStorage.setItem('pitchboss.resume', slot); } catch { /* 무시 */ }
      setDataset('real');   // 새로 고침 → 실명 데이터로 켜진 뒤 resume 이 load(slot) → 위에서 바꾼다
    },
    academyAct(id, act) {
      const w = get().world!;
      if (act === 'release') { releaseAcademy(w, id); autosave(w); bump(); return { ok: true, reason: '아카데미에서 내보냈습니다' }; }
      const r = promote(w, id, MAX_SQUAD);
      if (r.ok) { registerGeneratedNames({ ...w.players, ...Object.fromEntries((w.academy?.players ?? []).map((x) => [x.id, x])) }); autosave(w); bump(); }
      return r;
    },
    retrain(playerId, pos) {
      const w = get().world!;
      const p = w.players[playerId];
      if (!p) return { ok: false, reason: '선수를 찾을 수 없습니다' };
      if (!pos) { stopRetrain(p); autosave(w); bump(); return { ok: true, reason: '전환 훈련을 멈췄습니다 (나중에 다시 하면 이어서)' }; }
      const r = startRetrain(w, p, pos);
      if (r.ok) { autosave(w); bump(); }
      return r;
    },
    stepMatch(n = 1) {
      const { match: m, world: w } = get();
      if (!m || !w || m.phase !== 'live' || !m.state) return;
      const st = m.state;
      if (m.event) return;   // 사건을 고를 때까지 멈춤
      const ctx = { players: w.players, rng: m.rng };
      for (let i = 0; i < n && !st.done; i++) {
        step(st, ctx);
        // 세계 대회 모드: 구간 사이 사건 (하프타임 연설 · 통증 · 페널티 · 막판 선택)
        if (w.intl && m.phase === 'live' && !st.done) {
          const ev = rollMatchEvent(st, m.side, ctx, (m.evSeen ??= []));
          if (ev) { m.event = ev; m.evSeen.push(ev.kind); break; }
        }
      }
      if (st.done && m.phase === 'live' && decidesOnDraw(m.fixture) && st.summary.homeGoals === st.summary.awayGoals && !st.summary.pens) {
        m.phase = 'pens';   // 비긴 녹아웃 경기: 승부차기를 직접 (결과만 보기면 자동)
        bump();
        return;
      }
      if (st.done) {
        m.phase = 'full';
        applyMatch(w, m.fixture, st);
        // 승부차기 연출: 정해진 승자에 맞는 키커 순서
        if (st.summary.pens && !st.summary.shootout) st.summary.shootout = shootoutSeq(st, w.players, st.summary.pens, m.fixture.id + w.seed);
        // 리그 우승 확정: 경기 화면에서 축하
        const cl = clinchCheck(w);
        if (cl && cl.type === 'clinch') { w.inbox.push(cl); m.clinch = cl.left; delete w.clinchShow; }   // 경기 화면에서 축하 (결과만 보기면 closeMatch 가 다시 남김)
        w.rng = m.rng.state();
        w.inbox.push({ type: 'match', date: w.date, fixtureId: m.fixture.id, league: m.fixture.league, home: m.fixture.home, away: m.fixture.away, score: [st.summary.homeGoals, st.summary.awayGoals], user: true });
      }
      bump();
    },

    changeTactics(t) {
      const m = get().match;
      if (!m?.state) return;
      setTactics(m.state, m.side, t);
      bump();
    },

    changeFormation(formation) {
      const { match: m, world: w } = get();
      if (!m?.state || !w) return;
      const snap = snapOf(m.state[m.side]);
      if (!setFormation(m.state, m.side, formation, { players: w.players, rng: m.rng })) return;
      m.layout?.hist.push(snap);
      m.state[m.side].tactics.xy = undefined;   // 버튼으로 바꾸면 기본 위치로
      bump();
    },

    signSponsor(offerId) {
      const w = get().world;
      if (!w) return;
      const e = signSponsorDeal(w, offerId);
      if (e) w.inbox.push(e);
      autosave(w);
      bump();
    },
    liveToSlot(id, slotIdx) {
      const m = get().match;
      if (!m?.state || m.phase !== 'live') return '';
      const t = m.state[m.side];
      const slots = FORMATIONS[t.tactics.formation] ?? [];
      const o = t.onPitch.find((x) => x.id === id);
      if (!o || !slots[slotIdx] || slotOrder(t)[slotIdx]) return '';
      if ((o.slot === 'GK') !== (slots[slotIdx] === 'GK')) return '골키퍼는 필드 선수 자리와 바꿀 수 없습니다';
      const snap = snapOf(t);
      const from = o.slot;
      o.slot = slots[slotIdx];
      o.instr = null;
      m.layout?.hist.push(snap);
      bump();
      return `${from} → ${o.slot} (${from} 자리가 빕니다)`;
    },
    liveSwap(a, b) {
      const m = get().match;
      if (!m?.state || m.phase !== 'live') return '';
      const snap = snapOf(m.state[m.side]);
      const ok = swapSlots(m.state, m.side, a, b);
      if (ok) m.layout?.hist.push(snap);
      bump();
      return ok ? '' : '골키퍼는 필드 선수와 자리를 바꿀 수 없습니다';
    },
    liveReshape(slotIdx, x, y) {
      const { match: m, world: w } = get();
      if (!m?.state || !w || m.phase !== 'live') return '';
      const t = m.state[m.side];
      const slots = FORMATIONS[t.tactics.formation];
      if (!slots) return '';
      const r = moveFree(slots, t.tactics.formation, t.tactics.xy, slotIdx, x, y);
      if ('error' in r) return r.error;
      const snap = snapOf(t);
      if (r.same) { t.tactics = { ...t.tactics, xy: { formation: t.tactics.formation, pts: r.pts, slots: [...slots] } }; m.layout?.hist.push(snap); bump(); return ''; }
      const before = slotOrder(t);   // ★ 내 배치 를 덮어쓰기 전에 지금 자리 순서
      let key = r.formation;
      if (!key) { const a = autoFormation(w, r.slots); if ('error' in a) return a.error; key = a.key; }
      reshapeTeam(m.state, m.side, key, r.order, before);
      t.tactics = { ...t.tactics, xy: { formation: key, pts: r.pts, slots: [...r.slots] } };
      m.layout?.hist.push(snap);
      bump();
      return `${slots[slotIdx]} → ${r.pos} · 포메이션 ${key}`;
    },
    layoutBegin() {
      const m = get().match;
      if (!m?.state || m.layout) return;
      m.layout = { base: snapOf(m.state[m.side]), hist: [] };
      bump();
    },
    layoutEnd() {
      const m = get().match;
      if (m?.layout) { m.layout = undefined; bump(); }
    },
    layoutUndo() {
      const { match: m, world: w } = get();
      const snap = m?.layout?.hist.pop();
      if (!m?.state || !w || !snap) return '';
      const err = restoreLayout(w, m.state, m.side, snap);
      bump();
      return err ?? '이전 배치로 되돌렸습니다';
    },
    layoutReset() {
      const { match: m, world: w } = get();
      if (!m?.state || !w || !m.layout) return '';
      const err = restoreLayout(w, m.state, m.side, m.layout.base);
      if (!err) m.layout.hist = [];
      bump();
      return err ?? '하프타임 시작 배치로 되돌렸습니다';
    },
    setAutoSub(on) {
      const m = get().match;
      useSettings.getState().set({ autoSubs: on });
      if (m?.state) m.state[m.side].autoSub = on;
      bump();
    },
    sub(outId, inId) {
      const { match: m, world: w } = get();
      if (!m?.state || !w) return false;
      const ok = substitute(m.state, m.side, outId, inId, { players: w.players, rng: m.rng });
      // 되돌리기 기록: 나간 선수 자리는 들어온 선수로 (교체는 되돌리지 않음)
      if (ok && m.layout) for (const s of [m.layout.base, ...m.layout.hist]) s.ids = s.ids.map((id) => (id === outId ? inId : id));
      bump();
      return ok;
    },

    saveFormation(prev, name, slots) {
      const w = get().world;
      if (!w) return '게임이 없습니다';
      const errs = validateFormation(slots);
      if (errs.length) return errs[0];
      const key = `${CUSTOM_MARK} ${name.trim() || formationShape(slots)}`.slice(0, 24);
      const all = (w.customFormations ??= {});
      if (key !== prev && all[key]) return '같은 이름의 포메이션이 있습니다';
      if (!prev && Object.keys(all).length >= MAX_CUSTOM) return `내 포메이션은 ${MAX_CUSTOM}개까지`;
      const c = w.clubs[w.userClubId];
      const using = prev && c.tactics.formation === prev;
      const same = prev && JSON.stringify(all[prev]) === JSON.stringify(slots);
      if (prev && prev !== key) delete all[prev];
      all[key] = [...slots];
      registerFormations(all);
      if (using) { c.tactics = { ...c.tactics, formation: key }; if (!same) c.lineup = null; }
      autosave(w);
      bump();
      return null;
    },

    scout(kind, target) {
      const w = get().world;
      if (!w) return { ok: false, reason: '게임이 없습니다' };
      const r = startScout(w, kind, target);
      if (r.ok) { autosave(w); bump(); }
      return r;
    },

    deleteFormation(key) {
      const w = get().world;
      if (!w?.customFormations?.[key]) return;
      delete w.customFormations[key];
      registerFormations(w.customFormations);
      const c = w.clubs[w.userClubId];
      if (c.tactics.formation === key) { c.tactics = { ...c.tactics, formation: guessFormation(c.squad.map((id) => w.players[id])) }; c.lineup = null; }
      autosave(w);
      bump();
    },

    setClubTactics(t) {
      const w = get().world;
      if (!w) return;
      const c = w.clubs[w.userClubId];
      c.tactics = { ...c.tactics, ...t };
      bump();
    },

    managerAccept(idx) {
      const w = get().world;
      if (!w) return;
      const rng = createRng((w.rng ^ 0x77) >>> 0);
      w.inbox.push(...acceptOffer(w, idx, rng));
      w.rng = rng.state();
      registerGeneratedNames({ ...w.players, ...Object.fromEntries((w.academy?.players ?? []).map((x) => [x.id, x])) });
      autosave(w);
      bump();
    },
    managerDecline(idx) {
      const w = get().world;
      if (!w) return;
      declineOffer(w, idx);
      autosave(w);
      bump();
    },
    managerChoose(club) {
      const w = get().world;
      if (!w) return;
      const rng = createRng((w.rng ^ 0x78) >>> 0);
      w.inbox.push(...chooseJob(w, club, rng));
      w.rng = rng.state();
      autosave(w);
      bump();
    },
    upgradeFacility(kind) {
      const r = get().boardAsk({ kind: 'facility', facility: kind });
      return { ok: r.ok, reason: r.text };
    },
    closeEventResult() { set({ eventResult: null }); },

    sagaRespond(playerId, action, label) {
      const w = get().world;
      if (!w) return '';
      const rng = createRng((w.rng ^ 0x5a6a) >>> 0);
      const r = sagaRespond(w, playerId, action, rng);
      w.rng = (w.rng + 7) >>> 0;
      w.inbox.push(...r.events);
      w.sagaPrompt = undefined;
      set({ eventResult: { tag: '선수 · 대응 결과', tone: 'text-amber', choice: label, lines: [r.text || '아직 별다른 반응은 없습니다'] } });
      autosave(w);
      bump();
      return r.text;
    },
    loanIn(playerId, terms) {
      const w = get().world!;
      const p = w.players[playerId];
      const c = evaluateLoan(w, p, w.userClubId, terms);
      if (!c.ok) { if (p.clubId && p.clubId !== w.userClubId && !p.loan) logDeal(w, { dir: 'in', kind: 'loan', player: p.id, club: p.clubId, ok: false, why: '임대 거절 (' + c.reason + ')' }); return { ok: false, msg: c.reason }; }
      const pw = playerWillLoan(w, p, w.userClubId);
      if (!pw.ok) { logDeal(w, { dir: 'in', kind: 'loan', player: p.id, club: p.clubId, ok: false, why: '선수가 임대를 거절' }); return { ok: false, msg: pw.reason }; }
      const fban = transferBan(w, w.userClubId);
      if (fban) return { ok: false, msg: fban };
      if (terms.fee > w.clubs[w.userClubId].finance.transferBudget) return { ok: false, msg: '이적 예산이 모자랍니다 (임대료)' };
      if (Math.round(p.wage * terms.share) > wageRoom(w, w.userClubId)) return { ok: false, msg: '주급 여유가 모자랍니다' };
      // 이적 조건의 영입 후 주급: 선수가 원하는 주급의 90% 이상이어야
      const want = wageDemand(w, p, w.userClubId);
      if (terms.buy && (terms.buyWage ?? p.wage) < want * 0.9) return { ok: false, msg: `선수: 영입 후 주급으로 ${Math.round(want / 1000)}K 유로 정도를 원합니다` };
      if (terms.fee) w.clubs[w.userClubId].finance.transferBudget -= terms.fee;
      w.inbox.push(loanMove(w, p, w.userClubId, terms));
      autosave(w); bump();
      return { ok: true, msg: `${p.name} 임대 영입 · 이번 시즌 끝까지` };
    },
    loanOut(playerId, club, terms) {
      const w = get().world!;
      const p = w.players[playerId];
      if (!windowOpen(w.season, w.date)) return { ok: false, msg: '이적시장이 닫혀 있습니다' };
      if (p.loan) return { ok: false, msg: '빌려 온 선수는 다시 임대 보낼 수 없습니다' };
      const pw = playerWillLoan(w, p, club);
      if (!pw.ok) return { ok: false, msg: pw.reason };
      w.inbox.push(loanMove(w, p, club, terms));
      const c = w.clubs[w.userClubId];
      if (c.lineup) c.lineup = { starters: c.lineup.starters.map((x) => (x === playerId ? null : x)), bench: c.lineup.bench.filter((x) => x !== playerId) };
      autosave(w); bump();
      return { ok: true, msg: '임대를 보냈습니다 · 시즌이 끝나면 돌아옵니다' };
    },
    loanBuy(playerId) {
      const w = get().world!;
      const p = w.players[playerId];
      const fee = p.loan?.buy;
      if (!fee || p.clubId !== w.userClubId) return { ok: false, msg: '완전 영입 옵션이 없습니다' };
      const fban = transferBan(w, w.userClubId);
      if (fban) return { ok: false, msg: fban };
      if (fee > w.clubs[w.userClubId].finance.transferBudget) return { ok: false, msg: '이적 예산이 모자랍니다' };
      w.inbox.push(...exerciseBuy(w, p));
      autosave(w); bump();
      return { ok: true, msg: '완전 영입 옵션을 행사했습니다' };
    },
    scandalRespond(action, label) {
      const w = get().world;
      if (!w) return '';
      const rng = createRng((w.rng ^ 0x5c4d) >>> 0);
      const r = scandalRespond(w, action, rng);
      w.rng = (w.rng + 11) >>> 0;
      w.inbox.push(...r.events);
      set({ eventResult: { tag: '선수 논란 · 대응 결과', tone: 'text-red', choice: label, lines: [r.text || '조용히 지나갔습니다'] } });
      autosave(w);
      bump();
      return r.text;
    },
    sagaClose() { const w = get().world; if (!w) return; w.sagaPrompt = undefined; bump(); },
    sagaOpen(playerId) { const w = get().world; if (!w) return; w.sagaPrompt = playerId; bump(); },
    pressAnswer(key) {
      const w = get().world;
      if (!w) return;
      const q = w.manager?.press?.questions[0];
      const a = q?.answers.find((x) => x.key === key);
      const pname = q?.player && w.players[q.player] ? playerKo(q.player, w.players[q.player].name) : '선수';
      const left = (w.manager?.press?.questions.length ?? 1) - 1;
      w.inbox.push(...answerPress(w, key));
      set({ eventResult: key === 'skip'
        ? { tag: '기자회견', tone: 'text-sky', choice: '기자회견 불참', lines: ['기자들이 불만을 드러냅니다 · 내일 신문이 곱지 않을 겁니다'] }
        : { tag: '기자회견 · 반응', tone: 'text-sky', choice: a?.label, lines: a ? pressReaction(a.fx, pname) : [], next: left > 0 ? `다음 질문 (${left}개 남음)` : undefined } });
      autosave(w);
      bump();
    },
    boardChoose(key) {
      const w = get().world;
      if (!w) return;
      const opt = w.manager?.boardEvent?.options.find((o) => o.key === key);
      const evs = resolveBoardEvent(w, key);
      w.inbox.push(...evs);
      set({ eventResult: { tag: '결과', tone: 'text-amber', choice: opt?.label, lines: evs.flatMap((e) => (e.type === 'info' ? [e.text] : [])) } });
      autosave(w);
      bump();
    },
    boardAsk(a) {
      const w = get().world;
      if (!w) return { ok: false, text: '' };
      const rng = createRng((w.rng ^ 0xb0a7) >>> 0);
      const r = askBoard(w, a, rng);
      w.rng = (w.rng + 1) >>> 0;
      w.inbox.push(...r.events);
      autosave(w);
      bump();
      return r;
    },
    editMyManager(c) {
      const w = get().world;
      const m = w?.managers?.user;
      if (!w || !m) return;
      if (c.name != null && c.name.trim()) { m.name = c.name.trim().slice(0, 20); m.ko = m.name; }
      if (c.philosophy) m.style.mentality = ({ attack: 1, balance: 0, defend: -1 } as const)[c.philosophy];
      if (c.pressing != null) m.style.pressing = c.pressing;
      autosave(w);
      bump();
    },
    managerSetOpen(open) {
      const w = get().world;
      if (!w) return;
      ensureManager(w).open = open;
      autosave(w);
      bump();
    },

    setTraining(t) {
      const w = get().world;
      if (!w) return;
      const c = w.clubs[w.userClubId];
      c.training = { ...trainingOf(c), ...t };
      autosave(w);
      bump();
    },

    leaveMatch() {
      if (get().match?.phase === 'squad') set({ match: null });
    },

    resolveEvent(choice, takerId) {
      const { match: m, world: w } = get();
      if (!m?.event || !m.state || !w || m.event.result) return;
      const r = applyMatchEvent(m.state, m.side, m.event, choice, { players: w.players, rng: m.rng }, takerId);
      m.event = { ...m.event, result: r.text, good: r.good };
      bump();
    },
    closeEvent() {
      const m = get().match;
      if (!m) return;
      m.event = undefined;
      bump();
    },

    finishShootout(res) {
      const { match: m, world: w } = get();
      if (!m || !w || m.phase !== 'pens' || !m.state) return;
      const s = m.state.summary;
      if (res) {
        const hs = res.home.filter((k) => k.scored).length, as = res.away.filter((k) => k.scored).length;
        s.pens = hs > as ? 'home' : 'away';
        s.shootout = { home: res.home, away: res.away, score: [hs, as] };
        s.pensLive = true;
      } else s.pens = shootout(w, m.fixture.home, m.fixture.away, m.fixture.id);   // 자동: 지금까지와 같은 방식
      m.phase = 'live';
      get().stepMatch(0);   // 결과 반영 (자동이면 applyMatch 가 정함)
    },

    closeMatch() {
      const { match: m, world: w } = get();
      if (!m || !w) return;
      const skipped = m.phase !== 'full';
      m.event = undefined;   // 결과만 보기: 남은 사건은 건너뜀
      if (m.phase === 'pens') get().finishShootout(null);   // 승부차기 화면에서 결과만 보기: 자동
      if (m.phase !== 'full') {
        // 결과만 보기: (스쿼드 설정 중이면 지금 선발로 확정하고) 남은 시간을 한 번에 진행
        if (m.phase === 'squad') get().confirmLineup();
        const st = m.state!;
        st[m.side].manual = false;   // 남은 시간은 AI가 교체까지 맡음
        playToEnd(st, { players: w.players, rng: m.rng });
        get().stepMatch(0);
        if (get().match?.phase === 'pens') get().finishShootout(null);
      }
      // 오늘 남은 다른 경기를 치르고 하루 넘김
      const events = advanceDay(w);
      // 결과만 보기로 넘긴 경기에서 리그 우승이 확정됐으면 홈에서 축하
      if (skipped && m.clinch != null) w.clinchShow = { league: w.clubs[w.userClubId].league, club: w.userClubId, left: m.clinch };
      set({ match: null, lastEvents: events });
      useApp.getState().setTab('home');   // 경기가 끝나면 어디서 시작했든 홈으로 (결과 · 순위부터 확인)
      autosave(w);
      bump();
    },

    bid(playerId, fee, terms) {
      const w = get().world!;
      const p = w.players[playerId];
      const ban = talkBanned(w, playerId);
      if (ban) return { decision: 'reject', ask: 0, reason: '', left: 0, mood: 100, blocked: `협상이 결렬된 선수입니다. ${ban.slice(5).replace('-', '/')}까지 다시 협상할 수 없습니다` };
      if (p.clubId && !windowOpen(w.season, w.date)) return { decision: 'reject', ask: 0, reason: '', left: 0, mood: 100, blocked: '이적시장이 닫혀 있어 다른 구단 선수는 영입할 수 없습니다 (자유계약 선수는 가능)' };
      const fban = p.clubId ? transferBan(w, w.userClubId) : null;
      if (fban) return { decision: 'reject', ask: 0, reason: '', left: 0, mood: 100, blocked: fban };
      if (p.clubId && fee > w.clubs[w.userClubId].finance.transferBudget) return { decision: 'reject', ask: 0, reason: '', left: 0, mood: 100, blocked: '이적 예산이 부족합니다' };
      const te = termsError(fee, terms);
      if (te) return { decision: 'reject', ask: 0, reason: '', left: 0, mood: 100, blocked: te };
      // 밀고 당기기: 역제안 · 인내심 · 최저선 (engine/negotiation.ts)
      const r = negotiateFee(w, p, fee, terms);
      autosave(w);
      bump();
      return r;
    },

    callUp(playerId, on) {
      const w = get().world!;
      if (!w.intl || get().match) return '경기 중에는 바꿀 수 없습니다';
      const c = w.clubs[w.userClubId];
      if (on) {
        if (c.squad.includes(playerId)) return null;
        if (c.squad.length >= squadSize(w)) return `대표 명단은 ${squadSize(w)}명까지입니다. 먼저 한 명을 빼세요`;
        c.squad.push(playerId);
      } else {
        if (c.squad.length <= 14) return '최소 14명은 남겨야 합니다';
        c.squad = c.squad.filter((id) => id !== playerId);
        if (c.lineup) c.lineup = { starters: c.lineup.starters.map((x) => (x === playerId ? null : x)), bench: c.lineup.bench.filter((x) => x !== playerId) };
      }
      autosave(w); bump();
      return null;
    },
    chooseIntlJob(nation) {
      const w = get().world!;
      const job = w.intl?.job;
      if (!job) return;
      if (nation && job.offers.includes(nation)) switchNation(w, nation);
      else if (job.reason === 'offer') w.intl!.job = undefined;
      autosave(w); bump();
    },
    autoSquad() {
      const w = get().world!;
      if (!w.intl || get().match) return;
      const c = w.clubs[w.userClubId];
      c.squad = autoCallUp(w);
      c.lineup = null;
      autosave(w); bump();
    },

    setRole(playerId, role) {
      const w = get().world!;
      changeRole(w, w.players[playerId], role);
      autosave(w); bump();
    },
    sign(playerId, wage, years, role, clause, rel) {
      const w = get().world!;
      const p = w.players[playerId];
      const ban = talkBanned(w, playerId);
      if (ban) return { ok: false, reason: `협상이 결렬된 선수입니다. ${ban.slice(5).replace('-', '/')}까지 다시 협상할 수 없습니다` };
      if (p.clubId && !windowOpen(w.season, w.date)) return { ok: false, reason: '이적시장이 닫혀 있습니다 (자유계약 선수만 가능)' };
      const t = talkOf(w, playerId);
      if (p.clubId && t.agreed == null) return { ok: false, reason: '먼저 구단과 이적료를 합의해야 합니다' };
      const fee = p.clubId ? t.agreed! : 0;
      if (p.clubId === w.userClubId) return { ok: false, reason: '이미 우리 구단 선수입니다' };
      if (fee > 0 && transferBan(w, w.userClubId)) return { ok: false, reason: '이적 금지 징계 중이라 이적료를 내고 영입할 수 없습니다' };
      if (fee > w.clubs[w.userClubId].finance.transferBudget) return { ok: false, reason: `이적 예산 초과 — 남은 이적 예산 ${Math.round(w.clubs[w.userClubId].finance.transferBudget / 1e5) / 10}M 유로` };
      // 주급 한도: 계약 후 주급 합계가 주급 예산을 넘으면 안 됨 (기회는 줄지 않음)
      const room = wageRoom(w, w.userClubId);
      if (wage > room) return { ok: false, reason: `주급 예산 초과 — 남은 주급 여유 ${Math.max(0, Math.round(room / 1000))}K 유로. 선수를 팔거나 방출해 주급을 줄여야 합니다` };
      // 재정 규정 (샐러리 캡): 주급 + 이적료 상각 (이적료 ÷ 계약 연수) — AI와 같은 규칙
      const rule = withinRules(w, w.userClubId, wage, fee, years);
      if (!rule.ok) return { ok: false, reason: rule.reason! };
      if (clause === 0 && buyoutMandatory(w, w.userClubId)) return { ok: false, reason: '이 리그는 모든 선수 계약에 바이아웃이 있어야 합니다' };
      const r = playerWillJoin(w, p, w.userClubId, wage, role, clause, undefined, rel, years);
      if (!r.ok) {
        // 주급이 낮으면 기회 1번 소모, 구단 자체가 싫다면 바로 결렬
        if (r.low) t.wage++;
        const left = r.low ? MAX_TRIES - t.wage : 0;
        if (left <= 0) breakTalks(w, playerId, r.low ? '주급이 맞지 않아 선수가 거절' : '선수가 오기 싫어함 (' + r.reason + ')');
        autosave(w);
        bump();
        return { ok: false, reason: r.reason, left, broken: left <= 0 };
      }
      const from = p.clubId;
      const ev = completeTransfer(w, p, w.userClubId, fee, wage, years, p.clubId ? t.terms : undefined);
      if (role) p.role = role;   // 약속한 역할
      if (clause != null) setBuyout(p, clause);   // 계약에 건 바이아웃
      setRelClause(p, w.userClubId, rel ?? 0);   // 강등 조항 (넣지 않으면 없음)
      w.inbox.push(ev);
      set({ ceremony: { player: p.id, playerName: p.name, from, to: w.userClubId, fee, wage, years, kind: 'in' } });
      autosave(w);
      bump();
      return { ok: true, reason: '계약을 마쳤습니다' };
    },

    precontract(playerId, wage, years, role, clause) {
      const w = get().world!;
      const p = w.players[playerId];
      if (!bosmanEligible(w, p, w.userClubId)) return { ok: false, reason: '보스만 사전 계약은 계약 마지막 6개월(1월 1일부터) · 다른 나라 구단만 가능합니다' };
      const ban = talkBanned(w, playerId);
      if (ban) return { ok: false, reason: `협상이 결렬된 선수입니다. ${ban.slice(5).replace('-', '/')}까지 다시 협상할 수 없습니다` };
      if (clause === 0 && buyoutMandatory(w, w.userClubId)) return { ok: false, reason: '이 리그는 모든 선수 계약에 바이아웃이 있어야 합니다' };
      const room = wageRoom(w, w.userClubId);
      if (wage > room) return { ok: false, reason: `주급 예산 초과 — 남은 주급 여유 ${Math.max(0, Math.round(room / 1000))}K 유로` };
      const t = talkOf(w, playerId);
      const r = playerWillJoin(w, p, w.userClubId, wage, role, clause, true);
      if (!r.ok) {
        if (r.low) t.wage++;
        const left = r.low ? MAX_TRIES - t.wage : 0;
        if (left <= 0) breakTalks(w, playerId, r.low ? '주급이 맞지 않아 선수가 거절' : '선수가 사전 계약을 거절', 'precontract');
        autosave(w); bump();
        return { ok: false, reason: r.reason, left, broken: left <= 0 };
      }
      signPrecontract(w, p, w.userClubId, wage, years, { role, buyout: clause });
      if (w.talks) delete w.talks[playerId];
      w.inbox.push({ type: 'bosman', date: w.date, player: p.id, to: w.userClubId, mine: true });
      autosave(w); bump();
      return { ok: true, reason: '사전 계약을 맺었습니다 · 7월에 합류합니다' };
    },

    setCaptain(playerId) {
      const w = get().world!;
      w.clubs[w.userClubId].captain = playerId ?? undefined;
      autosave(w); bump();
    },
    holdMeeting() {
      const w = get().world!;
      if (!meetingReady(w)) return { ok: false, text: '팀 미팅은 30일에 한 번만 열 수 있습니다' };
      const r = teamMeeting(w, createRng((w.rng ^ 0x7ea3) >>> 0));
      w.inbox.push({ type: 'locker', date: w.date, kind: r.ok ? 'meetingOk' : 'meetingBad', players: [] });
      autosave(w); bump();
      return r;
    },

    clearDeadline() {
      const w = get().world!;
      w.deadlineAlert = undefined;
      bump();
    },

    clearRenewals() {
      const w = get().world!;
      w.pendingRenewals = undefined;
      autosave(w);
      bump();
    },

    renew(playerId, wage, years, clause, rel) {
      const w = get().world!;
      const p = w.players[playerId];
      const key = `renew:${playerId}`;
      const ban = talkBanned(w, key);
      if (ban) return { ok: false, reason: `재계약 협상이 결렬됐습니다. ${ban.slice(5).replace('-', '/')} 이후 다시 시도할 수 있습니다` };
      // 주급이 오르는 만큼만 주급 예산에서 확인
      const room = wageRoom(w, w.userClubId);
      if (wage - p.wage > room) return { ok: false, reason: `주급 예산 초과 — 남은 주급 여유 ${Math.max(0, Math.round(room / 1000))}K 유로` };
      const t = talkOf(w, key);
      if (clause === 0 && buyoutMandatory(w, w.userClubId)) return { ok: false, reason: '이 리그는 모든 선수 계약에 바이아웃이 있어야 합니다' };
      const r = evaluateRenewal(w, p, wage, years, clause, rel);
      if (!r.ok) {
        if (r.low) t.wage++;
        const left = r.low ? MAX_TRIES - t.wage : 0;
        if (left <= 0) { (w.talkBan ??= {})[key] = addDaysIso(w.date, 30); if (w.talks) delete w.talks[key]; }
        autosave(w); bump();
        return { ok: false, reason: r.reason, left, broken: left <= 0 };
      }
      applyRenewal(w, p, wage, years, clause, rel);
      if (w.talks) delete w.talks[key];
      autosave(w); bump();
      return { ok: true, reason: `재계약 완료 · ${p.contract!.slice(0, 4)}년 6월까지` };
    },

    pressPlay(playerId) {
      const w = get().world!;
      const rng = createRng((w.rng ^ 0x7e55) >>> 0);
      w.rng = (w.rng + 11) >>> 0;
      const r = pressPlay(w, playerId, rng);
      if (r.ok) { autosave(w); bump(); }
      return r.text;
    },

    toggleShortlist(playerId) {
      const w = get().world!;
      const s = (w.shortlist ??= []);
      w.shortlist = s.includes(playerId) ? s.filter((x) => x !== playerId) : [...s, playerId];
      bump();
    },

    toggleTransferList(playerId) {
      const w = get().world!;
      const s = (w.transferList ??= []);
      w.transferList = s.includes(playerId) ? s.filter((x) => x !== playerId) : [...s, playerId];
      autosave(w);
      bump();
    },

    release(playerId) {
      const w = get().world!;
      // 빌려 온 선수는 방출 대신 원소속 구단으로 돌려보냄
      if (w.players[playerId].loan) { const e = loanReturn(w, w.players[playerId]); if (e) w.inbox.push(e); } else releasePlayer(w, w.players[playerId]);
      const c = w.clubs[w.userClubId];
      if (c.lineup) c.lineup = { starters: c.lineup.starters.map((x) => (x === playerId ? null : x)), bench: c.lineup.bench.filter((x) => x !== playerId) };
      autosave(w);
      bump();
    },

    answerOffer(offerId, accept) {
      const w = get().world!;
      const o = (w.offers ?? []).find((x) => x.id === offerId);
      if (!o || !offerValid(w, o)) { cleanOffers(w); w.offers = (w.offers ?? []).filter((x) => x.id !== offerId); bump(); return '이미 끝난 제안입니다 (선수가 팀을 떠났거나 기한 · 이적시장이 끝났습니다)'; }
      w.offers = (w.offers ?? []).filter((x) => x.id !== offerId);
      if (!accept && w.players[o.player]) logDeal(w, { dir: 'out', kind: 'transfer', player: o.player, club: o.from, fee: o.fee, ok: false, why: '제안 거절' });
      let msg = accept ? sellTo(o).msg : '제안을 거절했습니다';
      // 선수가 먼저 그 구단에 연락해서 온 제안을 거절: 선수가 실망 (충성도 · 사기 ↓)
      const p = w.players[o.player];
      if (!accept && o.appeal && p) { p.loyalty = Math.max(0, p.loyalty - 8); p.morale = Math.max(0, p.morale - 6); msg += ` · ${playerKo(p.id, p.name)} 선수가 크게 실망했습니다`; }
      autosave(w);
      bump();
      return msg;
    },

    counter(offerId, ask, sellOn) {
      const w = get().world!;
      const o = (w.offers ?? []).find((x) => x.id === offerId);
      if (!o || !offerValid(w, o)) { cleanOffers(w); w.offers = (w.offers ?? []).filter((x) => x.id !== offerId); bump(); return { result: 'gone', fee: 0, reason: '이미 끝난 제안입니다 (선수가 팀을 떠났거나 기한 · 이적시장이 끝났습니다)' }; }
      const r = counterOffer(w, o, ask, sellOn);
      if (r.result === 'withdraw') logDeal(w, { dir: 'out', kind: 'transfer', player: o.player, club: o.from, fee: o.fee, ok: false, why: '역제안이 높아 상대 구단이 포기' });
      let out: ReturnType<GameStore['counter']> = r;
      if (r.result === 'accept') {
        w.offers = (w.offers ?? []).filter((x) => x.id !== offerId);
        const s = sellTo(o);
        out = { ...r, reason: `${r.reason} · ${s.msg}`, done: s.ok };
      }
      autosave(w);
      bump();
      return out;
    },

    async nextSeason() {
      const w = get().world;
      if (!w || !seasonOver(w)) return;
      set({ loading: true });
      const intlStage = w.intl && worldCupYear(w.season) ? cycleStage(w) : undefined;   // 세계 대회 모드: 이번 주기 성적 (세계 대회가 끝난 시즌)
      closeSeason(w);
      let input = await loadSeasonInput(nextSeasonOf(w.season));
      if (w.myClub) input = swapInput(input, w.myClub, currentAsData(w.clubs[w.myClub.id])).input;   // 나의 구단: 대신한 구단 자리
      const report = startNextSeason(w, input);
      if (w.intl) intlNextSeason(w, intlStage);   // 세계 대회 모드: 다음 일정 (새 주기면 국내파 · 목표)
      registerGeneratedNames({ ...w.players, ...Object.fromEntries((w.academy?.players ?? []).map((x) => [x.id, x])) });   // 유스 선수 한국어 이름
      const awards = w.pendingAwards?.length ? w.pendingAwards : null;
      const news = w.pendingNews?.length ? w.pendingNews : null;
      w.pendingAwards = undefined;
      w.pendingNews = undefined;
      set({ loading: false, seasonReport: report, awards, news });
      autosave(w);
      bump();
    },

    dismissReport() { set({ seasonReport: null }); },

    async save(slot) {
      const w = get().world;
      if (!w) return;
      const meta = await writeSave(slot, w);
      set({ savedAt: meta.savedAt });
    },

    async exportFile() {
      const w = get().world;
      if (!w) return;
      recordCareer(w);
      await exportSaveFile(w, clubKo(w.userClubId));
    },
    async importFile(file) {
      try {
        const world = await readSaveFile(file);
        await writeSave('auto', world);   // 자동 저장 슬롯에 넣고 (데이터가 다르면 바꾼 뒤 이어서) 불러온다
        return await get().load('auto');
      } catch (e) { set({ loadError: e instanceof Error ? e.message : String(e) }); return false; }
    },
    async load(slot) {
      const world = await readSave(slot);
      setWcSquads(await loadWcSquads());
      setWcPools(world?.intl ? await loadWcPools() : undefined);
      if (world?.intl) repairIntl(world);   // 세계 대회 모드: 실제 명단 · 대표 풀로 소집 후보 다시 (데이터 없이 만든 세이브 고침)
      if (!world) return false;
      // 패러디 세이브 → 실명으로 바꾸기 (슬롯 목록의 「실명으로 바꾸기」: 실명 데이터로 새로 고침한 뒤 여기서)
      let conv: string | null = null;
      try { conv = sessionStorage.getItem('pitchboss.convert'); } catch { /* 무시 */ }
      if (conv === slot && world.dataset === 'public' && dataset === 'real') {
        try { sessionStorage.removeItem('pitchboss.convert'); } catch { /* 무시 */ }
        const map = await loadPublicMap();
        if (!map) { set({ loadError: '실명 데이터에 번호 대응표(canonical/public-map.json)가 없어 바꿀 수 없습니다. 실명 데이터를 다시 넣어 주세요.' }); return false; }
        const { convertToReal, inverseMap } = await import('../engine/convertReal');
        const inv = inverseMap(map);
        const files: import('../data/types').ClubSeasonFile[] = [];
        for (const lg of Object.keys(world.competitions)) {
          try { files.push(...(await loadLeagueSeason(world.season, lg)).clubs); } catch { /* 그 시즌 그 리그 실명 파일 없음 */ }
        }
        const { world: realWorld } = convertToReal(world, map, files);
        if (!inv.has(world.userClubId) && !world.myClub && !world.userClubId.startsWith('nt-')) { set({ loadError: '이 세이브의 구단을 실명 데이터에서 찾지 못했습니다.' }); return false; }
        await writeSave(slot, realWorld);
        return get().load(slot);
      }
      // 다른 데이터로 만든 세이브면 그 데이터로 바꾼 뒤 (새로 고침) 자동으로 이어서 불러온다
      const need = world.dataset ?? 'real';
      if (need !== dataset) {
        if (need === 'real' && !realAvailable) return false;
        try { sessionStorage.setItem('pitchboss.resume', slot); } catch { /* 무시 */ }
        setDataset(need);
        return false;
      }
      registerMyClub(world.myClub);   // 나의 구단 이름 · 엠블럼
      // 데이터 형식이 바뀌기 전에 만든 세이브 (구단을 찾을 수 없음)
      if (!(clubMasters.has(world.userClubId) || (world.intl && world.userClubId.startsWith('nt-'))) || !Object.keys(world.clubs).every((id) => clubMasters.has(id) || !world.competitions[world.clubs[id].league])) {
        set({ loadError: '이전 형식의 데이터로 만든 세이브라 불러올 수 없습니다. 새 게임으로 시작해 주세요.' });
        return false;
      }
      set({ loadError: null });
      world.careerId ??= newCareerId();
      fillContracts(world);
      registerGeneratedNames({ ...world.players, ...Object.fromEntries((world.academy?.players ?? []).map((x) => [x.id, x])) });   // 유스 선수 한국어 이름
      ensureManagers(world);   // 감독이 없던 예전 세이브: 가상 감독으로 채움
      world.reserves = reservesOf();   // B팀 → 모구단 (예전 세이브에도 채움)
      if (academyOn(world) && world.academy?.club !== world.userClubId) academySeason(world, world.season);   // 유스 아카데미가 없던 세이브
      syncWorld(world);
      set({ world, match: null, lastEvents: [], seasonReport: null });
      bump();
      return true;
    },

    reshapeTactics(slotIdx, x, y) {
      const w = get().world!;
      const c = w.clubs[w.userClubId];
      const slots = FORMATIONS[c.tactics.formation];
      if (!slots) return '';
      const mv = moveFree(slots, c.tactics.formation, c.tactics.xy, slotIdx, x, y);
      if ('error' in mv) return mv.error;
      if (mv.same) { c.tactics = { ...c.tactics, xy: { formation: c.tactics.formation, pts: mv.pts, slots: [...slots] } }; autosave(w); bump(); return ''; }
      const pos = mv.pos;
      const players = c.squad.map((id) => w.players[id]);
      const rules = matchRules(w.season);
      const l = pickLineup(players, c.tactics.formation, rules.benchSize, c.lineup?.starters, c.lineup?.bench, undefined, !!c.lineup?.benchExact);
      const cur = slots.map((_, i) => l.starters[i]?.id ?? null);
      const r = mv;
      let key = r.formation;
      if (!key) { const a = autoFormation(w, r.slots); if ('error' in a) return a.error; key = a.key; }
      inheritFam(c, c.tactics.formation, key);
      c.tactics = { ...c.tactics, formation: key, xy: { formation: key, pts: mv.pts, slots: [...mv.slots] } };
      c.lineup = { starters: r.order.map((k) => cur[k]), bench: c.lineup?.bench ?? l.bench };
      autosave(w); bump();
      return `${slots[slotIdx]} → ${pos} · 포메이션 ${key}${r.formation ? '' : ` (${formationShape(r.slots)} 모양 · 내 포메이션으로 저장)`}`;
    },
    reshapeDraft(slotIdx, x, y) {
      const { match: m, world: w } = get();
      if (!m || !w || m.phase !== 'squad') return '';
      const slots = FORMATIONS[m.draft.formation];
      if (!slots) return '';
      const r = moveFree(slots, m.draft.formation, m.draft.xy, slotIdx, x, y);
      if ('error' in r) return r.error;
      if (r.same) { m.draft = { ...m.draft, xy: { formation: m.draft.formation, pts: r.pts, slots: [...slots] } }; bump(); return ''; }
      const pos = r.pos;
      let key = r.formation;
      if (!key) { const a = autoFormation(w, r.slots); if ('error' in a) return a.error; key = a.key; }
      inheritFam(w.clubs[w.userClubId], m.draft.formation, key);
      m.draft = { ...m.draft, formation: key, starters: r.order.map((k) => m.draft.starters[k]), xy: { formation: key, pts: r.pts, slots: [...r.slots] } };
      bump();
      return `${slots[slotIdx]} → ${pos} · 포메이션 ${key}${r.formation ? '' : ` (${formationShape(r.slots)} 모양 · 내 포메이션으로 저장)`}`;
    },

    setLineup(starters, bench = [], benchExact) {
      const w = get().world;
      if (!w) return;
      const prev = w.clubs[w.userClubId].lineup;
      w.clubs[w.userClubId].lineup = starters ? { starters, bench, ...((benchExact ?? prev?.benchExact) ? { benchExact: true } : {}) } : null;
      autosave(w);
      bump();
    },

    quit() { set({ world: null, match: null, lastEvents: [], seasonReport: null }); },
  };
});

// 개발 중 이 파일(게임 상태)이 바뀌면 화면 일부만 교체하지 않고 페이지 전체를 새로 고친다.
// 일부만 교체되면 화면마다 서로 다른 월드를 보게 되어 순위 등이 어긋난다. (자동 저장에서 이어하기로 복구)
// 개발 모드 전용: 브라우저 테스트에서 상태를 직접 확인 · 설정
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;
if (import.meta.hot) import.meta.hot.accept(() => location.reload());
