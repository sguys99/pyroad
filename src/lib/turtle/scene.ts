/**
 * turtle 명령 스트림 → 의미 단위 "op"로 바꾸는 순수 리듀서 (P0-06 스파이크 → P11-02).
 * 렌더러(TurtleCanvas)와 그림 검사기(P11-05)·대체 글(describeDrawing)이 같은 해석을 쓰도록 DOM 없이 작성.
 *
 * 명령 형식 (shim public/workers/turtle.py가 내보냄, 숫자는 소수 둘째 자리까지):
 *   ['n', id, state]            새 거북이. state = {x,y,h,d,pc,fc,w,sp,v,sh,sz}
 *   ['m', id, x, y]             이동 (펜이 내려가 있으면 선)
 *   ['j', id, x, y, h?]         순간 이동 (선 없음, 애니메이션 없음)
 *   ['r', id, delta, h, 0?]     회전 (반시계 +, 최종 방향 h). 끝에 0이면 즉시 회전 (circle 안)
 *   ['s', id, {...}]            상태 변경 (state 키 일부)
 *   ['bf', id] / ['ef', id]     채우기 시작 / 끝
 *   ['d', id, size, color]      점
 *   ['sp', id, stampId]         도장
 *   ['cs', id, stampId]         도장 지우기
 *   ['w', id, text, align, family, size, style]   글씨 (펜 색)
 *   ['c', id]                   이 거북이 그림 지우기
 *   ['C']                       화면 전체 지우기
 *   ['bg', color]  ['tr', 0|1]  ['u']  ['v', w, h]  ['t', title]
 */

export type TurtleCommand = unknown[];

export interface TurtleState {
  id: number;
  x: number;
  y: number;
  /** 방향 (도, 0 = 동쪽, 반시계 +) */
  h: number;
  /** 펜이 내려가 있는지 (1/0) */
  d: number;
  /** 펜 색 · 채우기 색 (CSS 색) */
  pc: string;
  fc: string;
  /** 펜 굵기 */
  w: number;
  /** speed 0~10 (0 = 즉시) */
  sp: number;
  /** 보이는지 (1/0) */
  v: number;
  /** 모양: classic(기본, 화면에서는 거북이) · turtle · arrow · circle · square · triangle · blank · pybaem */
  sh: string;
  sz: number[];
  fill: null | { points: number[][] };
}

export type TurtleOp =
  | { k: 'new'; t: TurtleState }
  | {
      k: 'move';
      t: TurtleState;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      draw: boolean;
      color: string;
      width: number;
      speed: number;
    }
  | {
      k: 'jump';
      t: TurtleState;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      h0: number;
      h1: number;
    }
  | {
      k: 'turn';
      t: TurtleState;
      h0: number;
      delta: number;
      h1: number;
      speed: number;
    }
  | { k: 'state'; t: TurtleState; changed: Record<string, unknown> }
  | { k: 'beginFill'; t: TurtleState; restart: boolean }
  | {
      k: 'endFill';
      t: TurtleState;
      points: number[][] | null;
      color: string;
    }
  | {
      k: 'dot';
      t: TurtleState;
      x: number;
      y: number;
      size: number;
      color: string;
    }
  | {
      k: 'stamp';
      t: TurtleState;
      sid: number;
      x: number;
      y: number;
      h: number;
      shape: string;
      pc: string;
      fc: string;
      sz: number[];
    }
  | { k: 'clearStamp'; t: TurtleState; sid: number }
  | {
      k: 'text';
      t: TurtleState;
      x: number;
      y: number;
      text: string;
      align: string;
      family: string;
      size: number;
      style: string;
      color: string;
    }
  | { k: 'clear'; t: TurtleState }
  | { k: 'clearScreen' }
  | { k: 'bg'; color: string }
  | { k: 'tracer'; n: number }
  | { k: 'update' }
  | { k: 'view'; w: number; h: number }
  | { k: 'title'; text: string }
  | { k: 'unknown'; c: TurtleCommand };

const num = (v: unknown) => Number(v);
const str = (v: unknown) => String(v);

export class Scene {
  turtles = new Map<number, TurtleState>();
  bg: string | null = null;
  tracer = 1;
  view: { w: number; h: number } | null = null;
  title: string | null = null;

  reset() {
    this.turtles = new Map();
    this.bg = null;
    this.tracer = 1;
    this.view = null;
    this.title = null;
  }

  turtle(id: unknown): TurtleState {
    const t = this.turtles.get(num(id));
    if (!t) throw new Error(`unknown turtle ${String(id)}`);
    return t;
  }

  /** 명령 하나를 적용하고, 그 의미(op)를 돌려준다 */
  apply(c: TurtleCommand): TurtleOp {
    switch (c[0]) {
      case 'n': {
        const s = c[2] as Omit<TurtleState, 'id' | 'fill'>;
        const t: TurtleState = {
          id: num(c[1]),
          x: s.x,
          y: s.y,
          h: s.h,
          d: s.d,
          pc: s.pc,
          fc: s.fc,
          w: s.w,
          sp: s.sp,
          v: s.v,
          sh: s.sh,
          sz: s.sz || [1, 1, 1],
          fill: null,
        };
        this.turtles.set(t.id, t);
        return { k: 'new', t };
      }
      case 'm': {
        const t = this.turtle(c[1]);
        const x0 = t.x;
        const y0 = t.y;
        t.x = num(c[2]);
        t.y = num(c[3]);
        if (t.fill) t.fill.points.push([t.x, t.y]);
        return {
          k: 'move',
          t,
          x0,
          y0,
          x1: t.x,
          y1: t.y,
          draw: !!t.d,
          color: t.pc,
          width: t.w,
          speed: this.tracer ? t.sp : 0,
        };
      }
      case 'j': {
        const t = this.turtle(c[1]);
        const x0 = t.x;
        const y0 = t.y;
        const h0 = t.h;
        t.x = num(c[2]);
        t.y = num(c[3]);
        if (c.length > 4) t.h = num(c[4]);
        if (t.fill) t.fill.points.push([t.x, t.y]);
        return { k: 'jump', t, x0, y0, x1: t.x, y1: t.y, h0, h1: t.h };
      }
      case 'r': {
        const t = this.turtle(c[1]);
        const h0 = t.h;
        t.h = num(c[3]);
        const instant = c.length > 4 && c[4] === 0;
        return {
          k: 'turn',
          t,
          h0,
          delta: num(c[2]),
          h1: t.h,
          speed: instant || !this.tracer ? 0 : t.sp,
        };
      }
      case 's': {
        const t = this.turtle(c[1]);
        const ch = c[2] as Record<string, unknown>;
        for (const key of Object.keys(ch)) {
          if (key === 'x' || key === 'y' || key === 'h') continue; // reset()은 'j'로 이동
          (t as unknown as Record<string, unknown>)[key] = ch[key];
        }
        return { k: 'state', t, changed: ch };
      }
      case 'bf': {
        const t = this.turtle(c[1]);
        const restart = !!t.fill;
        t.fill = { points: [[t.x, t.y]] };
        return { k: 'beginFill', t, restart };
      }
      case 'ef': {
        const t = this.turtle(c[1]);
        const pts = t.fill ? t.fill.points : null;
        t.fill = null;
        return {
          k: 'endFill',
          t,
          points: pts && pts.length > 2 ? pts : null,
          color: t.fc,
        };
      }
      case 'd': {
        const t = this.turtle(c[1]);
        return {
          k: 'dot',
          t,
          x: t.x,
          y: t.y,
          size: num(c[2]),
          color: str(c[3]),
        };
      }
      case 'sp': {
        const t = this.turtle(c[1]);
        return {
          k: 'stamp',
          t,
          sid: num(c[2]),
          x: t.x,
          y: t.y,
          h: t.h,
          shape: t.sh,
          pc: t.pc,
          fc: t.fc,
          sz: t.sz.slice(),
        };
      }
      case 'cs':
        return { k: 'clearStamp', t: this.turtle(c[1]), sid: num(c[2]) };
      case 'w': {
        const t = this.turtle(c[1]);
        return {
          k: 'text',
          t,
          x: t.x,
          y: t.y,
          text: str(c[2]),
          align: str(c[3]),
          family: str(c[4]),
          size: num(c[5]),
          style: str(c[6]),
          color: t.pc,
        };
      }
      case 'c': {
        const t = this.turtle(c[1]);
        t.fill = null;
        return { k: 'clear', t };
      }
      case 'C':
        this.turtles.clear();
        this.bg = null;
        this.tracer = 1;
        return { k: 'clearScreen' };
      case 'bg':
        this.bg = str(c[1]);
        return { k: 'bg', color: this.bg };
      case 'tr':
        this.tracer = c[1] ? 1 : 0;
        return { k: 'tracer', n: this.tracer };
      case 'u':
        return { k: 'update' };
      case 'v':
        this.view = { w: num(c[1]), h: num(c[2]) };
        return { k: 'view', ...this.view };
      case 't':
        this.title = str(c[1]);
        return { k: 'title', text: this.title };
      default:
        return { k: 'unknown', c };
    }
  }
}

/**
 * CPython과 같은 애니메이션 길이 (단위: tick, 1 tick ≈ CPython 화면 갱신 1회).
 * RawTurtle._goto: nhops = 1 + int(dist / (3 * 1.1**speed * speed))
 */
export function moveTicks(dist: number, speed: number): number {
  if (!speed) return 0;
  return 1 + Math.floor(dist / (3 * Math.pow(1.1, speed) * speed));
}

/** RawTurtle._rotate: steps = 1 + int(|angle| / (3 * speed)) */
export function turnTicks(angle: number, speed: number): number {
  if (!speed) return 0;
  return 1 + Math.floor(Math.abs(angle) / (3 * speed));
}

/** 코드가 turtle을 불러 쓰는지 (그림판을 미리 펼칠지). 주석 줄은 보지 않는다 */
export function usesTurtle(code: string): boolean {
  return /^[ \t]*(?:import[ \t]+(?:[\w.]+[ \t]*,[ \t]*)*turtle\b|from[ \t]+turtle[ \t]+import\b)/m.test(
    code,
  );
}
