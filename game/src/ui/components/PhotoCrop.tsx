// 사진 자르기: 칸(가로 5 : 세로 6) 안에서 끌어 옮기기 · 확대 (손가락 · 마우스). 결과는 원본 기준 비율 { x, y, w }
import { useEffect, useRef, useState } from 'react';

const FW = 240, FH = 288;

export function PhotoCrop({ file, onDone, onCancel }: { file: File; onDone: (crop: { x: number; y: number; w: number }, allSeasons: boolean) => void; onCancel: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [all, setAll] = useState(true);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  // 주소는 효과 안에서 만들고 정리 (개발 모드에서 효과가 두 번 돌아도 안전)
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);

  const base = nat ? Math.max(FW / nat.w, FH / nat.h) : 1;
  const s = base * zoom;
  const dw = nat ? nat.w * s : FW, dh = nat ? nat.h * s : FH;
  const clampPos = (p: { x: number; y: number }) => ({ x: Math.min(0, Math.max(FW - dw, p.x)), y: Math.min(0, Math.max(FH - dh, p.y)) });
  const cur = clampPos(pos);

  // 처음: 가운데 · 위쪽 (얼굴이 보통 위)
  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const w = e.currentTarget.naturalWidth, h = e.currentTarget.naturalHeight;
    setNat({ w, h });
    const b = Math.max(FW / w, FH / h);
    setPos({ x: (FW - w * b) / 2, y: -Math.max(0, (h * b - FH) * 0.15) });
  };
  const setZoomKeep = (z: number) => {
    // 칸 가운데를 기준으로 확대
    const cx = FW / 2 - cur.x, cy = FH / 2 - cur.y, k = z / zoom;
    setZoom(z);
    setPos({ x: FW / 2 - cx * k, y: FH / 2 - cy * k });
  };

  return (
    <div className="flex w-full max-w-[420px] flex-col items-center gap-3">
      <div className="text-[13px] font-semibold">얼굴이 칸 가운데쯤 오게 끌어서 맞추세요</div>
      <div className="relative overflow-hidden rounded-xl border border-neon/50 bg-ink-900 touch-none select-none" style={{ width: FW, height: FH, cursor: 'grab' }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: cur.x, py: cur.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (d) setPos(clampPos({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        onWheel={(e) => setZoomKeep(Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.1 : 0.9))))}>
        {url && <img src={url} alt="" onLoad={onLoad} draggable={false} className="pointer-events-none absolute max-w-none" style={{ width: dw, height: dh, left: cur.x, top: cur.y }} />}
        {/* 얼굴 자리 안내 */}
        <div className="pointer-events-none absolute top-[14%] left-1/2 h-[45%] w-[55%] -translate-x-1/2 rounded-[50%] border border-dashed border-white/40" />
      </div>
      <label className="flex w-full items-center gap-3 text-[12px] text-lo">확대
        <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoomKeep(+e.target.value)} className="flex-1 accent-[#39ff14]" />
      </label>
      <label className="flex items-center gap-2 text-[12px] text-mid">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-[#39ff14]" />모든 시즌에 이 사진 (끄면 이번 시즌만)
      </label>
      <div className="flex gap-2">
        <button onClick={onCancel} className="h-10 rounded-lg px-5 text-[13px] text-mid ring-1 ring-line hover:text-hi">취소</button>
        <button disabled={!nat} onClick={() => nat && onDone({ x: -cur.x / s / nat.w, y: -cur.y / s / nat.h, w: FW / s / nat.w }, all)}
          className="h-10 rounded-lg bg-neon px-6 text-[13px] font-semibold text-ink-950 hover:bg-[#5bff3d] disabled:opacity-50">이 사진으로 저장</button>
      </div>
    </div>
  );
}
