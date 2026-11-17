// 피치 자유 배치: 놓은 위치 그대로 · 구역으로 포지션 · 포메이션 버튼이면 기본 위치
import { describe, expect, it } from 'vitest';
import { moveFree, placeXY, slotXY } from './placement';
import { FORMATIONS, zonePos } from './squad';

describe('자유 배치', () => {
  const f = '4-3-3', slots = FORMATIONS[f];
  it('같은 구역 안에서 옮기면 포지션 · 포메이션은 그대로, 위치만 저장', () => {
    const i = slots.indexOf('LW');
    const r = moveFree(slots, f, null, i, 20, 30);
    expect('same' in r && r.same).toBe(true);
    if (!('pts' in r)) throw 0;
    const xy = placeXY(slots, f, { formation: f, pts: r.pts });
    expect(xy[i]).toEqual({ x: 20, y: 30 });
    expect(xy[0]).toEqual(slotXY(slots)[0]);   // 나머지는 기본 위치
  });
  it('다른 구역에 놓으면 그 포지션 → 포메이션이 바뀌고 위치는 따라간다', () => {
    const i = slots.indexOf('LW');
    const r = moveFree(slots, f, null, i, 45, 15);   // 가운데 위 → ST
    if ('error' in r || r.same) throw new Error('바뀌어야 함');
    expect(r.pos).toBe('ST');
    const j = r.order.indexOf(i);
    expect(r.slots[j]).toBe('ST');
    expect(r.pts[j]).toEqual([45, 15]);
    expect(zonePos(...r.pts[j])).toBe('ST');
  });
  it('골키퍼는 못 옮기고, 필드 선수를 골키퍼 구역에 못 놓는다', () => {
    expect('error' in moveFree(slots, f, null, 0, 50, 50)).toBe(true);
    expect('error' in moveFree(slots, f, null, 1, 50, 95)).toBe(false);   // 84 로 눌러 CB 구역
  });
  it('포메이션이 다르면 (버튼으로 바꿈) 저장된 위치를 무시하고 기본 위치', () => {
    const pts = slotXY(slots).map((p): [number, number] => [p.x + 1, p.y]);
    expect(placeXY(FORMATIONS['4-4-2'], '4-4-2', { formation: f, pts })).toEqual(slotXY(FORMATIONS['4-4-2']));
  });
  it('기본 위치: 같은 줄의 측면 · 가운데 선수가 너무 붙지 않는다', () => {
    for (const [k, s] of Object.entries(FORMATIONS)) {
      const xy = slotXY(s);
      for (let a = 0; a < s.length; a++) for (let b = a + 1; b < s.length; b++)
        if (Math.abs(xy[a].y - xy[b].y) < 6) expect(Math.abs(xy[a].x - xy[b].x), `${k} ${s[a]}-${s[b]}`).toBeGreaterThanOrEqual(16);
    }
  });
});

describe('경기 중 ★ 내 배치 를 다시 바꿔도 선수가 빠지지 않는다', () => {
  it('덮어쓰기 전 자리 순서를 넘기면 11명 그대로', async () => {
    const { reshapeTeam, slotOrder } = await import('./match');
    const { registerFormations } = await import('./squad');
    const K = '★ 내 배치';
    const A = ['GK', 'RB', 'CB', 'CB', 'LB', 'AM', 'DM', 'CM', 'RW', 'ST', 'LW'] as const;
    registerFormations({ [K]: [...A] });
    const mk = () => ({ home: { tactics: { formation: K }, onPitch: A.map((s, i) => ({ id: `p${i}`, slot: s })) }, segment: 9, notes: [] }) as never as import('./match').MatchState;
    // AM 을 가운데 위로 (ST) → 또 다른 내 배치 모양
    const m = mk();
    const r = moveFree([...A], K, null, 5, 50, 20);
    if ('error' in r || r.same || r.formation) throw new Error('내 배치가 되어야 함');
    const before = slotOrder(m.home);
    registerFormations({ [K]: r.slots });   // autoFormation 이 같은 이름을 덮어씀
    expect(FORMATIONS[K]).toEqual(r.slots);
    reshapeTeam(m, 'home', K, r.order, before);
    expect(m.home.onPitch.length).toBe(11);
    // 예전 방식 (덮어쓴 뒤 읽음) 은 선수가 빠졌다
    const old = mk();
    registerFormations({ [K]: [...A] });
    registerFormations({ [K]: r.slots });
    reshapeTeam(old, 'home', K, r.order);
    expect(old.home.onPitch.length).toBeLessThan(11);
    registerFormations({});
  });
});
