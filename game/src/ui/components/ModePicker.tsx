// 새 게임 → 게임 모드 고르기 팝업 (타이틀 화면): 기본 · 나의 구단 · 월드컵, 모드마다 설명
import { useEffect } from 'react';
import type { GameMode } from '../../store/app';

const MODES: { k: GameMode; title: string; tag: string; lines: string[]; soon?: boolean }[] = [
  {
    k: 'base', title: '기본', tag: '실제 구단 감독 커리어',
    lines: [
      '2000/01 ~ 2025/26 실제 시즌에서 실제 구단 하나를 골라 감독이 됩니다.',
      '이적 · 임대 · 재계약 · 재정 · 이사회 · 스폰서 · 유럽 대회까지 모든 것을 직접 운영합니다.',
      '성적이 나쁘면 경질될 수 있고, 다른 구단의 감독 제안도 받습니다.',
    ],
  },
  {
    k: 'my', title: '나의 구단', tag: '처음부터 창단',
    lines: [
      '구단 이름 · 약칭 · 색 · 엠블럼(또는 로고 이미지) · 경기장 이름을 직접 정합니다.',
      '고른 리그의 꼴찌 자리를 대신해 들어가고, 그 구단 선수들은 자유계약으로 풀립니다.',
      '유스 몇 명과 넉넉한 예산으로 시작해 영입 · 자유계약으로 선수단을 처음부터 꾸립니다. 내가 만든 구단이라 경질은 없습니다.',
    ],
  },
  {
    k: 'wc', title: '월드컵', tag: '대표팀 감독', soon: true,
    lines: [
      '나라 하나의 대표팀 감독이 되어 A매치 → 예선 → 본선 → 다음 월드컵을 계속 이어 갑니다.',
      '이적시장은 없습니다. 대표 선수 소집과 전술만 바꾸며 경기에 집중합니다.',
      '승부차기는 직접 차고 막고, 경기 중 여러 사건에 감독이 직접 판단합니다.',
    ],
  },
];

export function ModePicker({ onPick, onClose }: { onPick: (m: GameMode) => void; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid animate-[fade_0.2s_ease-out] place-items-center bg-ink-950/80 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="panel flex max-h-[92dvh] w-full max-w-[860px] flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4 lg:px-7">
          <div>
            <div className="text-[18px] font-semibold">게임 모드</div>
            <div className="text-[12px] text-lo">어떤 방식으로 시작할지 고르세요</div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md text-[18px] text-lo hover:bg-ink-800 hover:text-hi" aria-label="닫기">×</button>
        </header>
        <div className="grid gap-3 overflow-auto p-4 lg:grid-cols-3 lg:p-6">
          {MODES.map((m) => (
            <button key={m.k} disabled={m.soon} onClick={() => onPick(m.k)}
              className="group flex flex-col rounded-xl bg-ink-850 p-5 text-left ring-1 ring-line transition-colors enabled:hover:bg-ink-800 enabled:hover:ring-neon/60 disabled:opacity-60">
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-semibold">{m.title}</span>
                {m.soon && <span className="rounded bg-amber/15 px-1.5 py-px text-[11px] font-semibold text-amber">준비 중</span>}
              </div>
              <div className="mt-0.5 text-[12px] text-neon">{m.tag}</div>
              <ul className="mt-3 flex-1 space-y-1.5 text-[13px] leading-relaxed text-mid">
                {m.lines.map((l) => <li key={l} className="flex gap-2"><span className="text-lo">·</span><span>{l}</span></li>)}
              </ul>
              <span className={`mt-4 flex h-10 items-center justify-center rounded-lg text-[13px] font-semibold ${m.soon ? 'bg-ink-700 text-lo' : 'bg-neon text-ink-950 group-hover:bg-[#5bff3d]'}`}>{m.soon ? '곧 추가됩니다' : '이 모드로 시작'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
