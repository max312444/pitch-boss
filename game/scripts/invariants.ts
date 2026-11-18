// 장기 진행 불변 조건 점검: 여러 시즌을 이어서 돌리며 매주 · 시즌마다 세계가 꼬이지 않았는지 본다
//   npm run invariants -- [시즌 수 6] [시드 1] [시작 시즌 2023]
//   데이터가 있는 시즌은 실제 다음 시즌 데이터로, 끝나면 성장 엔진으로 이어 간다
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, advanceDay, seasonOver } from '../src/engine/world';
import { closeSeason, nextSeasonOf, startNextSeason } from '../src/engine/season';
import type { ClubSeasonFile, LeagueSeasonFile } from '../src/data/types';
import type { World } from '../src/engine/types';

const DATA = path.resolve(__dirname, '../../data-public');
const NUMS = process.argv.slice(2).filter((x) => /^\d+$/.test(x));
const SEASONS = +(NUMS[0] ?? 6), SEED = +(NUMS[1] ?? 1), Y0 = +(NUMS[2] ?? 2023);
const rj = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8'));
const wcPath = path.join(DATA, 'meta/worldcups.json');
const worldCups = fs.existsSync(wcPath) ? rj<Record<string, unknown>>(wcPath) : undefined;
function input(season: string) {
  const dir = path.join(DATA, 'seasons', season);
  const ids = fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => fs.existsSync(path.join(dir, x, '_league.json'))) : [];
  return {
    season, worldCups: worldCups as never,
    leagues: ids.map((id) => { const m = rj<LeagueSeasonFile>(path.join(dir, id, '_league.json')); return { id, clubs: m.clubs.map((c) => rj<ClubSeasonFile>(path.join(dir, id, `${c}.json`))) }; }),
  };
}

const problems = new Map<string, { n: number; ex: string }>();
const bad = (k: string, ex: string) => { const p = problems.get(k); if (p) p.n++; else problems.set(k, { n: 1, ex: `${ex}` }); };
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

function check(w: World, when: string) {
  const owner = new Map<string, string>();
  for (const c of Object.values(w.clubs)) {
    if (c.id.startsWith('nt-')) continue;   // 대표팀: 소집 명단 (클럽 선수 · 세계 대회용 가상 선수)
    const active = !!w.competitions[c.league];
    for (const id of c.squad) {
      const p = w.players[id];
      if (!p) { bad('선수단에 없는 선수 ID', `${when} ${c.id} ${id}`); continue; }
      if (owner.has(id)) bad('두 구단 소속', `${when} ${id} ${owner.get(id)} / ${c.id}`);
      owner.set(id, c.id);
      if (p.clubId !== c.id) bad('선수 clubId 와 선수단 불일치', `${when} ${id} ${p.clubId} ≠ ${c.id}`);
      if (p.retired) bad('은퇴 선수가 선수단에', `${when} ${id} ${c.id}`);
      if (!num(p.wage) || p.wage <= 0) bad('주급 이상', `${when} ${id} ${p.wage}`);
      if (!p.contract) bad('계약 없음 (소속 선수)', `${when} ${id} ${c.id}`);
      if (!num(p.fitness) || p.fitness < 0 || p.fitness > 100) bad('체력 범위 밖', `${when} ${id} ${p.fitness}`);
      if (!num(p.morale) || p.morale < 0 || p.morale > 100) bad('사기 범위 밖', `${when} ${id} ${p.morale}`);
      if (p.injury && !(p.injury.days >= 0)) bad('부상 일수 이상', `${when} ${id} ${JSON.stringify(p.injury)}`);
      if (p.suspension < 0) bad('징계 음수', `${when} ${id}`);
      for (const [k, v] of Object.entries(p.base)) if (v != null && (!num(v) || v < 1 || v > 99)) { bad('능력치 범위 밖', `${when} ${id} ${k}=${v}`); break; }
    }
    if (active) {
      if (c.squad.length < 16) bad(`선수단 16명 미만 ${c.id}`, `${when} ${c.id} ${c.squad.length}`);
      if (c.squad.length > 40) bad('선수단 40명 초과', `${when} ${c.id} ${c.squad.length}`);
      if (!c.squad.some((id) => w.players[id]?.pos === 'GK')) bad('골키퍼 없음', `${when} ${c.id}`);
    }
    for (const k of ['balance', 'transferBudget', 'wageBudget'] as const) if (!num(c.finance[k])) bad('재정 NaN', `${when} ${c.id} ${k}=${c.finance[k]}`);
    if (c.finance.balance < -800e6) bad('잔고 폭락 (-800M 미만)', `${when} ${c.id} ${Math.round(c.finance.balance / 1e6)}M`);
    if (c.finance.transferBudget < 0) bad('이적 예산 음수', `${when} ${c.id} ${c.finance.transferBudget}`);
  }
  for (const p of Object.values(w.players)) {
    if (p.clubId && !p.clubId.startsWith('nt-') && !owner.has(p.id) && w.clubs[p.clubId]) bad('clubId 는 있는데 선수단에 없음', `${when} ${p.id} ${p.clubId}`);
    if (p.clubId?.startsWith('nt-')) bad('클럽 선수 clubId 가 대표팀', `${when} ${p.id}`);
    if (p.clubId && !w.clubs[p.clubId]) bad('없는 구단 소속', `${when} ${p.id} ${p.clubId}`);
    if (p.loan && !w.clubs[p.loan.from]) bad('임대 원소속 구단 없음', `${when} ${p.id}`);
    if (p.loan && !p.clubId) bad('임대 중인데 소속 없음', `${when} ${p.id}`);
  }
  for (const comp of Object.values(w.competitions)) {
    for (const f of comp.fixtures) {
      if (f.date < w.date && !f.result) bad('지난 경기 결과 없음', `${when} ${comp.id} ${f.date} ${f.home}-${f.away}`);
      if (f.result && (!num(f.result.homeGoals) || !num(f.result.awayGoals))) bad('경기 점수 이상', `${when} ${f.id}`);
    }
    const t = Object.values(comp.table);
    const played = t.reduce((a, r) => a + r.p, 0), done = comp.fixtures.filter((f) => f.result && !f.stage).length;   // 플레이오프 등 stage 경기는 순위표 밖
    if (played !== done * 2) bad('순위표 경기 수 ≠ 결과 수 ×2', `${when} ${comp.id} ${played} vs ${done * 2}`);
    for (const r of t) if (r.w + r.d + r.l !== r.p || r.pts > r.w * 3 + r.d ||   /* 재정 규정 감점은 허용 (작아질 수만) */ !w.clubs[r.club]) { bad('순위표 줄 이상', `${when} ${comp.id} ${JSON.stringify(r)} 구단 ${!!w.clubs[r.club]} 리그 ${w.clubs[r.club]?.league}`); break; }
  }
}

const t0 = Date.now();
let w = createWorld(input(`${Y0}-${String((Y0 + 1) % 100).padStart(2, '0')}`), 'c83d96l', SEED);
if (!w.clubs['c83d96l']) w = createWorld(input(w.season), Object.keys(w.clubs)[0], SEED);
console.log(`■ 불변 조건 점검: ${w.season}부터 ${SEASONS}시즌 · 시드 ${SEED} · 리그 ${Object.keys(w.competitions).length}개 · 선수 ${Object.keys(w.players).length}명`);
check(w, `${w.season} 시작`);
for (let s = 0; s < SEASONS; s++) {
  let d = 0;
  try {
    while (!seasonOver(w) && d < 420) {
      advanceDay(w); d++;
      if (d % 7 === 0) check(w, `${w.date}`);
    }
  } catch (e) { bad('advanceDay 예외', `${w.date} ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`); break; }
  if (!seasonOver(w)) bad('시즌이 420일 안에 끝나지 않음', w.season);
  check(w, `${w.season} 끝`);
  const ded = Object.values(w.competitions).flatMap((c) => Object.values(c.table).filter((r) => r.pts < r.w * 3 + r.d).map((r) => `${r.club}(${c.id} -${r.w * 3 + r.d - r.pts})`));
  if (ded.length) console.log(`  ${w.season} 재정 규정 감점: ${ded.join(' ')}`);
  const size = JSON.stringify(w).length;
  const inbox = w.inbox.length;
  try {
    closeSeason(w);
    const next = nextSeasonOf(w.season);
    const r = startNextSeason(w, input(next));
    console.log(`  ${w.season} 시작 · ${d}일 진행 · 은퇴 ${r.retired.length} · 데뷔 ${r.debuts.length} · 저장 크기 ${(size / 1e6).toFixed(1)}MB · 받은편지함 ${inbox} · 선수 ${Object.keys(w.players).length} (${Math.round((Date.now() - t0) / 1000)}초)`);
  } catch (e) { bad('시즌 전환 예외', `${w.season} ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`); break; }
  check(w, `${w.season} 시작`);
}
console.log(problems.size ? '\n■ 문제' : '\n■ 문제 없음');
for (const [k, v] of problems) console.log(`  ${k} ×${v.n} · 예: ${v.ex}`);
