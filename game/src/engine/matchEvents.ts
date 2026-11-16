// 경기 중 사건 (세계 대회 모드 · 직접 지휘하는 내 경기): 구간 사이에 멈추고 감독이 고른다
//  - 하프타임 라커룸 연설 (매 경기): 칭찬 · 다그치기 · 차분하게 → 점수 상황에 따라 후반 경기력 ±
//  - 통증 호소 (가끔): 바로 교체 · 참고 뛰게 (경기력 −15% · 부상 위험 25%)
//  - 우리 페널티 (가끔): 키커 · 방향을 직접 (상대 골키퍼는 무작위로 몸을 날림)
//  - 상대 페널티 (가끔): 우리 골키퍼가 몸을 날릴 방향
//  - 막판 (80분, 1골 차 안): 총공격 · 잠그기 · 그대로
//  결과 계산은 승부차기와 같은 규칙 (shootoutSeq.ts kickChance · resolveKick)
import type { MatchCtx, MatchState } from './match';
import { goalAt, setTactics, substitute, taker } from './match';
import type { Mentality, Side } from './types';
import { aiDir, kickChance, resolveKick, DIR_KO, type Dir } from './shootoutSeq';
import { posGroup } from '../data/rating';
import { overall } from './ratings';

export type MEvKind = 'halftime' | 'knock' | 'penFor' | 'penAgainst' | 'late';
export interface MatchEvent {
  kind: MEvKind;
  minute: number;
  title: string;
  body: string;
  choices: { k: string; label: string; hint?: string }[];
  /** 통증 호소 선수 · 상대 키커 */
  player?: string;
  /** 우리 페널티 키커 후보 (능력 순) */
  takers?: string[];
  /** 고른 뒤 결과 문장 */
  result?: string;
  good?: boolean;
}

const SEG_MIN = 5;
const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');

/** 구간이 끝난 뒤: 사건이 생기면 돌려준다 (seen = 이번 경기에 이미 나온 종류) */
export function rollMatchEvent(m: MatchState, side: Side, ctx: MatchCtx, seen: string[]): MatchEvent | null {
  if (m.done) return null;
  const { rng } = ctx;
  const me = m[side], opp = m[other(side)];
  const minute = m.segment * SEG_MIN;
  const diff = me.goals - opp.goals;
  if (m.segment === 9 && !seen.includes('halftime')) {
    return {
      kind: 'halftime', minute, title: '하프타임 라커룸', body: diff > 0 ? `${me.goals}-${opp.goals}로 앞선 채 전반이 끝났습니다. 선수들에게 뭐라고 할까요?` : diff < 0 ? `${me.goals}-${opp.goals}로 뒤진 채 전반이 끝났습니다. 분위기를 바꿔야 합니다.` : `${me.goals}-${opp.goals} 팽팽한 전반이었습니다. 후반을 어떻게 준비할까요?`,
      choices: [{ k: 'praise', label: '칭찬하기', hint: '앞설 때 좋음' }, { k: 'push', label: '다그치기', hint: '뒤질 때 좋음 · 앞설 땐 역효과' }, { k: 'calm', label: '차분하게 정리', hint: '무난함 · 비길 때 좋음' }],
    };
  }
  if (m.segment >= 6 && m.segment <= 16 && !seen.includes('knock') && rng.chance(0.022)) {
    const cands = me.onPitch.filter((o) => o.slot !== 'GK');
    if (cands.length) {
      const o = rng.pick(cands);
      return { kind: 'knock', minute, player: o.id, title: '통증 호소', body: '선수가 다리를 붙잡고 쓰러졌습니다. 의료진은 뛸 수는 있지만 무리하면 다칠 수 있다고 합니다.', choices: [{ k: 'sub', label: '바로 교체', hint: me.subsUsed < me.maxSubs ? `교체 ${me.maxSubs - me.subsUsed}번 남음` : '교체가 남지 않음' }, { k: 'stay', label: '참고 뛰게 하기', hint: '경기력 −15% · 부상 위험' }] };
    }
  }
  if (m.segment >= 2 && m.segment <= 17 && !seen.includes('penFor') && rng.chance(0.013)) {
    const takers = me.onPitch.filter((o) => o.slot !== 'GK').map((o) => ctx.players[o.id]).sort((a, b) => kickChance(b, undefined) - kickChance(a, undefined)).slice(0, 3).map((p) => p.id);
    if (takers.length) return { kind: 'penFor', minute, takers, title: '페널티킥!', body: '페널티 박스 안에서 반칙! 키커와 방향을 정하세요.', choices: [{ k: 'L', label: '왼쪽' }, { k: 'C', label: '가운데' }, { k: 'R', label: '오른쪽' }] };
  }
  if (m.segment >= 2 && m.segment <= 17 && !seen.includes('penAgainst') && rng.chance(0.009)) {
    const pk = taker(opp, ctx, 'pen');
    if (pk && me.onPitch.some((o) => o.slot === 'GK')) return { kind: 'penAgainst', minute, player: pk.id, title: '상대 페널티킥', body: '우리 수비가 박스 안에서 반칙을 했습니다. 골키퍼는 어느 쪽으로 몸을 날릴까요?', choices: [{ k: 'L', label: '왼쪽' }, { k: 'C', label: '가운데' }, { k: 'R', label: '오른쪽' }] };
  }
  if (m.segment === 16 && Math.abs(diff) <= 1 && !seen.includes('late')) {
    return { kind: 'late', minute, title: '막판 10분', body: diff > 0 ? '한 골 앞서 있습니다. 끝까지 지킬까요, 쐐기골을 노릴까요?' : diff < 0 ? '한 골 뒤져 있습니다. 승부를 걸까요?' : '동점입니다. 마지막 10분, 어떻게 할까요?', choices: [{ k: 'attack', label: '총공격', hint: '공수 성향 +2' }, { k: 'defend', label: '잠그기', hint: '공수 성향 −2' }, { k: 'keep', label: '그대로' }] };
  }
  return null;
}

/** 고른 대로 처리하고 결과 문장 */
export function applyMatchEvent(m: MatchState, side: Side, ev: MatchEvent, choice: string, ctx: MatchCtx, taker0?: string): { text: string; good: boolean } {
  const { rng } = ctx;
  const me = m[side], opp = m[other(side)];
  const boost = (k: number) => { for (const o of me.onPitch) o.factor *= k; };
  const name = (id: string) => ctx.players[id]?.name ?? id;
  switch (ev.kind) {
    case 'halftime': {
      const diff = me.goals - opp.goals;
      const k = choice === 'praise' ? (diff > 0 ? 1.04 : diff === 0 ? 1.02 : 0.99) : choice === 'push' ? (diff < 0 ? 1.06 : diff === 0 ? 1.03 : 0.98) : diff === 0 ? 1.03 : 1.02;
      boost(k);
      if (choice === 'push' && diff < 0) setTactics(m, side, { mentality: Math.min(2, me.tactics.mentality + 1) as Mentality });
      const pct = Math.round((k - 1) * 100);
      return { text: pct > 0 ? `선수들의 눈빛이 달라졌습니다 · 후반 경기력 +${pct}%` : pct < 0 ? `분위기가 가라앉았습니다 · 후반 경기력 ${pct}%` : '선수들이 고개를 끄덕입니다', good: pct >= 0 };
    }
    case 'knock': {
      const o = me.onPitch.find((x) => x.id === ev.player);
      if (!o) return { text: '이미 경기장 밖에 있습니다', good: true };
      if (choice === 'sub' && me.subsUsed < me.maxSubs) {
        const g = posGroup(o.slot);
        const pick = me.bench.map((id) => ctx.players[id]).filter((p) => p && !p.injury).sort((a, b) => +(posGroup(b.pos) === g) - +(posGroup(a.pos) === g) || overall(b) - overall(a))[0];
        if (pick && substitute(m, side, o.id, pick.id, ctx)) return { text: `${name(o.id)} 대신 ${name(pick.id)} 투입`, good: true };
      }
      o.factor *= 0.85;
      if (rng.chance(0.25)) { const p = ctx.players[o.id]; p.injury = { days: rng.int(7, 21), label: '통증을 참고 뛰다 부상' }; return { text: `${name(o.id)}이(가) 참고 뛰었지만 경기 뒤 부상 판정 (${p.injury.days}일)`, good: false }; }
      return { text: `${name(o.id)}이(가) 이를 악물고 계속 뜁니다 (경기력 −15%)`, good: true };
    }
    case 'penFor': {
      const kid = taker0 && me.onPitch.some((o) => o.id === taker0) ? taker0 : ev.takers![0];
      const gk = opp.onPitch.find((o) => o.slot === 'GK');
      const dive = aiDir(rng.next());
      const r = resolveKick(kickChance(ctx.players[kid], gk ? ctx.players[gk.id] : undefined), choice as Dir, dive, rng.next(), rng.next());
      me.xg += 0.76;
      if (r.scored) { goalAt(m, side, kid, undefined, 'pen', rng); return { text: `골! ${name(kid)} → ${DIR_KO[choice as Dir]} · 골키퍼는 ${DIR_KO[dive]}`, good: true }; }
      me.shots++;
      m.notes?.push({ minute: ev.minute, side, kind: r.saved ? 'penSave' : 'penMiss', player: kid });
      return { text: r.saved ? `선방에 막혔습니다 · 골키퍼가 ${DIR_KO[dive]}으로 읽었습니다` : `${name(kid)}의 슛이 빗나갔습니다`, good: false };
    }
    case 'penAgainst': {
      const kid = ev.player!;
      const gk = me.onPitch.find((o) => o.slot === 'GK');
      const shot = aiDir(rng.next());
      const r = resolveKick(kickChance(ctx.players[kid], gk ? ctx.players[gk.id] : undefined), shot, choice as Dir, rng.next(), rng.next());
      opp.xg += 0.76;
      if (r.scored) { goalAt(m, other(side), kid, undefined, 'pen', rng); return { text: `실점 · 상대는 ${DIR_KO[shot]}으로 찼습니다`, good: false }; }
      opp.shots++;
      m.notes?.push({ minute: ev.minute, side: other(side), kind: r.saved ? 'penSave' : 'penMiss', player: kid });
      return { text: r.saved ? `선방! ${DIR_KO[shot]}을 정확히 읽었습니다` : '상대 키커의 슛이 빗나갔습니다!', good: true };
    }
    case 'late': {
      if (choice === 'attack') { setTactics(m, side, { mentality: Math.min(2, me.tactics.mentality + 2) as Mentality }); return { text: '모두 올라갑니다 · 공격 앞으로!', good: true }; }
      if (choice === 'defend') { setTactics(m, side, { mentality: Math.max(-2, me.tactics.mentality - 2) as Mentality }); return { text: '수비 숫자를 늘려 잠급니다', good: true }; }
      return { text: '지금 흐름 그대로 갑니다', good: true };
    }
  }
}
