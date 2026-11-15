/**
 * TurtleCanvas: turtle 명령 스트림을 캔버스에 애니메이션으로 그리는 렌더러 (P0-06 스파이크 → P11-02).
 * 프레임워크 없이 DOM만 쓴다. React 래퍼는 src/components/quest/TurtleStage.tsx.
 *
 * 레이어 3장 (host 안에 겹쳐 둠)
 *   bg      종이색/배경색 + (선택) 좌표 모눈
 *   draw    확정된 그림 (선, 채우기, 점, 글씨, 도장)
 *   over    매 프레임 다시 그림: 그리는 중인 선 + 거북이 스프라이트
 *
 * 그림은 전부 "표시 목록(items)"으로도 보관 → 크기 변경, HiDPI, PNG 내보내기(갤러리 썸네일 P11-06),
 * clear(), 채우기를 선 아래에 끼워 넣기(CPython z-order)를 다시 그리기로 처리.
 * 움직임 길이는 CPython 공식(scene.ts moveTicks·turnTicks), 1 tick = 1 프레임에 속도 배율을 곱한다.
 */
import { COLOR, FONT_FAMILY } from '@/lib/design/tokens';
import {
  Scene,
  moveTicks,
  turnTicks,
  type TurtleCommand,
  type TurtleOp,
  type TurtleState,
} from './scene';

const TICK_MS = 1000 / 60; // 1 tick = 1 프레임 (CPython 갱신 1회 ≈ 10ms delay + Tk 그리기)

/** 캔버스 글씨의 한글 글꼴: 앱에 이미 있는 본문 글꼴(자체 호스팅 unicode-range 조각, P0-14). 글씨 명령이 오면 미리 받는다 */
export const CANVAS_FONT_FALLBACK = `"${FONT_FAMILY.sans}", sans-serif`;

/** 기본(검정) 거북이를 보여 줄 브랜드 초록 (느릿이, Q74 ①) */
const KID = {
  shell: COLOR.primary,
  body: COLOR.primaryBright,
  line: COLOR.primaryLip,
};

const WAITING = { sh: 'turtle', pc: 'black', fc: 'black', sz: [1.4, 1.4, 1] };

type Tf = { dpr: number; zoom: number; cx: number; cy: number };

type Item =
  | {
      t: 'L';
      tid: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      c: string;
      w: number;
    }
  | { t: 'P'; tid: number; pts: number[][]; c: string }
  | { t: 'D'; tid: number; x: number; y: number; s: number; c: string }
  | {
      t: 'T';
      tid: number;
      x: number;
      y: number;
      text: string;
      align: string;
      family: string;
      size: number;
      style: string;
      c: string;
    }
  | {
      t: 'S';
      tid: number;
      sid: number;
      x: number;
      y: number;
      h: number;
      shape: string;
      pc: string;
      fc: string;
      sz: number[];
    };

interface Anim {
  op: TurtleOp;
  dur: number;
  prog: number;
  wait?: Promise<void> | null;
}

type SpriteLook = Pick<TurtleState, 'sh' | 'pc' | 'fc' | 'sz'>;

export interface TurtleCanvasOptions {
  /** 기본으로 보여 줄 세계 크기 (CPython 창과 비슷) */
  view: { w: number; h: number };
  paper: string;
  grid: boolean;
  /** 자기 교차 도형 채우기 (Windows·Linux CPython과 같은 evenodd) */
  fillRule: CanvasFillRule;
  /** 기본 모양(classic)을 귀여운 거북이로 보여 줄지 (Q74 ①) */
  classicAs: 'turtle' | 'classic';
  /** 기본 검정 거북이를 브랜드 초록으로 */
  kidColors: boolean;
  /** 그림이 넘치면 화면을 키움 (grow) / 고정 (fixed) */
  fit: 'grow' | 'fixed';
  maxDpr: number;
  frameBudgetMs: number;
  /** 한 path에 넣는 선 개수 상한 (큰 path는 CPU 래스터가 매우 느려짐, P0-06 §4.6) */
  maxPathSegments: number;
  /** 걸을 때 다리 흔들기 (동작 줄이기·minimal이면 끔) */
  walk: boolean;
}

type Events = {
  idle: () => void;
  busy: () => void;
  title: (t: string) => void;
};

export class TurtleCanvas {
  readonly opts: TurtleCanvasOptions;
  private host: HTMLElement;
  private bgCv: HTMLCanvasElement;
  private drawCv: HTMLCanvasElement;
  private overCv: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private drawCtx: CanvasRenderingContext2D;
  private overCtx: CanvasRenderingContext2D;
  private multiplier = 1;
  private listeners: { [K in keyof Events]?: Events[K][] } = {};
  private colorCache = new Map<string, number[]>();
  private cc: CanvasRenderingContext2D | null = null;
  private ro: ResizeObserver;

  private raf = 0;
  scene = new Scene();
  private ahead = new Scene();
  items: Item[] = [];
  private queue: TurtleCommand[] = [];
  private qi = 0;
  private ended = false;
  private cur: Anim | null = null;
  private avail = 0;
  private skip = false;
  private idle = true;
  private lastNow = 0;
  private batch: null | {
    c: string;
    w: number;
    ex: number;
    ey: number;
    n: number;
  } = null;
  private fills = new Map<
    number,
    { z: number; snap: HTMLCanvasElement | null }
  >();
  private walkDist = new Map<number, number>();
  private viewHalf: { w: number; h: number };
  private bg: string | null = null;
  title: string | null = null;
  private tf: Tf | null = null;
  private cssSize = { w: 1, h: 1 };

  constructor(host: HTMLElement, opts: Partial<TurtleCanvasOptions> = {}) {
    this.opts = {
      view: { w: 600, h: 600 },
      paper: COLOR.surface,
      grid: false,
      fillRule: 'evenodd',
      classicAs: 'turtle',
      kidColors: true,
      fit: 'grow',
      maxDpr: 3,
      frameBudgetMs: 8,
      maxPathSegments: 64,
      walk: true,
      ...opts,
    };
    this.host = host;
    this.viewHalf = { w: this.opts.view.w / 2, h: this.opts.view.h / 2 };
    this.bgCv = this.mkCanvas();
    this.drawCv = this.mkCanvas();
    this.overCv = this.mkCanvas();
    this.bgCtx = this.bgCv.getContext('2d')!;
    this.drawCtx = this.drawCv.getContext('2d')!;
    this.overCtx = this.overCv.getContext('2d')!;
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(host);
    this.layout();
  }

  private mkCanvas() {
    const c = document.createElement('canvas');
    c.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;';
    c.setAttribute('aria-hidden', 'true');
    this.host.appendChild(c);
    return c;
  }

  // ---------------------------------------------------------------- public API

  /** 새 실행 준비: 그림, 큐, 거북이 모두 비움 */
  reset() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.scene = new Scene();
    this.ahead = new Scene();
    this.items = [];
    this.queue = [];
    this.qi = 0;
    this.ended = false;
    this.cur = null;
    this.avail = 0;
    this.skip = false;
    this.lastNow = 0;
    this.batch = null;
    this.fills.clear();
    this.walkDist.clear();
    this.viewHalf = { w: this.opts.view.w / 2, h: this.opts.view.h / 2 };
    this.bg = null;
    this.title = null;
    this.layout();
    this.setIdle(true);
  }

  push(cmds: readonly TurtleCommand[]) {
    if (!cmds.length) return;
    let grew = false;
    for (const c of cmds) {
      this.queue.push(c);
      const op = this.ahead.apply(c);
      grew = this.track(op) || grew;
      // 글씨 조각(unicode-range)을 그 차례가 오기 전에 미리 받는다 (P0-14)
      if (op.k === 'text') void loadFont(fontString(op, 16), op.text);
    }
    if (grew) this.layout();
    this.setIdle(false);
    this.kick();
  }

  /** 더 받을 명령이 없음 (Python 실행 끝) */
  end() {
    this.ended = true;
    this.kick();
  }

  /** @param m 1 = CPython과 비슷, Infinity = 바로 그리기 */
  setSpeedMultiplier(m: number) {
    this.multiplier = m;
    this.kick();
  }

  skipToEnd() {
    this.skip = true;
    this.kick();
  }

  isIdle() {
    return this.ended && !this.cur && this.qi >= this.queue.length;
  }

  setGrid(on: boolean) {
    this.opts.grid = on;
    this.paintBg();
  }

  setWalk(on: boolean) {
    this.opts.walk = on;
    this.paintOverlay();
  }

  on<K extends keyof Events>(name: K, fn: Events[K]) {
    const list = (this.listeners[name] ??= []) as Events[K][];
    list.push(fn);
    return () => {
      this.listeners[name] = list.filter((f) => f !== fn) as never;
    };
  }

  /**
   * 그림을 원하는 크기로 다시 그려 내보냄 (PNG 저장·갤러리 썸네일, 해상도 독립).
   * fit: content = 그림에 맞춤 / view = 지금 화면 범위
   */
  exportCanvas(
    o: {
      width?: number;
      height?: number;
      fit?: 'content' | 'view';
      padding?: number;
      turtles?: boolean;
      background?: boolean;
      grid?: boolean;
    } = {},
  ) {
    this.flushBatch();
    const W = o.width ?? 512;
    const H = o.height ?? 512;
    const pad = o.padding ?? 24;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d')!;
    let rect = (o.fit ?? 'content') === 'content' ? this.contentBounds() : null;
    rect ??= {
      x0: -this.viewHalf.w,
      y0: -this.viewHalf.h,
      x1: this.viewHalf.w,
      y1: this.viewHalf.h,
    };
    const rw = Math.max(rect.x1 - rect.x0, 1);
    const rh = Math.max(rect.y1 - rect.y0, 1);
    const zoom = Math.min((W - 2 * pad) / rw, (H - 2 * pad) / rh);
    const tf: Tf = {
      dpr: 1,
      zoom,
      cx: W / 2 - ((rect.x0 + rect.x1) / 2) * zoom,
      cy: H / 2 + ((rect.y0 + rect.y1) / 2) * zoom,
    };
    if (o.background !== false) {
      ctx.fillStyle = this.bg || this.opts.paper;
      ctx.fillRect(0, 0, W, H);
      if (o.grid) this.paintGrid(ctx, tf, W, H);
    }
    this.paintItems(ctx, tf, 0, this.items.length);
    if (o.turtles !== false)
      for (const t of this.scene.turtles.values())
        if (t.v) this.paintTurtle(ctx, tf, t, t.x, t.y, t.h, 0);
    return cv;
  }

  exportPNG(
    o: Parameters<TurtleCanvas['exportCanvas']>[0] = {},
  ): Promise<Blob> {
    const cv = this.exportCanvas(o);
    return new Promise((res, rej) =>
      cv.toBlob(
        (b) => (b ? res(b) : rej(new Error('toBlob failed'))),
        'image/png',
      ),
    );
  }

  /** 지금 화면에 보이는 세계 범위의 가로:세로 (저장 그림 크기 정하기) */
  viewAspect() {
    return this.viewHalf.w / this.viewHalf.h;
  }

  /** 그림 전체를 감싸는 세계 좌표 사각형 */
  contentBounds() {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const add = (x: number, y: number, r = 0) => {
      x0 = Math.min(x0, x - r);
      y0 = Math.min(y0, y - r);
      x1 = Math.max(x1, x + r);
      y1 = Math.max(y1, y + r);
    };
    for (const it of this.items) {
      if (it.t === 'L') {
        add(it.x0, it.y0, it.w / 2);
        add(it.x1, it.y1, it.w / 2);
      } else if (it.t === 'P') for (const p of it.pts) add(p[0], p[1]);
      else if (it.t === 'D') add(it.x, it.y, it.s / 2);
      else if (it.t === 'S') add(it.x, it.y, 18);
      else {
        const px = (it.size * 4) / 3;
        const wdt = textWidthGuess(it.text, px);
        const lx =
          it.align === 'left'
            ? it.x
            : it.align === 'center'
              ? it.x - wdt / 2
              : it.x - wdt;
        add(lx, it.y);
        add(lx + wdt, it.y + px * 1.2 * it.text.split('\n').length);
      }
    }
    if (x0 === Infinity) return null;
    return { x0, y0, x1, y1 };
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.bgCv.remove();
    this.drawCv.remove();
    this.overCv.remove();
  }

  // ---------------------------------------------------------------- 배치/좌표

  private emit<K extends keyof Events>(
    name: K,
    ...args: Parameters<Events[K]>
  ) {
    for (const fn of this.listeners[name] ?? [])
      (fn as (...a: Parameters<Events[K]>) => void)(...args);
  }

  private setIdle(idle: boolean) {
    if (idle === this.idle) return;
    this.idle = idle;
    this.emit(idle ? 'idle' : 'busy');
  }

  /** ahead 상태로 그림 범위를 추적해 화면을 키움. 키웠으면 true */
  private track(op: TurtleOp): boolean {
    if (op.k === 'view') {
      this.viewHalf = { w: op.w / 2, h: op.h / 2 };
      return true;
    }
    if (this.opts.fit !== 'grow') return false;
    let x0: number, x1: number, y0: number, y1: number;
    if (op.k === 'move' || op.k === 'jump' || op.k === 'dot') {
      const x = op.k === 'dot' ? op.x : op.x1;
      const y = op.k === 'dot' ? op.y : op.y1;
      const r =
        op.k === 'dot'
          ? op.size / 2
          : Math.max(12, (op.k === 'move' ? op.width : 1) / 2);
      x0 = x - r;
      x1 = x + r;
      y0 = y - r;
      y1 = y + r;
    } else if (op.k === 'text') {
      const px = (op.size * 4) / 3;
      const w = textWidthGuess(op.text, px);
      x0 =
        op.align === 'left'
          ? op.x
          : op.align === 'center'
            ? op.x - w / 2
            : op.x - w;
      x1 = x0 + w;
      y0 = op.y;
      y1 = op.y + px * 1.2 * op.text.split('\n').length;
    } else return false;
    const m = 16;
    const needW = Math.max(Math.abs(x0), Math.abs(x1)) + m;
    const needH = Math.max(Math.abs(y0), Math.abs(y1)) + m;
    let grew = false;
    if (needW > this.viewHalf.w) {
      this.viewHalf.w = Math.ceil(needW / 50) * 50;
      grew = true;
    }
    if (needH > this.viewHalf.h) {
      this.viewHalf.h = Math.ceil(needH / 50) * 50;
      grew = true;
    }
    return grew;
  }

  private layout() {
    const r = this.host.getBoundingClientRect();
    const cw = Math.max(1, r.width);
    const ch = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
    for (const c of [this.bgCv, this.drawCv, this.overCv]) {
      c.width = Math.round(cw * dpr);
      c.height = Math.round(ch * dpr);
    }
    const zoom = Math.min(
      cw / (2 * this.viewHalf.w),
      ch / (2 * this.viewHalf.h),
    );
    this.tf = { dpr, zoom, cx: cw / 2, cy: ch / 2 };
    this.cssSize = { w: cw, h: ch };
    this.paintBg();
    this.rerender();
    this.paintOverlay();
  }

  private worldTf(ctx: CanvasRenderingContext2D, tf: Tf) {
    ctx.setTransform(
      tf.dpr * tf.zoom,
      0,
      0,
      -tf.dpr * tf.zoom,
      tf.dpr * tf.cx,
      tf.dpr * tf.cy,
    );
  }

  private screenTf(ctx: CanvasRenderingContext2D, tf: Tf) {
    ctx.setTransform(tf.dpr, 0, 0, tf.dpr, 0, 0);
  }

  // ---------------------------------------------------------------- 그리기

  private paintBg() {
    const ctx = this.bgCtx;
    const tf = this.tf;
    if (!tf) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.bg || this.opts.paper;
    ctx.fillRect(0, 0, this.bgCv.width, this.bgCv.height);
    if (this.opts.grid) this.paintGrid(ctx, tf, this.cssSize.w, this.cssSize.h);
  }

  /** 좌표 모눈 (50 간격, 100마다 숫자, 가운데 (0, 0) 축은 진하게) */
  private paintGrid(
    ctx: CanvasRenderingContext2D,
    tf: Tf,
    W: number,
    H: number,
  ) {
    this.screenTf(ctx, tf);
    const wx0 = (0 - tf.cx) / tf.zoom;
    const wx1 = (W - tf.cx) / tf.zoom;
    const wy0 = (tf.cy - H) / tf.zoom;
    const wy1 = tf.cy / tf.zoom;
    const step = tf.zoom < 0.4 ? 100 : 50;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = `12px ${CANVAS_FONT_FALLBACK}`;
    ctx.fillStyle = COLOR.textMuted;
    ctx.strokeStyle = COLOR.textMuted;
    const line = (axis: boolean, draw: () => void) => {
      ctx.globalAlpha = axis ? 0.45 : 0.14;
      ctx.beginPath();
      draw();
      ctx.stroke();
    };
    for (let x = Math.ceil(wx0 / step) * step; x <= wx1; x += step) {
      const sx = Math.round(tf.cx + x * tf.zoom) + 0.5;
      line(x === 0, () => {
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, H);
      });
      ctx.globalAlpha = 0.8;
      if (x !== 0 && x % 100 === 0) ctx.fillText(String(x), sx + 3, tf.cy - 4);
    }
    for (let y = Math.ceil(wy0 / step) * step; y <= wy1; y += step) {
      const sy = Math.round(tf.cy - y * tf.zoom) + 0.5;
      line(y === 0, () => {
        ctx.moveTo(0, sy);
        ctx.lineTo(W, sy);
      });
      ctx.globalAlpha = 0.8;
      if (y !== 0 && y % 100 === 0) ctx.fillText(String(y), tf.cx + 4, sy - 3);
    }
    ctx.restore();
  }

  private clearDraw() {
    this.batch = null;
    this.drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawCtx.clearRect(0, 0, this.drawCv.width, this.drawCv.height);
  }

  private rerender() {
    if (!this.tf) return;
    this.clearDraw();
    // 열린 채우기가 있으면 시작 시점 스냅숏도 다시 만든다
    const zs = [...this.fills.values()].sort((a, b) => a.z - b.z);
    let from = 0;
    for (const f of zs) {
      this.paintItems(this.drawCtx, this.tf, from, f.z);
      from = f.z;
      f.snap = this.snapshot();
    }
    this.paintItems(this.drawCtx, this.tf, from, this.items.length);
  }

  private snapshot() {
    const c = document.createElement('canvas');
    c.width = this.drawCv.width;
    c.height = this.drawCv.height;
    c.getContext('2d')!.drawImage(this.drawCv, 0, 0);
    return c;
  }

  /** items[from, to)를 ctx에 그림. 같은 색·굵기의 이어진 선은 path 하나로 묶음 */
  private paintItems(
    ctx: CanvasRenderingContext2D,
    tf: Tf,
    from: number,
    to: number,
  ) {
    let open = false;
    let c = '';
    let w = -1;
    let ex = NaN;
    let ey = NaN;
    let n = 0;
    const minW = 1 / tf.zoom;
    const maxSeg = this.opts.maxPathSegments;
    this.worldTf(ctx, tf);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = from; i < to; i++) {
      const it = this.items[i];
      if (it.t === 'L') {
        if (!open || it.c !== c || it.w !== w || n >= maxSeg) {
          if (open) ctx.stroke();
          c = it.c;
          w = it.w;
          ctx.strokeStyle = c;
          ctx.lineWidth = Math.max(w, minW);
          ctx.beginPath();
          open = true;
          n = 0;
          ex = NaN;
        }
        n++;
        if (it.x0 !== ex || it.y0 !== ey) ctx.moveTo(it.x0, it.y0);
        ctx.lineTo(it.x1, it.y1);
        ex = it.x1;
        ey = it.y1;
        continue;
      }
      if (open) {
        ctx.stroke();
        open = false;
      }
      this.paintItem(ctx, tf, it);
      this.worldTf(ctx, tf);
    }
    if (open) ctx.stroke();
  }

  /** 선 이외 항목 */
  private paintItem(ctx: CanvasRenderingContext2D, tf: Tf, it: Item) {
    if (it.t === 'P') {
      this.worldTf(ctx, tf);
      ctx.fillStyle = it.c;
      ctx.beginPath();
      ctx.moveTo(it.pts[0][0], it.pts[0][1]);
      for (let i = 1; i < it.pts.length; i++)
        ctx.lineTo(it.pts[i][0], it.pts[i][1]);
      ctx.closePath();
      ctx.fill(this.opts.fillRule);
    } else if (it.t === 'D') {
      this.worldTf(ctx, tf);
      ctx.fillStyle = it.c;
      ctx.beginPath();
      ctx.arc(it.x, it.y, Math.max(it.s / 2, 0.5 / tf.zoom), 0, Math.PI * 2);
      ctx.fill();
    } else if (it.t === 'T') {
      this.paintText(ctx, tf, it);
    } else if (it.t === 'S') {
      const look = { sh: it.shape, pc: it.pc, fc: it.fc, sz: it.sz };
      this.paintTurtle(ctx, tf, look, it.x, it.y, it.h, 0);
    }
  }

  private paintText(
    ctx: CanvasRenderingContext2D,
    tf: Tf,
    it: Extract<Item, { t: 'T' }>,
  ) {
    this.screenTf(ctx, tf);
    const px = ((it.size * 4) / 3) * tf.zoom;
    ctx.font = fontString(it, px);
    ctx.fillStyle = it.c;
    ctx.textBaseline = 'bottom';
    ctx.textAlign =
      it.align === 'center'
        ? 'center'
        : it.align === 'right'
          ? 'right'
          : 'left';
    const lines = it.text.split('\n');
    const sx = tf.cx + it.x * tf.zoom - (it.align === 'left' ? tf.zoom : 0);
    let sy = tf.cy - it.y * tf.zoom;
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], sx, sy);
      sy -= px * 1.2;
    }
  }

  /** 확정 그림에 선 하나 추가 (같은 스타일이면 path에 이어 붙였다가 프레임 끝에 stroke) */
  private commitLine(it: Extract<Item, { t: 'L' }>) {
    this.items.push(it);
    const ctx = this.drawCtx;
    const tf = this.tf!;
    let b = this.batch;
    if (
      !b ||
      b.c !== it.c ||
      b.w !== it.w ||
      b.n >= this.opts.maxPathSegments
    ) {
      this.flushBatch();
      this.worldTf(ctx, tf);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = it.c;
      ctx.lineWidth = Math.max(it.w, 1 / tf.zoom);
      ctx.beginPath();
      ctx.moveTo(it.x0, it.y0);
      b = this.batch = { c: it.c, w: it.w, ex: it.x0, ey: it.y0, n: 0 };
    }
    b.n++;
    if (b.ex !== it.x0 || b.ey !== it.y0) ctx.moveTo(it.x0, it.y0);
    ctx.lineTo(it.x1, it.y1);
    b.ex = it.x1;
    b.ey = it.y1;
  }

  private flushBatch() {
    if (this.batch) {
      this.drawCtx.stroke();
      this.batch = null;
    }
  }

  private commitItem(it: Item) {
    this.flushBatch();
    this.items.push(it);
    this.paintItem(this.drawCtx, this.tf!, it);
  }

  // ---------------------------------------------------------------- 재생 루프

  private kick() {
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private frame(now: number) {
    this.raf = 0;
    const dt = this.lastNow ? Math.min(now - this.lastNow, 100) : TICK_MS;
    this.lastNow = now;
    const m = this.skip ? Infinity : this.multiplier;
    this.avail = m === Infinity ? Infinity : this.avail + (dt / TICK_MS) * m;
    const t0 = performance.now();
    for (;;) {
      if (!this.cur) {
        if (this.qi >= this.queue.length) break;
        if (performance.now() - t0 > this.opts.frameBudgetMs) break;
        this.cur = this.begin(this.queue[this.qi++], m);
        if (!this.cur) continue;
      }
      if (this.cur.wait) break; // 글꼴 로딩 대기
      const need = this.cur.dur - this.cur.prog;
      if (need <= this.avail) {
        this.avail -= need;
        this.finish(this.cur);
        this.cur = null;
        continue;
      }
      this.cur.prog += this.avail;
      this.advanceWalk(this.cur, this.avail);
      this.avail = 0;
      break;
    }
    this.flushBatch();
    if (!this.cur && this.qi >= this.queue.length) this.avail = 0; // 기다리는 동안 시간 저축 금지
    if (this.avail === Infinity) this.avail = 0;
    else this.avail = Math.min(this.avail, 2 * m);
    this.paintOverlay();
    if (this.cur || this.qi < this.queue.length) {
      this.kick();
    } else {
      this.lastNow = 0;
      if (this.ended) {
        this.skip = false;
        this.setIdle(true);
      }
    }
  }

  /** 명령 하나 시작. 즉시 끝나는 명령이면 처리하고 null */
  private begin(cmd: TurtleCommand, m: number): Anim | null {
    const op = this.scene.apply(cmd);
    const instant = m === Infinity;
    switch (op.k) {
      case 'move': {
        const dist = Math.hypot(op.x1 - op.x0, op.y1 - op.y0);
        const dur = instant ? 0 : moveTicks(dist, op.speed);
        const a: Anim = { op, dur, prog: 0 };
        if (!dur) {
          this.finish(a);
          return null;
        }
        return a;
      }
      case 'turn': {
        const dur = instant || !op.t.v ? 0 : turnTicks(op.delta, op.speed);
        return dur ? { op, dur, prog: 0 } : null;
      }
      case 'dot':
      case 'stamp':
      case 'text': {
        const a: Anim = {
          op,
          dur: instant || !op.t.sp || !this.scene.tracer ? 0 : 1,
          prog: 0,
          wait: null,
        };
        if (op.k === 'text') {
          const font = fontString(op, 16);
          if (document.fonts && !document.fonts.check(font, op.text)) {
            a.wait = Promise.race([
              loadFont(font, op.text),
              new Promise((r) => setTimeout(r, 2000)),
            ]).then(() => {
              a.wait = null;
              this.kick();
            });
          }
        }
        if (!a.dur && !a.wait) {
          this.finish(a);
          return null;
        }
        return a;
      }
      case 'beginFill': {
        this.flushBatch();
        if (!op.restart || !this.fills.has(op.t.id)) {
          this.fills.set(op.t.id, {
            z: this.items.length,
            snap: this.snapshot(),
          });
        }
        return null;
      }
      case 'endFill': {
        const f = this.fills.get(op.t.id);
        this.fills.delete(op.t.id);
        if (f && op.points)
          this.insertFill(f, {
            t: 'P',
            tid: op.t.id,
            pts: op.points,
            c: op.color,
          });
        return null;
      }
      case 'clear':
        this.removeItems((it) => it.tid === op.t.id);
        this.fills.delete(op.t.id);
        this.rerender();
        return null;
      case 'clearStamp':
        this.removeItems((it) => it.t === 'S' && it.sid === op.sid);
        this.rerender();
        return null;
      case 'clearScreen':
        this.items = [];
        this.fills.clear();
        this.bg = null;
        this.paintBg();
        this.rerender();
        return null;
      case 'bg':
        this.bg = op.color;
        this.paintBg();
        return null;
      case 'title':
        this.title = op.text;
        this.emit('title', op.text);
        return null;
      default:
        return null;
    }
  }

  private finish(a: Anim) {
    const op = a.op;
    if (op.k === 'move') {
      this.advanceWalk(a, a.dur - a.prog);
      if (op.draw && (op.x0 !== op.x1 || op.y0 !== op.y1)) {
        this.commitLine({
          t: 'L',
          tid: op.t.id,
          x0: op.x0,
          y0: op.y0,
          x1: op.x1,
          y1: op.y1,
          c: op.color,
          w: op.width,
        });
      } else if (op.draw) {
        // forward(0): CPython은 펜 굵기만큼 점이 찍힘
        this.commitItem({
          t: 'D',
          tid: op.t.id,
          x: op.x0,
          y: op.y0,
          s: op.width,
          c: op.color,
        });
      }
    } else if (op.k === 'dot') {
      this.commitItem({
        t: 'D',
        tid: op.t.id,
        x: op.x,
        y: op.y,
        s: op.size,
        c: op.color,
      });
    } else if (op.k === 'text') {
      this.commitItem({
        t: 'T',
        tid: op.t.id,
        x: op.x,
        y: op.y,
        text: op.text,
        align: op.align,
        family: op.family,
        size: op.size,
        style: op.style,
        c: op.color,
      });
    } else if (op.k === 'stamp') {
      this.commitItem({
        t: 'S',
        tid: op.t.id,
        sid: op.sid,
        x: op.x,
        y: op.y,
        h: op.h,
        shape: op.shape,
        pc: op.pc,
        fc: op.fc,
        sz: op.sz,
      });
    }
  }

  /** 채우기를 begin_fill 시점의 z 위치에 끼워 넣음 (CPython: 채우기가 그동안 그린 선 아래) */
  private insertFill(
    f: { z: number; snap: HTMLCanvasElement | null },
    poly: Extract<Item, { t: 'P' }>,
  ) {
    this.flushBatch();
    this.items.splice(f.z, 0, poly);
    for (const g of this.fills.values()) if (g.z > f.z) g.z++;
    const ctx = this.drawCtx;
    if (f.z === this.items.length - 1) {
      this.paintItem(ctx, this.tf!, poly);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.drawCv.width, this.drawCv.height);
      if (
        f.snap &&
        f.snap.width === this.drawCv.width &&
        f.snap.height === this.drawCv.height
      ) {
        ctx.drawImage(f.snap, 0, 0);
        this.paintItems(ctx, this.tf!, f.z, this.items.length);
      } else {
        this.paintItems(ctx, this.tf!, 0, this.items.length);
      }
    }
  }

  private removeItems(pred: (it: Item) => boolean) {
    const keep: Item[] = [];
    const remap = new Map<{ z: number }, number>();
    for (const f of this.fills.values()) remap.set(f, 0);
    for (let i = 0; i < this.items.length; i++) {
      const drop = pred(this.items[i]);
      for (const f of this.fills.values())
        if (i < f.z && !drop) remap.set(f, remap.get(f)! + 1);
      if (!drop) keep.push(this.items[i]);
    }
    for (const [f, z] of remap) f.z = z;
    this.items = keep;
  }

  private advanceWalk(a: Anim, ticks: number) {
    if (a.op.k !== 'move' || !ticks) return;
    const dist = Math.hypot(a.op.x1 - a.op.x0, a.op.y1 - a.op.y0);
    const id = a.op.t.id;
    this.walkDist.set(
      id,
      (this.walkDist.get(id) || 0) + (dist * ticks) / a.dur,
    );
  }

  // ---------------------------------------------------------------- 오버레이 & 스프라이트

  private paintOverlay() {
    const ctx = this.overCtx;
    const tf = this.tf;
    if (!tf) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overCv.width, this.overCv.height);
    const cur = this.cur;
    let animId = -1;
    let ax = 0;
    let ay = 0;
    let ah = 0;
    if (cur && !cur.wait && (cur.op.k === 'move' || cur.op.k === 'turn')) {
      const f = cur.dur ? cur.prog / cur.dur : 1;
      const op = cur.op;
      animId = op.t.id;
      if (op.k === 'move') {
        ax = op.x0 + (op.x1 - op.x0) * f;
        ay = op.y0 + (op.y1 - op.y0) * f;
        ah = op.t.h;
        if (op.draw && f > 0) {
          this.worldTf(ctx, tf);
          ctx.lineCap = 'round';
          ctx.strokeStyle = op.color;
          ctx.lineWidth = Math.max(op.width, 1 / tf.zoom);
          ctx.beginPath();
          ctx.moveTo(op.x0, op.y0);
          ctx.lineTo(ax, ay);
          ctx.stroke();
        }
      } else {
        ax = op.t.x;
        ay = op.t.y;
        ah = op.h0 + op.delta * f;
      }
    }
    // 아직 아무 거북이도 없으면(실행 전) 가운데에 옅은 느릿이가 기다린다
    if (!this.scene.turtles.size && !this.queue.length) {
      ctx.globalAlpha = 0.4;
      this.paintTurtle(ctx, tf, WAITING, 0, 0, 90, 0);
      ctx.globalAlpha = 1;
    }
    for (const t of this.scene.turtles.values()) {
      if (!t.v) continue;
      const walking = this.opts.walk ? this.walkDist.get(t.id) || 0 : 0;
      if (t.id === animId) this.paintTurtle(ctx, tf, t, ax, ay, ah, walking);
      else this.paintTurtle(ctx, tf, t, t.x, t.y, t.h, walking);
    }
  }

  /** CSS 색 → [r,g,b] */
  private rgb(css: string): number[] {
    let v = this.colorCache.get(css);
    if (!v) {
      const c = (this.cc ??= document
        .createElement('canvas')
        .getContext('2d')!);
      c.fillStyle = COLOR.text;
      c.fillStyle = css;
      const s = String(c.fillStyle);
      v = s.startsWith('#')
        ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
        : (s.match(/\d+/g) || ['0', '0', '0']).slice(0, 3).map(Number);
      this.colorCache.set(css, v);
    }
    return v;
  }

  private mix(css: string, toward: string, k: number) {
    const a = this.rgb(css);
    const b = this.rgb(toward);
    // tokens-allow: 학생이 고른 거북이 색을 밝게·어둡게 섞은 계산값 (고정 색 아님)
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(',')})`;
  }

  /** 거북이(또는 도장) 그리기. 화면 좌표계, 동쪽을 향하게 그린 뒤 회전 */
  private paintTurtle(
    ctx: CanvasRenderingContext2D,
    tf: Tf,
    t: SpriteLook,
    x: number,
    y: number,
    h: number,
    walk: number,
  ) {
    let shape = t.sh;
    if (shape === 'blank') return;
    if (shape === 'classic' && this.opts.classicAs === 'turtle')
      shape = 'turtle';
    // 아이들 눈에 잘 보이게 CPython보다 조금 크게
    const scale = Math.min(1.6, Math.max(0.95, tf.zoom * 1.35));
    const [sw, sl] = t.sz || [1, 1];
    this.screenTf(ctx, tf);
    ctx.save();
    ctx.translate(tf.cx + x * tf.zoom, tf.cy - y * tf.zoom);
    ctx.rotate((-h * Math.PI) / 180);
    ctx.scale(scale * sl, scale * sw);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // 채우기 색이 기본(검정)이면 초록 등껍질 (펜 색은 테두리로 살림)
    const isDefault = t.fc === 'black' && this.opts.kidColors;
    if (shape === 'turtle') this.spriteTurtle(ctx, t, isDefault, walk);
    else if (shape === 'pybaem') this.spritePybaem(ctx, walk);
    else {
      const polys: Record<string, number[][]> = {
        classic: [
          [0, 0],
          [-14, 8],
          [-11, 0],
          [-14, -8],
        ],
        arrow: [
          [10, 0],
          [0, 10],
          [0, -10],
        ],
        triangle: [
          [11.55, 0],
          [-5.77, 10],
          [-5.77, -10],
        ],
        square: [
          [10, 10],
          [-10, 10],
          [-10, -10],
          [10, -10],
        ],
      };
      ctx.beginPath();
      if (shape === 'circle') ctx.arc(0, 0, 10, 0, Math.PI * 2);
      else {
        const p = polys[shape] || polys.classic;
        ctx.moveTo(p[0][0], p[0][1]);
        for (const q of p.slice(1)) ctx.lineTo(q[0], q[1]);
        ctx.closePath();
      }
      ctx.fillStyle = isDefault ? KID.shell : t.fc;
      ctx.strokeStyle = isDefault && t.pc === 'black' ? KID.line : t.pc;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 느릿이 (귀여운 거북이, Q74 ①): 등껍질 = fillcolor, 몸 = 밝게 섞은 색, 테두리 = pencolor */
  private spriteTurtle(
    ctx: CanvasRenderingContext2D,
    t: SpriteLook,
    isDefault: boolean,
    walk: number,
  ) {
    const shell = isDefault ? KID.shell : t.fc;
    const body = isDefault ? KID.body : this.mix(t.fc, COLOR.surface, 0.55);
    const line =
      t.pc === 'black' && isDefault
        ? KID.line
        : this.mix(t.pc, COLOR.text, 0.15);
    const sw = Math.sin(walk / 5) * 0.45;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = line;
    ctx.fillStyle = body;
    // 다리 4개 (걸을 때 앞뒤로 흔들림)
    for (const [lx, ly, ph] of [
      [8, 10, 1],
      [8, -10, -1],
      [-8, 10, -1],
      [-8, -10, 1],
    ]) {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(sw * ph + (ly > 0 ? 0.5 : -0.5));
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.2, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // 꼬리
    ctx.beginPath();
    ctx.moveTo(-12, 3);
    ctx.lineTo(-19, 0);
    ctx.lineTo(-12, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 머리
    ctx.beginPath();
    ctx.arc(16, 0, 6.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 등껍질
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.stroke();
    // 등껍질 무늬 + 하이라이트 (흰색 반투명)
    ctx.save();
    ctx.strokeStyle = COLOR.surface;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    const hx = [
      [-4.5, 0],
      [-2.2, 4],
      [2.2, 4],
      [4.5, 0],
      [2.2, -4],
      [-2.2, -4],
    ];
    ctx.moveTo(hx[0][0], hx[0][1]);
    for (const p of hx.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    for (const [a, b] of hx) {
      ctx.moveTo(a, b);
      ctx.lineTo(a * 2.4, b * 2.2);
    }
    ctx.stroke();
    ctx.fillStyle = COLOR.surface;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(-3, 5.5, 5, 2.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 눈 + 볼
    for (const ey of [3, -3]) {
      ctx.fillStyle = COLOR.surface;
      ctx.beginPath();
      ctx.arc(18.4, ey, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLOR.text;
      ctx.beginPath();
      ctx.arc(19.2, ey, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.fillStyle = COLOR.error;
    ctx.globalAlpha = 0.45;
    for (const ey of [4.8, -4.8]) {
      ctx.beginPath();
      ctx.arc(14.6, ey, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 파이뱀 (`shape("pybaem")`, 숨은 재미, Q74 ①) */
  private spritePybaem(ctx: CanvasRenderingContext2D, walk: number) {
    const wig = Math.sin(walk / 6) * 3;
    ctx.lineWidth = 7;
    ctx.strokeStyle = KID.line;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.bezierCurveTo(-8, 8 + wig, -16, -8 - wig, -26, 2 + wig);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = KID.shell;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(6, 0, 11, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = KID.shell;
    ctx.strokeStyle = KID.line;
    ctx.lineWidth = 1.6;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = KID.body;
    ctx.beginPath();
    ctx.ellipse(9, 0, 5.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLOR.error;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(22, 0);
    ctx.lineTo(24, 2);
    ctx.moveTo(22, 0);
    ctx.lineTo(24, -2);
    ctx.stroke();
    for (const ey of [4.2, -4.2]) {
      ctx.fillStyle = COLOR.surface;
      ctx.beginPath();
      ctx.arc(9, ey, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLOR.text;
      ctx.beginPath();
      ctx.arc(10.2, ey, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLOR.accent;
    ctx.beginPath();
    ctx.moveTo(-1, -3);
    ctx.lineTo(-4, -8);
    ctx.lineTo(0, -6);
    ctx.lineTo(2, -10);
    ctx.lineTo(3, -6);
    ctx.lineTo(6, -8);
    ctx.lineTo(4, -3);
    ctx.closePath();
    ctx.fill();
  }
}

function loadFont(font: string, text: string): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts)
    return Promise.resolve();
  return document.fonts.load(font, text).catch(() => undefined);
}

/** Tk 글꼴 (family, size pt, style) → CSS font 문자열. 한글 대체 글꼴을 항상 붙임 */
export function fontString(
  it: { family: string; style: string },
  px: number,
): string {
  const st = String(it.style || 'normal').toLowerCase();
  const parts: string[] = [];
  if (st.includes('italic')) parts.push('italic');
  if (st.includes('bold')) parts.push('bold');
  const fam = String(it.family || 'Arial').replace(/["\\]/g, '');
  return `${parts.join(' ')} ${Math.max(1, px).toFixed(1)}px "${fam}", ${CANVAS_FONT_FALLBACK}`.trim();
}

/** 글자 폭 어림 (한글 1em, 영문 0.56em). 화면 맞춤·저장 범위용 */
export function textWidthGuess(text: string, px: number): number {
  let w = 0;
  let max = 0;
  for (const ch of String(text)) {
    if (ch === '\n') {
      max = Math.max(max, w);
      w = 0;
      continue;
    }
    w += ch.codePointAt(0)! > 0x2e80 ? px : px * 0.56;
  }
  return Math.max(max, w);
}
