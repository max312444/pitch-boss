import { describe, expect, it } from 'vitest';
import { leagueSubs, leagueTops } from './leagueTabs';

const L = (id: string, nation: string, level: number) => ({ id, nation, level });
const list = [L('eng1', 'ENG', 1), L('eng2', 'ENG', 2), L('esp1', 'ESP', 1), L('esp2', 'ESP', 2), L('ned1', 'NED', 1), L('ita2', 'ITA', 2)];

describe('리그 탭 (1부 줄 + 하위 리그 줄)', () => {
  it('윗줄은 나라별 1부만, 순서 유지', () => {
    expect(leagueTops(list).map((l) => l.id)).toEqual(['eng1', 'esp1', 'ned1', 'ita2']);
  });
  it('1부가 없는 나라는 가장 높은 단계가 윗줄에', () => {
    expect(leagueTops([L('eng2', 'ENG', 2), L('eng3', 'ENG', 3)]).map((l) => l.id)).toEqual(['eng2']);
  });
  it('하위 줄은 고른 나라의 2부 · 3부만', () => {
    expect(leagueSubs([...list, L('eng3', 'ENG', 3)], 'ENG').map((l) => l.id)).toEqual(['eng2', 'eng3']);
    expect(leagueSubs(list, 'NED')).toEqual([]);
    expect(leagueSubs(list, 'ITA')).toEqual([]);
    expect(leagueSubs(list, undefined)).toEqual([]);
  });
});
