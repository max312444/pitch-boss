// 의견 보내기: 개발자 구글 설문 (종류 · 내용). 게임이 종류를 고르고, 내용 칸 아래에 게임 정보(버전 · 기기 · 화면 · 모드 · 시즌)를 미리 넣어 연다
//  개인 정보는 넣지 않는다 (계정 · 이름 · 위치 없음). 사용자는 내용 칸 위쪽에 의견을 적고, 원하면 자동 정보는 지워도 된다
import { GAME_VERSION } from '../version';
import type { World } from '../engine/types';

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSewwMCJfKG6p8XzdYOwX7utHc7cTuvaXLhbkWUlZicANMx7Ig/viewform';
const ENTRY = { kind: 'entry.1180164544', body: 'entry.1103273511' };

/** 설문의 종류 선택지 (설문 문구와 같아야 미리 선택된다). 기타는 비워 둔다 */
export const FEEDBACK_KINDS = [
  { id: '버그', label: '버그 제보', desc: '안 눌림 · 화면 깨짐 · 이상한 결과' },
  { id: '개선 의견', label: '개선 의견', desc: '이랬으면 좋겠다 · 불편한 점' },
  { id: '문의', label: '문의', desc: '궁금한 점 · 사용법' },
  { id: '', label: '기타', desc: '그 밖의 이야기' },
] as const;

function device(): string {
  try {
    const ua = navigator.userAgent;
    const touch = navigator.maxTouchPoints > 0, short = Math.min(screen.width, screen.height);
    const kind = /iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && touch) || (/Android/.test(ua) && !/Mobi/.test(ua)) ? '태블릿' : /Mobi|Android|iPhone/i.test(ua) ? '휴대폰' : touch && short < 600 ? '휴대폰(추정)' : touch && short < 1100 ? '태블릿(추정)' : 'PC';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '기타';
    const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '기타';
    return `${kind} · ${os} · ${br} · 화면 ${innerWidth}×${innerHeight}`;
  } catch { return '알 수 없음'; }
}

/** 내용 칸에 미리 넣는 게임 정보 */
export function gameInfo(w: World | null, extra?: { clubName?: string; dataset?: string }): string {
  const mode = !w ? '게임 밖 (첫 화면)' : w.intl ? '세계 대회 모드' : w.myClub ? '나의 구단 모드' : '기본 모드';
  const lines = [
    `버전 v${GAME_VERSION}`,
    `기기 ${device()}`,
    `모드 ${mode}${w ? ` · ${w.season.replace('-', '/')} 시즌 · ${w.date}` : ''}${extra?.clubName ? ` · ${extra.clubName}` : ''}${extra?.dataset ? ` · ${extra.dataset === 'real' ? '실명 데이터' : '패러디 이름'}` : ''}`,
  ];
  return lines.join('\n');
}

/** 미리 채운 설문 주소 */
export function feedbackUrl(kind: string, info: string): string {
  const body = `\n\n\n― 아래는 게임이 자동으로 넣은 정보입니다 (지워도 됩니다) ―\n${info}`;
  const q = new URLSearchParams({ usp: 'pp_url' });
  if (kind) q.set(ENTRY.kind, kind);
  q.set(ENTRY.body, body);
  return `${FORM}?${q.toString()}`;
}
