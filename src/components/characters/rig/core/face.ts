/**
 * 세 캐릭터가 함께 쓰는 얼굴 기하 (입·눈썹). 같은 파라미터(mouthOpen·mouthSmile·browSad…)가
 * 같은 모양을 만들어 표정 규칙이 같게 보인다 (P0-07 §6.2). 숫자만 돌려주고 SVG 문자열은 캐릭터 geometry가 만든다.
 */
import { clamp, pt, smooth } from './math';
import type { Params } from './types';

export interface MouthAnchor {
  /** 입 가운데 */
  x: number;
  y: number;
  /** 반폭 (파이뱀 8) */
  w: number;
}

export function mouthNums(p: Params, a: MouthAnchor) {
  const s = a.w / 8;
  const round = clamp(p.mouthRound);
  const o = clamp(p.mouthOpen, 0, 1.3);
  const sm = p.mouthSmile;
  const tilt = p.mouthTilt ?? 0;
  const mx = a.x + p.mouthX * s + p.lookX * 0.8;
  const my = a.y + p.lookY * 0.6;
  const hw = a.w * p.mouthWidth * (1 - 0.55 * round);
  const cy0 = my - sm * 2.4 * s * (1 - round);
  const up = sm * 5.3 * s * (1 - round) - round * 1.2 * hw;
  const lo = up + 0.8 * s + o * 11 * s * (1 - 0.35 * round) + round * 2.4 * hw;
  const ly = cy0 + tilt * 2.2 * s;
  const ry = cy0 - tilt * 2.2 * s;
  return {
    L: [mx - hw, ly],
    R: [mx + hw, ry],
    c1: [mx - hw * 0.55, cy0 + up],
    c2: [mx + hw * 0.55, cy0 + up],
    c3: [mx + hw * 0.6, cy0 + lo],
    c4: [mx - hw * 0.6, cy0 + lo],
    tx: mx,
    ty: cy0 + 0.75 * lo - 0.6 * s,
    trx: hw * 0.55,
    try_: 2.8 * s * Math.min(1, o),
    top: smooth(0.12, 0.4, o) * (1 - 0.7 * round),
  };
}

/** 위·아래 입술 곡선 2개로 된 닫힌 도형: 웃음선 ↔ 벌린 입 ↔ o 입 ↔ 시무룩 */
export function mouthPath(m: ReturnType<typeof mouthNums>): string {
  return `M${pt(m.L[0], m.L[1])} C${pt(m.c1[0], m.c1[1])} ${pt(m.c2[0], m.c2[1])} ${pt(m.R[0], m.R[1])} C${pt(m.c3[0], m.c3[1])} ${pt(m.c4[0], m.c4[1])} ${pt(m.L[0], m.L[1])}Z`;
}

export interface BrowAnchor {
  /** 왼쪽·오른쪽 눈 x */
  lx: number;
  rx: number;
  /** 눈썹 기준 y */
  y: number;
  /** 반폭 */
  w: number;
}

export function browNums(p: Params, side: 'L' | 'R', a: BrowAnchor) {
  const ex = side === 'L' ? a.lx : a.rx;
  const raise = side === 'R' ? (p.browRaiseR ?? 0) * 3.4 : 0;
  const angry = p.browAngry ?? 0;
  const byy = a.y + p.browY - raise + p.lookY * 0.5;
  const ox = side === 'L' ? ex - a.w : ex + a.w;
  const ix = side === 'L' ? ex + a.w : ex - a.w;
  // 슬픔: 안쪽이 올라감 · 장난(버그버그 공격): 안쪽이 내려감
  const oy = byy + p.browSad * 1.2 - angry * 1.4;
  const iy = byy - p.browSad * 3.4 + angry * 2.6;
  return {
    ox,
    oy,
    ix,
    iy,
    qx: ex,
    qy: Math.min(oy, iy) - 1.6 - raise * 0.25,
    op: clamp(p.browOp),
  };
}

export function browPath(b: ReturnType<typeof browNums>): string {
  return `M${pt(b.ox, b.oy)} Q${pt(b.qx, b.qy)} ${pt(b.ix, b.iy)}`;
}

/** 5각 별 (둥근 끝). 별 눈·반짝이·별똥이 몸에 쓴다 */
export function starPath(
  cx: number,
  cy: number,
  R: number,
  r: number,
  round = 0.18,
  rot = -90,
): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = ((rot + i * 36) * Math.PI) / 180;
    const rr = i % 2 ? r : R;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  // 각 꼭짓점을 이웃 쪽으로 round만큼 잘라 2차 곡선으로 둥글게
  let d = '';
  for (let i = 0; i < 10; i++) {
    const [px, py] = pts[(i + 9) % 10];
    const [x, y] = pts[i];
    const [nx, ny] = pts[(i + 1) % 10];
    const k = i % 2 ? round * 0.6 : round;
    const ax = x + (px - x) * k;
    const ay = y + (py - y) * k;
    const bx = x + (nx - x) * k;
    const by = y + (ny - y) * k;
    d += `${i ? 'L' : 'M'}${pt(ax, ay)} Q${pt(x, y)} ${pt(bx, by)} `;
  }
  return d + 'Z';
}
