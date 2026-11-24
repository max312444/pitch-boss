// 새 게임 화면의 리그 탭: 나라별 맨 윗단계 한 줄 + 고른 나라의 아래 단계 작은 줄
//  - 리그 정보 (나라 · 단계) 는 leagues.json 의 nation · level 을 쓴다
//  - 넘겨받은 목록 (그 시즌 데이터가 있는 리그) 순서를 지킨다
interface Lg { id: string; nation: string; level: number }

/** 나라마다 가장 높은 단계 리그 하나 (보통 1부) */
export function leagueTops<T extends Lg>(list: T[]): T[] {
  const best = new Map<string, T>();
  for (const l of list) { const b = best.get(l.nation); if (!b || l.level < b.level) best.set(l.nation, l); }
  const seen = new Set<string>();
  return list.filter((l) => !seen.has(l.nation) && (seen.add(l.nation), true)).map((l) => best.get(l.nation)!);
}

/** 그 나라에서 맨 윗단계 말고 나머지 (2부 · 3부, 단계 순) */
export function leagueSubs<T extends Lg>(list: T[], nation: string | undefined): T[] {
  if (!nation) return [];
  const mine = list.filter((l) => l.nation === nation);
  const topLevel = Math.min(...mine.map((l) => l.level));
  return mine.filter((l) => l.level > topLevel).sort((a, b) => a.level - b.level);
}
