// 최종 시안 삽화 (P2-07 2차). 필터·래스터 없이 평평한 면 + 얇은 선.
// - 선 규칙(2차): 면마다 "그 면 색의 진한 톤"으로 1px 안팎(tone()), 세부 선은 옅은 회갈색. 수채 번짐·해칭 없음
// - 색: 중립(나무·돌) + 초록 계열(주색) + 금색(강조) + 아주 옅은 물빛 하나. 빨강·주황·파랑 원색 없음
// - 잠긴 곳은 연필 스케치(점선, 채움 없음) → 클리어하면 색이 입혀진다 (진행 = 지도가 완성되는 보상)
import type { SVGProps } from 'react';

/** 세부 선(채움 없는 선·새·물결)과 반투명 그늘. 굵은 잉크 선 대신 옅은 회갈색 */
export const INK = '#A39A8C';
/** 지도에 그려지는 진행 길 (주색) */
export const ROAD = '#3E7B3A';
const PENCIL = '#B3AA9C';
const LW = 0.5; // 1차 선 굵기(2.2 기준)에 곱하는 배율 → 기본 1.1
export const C = {
  paper: '#FFFFFF',
  cream: '#F7F3EA',
  sand: '#EDE4D3',
  wood: '#CDAE86',
  woodDark: '#A3835F',
  stone: '#DDD4C5',
  stoneDark: '#BBAE99',
  sage: '#B5D6A2',
  forest: '#8CBB74',
  olive: '#5E9550',
  terra: '#E9B657', // 1차 주황(#D9774F) → 금색 계열
  roof: '#D9A548',
  water: '#BCD0DA',
  waterLight: '#DDE8ED',
  mustard: '#F0B43C', // = accent
  brass: '#D6B07A',
  mark: '#8A5A00', // 보물 X·강조 표시 (= accentText)
};

/** 면 색의 진한 톤 (외곽선용): RGB를 0.74배 */
export function tone(hex: string, k = 0.74): string {
  if (!hex.startsWith('#') || hex.length !== 7) return INK;
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

type Mode = 'ink' | 'pencil';
/** 선 스타일: 색(채움 + 면 색의 진한 톤 1px 안팎) / 연필(채움 없음 + 점선) */
function st(mode: Mode, fill: string, w = 2.2): SVGProps<SVGPathElement> {
  return mode === 'ink'
    ? { fill, stroke: fill === 'none' ? INK : tone(fill), strokeWidth: w * LW, strokeLinejoin: 'round', strokeLinecap: 'round' }
    : { fill: 'none', stroke: PENCIL, strokeWidth: 1.5, strokeDasharray: '4 4', strokeLinejoin: 'round', strokeLinecap: 'round', opacity: 0.75 };
}
/** 수채 번짐 (2차: 그리지 않음 — 판 어긋남이 난잡해 보임. 호출부는 그대로 둔다) */
function Wash(_: { d: string; color: string; dx?: number; dy?: number; o?: number; mode: Mode }) {
  return null;
}
/** 해칭 (1차 최종에서 뺌) */
function Hatch(_: { x: number; y: number; w: number; h: number; n?: number; mode: Mode }) {
  return null;
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
      {mode === 'ink' && <path d="M-22 -34 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z" fill={C.mustard} stroke={tone(C.mustard)} strokeWidth="0.6" />}
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
      <path d="M-22 0 C-22 -30 22 -30 22 0 Z" {...st(mode, mode === 'ink' ? '#8B7F70' : 'none', 2.2)} />
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
      <path d="M62 -10 l12 12 M74 -10 l-12 12" stroke={mode === 'ink' ? C.mark : PENCIL} strokeWidth={mode === 'ink' ? 4 : 2} strokeLinecap="round" />
    </g>
  );
}

// ───────────── 지도 장식

export function Mountains({ x, y, s = 1, o = 1 }: { x: number; y: number; s?: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o} aria-hidden>
      <path d="M0 0 L22 -38 L32 -26 L46 -52 L70 0" fill={C.cream} stroke={tone(C.cream)} strokeWidth="0.91" strokeLinejoin="round" />
      <path d="M46 -52 L40 -38 L48 -40 L54 -32" fill="none" stroke={INK} strokeWidth="0.71" strokeLinejoin="round" />
      <path d="M52 -10 l6 -14 M58 -6 l6 -14 M30 -6 l4 -10" stroke={INK} strokeWidth="0.55" opacity="0.5" strokeLinecap="round" />
    </g>
  );
}
export function Waves({ x, y, n = 3, s = 1 }: { x: number; y: number; n?: number; s?: number }) {
  const d = Array.from({ length: n }, (_, i) => `M${i * 22} ${(i % 2) * 8} q5 -5 10 0 q5 5 10 0`).join(' ');
  return <path d={d} transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke="#8FA8B4" strokeWidth="0.91" strokeLinecap="round" opacity="0.75" aria-hidden />;
}
export function Bird({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path d={`M${x} ${y} q${6 * s} ${-6 * s} ${12 * s} 0 q${6 * s} ${-6 * s} ${12 * s} 0`} fill="none" stroke={INK} strokeWidth="0.8" strokeLinecap="round" aria-hidden />;
}
export function TinyTree({ x, y, s = 1, c = C.forest }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden>
      <path d="M0 -26 L9 -8 L-9 -8 Z" fill={c} stroke={tone(c)} strokeWidth="0.76" strokeLinejoin="round" />
      <path d="M0 -8 v8" stroke={INK} strokeWidth="0.76" />
    </g>
  );
}

// ───────────── 권 표지 삽화 (1권 숲 마을 · 2권 바다 여행 · 3권 발명가의 공방)

export function CoverArt({ book }: { book: 1 | 2 | 3 }) {
  if (book === 1)
    return (
      <svg viewBox="0 0 200 140" aria-hidden className="f-cover-art">
        <rect width="200" height="140" fill="#EDF3E8" />
        <circle cx="150" cy="36" r="18" fill={C.mustard} opacity="0.8" stroke={tone(C.mustard)} strokeWidth="0.71" />
        <Mountains x={8} y={92} s={1.1} o={0.9} />
        <path d="M0 104 C40 92 80 98 120 92 C150 88 180 94 200 90 V140 H0Z" fill={C.sage} stroke={tone(C.sage)} strokeWidth="0.91" />
        <g transform="translate(118 108)">
          <Landmark stage={2} mode="ink" />
        </g>
        <path d="M18 132 C50 118 70 128 92 116" fill="none" stroke={INK} strokeWidth="1.31" strokeLinecap="round" strokeDasharray="0.1 7" />
      </svg>
    );
  if (book === 2)
    return (
      <svg viewBox="0 0 200 140" aria-hidden className="f-cover-art">
        <rect width="200" height="140" fill="#EDF1F3" />
        <circle cx="44" cy="34" r="16" fill={C.mustard} opacity="0.75" stroke={tone(C.mustard)} strokeWidth="0.71" />
        <Bird x={120} y={30} />
        <Bird x={142} y={42} s={0.7} />
        <path d="M0 84 C30 78 60 88 100 82 C140 76 170 86 200 80 V140 H0Z" fill={C.water} opacity="0.8" stroke={tone(C.water)} strokeWidth="0.91" />
        <Waves x={14} y={104} n={3} />
        <Waves x={120} y={118} n={3} />
        {/* 종이배 */}
        <path d="M70 84 h56 l-10 16 h-36z" fill={C.paper} stroke={tone(C.paper)} strokeWidth="1.01" strokeLinejoin="round" />
        <path d="M98 84 v-40 l26 34 h-26" fill={C.terra} stroke={tone(C.terra)} strokeWidth="1.01" strokeLinejoin="round" />
        <path d="M96 50 l-18 28 h18" fill={C.paper} stroke={tone(C.paper)} strokeWidth="1.01" strokeLinejoin="round" />
        {/* 고래 꼬리 */}
        <path d="M160 96 c-4 -12 -14 -14 -20 -18 c8 0 16 4 20 10 c4 -6 12 -10 20 -10 c-6 4 -16 6 -20 18z" fill="#A9BFCA" stroke={INK} strokeWidth="0.91" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 200 140" aria-hidden className="f-cover-art">
      <rect width="200" height="140" fill="#F4EEE5" />
      {/* 설계도 격자 */}
      <g stroke="#BBAE99" strokeWidth="0.42" opacity="0.4">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={`v${i}`} d={`M${i * 20 + 10} 0 V140`} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${i * 20 + 10} H200`} />
        ))}
      </g>
      <Gear x={62} y={78} r={30} teeth={10} c={C.brass} />
      <Gear x={112} y={50} r={18} teeth={8} c={C.wood} />
      {/* 전구 */}
      <path d="M150 74 a20 20 0 1 1 20 0 v10 h-20z" fill={C.mustard} stroke={tone(C.mustard)} strokeWidth="1.01" strokeLinejoin="round" />
      <path d="M150 88 h20 M152 94 h16" stroke={INK} strokeWidth="1.01" strokeLinecap="round" />
      <path d="M160 44 v-10 M140 52 l-7 -6 M180 52 l7 -6" stroke={INK} strokeWidth="1.01" strokeLinecap="round" />
      <path d="M20 124 h160" stroke={INK} strokeWidth="0.8" strokeDasharray="6 4" />
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
      <path d={d + 'Z'} fill={c} stroke={tone(c)} strokeWidth="1.01" strokeLinejoin="round" />
      <circle cx={x} cy={y} r={r * 0.35} fill={C.paper} stroke={tone(C.paper)} strokeWidth="1.01" />
    </g>
  );
}

// ───────────── 퀘스트 삽화: 변수의 숲 마법 상자 (이름표 붙은 상자)

export function MagicBoxScene() {
  return (
    <svg viewBox="0 0 320 170" className="f-quest-art" role="img" aria-label="숲 속 빈터에 이름표를 기다리는 마법 상자가 놓여 있어요">
      {/* 넓은 칸에서도 끝이 잘려 보이지 않게 바탕·땅을 viewBox 밖 양옆까지 길게 (뷰포트가 넓으면 보임) */}
      <rect x="-240" width="800" height="170" fill="#EDF3E8" />
      <path d="M-240 120 C-120 112 -60 122 0 118 C60 108 120 116 180 110 C230 104 280 112 320 106 C400 98 480 110 560 104 V170 H-240Z" fill={C.sage} />
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
        <path d="M-20 0 v-40 h84 v40z" fill={C.brass} stroke={tone(C.brass)} strokeWidth="1.21" strokeLinejoin="round" />
        <path d="M-12 -40 v40 M56 -40 v40" stroke={INK} strokeWidth="0.8" opacity="0.6" />
        <path d="M-26 -40 L-18 -58 H70 L78 -40 Z" fill={C.woodDark} stroke={tone(C.woodDark)} strokeWidth="1.21" strokeLinejoin="round" />
        <path d="M14 -46 h16 v14 h-16z" fill={C.mustard} stroke={tone(C.mustard)} strokeWidth="1.01" />
        {/* 빈 이름표 (아직 이름이 없음) */}
        <path d="M58 -24 L92 -34 L98 -14 L64 -4 Z" fill={C.paper} stroke={tone(C.paper)} strokeWidth="1.01" strokeLinejoin="round" />
        <circle cx="64" cy="-15" r="2.4" fill={INK} />
        <path d="M70 -18 l20 -6" stroke={PENCIL} strokeWidth="0.8" strokeDasharray="3 3" />
        <path d="M58 -14 c-6 2 -10 -2 -14 -6" fill="none" stroke={INK} strokeWidth="0.71" />
      </g>
      <g fill={C.mustard} stroke={tone(C.mustard)} strokeWidth="0.66">
        <path d="M150 64 l3 -8 3 8 8 3 -8 3 -3 8 -3 -8 -8 -3z" />
        <path d="M262 52 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z" />
      </g>
    </svg>
  );
}

// ───────────── 최종 시안 히어로 (2차): 평평한 언덕 두 겹 + 점선 길 + 랜드마크 둘. 수채 워시·래스터 없음
// 정지 그림(히어로·공유 카드)은 나중에 일러스트레이터 래스터로 바꿀 수 있는 자리 (§12-Q28) — 이 SVG가 자리 표시

export function HeroArt() {
  return (
    <div className="f-hero-art" aria-hidden>
      <svg viewBox="0 0 560 440" className="f-hero-lines">
        <defs>
          <clipPath id="fHeroPanel">
            <rect x="12" y="40" width="536" height="388" rx="28" />
          </clipPath>
        </defs>
        <g clipPath="url(#fHeroPanel)">
          <rect x="12" y="40" width="536" height="388" fill="#EEF3E9" />
          <circle cx="448" cy="118" r="34" fill="#FBF1DC" />
          <path d="M12 318 C90 262 190 250 290 268 C390 286 470 246 548 204 V428 H12 Z" fill="#DFEBD6" />
          <path d="M12 366 C120 326 230 336 330 350 C420 362 490 340 548 316 V428 H12 Z" fill="#CFE3C2" />
        </g>
        <path d="M60 396 C150 372 210 336 290 322 C370 308 426 276 488 244" fill="none" stroke={ROAD} strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 11" opacity="0.7" />
        <g transform="translate(160 330) scale(0.6)">
          <Landmark stage={1} mode="ink" />
        </g>
        <g transform="translate(372 290) scale(0.52)">
          <Landmark stage={6} mode="ink" />
        </g>
        <TinyTree x={84} y={352} s={1.2} c={C.forest} />
        <TinyTree x={104} y={360} s={0.9} c={C.olive} />
        <TinyTree x={512} y={300} s={1.1} c={C.forest} />
        <path d="M482 228 l12 12 M494 228 l-12 12" stroke={C.mark} strokeWidth="2.6" strokeLinecap="round" />
        <Bird x={118} y={150} s={0.9} />
        <Bird x={144} y={164} s={0.6} />
      </svg>
    </div>
  );
}
