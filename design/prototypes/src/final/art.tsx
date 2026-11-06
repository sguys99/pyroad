// 시안 B 삽화 (잉크 선 + 수채 번짐). 필터 없이 "어긋난 수채 면 + 잉크 선"으로 그린다 → 렌더 비용 낮음.
// - 잠긴 곳은 연필 스케치(점선, 채움 없음) → 클리어하면 잉크와 물감이 입혀진다 (진행 = 지도가 완성되는 보상)
// - 유치해 보이지 않게: 눈·볼터치 같은 의인화 없이, 탐험 지도·판화 느낌의 굵은 잉크 선과 해칭
import type { ReactNode, SVGProps } from 'react';
import { HERO_WASH } from './wash.gen';

// 최종 시안: 잉크를 따뜻한 회갈색으로, 선 1.6px 안팎 (1차 #3B2F25 · 2~2.4px)
export const INK = '#7A6A59';
const PENCIL = '#A89884';
const LW = 0.72; // 1차 선 굵기에 곱하는 배율
export const C = {
  paper: '#FFFBF2',
  cream: '#F8F1E3',
  sand: '#E9D3A6',
  wood: '#B98A57',
  woodDark: '#8C6239',
  stone: '#CDBB98',
  stoneDark: '#A8916B',
  sage: '#9CCB80',
  forest: '#7FA85F',
  olive: '#4A7330',
  terra: '#D9774F',
  roof: '#C8623F',
  water: '#8DB7CF',
  waterLight: '#BFD8E4',
  mustard: '#F2C14E',
  brass: '#C98A4B',
};

type Mode = 'ink' | 'pencil';
/** 선 스타일: 잉크(채움 + 굵은 선) / 연필(채움 없음 + 점선) */
function st(mode: Mode, fill: string, w = 2.2): SVGProps<SVGPathElement> {
  return mode === 'ink'
    ? { fill, stroke: INK, strokeWidth: w * LW, strokeLinejoin: 'round', strokeLinecap: 'round' }
    : { fill: 'none', stroke: PENCIL, strokeWidth: 1.5, strokeDasharray: '4 4', strokeLinejoin: 'round', strokeLinecap: 'round', opacity: 0.75 };
}
/** 수채 번짐: 같은 모양을 살짝 어긋나게 옅게 한 번 더 (판화의 판 어긋남 느낌) */
function Wash({ d, color, dx = 3, dy = 3, o = 0.38, mode }: { d: string; color: string; dx?: number; dy?: number; o?: number; mode: Mode }) {
  if (mode === 'pencil') return null;
  return <path d={d} fill={color} opacity={o} transform={`translate(${dx} ${dy})`} />;
}
/** 해칭(그림자 빗금) */
function Hatch({ x, y, w, h, n = 4, mode }: { x: number; y: number; w: number; h: number; n?: number; mode: Mode }) {
  // 최종 시안: 해칭(그림자 빗금)을 뺀다 — 선이 무거워 보이는 주원인 (사용자 리뷰 Q28 ①)
  if (mode === 'pencil' || LW < 1) return null;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    lines.push(<path key={i} d={`M${x + w * t - 3} ${y + h} L${x + w * t + 3} ${y}`} />);
  }
  return (
    <g stroke={INK} strokeWidth={0.86} strokeLinecap="round" opacity={0.55}>
      {lines}
    </g>
  );
}

// ───────────── 스테이지 랜드마크 7종 (바닥 중앙 = 0,0 · 대략 폭 120 × 높이 100)

export function Landmark({ stage, mode }: { stage: number; mode: Mode }) {
  const body = (() => {
    switch (stage) {
      case 1:
        return <Gate mode={mode} />;
      case 2:
        return <Forest mode={mode} />;
      case 3:
        return <Crossroad mode={mode} />;
      case 4:
        return <Cave mode={mode} />;
      case 5:
        return <Lake mode={mode} />;
      case 6:
        return <Tower mode={mode} />;
      default:
        return <Castle mode={mode} />;
    }
  })();
  return (
    <g>
      {mode === 'ink' && <ellipse cx="0" cy="2" rx="52" ry="9" fill={INK} opacity="0.12" />}
      {body}
    </g>
  );
}

function Gate({ mode }: { mode: Mode }) {
  const beam = 'M-54 -64 Q0 -96 54 -64 L52 -53 Q0 -82 -52 -53 Z';
  return (
    <g>
      <Wash d="M-44 -66 h12 v66 h-12z M32 -66 h12 v66 h-12z" color={C.wood} mode={mode} />
      <path d="M-44 -66 h12 v66 h-12z" {...st(mode, C.wood)} />
      <path d="M32 -66 h12 v66 h-12z" {...st(mode, C.wood)} />
      <Hatch x={-44} y={-60} w={6} h={56} n={2} mode={mode} />
      <Hatch x={32} y={-60} w={6} h={56} n={2} mode={mode} />
      <Wash d={beam} color={C.roof} mode={mode} />
      <path d={beam} {...st(mode, C.roof)} />
      <path d="M-20 -60 h40 v20 h-40z" {...st(mode, C.paper, 2)} />
      <path d="M-12 -40 l-4 -20 M12 -40 l4 -20" {...st(mode, 'none', 1.4)} />
      <path d="M-12 -52 h24 M-9 -46 h18" {...st(mode, 'none', 1.6)} />
      <path d="M-38 -86 v-16 l14 5 -14 5" {...st(mode, C.mustard, 1.8)} />
      <path d="M38 -86 v-16 l-14 5 14 5" {...st(mode, C.terra, 1.8)} />
      <path d="M-58 0 c0 -14 18 -16 20 -2z M40 0 c2 -14 20 -12 20 0z" {...st(mode, C.sage, 1.8)} />
    </g>
  );
}

function Forest({ mode }: { mode: Mode }) {
  const pine = (x: number, s: number, c: string) => {
    const d = `M${x} ${-92 * s} L${x + 20 * s} ${-52 * s} L${x + 10 * s} ${-52 * s} L${x + 26 * s} ${-22 * s} L${x - 26 * s} ${-22 * s} L${x - 10 * s} ${-52 * s} L${x - 20 * s} ${-52 * s} Z`;
    return (
      <g key={x}>
        <path d={`M${x - 3 * s} ${-22 * s} h${6 * s} v${22 * s} h${-6 * s}z`} {...st(mode, C.woodDark, 1.8)} />
        <Wash d={d} color={c} mode={mode} />
        <path d={d} {...st(mode, c)} />
      </g>
    );
  };
  return (
    <g>
      {pine(-30, 0.85, C.forest)}
      {pine(28, 0.95, C.olive)}
      <Wash d="M-10 -78 c-22 0 -24 34 0 36 c24 -2 22 -36 0 -36z" color={C.sage} mode={mode} />
      <path d="M-2 -42 v42" {...st(mode, 'none', 2.2)} />
      <path d="M-10 -86 c-24 0 -26 40 0 42 c26 -2 24 -42 0 -42z" transform="translate(8 0)" {...st(mode, C.sage)} />
      {/* 마법 상자 + 이름표 */}
      <path d="M-34 0 v-18 h26 v18z" {...st(mode, C.brass, 2)} />
      <path d="M-36 -18 h30 v-6 h-30z" {...st(mode, C.woodDark, 2)} />
      <path d="M-8 -14 l10 4 -2 7 -10 -3z" {...st(mode, C.paper, 1.4)} />
      {mode === 'ink' && <path d="M-22 -34 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z" fill={C.mustard} stroke={INK} strokeWidth="0.86" />}
    </g>
  );
}

function Crossroad({ mode }: { mode: Mode }) {
  return (
    <g>
      <path d="M-56 0 C-30 -6 -10 -10 0 -12 C14 -16 34 -30 56 -34 M0 -12 C18 -10 40 -4 58 0" {...st(mode, 'none', 1.6)} strokeDasharray={mode === 'ink' ? '2 5' : '4 4'} />
      <path d="M-3 -84 h6 v84 h-6z" {...st(mode, C.wood, 2)} />
      <Wash d="M-2 -80 h40 l10 9 -10 9 h-40z" color={C.terra} mode={mode} />
      <path d="M-2 -80 h40 l10 9 -10 9 h-40z" {...st(mode, C.paper)} />
      <path d="M2 -56 h-40 l-10 9 10 9 h40z" {...st(mode, C.sand)} />
      <path d="M8 -71 h26 M-34 -47 h28" {...st(mode, 'none', 1.8)} />
      <path d="M22 -2 c2 -10 14 -12 18 -4 c3 6 -4 8 -18 4z" {...st(mode, C.stone, 1.8)} />
      <path d="M-36 -6 l4 -10 4 10 M-30 -6 l4 -8 4 8" {...st(mode, 'none', 1.4)} />
    </g>
  );
}

function Cave({ mode }: { mode: Mode }) {
  const mt = 'M-62 0 L-30 -66 L-16 -54 L2 -92 L26 -58 L36 -66 L64 0 Z';
  return (
    <g>
      <Wash d={mt} color={C.stoneDark} mode={mode} />
      <path d={mt} {...st(mode, C.stone)} />
      <path d="M2 -92 L-6 -74 L4 -78 L10 -70 L14 -78 L26 -58" {...st(mode, C.paper, 1.8)} />
      <path d="M-22 0 C-22 -30 22 -30 22 0 Z" {...st(mode, mode === 'ink' ? '#4A3A2C' : 'none', 2.2)} />
      <Hatch x={-50} y={-34} w={22} h={30} n={4} mode={mode} />
      <Hatch x={34} y={-30} w={20} h={26} n={3} mode={mode} />
      <path d="M-10 -20 l3 6 3 -6 M4 -22 l3 7 3 -7" {...st(mode, 'none', 1.4)} />
    </g>
  );
}

function Lake({ mode }: { mode: Mode }) {
  const lake = 'M-60 -14 C-58 -40 -10 -46 26 -40 C58 -34 66 -14 52 -4 C30 8 -50 8 -60 -14 Z';
  return (
    <g>
      <Wash d={lake} color={C.water} o={0.5} mode={mode} />
      <path d={lake} {...st(mode, C.waterLight)} />
      <path d="M-40 -22 q6 -4 12 0 q6 4 12 0 M8 -14 q6 -4 12 0 q6 4 12 0" {...st(mode, 'none', 1.5)} />
      <path d="M-12 -34 h26 l-5 8 h-16z" {...st(mode, C.wood, 1.8)} />
      <path d="M1 -34 v-22 l12 14 h-12" {...st(mode, C.paper, 1.6)} />
      <path d="M-58 -8 v-24 M-52 -10 v-30 M-46 -8 v-20" {...st(mode, 'none', 1.6)} />
      <path d="M-52 -40 c-3 -4 3 -8 0 -12" {...st(mode, C.olive, 1.4)} />
    </g>
  );
}

function Tower({ mode }: { mode: Mode }) {
  const body = 'M-20 0 L-15 -74 L15 -74 L20 0 Z';
  return (
    <g>
      <Wash d={body} color={C.stoneDark} mode={mode} />
      <path d={body} {...st(mode, C.stone)} />
      <path d="M-22 -74 L0 -108 L22 -74 Z" {...st(mode, C.roof)} />
      <path d="M0 -108 v-14 l14 5 -14 5" {...st(mode, C.mustard, 1.8)} />
      <path d="M-6 -56 h12 v14 h-12z M-6 -26 h12 v14 h-12z" {...st(mode, mode === 'ink' ? C.mustard : 'none', 1.8)} />
      <path d="M-17 -64 h34 M-18 -36 h36" {...st(mode, 'none', 1.4)} />
      <Hatch x={8} y={-70} w={8} h={66} n={3} mode={mode} />
      <path d="M-40 0 c0 -10 14 -12 16 0z M24 0 c2 -12 18 -10 18 0z" {...st(mode, C.sage, 1.8)} />
    </g>
  );
}

function Castle({ mode }: { mode: Mode }) {
  return (
    <g>
      <Wash d="M-46 0 v-46 h92 v46z" color={C.stoneDark} mode={mode} />
      <path d="M-40 0 v-44 h8 v-8 h8 v8 h8 v-8 h8 v8 h8 v-8 h8 v8 h8 v-8 h8 v8 h8 v44z" {...st(mode, C.stone)} />
      <path d="M-58 0 v-62 h18 v62z M40 0 v-62 h18 v62z" {...st(mode, C.stone)} />
      <path d="M-62 -62 L-49 -90 L-36 -62 Z M36 -62 L49 -90 L62 -62 Z" {...st(mode, C.roof)} />
      <path d="M-49 -90 v-14 l12 5 -12 5 M49 -90 v-14 l12 5 -12 5" {...st(mode, C.mustard, 1.6)} />
      <path d="M-12 0 v-18 a12 12 0 0 1 24 0 v18z" {...st(mode, mode === 'ink' ? C.woodDark : 'none', 2)} />
      <Hatch x={-56} y={-56} w={12} h={50} n={3} mode={mode} />
      {/* 보물 표시 X */}
      <path d="M62 -10 l12 12 M74 -10 l-12 12" stroke={mode === 'ink' ? '#A4452A' : PENCIL} strokeWidth={mode === 'ink' ? 4 : 2} strokeLinecap="round" />
    </g>
  );
}

// ───────────── 지도 장식

export function Compass({ x, y, r = 46 }: { x: number; y: number; r?: number }) {
  const pt = (a: number, rr: number) => `${x + Math.sin(a) * rr} ${y - Math.cos(a) * rr}`;
  const star = (rot: number, long: number, short: number, fillA: string, fillB: string) => {
    const out: ReactNode[] = [];
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      out.push(<path key={`a${i}`} d={`M${x} ${y} L${pt(a - 0.38, short)} L${pt(a, long)} Z`} fill={fillA} stroke={INK} strokeWidth="1.15" strokeLinejoin="round" />);
      out.push(<path key={`b${i}`} d={`M${x} ${y} L${pt(a + 0.38, short)} L${pt(a, long)} Z`} fill={fillB} stroke={INK} strokeWidth="1.15" strokeLinejoin="round" />);
    }
    return out;
  };
  return (
    <g aria-hidden>
      <circle cx={x} cy={y} r={r} fill="none" stroke={INK} strokeWidth="1.01" opacity="0.7" />
      <circle cx={x} cy={y} r={r - 6} fill="none" stroke={INK} strokeWidth="0.72" strokeDasharray="1.5 4" opacity="0.7" />
      {star(Math.PI / 4, r * 0.62, r * 0.18, C.paper, C.sand)}
      {star(0, r * 0.95, r * 0.22, C.paper, '#A4452A')}
      <circle cx={x} cy={y} r="4" fill={C.mustard} stroke={INK} strokeWidth="1.15" />
      {/* N */}
      <path d={`M${x - 5} ${y - r - 6} v-13 l10 13 v-13`} fill="none" stroke={INK} strokeWidth="1.58" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export function Mountains({ x, y, s = 1, o = 1 }: { x: number; y: number; s?: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o} aria-hidden>
      <path d="M0 0 L22 -38 L32 -26 L46 -52 L70 0" fill={C.cream} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M46 -52 L40 -38 L48 -40 L54 -32" fill="none" stroke={INK} strokeWidth="1.01" strokeLinejoin="round" />
      <path d="M52 -10 l6 -14 M58 -6 l6 -14 M30 -6 l4 -10" stroke={INK} strokeWidth="0.79" opacity="0.5" strokeLinecap="round" />
    </g>
  );
}
export function Waves({ x, y, n = 3, s = 1 }: { x: number; y: number; n?: number; s?: number }) {
  const d = Array.from({ length: n }, (_, i) => `M${i * 22} ${(i % 2) * 8} q5 -5 10 0 q5 5 10 0`).join(' ');
  return <path d={d} transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke="#2F6A90" strokeWidth="1.3" strokeLinecap="round" opacity="0.75" aria-hidden />;
}
export function Bird({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path d={`M${x} ${y} q${6 * s} ${-6 * s} ${12 * s} 0 q${6 * s} ${-6 * s} ${12 * s} 0`} fill="none" stroke={INK} strokeWidth="1.15" strokeLinecap="round" aria-hidden />;
}
export function TinyTree({ x, y, s = 1, c = C.forest }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden>
      <path d="M0 -26 L9 -8 L-9 -8 Z" fill={c} stroke={INK} strokeWidth="1.08" strokeLinejoin="round" />
      <path d="M0 -8 v8" stroke={INK} strokeWidth="1.08" />
    </g>
  );
}

// ───────────── 권 표지 삽화 (1권 숲 마을 · 2권 바다 여행 · 3권 발명가의 공방)

export function CoverArt({ book }: { book: 1 | 2 | 3 }) {
  if (book === 1)
    return (
      <svg viewBox="0 0 200 140" aria-hidden className="f-cover-art">
        <rect width="200" height="140" fill="#EAF1DA" />
        <circle cx="150" cy="36" r="18" fill={C.mustard} opacity="0.8" stroke={INK} strokeWidth="1.01" />
        <Mountains x={8} y={92} s={1.1} o={0.9} />
        <path d="M0 104 C40 92 80 98 120 92 C150 88 180 94 200 90 V140 H0Z" fill={C.sage} stroke={INK} strokeWidth="1.3" />
        <g transform="translate(118 108)">
          <Landmark stage={2} mode="ink" />
        </g>
        <path d="M18 132 C50 118 70 128 92 116" fill="none" stroke={INK} strokeWidth="1.87" strokeLinecap="round" strokeDasharray="0.1 7" />
      </svg>
    );
  if (book === 2)
    return (
      <svg viewBox="0 0 200 140" aria-hidden className="f-cover-art">
        <rect width="200" height="140" fill="#E2EEF4" />
        <circle cx="44" cy="34" r="16" fill={C.mustard} opacity="0.75" stroke={INK} strokeWidth="1.01" />
        <Bird x={120} y={30} />
        <Bird x={142} y={42} s={0.7} />
        <path d="M0 84 C30 78 60 88 100 82 C140 76 170 86 200 80 V140 H0Z" fill={C.water} opacity="0.8" stroke={INK} strokeWidth="1.3" />
        <Waves x={14} y={104} n={3} />
        <Waves x={120} y={118} n={3} />
        {/* 종이배 */}
        <path d="M70 84 h56 l-10 16 h-36z" fill={C.paper} stroke={INK} strokeWidth="1.44" strokeLinejoin="round" />
        <path d="M98 84 v-40 l26 34 h-26" fill={C.terra} stroke={INK} strokeWidth="1.44" strokeLinejoin="round" />
        <path d="M96 50 l-18 28 h18" fill={C.paper} stroke={INK} strokeWidth="1.44" strokeLinejoin="round" />
        {/* 고래 꼬리 */}
        <path d="M160 96 c-4 -12 -14 -14 -20 -18 c8 0 16 4 20 10 c4 -6 12 -10 20 -10 c-6 4 -16 6 -20 18z" fill="#6B8FA6" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 200 140" aria-hidden className="f-cover-art">
      <rect width="200" height="140" fill="#F5E4CD" />
      {/* 설계도 격자 */}
      <g stroke="#86501F" strokeWidth="0.58" opacity="0.25">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={`v${i}`} d={`M${i * 20 + 10} 0 V140`} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${i * 20 + 10} H200`} />
        ))}
      </g>
      <Gear x={62} y={78} r={30} teeth={10} c={C.brass} />
      <Gear x={112} y={50} r={18} teeth={8} c="#D9A066" />
      {/* 전구 */}
      <path d="M150 74 a20 20 0 1 1 20 0 v10 h-20z" fill={C.mustard} stroke={INK} strokeWidth="1.44" strokeLinejoin="round" />
      <path d="M150 88 h20 M152 94 h16" stroke={INK} strokeWidth="1.44" strokeLinecap="round" />
      <path d="M160 44 v-10 M140 52 l-7 -6 M180 52 l7 -6" stroke={INK} strokeWidth="1.44" strokeLinecap="round" />
      <path d="M20 124 h160" stroke={INK} strokeWidth="1.15" strokeDasharray="6 4" />
    </svg>
  );
}

export function Gear({ x, y, r, teeth, c }: { x: number; y: number; r: number; teeth: number; c: string }) {
  let d = '';
  const n = teeth * 2;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.2;
    d += `${i ? 'L' : 'M'}${x + Math.cos(a0) * rr} ${y + Math.sin(a0) * rr} L${x + Math.cos(a1) * rr} ${y + Math.sin(a1) * rr} `;
  }
  return (
    <g>
      <path d={d + 'Z'} fill={c} stroke={INK} strokeWidth="1.44" strokeLinejoin="round" />
      <circle cx={x} cy={y} r={r * 0.35} fill={C.paper} stroke={INK} strokeWidth="1.44" />
    </g>
  );
}

// ───────────── 퀘스트 삽화: 변수의 숲 마법 상자 (이름표 붙은 상자)

export function MagicBoxScene() {
  return (
    <svg viewBox="0 0 320 170" className="f-quest-art" role="img" aria-label="숲 속 빈터에 이름표를 기다리는 마법 상자가 놓여 있어요">
      <rect width="320" height="170" fill="#EAF1DA" />
      <path d="M0 118 C60 108 120 116 180 110 C230 104 280 112 320 106 V170 H0Z" fill={C.sage} stroke={INK} strokeWidth="1.44" />
      <g transform="translate(40 120) scale(0.9)">
        <Landmark stage={2} mode="ink" />
      </g>
      <TinyTree x={286} y={110} s={1.4} c={C.olive} />
      <TinyTree x={262} y={114} s={1.1} />
      {/* 빛줄기 */}
      <path d="M170 0 L200 0 L250 120 L150 120 Z" fill={C.mustard} opacity="0.18" />
      {/* 상자 */}
      <g transform="translate(176 136)">
        <ellipse cx="22" cy="2" rx="52" ry="8" fill={INK} opacity="0.14" />
        <path d="M-20 0 v-40 h84 v40z" fill={C.brass} stroke={INK} strokeWidth="1.73" strokeLinejoin="round" />
        <path d="M-12 -40 v40 M56 -40 v40" stroke={INK} strokeWidth="1.15" opacity="0.6" />
        <path d="M-26 -40 L-18 -58 H70 L78 -40 Z" fill={C.woodDark} stroke={INK} strokeWidth="1.73" strokeLinejoin="round" />
        <path d="M14 -46 h16 v14 h-16z" fill={C.mustard} stroke={INK} strokeWidth="1.44" />
        {/* 빈 이름표 (아직 이름이 없음) */}
        <path d="M58 -24 L92 -34 L98 -14 L64 -4 Z" fill={C.paper} stroke={INK} strokeWidth="1.44" strokeLinejoin="round" />
        <circle cx="64" cy="-15" r="2.4" fill={INK} />
        <path d="M70 -18 l20 -6" stroke={PENCIL} strokeWidth="1.15" strokeDasharray="3 3" />
        <path d="M58 -14 c-6 2 -10 -2 -14 -6" fill="none" stroke={INK} strokeWidth="1.01" />
      </g>
      <g fill={C.mustard} stroke={INK} strokeWidth="0.94">
        <path d="M150 64 l3 -8 3 8 8 3 -8 3 -3 8 -3 -8 -8 -3z" />
        <path d="M262 52 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z" />
      </g>
    </svg>
  );
}

// ───────────── 랜딩 히어로: 찢은 보물지도 조각

export function HeroMap() {
  return (
    <svg viewBox="0 0 520 420" className="f-hero-map" aria-hidden>
      <defs>
        <clipPath id="bHeroClip">
          <path d="M18 34 L60 22 L110 30 L170 16 L240 28 L300 14 L370 26 L430 12 L500 30 L506 110 L496 190 L510 270 L498 350 L506 404 L430 396 L360 410 L290 398 L210 412 L140 398 L70 410 L14 396 L22 320 L10 240 L24 160 L12 90 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#bHeroClip)">
        <rect width="520" height="420" fill="#F3E7CC" />
        {/* 바다 */}
        <path d="M0 0 H520 V120 C470 140 430 110 380 128 C330 146 300 120 250 134 C190 150 140 120 90 140 C50 156 20 140 0 150 Z" fill="#CFE0E6" />
        <Waves x={300} y={60} n={4} />
        <Waves x={60} y={84} n={3} s={0.9} />
        <Waves x={190} y={40} n={2} s={0.8} />
        {/* 땅 */}
        <path d="M0 150 C20 140 50 156 90 140 C140 120 190 150 250 134 C300 120 330 146 380 128 C430 110 470 140 520 120 V420 H0Z" fill="#EAE0C2" />
        <Mountains x={300} y={226} s={1.4} />
        <Mountains x={380} y={250} s={1} />
        <TinyTree x={66} y={250} s={1.4} />
        <TinyTree x={90} y={262} s={1.1} c={C.olive} />
        <TinyTree x={48} y={276} s={1.2} c={C.olive} />
        <TinyTree x={430} y={330} s={1.3} />
        <TinyTree x={456} y={344} s={1} c={C.olive} />
        {/* 잉크 길 */}
        <path className="f-hero-path" d="M40 380 C110 360 120 300 190 300 C260 300 250 360 320 350 C390 340 400 290 450 270" fill="none" stroke={INK} strokeWidth="3.24" strokeLinecap="round" strokeDasharray="0.1 12" />
        <g transform="translate(456 266)">
          <path d="M-12 -12 l24 24 M12 -12 l-24 24" stroke="#A4452A" strokeWidth="4.32" strokeLinecap="round" />
        </g>
        <g transform="translate(120 214) scale(0.8)">
          <Landmark stage={1} mode="ink" />
        </g>
        <g transform="translate(250 230) scale(0.7)">
          <Landmark stage={6} mode="ink" />
        </g>
        <Compass x={440} y={180} r={34} />
        <Bird x={150} y={70} />
        <Bird x={176} y={86} s={0.7} />
      </g>
      <path
        d="M18 34 L60 22 L110 30 L170 16 L240 28 L300 14 L370 26 L430 12 L500 30 L506 110 L496 190 L510 270 L498 350 L506 404 L430 396 L360 410 L290 398 L210 412 L140 398 L70 410 L14 396 L22 320 L10 240 L24 160 L12 90 Z"
        fill="none"
        stroke={INK}
        strokeWidth="1.87"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ───────────── 최종 시안 히어로: 미리 만든 수채 워시(PNG, 정지 그림만 래스터) + 가벼운 잉크 선 몇 개

export function HeroArt() {
  return (
    <div className="f-hero-art" aria-hidden>
      <img src={HERO_WASH} alt="" width={560} height={440} decoding="async" />
      <svg viewBox="0 0 560 440" className="f-hero-lines">
        <path d="M44 398 C140 372 200 330 280 318 C360 306 420 270 486 236" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 11" />
        <g transform="translate(150 300) scale(0.62)">
          <Landmark stage={1} mode="ink" />
        </g>
        <g transform="translate(360 262) scale(0.55)">
          <Landmark stage={6} mode="ink" />
        </g>
        <path d="M480 222 l14 14 M494 222 l-14 14" stroke="#A4452A" strokeWidth="3.4" strokeLinecap="round" />
        <Bird x={120} y={92} s={0.9} />
        <Bird x={146} y={106} s={0.6} />
      </svg>
    </div>
  );
}
