'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { MotionConfig } from 'framer-motion';
import { track } from '@/lib/analytics/track';
import {
  REDUCED_MOTION_QUERY,
  applyMotionAttributes,
  clearMeasurement,
  detectMotionTier,
  readSettingsCache,
  readStaticSignals,
  saveMeasurement,
  startSampling,
  writeSettingsCache,
  type SamplingHandle,
} from './browser';
import {
  staticGuess,
  type SamplerOptions,
  type StaticSignals,
  type TierEvent,
} from './detect';
import {
  DEFAULT_MOTION_SETTINGS,
  motionBudget,
  resolvePolicy,
  resolveReduced,
  sameMotionSettings,
  type MotionBudget,
  type MotionPolicy,
  type MotionSettings,
  type MotionSource,
  type MotionTier,
  type ReducedMotionSetting,
} from './tier';

/**
 * 연출 단계 Provider + `useMotionTier()` (P0-16 §4.6 → P2-15). 규칙: docs/design/motion-guidelines.md
 *
 * 루트 레이아웃에 하나만 둔다 (감지 모드).
 * - 서버·하이드레이션 첫 렌더는 `full` + reduced false (불일치 없음). 마운트 직후 기기 사본 설정 + `detectMotionTier()`로 바꾼다
 * - CSS는 그보다 먼저: 부트 스크립트(`boot.ts`)가 첫 페인트 전에 `<html data-motion data-reduced>`를 붙이고, 여기서는 이후 값을 쓴다
 * - 실측 샘플러(`startSampling`)가 하향만 판정. 바뀌면 지난 측정을 저장하고 익명 이벤트 `motion_tier_change`를 보낸다 (P1-17)
 * - reduced-motion(움직임 0)이면 실측하지 않는다 (그릴 것이 없어 의미 없음)
 * - Framer Motion에는 `MotionConfig reducedMotion`으로 사용자 설정까지 반영한다 (기기 설정만 보는 `useReducedMotion` 대신)
 * - `pauseSampling()`/`resumeSampling()`: Pyodide 로딩처럼 알려진 무거운 작업 동안 판정 중지 (여러 곳이 겹쳐 불러도 되게 횟수를 셈)
 *
 * `tier`·`reduced`를 주면 고정 모드: 감지·저장·`<html>` 속성 없이 그 값만 (테스트·화면 확인용).
 * Provider가 없으면 기본값(full, 기기 설정 따르기)이다.
 */

export interface MotionTierState extends MotionPolicy {
  budget: MotionBudget;
  /** 감지한 단계 (사용자가 단계를 골라도 감지는 계속 기록) */
  detected: MotionTier;
  /** 지금 적용 중인 설정 (`users.settings.motion` 또는 기기 사본) */
  settings: MotionSettings;
  /** 기기의 `prefers-reduced-motion` */
  systemReduced: boolean;
  /** 사용자가 설정을 바꿈: 바로 적용 + 기기 사본 + 분석 이벤트. 서버 저장은 부르는 쪽(설정 화면 → `/api/settings`) */
  setSettings: (next: MotionSettings) => void;
  /** 서버 값 반영 (로그인 레이아웃·설정 화면 로드). 분석 이벤트 없음 */
  adoptSettings: (next: MotionSettings) => void;
  /** 지난 측정을 지우고 다시 잰다 (자동일 때 "다시 재 보기") */
  remeasure: () => void;
  pauseSampling: () => void;
  resumeSampling: () => void;
}

const noop = () => {};

const MotionTierContext = createContext<MotionTierState | null>(null);

function subscribeReduced(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return noop;
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function readReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.(REDUCED_MOTION_QUERY).matches
  );
}

/** 기기의 `prefers-reduced-motion` (서버 스냅샷은 false, 바뀌면 다시 그림) */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, readReduced, () => false);
}

/** 부트 스크립트가 붙인 속성 (하이드레이션 중 Framer 설정용. 화면 마크업에는 쓰지 않음) */
function domReduced(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reduced === 'true'
  );
}

const MAX_ELAPSED_S = 86_400;
function elapsedSeconds(ms: number): number {
  return Math.min(MAX_ELAPSED_S, Math.max(0, Math.round(ms / 1000)));
}
function pageSeconds(): number {
  return elapsedSeconds(
    typeof performance === 'undefined' ? 0 : performance.now(),
  );
}

interface ProviderProps {
  children: React.ReactNode;
  /** 고정 모드: 이 단계로 (감지하지 않음) */
  tier?: MotionTier;
  /** 고정 모드: 이 "동작 줄이기" 설정으로 */
  reduced?: ReducedMotionSetting;
  /** 테스트용 샘플러 옵션 */
  samplerOptions?: Partial<SamplerOptions>;
}

export function MotionTierProvider(props: ProviderProps) {
  return props.tier !== undefined || props.reduced !== undefined ? (
    <FixedMotionTier {...props} />
  ) : (
    <DetectedMotionTier {...props} />
  );
}

function FixedMotionTier({
  tier = 'full',
  reduced = 'system',
  children,
}: ProviderProps) {
  const system = useSystemReducedMotion();
  const [settings, setSettingsState] = useState<MotionSettings>({
    tier,
    reduced,
  });
  useEffect(() => setSettingsState({ tier, reduced }), [tier, reduced]);
  const value = useMemo<MotionTierState>(() => {
    const policy = resolvePolicy(settings, { tier, source: 'user' }, system);
    return {
      ...policy,
      budget: motionBudget(policy.tier, policy.reduced),
      detected: tier,
      settings,
      systemReduced: system,
      setSettings: setSettingsState,
      adoptSettings: setSettingsState,
      remeasure: noop,
      pauseSampling: noop,
      resumeSampling: noop,
    };
  }, [settings, system, tier]);
  return (
    <MotionTierContext.Provider value={value}>
      <MotionConfig reducedMotion={value.reduced ? 'always' : 'never'}>
        {children}
      </MotionConfig>
    </MotionTierContext.Provider>
  );
}

function DetectedMotionTier({ children, samplerOptions }: ProviderProps) {
  const system = useSystemReducedMotion();
  const [ready, setReady] = useState(false);
  const [settings, setSettingsState] = useState<MotionSettings>(
    DEFAULT_MOTION_SETTINGS,
  );
  const [detected, setDetected] = useState<{
    tier: MotionTier;
    source: MotionSource;
  }>({ tier: 'full', source: 'default' });
  // "다시 재 보기"(remeasure)면 샘플러를 처음부터 (지난 측정도 지움)
  const [samplingEpoch, setSamplingEpoch] = useState(0);

  const signalsRef = useRef<StaticSignals | null>(null);
  const handleRef = useRef<SamplingHandle | null>(null);
  const pauseCountRef = useRef(0);
  const samplerOptionsRef = useRef(samplerOptions);

  const policy = resolvePolicy(settings, detected, system);
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const detectedRef = useRef(detected);
  detectedRef.current = detected;

  // 마운트: 기기 사본 설정(로그인이면 부트 동기화가 서버 값으로 갱신해 둠) + 정적 추정·지난 측정
  useEffect(() => {
    const cached = readSettingsCache();
    if (cached) setSettingsState(cached);
    const first = detectMotionTier();
    signalsRef.current = first.signals;
    setDetected({ tier: first.tier, source: first.source });
    setReady(true);
  }, []);

  // 실측: reduced(움직임 0)가 아닐 때만. 바뀐 단계는 다음 세션을 위해 저장
  useEffect(() => {
    if (!ready || policy.reduced) return;
    const onChange = (e: TierEvent) => {
      setDetected({ tier: e.to, source: 'measured' });
      if (signalsRef.current) saveMeasurement(signalsRef.current, e.to);
      track('motion_tier_change', {
        from: e.from,
        to: e.to,
        cause: 'measured',
        setting: settingsRef.current.tier,
        reduced: settingsRef.current.reduced,
        elapsed_s: elapsedSeconds(e.t),
      });
    };
    const handle = startSampling(
      detectedRef.current.tier,
      onChange,
      samplerOptionsRef.current,
    );
    handleRef.current = handle;
    if (pauseCountRef.current > 0) handle.pause();
    return () => {
      handle.stop();
      if (handleRef.current === handle) handleRef.current = null;
    };
  }, [ready, policy.reduced, samplingEpoch]);

  useEffect(() => {
    if (ready) applyMotionAttributes(policy.tier, policy.reduced);
  }, [ready, policy.tier, policy.reduced]);

  const setSettings = useCallback((next: MotionSettings) => {
    const prev = policyRef.current;
    setSettingsState(next);
    writeSettingsCache(next);
    const after = resolvePolicy(next, detectedRef.current, readReduced());
    track('motion_tier_change', {
      from: prev.tier,
      to: after.tier,
      cause: 'user',
      setting: next.tier,
      reduced: next.reduced,
      elapsed_s: pageSeconds(),
    });
  }, []);

  const remeasure = useCallback(() => {
    // 잠깐의 부하로 내려간 단계를 되돌릴 방법 (P0-16 §7): 지난 측정을 지우고 정적 추정부터 다시 잰다
    const prev = policyRef.current;
    clearMeasurement();
    const signals = signalsRef.current ?? readStaticSignals();
    const next = { tier: staticGuess(signals).tier, source: 'static' as const };
    setDetected(next);
    setSamplingEpoch((n) => n + 1);
    const after = resolvePolicy(settingsRef.current, next, readReduced());
    track('motion_tier_change', {
      from: prev.tier,
      to: after.tier,
      cause: 'user',
      setting: settingsRef.current.tier,
      reduced: settingsRef.current.reduced,
      elapsed_s: pageSeconds(),
    });
  }, []);

  const adoptSettings = useCallback((next: MotionSettings) => {
    writeSettingsCache(next);
    if (!sameMotionSettings(settingsRef.current, next)) setSettingsState(next);
  }, []);

  const pauseSampling = useCallback(() => {
    pauseCountRef.current += 1;
    if (pauseCountRef.current === 1) handleRef.current?.pause();
  }, []);

  const resumeSampling = useCallback(() => {
    if (pauseCountRef.current === 0) return;
    pauseCountRef.current -= 1;
    if (pauseCountRef.current === 0) handleRef.current?.resume();
  }, []);

  const value = useMemo<MotionTierState>(
    () => ({
      tier: policy.tier,
      reduced: policy.reduced,
      source: policy.source,
      budget: motionBudget(policy.tier, policy.reduced),
      detected: detected.tier,
      settings,
      systemReduced: system,
      setSettings,
      adoptSettings,
      remeasure,
      pauseSampling,
      resumeSampling,
    }),
    [
      policy.tier,
      policy.reduced,
      policy.source,
      detected.tier,
      settings,
      system,
      setSettings,
      adoptSettings,
      remeasure,
      pauseSampling,
      resumeSampling,
    ],
  );

  // 하이드레이션 중에는 부트 스크립트 값으로 Framer를 설정 (첫 등장 연출부터 동작 줄이기를 지킴)
  const framerReduced = ready ? policy.reduced : domReduced();
  return (
    <MotionTierContext.Provider value={value}>
      <MotionConfig reducedMotion={framerReduced ? 'always' : 'never'}>
        {children}
      </MotionConfig>
    </MotionTierContext.Provider>
  );
}

/** Provider가 없을 때 (단위 테스트·Provider 밖): full + 기기 설정 따르기 */
function useDefaultMotionTier(enabled: boolean): MotionTierState | null {
  const system = useSystemReducedMotion();
  return useMemo(() => {
    if (!enabled) return null;
    const reduced = resolveReduced('system', system);
    return {
      tier: 'full',
      reduced,
      source: 'default',
      budget: motionBudget('full', reduced),
      detected: 'full',
      settings: DEFAULT_MOTION_SETTINGS,
      systemReduced: system,
      setSettings: noop,
      adoptSettings: noop,
      remeasure: noop,
      pauseSampling: noop,
      resumeSampling: noop,
    };
  }, [enabled, system]);
}

export function useMotionTier(): MotionTierState {
  const ctx = useContext(MotionTierContext);
  const fallback = useDefaultMotionTier(ctx === null);
  return (ctx ?? fallback)!;
}

/**
 * `active`인 동안 실측 판정을 멈춘다 (Pyodide 로딩·코드 실행처럼 알려진 무거운 작업).
 * 한 번의 긴 작업은 판정 규칙(4초 중 3초)이 이미 무시하지만, 로딩이 몇 초씩 이어지는 저사양 기기에서 잘못 내려가지 않게 한다 (P0-16 §4.4).
 */
export function useSamplingPause(active: boolean): void {
  const { pauseSampling, resumeSampling } = useMotionTier();
  useEffect(() => {
    if (!active) return;
    pauseSampling();
    return resumeSampling;
  }, [active, pauseSampling, resumeSampling]);
}
