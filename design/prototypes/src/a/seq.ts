// 시그니처 모션 시퀀서 (P2-05). 연출 하나 = 처음에 모두 만들어 둔 WAAPI 애니메이션(delay로 시작 시각) + 시각별 상태 콜백.
// - 같은 연출을 #motion 무대(다시 보기·일시정지·타임라인 스크럽)와 실제 흐름(퀘스트 성공·지도 해제·레벨업)이 함께 쓴다
// - seek(t): 모든 애니메이션을 멈추고 currentTime = t, 상태 콜백은 reset 후 t까지 순서대로 다시 적용 → 진행 중 프레임을 그대로 볼 수 있다
// - 단계(mode)별로 연출을 바꾸는 도우미: appear / squish / fly / particles. 반복 루프는 쓰지 않는다(일회성만, transform·opacity만)
import { springTiming } from '../shared/motion';
import type { SpringName } from '../shared/tokens';
import { EASING } from '../shared/tokens';

export type Mode = 'full' | 'lite' | 'minimal' | 'reduced';

export interface Beat {
  label: string;
  at: number;
  dur: number;
  ease: string;
}

interface Call {
  at: number;
  fn: () => void;
  done: boolean;
}
interface Tick {
  at: number;
  dur: number;
  fn: (u: number) => void;
}

export const MODE_NOTE: Record<Mode, string> = {
  full: '스프링·젤리·바운스 전부, 파티클 100%, 흐림 그림자, 리그 60fps',
  lite: '길이 70%, 젤리 → body 스프링, 파티클 30%, 코인 1개, 앰비언트·흐림 끔, 리그 30fps',
  minimal: '이동·튀어오름 없음, 150ms 페이드와 숫자 교체만, 파티클 0, 리그는 전환만',
  reduced: '움직임 0: 즉시 바뀌고 색·글자·표정으로만 알림, 마스코트는 느린 눈 깜빡임(Q26)',
};
export const MODE_LABEL: Record<Mode, string> = { full: 'full', lite: 'lite', minimal: 'minimal', reduced: '동작 줄이기' };

export class Seq {
  readonly mode: Mode;
  beats: Beat[] = [];
  total = 0;
  private anims: Animation[] = [];
  private calls: Call[] = [];
  private ticks: Tick[] = [];
  private made: Element[] = [];
  private raf = 0;
  private t0 = 0;
  private resetFn: () => void;
  onTime?: (t: number, playing: boolean) => void;
  onEnd?: () => void;

  constructor(mode: Mode, reset: () => void = () => {}) {
    this.mode = mode;
    this.resetFn = reset;
  }

  get moves() {
    return this.mode === 'full' || this.mode === 'lite';
  }
  /** 비트 간격·길이 배율: lite 70%, minimal·동작 줄이기도 70%(읽을 시간은 남김) */
  s(ms: number) {
    return this.mode === 'full' ? ms : Math.round(ms * 0.7);
  }
  /** 파티클 개수 상한: full 100%, lite 30%, minimal·동작 줄이기 0 */
  n(full: number) {
    return this.mode === 'full' ? full : this.mode === 'lite' ? Math.max(1, Math.round(full * 0.3)) : 0;
  }

  beat(label: string, at: number, dur: number, ease: string) {
    this.beats.push({ label, at, dur, ease });
    this.total = Math.max(this.total, at + dur);
  }

  /** 원시 WAAPI: delay = at. 멈춘 채로 만든다 (play/seek가 움직임) */
  anim(el: Element | null | undefined, kf: Keyframe[], at: number, timing: { duration: number; easing?: string; fill?: FillMode }) {
    if (!el) return null;
    const a = el.animate(kf, { delay: at, duration: Math.max(1, timing.duration), easing: timing.easing ?? 'linear', fill: timing.fill ?? 'both' });
    a.pause();
    a.currentTime = 0;
    this.anims.push(a);
    this.total = Math.max(this.total, at + timing.duration);
    return a;
  }

  /** 시각 at에 상태 바꾸기 (seek할 때 다시 적용되므로 멱등이어야 함) */
  call(at: number, fn: () => void) {
    this.calls.push({ at, fn, done: false });
    this.calls.sort((a, b) => a.at - b.at);
  }
  /** 숫자 올리기처럼 JS로 그리는 구간 (rAF는 연출 중에만) */
  tick(at: number, dur: number, fn: (u: number) => void) {
    this.ticks.push({ at, dur, fn });
    this.total = Math.max(this.total, at + dur);
  }
  /** 연출용 요소를 만들어 붙이고 끝나면 지운다 */
  make(parent: Element, tag: string, cls: string, html = ''): HTMLElement {
    const el = document.createElement(tag);
    el.className = cls;
    if (html) el.innerHTML = html;
    parent.appendChild(el);
    this.made.push(el);
    return el;
  }

  // ───────────── 단계별 도우미

  /**
   * 나타나기. full: kf + spring / lite: liteKf(없으면 kf) + liteSpring / minimal: 150ms 페이드 / 동작 줄이기: 즉시
   * kf의 첫 프레임이 "나타나기 전", 마지막이 "제자리"
   */
  appear(
    el: Element | null | undefined,
    at: number,
    kf: Keyframe[],
    o: { spring?: SpringName; liteSpring?: SpringName; liteKf?: Keyframe[]; duration?: number; easing?: string; fill?: FillMode } = {},
  ) {
    if (!el) return;
    if (this.mode === 'reduced') {
      this.anim(el, [{ opacity: 0 }, { opacity: 1 }], at, { duration: 1, fill: o.fill });
      return;
    }
    if (this.mode === 'minimal') {
      this.anim(el, [{ opacity: 0 }, { opacity: 1 }], at, { duration: 150, fill: o.fill });
      return;
    }
    const withOp = (k: Keyframe[]) => k.map((f, i) => ({ opacity: i === 0 ? 0 : 1, ...f }));
    if (this.mode === 'lite') {
      const t = o.liteSpring ? springTiming(o.liteSpring) : { duration: Math.round((o.duration ?? 400) * 0.7), easing: o.easing ?? EASING.out };
      this.anim(el, withOp(o.liteKf ?? kf), at, { ...t, fill: o.fill });
      return;
    }
    const t = o.spring ? springTiming(o.spring) : { duration: o.duration ?? 400, easing: o.easing ?? EASING.out };
    this.anim(el, withOp(kf), at, { ...t, fill: o.fill });
  }

  /** 사라지기 (minimal 페이드, 동작 줄이기 즉시) */
  vanish(el: Element | null | undefined, at: number, kf: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }], duration = 300) {
    if (!el) return;
    if (!this.moves) {
      this.anim(el, [{ opacity: 1 }, { opacity: 0 }], at, { duration: this.mode === 'minimal' ? 150 : 1 });
      return;
    }
    this.anim(el, kf, at, { duration: this.s(duration), easing: EASING.out });
  }

  /** 젤리 스퀴시 (scale 1.22/0.78 90ms → jellyA, lite 1.12/0.88 → body). minimal·동작 줄이기: 없음 */
  squish(el: Element | null | undefined, at: number, strong = 1) {
    if (!el || !this.moves) return;
    const lite = this.mode === 'lite';
    const a = lite ? 0.12 : 0.22 * strong;
    const sq = `scale(${1 + a}, ${1 - a})`;
    this.anim(el, [{ transform: 'none' }, { transform: sq }], at, { duration: 90, easing: EASING.out, fill: 'none' });
    this.anim(el, [{ transform: sq }, { transform: 'none' }], at + 90, { ...springTiming(lite ? 'body' : 'jellyA'), fill: 'none' });
  }

  /** 움직임 전용 (튀기·흔들기). minimal·동작 줄이기에서는 생략 */
  wiggle(el: Element | null | undefined, at: number, kf: Keyframe[], duration: number, easing = EASING.out) {
    if (!el || !this.moves) return;
    this.anim(el, kf, at, { duration: this.s(duration), easing, fill: 'none' });
  }

  // ───────────── 재생

  play(from = 0) {
    this.stopLoop();
    this.applyCalls(-1);
    if (from > 0) {
      this.applyCalls(from);
      this.applyTicks(from);
    }
    this.anims.forEach((a) => {
      a.currentTime = from;
      a.play();
    });
    this.t0 = performance.now() - from;
    const loop = (now: number) => {
      const t = now - this.t0;
      this.applyCalls(t, true);
      this.applyTicks(t);
      this.onTime?.(t, true);
      if (t > this.total + 60) {
        this.raf = 0;
        this.onTime?.(this.total, false);
        this.onEnd?.();
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** 시각 t에서 멈춘 화면 */
  seek(t: number) {
    this.stopLoop();
    this.applyCalls(-1);
    this.anims.forEach((a) => {
      a.pause();
      a.currentTime = t;
    });
    this.applyCalls(t);
    this.applyTicks(t);
    this.onTime?.(t, false);
  }

  /** 끝 상태로 바로 (연출 없이) */
  finish() {
    this.seek(this.total + 1);
  }

  cancel() {
    this.stopLoop();
    this.anims.forEach((a) => a.cancel());
    this.anims = [];
    this.made.forEach((e) => e.remove());
    this.made = [];
  }

  private stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** t < 0이면 처음 상태로 되돌림 */
  private applyCalls(t: number, incremental = false) {
    if (t < 0) {
      this.resetFn();
      this.calls.forEach((c) => (c.done = false));
      return;
    }
    for (const c of this.calls) {
      if (c.at <= t && (!incremental || !c.done)) {
        if (!c.done || !incremental) c.fn();
        c.done = true;
      }
    }
  }
  private applyTicks(t: number) {
    for (const k of this.ticks) {
      if (t < k.at) continue;
      k.fn(Math.min(1, k.dur ? (t - k.at) / k.dur : 1));
    }
  }
}

// ───────────── 공용 조각

export const COIN_SVG =
  '<svg viewBox="0 0 32 32" width="30" height="30"><circle cx="16" cy="17.5" r="12" fill="#E09A00"/><circle cx="16" cy="15.5" r="12" fill="#FFC93C"/><circle cx="16" cy="15.5" r="8" fill="none" stroke="#E09A00" stroke-width="1.6" opacity=".7"/><path d="M13.5 11.5h4a2 2 0 0 1 0 4h-4v4.5M13.5 15.5h4" stroke="#E09A00" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="11" cy="9.5" rx="3.2" ry="1.6" fill="#fff" opacity=".7" transform="rotate(-30 11 9.5)"/></svg>';
export const GEM_SVG =
  '<svg viewBox="0 0 32 32" width="26" height="26"><path d="M8 5h16l5 7-13 16L3 12z" fill="#5EC8F2"/><path d="M3 12h26M12 5l-3 7 7 16 7-16-3-7" fill="none" stroke="#1F8FC4" stroke-width="1.2" opacity=".6"/><path d="M9.5 8l-2 3" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/></svg>';
const SPARK_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2c.8 5.6 2.6 7.4 8 8.2-5.4.8-7.2 2.6-8 8.2-.8-5.6-2.6-7.4-8-8.2 5.4-.8 7.2-2.6 8-8.2z" fill="#FFD84D"/><ellipse cx="10" cy="8" rx="1.4" ry="2.4" fill="#fff" opacity=".7"/></svg>';
const CONFETTI = ['#FF7A6B', '#FFD84D', '#5CCB72', '#6CC4F2', '#B9A3FF', '#FF9E3D'];

/** 중심 좌표 (host 기준) */
export function centerIn(el: Element, host: Element) {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 };
}

/** 반짝이 터짐: (x,y)에서 n개가 둥글게 튀어나감 */
export function burst(seq: Seq, layer: Element, x: number, y: number, at: number, count: number, dist = 60) {
  const n = seq.n(count);
  for (let i = 0; i < n; i++) {
    const s = seq.make(layer, 'span', 'a-fx-spark', SPARK_SVG);
    s.style.left = `${x - 9}px`;
    s.style.top = `${y - 9}px`;
    const ang = (i / n) * Math.PI * 2 + 0.4;
    const d = dist + (i % 2) * dist * 0.4;
    seq.anim(
      s,
      [
        { transform: 'translate(0,0) scale(0.2)', opacity: 0 },
        { transform: 'translate(0,0) scale(0.4)', opacity: 1, offset: 0.05 },
        { transform: `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(ang) * d * 1.1}px, ${Math.sin(ang) * d * 1.1 + 12}px) scale(0.5)`, opacity: 0 },
      ],
      at,
      { duration: seq.s(620), easing: EASING.out },
    );
  }
}

/**
 * 코인 튀어나옴 → HUD로 (무드보드 A 표): 포물선 420ms + 뒤집기 3바퀴(scaleX 코사인) → HUD 480ms inOut. 60ms 간격.
 * 돌려주는 값 = 첫 코인이 HUD에 닿는 시각, 마지막이 닿는 시각
 */
export function coins(seq: Seq, layer: Element, from: { x: number; y: number }, to: { x: number; y: number }, at: number, count: number, svg = COIN_SVG, size = 30) {
  const n = seq.mode === 'full' ? count : seq.mode === 'lite' ? 1 : 0;
  const up = seq.s(420);
  const fly = seq.s(480);
  for (let i = 0; i < n; i++) {
    const c = seq.make(layer, 'span', 'a-fx-coin', svg);
    c.style.left = `${from.x - size / 2}px`;
    c.style.top = `${from.y - size / 2}px`;
    const spread = (i - (n - 1) / 2) * 30;
    const kf: Keyframe[] = [];
    for (let s = 0; s <= 10; s++) {
      const u = s / 10;
      const y = -110 * (1 - (1 - u) ** 2) + 18 * u * u;
      kf.push({ transform: `translate(${spread * u}px, ${y}px) scaleX(${Math.cos(u * Math.PI * 6).toFixed(3)})`, opacity: s === 0 ? 0 : 1, offset: u });
    }
    const t1 = at + i * 60;
    seq.anim(c, kf, t1, { duration: up, fill: 'backwards' });
    const tx = to.x - from.x;
    const ty = to.y - from.y;
    seq.anim(c, [{ transform: `translate(${spread}px, -92px)`, opacity: 1 }, { transform: `translate(${tx}px, ${ty}px) scale(0.6)`, opacity: 1, offset: 0.92 }, { transform: `translate(${tx}px, ${ty}px) scale(0.6)`, opacity: 0 }], t1 + up, {
      duration: fly,
      easing: EASING.inOut,
      fill: 'forwards',
    });
  }
  const first = at + up + fly;
  return { first, last: first + Math.max(0, n - 1) * 60 };
}

/** 컨페티 (가벼운 DOM 파티클, transform·opacity만). full count / lite 30% / minimal·동작 줄이기 0 */
export function confetti(seq: Seq, layer: Element, x: number, y: number, at: number, count: number, spread = 1) {
  const n = seq.n(count);
  let s = 7;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < n; i++) {
    const p = seq.make(layer, 'span', `a-fx-conf a-fx-conf-${i % 3}`);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = CONFETTI[i % CONFETTI.length];
    const ang = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.3;
    const v = (160 + rnd() * 200) * spread;
    const dx = Math.cos(ang) * v;
    const dy = Math.sin(ang) * v;
    const rot = (rnd() - 0.5) * 720;
    const kf: Keyframe[] = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      // 위로 튀었다가 중력으로 떨어짐
      const px = dx * u;
      const py = dy * u + 420 * u * u;
      kf.push({ transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${(rot * u).toFixed(0)}deg) scaleY(${Math.cos(u * 9 + i).toFixed(2)})`, opacity: k === 0 ? 0 : k > 6 ? 1 - (k - 6) / 2 : 1, offset: u });
    }
    seq.anim(p, kf, at + Math.round(rnd() * 120), { duration: seq.s(1300 + rnd() * 400) });
  }
}
