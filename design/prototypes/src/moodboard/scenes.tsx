// 월드별 미니 장면 (무드보드 견본). 같은 구도를 시안 스타일(A 클레이 / B 그림책 / AB 혼합)로 그린다.
// 앰비언트(구름·물결·연기)는 .m-ambient: lite부터 멈춤
import type { CSSProperties } from 'react';
import { PALETTES, type Concept } from '../shared/tokens';
import { paperGrain, paperFiber } from '../shared/textures';

const INK: Record<Concept, string | undefined> = { A: undefined, B: '#3B2F25', AB: '#24324A' };

export function WorldScene({ concept, world, label }: { concept: Concept; world: 0 | 1 | 2; label?: string }) {
  const p = PALETTES[concept];
  const ink = INK[concept];
  const sw = concept === 'B' ? 1.6 : 2;
  const ol = ink ? { stroke: ink, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const } : {};
  const gloss = concept !== 'B';
  const id = `sc${concept}${world}`;
  const filter = concept === 'B' ? `url(#${id}wob)` : concept === 'AB' ? `url(#${id}wob2)` : undefined;
  const grain: CSSProperties | undefined =
    concept === 'A' ? undefined : ({ '--grain': `${paperGrain(0.1)}, ${paperFiber('#B89B6A', 0.07)}` } as CSSProperties);

  const sky = [
    [p.w1Soft, '#FFFFFF'],
    [p.w2Soft, '#FFFFFF'],
    [p.w3Soft, concept === 'B' ? '#FBEFE0' : '#FFF4E6'],
  ][world];
  const seaTop = concept === 'B' ? '#A9CBDD' : world === 2 ? '#7CC8EA' : p.w2;
  const seaBot = concept === 'B' ? '#8DB7CF' : p.w2Ink;
  const grass = world === 2 ? (concept === 'B' ? '#B9A27A' : '#9AD27E') : p.w1;
  const grassDark = concept === 'B' ? '#6E8F52' : p.w1Ink;
  const sand = concept === 'B' ? '#E9D3A6' : '#FFE29A';
  const roof = concept === 'B' ? '#C8623F' : p.accent;

  return (
    <div className={`mb-scene mb-scene-${concept}`} style={grain}>
      <svg viewBox="0 0 320 180" role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky[0]} />
            <stop offset="1" stopColor={sky[1]} />
          </linearGradient>
          <linearGradient id={`${id}sea`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={seaTop} />
            <stop offset="1" stopColor={seaBot} stopOpacity={concept === 'B' ? 0.7 : 0.9} />
          </linearGradient>
          <filter id={`${id}wob`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={world + 2} />
            <feDisplacementMap in="SourceGraphic" scale="2.4" />
          </filter>
          <filter id={`${id}wob2`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={1} seed={world + 5} />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
        </defs>
        <rect width="320" height="180" fill={`url(#${id}sky)`} />
        {/* 해 */}
        <circle cx="270" cy="38" r="18" fill={world === 2 ? '#FFB067' : p.highlight} opacity={concept === 'B' ? 0.75 : 0.95} {...(ink ? { stroke: ink, strokeWidth: 1.2 } : {})} />
        {/* 구름 (앰비언트) */}
        <g className="mb-cloud m-ambient">
          <Cloud x={40} y={34} s={1} ink={ink} fill={concept === 'B' ? '#FFFBF2' : '#FFFFFF'} />
          <Cloud x={190} y={22} s={0.7} ink={ink} fill={concept === 'B' ? '#FFFBF2' : '#FFFFFF'} />
        </g>
        {/* 바다 */}
        <path d="M0 122 Q40 116 80 122 T160 122 T240 122 T320 122 V180 H0Z" fill={`url(#${id}sea)`} {...(ink ? { stroke: ink, strokeWidth: 1.2 } : {})} />
        <g className="mb-wave m-ambient" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7">
          <path d="M24 140 q8 -4 16 0 M110 152 q8 -4 16 0 M220 142 q8 -4 16 0 M270 160 q8 -4 16 0" />
        </g>

        <g filter={filter}>
          {world === 0 && (
            <>
              {/* 초록 섬 / 숲 마을 */}
              <ellipse cx="160" cy="128" rx="104" ry="20" fill={sand} {...ol} />
              <path d="M66 124 Q80 82 140 78 Q200 70 236 92 Q262 106 254 124 Q160 136 66 124Z" fill={grass} {...ol} />
              {gloss && <ellipse cx="120" cy="90" rx="26" ry="6" fill="#fff" opacity="0.35" transform="rotate(-8 120 90)" />}
              <path d="M66 124 Q160 136 254 124 Q250 132 240 134 Q160 144 78 134Z" fill={grassDark} opacity="0.45" />
              {concept === 'B' ? (
                <>
                  <Tree x={96} y={104} c="#8DB86B" ink={ink} round />
                  <Tree x={226} y={102} c="#77A862" ink={ink} round />
                  <Tree x={240} y={110} c="#9CCB80" ink={ink} round s={0.7} />
                </>
              ) : (
                <>
                  <Palm x={98} y={106} leaf={grassDark} ink={ink} />
                  <Palm x={232} y={104} leaf={grassDark} ink={ink} s={0.8} />
                </>
              )}
              <House x={150} y={96} roof={roof} ink={ink} gloss={gloss} />
              {/* 징검다리 길 */}
              {[0, 1, 2].map((i) => (
                <ellipse key={i} cx={40 - i * 14 + 30} cy={146 + i * 8} rx="7" ry="3" fill={sand} {...ol} />
              ))}
            </>
          )}
          {world === 1 && (
            <>
              {/* 바다·하늘 섬 / 바다 여행 */}
              {concept === 'B' ? (
                <Boat x={150} y={120} ink={ink} />
              ) : (
                <>
                  <FloatIsland x={96} y={92} s={1} grass={grass} grassDark={grassDark} ink={ink} gloss={gloss} />
                  <FloatIsland x={214} y={70} s={0.7} grass={grass} grassDark={grassDark} ink={ink} gloss={gloss} />
                  <Balloon x={262} y={92} c={p.accent} ink={ink} gloss={gloss} />
                </>
              )}
              {concept === 'B' && (
                <>
                  <path d="M40 98 q6 -10 14 0 q6 -10 14 0" stroke={ink} strokeWidth="1.4" fill="none" />
                  <path d="M230 84 q5 -8 11 0 q5 -8 11 0" stroke={ink} strokeWidth="1.4" fill="none" />
                </>
              )}
            </>
          )}
          {world === 2 && (
            <>
              {/* 메이커 시티 / 발명가의 공방 */}
              <ellipse cx="160" cy="128" rx="110" ry="18" fill={concept === 'B' ? '#D8C3A0' : '#F7C98B'} {...ol} />
              <path d="M58 126 Q70 96 120 94 L210 92 Q256 96 262 126 Q160 136 58 126Z" fill={grass} {...ol} />
              <rect x="92" y="62" width="34" height="46" rx={concept === 'B' ? 2 : 6} fill={p.w3} {...ol} />
              <rect x="132" y="48" width="28" height="60" rx={concept === 'B' ? 2 : 6} fill={concept === 'B' ? '#9C7B5B' : p.secondary} {...ol} />
              <rect x="166" y="72" width="40" height="36" rx={concept === 'B' ? 2 : 6} fill={concept === 'B' ? '#B8733A' : p.accent} {...ol} />
              {[0, 1].map((i) => (
                <rect key={i} x={98 + i * 14} y="72" width="8" height="10" rx="2" fill="#FFF1B8" {...ol} />
              ))}
              <rect x="140" y="58" width="12" height="9" rx="2" fill="#FFF1B8" {...ol} />
              <rect x="138" y="76" width="16" height="9" rx="2" fill="#FFF1B8" {...ol} />
              {gloss && <rect x="95" y="65" width="6" height="30" rx="3" fill="#fff" opacity="0.35" />}
              {/* 굴뚝 연기 (앰비언트) */}
              <rect x="190" y="52" width="8" height="22" fill={concept === 'B' ? '#6B5A45' : '#5D6B7E'} {...ol} />
              <g className="mb-smoke m-ambient" fill={concept === 'B' ? '#EADCC2' : '#FFFFFF'} opacity="0.9" {...(ink ? { stroke: ink, strokeWidth: 1 } : {})}>
                <circle cx="194" cy="44" r="5" />
                <circle cx="200" cy="34" r="7" />
                <circle cx="210" cy="24" r="8" />
              </g>
              <Gear x={238} y={92} r={18} c={concept === 'B' ? '#C98A4B' : p.highlight} ink={ink} />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

function Cloud({ x, y, s, ink, fill }: { x: number; y: number; s: number; ink?: string; fill: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 16 a10 10 0 0 1 6 -18 a14 14 0 0 1 26 -4 a11 11 0 0 1 20 8 a8 8 0 0 1 0 14Z"
      fill={fill}
      opacity="0.95"
      {...(ink ? { stroke: ink, strokeWidth: 1.4 } : {})}
    />
  );
}

function Palm({ x, y, leaf, ink, s = 1 }: { x: number; y: number; leaf: string; ink?: string; s?: number }) {
  const ol = ink ? { stroke: ink, strokeWidth: 1.6 } : {};
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 Q-3 -18 3 -36" stroke={ink ?? '#A0703F'} strokeWidth="5" fill="none" strokeLinecap="round" />
      {!ink && <path d="M0 0 Q-3 -18 3 -36" stroke="#C98F55" strokeWidth="3" fill="none" strokeLinecap="round" />}
      {ink && <path d="M0 0 Q-3 -18 3 -36" stroke="#C98F55" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      <path d="M3 -36 q-18 -8 -26 6 q12 -4 26 -6 q-6 -16 6 -22 q2 12 -6 22 q16 -10 26 0 q-14 -2 -26 0Z" fill={leaf} {...ol} />
    </g>
  );
}

function Tree({ x, y, c, ink, s = 1, round }: { x: number; y: number; c: string; ink?: string; s?: number; round?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-2.5" y="-10" width="5" height="14" fill="#8C6A4A" {...(ink ? { stroke: ink, strokeWidth: 1.4 } : {})} />
      {round ? (
        <path d="M0 -38 C14 -38 18 -24 14 -16 C20 -10 12 0 0 -6 C-12 0 -20 -10 -14 -16 C-18 -24 -14 -38 0 -38Z" fill={c} fillOpacity="0.9" {...(ink ? { stroke: ink, strokeWidth: 1.6 } : {})} />
      ) : (
        <path d="M0 -40 L14 -8 H-14Z" fill={c} />
      )}
    </g>
  );
}

function House({ x, y, roof, ink, gloss }: { x: number; y: number; roof: string; ink?: string; gloss: boolean }) {
  const ol = ink ? { stroke: ink, strokeWidth: 1.6, strokeLinejoin: 'round' as const } : {};
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-16" y="-14" width="32" height="24" rx={ink ? 2 : 5} fill="#FFF8EC" {...ol} />
      <path d="M-21 -12 L0 -30 L21 -12Z" fill={roof} {...ol} />
      <rect x="-5" y="-2" width="10" height="12" rx="2" fill="#B9845A" {...ol} />
      {gloss && <path d="M-14 -16 L-2 -26" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.5" />}
    </g>
  );
}

function FloatIsland({
  x,
  y,
  s,
  grass,
  grassDark,
  ink,
  gloss,
}: {
  x: number;
  y: number;
  s: number;
  grass: string;
  grassDark: string;
  ink?: string;
  gloss: boolean;
}) {
  const ol = ink ? { stroke: ink, strokeWidth: 1.8, strokeLinejoin: 'round' as const } : {};
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-40 0 Q0 52 40 0Z" fill="#C79A6B" {...ol} />
      <path d="M-40 0 Q-36 -14 0 -14 Q36 -14 40 0 Q0 8 -40 0Z" fill={grass} {...ol} />
      <path d="M-40 0 Q0 8 40 0 Q36 6 0 10 Q-36 6 -40 0Z" fill={grassDark} opacity="0.5" />
      {gloss && <ellipse cx="-14" cy="-8" rx="10" ry="2.6" fill="#fff" opacity="0.45" />}
    </g>
  );
}

function Balloon({ x, y, c, ink, gloss }: { x: number; y: number; c: string; ink?: string; gloss: boolean }) {
  const ol = ink ? { stroke: ink, strokeWidth: 1.6 } : {};
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="mb-balloon m-ambient">
      <path d="M0 -40 C18 -40 22 -20 6 -6 L-6 -6 C-22 -20 -18 -40 0 -40Z" fill={c} {...ol} />
      <path d="M0 -40 C6 -36 6 -14 2 -6 L-2 -6 C-6 -14 -6 -36 0 -40Z" fill="#FFF1B8" {...ol} />
      {gloss && <ellipse cx="-8" cy="-30" rx="3" ry="6" fill="#fff" opacity="0.45" />}
      <rect x="-5" y="0" width="10" height="8" rx="2" fill="#B9845A" {...ol} />
      <path d="M-5 -6 L-4 0 M5 -6 L4 0" stroke={ink ?? '#8C6A4A'} strokeWidth="1" />
      </g>
    </g>
  );
}

function Boat({ x, y, ink }: { x: number; y: number; ink?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="mb-balloon m-ambient">
      <path d="M-34 -6 L34 -6 L22 8 L-22 8Z" fill="#F1E6CF" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M-34 -6 L0 -6 L-22 8Z" fill="#E2D2B0" stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M0 -6 V-48 L26 -14 Z" fill="#FFFBF2" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M0 -44 L-20 -14 H0" fill="#D9774F" fillOpacity="0.8" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
      </g>
    </g>
  );
}

function Gear({ x, y, r, c, ink }: { x: number; y: number; r: number; c: string; ink?: string }) {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="mb-gear m-ambient">
        {teeth.map((a) => (
          <rect key={a} x={-4} y={-r - 6} width="8" height="10" rx="2" fill={c} transform={`rotate(${a})`} {...(ink ? { stroke: ink, strokeWidth: 1.4 } : {})} />
        ))}
        <circle r={r} fill={c} {...(ink ? { stroke: ink, strokeWidth: 1.6 } : {})} />
        <circle r={r * 0.38} fill="#FFF8EC" {...(ink ? { stroke: ink, strokeWidth: 1.4 } : {})} />
      </g>
    </g>
  );
}
