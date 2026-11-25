// 수상 연출 그림: 상마다 다른 트로피 · 메달 (SVG) 과 등장 애니메이션 (CSS, 이미지 파일 없음)
//  리그 우승 컵 · 컵 우승 은빛 컵 · 유럽 대회 큰 귀 트로피 · 세계 대회 지구본 트로피 ·
//  득점왕 황금 신발 · 도움왕 황금 공 + 패스 선 · MVP 왕관 별 · 영플레이어 떠오르는 별 · 골든글러브 장갑 · 세계 올해의 선수 황금 공 + 조명
import { useId } from 'react';
import type { AwardKind } from '../../engine/awards';

/** 애니메이션 정의 (AwardCeremony 에서 한 번 넣음) */
export const AWARD_KEYFRAMES = `
@keyframes aa-rise { from { opacity: 0; transform: translateY(40px) scale(.9) } to { opacity: 1; transform: none } }
@keyframes aa-pop { from { opacity: 0; transform: scale(.3) rotate(-25deg) } 65% { opacity: 1; transform: scale(1.12) rotate(5deg) } to { opacity: 1; transform: none } }
@keyframes aa-kick { 0% { opacity: 0; transform: translateX(-120px) rotate(-40deg) } 55% { opacity: 1; transform: translateX(8px) rotate(12deg) } 75% { transform: rotate(-6deg) } to { opacity: 1; transform: none } }
@keyframes aa-fly { 0% { opacity: 0; transform: translate(-40px, 30px) scale(.4) } 30% { opacity: 1 } to { opacity: 1; transform: none } }
@keyframes aa-drop { 0% { opacity: 0; transform: translateY(-160px) } 60% { opacity: 1; transform: translateY(10px) scale(1.05, .92) } 80% { transform: translateY(-6px) } to { opacity: 1; transform: none } }
@keyframes aa-float { from { opacity: 0; transform: translateY(80px) scale(.7) } to { opacity: 1; transform: none } }
@keyframes aa-descend { from { opacity: 0; transform: translateY(-90px) scale(.6) } to { opacity: 1; transform: none } }
@keyframes aa-spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
@keyframes aa-pulse { 0%,100% { opacity: .35; transform: scale(1) } 50% { opacity: .85; transform: scale(1.08) } }
@keyframes aa-twinkle { 0%,100% { opacity: 0; transform: scale(.3) } 50% { opacity: 1; transform: scale(1) } }
@keyframes aa-dash { from { stroke-dashoffset: 160 } to { stroke-dashoffset: 0 } }
@keyframes aa-sweep { 0%,100% { transform: rotate(-24deg) } 50% { transform: rotate(24deg) } }
@keyframes aa-shine { from { transform: translateX(-140%) skewX(-20deg) } to { transform: translateX(260%) skewX(-20deg) } }
@keyframes aa-fall { from { transform: translateY(-30px) rotate(0); opacity: 1 } to { transform: translateY(620px) rotate(620deg); opacity: 0 } }
@keyframes aa-burst { 0% { opacity: 1; transform: rotate(var(--r)) translateY(0) scale(.4) } to { opacity: 0; transform: rotate(var(--r)) translateY(-120px) scale(1) } }
@keyframes aa-shake { 0%,100% { transform: none } 20% { transform: translate(-3px, 2px) } 40% { transform: translate(3px, -2px) } 60% { transform: translate(-2px, -1px) } 80% { transform: translate(2px, 1px) } }
@media (prefers-reduced-motion: reduce) { .aa-anim, .aa-anim * { animation-duration: .01s !important; animation-iteration-count: 1 !important } }
`;

const GOLD = ['#a8780a', '#ffe08a', '#c9971c'];
const SILVER = ['#8d969c', '#f4f7f8', '#a9b2b7'];

function Grad({ id, c }: { id: string; c: string[] }) {
  return <linearGradient id={id} x1="0" x2="1">{c.map((x, i) => <stop key={i} offset={i / (c.length - 1)} stopColor={x} />)}</linearGradient>;
}

/** 뒤에서 도는 빛줄기 */
export function Rays({ color = '#f2c94c', speed = 14 }: { color?: string; speed?: number }) {
  return (
    <svg viewBox="-100 -100 200 200" className="pointer-events-none absolute top-1/2 left-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 opacity-40"
      style={{ animation: `aa-spin ${speed}s linear infinite` }}>
      {Array.from({ length: 12 }, (_, k) => <path key={k} d="M0 0 L-7 -100 L7 -100 Z" fill={color} opacity={0.5} transform={`rotate(${k * 30})`} />)}
    </svg>
  );
}

/** 반짝이 (위치 고정 · 깜빡임) */
export function Sparkles({ n = 8, color = '#fff4cc' }: { n?: number; color?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: n }, (_, k) => (
        <svg key={k} viewBox="-10 -10 20 20" className="absolute h-4 w-4"
          style={{ left: `${10 + ((k * 37) % 80)}%`, top: `${8 + ((k * 53) % 70)}%`, animation: `aa-twinkle ${1.2 + (k % 4) * 0.35}s ${(k % 7) * 0.25}s ease-in-out infinite` }}>
          <path d="M0 -10 L2 -2 L10 0 L2 2 L0 10 L-2 2 L-10 0 L-2 -2 Z" fill={color} />
        </svg>
      ))}
    </div>
  );
}

/** 상별 그림 (크기 140px 안팎) */
export function AwardArt({ kind, color }: { kind: AwardKind; color: string }) {
  const g = useId().replace(/:/g, '');
  const gold = `${g}g`, silver = `${g}s`;
  const defs = <defs><Grad id={gold} c={GOLD} /><Grad id={silver} c={SILVER} /></defs>;
  const box = 'mx-auto h-[118px] w-[118px] sm:h-[150px] sm:w-[150px]';   // 휴대폰은 조금 작게 (한 화면에 들어오게)
  switch (kind) {
    case 'champion':
      return (
        <svg viewBox="0 0 120 140" className={box} style={{ animation: 'aa-rise .8s var(--ease-out-quart) both' }}>
          {defs}
          <path d="M30 14 H90 V44 C90 66 76 80 60 80 C44 80 30 66 30 44 Z" fill={`url(#${gold})`} />
          <path d="M30 22 H14 C14 44 24 54 34 56 M90 22 H106 C106 44 96 54 86 56" fill="none" stroke={`url(#${gold})`} strokeWidth="6" strokeLinecap="round" />
          <rect x="53" y="80" width="14" height="22" fill={`url(#${gold})`} />
          <path d="M36 102 H84 L88 118 H32 Z" fill={`url(#${gold})`} />
          <rect x="26" y="118" width="68" height="12" rx="2" fill="#2a2f2b" />
          <rect x="44" y="121" width="32" height="6" rx="1" fill={color} />
        </svg>
      );
    case 'cup':
      return (
        <svg viewBox="0 0 120 140" className={box} style={{ animation: 'aa-rise .8s var(--ease-out-quart) both' }}>
          {defs}
          <ellipse cx="60" cy="12" rx="16" ry="5" fill={`url(#${silver})`} />
          <rect x="56" y="2" width="8" height="8" rx="3" fill={`url(#${silver})`} />
          <path d="M34 16 H86 C86 52 76 72 60 74 C44 72 34 52 34 16 Z" fill={`url(#${silver})`} />
          <path d="M36 24 C20 26 20 48 40 52 M84 24 C100 26 100 48 80 52" fill="none" stroke={`url(#${silver})`} strokeWidth="5" strokeLinecap="round" />
          <rect x="55" y="74" width="10" height="26" fill={`url(#${silver})`} />
          <path d="M40 100 H80 L84 114 H36 Z" fill={`url(#${silver})`} />
          <rect x="30" y="114" width="60" height="14" rx="2" fill="#2a2f2b" />
          <path d="M40 120 H80" stroke={color} strokeWidth="4" />
        </svg>
      );
    case 'euro':
      return (
        <svg viewBox="0 0 140 150" className={box} style={{ animation: 'aa-rise .9s var(--ease-out-quart) both' }}>
          {defs}
          {/* 큰 귀 손잡이 */}
          <path d="M44 30 C8 20 6 78 46 74 M96 30 C132 20 134 78 94 74" fill="none" stroke={`url(#${silver})`} strokeWidth="7" strokeLinecap="round" />
          <path d="M42 18 H98 C98 62 86 84 70 86 C54 84 42 62 42 18 Z" fill={`url(#${silver})`} />
          <rect x="64" y="86" width="12" height="20" fill={`url(#${silver})`} />
          <path d="M48 106 H92 L96 122 H44 Z" fill={`url(#${silver})`} />
          <rect x="38" y="122" width="64" height="14" rx="2" fill="#20252a" />
          {[0, 1, 2, 3, 4].map((k) => <circle key={k} cx={50 + k * 10} cy="129" r="2.2" fill="#f2c94c" />)}
        </svg>
      );
    case 'wc':
      return (
        <svg viewBox="0 0 120 150" className={box} style={{ animation: 'aa-rise .9s var(--ease-out-quart) both' }}>
          {defs}
          <circle cx="60" cy="34" r="28" fill={`url(#${gold})`} />
          <path d="M34 26 C50 34 70 18 86 28 M32 42 C50 48 72 36 88 44 M60 6 C48 22 48 46 60 62" fill="none" stroke="#8a6408" strokeWidth="2" opacity=".6" />
          <path d="M44 58 C40 80 54 96 50 112 H70 C66 96 80 80 76 58" fill={`url(#${gold})`} />
          <path d="M40 112 H80 L84 124 H36 Z" fill="#1f6b3a" />
          <rect x="34" y="124" width="52" height="12" rx="2" fill={`url(#${gold})`} />
        </svg>
      );
    case 'boot':
      return (
        <svg viewBox="0 0 160 130" className={box}>
          {defs}
          <g style={{ animation: 'aa-kick .9s var(--ease-out-quart) both', transformOrigin: '60px 90px' }}>
            <path d="M30 20 H62 V62 C80 64 104 70 116 82 C122 88 120 100 108 100 H30 C24 100 22 94 24 88 Z" fill={`url(#${gold})`} />
            <path d="M34 34 H58 M34 46 H58" stroke="#8a6408" strokeWidth="3" strokeLinecap="round" />
            {[40, 60, 80, 100].map((x) => <rect key={x} x={x - 4} y="100" width="7" height="8" rx="2" fill="#8a6408" />)}
          </g>
          <g style={{ animation: 'aa-fly .7s .75s ease-out both' }}>
            <circle cx="138" cy="44" r="14" fill="#fff" stroke="#2a2f2b" strokeWidth="2" />
            <path d="M138 34 L146 40 L143 50 L133 50 L130 40 Z" fill="#2a2f2b" />
          </g>
        </svg>
      );
    case 'assist':
      return (
        <svg viewBox="0 0 160 130" className={box}>
          {defs}
          <path d="M16 110 C40 20 110 10 132 52" fill="none" stroke="#f2c94c" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round"
            style={{ strokeDashoffset: 160, animation: 'aa-dash 1s .1s ease-out forwards' }} />
          <g style={{ animation: 'aa-pop .8s .8s var(--ease-out-quart) both' }}>
            <circle cx="122" cy="72" r="28" fill={`url(#${gold})`} />
            <path d="M122 52 L136 62 L131 80 L113 80 L108 62 Z" fill="#8a6408" opacity=".7" />
            <path d="M122 44 V52 M146 66 L136 62 M138 96 L131 80 M106 96 L113 80 M98 66 L108 62" stroke="#8a6408" strokeWidth="2" opacity=".6" />
          </g>
          <circle cx="16" cy="110" r="6" fill="#fff" style={{ animation: 'aa-rise .3s both' }} />
        </svg>
      );
    case 'mvp':
      return (
        <svg viewBox="0 0 140 140" className={box} style={{ animation: 'aa-pop .9s var(--ease-out-quart) both' }}>
          {defs}
          <path d="M44 34 L52 14 L62 28 L70 8 L78 28 L88 14 L96 34 Z" fill={`url(#${gold})`} />
          <circle cx="70" cy="8" r="3.5" fill="#e74c3c" /><circle cx="52" cy="14" r="3" fill="#3498db" /><circle cx="88" cy="14" r="3" fill="#3498db" />
          <path d="M70 40 L82 68 L112 70 L89 89 L97 118 L70 102 L43 118 L51 89 L28 70 L58 68 Z" fill={`url(#${gold})`} stroke="#fff4cc" strokeWidth="2" />
          <text x="70" y="90" textAnchor="middle" fontSize="18" fontWeight="800" fill="#7a5506">MVP</text>
        </svg>
      );
    case 'young':
      return (
        <svg viewBox="0 0 140 140" className={box} style={{ animation: 'aa-float 1s var(--ease-out-quart) both' }}>
          {defs}
          <path d="M70 130 C66 110 74 96 70 76" stroke="#39ff14" strokeWidth="3" fill="none" opacity=".7" />
          <path d="M70 100 C56 96 52 86 54 80 C64 82 70 90 70 100 M70 96 C82 90 88 82 86 76 C76 78 70 86 70 96" fill="#39ff14" opacity=".7" />
          <path d="M70 14 L80 42 L110 44 L86 62 L94 92 L70 74 L46 92 L54 62 L30 44 L60 42 Z" fill={`url(#${silver})`} stroke="#bfe6ff" strokeWidth="2" />
          <circle cx="70" cy="56" r="9" fill="#bfe6ff" opacity=".8" />
        </svg>
      );
    case 'glove':
      return (
        <svg viewBox="0 0 140 150" className={box}>
          {defs}
          <g style={{ animation: 'aa-drop 1s var(--ease-out-quart) both' }}>
            <path d="M40 72 V36 C40 30 50 30 50 36 V64 V26 C50 20 60 20 60 26 V62 V22 C60 16 70 16 70 22 V62 V28 C70 22 80 22 80 28 V70 C86 60 94 56 98 60 C102 64 96 74 90 84 C84 96 78 106 64 108 H52 C44 108 40 100 40 92 Z" fill={`url(#${gold})`} stroke="#8a6408" strokeWidth="2" />
            <rect x="44" y="108" width="34" height="22" rx="4" fill="#2a2f2b" />
            <rect x="48" y="114" width="26" height="6" rx="2" fill={color} />
          </g>
        </svg>
      );
    case 'world':
      return (
        <svg viewBox="0 0 140 150" className={box}>
          {defs}
          <g style={{ animation: 'aa-descend 1.4s var(--ease-out-quart) both' }}>
            <circle cx="70" cy="54" r="40" fill={`url(#${gold})`} />
            <path d="M70 24 L90 38 L83 62 L57 62 L50 38 Z" fill="#8a6408" opacity=".55" />
            <path d="M70 14 V24 M108 44 L90 38 M96 90 L83 62 M44 90 L57 62 M32 44 L50 38" stroke="#8a6408" strokeWidth="2.5" opacity=".5" />
            <ellipse cx="56" cy="38" rx="10" ry="6" fill="#fff" opacity=".45" />
          </g>
          <path d="M46 100 H94 L100 116 H40 Z" fill="#2a2f2b" style={{ animation: 'aa-rise .6s both' }} />
          <rect x="34" y="116" width="72" height="16" rx="3" fill={`url(#${gold})`} style={{ animation: 'aa-rise .6s both' }} />
        </svg>
      );
  }
}

/** 큰 상에 쓰는 무대 조명 (세계 올해의 선수 · 연속 수상) */
export function Spotlights() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden">
      {[-1, 1].map((s) => (
        <div key={s} className="absolute top-[-40px] h-[420px] w-[140px] origin-top"
          style={{ left: s < 0 ? '18%' : 'auto', right: s > 0 ? '18%' : 'auto', background: 'linear-gradient(to bottom, rgba(255,240,180,.35), transparent 80%)', clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)',
            animation: `aa-sweep ${3.2 + (s > 0 ? 0.6 : 0)}s ease-in-out infinite`, animationDelay: s > 0 ? '-1.6s' : '0s' }} />
      ))}
    </div>
  );
}

/** 불꽃 (트레블 이상) */
export function Fireworks({ n = 3, colors }: { n?: number; colors: string[] }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: n }, (_, b) => (
        <div key={b} className="absolute" style={{ left: `${20 + ((b * 31) % 60)}%`, top: `${18 + ((b * 23) % 30)}%` }}>
          {Array.from({ length: 14 }, (_, k) => (
            <span key={k} className="absolute h-2 w-2 rounded-full"
              style={{ background: colors[(k + b) % colors.length], ['--r' as string]: `${k * (360 / 14)}deg`, animation: `aa-burst 1.3s ${0.3 + b * 0.55}s ease-out infinite` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 색종이 (양이 많을수록 큰 축하) */
export function Confetti({ colors, n = 34 }: { colors: string[]; n?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: n }, (_, k) => (
        <span key={k} className="absolute top-0 h-3 w-1.5 rounded-sm"
          style={{ left: `${(k * 29) % 100}%`, background: colors[k % colors.length], animation: `aa-fall ${1.8 + (k % 6) * 0.3}s ${(k % 9) * 0.12}s ease-in both` }} />
      ))}
    </div>
  );
}

/** 작은 아이콘 (연속 수상 요약 · 프로필) — 그림을 줄여 씀 */
export function AwardIcon({ kind, size = 44 }: { kind: AwardKind; size?: number }) {
  return <div style={{ width: size, height: size }} className="[&_svg]:!h-full [&_svg]:!w-full [&_*]:![animation:none]"><AwardArt kind={kind} color="#39ff14" /></div>;
}
