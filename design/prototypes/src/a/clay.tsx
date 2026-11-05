// 시안 A "클레이 느낌" 도형 규칙 (§6 리스크 대응: 3D 에셋 없이 코드로).
// 진짜 3D 렌더 대신 아래 다섯 규칙만 조합한다. 그라디언트·필터·흐림을 쓰지 않아 렌더 비용이 낮다(P0-07).
//
//   ① 몸(Body)   단색 채움 하나. 외곽선 없음
//   ② 두께(Lip)  같은 모양을 아래로 depth만큼 밀어 같은 색 계열 진한 색으로 깐다 → 두툼한 아랫면
//   ③ 광택(Gloss) 왼쪽 위 흰 타원 1개, 불투명도 0.38 (큰 면에만)
//   ④ 그늘(Shade) 아래쪽 안쪽에 진한 색 초승달, 불투명도 0.18 → 둥근 면처럼 보임 (선택)
//   ⑤ 접지(Ground) 바닥 아래 남색 16% 타원 → 바닥에 놓인 느낌
//
// 버튼·카드(HTML)도 같은 규칙을 CSS로: 단색 배경 + box-shadow 아랫면 + ::before 광택 (a.css "클레이 규칙").
import type { ReactNode, SVGProps } from 'react';

export interface Tone {
  fill: string;
  lip: string;
}

/** 시안 A 클레이 색 (장식 전용: 글자를 얹지 않는다). 몸색 + 아랫면색 짝 */
export const CLAY = {
  grass: { fill: '#5CCB72', lip: '#38A356' },
  leaf: { fill: '#3FB565', lip: '#23894A' },
  mint: { fill: '#7FE0C4', lip: '#3FB99A' },
  sand: { fill: '#FFDE8F', lip: '#E8AE5A' },
  rock: { fill: '#B9C7D8', lip: '#8496AE' },
  stone: { fill: '#E3EAF2', lip: '#A9B8CA' },
  wood: { fill: '#D9A066', lip: '#A9703D' },
  roof: { fill: '#FF7A6B', lip: '#D9544A' },
  lemon: { fill: '#FFD84D', lip: '#E0A91C' },
  sky: { fill: '#6CC4F2', lip: '#3E97CF' },
  lilac: { fill: '#B9A3FF', lip: '#8A6FE0' },
  cloud: { fill: '#FFFFFF', lip: '#D3E6F5' },
  cream: { fill: '#FFF7E8', lip: '#E9D2AE' },
  orange: { fill: '#FF9E3D', lip: '#D9741A' },
  water: { fill: '#8FDCFF', lip: '#5BBDE9' },
} satisfies Record<string, Tone>;
export type ClayName = keyof typeof CLAY;

const GROUND = '#1B2F45';

/** 두 색 섞기 (t=0 → a, 1 → b) */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** 잠긴 곳: 하늘 안개 색으로 60% 섞어 채도를 뺀다 (필터 없이 색만 바꿈) */
export function muted(t: Tone, on: boolean): Tone {
  return on ? { fill: mix(t.fill, '#D5E2EE', 0.62), lip: mix(t.lip, '#AFC1D3', 0.62) } : t;
}

export function tone(name: ClayName, locked = false): Tone {
  return muted(CLAY[name], locked);
}

// ───────────── 도형 생성

/** 말랑한 덩어리 윤곽 (Catmull-Rom → 베지어, 닫힌 경로). seed로 모양이 정해진다 */
export function blob(cx: number, cy: number, rx: number, ry: number, seed = 1, n = 8, jitter = 0.1): string {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rnd() - 0.5) * 2 * jitter;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

/** 둥근 사각형 경로 */
export function rrect(x: number, y: number, w: number, h: number, r: number): string {
  const q = Math.min(r, w / 2, h / 2);
  return `M${x + q} ${y}H${x + w - q}Q${x + w} ${y} ${x + w} ${y + q}V${y + h - q}Q${x + w} ${y + h} ${x + w - q} ${y + h}H${x + q}Q${x} ${y + h} ${x} ${y + h - q}V${y + q}Q${x} ${y} ${x + q} ${y}Z`;
}

// ───────────── 규칙 ①~⑤를 한 번에

export interface ClayProps {
  /** 몸 윤곽 */
  d: string;
  tone: Tone;
  /** ② 두께 (px, viewBox 단위). 0이면 없음 */
  depth?: number;
  /** ③ 광택 타원 [cx, cy, rx, ry, 회전°]. 생략하면 없음 */
  gloss?: [number, number, number, number, number?];
  glossOpacity?: number;
  /** ④ 그늘: 몸을 위로 shade만큼 밀어 잘라낸 아래 초승달 */
  shade?: number;
  /** ⑤ 접지 타원 [cx, cy, rx, ry] */
  ground?: [number, number, number, number];
  className?: string;
  children?: ReactNode;
}

export function Clay({ d, tone: t, depth = 0, gloss, glossOpacity = 0.38, shade, ground, className, children }: ClayProps) {
  // 그늘은 clipPath 없이: 진한 색 몸을 깔고 위에 몸을 shade만큼 올려 덮는다 (아래 가장자리만 진하게 남음)
  return (
    <g className={className}>
      {ground && <ellipse cx={ground[0]} cy={ground[1]} rx={ground[2]} ry={ground[3]} fill={GROUND} opacity={0.16} />}
      {depth > 0 && <path d={d} fill={t.lip} transform={`translate(0 ${depth})`} />}
      {shade ? (
        <>
          <path d={d} fill={mix(t.fill, t.lip, 0.55)} />
          <path d={d} fill={t.fill} transform={`translate(0 ${-shade})`} />
        </>
      ) : (
        <path d={d} fill={t.fill} />
      )}
      {gloss && (
        <ellipse
          cx={gloss[0]}
          cy={gloss[1]}
          rx={gloss[2]}
          ry={gloss[3]}
          transform={gloss[4] ? `rotate(${gloss[4]} ${gloss[0]} ${gloss[1]})` : undefined}
          fill="#fff"
          opacity={glossOpacity}
        />
      )}
      {children}
    </g>
  );
}

/** 작은 장식용 동그라미 (몸 + 아랫면 + 점 광택) */
export function Ball({ cx, cy, r, t, gloss = true }: { cx: number; cy: number; r: number; t: Tone; gloss?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy + r * 0.18} r={r} fill={t.lip} />
      <circle cx={cx} cy={cy} r={r} fill={t.fill} />
      {gloss && <ellipse cx={cx - r * 0.38} cy={cy - r * 0.42} rx={r * 0.32} ry={r * 0.18} transform={`rotate(-30 ${cx - r * 0.38} ${cy - r * 0.42})`} fill="#fff" opacity={0.5} />}
    </g>
  );
}

/** 클레이 구름 (몸 + 아랫면, 광택 없음) */
export function CloudShape({ w = 120, lip = true, ...rest }: { w?: number; lip?: boolean } & SVGProps<SVGSVGElement>) {
  const h = w * 0.46;
  const d = 'M14 48 a16 16 0 0 1 8 -30 a22 22 0 0 1 40 -8 a18 18 0 0 1 32 10 a14 14 0 0 1 4 28 Z';
  return (
    <svg viewBox="0 0 112 56" width={w} height={h} aria-hidden {...rest}>
      {lip && <path d={d} fill={CLAY.cloud.lip} transform="translate(0 5)" />}
      <path d={d} fill="#fff" />
      <ellipse cx="40" cy="20" rx="10" ry="4" fill={CLAY.cloud.lip} opacity="0.35" transform="rotate(-12 40 20)" />
    </svg>
  );
}
