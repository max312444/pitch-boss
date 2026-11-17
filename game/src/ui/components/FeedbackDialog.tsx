// 의견 보내기 창: 종류를 고르면 게임 정보가 미리 들어간 구글 설문을 새 탭으로 연다
import { createPortal } from 'react-dom';
import { FEEDBACK_KINDS, feedbackUrl, gameInfo } from '../../data/feedback';
import { useGame } from '../../store/game';
import { clubKo, dataset } from '../../data/db';
import { useEffect } from 'react';

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const world = useGame((s) => s.world);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const info = gameInfo(world, world ? { clubName: clubKo(world.userClubId), dataset } : { dataset });
  const open = (kind: string) => { window.open(feedbackUrl(kind, info), '_blank', 'noopener'); onClose(); };
  return createPortal(
    <div className="fixed inset-0 z-[90] grid animate-[fade_0.2s_ease-out] place-items-center bg-ink-950/80 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="panel w-full max-w-[440px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="text-[16px] font-semibold">의견 보내기</div>
            <div className="text-[12px] text-lo">개발자에게 바로 전달됩니다 (구글 설문, 새 탭)</div>
          </div>
          <button onClick={onClose} className="h-9 shrink-0 rounded-lg px-3 text-[13px] text-mid ring-1 ring-line transition-colors hover:text-hi">닫기</button>
        </header>
        <div className="grid grid-cols-2 gap-2 p-4">
          {FEEDBACK_KINDS.map((k) => (
            <button key={k.label} onClick={() => open(k.id)} className="flex min-h-[72px] flex-col items-start justify-center rounded-lg bg-ink-850 px-4 py-3 text-left ring-1 ring-line transition-colors hover:bg-ink-800 hover:ring-neon/50">
              <span className="text-[14px] font-semibold text-hi">{k.label}</span>
              <span className="mt-0.5 text-[11px] leading-snug text-lo">{k.desc}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-line px-5 py-3 text-[11px] leading-relaxed text-lo">
          함께 보내지는 정보 (설문의 내용 칸 아래에 들어가며 지울 수 있어요)
          <pre className="mt-1 font-sans whitespace-pre-wrap text-mid">{info}</pre>
          이름 · 계정 같은 개인 정보는 보내지 않습니다. 답변을 받고 싶으면 내용에 연락처를 적어 주세요.
        </div>
      </div>
    </div>,
    document.body,
  );
}
