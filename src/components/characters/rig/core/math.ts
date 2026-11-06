/** 리그 공용 수학 도구 (DOM·React 없음) */

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

export function smooth(e0: number, e1: number, v: number): number {
  const t = clamp((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 소수 자릿수 고정 문자열 (SVG 속성). 같은 값이면 같은 문자열이라 DOM 쓰기를 건너뛸 수 있다 */
export const n1 = (v: number) => String(Math.round(v * 10) / 10);
export const n2 = (v: number) => String(Math.round(v * 100) / 100);
export const n3 = (v: number) => String(Math.round(v * 1000) / 1000);
export const pt = (x: number, y: number) => `${n2(x)} ${n2(y)}`;

/** 시드가 있는 난수 (테스트·프레임 스트립이 재현되게) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 감쇠 스프링 하나 (질량 1). 2차 움직임(늦게 따라오기·출렁임)에 쓴다 */
export class Follower {
  x: number;
  v = 0;
  constructor(
    x: number,
    public k: number,
    public c: number,
  ) {
    this.x = x;
  }
  step(target: number, dt: number): number {
    const a = this.k * (target - this.x) - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
  reset(x: number) {
    this.x = x;
    this.v = 0;
  }
}

/** 점프 한 번의 모양: 준비(찌그러짐) → 공중(늘어남) → 착지(찌그러짐). u = 0..1, H = 높이 */
export function hopShape(
  u: number,
  H: number,
): { y: number; sx: number; sy: number } {
  const A = 0.18;
  const L = 0.78;
  const k = Math.min(1.3, H / 16);
  if (u < A) {
    const s = Math.sin((Math.PI * u) / A);
    return { y: 0, sx: 0.12 * s * k, sy: -0.15 * s * k };
  }
  if (u < L) {
    const a = (u - A) / (L - A);
    const v = Math.cos(Math.PI * a);
    const st = 0.1 * Math.abs(v) * k;
    return { y: -H * Math.sin(Math.PI * a), sx: -0.7 * st, sy: st };
  }
  const s = Math.sin((Math.PI * (u - L)) / (1 - L));
  return { y: 0, sx: 0.15 * s * k, sy: -0.18 * s * k };
}

/** 0..1 → 0..1 감속 */
export const easeOutCubic = (u: number) => 1 - Math.pow(1 - clamp(u), 3);
export const easeInOutSine = (u: number) =>
  0.5 - 0.5 * Math.cos(Math.PI * clamp(u));
