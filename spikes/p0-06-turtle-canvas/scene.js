// @ts-check
/**
 * turtle 명령 스트림 → 의미 단위 "op"로 바꾸는 순수 리듀서.
 * 렌더러(renderer.js)와 검증기(checker.js)가 같은 해석을 쓰도록 DOM 없이 작성.
 *
 * 명령 형식 (turtle.py가 내보냄, 숫자는 소수 둘째 자리까지):
 *   ['n', id, state]            새 거북이. state = {x,y,h,d,pc,fc,w,sp,v,sh,sz}
 *   ['m', id, x, y]             이동 (펜이 내려가 있으면 선)
 *   ['j', id, x, y, h?]         순간 이동 (선 없음, 애니메이션 없음)
 *   ['r', id, delta, h, 0?]     회전 (반시계 +, 최종 방향 h). 끝에 0이면 즉시 회전
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

/**
 * @typedef {{id:number,x:number,y:number,h:number,d:number,pc:string,fc:string,w:number,
 *   sp:number,v:number,sh:string,sz:number[],fill:null|{points:number[][]}}} TurtleState
 */

export class Scene {
  constructor() {
    this.reset();
  }

  reset() {
    /** @type {Map<number, TurtleState>} */
    this.turtles = new Map();
    /** @type {string|null} */
    this.bg = null;
    this.tracer = 1;
    /** @type {{w:number,h:number}|null} */
    this.view = null;
    /** @type {string|null} */
    this.title = null;
  }

  /** @param {number} id */
  turtle(id) {
    const t = this.turtles.get(id);
    if (!t) throw new Error(`unknown turtle ${id}`);
    return t;
  }

  /**
   * 명령 하나를 적용하고, 그 의미(op)를 돌려준다.
   * @param {any[]} c
   * @returns {any}
   */
  apply(c) {
    const op = c[0];
    switch (op) {
      case 'n': {
        const s = c[2];
        /** @type {TurtleState} */
        const t = {
          id: c[1], x: s.x, y: s.y, h: s.h, d: s.d, pc: s.pc, fc: s.fc, w: s.w,
          sp: s.sp, v: s.v, sh: s.sh, sz: s.sz || [1, 1, 1], fill: null,
        };
        this.turtles.set(t.id, t);
        return { k: 'new', t };
      }
      case 'm': {
        const t = this.turtle(c[1]);
        const x0 = t.x, y0 = t.y;
        t.x = c[2]; t.y = c[3];
        if (t.fill) t.fill.points.push([t.x, t.y]);
        return {
          k: 'move', t, x0, y0, x1: t.x, y1: t.y, draw: !!t.d, color: t.pc, width: t.w,
          speed: this.tracer ? t.sp : 0,
        };
      }
      case 'j': {
        const t = this.turtle(c[1]);
        const x0 = t.x, y0 = t.y, h0 = t.h;
        t.x = c[2]; t.y = c[3];
        if (c.length > 4) t.h = c[4];
        if (t.fill) t.fill.points.push([t.x, t.y]);
        return { k: 'jump', t, x0, y0, x1: t.x, y1: t.y, h0, h1: t.h };
      }
      case 'r': {
        const t = this.turtle(c[1]);
        const h0 = t.h;
        t.h = c[3];
        const instant = c.length > 4 && c[4] === 0;
        return { k: 'turn', t, h0, delta: c[2], h1: t.h, speed: instant || !this.tracer ? 0 : t.sp };
      }
      case 's': {
        const t = this.turtle(c[1]);
        const ch = c[2];
        for (const key of Object.keys(ch)) {
          if (key === 'x' || key === 'y' || key === 'h') continue; // reset()은 'j'로 이동
          /** @type {any} */ (t)[key] = ch[key];
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
        return { k: 'endFill', t, points: pts && pts.length > 2 ? pts : null, color: t.fc };
      }
      case 'd': {
        const t = this.turtle(c[1]);
        return { k: 'dot', t, x: t.x, y: t.y, size: c[2], color: c[3] };
      }
      case 'sp': {
        const t = this.turtle(c[1]);
        return {
          k: 'stamp', t, sid: c[2], x: t.x, y: t.y, h: t.h, shape: t.sh, pc: t.pc, fc: t.fc,
          sz: t.sz.slice(),
        };
      }
      case 'cs':
        return { k: 'clearStamp', t: this.turtle(c[1]), sid: c[2] };
      case 'w': {
        const t = this.turtle(c[1]);
        return {
          k: 'text', t, x: t.x, y: t.y, text: c[2], align: c[3], family: c[4], size: c[5],
          style: c[6], color: t.pc,
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
        this.bg = c[1];
        return { k: 'bg', color: c[1] };
      case 'tr':
        this.tracer = c[1] ? 1 : 0;
        return { k: 'tracer', n: this.tracer };
      case 'u':
        return { k: 'update' };
      case 'v':
        this.view = { w: c[1], h: c[2] };
        return { k: 'view', w: c[1], h: c[2] };
      case 't':
        this.title = c[1];
        return { k: 'title', text: c[1] };
      default:
        return { k: 'unknown', c };
    }
  }
}

/**
 * CPython과 같은 애니메이션 길이 (단위: tick, 1 tick ≈ CPython 화면 갱신 1회).
 * RawTurtle._goto: nhops = 1 + int(dist / (3 * 1.1**speed * speed))
 * RawTurtle._rotate: steps = 1 + int(|angle| / (3 * speed))
 */
export function moveTicks(dist, speed) {
  if (!speed) return 0;
  return 1 + Math.floor(dist / (3 * Math.pow(1.1, speed) * speed));
}

export function turnTicks(angle, speed) {
  if (!speed) return 0;
  return 1 + Math.floor(Math.abs(angle) / (3 * speed));
}
