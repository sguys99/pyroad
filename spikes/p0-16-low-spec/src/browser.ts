// 브라우저 어댑터: 정적 신호 읽기, rAF 샘플링, 측정 결과 저장
import { FrameSampler, staticGuess, type MotionTier, type SamplerOptions, type StaticSignals, type TierEvent } from './motionTier';

export function readStaticSignals(): StaticSignals {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const mm = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
  const ua = nav.userAgent;
  // iOS의 모든 브라우저와 macOS Safari는 WebKit: hardwareConcurrency가 4 또는 8로 고정
  const webkit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(ua) || /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  return {
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
    reducedMotion: mm('(prefers-reduced-motion: reduce)'),
    reducedData: mm('(prefers-reduced-data: reduce)'),
    webkit,
  };
}

/** 지난 세션 측정 결과 (users.settings가 생기기 전까지 localStorage) */
const KEY = 'pyroad.motion.v1';
export interface Stored {
  measured: MotionTier;
  at: number;
  /** 같은 기기인지 대충 확인: 신호가 바뀌면 버림 */
  sig: string;
}
const sigOf = (s: StaticSignals) => `${s.hardwareConcurrency ?? '-'}/${s.deviceMemory ?? '-'}`;
const MAX_AGE = 14 * 24 * 3600 * 1000;
export function loadStored(s: StaticSignals): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null;
    if (!v || v.sig !== sigOf(s) || Date.now() - v.at > MAX_AGE) return null;
    return v;
  } catch {
    return null;
  }
}
export function saveStored(s: StaticSignals, measured: MotionTier) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ measured, at: Date.now(), sig: sigOf(s) } satisfies Stored));
  } catch {
    /* 사파리 사생활 보호 모드 등 */
  }
}

export interface DetectResult {
  tier: MotionTier;
  source: 'static' | 'stored';
  reasons: string[];
  signals: StaticSignals;
}
/** 첫 렌더 전에 바로 쓸 수 있는 추정 (동기, 0ms) */
export function detectMotionTier(): DetectResult {
  const signals = readStaticSignals();
  const g = staticGuess(signals);
  const stored = loadStored(signals);
  if (stored) {
    // 지난번 실측이 더 낮으면 그걸로 시작 (높으면 정적 추정을 따름)
    const t = ['full', 'lite', 'minimal'].indexOf(stored.measured) > ['full', 'lite', 'minimal'].indexOf(g.tier) ? stored.measured : g.tier;
    return { tier: t, source: 'stored', reasons: [...g.reasons, `지난 측정: ${stored.measured}`], signals };
  }
  return { tier: g.tier, source: 'static', reasons: g.reasons, signals };
}

/** rAF로 프레임 간격을 계속 모아 FrameSampler에 넣는다. 반환값으로 멈춤/일시정지 */
export function startSampling(
  initial: MotionTier,
  onChange: (e: TierEvent, s: FrameSampler) => void,
  opts?: Partial<SamplerOptions>,
) {
  const sampler = new FrameSampler(initial, opts, (e) => onChange(e, sampler));
  let last = 0;
  let id = 0;
  let stopped = false;
  const loop = (t: number) => {
    if (last) sampler.push(t, t - last);
    last = t;
    if (!stopped && sampler.tier !== 'minimal') id = requestAnimationFrame(loop);
  };
  const onVis = () => {
    // 숨겨진 탭은 rAF가 멈추므로 복귀 직후 큰 간격을 버리게 last를 초기화
    last = 0;
    if (document.hidden) sampler.pause();
    else sampler.resume();
  };
  document.addEventListener('visibilitychange', onVis);
  id = requestAnimationFrame(loop);
  return {
    sampler,
    pause: () => sampler.pause(),
    resume: () => {
      last = 0;
      sampler.resume();
    },
    stop: () => {
      stopped = true;
      cancelAnimationFrame(id);
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
