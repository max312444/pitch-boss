// 게임이 업데이트되면 "새로 고침 한 번만 해 주세요" 띠 (vite-build-id.ts 의 build.json 번호 비교)
//  개발 서버: 4초마다 · 배포판: 5분마다 + 앱으로 돌아올 때. 연결이 안 되면 (오프라인) 조용히 넘어감
import { useEffect, useState } from 'react';

const URL_ = import.meta.env.BASE_URL + 'build.json';
const EVERY = import.meta.env.DEV ? 4000 : 5 * 60e3;

async function buildId(): Promise<string | null> {
  try {
    const r = await fetch(URL_, { cache: 'no-store' });
    if (!r.ok || !r.headers.get('content-type')?.includes('json')) return null;
    return String((await r.json()).id ?? '') || null;
  } catch { return null; }
}

export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let first: string | null = null, alive = true;
    const check = async () => {
      const id = await buildId();
      if (!alive || !id) return;
      if (!first) first = id;
      else if (id !== first) setStale(true);
    };
    void check();
    const t = setInterval(check, EVERY);
    const onVis = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  if (!stale) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[1000] flex justify-center px-3 pt-[max(8px,env(safe-area-inset-top))]">
      <div className="flex max-w-[560px] flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl border border-neon/60 bg-ink-900/95 px-4 py-2.5 text-[13px] shadow-lg backdrop-blur">
        <span className="font-semibold text-hi">게임이 업데이트되었습니다. 새로 고침 한 번만 해 주세요</span>
        <span className="text-[11px] text-lo">(진행 상황은 자동 저장되어 있습니다)</span>
        <button onClick={() => location.reload()} className="h-8 rounded-lg bg-neon px-4 text-[12px] font-semibold text-ink-950 hover:bg-[#5bff3d]">새로 고침</button>
      </div>
    </div>
  );
}
