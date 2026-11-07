// 연출 단계(full/lite/minimal) + 동작 줄이기(reduced) 상태와 모션 도우미
// - 상태는 <html data-motion data-reduced>로도 반영된다 (CSS 분기, 앱 §2.5와 같은 방식)
// - PrototypeChrome이 바꾸고, 시안 코드는 useMotion()으로 읽는다
import { useSyncExternalStore } from 'react';
import { DURATION, SPRINGS, type Spring, type SpringName } from './tokens';

export type MotionTier = 'full' | 'lite' | 'minimal';
export interface MotionState {
  tier: MotionTier;
  reduced: boolean;
}

const KEY = 'pyroad-proto-motion';
const listeners = new Set<() => void>();

function initial(): MotionState {
  let saved: Partial<MotionState> | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    saved = null;
  }
  const sysReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    tier: saved?.tier === 'lite' || saved?.tier === 'minimal' ? saved.tier : 'full',
    reduced: typeof saved?.reduced === 'boolean' ? saved.reduced : sysReduced,
  };
}

let state: MotionState = initial();
applyToHtml(state);

function applyToHtml(s: MotionState) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.motion = s.tier;
  document.documentElement.dataset.reduced = String(s.reduced);
}

export function getMotion(): MotionState {
  return state;
}

export function setMotion(patch: Partial<MotionState>) {
  state = { ...state, ...patch };
  applyToHtml(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 저장 못 해도 동작에는 지장 없음 */
  }
  listeners.forEach((l) => l());
}

export function subscribeMotion(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useMotion(): MotionState {
  return useSyncExternalStore(subscribeMotion, getMotion, getMotion);
}

/** 단계·동작 줄이기에 맞는 값 고르기. reduced가 단계보다 우선 (별개의 축) */
export function pickMotion<T>(v: { full: T; lite?: T; minimal?: T; reduced?: T }, s: MotionState = state): T {
  if (s.reduced && v.reduced !== undefined) return v.reduced;
  if (s.tier === 'minimal') return v.minimal ?? v.lite ?? v.full;
  if (s.tier === 'lite') return v.lite ?? v.full;
  return v.full;
}

/** lite는 일회성 이펙트를 70% 길이로 (P0-16 §4.5) */
export function tierDuration(ms: number, s: MotionState = state): number {
  if (s.reduced) return 0;
  return s.tier === 'lite' ? Math.round(ms * 0.7) : ms;
}

// ───────────── 스프링 → CSS easing

/** 감쇠 스프링(질량 1)의 0→1 진행을 샘플링. 끝(잔떨림 0.1% 이하)까지 걸린 시간도 돌려준다 */
export function sampleSpring({ k, c }: Spring, opts: { dt?: number; maxMs?: number } = {}) {
  const dt = opts.dt ?? 1 / 120;
  const maxMs = opts.maxMs ?? 2500;
  let x = 0;
  let v = 0;
  const out: number[] = [0];
  let t = 0;
  let settledAt = 0;
  while (t * 1000 < maxMs) {
    v += (k * (1 - x) - c * v) * dt;
    x += v * dt;
    t += dt;
    out.push(x);
    if (Math.abs(1 - x) > 0.001 || Math.abs(v) > 0.01) settledAt = t;
    else if (t - settledAt > 0.05) break;
  }
  return { values: out, durationMs: Math.round(settledAt * 1000) + 10 };
}

const easingCache = new Map<string, { easing: string; duration: number }>();

/**
 * 스프링을 CSS `linear()` easing으로. WAAPI·CSS animation 모두에 쓸 수 있다.
 * 예: el.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], springTiming('prop'))
 */
export function springTiming(spring: SpringName | Spring, points = 40): { easing: string; duration: number } {
  const s = typeof spring === 'string' ? SPRINGS[spring] : spring;
  const key = `${s.k}/${s.c}/${points}`;
  const hit = easingCache.get(key);
  if (hit) return hit;
  const { values, durationMs } = sampleSpring(s);
  const n = Math.round((durationMs / 1000) * 120);
  const stops: string[] = [];
  for (let i = 0; i <= points; i++) {
    const idx = Math.min(values.length - 1, Math.round((i / points) * n));
    stops.push((Math.round(values[idx] * 1000) / 1000).toString());
  }
  stops[stops.length - 1] = '1';
  const r = { easing: `linear(${stops.join(', ')})`, duration: durationMs };
  easingCache.set(key, r);
  return r;
}

/** :root에 넣을 모션 CSS 변수: --spring-<이름>(easing), --spring-<이름>-dur, --dur-<이름> */
export function motionCssVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(SPRINGS) as SpringName[]) {
    const t = springTiming(name);
    out[`--spring-${name}`] = t.easing;
    out[`--spring-${name}-dur`] = `${t.duration}ms`;
  }
  for (const [k, v] of Object.entries(DURATION)) out[`--dur-${k}`] = `${v}ms`;
  return out;
}

/**
 * 단계에 맞춰 WAAPI 애니메이션 실행. reduced면 마지막 프레임을 즉시 적용하고 null.
 * minimal이면 `minimal` 키프레임(없으면 opacity 페이드 150ms)만.
 */
export function play(
  el: Element | null | undefined,
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions,
  alt: { lite?: Keyframe[]; minimal?: Keyframe[] | null } = {},
): Animation | null {
  if (!el) return null;
  const s = state;
  if (s.reduced) {
    const last = keyframes[keyframes.length - 1];
    el.animate([last, last], { duration: 1, fill: timing.fill ?? 'none' });
    return null;
  }
  if (s.tier === 'minimal') {
    if (alt.minimal === null) return null;
    const kf = alt.minimal ?? [{ opacity: 0 }, { opacity: 1 }];
    return el.animate(kf, { duration: 150, easing: 'linear', fill: timing.fill });
  }
  if (s.tier === 'lite') {
    const d = typeof timing.duration === 'number' ? timing.duration * 0.7 : timing.duration;
    return el.animate(alt.lite ?? keyframes, { ...timing, duration: d });
  }
  return el.animate(keyframes, timing);
}
