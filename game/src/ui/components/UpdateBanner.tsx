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
    // 화면 한가운데 창 · 뒤는 흐리게 (놓치지 않게)
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[1000] grid animate-[fade_0.25s_ease-out] place-items-center bg-ink-950/60 p-4 backdrop-blur-md">
      <div className="panel w-full max-w-[400px] border border-neon/60 px-6 py-7 text-center shadow-[0_0_60px_rgba(57,255,20,0.15)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-neon/15 text-[28px]" aria-hidden>🔄</div>
        <div className="mt-4 text-[19px] font-semibold text-hi">게임이 업데이트되었습니다</div>
        <div className="mt-1.5 text-[14px] text-mid">새로 고침 한 번만 해 주세요</div>
        <div className="mt-1 text-[12px] text-lo">진행 상황은 자동 저장되어 있습니다</div>
        <button onClick={() => location.reload()} className="mt-6 h-12 w-full rounded-lg bg-neon text-[15px] font-semibold text-ink-950 hover:bg-[#5bff3d]">새로 고침</button>
      </div>
    </div>
  );
}
