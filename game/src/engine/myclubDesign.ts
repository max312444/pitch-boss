// 나의 구단: 디자인 · 상태 타입과 구단 정보 만들기 (data/db.ts 가 가볍게 불러 쓰도록 엔진 본체와 분리)
import type { ClubMaster } from '../data/types';
import type { CrestCharge, CrestPattern, CrestShape } from '../ui/crests/types';

export interface MyClubDesign {
  name: string;
  /** 약칭 (2~4 글자, 엠블럼 글자) */
  short: string;
  /** [주색, 보조색, 테두리] */
  colors: [string, string, string];
  shape: CrestShape;
  pattern: CrestPattern;
  charge: CrestCharge;
  star?: boolean;
  stadium: string;
}
export interface MyClubState {
  id: string;
  /** 대신한 실제 구단 (이 세계에서는 없음) */
  replaced: string;
  nation: string;
  founded: number;
  design: MyClubDesign;
  /** 선수단 준비 중 (다 채우면 false → 시즌 진행) */
  setup: boolean;
}

/** 구단 정보 (이름 · 엠블럼 · 유니폼 색) — db.ts 의 clubs 에 등록해서 다른 구단처럼 보이게 */
export function myClubMaster(st: MyClubState): ClubMaster {
  const d = st.design;
  return {
    id: st.id, name: d.name, ko: d.name, short: d.short.toUpperCase(), nation: st.nation, stadiumName: d.stadium, founded: st.founded,
    kits: { home: { primary: d.colors[0], secondary: d.colors[1], pattern: d.pattern === 'stripes' || d.pattern === 'hoops' || d.pattern === 'halves' || d.pattern === 'sash' ? d.pattern : 'plain' } },
    crest: { shape: d.shape, colors: d.colors, pattern: d.pattern, charge: d.charge, mark: d.short.toUpperCase(), star: d.star },
  };
}

