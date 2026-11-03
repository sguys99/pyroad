// @ts-check
/**
 * TurtleCanvas: turtle 명령 스트림을 캔버스에 애니메이션으로 그리는 렌더러.
 * 프레임워크 없이 작성 (Phase 11에서 React 컴포넌트로 감쌀 예정).
 *
 * 레이어 3장 (host 안에 겹쳐 둠)
 *   bg      종이색/배경색 + (선택) 좌표 모눈
 *   draw    확정된 그림 (선, 채우기, 점, 글씨, 도장)
 *   over    매 프레임 다시 그림: 그리는 중인 선 + 거북이 스프라이트
 *
 * 그림은 전부 "표시 목록(items)"으로도 보관 → 크기 변경, HiDPI, PNG/SVG 내보내기,
 * clear(), 채우기를 선 아래에 끼워 넣기(CPython z-order)를 다시 그리기로 처리.
 */
import { Scene, moveTicks, turnTicks } from './scene.js';

const TICK_MS = 1000 / 60; // 1 tick = 1 프레임 (CPython 갱신 1회 ≈ 10ms delay + Tk 그리기)
export const KR_FONT_FALLBACK =
  '"Gowun Dodum", "Jua", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

const KID = { shell: '#66BB6A', body: '#A5D6A7', line: '#2E7D32' };

/** @typedef {{dpr:number, zoom:number, cx:number, cy:number}} Tf */

export class TurtleCanvas {
  /**
   * @param {HTMLElement} host
   * @param {object} [opts]
   */
  constructor(host, opts = {}) {
    this.opts = {
      view: { w: 600, h: 600 }, // 기본으로 보여 줄 세계 크기 (CPython 창과 비슷)
      paper: '#fffdf7',
      grid: false,
      fillRule: /** @type {'evenodd'|'nonzero'} */ ('evenodd'),
      classicAs: 'turtle', // 기본 모양(classic)을 귀여운 거북이로 보여 줄지
      kidColors: true, // 기본 검정 거북이를 파스텔 초록으로
      fit: 'grow', // 'grow' | 'fixed'
      maxDpr: 3,
      frameBudgetMs: 8,
      maxPathSegments: 64, // 한 path에 넣는 선 개수 상한 (큰 path는 래스터가 매우 느려짐, 보고서 4절)
      ...opts,
    };
    this.host = host;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    this.bgCv = this._mkCanvas();
    this.drawCv = this._mkCanvas();
    this.overCv = this._mkCanvas();
    this.bgCtx = /** @type {CanvasRenderingContext2D} */ (this.bgCv.getContext('2d'));
    this.drawCtx = /** @type {CanvasRenderingContext2D} */ (this.drawCv.getContext('2d'));
    this.overCtx = /** @type {CanvasRenderingContext2D} */ (this.overCv.getContext('2d'));
    this.reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.multiplier = this.reducedMotion ? Infinity : 1;
    /** @type {Record<string, Function[]>} */
    this.listeners = {};
    this._colorCache = new Map();
    this.reset();
    this._ro = new ResizeObserver(() => this._layout());
    this._ro.observe(host);
    this._layout();
  }

  _mkCanvas() {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    this.host.appendChild(c);
    return c;
  }

  // ---------------------------------------------------------------- public API

  /** 새 실행 준비: 그림, 큐, 거북이 모두 비움 */
  reset() {
    cancelAnimationFrame(this._raf || 0);
    this._raf = 0;
    this.scene = new Scene(); // 재생된 명령까지의 상태
    this.ahead = new Scene(); // 받은 명령 전체 상태 (화면 맞춤 계산용)
    /** @type {any[]} */ this.items = [];
    /** @type {any[]} */ this.queue = [];
    this.qi = 0;
    this.ended = false;
    this.cur = null;
    this.avail = 0;
    this._skip = false;
    this._idleSent = false;
    this._firstInk = 0;
    this._lastNow = 0;
    this._batch = null;
    /** @type {Map<number, {z:number, snap:HTMLCanvasElement|null}>} */ this.fills = new Map();
    /** @type {Map<number, number>} */ this.walk = new Map();
    this.viewHalf = { w: this.opts.view.w / 2, h: this.opts.view.h / 2 };
    this.bg = null;
    this.title = null;
    this.stats = { frameDts: /** @type {number[]} */ ([]), workMs: /** @type {number[]} */ ([]) };
    if (this.drawCv) this._layout();
  }

  /** @param {any[]} cmds */
  push(cmds) {
    let grew = false;
    for (const c of cmds) {
      this.queue.push(c);
      grew = this._track(this.ahead.apply(c)) || grew;
    }
    if (grew) this._layout();
    this._kick();
  }

  /** 더 받을 명령이 없음 (Python 실행 끝) */
  end() {
    this.ended = true;
    this._kick();
  }

  /** @param {number} m 1 = CPython과 비슷, Infinity = 바로 그리기 */
  setSpeedMultiplier(m) {
    this.multiplier = m;
    this._kick();
  }

  skipToEnd() {
    this._skip = true;
    this._kick();
  }

  /** 애니메이션 멈춤 (이미 그린 것은 둠, 남은 명령은 버림) */
  stop() {
    this.queue.length = this.qi;
    if (this.cur) {
      this._finish(this.cur);
      this.cur = null;
    }
    this.ended = true;
    this._kick();
  }

  isIdle() {
    return this.ended && !this.cur && this.qi >= this.queue.length;
  }

  setGrid(on) {
    this.opts.grid = !!on;
    this._paintBg();
  }

  /** @param {string} name @param {Function} fn */
  on(name, fn) {
    (this.listeners[name] ||= []).push(fn);
    return () => (this.listeners[name] = this.listeners[name].filter((f) => f !== fn));
  }

  getStats() {
    const d = this.stats.frameDts.slice().sort((a, b) => a - b);
    const w = this.stats.workMs.slice().sort((a, b) => a - b);
    const mean = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
    const pct = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0);
    return {
      frames: d.length,
      avgFps: mean ? 1000 / mean : 0,
      p95FrameMs: pct(d, 0.95),
      maxFrameMs: d.length ? d[d.length - 1] : 0,
      longFrames: d.filter((x) => x > 50).length,
      p95WorkMs: pct(w, 0.95),
      items: this.items.length,
      commands: this.queue.length,
    };
  }

  /**
   * 그림을 원하는 크기로 다시 그려 내보냄 (갤러리 썸네일용, 해상도 독립).
   * @param {{width?:number,height?:number,fit?:'content'|'view',padding?:number,turtles?:boolean,background?:boolean,grid?:boolean}} [o]
   */
  exportCanvas(o = {}) {
    this._flushBatch();
    const W = o.width ?? 512, H = o.height ?? 512, pad = o.padding ?? 24;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
    let rect;
    if ((o.fit ?? 'content') === 'content') rect = this.contentBounds();
    if (!rect) rect = { x0: -this.viewHalf.w, y0: -this.viewHalf.h, x1: this.viewHalf.w, y1: this.viewHalf.h };
    const rw = Math.max(rect.x1 - rect.x0, 1), rh = Math.max(rect.y1 - rect.y0, 1);
    const zoom = Math.min((W - 2 * pad) / rw, (H - 2 * pad) / rh);
    /** @type {Tf} */
    const tf = { dpr: 1, zoom, cx: W / 2 - ((rect.x0 + rect.x1) / 2) * zoom, cy: H / 2 + ((rect.y0 + rect.y1) / 2) * zoom };
    if (o.background !== false) {
      ctx.fillStyle = this.bg || this.opts.paper;
      ctx.fillRect(0, 0, W, H);
      if (o.grid) this._paintGrid(ctx, tf, W, H);
    }
    this._paintItems(ctx, tf, 0, this.items.length);
    if (o.turtles !== false) for (const t of this.scene.turtles.values()) this._paintTurtle(ctx, tf, t, t.x, t.y, t.h, 0);
    return cv;
  }

  /** @returns {Promise<Blob>} */
  exportPNG(o = {}) {
    const cv = this.exportCanvas(o);
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
  }

  /** 표시 목록 → SVG 문자열 (벡터 출력 비교용, 거북이 스프라이트 제외) */
  exportSVG(o = {}) {
    const rect = this.contentBounds() || { x0: -300, y0: -300, x1: 300, y1: 300 };
    const pad = o.padding ?? 10;
    const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    const n = (v) => +v.toFixed(2);
    const out = [];
    const vb = [rect.x0 - pad, -rect.y1 - pad, rect.x1 - rect.x0 + 2 * pad, rect.y1 - rect.y0 + 2 * pad].map(n);
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}">`);
    out.push(`<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="${esc(this.bg || this.opts.paper)}"/>`);
    let run = null;
    const flush = () => {
      if (run) out.push(`<path d="${run.d.join('')}" stroke="${esc(run.c)}" stroke-width="${run.w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
      run = null;
    };
    for (const it of this.items) {
      if (it.t === 'L') {
        if (!run || run.c !== it.c || run.w !== it.w) { flush(); run = { c: it.c, w: it.w, d: [], ex: NaN, ey: NaN }; }
        if (run.ex !== it.x0 || run.ey !== it.y0) run.d.push(`M${n(it.x0)} ${n(-it.y0)}`);
        run.d.push(`L${n(it.x1)} ${n(-it.y1)}`);
        run.ex = it.x1; run.ey = it.y1;
        continue;
      }
      flush();
      if (it.t === 'P') out.push(`<path d="M${it.pts.map((p) => `${n(p[0])} ${n(-p[1])}`).join('L')}Z" fill="${esc(it.c)}" fill-rule="${this.opts.fillRule}"/>`);
      else if (it.t === 'D') out.push(`<circle cx="${n(it.x)}" cy="${n(-it.y)}" r="${it.s / 2}" fill="${esc(it.c)}"/>`);
      else if (it.t === 'T') {
        const anchor = { left: 'start', center: 'middle', right: 'end' }[it.align];
        out.push(`<text x="${n(it.x)}" y="${n(-it.y)}" font-size="${n((it.size * 4) / 3)}" font-family="${esc(it.family)}, sans-serif" text-anchor="${anchor}" fill="${esc(it.c)}">${esc(it.text)}</text>`);
      }
    }
    flush();
    out.push('</svg>');
    return out.join('');
  }

  /** 그림 전체를 감싸는 세계 좌표 사각형 */
  contentBounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y, r = 0) => {
      if (x - r < x0) x0 = x - r;
      if (y - r < y0) y0 = y - r;
      if (x + r > x1) x1 = x + r;
      if (y + r > y1) y1 = y + r;
    };
    for (const it of this.items) {
      if (it.t === 'L') { add(it.x0, it.y0, it.w / 2); add(it.x1, it.y1, it.w / 2); }
      else if (it.t === 'P') for (const p of it.pts) add(p[0], p[1]);
      else if (it.t === 'D') add(it.x, it.y, it.s / 2);
      else if (it.t === 'S') add(it.x, it.y, 18);
      else if (it.t === 'T') {
        const px = (it.size * 4) / 3, wdt = textWidthGuess(it.text, px);
        const lx = it.align === 'left' ? it.x : it.align === 'center' ? it.x - wdt / 2 : it.x - wdt;
        add(lx, it.y); add(lx + wdt, it.y + px * 1.2 * String(it.text).split('\n').length);
      }
    }
    if (x0 === Infinity) return null;
    return { x0, y0, x1, y1 };
  }

  destroy() {
    cancelAnimationFrame(this._raf || 0);
    this._ro.disconnect();
    this.bgCv.remove(); this.drawCv.remove(); this.overCv.remove();
  }

  // ---------------------------------------------------------------- 배치/좌표

  _emit(name, ...args) {
    for (const fn of this.listeners[name] || []) fn(...args);
  }

  /** ahead 상태로 그림 범위를 추적해 화면을 키움. @returns {boolean} 키웠는지 */
  _track(op) {
    if (op.k === 'view') {
      this.viewHalf = { w: op.w / 2, h: op.h / 2 };
      return true;
    }
    if (this.opts.fit !== 'grow') return false;
    let x0, x1, y0, y1;
    if (op.k === 'move' || op.k === 'jump' || op.k === 'dot') {
      const x = op.k === 'dot' ? op.x : op.x1, y = op.k === 'dot' ? op.y : op.y1;
      const r = op.k === 'dot' ? op.size / 2 : Math.max(12, (op.width || 1) / 2);
      x0 = x - r; x1 = x + r; y0 = y - r; y1 = y + r;
    } else if (op.k === 'text') {
      const px = (op.size * 4) / 3, w = textWidthGuess(op.text, px);
      x0 = op.align === 'left' ? op.x : op.align === 'center' ? op.x - w / 2 : op.x - w;
      x1 = x0 + w; y0 = op.y; y1 = op.y + px * 1.2 * String(op.text).split('\n').length;
    } else return false;
    const m = 16;
    const needW = Math.max(Math.abs(x0), Math.abs(x1)) + m, needH = Math.max(Math.abs(y0), Math.abs(y1)) + m;
    let grew = false;
    if (needW > this.viewHalf.w) { this.viewHalf.w = Math.ceil(needW / 50) * 50; grew = true; }
    if (needH > this.viewHalf.h) { this.viewHalf.h = Math.ceil(needH / 50) * 50; grew = true; }
    return grew;
  }

  _layout() {
    const r = this.host.getBoundingClientRect();
    const cw = Math.max(1, r.width), ch = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
    for (const c of [this.bgCv, this.drawCv, this.overCv]) {
      c.width = Math.round(cw * dpr);
      c.height = Math.round(ch * dpr);
    }
    const zoom = Math.min(cw / (2 * this.viewHalf.w), ch / (2 * this.viewHalf.h));
    /** @type {Tf} */
    this.tf = { dpr, zoom, cx: cw / 2, cy: ch / 2 };
    this.cssSize = { w: cw, h: ch };
    this._paintBg();
    this._rerender();
    this._paintOverlay();
  }

  /** @param {CanvasRenderingContext2D} ctx @param {Tf} tf */
  _worldTf(ctx, tf) {
    ctx.setTransform(tf.dpr * tf.zoom, 0, 0, -tf.dpr * tf.zoom, tf.dpr * tf.cx, tf.dpr * tf.cy);
  }

  /** @param {CanvasRenderingContext2D} ctx @param {Tf} tf */
  _screenTf(ctx, tf) {
    ctx.setTransform(tf.dpr, 0, 0, tf.dpr, 0, 0);
  }

  // ---------------------------------------------------------------- 그리기

  _paintBg() {
    const ctx = this.bgCtx, tf = this.tf;
    if (!tf) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.bg || this.opts.paper;
    ctx.fillRect(0, 0, this.bgCv.width, this.bgCv.height);
    if (this.opts.grid) this._paintGrid(ctx, tf, this.cssSize.w, this.cssSize.h);
  }

  /** 좌표 모눈 (50 간격, 100마다 숫자) */
  _paintGrid(ctx, tf, W, H) {
    this._screenTf(ctx, tf);
    const wx0 = (0 - tf.cx) / tf.zoom, wx1 = (W - tf.cx) / tf.zoom;
    const wy0 = (tf.cy - H) / tf.zoom, wy1 = tf.cy / tf.zoom;
    const step = tf.zoom < 0.4 ? 100 : 50;
    ctx.lineWidth = 1;
    ctx.font = `11px ${KR_FONT_FALLBACK}`;
    ctx.fillStyle = 'rgba(94, 74, 60, 0.45)';
    for (let x = Math.ceil(wx0 / step) * step; x <= wx1; x += step) {
      const sx = Math.round(tf.cx + x * tf.zoom) + 0.5;
      ctx.strokeStyle = x === 0 ? 'rgba(94,74,60,0.35)' : 'rgba(94,74,60,0.10)';
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
      if (x !== 0 && x % 100 === 0) ctx.fillText(String(x), sx + 3, tf.cy - 4);
    }
    for (let y = Math.ceil(wy0 / step) * step; y <= wy1; y += step) {
      const sy = Math.round(tf.cy - y * tf.zoom) + 0.5;
      ctx.strokeStyle = y === 0 ? 'rgba(94,74,60,0.35)' : 'rgba(94,74,60,0.10)';
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
      if (y !== 0 && y % 100 === 0) ctx.fillText(String(y), tf.cx + 4, sy - 3);
    }
  }

  _clearDraw() {
    this._batch = null;
    this.drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawCtx.clearRect(0, 0, this.drawCv.width, this.drawCv.height);
  }

  _rerender() {
    if (!this.tf) return;
    this._clearDraw();
    // 열린 채우기가 있으면 시작 시점 스냅숏도 다시 만든다
    const zs = [...this.fills.values()].sort((a, b) => a.z - b.z);
    let from = 0;
    for (const f of zs) {
      this._paintItems(this.drawCtx, this.tf, from, f.z);
      from = f.z;
      f.snap = this._snapshot();
    }
    this._paintItems(this.drawCtx, this.tf, from, this.items.length);
  }

  _snapshot() {
    const c = document.createElement('canvas');
    c.width = this.drawCv.width; c.height = this.drawCv.height;
    /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(this.drawCv, 0, 0);
    return c;
  }

  /** items[from, to)를 ctx에 그림. 같은 색·굵기의 이어진 선은 path 하나로 묶음 */
  _paintItems(ctx, tf, from, to) {
    let open = false, c = '', w = -1, ex = NaN, ey = NaN, n = 0;
    const minW = 1 / tf.zoom;
    const maxSeg = this.opts.maxPathSegments;
    this._worldTf(ctx, tf);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = from; i < to; i++) {
      const it = this.items[i];
      if (it.t === 'L') {
        if (!open || it.c !== c || it.w !== w || n >= maxSeg) {
          if (open) ctx.stroke();
          c = it.c; w = it.w;
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
        ex = it.x1; ey = it.y1;
        continue;
      }
      if (open) { ctx.stroke(); open = false; }
      this._paintItem(ctx, tf, it);
      this._worldTf(ctx, tf);
    }
    if (open) ctx.stroke();
  }

  /** 선 이외 항목 */
  _paintItem(ctx, tf, it) {
    if (it.t === 'P') {
      this._worldTf(ctx, tf);
      ctx.fillStyle = it.c;
      ctx.beginPath();
      ctx.moveTo(it.pts[0][0], it.pts[0][1]);
      for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i][0], it.pts[i][1]);
      ctx.closePath();
      ctx.fill(this.opts.fillRule);
    } else if (it.t === 'D') {
      this._worldTf(ctx, tf);
      ctx.fillStyle = it.c;
      ctx.beginPath();
      ctx.arc(it.x, it.y, Math.max(it.s / 2, 0.5 / tf.zoom), 0, Math.PI * 2);
      ctx.fill();
    } else if (it.t === 'T') {
      this._paintText(ctx, tf, it);
    } else if (it.t === 'S') {
      const fake = { sh: it.shape, pc: it.pc, fc: it.fc, sz: it.sz, v: 1, id: -1 };
      this._paintTurtle(ctx, tf, fake, it.x, it.y, it.h, 0);
    }
  }

  _paintText(ctx, tf, it) {
    this._screenTf(ctx, tf);
    const px = ((it.size * 4) / 3) * tf.zoom;
    ctx.font = fontString(it, px);
    ctx.fillStyle = it.c;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = it.align === 'center' ? 'center' : it.align === 'right' ? 'right' : 'left';
    const lines = String(it.text).split('\n');
    const sx = tf.cx + it.x * tf.zoom - (it.align === 'left' ? tf.zoom : 0);
    let sy = tf.cy - it.y * tf.zoom;
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], sx, sy);
      sy -= px * 1.2;
    }
  }

  /** 확정 그림에 선 하나 추가 (같은 스타일이면 path에 이어 붙였다가 프레임 끝에 stroke) */
  _commitLine(it) {
    this.items.push(it);
    const ctx = this.drawCtx, tf = this.tf;
    const b = this._batch;
    if (!b || b.c !== it.c || b.w !== it.w || b.n >= this.opts.maxPathSegments) {
      this._flushBatch();
      this._worldTf(ctx, tf);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = it.c;
      ctx.lineWidth = Math.max(it.w, 1 / tf.zoom);
      ctx.beginPath();
      ctx.moveTo(it.x0, it.y0);
      this._batch = { c: it.c, w: it.w, ex: it.x0, ey: it.y0, n: 0 };
    }
    const bb = /** @type {any} */ (this._batch);
    bb.n++;
    if (bb.ex !== it.x0 || bb.ey !== it.y0) ctx.moveTo(it.x0, it.y0);
    ctx.lineTo(it.x1, it.y1);
    bb.ex = it.x1; bb.ey = it.y1;
    this._ink();
  }

  _flushBatch() {
    if (this._batch) {
      this.drawCtx.stroke();
      this._batch = null;
    }
  }

  _commitItem(it) {
    this._flushBatch();
    this.items.push(it);
    this._paintItem(this.drawCtx, this.tf, it);
    this._ink();
  }

  _ink() {
    if (!this._firstInk) {
      this._firstInk = performance.now();
      this._emit('firstInk', this._firstInk);
    }
  }

  // ---------------------------------------------------------------- 재생 루프

  _kick() {
    if (!this._raf) this._raf = requestAnimationFrame((t) => this._frame(t));
  }

  _frame(now) {
    this._raf = 0;
    const dt = this._lastNow ? Math.min(now - this._lastNow, 100) : TICK_MS;
    this._lastNow = now;
    const animating = !!this.cur || this.qi < this.queue.length;
    const m = this._skip ? Infinity : this.multiplier;
    this.avail = m === Infinity ? Infinity : this.avail + (dt / TICK_MS) * m;
    const t0 = performance.now();
    while (true) {
      if (!this.cur) {
        if (this.qi >= this.queue.length) break;
        if (performance.now() - t0 > this.opts.frameBudgetMs) break;
        this.cur = this._begin(this.queue[this.qi++], m);
        if (!this.cur) continue;
      }
      if (this.cur.wait) break; // 글꼴 로딩 대기
      const need = this.cur.dur - this.cur.prog;
      if (need <= this.avail) {
        this.avail -= need;
        this._finish(this.cur);
        this.cur = null;
        continue;
      }
      this.cur.prog += this.avail;
      this._advanceWalk(this.cur, this.avail);
      this.avail = 0;
      break;
    }
    this._flushBatch();
    if (!this.cur && this.qi >= this.queue.length) this.avail = 0; // 기다리는 동안 시간 저축 금지
    if (this.avail === Infinity) this.avail = 0;
    else this.avail = Math.min(this.avail, 2 * m);
    this._paintOverlay();
    const work = performance.now() - t0;
    if (animating) {
      this.stats.frameDts.push(dt);
      this.stats.workMs.push(work);
    }
    if (this.cur || this.qi < this.queue.length) {
      this._kick();
    } else {
      this._lastNow = 0;
      if (this.ended) {
        this._skip = false;
        if (!this._idleSent) {
          this._idleSent = true;
          this._emit('idle');
        }
      }
    }
  }

  /** 명령 하나 시작. 즉시 끝나는 명령이면 처리하고 null */
  _begin(cmd, m) {
    const op = this.scene.apply(cmd);
    const instant = m === Infinity;
    switch (op.k) {
      case 'move': {
        const dist = Math.hypot(op.x1 - op.x0, op.y1 - op.y0);
        const dur = instant ? 0 : moveTicks(dist, op.speed);
        const a = { op, dur, prog: 0 };
        if (!dur) { this._finish(a); return null; }
        return a;
      }
      case 'turn': {
        const dur = instant || !op.t.v ? 0 : turnTicks(op.delta, op.speed);
        return dur ? { op, dur, prog: 0 } : null;
      }
      case 'dot':
      case 'stamp':
      case 'text': {
        const a = { op, dur: instant || !op.t.sp || !this.scene.tracer ? 0 : 1, prog: 0, wait: null };
        if (op.k === 'text') {
          const font = fontString(op, 16);
          if (document.fonts && !document.fonts.check(font, op.text)) {
            a.wait = Promise.race([
              document.fonts.load(font, op.text),
              new Promise((r) => setTimeout(r, 2000)),
            ]).then(() => { a.wait = null; this._kick(); });
          }
        }
        if (!a.dur && !a.wait) { this._finish(a); return null; }
        return a;
      }
      case 'beginFill': {
        this._flushBatch();
        if (!op.restart || !this.fills.has(op.t.id)) {
          this.fills.set(op.t.id, { z: this.items.length, snap: this._snapshot() });
        }
        return null;
      }
      case 'endFill': {
        const f = this.fills.get(op.t.id);
        this.fills.delete(op.t.id);
        if (f && op.points) this._insertFill(f, { t: 'P', tid: op.t.id, pts: op.points, c: op.color });
        return null;
      }
      case 'clear':
        this._removeItems((it) => it.tid === op.t.id);
        this.fills.delete(op.t.id);
        this._rerender();
        return null;
      case 'clearStamp':
        this._removeItems((it) => it.t === 'S' && it.sid === op.sid);
        this._rerender();
        return null;
      case 'clearScreen':
        this.items = [];
        this.fills.clear();
        this.bg = null;
        this._paintBg();
        this._rerender();
        return null;
      case 'bg':
        this.bg = op.color;
        this._paintBg();
        return null;
      case 'title':
        this.title = op.text;
        this._emit('title', op.text);
        return null;
      default:
        return null;
    }
  }

  _finish(a) {
    const op = a.op;
    if (op.k === 'move') {
      this._advanceWalk(a, a.dur - a.prog);
      if (op.draw && (op.x0 !== op.x1 || op.y0 !== op.y1)) {
        this._commitLine({ t: 'L', tid: op.t.id, x0: op.x0, y0: op.y0, x1: op.x1, y1: op.y1, c: op.color, w: op.width });
      } else if (op.draw) {
        // forward(0): CPython은 펜 굵기만큼 점이 찍힘
        this._commitItem({ t: 'D', tid: op.t.id, x: op.x0, y: op.y0, s: op.width, c: op.color });
      }
    } else if (op.k === 'dot') {
      this._commitItem({ t: 'D', tid: op.t.id, x: op.x, y: op.y, s: op.size, c: op.color });
    } else if (op.k === 'text') {
      this._commitItem({ t: 'T', tid: op.t.id, x: op.x, y: op.y, text: op.text, align: op.align, family: op.family, size: op.size, style: op.style, c: op.color });
    } else if (op.k === 'stamp') {
      this._commitItem({ t: 'S', tid: op.t.id, sid: op.sid, x: op.x, y: op.y, h: op.h, shape: op.shape, pc: op.pc, fc: op.fc, sz: op.sz });
    }
  }

  /** 채우기를 begin_fill 시점의 z 위치에 끼워 넣음 (CPython: 채우기가 그동안 그린 선 아래) */
  _insertFill(f, poly) {
    this._flushBatch();
    this.items.splice(f.z, 0, poly);
    for (const g of this.fills.values()) if (g.z > f.z) g.z++;
    const ctx = this.drawCtx;
    if (f.z === this.items.length - 1) {
      this._paintItem(ctx, this.tf, poly);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.drawCv.width, this.drawCv.height);
      if (f.snap && f.snap.width === this.drawCv.width && f.snap.height === this.drawCv.height) {
        ctx.drawImage(f.snap, 0, 0);
        this._paintItems(ctx, this.tf, f.z, this.items.length);
      } else {
        this._paintItems(ctx, this.tf, 0, this.items.length);
      }
    }
    this._ink();
  }

  _removeItems(pred) {
    const keep = [];
    const remap = new Map();
    for (const f of this.fills.values()) remap.set(f, 0);
    for (let i = 0; i < this.items.length; i++) {
      for (const f of this.fills.values()) if (i < f.z && !pred(this.items[i])) remap.set(f, /** @type {number} */ (remap.get(f)) + 1);
      if (!pred(this.items[i])) keep.push(this.items[i]);
    }
    for (const [f, z] of remap) f.z = z;
    this.items = keep;
  }

  _advanceWalk(a, ticks) {
    if (a.op.k !== 'move' || !ticks) return;
    const dist = Math.hypot(a.op.x1 - a.op.x0, a.op.y1 - a.op.y0);
    const id = a.op.t.id;
    this.walk.set(id, (this.walk.get(id) || 0) + (dist * ticks) / a.dur);
  }

  // ---------------------------------------------------------------- 오버레이 & 스프라이트

  _paintOverlay() {
    const ctx = this.overCtx, tf = this.tf;
    if (!tf) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overCv.width, this.overCv.height);
    const cur = this.cur;
    let animId = -1, ax = 0, ay = 0, ah = 0;
    if (cur && !cur.wait && (cur.op.k === 'move' || cur.op.k === 'turn')) {
      const f = cur.dur ? cur.prog / cur.dur : 1;
      const op = cur.op;
      animId = op.t.id;
      if (op.k === 'move') {
        ax = op.x0 + (op.x1 - op.x0) * f;
        ay = op.y0 + (op.y1 - op.y0) * f;
        ah = op.t.h;
        if (op.draw && f > 0) {
          this._worldTf(ctx, tf);
          ctx.lineCap = 'round';
          ctx.strokeStyle = op.color;
          ctx.lineWidth = Math.max(op.width, 1 / tf.zoom);
          ctx.beginPath();
          ctx.moveTo(op.x0, op.y0);
          ctx.lineTo(ax, ay);
          ctx.stroke();
          this._ink();
        }
      } else {
        ax = op.t.x; ay = op.t.y;
        ah = op.h0 + op.delta * f;
      }
    }
    for (const t of this.scene.turtles.values()) {
      if (!t.v) continue;
      const walking = this.reducedMotion ? 0 : this.walk.get(t.id) || 0;
      if (t.id === animId) this._paintTurtle(ctx, tf, t, ax, ay, ah, walking);
      else this._paintTurtle(ctx, tf, t, t.x, t.y, t.h, walking);
    }
  }

  /** CSS 색 → [r,g,b] */
  _rgb(css) {
    let v = this._colorCache.get(css);
    if (!v) {
      const c = (this._cc ||= /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d')));
      c.fillStyle = '#000';
      c.fillStyle = css;
      const s = String(c.fillStyle);
      v = s.startsWith('#') ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : (s.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
      this._colorCache.set(css, v);
    }
    return v;
  }

  _mix(css, toward, k) {
    const a = this._rgb(css), b = this._rgb(toward);
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(',')})`;
  }

  /**
   * 거북이(또는 도장) 그리기. 화면 좌표계, 동쪽을 향하게 그린 뒤 회전.
   * @param {CanvasRenderingContext2D} ctx @param {Tf} tf
   */
  _paintTurtle(ctx, tf, t, x, y, h, walk) {
    let shape = t.sh;
    if (shape === 'blank') return;
    if (shape === 'classic' && this.opts.classicAs === 'turtle') shape = 'turtle';
    const scale = Math.min(1.6, Math.max(0.95, tf.zoom * 1.35)); // 아이들 눈에 잘 보이게 CPython보다 조금 크게
    const [sw, sl] = t.sz || [1, 1];
    this._screenTf(ctx, tf);
    ctx.save();
    ctx.translate(tf.cx + x * tf.zoom, tf.cy - y * tf.zoom);
    ctx.rotate((-h * Math.PI) / 180);
    ctx.scale(scale * sl, scale * sw);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // 채우기 색이 기본(검정)이면 파스텔 초록 등껍질 (펜 색은 테두리로 살림)
    const isDefault = t.fc === 'black' && this.opts.kidColors;
    if (shape === 'turtle') this._spriteTurtle(ctx, t, isDefault, walk);
    else if (shape === 'pybaem') this._spritePybaem(ctx, walk);
    else {
      const polys = {
        classic: [[0, 0], [-14, 8], [-11, 0], [-14, -8]],
        arrow: [[10, 0], [0, 10], [0, -10]],
        triangle: [[11.55, 0], [-5.77, 10], [-5.77, -10]],
        square: [[10, 10], [-10, 10], [-10, -10], [10, -10]],
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

  _spriteTurtle(ctx, t, isDefault, walk) {
    const shell = isDefault ? KID.shell : t.fc;
    const body = isDefault ? KID.body : this._mix(t.fc, '#ffffff', 0.55);
    const line = t.pc === 'black' && isDefault ? KID.line : this._mix(t.pc, '#000000', 0.15);
    const sw = Math.sin(walk / 5) * 0.45;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = line;
    ctx.fillStyle = body;
    // 다리 4개 (걸을 때 앞뒤로 흔들림)
    for (const [lx, ly, ph] of [[8, 10, 1], [8, -10, -1], [-8, 10, -1], [-8, -10, 1]]) {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(sw * ph + (ly > 0 ? 0.5 : -0.5));
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.2, 3.6, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // 꼬리
    ctx.beginPath();
    ctx.moveTo(-12, 3); ctx.lineTo(-19, 0); ctx.lineTo(-12, -3); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 머리
    ctx.beginPath();
    ctx.arc(16, 0, 6.6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // 등껍질
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = shell;
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    const hx = [[-4.5, 0], [-2.2, 4], [2.2, 4], [4.5, 0], [2.2, -4], [-2.2, -4]];
    ctx.moveTo(hx[0][0], hx[0][1]);
    for (const p of hx.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    for (const [a, b] of [[-4.5, 0], [-2.2, 4], [2.2, 4], [4.5, 0], [2.2, -4], [-2.2, -4]]) {
      ctx.moveTo(a, b); ctx.lineTo(a * 2.4, b * 2.2);
    }
    ctx.stroke();
    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-3, 5.5, 5, 2.2, -0.3, 0, Math.PI * 2); ctx.fill();
    // 눈 + 볼
    for (const ey of [3, -3]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(18.4, ey, 2.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(19.2, ey, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,138,128,0.8)';
    for (const ey of [4.8, -4.8]) { ctx.beginPath(); ctx.arc(14.6, ey, 1.3, 0, Math.PI * 2); ctx.fill(); }
  }

  /** 파이뱀(뱀 마스코트) 테마 스프라이트 — 디자인 시안용 자리 표시 */
  _spritePybaem(ctx, walk) {
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
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = KID.body;
    ctx.beginPath(); ctx.ellipse(9, 0, 5.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#E91E63';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(22, 0); ctx.lineTo(24, 2); ctx.moveTo(22, 0); ctx.lineTo(24, -2); ctx.stroke();
    for (const ey of [4.2, -4.2]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(9, ey, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(10.2, ey, 1.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(-4, -8); ctx.lineTo(0, -6); ctx.lineTo(2, -10); ctx.lineTo(3, -6); ctx.lineTo(6, -8); ctx.lineTo(4, -3); ctx.closePath(); ctx.fill();
  }
}

/** Tk 글꼴 (family, size pt, style) → CSS font 문자열. 한글 대체 글꼴을 항상 붙임 */
export function fontString(it, px) {
  const st = String(it.style || 'normal').toLowerCase();
  const parts = [];
  if (st.includes('italic')) parts.push('italic');
  if (st.includes('bold')) parts.push('bold');
  const fam = String(it.family || 'Arial').replace(/["\\]/g, '');
  return `${parts.join(' ')} ${Math.max(1, px).toFixed(1)}px "${fam}", ${KR_FONT_FALLBACK}`.trim();
}

export function textWidthGuess(text, px) {
  let w = 0, max = 0;
  for (const ch of String(text)) {
    if (ch === '\n') { max = Math.max(max, w); w = 0; continue; }
    w += ch.codePointAt(0) > 0x2e80 ? px : px * 0.56;
  }
  return Math.max(max, w);
}
