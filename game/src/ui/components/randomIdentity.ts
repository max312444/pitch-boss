// 무작위 구단 (이름 · 약칭 · 경기장 · 색 · 엠블럼) · 무작위 감독 이름 — 새 게임 화면의 「무작위」 버튼
//  구단 이름은 실제 구단과 겹치지 않게 지어낸 지명 + 흔한 꼬리말 (FC · 유나이티드 …)
import type { MyClubDesign } from '../../engine/myclubDesign';
import type { CrestCharge, CrestPattern, CrestShape } from '../crests/types';

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** [한국어 표기, 약칭용 로마자] — 지어낸 지명 */
const PLACES: [string, string][] = [
  ['아르덴베일', 'ARD'], ['벨모어', 'BEL'], ['칼리스타', 'KAL'], ['노르드빅', 'NOR'], ['스톤헤이븐', 'STH'], ['실버포트', 'SVP'], ['레이븐홀', 'RAV'],
  ['그레이마운트', 'GRM'], ['하이브리지', 'HBR'], ['오크밸리', 'OAK'], ['루미에르', 'LUM'], ['솔바인', 'SOL'], ['에스트라', 'EST'], ['미라벨', 'MIR'],
  ['블루코스트', 'BLC'], ['윈드미어', 'WND'], ['코랄베이', 'COR'], ['팔콘리지', 'FAL'], ['아이언데일', 'IRD'], ['선라이즈', 'SUN'], ['노바폴리스', 'NOV'],
  ['엘름우드', 'ELM'], ['크레스트필드', 'CRF'], ['베르디아', 'VER'], ['몬테루나', 'MTL'], ['포르타노바', 'PTN'], ['카스텔로', 'CAS'], ['리버하트', 'RVH'],
];
const SUFFIX = ['FC', '유나이티드', '시티', '애슬레틱', '로버스', 'SC', '스포르팅', '레인저스', 'AFC'];
const PREFIX = ['', '', '', '', '레알 ', '스포르팅 ', 'AC ', '인테르 '];
const STADIUM = ['아레나', '파크', '스타디움', '그라운드', '필드', '로드'];

const SWATCH = ['#c8102e', '#e4572e', '#f2a900', '#ffd100', '#2e8b57', '#00843d', '#00a3e0', '#1c3f94', '#5b2c83', '#6c1d45', '#111111', '#4a4a4a', '#ffffff', '#d9c7a1'];
const SHAPES: CrestShape[] = ['shield', 'round', 'oval', 'pointed', 'diamond', 'cut'];
const PATTERNS: CrestPattern[] = ['solid', 'solid', 'stripes', 'hoops', 'halves', 'quarters', 'sash', 'band'];
const CHARGES: CrestCharge[] = ['letters', 'letters', 'ball', 'star', 'crown', 'tower', 'bird', 'cannon', 'cross', 'fleur'];

/** 밝기 (0~1) — 주색 · 보조색이 비슷하면 다시 고름 */
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

/** 엠블럼만 무작위 (색 · 모양 · 무늬 · 문장 · 별) */
export function randomCrest(): Pick<MyClubDesign, 'colors' | 'shape' | 'pattern' | 'charge' | 'star'> {
  const primary = pick(SWATCH.filter((c) => c !== '#ffffff'));
  let secondary = pick(SWATCH);
  for (let i = 0; i < 20 && (secondary === primary || Math.abs(lum(secondary) - lum(primary)) < 0.3); i++) secondary = pick(SWATCH);
  const border = pick(['#111111', '#ffffff', '#f2a900', '#d9c7a1', primary]);
  return { colors: [primary, secondary, border === primary ? '#111111' : border], shape: pick(SHAPES), pattern: pick(PATTERNS), charge: pick(CHARGES), star: Math.random() < 0.15 };
}

/** 구단 전체 무작위 (이름 · 약칭 · 경기장 · 엠블럼). 직접 넣은 로고 이미지는 지움 */
export function randomDesign(): MyClubDesign {
  const [place, en] = pick(PLACES);
  const pre = pick(PREFIX);
  const suf = pre ? '' : pick(SUFFIX);
  const name = `${pre}${place}${suf ? ` ${suf}` : ''}`;
  return { name, short: en, stadium: `${place} ${pick(STADIUM)}`, ...randomCrest() };
}

// ── 감독 이름 (한국 이름) ──
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍', '전', '고', '문', '양', '손', '배', '백', '허', '남', '노'];
const GIVEN = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준우', '현우', '도현', '건우', '우진', '선우', '서진', '민재', '현준', '연우', '유준',
  '정우', '승우', '승현', '시윤', '준혁', '은우', '지환', '승민', '지우', '유찬', '태윤', '동현', '재원', '성민', '영호', '상철', '진수', '용준', '태현', '형석'];
export const randomManagerName = () => `${pick(SURNAMES)}${pick(GIVEN)}`;
