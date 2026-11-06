/**
 * 연출 단계 브라우저 어댑터 (P0-16 → P2-15): 정적 신호 읽기, 기기 저장소, rAF 샘플링, `<html>` 속성.
 *
 * 저장소 (localStorage, 기기마다 다름)
 * - `pyroad.motion.v1`: 지난 세션 실측 단계 `{measured, at, sig}`. 14일, 코어·메모리 값이 같을 때만 믿는다. 서버에 저장하지 않음 (00012 주석)
 * - `pyroad.motion.prefs.v1`: 움직임 설정 사본 `{tier, reduced}`. 로그인 사용자는 서버 `users.settings.motion`이 원본이고
 *   이 사본은 첫 페인트 전에 부트 스크립트(`boot.ts`)가 읽는다. 비로그인(랜딩)은 이 사본만 쓴다
 * 쓸 수 없는 저장소(사파리 개인 정보 보호 등)는 조용히 무시한다.
 */
import {
  FrameSampler,
  staticGuess,
  type SamplerOptions,
  type StaticSignals,
  type TierEvent,
} from './detect';
import {
  lowerTier,
  normalizeMotionSettings,
  tierIndex,
  isMotionTier,
  type MotionSettings,
  type MotionTier,
} from './tier';

export const MEASURED_STORAGE_KEY = 'pyroad.motion.v1';
export const SETTINGS_STORAGE_KEY = 'pyroad.motion.prefs.v1';
/** 지난 실측을 믿는 기간 (부트 스크립트의 12096e5와 같음) */
export const MEASURED_MAX_AGE_MS = 14 * 24 * 3600 * 1000;

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function matches(query: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  );
}

export function readStaticSignals(): StaticSignals {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const ua = nav.userAgent ?? '';
  // iOS의 모든 브라우저와 macOS Safari는 WebKit: hardwareConcurrency가 4 또는 8로 고정 (P0-16 §4.1)
  const webkit =
    (/AppleWebKit/.test(ua) &&
      !/Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(ua)) ||
    /iPad|iPhone|iPod/.test(ua) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  return {
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
    reducedMotion: matches(REDUCED_MOTION_QUERY),
    reducedData: matches('(prefers-reduced-data: reduce)'),
    webkit,
  };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(storage()?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // 저장소를 쓸 수 없으면 이번 페이지 동안만 적용
  }
}

export interface StoredMeasurement {
  measured: MotionTier;
  at: number;
  /** 같은 기기인지 대충 확인: 신호가 바뀌면 버림 */
  sig: string;
}

export const signatureOf = (s: StaticSignals) =>
  `${s.hardwareConcurrency ?? '-'}/${s.deviceMemory ?? '-'}`;

export function loadMeasurement(
  s: StaticSignals,
  now = Date.now(),
): StoredMeasurement | null {
  const v = readJson(MEASURED_STORAGE_KEY) as Partial<StoredMeasurement> | null;
  if (
    !v ||
    !isMotionTier(v.measured) ||
    typeof v.at !== 'number' ||
    v.sig !== signatureOf(s) ||
    now - v.at > MEASURED_MAX_AGE_MS
  )
    return null;
  return v as StoredMeasurement;
}

export function saveMeasurement(s: StaticSignals, measured: MotionTier): void {
  writeJson(MEASURED_STORAGE_KEY, {
    measured,
    at: Date.now(),
    sig: signatureOf(s),
  } satisfies StoredMeasurement);
}

/** 설정에서 "자동"을 다시 고르면 지난 측정을 지운다 (P0-16 §7: 잠깐의 부하로 내려간 단계를 되돌릴 방법) */
export function clearMeasurement(): void {
  try {
    storage()?.removeItem(MEASURED_STORAGE_KEY);
  } catch {
    // 무시
  }
}

export function readSettingsCache(): MotionSettings | null {
  const v = readJson(SETTINGS_STORAGE_KEY);
  return v ? normalizeMotionSettings(v) : null;
}

export function writeSettingsCache(settings: MotionSettings): void {
  writeJson(SETTINGS_STORAGE_KEY, settings);
}

export interface DetectResult {
  tier: MotionTier;
  source: 'static' | 'stored';
  reasons: string[];
  signals: StaticSignals;
}

/** 첫 렌더 전에 바로 쓸 수 있는 추정 (동기, 0ms). 부트 스크립트(`boot.ts`)와 같은 결과 (테스트가 확인) */
export function detectMotionTier(): DetectResult {
  const signals = readStaticSignals();
  const g = staticGuess(signals);
  const stored = loadMeasurement(signals);
  if (stored) {
    // 지난번 실측이 더 낮으면 그걸로 시작 (높으면 정적 추정을 따름)
    return {
      tier: lowerTier(stored.measured, g.tier),
      source: 'stored',
      reasons: [...g.reasons, `지난 측정: ${stored.measured}`],
      signals,
    };
  }
  return { tier: g.tier, source: 'static', reasons: g.reasons, signals };
}

export interface SamplingHandle {
  sampler: FrameSampler;
  pause(): void;
  resume(): void;
  stop(): void;
}

/** rAF로 프레임 간격을 계속 모아 FrameSampler에 넣는다. minimal이 되면 rAF를 멈춘다 (더 내릴 단계가 없음) */
export function startSampling(
  initial: MotionTier,
  onChange: (e: TierEvent) => void,
  opts?: Partial<SamplerOptions>,
): SamplingHandle {
  const sampler = new FrameSampler(initial, opts, onChange);
  let last = 0;
  let id = 0;
  let stopped = false;
  // 무거운 작업(pause)과 숨겨진 탭을 따로 센다: 탭이 돌아와도 작업 중이면 계속 멈춤
  let held = false;
  const loop = (t: number) => {
    if (last) sampler.push(t, t - last);
    last = t;
    if (!stopped && sampler.tier !== 'minimal')
      id = requestAnimationFrame(loop);
  };
  const sync = () => {
    // 멈췄다 다시 시작할 때 공백 간격을 판정에 넣지 않게 last를 초기화
    last = 0;
    if (held || document.hidden) sampler.pause();
    else sampler.resume();
  };
  document.addEventListener('visibilitychange', sync);
  if (tierIndex(initial) < 2) id = requestAnimationFrame(loop);
  return {
    sampler,
    pause: () => {
      held = true;
      sync();
    },
    resume: () => {
      held = false;
      sync();
    },
    stop: () => {
      stopped = true;
      cancelAnimationFrame(id);
      document.removeEventListener('visibilitychange', sync);
    },
  };
}

/** CSS 분기용 `<html data-motion data-reduced>` (부트 스크립트가 첫 페인트 전에, Provider가 이후에 쓴다) */
export function applyMotionAttributes(
  tier: MotionTier,
  reduced: boolean,
): void {
  const el = document.documentElement;
  if (el.dataset.motion !== tier) el.dataset.motion = tier;
  const r = reduced ? 'true' : 'false';
  if (el.dataset.reduced !== r) el.dataset.reduced = r;
}
