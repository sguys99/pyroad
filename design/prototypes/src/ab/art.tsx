// 시안 A×B 손그림 일러스트 (인라인 SVG). 규칙표(mixRules.ts) "일러스트" 줄을 따른다:
// - 외곽선: 남색 잉크 2.6px, 끝 둥글게 (B) · 흔들림은 B의 절반(.ab-wob, lite부터 끔)
// - 면: 선명한 과슈 단색 + 왼쪽 위 흰 광택 타원 1개 (A) · 질감은 바탕에만, 일러스트 면은 매끈
// - 그림자: 흐림 없이 종이 접힘 그림자(남색 16% 단색 오프셋) + 종이 두께 옆면 (A×B)
import type { ReactNode } from 'react';
import type { BuildingKind } from './data';

export const INK = '#24324A';
export const C = {
  grass: '#6CC77F',
  grassDark: '#3FA45A',
  grassInk: '#217A35',
  sand: '#FFE29A',
  sandSide: '#F2C46B',
  sea: '#6EC1EA',
  seaDeep: '#3E9FD3',
  coral: '#FF7F66',
  lemon: '#FFD24D',
  blue: '#1F70B5',
  sky: '#9AD7F2',
  orange: '#F4A04B',
  paper: '#FFFCF3',
  wood: '#C98F55',
  woodDark: '#9C6A3A',
  rock: '#A9B4C6',
  rockDark: '#7E8BA3',
  purple: '#9B7FE0',
};
const O = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const O2 = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** 문서에 한 번만 두는 공용 SVG 필터 (손그림 흔들림 — B의 절반 세기) */
export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <filter id="ab-wob" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={1} seed={5} />
        <feDisplacementMap in="SourceGraphic" scale="1.3" />
      </filter>
    </svg>
  );
}

function Gloss({ cx, cy, rx, ry, rot = -14, o = 0.45 }: { cx: number; cy: number; rx: number; ry: number; rot?: number; o?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity={o} transform={`rotate(${rot} ${cx} ${cy})`} />;
}

// ───────────── 섬 (종이 층으로 솟아오른 팝업 섬)

/** 섬 하나: viewBox 0 0 200 150. 바닥(접힘 그림자) → 종이 두께 옆면 → 모래 → 풀밭 → 건물 */
export function PaperIsland({ kind, big = false, locked = false }: { kind: BuildingKind; big?: boolean; locked?: boolean }) {
  return (
    <svg viewBox="0 0 200 160" className="ab-island-svg" aria-hidden focusable="false">
      {/* 종이 접힘 그림자 (흐림 없음) */}
      <path d="M22 118 Q24 92 100 88 Q178 92 182 118 Q180 146 100 148 Q22 146 22 118Z" fill={INK} opacity="0.16" transform="translate(7 9)" />
      <g className="ab-wob" filter="url(#ab-wob)">
        {/* 종이 두께 옆면 */}
        <path d="M18 112 Q20 86 100 82 Q180 86 182 112 L182 122 Q180 148 100 150 Q20 148 18 122Z" fill={C.sandSide} {...O} />
        {/* 모래 */}
        <path d="M18 112 Q20 86 100 82 Q180 86 182 112 Q180 136 100 138 Q20 136 18 112Z" fill={C.sand} {...O} />
        {/* 풀밭 */}
        <path d="M34 108 Q34 84 98 80 Q166 82 168 106 Q160 124 100 126 Q40 124 34 108Z" fill={locked ? '#B9CDBD' : C.grass} {...O} />
        <path d="M40 114 Q100 130 162 112 Q160 122 100 126 Q42 124 40 114Z" fill={locked ? '#9FB4A4' : C.grassDark} opacity="0.55" />
        <Gloss cx={66} cy={92} rx={20} ry={5} />
        {/* 풀 손그림 */}
        <path d="M52 112 l3 -6 l3 6 M146 104 l3 -6 l3 6 M120 120 l2 -5 l2 5" fill="none" {...O2} />
        {/* 모래 조약돌 */}
        <ellipse cx="38" cy="128" rx="5" ry="2.4" fill={C.paper} {...O2} />
        <ellipse cx="164" cy="126" rx="4" ry="2" fill={C.paper} {...O2} />
        <g transform={big ? 'translate(100 92) scale(1.08)' : 'translate(100 94)'}>
          <Building kind={kind} />
        </g>
      </g>
    </svg>
  );
}

function Building({ kind }: { kind: BuildingKind }) {
  switch (kind) {
    case 'gate':
      return (
        <g>
          <path d="M-34 6 V-42 M34 6 V-42" stroke={INK} strokeWidth="9" strokeLinecap="round" />
          <path d="M-34 6 V-42 M34 6 V-42" stroke={C.wood} strokeWidth="4.4" strokeLinecap="round" />
          <path d="M-46 -40 Q0 -70 46 -40 L42 -30 Q0 -56 -42 -30Z" fill={C.coral} {...O} />
          <Gloss cx={-18} cy={-48} rx={10} ry={3} rot={-18} />
          <rect x="-20" y="-30" width="40" height="18" rx="5" fill={C.paper} {...O} />
          <path d="M-12 -21 h24" stroke={C.grassInk} strokeWidth="3" strokeLinecap="round" />
          <circle cx="-50" cy="2" r="9" fill={C.grass} {...O2} />
          <circle cx="52" cy="0" r="11" fill={C.grass} {...O2} />
        </g>
      );
    case 'treehouse':
      return (
        <g>
          <path d="M-30 4 V-24" stroke={INK} strokeWidth="8" strokeLinecap="round" />
          <path d="M-30 4 V-24" stroke={C.woodDark} strokeWidth="3.6" strokeLinecap="round" />
          <circle cx="-30" cy="-40" r="24" fill={C.grassDark} {...O} />
          <Gloss cx={-38} cy={-52} rx={8} ry={4} />
          <path d="M28 4 V-14" stroke={INK} strokeWidth="7" strokeLinecap="round" />
          <circle cx="28" cy="-28" r="17" fill={C.grass} {...O} />
          {/* 마법 상자 2개 (숫자 상자 · 글자 상자) */}
          <rect x="-14" y="-16" width="24" height="20" rx="4" fill={C.lemon} {...O} />
          <path d="M-14 -9 h24" stroke={INK} strokeWidth="2" />
          <rect x="6" y="-6" width="20" height="12" rx="3" fill={C.sky} {...O2} />
          <path d="M-2 -16 l-4 -8 l8 0z" fill={C.coral} {...O2} />
        </g>
      );
    case 'signpost':
      return (
        <g>
          <path d="M0 6 V-50" stroke={INK} strokeWidth="8" strokeLinecap="round" />
          <path d="M0 6 V-50" stroke={C.wood} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M-2 -46 H-40 L-48 -38 L-40 -30 H-2Z" fill={C.blue} {...O} />
          <path d="M2 -28 H40 L48 -20 L40 -12 H2Z" fill={C.coral} {...O} />
          <Gloss cx={-26} cy={-42} rx={8} ry={2.4} rot={0} />
          <path d="M-30 -38 h16 M14 -20 h16" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="-44" cy="-2" r="10" fill={C.grassDark} {...O2} />
          <circle cx="42" cy="0" r="8" fill={C.grass} {...O2} />
        </g>
      );
    case 'cave':
      return (
        <g>
          <path d="M-48 6 Q-50 -40 -6 -50 Q44 -54 50 6Z" fill={C.rock} {...O} />
          <path d="M-20 6 Q-20 -24 2 -24 Q24 -24 24 6Z" fill={INK} />
          <Gloss cx={-24} cy={-36} rx={12} ry={4} />
          {/* 반복 화살표 */}
          <path d="M28 -40 a10 10 0 1 1 -4 -10" fill="none" stroke={C.lemon} strokeWidth="5" strokeLinecap="round" />
          <path d="M28 -40 a10 10 0 1 1 -4 -10" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
          <path d="M20 -52 l6 2 l-2 6" fill="none" {...O2} />
          <circle cx="-4" cy="-6" r="2.4" fill={C.lemon} />
          <circle cx="8" cy="-10" r="2.4" fill={C.lemon} />
        </g>
      );
    case 'lighthouse':
      return (
        <g>
          <ellipse cx="-24" cy="0" rx="22" ry="7" fill={C.sea} {...O2} />
          <path d="M-30 -1 q4 -3 8 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M12 6 L18 -44 H34 L40 6Z" fill={C.paper} {...O} />
          <path d="M15 -16 H37 L38 -6 H14Z M17 -36 H35 L36 -27 H16Z" fill={C.coral} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <rect x="16" y="-56" width="20" height="13" rx="3" fill={C.lemon} {...O2} />
          <path d="M14 -56 L26 -66 L38 -56Z" fill={C.blue} {...O2} />
          <Gloss cx={21} cy={-24} rx={2} ry={9} rot={0} o={0.6} />
        </g>
      );
    case 'tower':
      return (
        <g>
          <path d="M-20 6 L-16 -54 H16 L20 6Z" fill={C.purple} {...O} />
          <path d="M-22 -54 H22 L0 -80Z" fill={C.blue} {...O} />
          <path d="M0 -80 V-94" stroke={INK} strokeWidth="2.4" />
          <path d="M0 -94 l14 4 l-14 5z" fill={C.lemon} {...O2} />
          <rect x="-7" y="-40" width="14" height="16" rx="7" fill={C.lemon} {...O2} />
          <rect x="-7" y="-14" width="14" height="20" rx="3" fill={C.woodDark} {...O2} />
          <Gloss cx={-10} cy={-28} rx={2.6} ry={12} rot={0} o={0.4} />
          <circle cx="-38" cy="0" r="9" fill={C.grassDark} {...O2} />
        </g>
      );
    case 'castle':
      return (
        <g>
          <path d="M-52 6 V-36 H-36 V-28 H-24 V-36 H-10 V-48 H10 V-36 H24 V-28 H36 V-36 H52 V6Z" fill={C.paper} {...O} />
          <path d="M-10 -48 V-70 H10 V-48" fill={C.lemon} {...O} />
          <path d="M-14 -70 L0 -88 L14 -70Z" fill={C.coral} {...O} />
          <path d="M-58 -36 L-44 -52 L-30 -36Z M30 -36 L44 -52 L58 -36Z" fill={C.blue} {...O} />
          <path d="M0 -88 V-100" stroke={INK} strokeWidth="2.4" />
          <path d="M0 -100 l14 4 l-14 5z" fill={C.coral} {...O2} />
          <path d="M-10 6 V-12 Q0 -22 10 -12 V6Z" fill={C.woodDark} {...O2} />
          <rect x="-40" y="-22" width="8" height="10" rx="4" fill={C.sky} {...O2} />
          <rect x="32" y="-22" width="8" height="10" rx="4" fill={C.sky} {...O2} />
          <Gloss cx={-40} cy={-30} rx={8} ry={2.6} rot={0} />
        </g>
      );
  }
}

// ───────────── 지도 장식 (구름·물결·나침반·배)

export function Cloud({ w = 120 }: { w?: number }) {
  return (
    <svg viewBox="0 0 120 56" width={w} height={(w * 56) / 120} aria-hidden focusable="false">
      <path d="M14 46 Q2 46 6 34 Q8 22 24 26 Q28 8 50 12 Q64 0 80 14 Q102 10 104 28 Q118 30 112 44 Q110 48 100 48 Z" fill="#fff" transform="translate(4 5)" opacity="0.5" />
      <path d="M14 46 Q2 46 6 34 Q8 22 24 26 Q28 8 50 12 Q64 0 80 14 Q102 10 104 28 Q118 30 112 44 Q110 48 100 48 Z" fill="#fff" {...O2} />
      <Gloss cx={44} cy={22} rx={12} ry={3.4} o={0.8} />
    </svg>
  );
}

/** 손그림 물결 무늬 (가로 반복 띠) */
export function WaveRow({ w = 240, color = '#fff' }: { w?: number; color?: string }) {
  return (
    <svg viewBox="0 0 240 20" width={w} height={(w * 20) / 240} aria-hidden focusable="false" preserveAspectRatio="none">
      <path d="M4 12 q10 -8 20 0 t20 0 M84 10 q10 -8 20 0 t20 0 M164 13 q10 -8 20 0 t20 0" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Compass({ size = 84 }: { size?: number }) {
  return (
    <svg viewBox="0 0 84 84" width={size} height={size} aria-hidden focusable="false">
      <circle cx="42" cy="42" r="34" fill={C.paper} {...O} />
      <circle cx="42" cy="42" r="26" fill="none" stroke={INK} strokeWidth="1.4" strokeDasharray="2 5" />
      <path d="M42 12 L50 42 L42 72 L34 42Z" fill={C.coral} {...O2} />
      <path d="M42 12 L50 42 L34 42Z" fill={C.lemon} {...O2} />
      <path d="M12 42 H72" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="42" cy="42" r="4" fill={INK} />
    </svg>
  );
}

/** 장식용 작은 섬 (야자수 모래톱 / 바위) */
export function Islet({ w = 100, rock = false }: { w?: number; rock?: boolean }) {
  return (
    <svg viewBox="0 0 120 70" width={w} height={(w * 70) / 120} aria-hidden focusable="false">
      <ellipse cx="62" cy="60" rx="46" ry="8" fill={INK} opacity="0.14" />
      {rock ? (
        <>
          <path d="M18 58 Q20 34 44 30 Q58 18 74 30 Q100 32 102 58Z" fill={C.rock} {...O} />
          <path d="M30 58 Q34 44 48 42" fill="none" stroke={INK} strokeWidth="1.6" opacity="0.5" />
          <Gloss cx={46} cy={36} rx={9} ry={3} />
        </>
      ) : (
        <>
          <path d="M14 56 Q18 42 60 40 Q102 42 106 56 Q60 66 14 56Z" fill={C.sand} {...O} />
          <path d="M58 46 Q60 26 66 12" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <path d="M58 46 Q60 26 66 12" fill="none" stroke={C.wood} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M66 12 Q50 4 38 14 Q52 12 66 14 Q80 2 94 12 Q80 12 66 14 Q56 22 50 32 Q62 22 66 14 Q76 22 80 32 Q72 20 66 14Z" fill={C.grassDark} {...O2} />
        </>
      )}
    </svg>
  );
}

export function PaperBoat({ size = 70 }: { size?: number }) {
  return (
    <svg viewBox="0 0 80 56" width={size} height={(size * 56) / 80} aria-hidden focusable="false">
      <path d="M8 34 H72 L60 50 H20Z" fill={C.paper} {...O} />
      <path d="M38 34 V6 L60 30Z" fill={C.coral} {...O} />
      <path d="M36 34 V12 L20 30Z" fill={C.lemon} {...O2} />
      <Gloss cx={46} cy={22} rx={2.4} ry={8} rot={20} />
    </svg>
  );
}

// ───────────── 월드 미리보기 장면 (1장 초록 섬 · 2장 바다·하늘 섬 · 3장 공방 섬)

export function WorldArt({ world, locked = false }: { world: 0 | 1 | 2; locked?: boolean }) {
  const sky = ['#E4F5DE', '#DFF0F8', '#FDE7CC'][world];
  return (
    <svg viewBox="0 0 320 190" className={`ab-world-art ${locked ? 'is-locked' : ''}`} preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <rect width="320" height="190" fill={sky} />
      <circle cx="268" cy="40" r="17" fill={world === 2 ? '#FFB067' : C.lemon} {...O2} />
      <path d="M0 134 Q40 126 80 134 T160 134 T240 134 T320 134 V190 H0Z" fill={world === 2 ? '#7CC8EA' : C.sea} {...O2} />
      <path d="M22 156 q8 -5 16 0 M120 168 q8 -5 16 0 M222 158 q8 -5 16 0" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <g className="ab-wob" filter="url(#ab-wob)">
        {world === 0 && (
          <>
            <path d="M58 140 Q60 112 160 108 Q260 112 262 140 L262 146 Q260 162 160 164 Q60 162 58 146Z" fill={C.sandSide} {...O} />
            <path d="M58 140 Q60 112 160 108 Q260 112 262 140 Q258 156 160 158 Q62 156 58 140Z" fill={C.sand} {...O} />
            <path d="M80 136 Q82 104 156 100 Q236 102 240 132 Q230 148 160 150 Q88 148 80 136Z" fill={C.grass} {...O} />
            <Gloss cx={120} cy={112} rx={24} ry={5} />
            <g transform="translate(110 122) scale(0.7)">
              <Building kind="gate" />
            </g>
            <g transform="translate(196 124) scale(0.66)">
              <Building kind="treehouse" />
            </g>
          </>
        )}
        {world === 1 && (
          <>
            {[
              [96, 96, 1],
              [218, 66, 0.72],
            ].map(([x, y, s], i) => (
              <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
                <path d="M-54 0 Q-50 -18 0 -20 Q50 -18 54 0 Q30 40 0 46 Q-30 40 -54 0Z" fill={C.rock} {...O} />
                <path d="M-54 0 Q-50 -18 0 -20 Q50 -18 54 0 Q30 10 0 10 Q-30 10 -54 0Z" fill={C.grass} {...O} />
                <Gloss cx={-20} cy={-8} rx={14} ry={3.6} />
                <path d="M-8 -14 V-40" stroke={INK} strokeWidth="6" strokeLinecap="round" />
                <circle cx="-8" cy="-48" r="14" fill={C.grassDark} {...O2} />
              </g>
            ))}
            <g transform="translate(270 104)">
              <path d="M-18 -30 a18 20 0 1 1 36 0 Q16 -10 6 -2 H-6 Q-16 -10 -18 -30Z" fill={C.coral} {...O} />
              <path d="M0 -50 Q-8 -30 -4 -2 M0 -50 Q8 -30 4 -2" stroke={INK} strokeWidth="1.6" fill="none" />
              <rect x="-8" y="4" width="16" height="11" rx="3" fill={C.wood} {...O2} />
              <path d="M-5 -2 L-6 4 M5 -2 L6 4" stroke={INK} strokeWidth="1.6" />
              <Gloss cx={-8} cy={-38} rx={4} ry={7} rot={-20} />
            </g>
            <g transform="translate(150 150)">
              <path d="M-26 0 H26 L18 12 H-18Z" fill={C.paper} {...O2} />
              <path d="M0 0 V-22 L16 -4Z" fill={C.lemon} {...O2} />
            </g>
          </>
        )}
        {world === 2 && (
          <>
            <path d="M48 142 Q52 114 160 110 Q268 114 272 142 L272 148 Q268 164 160 166 Q52 164 48 148Z" fill="#E7A65C" {...O} />
            <path d="M48 142 Q52 114 160 110 Q268 114 272 142 Q268 158 160 160 Q52 158 48 142Z" fill="#F7C98B" {...O} />
            <rect x="86" y="70" width="38" height="62" rx="6" fill={C.orange} {...O} />
            <rect x="132" y="52" width="30" height="80" rx="6" fill={C.blue} {...O} />
            <rect x="170" y="82" width="44" height="50" rx="6" fill={C.coral} {...O} />
            <rect x="94" y="82" width="9" height="11" rx="2" fill="#FFF1B8" {...O2} />
            <rect x="108" y="82" width="9" height="11" rx="2" fill="#FFF1B8" {...O2} />
            <rect x="140" y="64" width="14" height="10" rx="2" fill="#FFF1B8" {...O2} />
            <rect x="140" y="84" width="14" height="10" rx="2" fill="#FFF1B8" {...O2} />
            <Gloss cx={96} cy={100} rx={3} ry={16} rot={0} o={0.35} />
            <rect x="196" y="56" width="9" height="26" fill="#5D6B7E" {...O2} />
            <g className="ab-smoke m-ambient" fill="#fff" {...O2}>
              <circle cx="201" cy="46" r="6" />
              <circle cx="209" cy="34" r="8" />
            </g>
            <g transform="translate(244 106)">
              <circle r="20" fill={C.lemon} {...O} />
              <circle r="7" fill={C.paper} {...O2} />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <rect key={a} x="-4" y="-27" width="8" height="9" rx="2" fill={C.lemon} {...O2} transform={`rotate(${a})`} />
              ))}
            </g>
          </>
        )}
      </g>
    </svg>
  );
}

// ───────────── 랜딩 히어로: 펼친 팝업북

export function PopupBook({ children }: { children?: ReactNode }) {
  return (
    <div className="ab-book">
      <svg viewBox="0 0 560 360" className="ab-book-svg" aria-hidden focusable="false">
        {/* 책 그림자 */}
        <path d="M30 300 Q280 340 530 300 L530 318 Q280 360 30 318Z" fill={INK} opacity="0.16" transform="translate(8 10)" />
        {/* 표지 */}
        <path d="M20 296 Q280 336 540 296 L540 316 Q280 356 20 316Z" fill={C.grassInk} {...O} />
        {/* 왼쪽 장 */}
        <path d="M30 290 Q150 270 280 300 L280 120 Q150 92 30 112Z" fill={C.paper} {...O} />
        {/* 오른쪽 장 */}
        <path d="M530 290 Q410 270 280 300 L280 120 Q410 92 530 112Z" fill="#FFF7E6" {...O} />
        <path d="M60 140 Q150 124 250 144 M60 164 Q150 148 250 168 M60 188 Q140 174 210 188" stroke={INK} strokeWidth="1.6" opacity="0.18" fill="none" strokeLinecap="round" />
        {/* 바다 (오른쪽 장) */}
        <path d="M300 250 Q360 236 420 248 T520 244 L520 282 Q410 268 300 292Z" fill={C.sea} {...O2} />
        <path d="M330 262 q8 -5 16 0 M440 258 q8 -5 16 0" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* 팝업 받침 (접힌 종이 기둥) */}
        <path d="M200 268 L250 228 L310 228 L360 268" fill="#F6E3BC" {...O2} />
        <path d="M250 228 L250 262 M310 228 L310 262" stroke={INK} strokeWidth="1.6" opacity="0.4" />
        {/* 길 */}
        <path d="M70 262 Q120 230 180 250" stroke={INK} strokeWidth="2.6" strokeDasharray="3 8" fill="none" strokeLinecap="round" />
        <path d="M60 250 l6 -18 l12 8z" fill={C.coral} {...O2} />
      </svg>
      <div className="ab-book-pop">{children}</div>
    </div>
  );
}

/** 히어로 팝업 섬 (파이뱀이 올라서는 무대) */
export function HeroIsland() {
  return (
    <svg viewBox="0 0 300 150" className="ab-hero-island" aria-hidden focusable="false">
      <path d="M20 96 Q24 60 150 56 Q276 60 280 96 Q276 132 150 136 Q24 132 20 96Z" fill={INK} opacity="0.16" transform="translate(8 10)" />
      <g className="ab-wob" filter="url(#ab-wob)">
        <path d="M16 92 Q20 56 150 52 Q280 56 284 92 L284 104 Q280 138 150 140 Q20 138 16 104Z" fill={C.sandSide} {...O} />
        <path d="M16 92 Q20 56 150 52 Q280 56 284 92 Q280 122 150 126 Q20 122 16 92Z" fill={C.sand} {...O} />
        <path d="M40 88 Q42 58 146 54 Q252 56 258 86 Q248 110 150 114 Q50 110 40 88Z" fill={C.grass} {...O} />
        <Gloss cx={94} cy={68} rx={30} ry={6} />
        <path d="M70 96 l3 -6 l3 6 M224 90 l3 -6 l3 6" fill="none" {...O2} />
        <g transform="translate(244 84) scale(0.8)">
          <path d="M0 6 V-34" stroke={INK} strokeWidth="8" strokeLinecap="round" />
          <path d="M0 6 V-34" stroke={C.wood} strokeWidth="3.6" strokeLinecap="round" />
          <circle cx="0" cy="-48" r="20" fill={C.grassDark} {...O} />
          <Gloss cx={-6} cy={-58} rx={7} ry={3} />
        </g>
        <g transform="translate(56 82) scale(0.9)">
          <rect x="-14" y="-16" width="26" height="20" rx="4" fill={C.lemon} {...O} />
          <path d="M-14 -9 h26" stroke={INK} strokeWidth="2" />
        </g>
      </g>
    </svg>
  );
}

/** 스테이지 해제·클리어 도장 (B에서 가져온 것). 글자는 accentText(5.33:1 on surface) */
export function StampMark({ text = '클리어', size = 64, className }: { text?: string; size?: number; className?: string }) {
  return (
    <span className={`ab-stamp ${className ?? ''}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <circle cx="32" cy="32" r="28" fill="rgba(255,252,243,0.92)" stroke="#BA3F2B" strokeWidth="3" />
        <circle cx="32" cy="32" r="22" fill="none" stroke="#BA3F2B" strokeWidth="1.4" strokeDasharray="3 3" />
      </svg>
      <span>{text}</span>
    </span>
  );
}
