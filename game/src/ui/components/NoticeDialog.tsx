// 게임 시작 전 안내 (고지): 감독 시뮬레이터이며 실제 선수 · 평가 · 보도가 아님 · 실명 데이터와 사진은 사용자가 직접 넣음
//  첫 화면 인트로가 끝나면 바로 보여 준다 (TitleScreen). 첫 화면 아래 「고지 보기」로 다시 볼 수 있다
import { Icon } from './Icon';

const KEY = 'pitchboss.notice.v3';   // v3: 실명 데이터 · 사진은 직접 넣기 · 세계 대회 · 엠블럼 · 저장 안내
export const noticeSeen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(KEY, '1'); } catch { /* 저장 못 해도 진행 */ } };

const ITEMS: React.ReactNode[] = [
  <>등장하는 선수 · 구단 · 리그 · 대회는 <span className="text-hi">게임 속 가상의 존재 (패러디 이름)</span>이며, 실제 인물이나 단체와 관계가 없습니다. 국가대표 대회도 가상의 「세계 대회」입니다.</>,
  <>능력치 · 몸값 · 체형 · 호칭 · 언론 평가는 모두 <span className="text-hi">게임이 만든 값</span>이며, 실제 선수에 대한 평가나 실제 보도가 아닙니다. 키 · 몸무게 등 일부 기본 정보는 공개 자료(Wikidata)를 참고했습니다.</>,
  <>구단 엠블럼은 게임이 만든 가상 엠블럼이며 <span className="text-hi">실제 구단 로고가 아닙니다</span>.</>,
  <><span className="text-hi">실명 데이터와 선수 사진은 게임에 들어 있지 않습니다.</span> 실명 데이터 · 사진은 사용자가 직접 파일을 업로드하셔야 하며, 이 브라우저에만 저장되고 어디로도 전송되지 않습니다.</>,
  <>경기 결과와 이적은 시뮬레이션으로 정해지며, 세이브마다 다른 이야기가 펼쳐집니다.</>,
  <>저장은 이 브라우저에 됩니다. 브라우저 데이터를 지우면 사라질 수 있으니 중요한 세이브는 <span className="text-hi">파일로 내보내 두세요</span>.</>,
  <>비공식 팬 프로젝트로, 어떤 리그 · 구단 · 협회 · 게임사의 승인도 받지 않았습니다.</>,
];

export function NoticeDialog({ onClose, confirmLabel = '확인하고 시작' }: { onClose: () => void; confirmLabel?: string }) {
  const close = () => { markSeen(); onClose(); };
  return (
    <div className="fixed inset-0 z-50 grid animate-[fade_0.2s_ease-out] place-items-center bg-ink-950/85 p-2 sm:p-8 backdrop-blur-sm">
      <div className="panel flex max-h-[calc(100dvh-16px)] w-full max-w-[580px] flex-col overflow-hidden sm:max-h-[calc(100dvh-64px)]">
        <div className="min-h-0 overflow-y-auto px-6 pt-7 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
          <div className="text-[12px] text-lo">시작하기 전에 · 고지</div>
          <h2 className="mt-2 text-[20px] font-semibold sm:text-[22px]">이 게임은 축구 감독 시뮬레이터입니다</h2>
          <ul className="mt-5 space-y-3.5 text-[13px] leading-relaxed text-mid sm:mt-6 sm:text-[14px]">
            {ITEMS.map((it, i) => (
              <li key={i} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neon" /><span>{it}</span></li>
            ))}
          </ul>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8 sm:py-5">
          <span className="text-[12px] text-lo">참고 자료: Wikidata · Wikipedia</span>
          <button onClick={close} className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-neon px-6 text-[14px] font-semibold text-ink-950 transition-colors hover:bg-[#5bff3d]">
            {confirmLabel} <Icon name="arrow" size={17} />
          </button>
        </footer>
      </div>
    </div>
  );
}
