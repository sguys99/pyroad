// (P2-01) spikes/p0-07-mascot-animation/src/rig에서 프로토타입용으로 복사·정리. 앱 이식은 P2-13
// 파라미터 → SVG 속성 (순수 함수).
// 같은 함수를 ① 클라이언트 매 프레임 갱신 ② SSR 첫 렌더 ③ 공유 카드·아바타 정적 렌더에 그대로 쓴다.
import type { Params } from './params';

export type Attrs = Record<string, string>;
export type Geo = Record<string, Attrs>;

const n1 = (v: number) => String(Math.round(v * 10) / 10);
const n2 = (v: number) => String(Math.round(v * 100) / 100);
const n3 = (v: number) => String(Math.round(v * 1000) / 1000);
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (e0: number, e1: number, v: number) => {
  const t = clamp((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const pt = (x: number, y: number) => `${n2(x)} ${n2(y)}`;

// 꼬리 키 모양 (base, c1, c2, mid, c3, c4, tip)
const TAIL_REST = [28, 84, 16, 76, 10, 62, 18, 52, 24, 44, 34, 46, 32, 54];
const TAIL_RAISED = [28, 84, 14, 74, 6, 54, 10, 38, 13, 28, 20, 21, 27, 20];
const TAIL_CHIN = [28, 84, 18, 80, 18, 68, 27, 63, 33, 59, 39, 60, 42, 58];
const TAIL_DROOP = [28, 84, 20, 94, 16, 102, 9, 105, 4, 108, -1, 107, -1, 102];

export const SPARK_POS = [
  [20, 14],
  [108, 10],
  [8, 46],
  [119, 42],
];
export const NOTE_POS = [
  [102, 44],
  [114, 30],
];

export function geometry(p: Params, opts: { haloColor?: string } = {}): Geo {
  const g: Geo = {};

  // ── 몸 전체: 위치·기울기·찌그러짐(바닥 피벗)
  g.root = {
    transform: `translate(${n2(p.rootX)} ${n2(p.rootY)}) rotate(${n2(p.rootRot)} 64 108) translate(64 108) scale(${n3(p.sqX)} ${n3(p.sqY)}) translate(-64 -108)`,
  };
  const lift = clamp(-p.rootY / 28);
  g.shadow = {
    cx: n2(64 + p.rootX),
    rx: n2(36 * (1 - 0.38 * lift) * p.sqX),
    opacity: n3(0.2 * (1 - 0.55 * lift)),
  };
  g.halo = { opacity: n3(clamp(p.halo) * 0.55), fill: opts.haloColor ?? '#C8E6C9' };

  // ── 꼬리 (블렌드 셰이프 + 회전)
  const tp = tailPts(p);
  g.tail = {
    d: `M${pt(tp[0], tp[1])} C${pt(tp[2], tp[3])} ${pt(tp[4], tp[5])} ${pt(tp[6], tp[7])} C${pt(tp[8], tp[9])} ${pt(tp[10], tp[11])} ${pt(tp[12], tp[13])}`,
  };
  g.tailIn = g.tail;
  g.tailTip = { cx: n2(tp[12]), cy: n2(tp[13]) };

  // ── 머리·얼굴
  g.head = { transform: `translate(${n2(p.headX)} ${n2(p.headY)}) rotate(${n2(p.headRot)} 64 66)` };
  g.face = { transform: `translate(${n2(p.faceX)} ${n2(p.faceY)})` };
  g.cheekL = {
    rx: n2(6 + 1.3 * p.blush),
    ry: n2(4 + 0.7 * p.blush),
    cy: n2(50 + 0.8 * p.eyeHappy),
    opacity: n3(0.36 + 0.38 * clamp(p.blush)),
  };
  g.cheekR = { ...g.cheekL };

  for (const side of ['L', 'R'] as const) {
    const e = eyeNums(p, side);
    g[`eye${side}`] = { cx: n2(e.cx), cy: n2(e.cy), rx: n2(e.rx), ry: n2(e.ry), opacity: n3(e.op) };
    g[`hl${side}`] = { cx: n2(e.hx), cy: n2(e.hy), r: n2(e.hr), opacity: n3(e.hop) };
    g[`arc${side}`] = {
      d: `M${pt(e.ax - 5.2, 41)} Q${pt(e.ax, 35.2)} ${pt(e.ax + 5.2, 41)}`,
      opacity: n3(e.aop),
    };
    // 처진 눈꺼풀 (바깥쪽이 더 내려옴) → clipPath 다각형
    g[`clip${side}`] = {
      points: e.clip.map(([x, y]) => `${n2(x)},${n2(y)}`).join(' '),
    };
    const b = browNums(p, side);
    g[`brow${side}`] = { d: `M${pt(b.ox, b.oy)} Q${pt(b.qx, b.qy)} ${pt(b.ix, b.iy)}`, opacity: n3(b.op) };
  }

  // ── 입 (위·아래 입술 곡선 2개로 된 닫힌 도형: 웃음선 ↔ 벌린 입 ↔ o 입 ↔ 시무룩)
  const m = mouthNums(p);
  const mouthD = `M${pt(m.L[0], m.L[1])} C${pt(m.c1[0], m.c1[1])} ${pt(m.c2[0], m.c2[1])} ${pt(m.R[0], m.R[1])} C${pt(m.c3[0], m.c3[1])} ${pt(m.c4[0], m.c4[1])} ${pt(m.L[0], m.L[1])}Z`;
  g.mouth = { d: mouthD };
  g.mouthClip = { d: mouthD };
  g.tongue = { cx: n2(m.tx), cy: n2(m.ty), rx: n2(m.trx), ry: n2(m.try_), opacity: n3(m.top) };

  // ── 소품: 반짝이
  SPARK_POS.forEach(([x, y], i) => {
    const tw = 0.62 + 0.38 * Math.sin(2 * Math.PI * (p.sparkPhase + i / 4));
    const sc = Math.max(0, p.spark) * tw;
    g[`spark${i}`] = {
      transform: `translate(${x} ${y}) rotate(${n1(p.sparkPhase * 90 + i * 22)}) scale(${n3(sc)})`,
      opacity: n3(clamp(p.spark * 1.6)),
    };
  });
  // ── 소품: 생각 풍선 (작은 방울 → 큰 구름 순서로 톡톡)
  const th = Math.max(0, p.think);
  const s0 = clamp(th * 3, 0, 1.3);
  const s1 = clamp(th * 3 - 1, 0, 1.3);
  const s2 = clamp(th * 3 - 2, 0, 1.3);
  g.bub0 = { transform: `translate(91 22) scale(${n3(s0)})`, opacity: n3(clamp(s0 * 2)) };
  g.bub1 = { transform: `translate(99 11) scale(${n3(s1)})`, opacity: n3(clamp(s1 * 2)) };
  g.cloud = { transform: `translate(116 -8) scale(${n3(s2)})`, opacity: n3(clamp(s2 * 2)) };
  for (let i = 0; i < 3; i++) {
    g[`dot${i}`] = { opacity: n3(0.25 + 0.75 * Math.max(0, Math.sin(2 * Math.PI * (p.dotsPhase - i / 3)))) };
  }
  // ── 소품: 음표
  NOTE_POS.forEach(([x, y], i) => {
    const ph = (((p.notesPhase + i * 0.5) % 1) + 1) % 1;
    const dx = Math.sin(ph * 2 * Math.PI) * 4;
    const dy = -ph * 26;
    g[`note${i}`] = {
      transform: `translate(${n2(x + dx)} ${n2(y + dy)}) rotate(${n1(Math.sin(ph * 2 * Math.PI) * 12)})`,
      opacity: n3(clamp(p.notes) * Math.sin(Math.PI * ph)),
    };
  });
  // ── 소품: 눈물
  const tph = p.tearPhase % 1;
  const tearVis = clamp(p.tear) * (tph < 0.08 ? tph / 0.08 : tph > 0.82 ? (1 - tph) / 0.18 : 1);
  g.tear = {
    transform: `translate(${n2(46.5 - tph * 1.5 + p.lookX * 1.5)} ${n2(45.5 + 12 * Math.pow(tph, 1.6))}) scale(${n3(0.55 + 0.45 * Math.min(1, tph * 3))})`,
    opacity: n3(tearVis),
  };

  // ── 코스튬: 모자(머리 기준 + 흔들림), 망토 자락
  g.hat = { transform: `rotate(${n2(p.hatRot)} 64 24)` };
  const sw = p.capeSwing;
  g.cape = {
    d: `M44 58 C32 60 20 74 ${pt(13 + sw * 0.6, 103)} Q${pt(24 + sw, 99 + Math.abs(sw) * 0.3)} ${pt(34 + sw, 106)} Q${pt(44 + sw, 100)} ${pt(54 + sw * 0.8, 104)} L${pt(74 + sw * 0.8, 104)} Q${pt(84 + sw, 100)} ${pt(94 + sw, 106)} Q${pt(104 + sw, 99 + Math.abs(sw) * 0.3)} ${pt(115 + sw * 0.6, 103)} C108 74 96 60 84 58Z`,
  };
  g.boil = { seed: String(Math.floor(p.boilSeed)) };
  return g;
}

// ───────── 숫자 기하 (SVG 문자열 없이). Lottie 굽기도 이 함수를 그대로 쓴다
export function tailPts(p: Params): number[] {
  const tail = TAIL_REST.map(
    (v, i) =>
      v + p.tailRaise * (TAIL_RAISED[i] - v) + p.tailChin * (TAIL_CHIN[i] - v) + p.tailDroop * (TAIL_DROOP[i] - v),
  );
  const ang = (p.tailRot * Math.PI) / 180;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const bx = tail[0];
  const by = tail[1];
  const tp: number[] = [];
  for (let i = 0; i < tail.length; i += 2) {
    const dx = tail[i] - bx;
    const dy = tail[i + 1] - by;
    tp.push(bx + dx * ca - dy * sa, by + dx * sa + dy * ca);
  }
  return tp;
}

export function eyeNums(p: Params, side: 'L' | 'R') {
  const happy = clamp(p.eyeHappy);
  const open = clamp(p.eyeOpen, 0, 1.2);
  const ex = side === 'L' ? 52 : 76;
  const ey = 40;
  const s = p.eyeScale;
  const rx = 5 * s * (1 + 0.08 * happy);
  const ry = Math.max(0.35, 5.5 * s * open * (1 - 0.9 * happy));
  const cx = ex + p.lookX * 2.2;
  const cy = ey + p.lookY * 1.8 + 1.2 * happy;
  const outer = side === 'L' ? ex - 9 : ex + 9;
  const inner = side === 'L' ? ex + 9 : ex - 9;
  const top = cy - 7 * s;
  return {
    cx, cy, rx, ry,
    op: 1 - smooth(0.7, 1, happy),
    hx: cx + 1.6 * s,
    hy: cy - 1.7 * s * Math.min(1, open),
    hr: 2 * s,
    hop: clamp((ry - 1.4) / 2) * (1 - happy),
    ax: ex + p.lookX * 1.2,
    aop: smooth(0.3, 0.8, happy),
    clip: [
      [outer, top + p.lidSad * 6],
      [inner, top + p.lidSad * 2],
      [inner, cy + 9],
      [outer, cy + 9],
    ] as [number, number][],
  };
}

export function browNums(p: Params, side: 'L' | 'R') {
  const ex = side === 'L' ? 52 : 76;
  const raise = side === 'R' ? p.browRaiseR * 3.4 : 0;
  const byy = 30.5 + p.browY - raise + p.lookY * 0.5;
  const ox = side === 'L' ? ex - 5 : ex + 5;
  const ix = side === 'L' ? ex + 5 : ex - 5;
  const oy = byy + p.browSad * 1.2;
  const iy = byy - p.browSad * 3.4;
  return { ox, oy, ix, iy, qx: ex, qy: Math.min(oy, iy) - 1.6 - raise * 0.25, op: clamp(p.browOp) };
}

export function mouthNums(p: Params) {
  const round = clamp(p.mouthRound);
  const o = clamp(p.mouthOpen, 0, 1.3);
  const sm = p.mouthSmile;
  const mx = 64 + p.mouthX + p.lookX * 0.8;
  const my = 53 + p.lookY * 0.6;
  const hw = 8 * p.mouthWidth * (1 - 0.55 * round);
  const cy0 = my - sm * 2.4 * (1 - round);
  const up = sm * 5.3 * (1 - round) - round * 1.2 * hw;
  const lo = up + 0.8 + o * 11 * (1 - 0.35 * round) + round * 2.4 * hw;
  return {
    L: [mx - hw, cy0],
    R: [mx + hw, cy0],
    c1: [mx - hw * 0.55, cy0 + up],
    c2: [mx + hw * 0.55, cy0 + up],
    c3: [mx + hw * 0.6, cy0 + lo],
    c4: [mx - hw * 0.6, cy0 + lo],
    tx: mx,
    ty: cy0 + 0.75 * lo - 0.6,
    trx: hw * 0.55,
    try_: 2.8 * Math.min(1, o),
    top: smooth(0.12, 0.4, o) * (1 - 0.7 * round),
  };
}

/** 이전 값과 달라진 속성만 DOM에 쓴다 */
export function applyGeo(
  els: Record<string, Element | null | undefined>,
  next: Geo,
  prev: Geo | null,
): number {
  let writes = 0;
  for (const key in next) {
    const el = els[key];
    if (!el) continue;
    const a = next[key];
    const b = prev?.[key];
    for (const attr in a) {
      if (!b || b[attr] !== a[attr]) {
        el.setAttribute(attr, a[attr]);
        writes++;
      }
    }
  }
  return writes;
}
