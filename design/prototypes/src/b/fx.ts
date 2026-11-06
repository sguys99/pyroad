// 시안 B 모션 도우미 (P2-03). 시그니처: 페이지 넘김 · 잉크 번짐 · 스탬프 쾅 · 잉크 길
// - 모두 일회성 WAAPI. 반복 연출은 CSS(transform·opacity)에서만
// - 단계 분기: full 그대로 / lite 70%·곁가지 없음 / minimal 150ms 페이드 / 동작 줄이기 즉시 (무드보드 §4.2 표)
// - 축하는 celebrate(kind) 한 함수로 모은다 → P2-05에서 이 함수만 풍성하게 바꾼다
import { EASING } from '../shared/tokens';
import { getMotion, springTiming } from '../shared/motion';

const m = () => getMotion();
export const isStill = () => m().reduced;
export const isMinimal = () => m().reduced || m().tier === 'minimal';
export const isLite = () => m().tier === 'lite';

/** 게임 버튼 복귀: B는 묵직한 jellyB (lite는 face, minimal·동작 줄이기는 없음) */
export function pressRelease(el: HTMLElement | null) {
  if (!el || isMinimal()) return;
  if (isLite()) {
    el.animate([{ transform: 'translateY(3px)' }, { transform: 'none' }], springTiming('face'));
    return;
  }
  el.animate([{ transform: 'translateY(4px) scale(1.03, 0.96) rotate(-0.6deg)' }, { transform: 'none' }], springTiming('jellyB'));
}

/** 잉크 얼룩 모양 마스크 (필터 없이 모양으로 번짐 → 저사양에서도 가벼움) */
export const BLOT = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 8 C63 6 70 18 80 20 C93 23 95 38 90 48 C86 57 96 66 89 77 C82 88 66 84 57 92 C48 99 36 92 28 86 C17 79 6 74 9 60 C11 50 3 42 9 32 C16 20 33 22 38 14 C42 9 45 9 50 8Z'/><circle cx='93' cy='22' r='4'/><circle cx='8' cy='84' r='3'/><circle cx='84' cy='94' r='2.5'/></svg>",
)}")`;
const ROUND = 'radial-gradient(circle, #000 49%, transparent 50%)';

/** 잉크 번짐으로 나타나기 (출력 창·삽화). origin은 마스크 중심 */
export function inkReveal(el: HTMLElement | null, origin = '30% 40%', ms = 800) {
  if (!el || isStill()) return;
  el.getAnimations().forEach((a) => a.cancel());
  if (m().tier === 'minimal') {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    return;
  }
  const lite = isLite();
  const s = el.style as CSSStyleDeclaration & { webkitMaskImage: string; webkitMaskPosition: string; webkitMaskRepeat: string };
  s.maskImage = s.webkitMaskImage = lite ? ROUND : BLOT;
  s.maskPosition = s.webkitMaskPosition = origin;
  s.maskRepeat = s.webkitMaskRepeat = 'no-repeat';
  const clear = () => {
    s.maskImage = s.webkitMaskImage = 'none';
  };
  el.animate(
    [{ maskSize: '0% 0%', webkitMaskSize: '0% 0%' } as Keyframe, { maskSize: '320% 320%', webkitMaskSize: '320% 320%' } as Keyframe],
    { duration: lite ? 360 : ms, easing: EASING.ink },
  ).finished.then(clear, clear);
}

/** 잉크 길 그리기 (stroke-dashoffset 일회성) */
export function drawPath(path: SVGPathElement | null, delay = 0, ms = 1100): number {
  if (!path || isStill()) return 0;
  const len = path.getTotalLength();
  if (m().tier === 'minimal') {
    path.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay, fill: 'backwards' });
    return delay + 150;
  }
  const d = isLite() ? Math.round(ms * 0.45) : ms;
  path.style.strokeDasharray = `${len} ${len}`;
  path
    .animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: d, delay, easing: EASING.ink, fill: 'backwards' })
    .finished.then(
      () => (path.style.strokeDasharray = ''),
      () => (path.style.strokeDasharray = ''),
    );
  return delay + d;
}

/** 스탬프 쾅: 가속 내려찍기 → body 스프링 안착 + 종이 흔들림 + 잉크 튐 */
export function stampSlam(stamp: HTMLElement | null, opts: { paper?: HTMLElement | null; delay?: number; rot?: number; splat?: boolean } = {}) {
  if (!stamp || isStill()) return;
  const rot = opts.rot ?? -8;
  const delay = opts.delay ?? 0;
  if (m().tier === 'minimal') {
    stamp.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay, fill: 'backwards' });
    return;
  }
  const lite = isLite();
  stamp
    .animate(
      [
        { transform: `scale(2.3) rotate(${rot - 14}deg)`, opacity: 0 },
        { transform: `scale(0.9) rotate(${rot - 2}deg)`, opacity: 1 },
      ],
      { duration: lite ? 160 : 220, delay, easing: EASING.stampIn, fill: 'backwards' },
    )
    .finished.then(() => {
      stamp.animate([{ transform: `scale(0.9) rotate(${rot - 2}deg)` }, { transform: `rotate(${rot}deg)` }], springTiming('body'));
      if (lite) return;
      opts.paper?.animate(
        [{ transform: 'translate(0,0)' }, { transform: 'translate(2px,1px)' }, { transform: 'translate(-2px,0)' }, { transform: 'translate(0,0)' }],
        { duration: 120, easing: 'steps(3, end)' },
      );
      if (opts.splat !== false) splat(stamp);
    })
    .catch(() => {});
}

/** 스탬프 둘레로 잉크 방울 6개 (일회성 DOM, 끝나면 제거) */
function splat(at: HTMLElement) {
  const host = at.parentElement;
  if (!host) return;
  const r = at.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const cx = r.left - hr.left + r.width / 2;
  const cy = r.top - hr.top + r.height / 2;
  for (let i = 0; i < 7; i++) {
    const d = document.createElement('i');
    d.className = 'b-splat';
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const dist = r.width * (0.55 + (i % 3) * 0.12);
    const size = 5 + ((i * 7) % 5);
    d.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`;
    host.appendChild(d);
    d.animate(
      [
        { transform: 'translate(0,0) scale(0.4)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(a) * dist * 1.05}px, ${Math.sin(a) * dist * 1.05}px) scale(1)`, opacity: 0 },
      ],
      { duration: 620, easing: EASING.out },
    ).finished.then(() => d.remove(), () => d.remove());
  }
}

/** 등장 팝 (body 스프링) */
export function popIn(el: Element | null, delay = 0) {
  if (!el || isStill()) return;
  if (m().tier === 'minimal') {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay, fill: 'backwards' });
    return;
  }
  el.animate([{ transform: 'translateY(14px) scale(0.6) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1, offset: 0.25 }, { transform: 'none', opacity: 1 }], {
    ...springTiming('body'),
    delay,
    fill: 'backwards',
  });
}

/** HUD 숫자 팝 (prop 스프링) */
export function hudPop(el: Element | null) {
  if (!el || isMinimal()) return;
  el.animate([{ transform: 'scale(1.25) rotate(-4deg)' }, { transform: 'none' }], springTiming('prop'));
}

/** 숫자 올리기 (동작 줄이기·minimal은 즉시) */
export function countUp(from: number, to: number, ms: number, on: (v: number) => void) {
  if (isMinimal() || from === to) {
    on(to);
    return;
  }
  const t0 = performance.now();
  const d = isLite() ? ms * 0.7 : ms;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / d);
    on(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ───────────── 축하 한곳 모음 (P2-05에서 이 함수만 풍성하게)

export type CelebrateKind = 'success' | 'fail' | 'quiz-right' | 'quiz-wrong' | 'stage-clear';
export interface CelebrateDetail {
  stars?: number;
  xp?: number;
  coins?: number;
  stamp?: HTMLElement | null;
  paper?: HTMLElement | null;
}
type Listener = (kind: CelebrateKind, d: CelebrateDetail) => void;
const listeners = new Set<Listener>();
export function onCelebrate(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * 성공·실패 연출 시작점. 지금은 최소한: 성공 = 스탬프 쾅 + (듣는 쪽에서) 축하 카드·보상 숫자,
 * 실패 = 종이 살짝 흔들림 + (듣는 쪽에서) 버그버그 등장.
 */
export function celebrate(kind: CelebrateKind, d: CelebrateDetail = {}) {
  if (kind === 'success' || kind === 'quiz-right' || kind === 'stage-clear') {
    stampSlam(d.stamp ?? null, { paper: d.paper, rot: -9 });
  } else if (d.paper && !isMinimal()) {
    d.paper.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px) rotate(-0.3deg)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }],
      { duration: isLite() ? 200 : 320, easing: 'steps(4, end)' },
    );
  }
  listeners.forEach((l) => l(kind, d));
}
