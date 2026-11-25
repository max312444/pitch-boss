import { describe, expect, it } from 'vitest';
import { ceremonySlides, comboName } from './awardSlides';
import type { Award, AwardKind } from '../engine/awards';

const aw = (kind: AwardKind, player?: string): Award => ({ kind, season: '2025-26', league: 'eng1', club: 'c1', value: '', rewards: [], ...(player ? { player } : {}) });

describe('수상 연출 순서', () => {
  it('우승 트로피 먼저 → 선수별 개인상 (가벼운 상부터) → 2개 이상이면 요약 · 상이 많은 선수가 마지막', () => {
    const s = ceremonySlides([aw('mvp', 'a'), aw('champion'), aw('boot', 'a'), aw('glove', 'b'), aw('world', 'a'), aw('cup')]);
    expect(s.map((x) => (x.t === 'combo' ? `요약:${x.awards.length}` : x.a.kind))).toEqual(['champion', 'cup', 'glove', 'boot', 'mvp', 'world', '요약:3']);
    const a = s.filter((x) => x.t === 'solo' && x.a.player === 'a');
    expect(a.map((x) => (x.t === 'solo' ? `${x.step}/${x.total}` : ''))).toEqual(['1/3', '2/3', '3/3']);
    expect(s.some((x) => x.t === 'combo' && x.player === 'b')).toBe(false);   // 1개는 요약 없음
  });
  it('한 시즌 개인상 개수별 이름', () => {
    expect([2, 3, 4, 5, 6].map(comboName)).toEqual(['더블', '트레블', '쿼드러플', '전설의 시즌', '전설의 시즌']);
  });
});
