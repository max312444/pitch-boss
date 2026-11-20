import { Crest } from './Crest';
import { activeAppeals } from '../../engine/appeal';
import { SettingsDialog } from './SettingsDialog';
import { Icon } from './Icon';
import { useApp, type HubTab } from '../../store/app';
import { clubKo, leagues, realAvailable, realSource } from '../../data/db';
import { RealImport, Switch } from './DatabaseDialog';
import { useWorld } from '../hooks';
import { useState } from 'react';
import { useGame } from '../../store/game';
import { SaveSlots } from './SaveSlots';
import { FeedbackDialog } from './FeedbackDialog';
import { HelpDialog } from './HelpDialog';

const NAV: { key: HubTab; label: string; icon: string; ready?: boolean }[] = [
  { key: 'home', label: '홈', icon: 'home', ready: true },
  { key: 'inbox', label: '받은편지함', icon: 'inbox', ready: true },
  { key: 'news', label: '뉴스', icon: 'news', ready: true },
  { key: 'squad', label: '선수단', icon: 'squad', ready: true },
  { key: 'tactics', label: '전술', icon: 'tactics', ready: true },
  { key: 'schedule', label: '일정', icon: 'schedule', ready: true },
  { key: 'table', label: '순위', icon: 'table', ready: true },
  { key: 'transfers', label: '이적', icon: 'transfers', ready: true },
  { key: 'finance', label: '재정', icon: 'finance' },
  { key: 'club', label: '구단', icon: 'club', ready: true },
];

/** 세계 대회 모드: 이적 · 재정 · 구단 없음 */
const INTL_TABS: HubTab[] = ['home', 'inbox', 'news', 'squad', 'tactics', 'schedule', 'table'];

export function Sidebar() {
  const { tab, setTab, go, drawer, setDrawer } = useApp();
  const w = useWorld();
  const club = w.clubs[w.userClubId];
  const lg = leagues.find((l) => l.id === club.league);
  const save = useGame((s) => s.save);
  const [saveOpen, setSaveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [realOpen, setRealOpen] = useState(false);   // 게임 화면에서 실명 데이터 폴더 넣기 (토글 · 「+ 파일 추가」)
  const exportFile = useGame((g) => g.exportFile);
  const unreadInjuries = club.squad.filter((id) => w.players[id].injury).length;
  const appeals = activeAppeals(w).length;   // 우리 구단에 오고 싶다고 연락한 선수
  return (
    <>
    {drawer && <div className="fixed inset-0 z-40 animate-[fade_0.2s_ease-out] bg-ink-950/70 lg:hidden" onClick={() => setDrawer(false)} />}
    <aside className={`fixed inset-y-0 z-50 flex w-[264px] shrink-0 flex-col overflow-y-auto border-r border-line bg-ink-900 pb-[env(safe-area-inset-bottom)] transition-[left] duration-200 lg:static lg:z-auto lg:w-60 ${drawer ? 'left-0 shadow-2xl' : '-left-[280px]'}`}>
      <div className="flex items-center gap-3 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-4">
        <Crest clubId={club.id} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{clubKo(club.id)}</div>
          <div className="truncate text-[12px] text-lo">{w.intl ? `세계 대회 모드 · ${w.intl.cycle} 주기` : lg?.ko} · {w.season.replace('-', '/')}</div>
        </div>
      </div>
      <div className="mx-5 h-px bg-line" />

      <nav className="mt-3 flex flex-1 flex-col gap-0.5 px-3">
        {NAV.filter((n) => !w.intl || INTL_TABS.includes(n.key)).map((n) => {
          const active = tab === n.key;
          return (
            <button key={n.key} data-tour={`nav-${n.key}`} onClick={() => setTab(n.key)}
              className={`group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors ${
                active ? 'bg-neon-ghost font-semibold text-hi' : n.ready ? 'text-mid hover:bg-ink-800 hover:text-hi' : 'text-lo hover:bg-ink-800'}`}>
              {active && <span className="absolute top-2 bottom-2 -left-3 w-0.5 rounded-r-full bg-neon" />}
              <Icon name={n.icon} className={active ? 'text-neon' : 'text-lo group-hover:text-mid'} />
              <span className="flex-1 text-left">{w.intl && n.key === 'squad' ? '대표 명단' : n.label}</span>
              {n.key === 'squad' && unreadInjuries > 0 && (
                <span title="부상자" className="tnum rounded-md bg-red/15 px-1.5 text-[11px] leading-5 font-semibold text-red">{unreadInjuries}</span>
              )}
              {n.key === 'transfers' && appeals > 0 && (
                <span title="이적 희망 (우리 구단에 오고 싶다고 연락한 선수)" className="tnum rounded-md bg-neon/15 px-1.5 text-[11px] leading-5 font-semibold text-neon">{appeals}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 실명 데이터: 패러디 이름으로 하던 게임을 실명으로 (되돌릴 수 없음) */}
      {(() => {
        const real = w.dataset !== 'public';
        const can = !real;
        return (
          <div className="mx-3 mb-3 rounded-lg bg-ink-850 ring-1 ring-line">
          <div className="flex items-center gap-3 px-3 py-2.5"
            title={real ? '실명 데이터로 플레이 중입니다 (실명으로 바꾼 게임은 패러디로 되돌릴 수 없습니다)' : realAvailable ? '켜면 지금 게임을 자동 저장한 뒤 실명으로 바꿔서 이어 합니다' : '켜면 실명 데이터 폴더를 골라 넣고, 지금 게임을 실명으로 바꿔서 이어 합니다'}>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-mid">실명 데이터</div>
              <div className="truncate text-[11px] text-lo">{real ? '실명으로 플레이 중' : realAvailable ? '패러디 이름 · 켜면 실명으로' : '패러디 이름 · 켜면 데이터 넣기'}</div>
            </div>
            <Switch on={real} disabled={!can} onChange={(v) => {
              if (!v || !can) return;
              if (!realAvailable) { setRealOpen(true); setDrawer(false); return; }
              if (confirm('지금 게임을 실명 데이터로 바꿀까요?\n\n자동 저장한 뒤 선수 · 구단이 실제 이름으로 바뀌고, 앞으로도 실명으로 이어집니다.\n패러디 이름으로 되돌릴 수 없습니다 (원래 게임을 남기려면 먼저 저장하기 → 파일로 내보내기).')) void useGame.getState().convertCurrentToReal();
            }} />
          </div>
          <button onClick={() => { setRealOpen(true); setDrawer(false); }}
            className="flex h-8 w-full items-center gap-1.5 border-t border-line px-3 text-[12px] text-neon transition-colors hover:bg-ink-800">
            <span className="text-[14px] leading-none">+</span> 파일 추가 <span className="text-lo">· 실명 데이터 폴더</span>
          </button>
          </div>
        );
      })()}

      {realOpen && (
        <div className="fixed inset-0 z-50 grid animate-[fade_0.15s_ease-out] place-items-center bg-ink-950/70 p-4" onClick={() => setRealOpen(false)}>
          <div className="panel w-[min(460px,100%)] max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3"><span className="text-[14px] font-semibold">실명 데이터 넣기</span><button onClick={() => setRealOpen(false)} className="h-9 rounded-lg px-3 text-[13px] text-mid ring-1 ring-line transition-colors hover:text-hi">닫기</button></div>
            <div className="space-y-2 px-5 py-4 text-[12px] leading-relaxed text-lo">
              <p>실명 데이터 폴더 (<span className="text-mid">meta · clubs · seasons</span> 가 들어 있는 폴더)를 고르거나 끌어다 놓으면, 필요한 파일만 이 브라우저에 저장합니다. 어디로도 보내지 않습니다.</p>
              {realSource === 'folder' && <p className="rounded-md bg-amber/10 px-3 py-2 text-amber">지금은 이 PC의 저장소 data 폴더를 실명 데이터로 쓰고 있습니다 (직접 실행한 개발 서버). 여기서 넣은 폴더는 저장되지만, data 폴더가 있는 동안에는 그쪽이 먼저 쓰입니다.</p>}
              {w.dataset === 'public'
                ? <p>넣고 나면 <span className="text-mid">지금 게임을 자동 저장한 뒤 실명으로 바꿔서 그대로 이어 합니다</span>. 패러디 이름으로 되돌릴 수 없으니, 원래 게임을 남기려면 먼저 저장하기 → 파일로 내보내기를 해 두세요.</p>
                : <p>넣고 나면 지금 게임을 자동 저장한 뒤 새 실명 데이터로 다시 불러와 그대로 이어 합니다.</p>}
              <RealImport beforeSwitch={() => useGame.getState().convertCurrentToReal(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="relative border-t border-line p-3">
        {saveOpen && (
          // 사이드바는 자체 스크롤이라 밖으로 나가면 잘림 → 화면 가운데 창으로
          <div className="fixed inset-0 z-50 grid animate-[fade_0.15s_ease-out] place-items-center bg-ink-950/70 p-4" onClick={() => setSaveOpen(false)}>
          <div className="panel w-[min(400px,100%)] max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3"><span className="text-[13px] font-semibold">저장하기</span><button onClick={() => setSaveOpen(false)} className="h-9 rounded-lg px-3 text-[13px] text-mid ring-1 ring-line transition-colors hover:text-hi">닫기</button></div>
            <SaveSlots mode="save" onPick={async (slot) => { await save(slot); }} />
            <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[12px] text-lo">
              <span>내 PC에 파일로 보관 (.pitchboss)</span>
              <button onClick={() => void exportFile()} className="h-7 rounded-md bg-ink-700 px-2.5 text-[12px] font-semibold text-hi hover:bg-ink-750">파일로 내보내기</button>
            </div>
            <div className="border-t border-line px-5 py-2 text-[12px] text-lo">진행할 때마다 자동 저장도 됩니다 (브라우저 안)</div>
          </div>
          </div>
        )}
        <button data-tour="save" onClick={() => setSaveOpen((v) => !v)}
          className="mb-1 flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] text-mid transition-colors hover:bg-ink-800 hover:text-hi">
          <Icon name="inbox" size={16} />
          저장하기
        </button>
        <button onClick={() => { setFeedbackOpen(true); setDrawer(false); }}
          className="mb-1 flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] text-mid transition-colors hover:bg-ink-800 hover:text-hi">
          <Icon name="bell" size={16} />
          의견 보내기
        </button>
        {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
        <button data-tour="help" onClick={() => { setHelpOpen(true); setDrawer(false); }}
          className="mb-1 flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] text-mid transition-colors hover:bg-ink-800 hover:text-hi">
          <Icon name="help" size={16} />
          도움말
        </button>
        {helpOpen && <HelpDialog inGame onClose={() => setHelpOpen(false)} />}
        <button data-tour="settings" onClick={() => { setSettingsOpen(true); setDrawer(false); }}
          className="mb-1 flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] text-mid transition-colors hover:bg-ink-800 hover:text-hi">
          <Icon name="settings" size={16} />
          설정
        </button>
        {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
        <button onClick={() => { setDrawer(false); go('title'); }}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] text-lo transition-colors hover:bg-ink-800 hover:text-mid">
          <Icon name="exit" size={16} />
          메인 메뉴
        </button>
      </div>
    </aside>
    </>
  );
}
