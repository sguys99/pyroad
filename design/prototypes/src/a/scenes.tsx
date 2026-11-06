// 시안 A 장면 그림: 섬·랜드마크(스테이지별)·월드 미리보기. 모두 clay.tsx의 다섯 규칙(몸·두께·광택·그늘·접지)만으로 그린다.
// 그라디언트·필터 없음 (P0-07 렌더 비용). 앰비언트(구름·연기·톱니)는 .m-ambient → lite부터 멈춤.
import type { ReactNode } from 'react';
import { Ball, Clay, blob, rrect, tone } from './clay';

// ───────────── 섬

export function Island({
  x,
  y,
  rx,
  ry,
  seed = 1,
  locked = false,
  sandOnly = false,
  children,
}: {
  x: number;
  y: number;
  rx: number;
  ry: number;
  seed?: number;
  locked?: boolean;
  sandOnly?: boolean;
  children?: ReactNode;
}) {
  const sand = tone('sand', locked);
  const grass = tone('grass', locked);
  return (
    <g>
      {/* 얕은 물 테두리 */}
      <path d={blob(x, y + ry * 0.3, rx * 1.24, ry * 1.5, seed + 7, 9, 0.08)} fill={locked ? '#C9E9F7' : '#B8ECFF'} opacity={0.9} />
      {/* 모래 절벽: 몸 + 두꺼운 아랫면 */}
      <Clay d={blob(x, y, rx, ry, seed, 9, 0.09)} tone={sand} depth={ry * 0.42} />
      {!sandOnly && (
        <Clay
          d={blob(x - rx * 0.02, y - ry * 0.14, rx * 0.84, ry * 0.74, seed + 3, 8, 0.1)}
          tone={grass}
          depth={6}
          gloss={[x - rx * 0.4, y - ry * 0.5, rx * 0.22, ry * 0.12, -12]}
          glossOpacity={0.32}
        />
      )}
      {children}
    </g>
  );
}

// ───────────── 작은 소품

export function Palm({ x, y, s = 1, locked = false, flip = false }: { x: number; y: number; s?: number; locked?: boolean; flip?: boolean }) {
  const wood = tone('wood', locked);
  const leaf = tone('leaf', locked);
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx="0" cy="2" rx="12" ry="4" fill="#1B2F45" opacity="0.14" />
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} cx={i * 2.2} cy={-6 - i * 11} rx={5.5 - i * 0.4} ry="6.5" fill={i % 2 ? wood.lip : wood.fill} />
      ))}
      <path d="M8 -46 q-22 -12 -34 4 q14 -6 34 -4Z" fill={leaf.lip} transform="translate(0 3)" />
      <path d="M8 -46 q-22 -12 -34 4 q14 -6 34 -4Z" fill={leaf.fill} />
      <path d="M8 -46 q20 -14 34 2 q-16 -6 -34 -2Z" fill={leaf.lip} transform="translate(0 3)" />
      <path d="M8 -46 q20 -14 34 2 q-16 -6 -34 -2Z" fill={leaf.fill} />
      <path d="M8 -46 q-6 -22 10 -30 q-2 16 -10 30Z" fill={leaf.fill} />
      <path d="M8 -46 q-16 -18 -10 -30 q8 12 10 30Z" fill={leaf.lip} />
      <Ball cx={4} cy={-42} r={4} t={tone('wood', locked)} gloss={false} />
      <Ball cx={12} cy={-41} r={4} t={tone('wood', locked)} gloss={false} />
    </g>
  );
}

export function Tree({ x, y, s = 1, locked = false }: { x: number; y: number; s?: number; locked?: boolean }) {
  const leaf = tone('leaf', locked);
  const wood = tone('wood', locked);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="14" ry="4.5" fill="#1B2F45" opacity="0.14" />
      <path d={rrect(-4, -16, 8, 18, 3)} fill={wood.fill} />
      <circle cx="0" cy="-26" r="17" fill={leaf.lip} />
      <circle cx="0" cy="-30" r="17" fill={leaf.fill} />
      <circle cx="-8" cy="-38" r="9" fill={leaf.fill} />
      <ellipse cx="-7" cy="-40" rx="5" ry="2.6" fill="#fff" opacity="0.35" transform="rotate(-25 -7 -40)" />
    </g>
  );
}

function Flower({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="3.2" fill={c} />
      <circle cx={x} cy={y} r="1.2" fill="#FFF7D6" />
    </g>
  );
}

/** 클레이 상자 (변수 = 마법 상자) */
export function MagicBox({ x, y, s = 1, locked = false, label }: { x: number; y: number; s?: number; locked?: boolean; label?: string }) {
  const b = tone('lemon', locked);
  const lid = tone('roof', locked);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="3" rx="22" ry="5" fill="#1B2F45" opacity="0.16" />
      <Clay d={rrect(-18, -24, 36, 26, 6)} tone={b} depth={4} gloss={[-9, -17, 5, 2.4, -10]} glossOpacity={0.5} />
      <Clay d={rrect(-21, -33, 42, 11, 5)} tone={lid} depth={3} gloss={[-12, -29, 5, 1.8, 0]} glossOpacity={0.5} />
      <path d={rrect(-3, -33, 6, 35, 2)} fill="#FFF7E8" opacity="0.9" />
      {label && (
        <text x="0" y="-7" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#5A3B00">
          {label}
        </text>
      )}
    </g>
  );
}

// ───────────── 스테이지 랜드마크 (원점 = 섬 위 바닥 중심, 위로 약 110)

export type LandmarkKind = 'gate' | 'forest' | 'fork' | 'cave' | 'lake' | 'tower' | 'castle';
export const LANDMARKS: LandmarkKind[] = ['gate', 'forest', 'fork', 'cave', 'lake', 'tower', 'castle'];

export function Landmark({ kind, x, y, s = 1, locked = false }: { kind: LandmarkKind; x: number; y: number; s?: number; locked?: boolean }) {
  const t = (n: Parameters<typeof tone>[0]) => tone(n, locked);
  let body: ReactNode = null;
  switch (kind) {
    case 'gate': {
      // 파이썬 마을 입구: 나무 기둥 두 개 + 아치 간판 + 뒤에 작은 집
      const wood = t('wood');
      body = (
        <>
          <g transform="translate(46 -12) scale(0.9)">
            <ellipse cx="0" cy="8" rx="22" ry="5" fill="#1B2F45" opacity="0.14" />
            <Clay d={rrect(-16, -22, 32, 30, 5)} tone={t('cream')} depth={4} />
            <Clay d="M-21 -20 L0 -40 L21 -20 Q22 -16 18 -16 H-18 Q-22 -16 -21 -20Z" tone={t('roof')} depth={4} gloss={[-8, -28, 5, 2, -40]} glossOpacity={0.45} />
            <path d={rrect(-5, -6, 10, 14, 3)} fill={wood.lip} />
          </g>
          <ellipse cx="-8" cy="2" rx="30" ry="6" fill="#1B2F45" opacity="0.14" />
          <Clay d={rrect(-36, -50, 10, 52, 4)} tone={wood} depth={3} gloss={[-33, -40, 1.6, 6, 0]} />
          <Clay d={rrect(10, -50, 10, 52, 4)} tone={wood} depth={3} gloss={[13, -40, 1.6, 6, 0]} />
          <Clay d="M-42 -50 Q-8 -74 26 -50 L26 -40 Q-8 -62 -42 -40Z" tone={t('sky')} depth={4} gloss={[-24, -56, 6, 2, -18]} glossOpacity={0.5} />
          <Flower x={-44} y={-2} c={locked ? '#E3C9CF' : '#FF8FA3'} />
          <Flower x={30} y={4} c={locked ? '#E8E0C2' : '#FFD84D'} />
        </>
      );
      break;
    }
    case 'forest':
      body = (
        <>
          <Tree x={-30} y={-6} s={1.1} locked={locked} />
          <Tree x={28} y={-10} s={0.9} locked={locked} />
          <Tree x={2} y={-22} s={0.8} locked={locked} />
          <MagicBox x={0} y={4} s={1} locked={locked} />
        </>
      );
      break;
    case 'fork': {
      const wood = t('wood');
      body = (
        <>
          {/* 갈라지는 돌길 */}
          {[
            [-10, 6],
            [-24, 0],
            [-38, -4],
            [10, 6],
            [24, 0],
            [38, -4],
          ].map(([sx, sy], i) => (
            <Clay key={i} d={blob(sx, sy, 6, 3, i + 2, 6, 0.1)} tone={t('stone')} depth={2} />
          ))}
          <ellipse cx="0" cy="4" rx="16" ry="4" fill="#1B2F45" opacity="0.16" />
          <Clay d={rrect(-4, -64, 8, 68, 3)} tone={wood} depth={2} />
          <Clay d="M-2 -60 H30 L40 -52 L30 -44 H-2Z" tone={t('sky')} depth={4} gloss={[8, -56, 7, 1.8, 0]} glossOpacity={0.5} />
          <Clay d="M2 -40 H-30 L-40 -32 L-30 -24 H2Z" tone={t('roof')} depth={4} gloss={[-20, -36, 7, 1.8, 0]} glossOpacity={0.5} />
          <Ball cx={0} cy={-66} r={5} t={t('lemon')} />
        </>
      );
      break;
    }
    case 'cave': {
      const rock = t('rock');
      body = (
        <>
          <ellipse cx="0" cy="4" rx="46" ry="7" fill="#1B2F45" opacity="0.16" />
          <Clay d="M-46 4 Q-48 -40 -14 -58 Q10 -70 32 -50 Q50 -32 46 4Z" tone={rock} depth={5} gloss={[-22, -44, 10, 4, -30]} glossOpacity={0.4} shade={5} />
          <path d="M-18 4 Q-20 -30 0 -32 Q20 -30 18 4Z" fill={locked ? '#7F8DA0' : '#2A3F5A'} />
          <path d="M-12 -24 l4 8 l4 -9 l4 8 l4 -8 l4 7" fill="none" stroke={locked ? '#CBD5E1' : '#E3EAF2'} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {/* 반복 = 크리스털 셋 */}
          {[
            [32, -6, 1],
            [40, -2, 0.7],
            [-36, -4, 0.8],
          ].map(([cx, cy, k], i) => (
            <g key={i} transform={`translate(${cx} ${cy}) scale(${k})`}>
              <path d="M0 0 L-6 -6 L0 -22 L6 -6Z" fill={t('lilac').lip} transform="translate(0 2)" />
              <path d="M0 0 L-6 -6 L0 -22 L6 -6Z" fill={t('lilac').fill} />
              <path d="M-2 -8 L0 -16" stroke="#fff" strokeWidth="1.6" opacity="0.6" strokeLinecap="round" />
            </g>
          ))}
        </>
      );
      break;
    }
    case 'lake': {
      const wood = t('wood');
      body = (
        <>
          <ellipse cx="-4" cy="-4" rx="40" ry="16" fill={locked ? '#B4CBDA' : '#4FB4E6'} />
          <ellipse cx="-4" cy="-7" rx="37" ry="13" fill={t('water').fill} />
          <ellipse cx="-18" cy="-12" rx="10" ry="2.6" fill="#fff" opacity="0.6" />
          <path d="M-30 -2 q6 -3 12 0 M0 -4 q6 -3 12 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
          {/* 연잎 리스트 (한 줄로 늘어선 0·1·2) */}
          {[-20, -6, 8].map((cx, i) => (
            <g key={i}>
              <ellipse cx={cx} cy={-8} rx="5.5" ry="2.6" fill={t('leaf').fill} />
              <circle cx={cx + 1} cy={-10} r="1.6" fill={locked ? '#E3D4D8' : '#FF8FA3'} />
            </g>
          ))}
          {/* 선착장 */}
          <Clay d={rrect(22, -14, 26, 8, 2)} tone={wood} depth={3} />
          <path d="M28 -6 v8 M42 -6 v8" stroke={wood.lip} strokeWidth="3" strokeLinecap="round" />
          <Tree x={-40} y={-18} s={0.65} locked={locked} />
        </>
      );
      break;
    }
    case 'tower': {
      const st = t('stone');
      body = (
        <>
          <ellipse cx="0" cy="4" rx="26" ry="6" fill="#1B2F45" opacity="0.16" />
          <Clay d={rrect(-18, -76, 36, 80, 10)} tone={st} depth={4} gloss={[-10, -62, 2.6, 10, 0]} glossOpacity={0.55} shade={4} />
          <Clay d="M-25 -74 L0 -112 L25 -74 Q26 -70 21 -70 H-21 Q-26 -70 -25 -74Z" tone={t('lilac')} depth={4} gloss={[-8, -88, 3, 6, 30]} glossOpacity={0.45} />
          <path d={rrect(-6, -56, 12, 16, 6)} fill={locked ? '#A8B6C6' : '#1F72B8'} />
          <path d={rrect(-6, -30, 12, 16, 6)} fill={locked ? '#A8B6C6' : '#1F72B8'} />
          <path d={rrect(-8, -8, 16, 12, 4)} fill={t('wood').lip} />
          <path d="M0 -112 V-128" stroke={t('wood').lip} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M0 -128 L16 -123 L0 -118Z" fill={t('lemon').fill} />
        </>
      );
      break;
    }
    case 'castle': {
      const st = t('stone');
      const roof = t('roof');
      body = (
        <>
          <ellipse cx="0" cy="5" rx="58" ry="8" fill="#1B2F45" opacity="0.16" />
          <Clay d={rrect(-40, -46, 80, 50, 8)} tone={st} depth={5} gloss={[-24, -36, 10, 3, 0]} glossOpacity={0.5} shade={4} />
          {[-34, -18, -2, 14, 30].map((bx) => (
            <path key={bx} d={rrect(bx - 4, -54, 12, 10, 3)} fill={st.fill} />
          ))}
          {[-48, 48].map((tx) => (
            <g key={tx} transform={`translate(${tx} 0)`}>
              <Clay d={rrect(-13, -72, 26, 76, 8)} tone={st} depth={4} shade={4} gloss={[-6, -60, 2, 8, 0]} glossOpacity={0.55} />
              <Clay d="M-18 -70 L0 -100 L18 -70Z" tone={roof} depth={3} gloss={[-5, -82, 2.4, 5, 30]} glossOpacity={0.45} />
              <path d={rrect(-4, -54, 8, 12, 4)} fill={locked ? '#A8B6C6' : '#1F72B8'} />
              <path d="M0 -100 V-112" stroke={t('wood').lip} strokeWidth="2.2" strokeLinecap="round" />
              <path d="M0 -112 L12 -108 L0 -104Z" fill={t('lemon').fill} />
            </g>
          ))}
          <Clay d="M-14 4 V-14 Q0 -30 14 -14 V4Z" tone={t('wood')} depth={0} />
          <Clay d="M-26 -58 L0 -88 L26 -58Z" tone={roof} depth={4} gloss={[-8, -70, 3, 6, 40]} glossOpacity={0.45} />
          <Ball cx={0} cy={-90} r={5} t={t('lemon')} />
        </>
      );
      break;
    }
  }
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{body}</g>;
}

// ───────────── 월드 미리보기 장면 (랜딩·월드 탭 공용, 320×200)

export function WorldScene({ world, locked = false, className }: { world: 1 | 2 | 3; locked?: boolean; className?: string }) {
  const bg = world === 1 ? '#DDF4FF' : world === 2 ? '#CFE9FF' : '#FFE6CC';
  const sea = world === 1 ? '#6CCBF5' : world === 2 ? '#7CC4F0' : '#F2A86B';
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="200" fill={bg} />
      {world === 1 && (
        <>
          <circle cx="270" cy="40" r="20" fill="#FFD84D" />
          <circle cx="270" cy="40" r="28" fill="#FFD84D" opacity="0.25" />
          <rect y="128" width="320" height="72" fill={sea} />
          <path d="M20 150 q10 -5 20 0 M120 172 q10 -5 20 0 M250 160 q10 -5 20 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
          <Island x={160} y={128} rx={110} ry={26} seed={3}>
            <Palm x={78} y={124} s={1.1} />
            <Palm x={238} y={122} s={0.9} flip />
            <Landmark kind="gate" x={150} y={128} s={0.95} />
          </Island>
          <Island x={40} y={176} rx={26} ry={8} seed={5} sandOnly />
        </>
      )}
      {world === 2 && (
        <>
          <circle cx="56" cy="44" r="18" fill="#FFE07A" />
          <rect y="150" width="320" height="50" fill={sea} />
          <path d="M30 170 q10 -5 20 0 M200 182 q10 -5 20 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
          <g className="a-amb-cloud m-ambient">
            <CloudBlob x={30} y={110} s={1.2} />
            <CloudBlob x={210} y={40} s={0.9} />
          </g>
          <FloatIsland x={110} y={100} s={1.1} />
          <FloatIsland x={232} y={128} s={0.75} />
          <Balloon x={262} y={78} />
          <Boat x={70} y={160} />
        </>
      )}
      {world === 3 && (
        <>
          <circle cx="250" cy="70" r="30" fill="#FFB067" />
          <rect y="140" width="320" height="60" fill={sea} />
          <path d="M30 160 q10 -5 20 0 M220 176 q10 -5 20 0" stroke="#FFE6CC" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
          <Island x={160} y={140} rx={128} ry={24} seed={11} sandOnly />
          <Workshop x={160} y={142} />
        </>
      )}
      {locked && <rect width="320" height="200" fill="#EEF8FF" opacity="0.35" />}
    </svg>
  );
}

function CloudBlob({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const d = 'M0 20 a12 12 0 0 1 6 -22 a17 17 0 0 1 31 -6 a14 14 0 0 1 25 8 a11 11 0 0 1 2 20 Z';
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={d} fill="#D3E6F5" transform="translate(0 4)" />
      <path d={d} fill="#fff" />
    </g>
  );
}

function FloatIsland({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-46 0 Q-30 46 0 58 Q30 46 46 0Z" fill="#C98F55" />
      <path d="M-46 0 Q-30 30 0 36 Q30 30 46 0Z" fill="#D9A066" />
      <Clay d={blob(0, -2, 48, 12, 4, 8, 0.06)} tone={tone('grass')} depth={5} gloss={[-20, -6, 10, 2.6, -6]} />
      <Tree x={-18} y={-4} s={0.7} />
      <MagicBox x={14} y={-2} s={0.6} />
    </g>
  );
}

function Balloon({ x, y }: { x: number; y: number }) {
  const c = tone('roof');
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="a-amb-bob m-ambient">
        <path d="M0 -44 C22 -44 26 -18 6 -2 H-6 C-26 -18 -22 -44 0 -44Z" fill={c.lip} transform="translate(0 3)" />
        <path d="M0 -44 C22 -44 26 -18 6 -2 H-6 C-26 -18 -22 -44 0 -44Z" fill={c.fill} />
        <path d="M0 -44 C7 -40 7 -14 2 -2 H-2 C-7 -14 -7 -40 0 -44Z" fill="#FFD84D" />
        <ellipse cx="-10" cy="-32" rx="3.4" ry="7" fill="#fff" opacity="0.45" />
        <path d="M-5 -2 L-4 6 M5 -2 L4 6" stroke="#A9703D" strokeWidth="1.4" />
        <path d={rrect(-6, 5, 12, 9, 3)} fill="#D9A066" />
      </g>
    </g>
  );
}

function Boat({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="a-amb-bob m-ambient">
        <path d="M-26 -4 H26 L18 8 H-18Z" fill="#A9703D" transform="translate(0 2)" />
        <path d="M-26 -4 H26 L18 8 H-18Z" fill="#D9A066" />
        <path d="M0 -4 V-36 L20 -10Z" fill="#fff" />
        <path d="M0 -32 L-14 -10 H0Z" fill="#FF7A6B" />
      </g>
    </g>
  );
}

function Workshop({ x, y }: { x: number; y: number }) {
  const o = tone('orange');
  const sk = tone('sky');
  const rf = tone('roof');
  const st = tone('stone');
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="2" rx="96" ry="9" fill="#1B2F45" opacity="0.14" />
      <Clay d={rrect(-78, -54, 44, 56, 8)} tone={o} depth={4} gloss={[-68, -44, 3, 9, 0]} glossOpacity={0.45} />
      <Clay d={rrect(-28, -82, 40, 84, 8)} tone={sk} depth={4} gloss={[-19, -70, 3, 12, 0]} glossOpacity={0.45} />
      <Clay d={rrect(18, -46, 54, 48, 8)} tone={rf} depth={4} gloss={[28, -36, 3, 8, 0]} glossOpacity={0.45} />
      {[-70, -54].map((wx) => (
        <path key={wx} d={rrect(wx, -40, 10, 12, 3)} fill="#FFF1B8" />
      ))}
      {[-62, -48, -34].map((wy, i) => (
        <path key={i} d={rrect(-18, wy, 20, 9, 3)} fill="#FFF1B8" />
      ))}
      <path d={rrect(30, -30, 30, 10, 3)} fill="#FFF1B8" />
      {/* 굴뚝 + 연기 */}
      <Clay d={rrect(52, -70, 10, 26, 3)} tone={st} depth={2} />
      <g className="a-amb-smoke m-ambient">
        <circle cx="57" cy="-80" r="6" fill="#fff" opacity="0.9" />
        <circle cx="64" cy="-92" r="8" fill="#fff" opacity="0.85" />
        <circle cx="74" cy="-104" r="9" fill="#fff" opacity="0.8" />
      </g>
      {/* 톱니 */}
      <g transform="translate(-92 -18)">
        <g className="a-amb-spin m-ambient">
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={rrect(-4, -22, 8, 10, 2)} fill={tone('lemon').lip} transform={`rotate(${i * 45})`} />
          ))}
          <circle r="16" fill={tone('lemon').fill} />
          <circle r="6" fill="#FFF7E8" />
        </g>
      </g>
      {/* 크레인 */}
      <path d="M90 2 V-90 H40" stroke="#5D6B7E" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M48 -90 V-70" stroke="#5D6B7E" strokeWidth="2" />
      <path d={rrect(42, -70, 12, 9, 2)} fill={tone('lemon').fill} />
    </g>
  );
}
