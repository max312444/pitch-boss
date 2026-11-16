// 직접 하는 승부차기 규칙
import { describe, expect, it } from 'vitest';
import { resolveKick, shootoutOver, type Kick } from './shootoutSeq';

const k = (s: string): Kick[] => [...s].map((c) => ({ id: 'x', scored: c === 'o', saved: c === 'x' }));

describe('직접 하는 승부차기', () => {
  it('끝나는 때: 따라잡을 수 없으면 바로 · 5명씩 동점이면 서든데스', () => {
    expect(shootoutOver(k('ooo'), k('xx'))).toBe(null);          // 3-0 이지만 상대가 3번 남음
    expect(shootoutOver(k('ooo'), k('xxx'))).toBe('home');       // 3-0, 상대 2번 남음 → 끝
    expect(shootoutOver(k('ooooo'), k('ooooo'))).toBe(null);     // 5-5 서든데스
    expect(shootoutOver(k('oooooo'), k('ooooox'))).toBe('home');
    expect(shootoutOver(k('oooox'), k('ooooo'))).toBe('away');
  });
  it('방향: 골키퍼가 맞는 쪽이면 대부분 선방, 다른 쪽이면 대부분 골', () => {
    let same = 0, diff = 0;
    for (let i = 0; i < 2000; i++) {
      const r1 = (i * 0.618) % 1, r2 = (i * 0.414) % 1;
      if (resolveKick(0.8, 'L', 'L', r1, r2).scored) same++;
      if (resolveKick(0.8, 'L', 'R', r1, r2).scored) diff++;
    }
    expect(same / 2000).toBeLessThan(0.4);
    expect(diff / 2000).toBeGreaterThan(0.85);
  });
});
