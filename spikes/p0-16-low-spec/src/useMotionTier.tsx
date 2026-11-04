'use client';
// MotionTierProvider + useMotionTier
// - SSR: 서버는 'full'로 렌더 (첫 화면은 정적 포즈라 단계와 무관 → 하이드레이션 불일치 없음)
// - 클라이언트: detectMotionTier()로 즉시 추정 → 실측 샘플러가 하향 판정 → <html data-motion data-reduced>로 CSS에도 전달
// - 사용자 설정(users.settings.motion)이 'auto'가 아니면 그 값을 그대로 씀 (감지는 기록만)
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { detectMotionTier, saveStored, startSampling } from './browser';
import { DEFAULT_SETTINGS, TIER_BUDGET, resolvePolicy, type MotionPolicy, type MotionSettings, type MotionTier, type TierEvent } from './motionTier';

interface Ctx extends MotionPolicy {
  budget: (typeof TIER_BUDGET)[MotionTier];
  detected: MotionTier;
  reasons: string[];
  events: TierEvent[];
  settings: MotionSettings;
  setSettings: (s: MotionSettings) => void;
  /** Pyodide 로딩처럼 알려진 무거운 작업 동안 판정 중지 */
  pauseSampling: () => void;
  resumeSampling: () => void;
}
const MotionCtx = createContext<Ctx | null>(null);

function subscribeReduced(cb: () => void) {
  const m = matchMedia('(prefers-reduced-motion: reduce)');
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}
const getReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function MotionTierProvider({
  children,
  initialSettings = DEFAULT_SETTINGS,
  onSettingsChange,
  samplerOptions,
}: {
  children: React.ReactNode;
  /** users.settings.motion (없으면 기본값) */
  initialSettings?: MotionSettings;
  /** 설정 화면에서 바꾸면 users.settings에 저장 */
  onSettingsChange?: (s: MotionSettings) => void;
  samplerOptions?: Parameters<typeof startSampling>[2];
}) {
  const systemReduced = useSyncExternalStore(subscribeReduced, getReduced, () => false);
  const [settings, setSettingsState] = useState(initialSettings);
  const [det, setDet] = useState<{ tier: MotionTier; source: 'static' | 'stored' | 'measured'; reasons: string[] }>({
    tier: 'full',
    source: 'static',
    reasons: [],
  });
  const [events, setEvents] = useState<TierEvent[]>([]);
  const ctl = useRef<ReturnType<typeof startSampling> | null>(null);

  useEffect(() => {
    const first = detectMotionTier();
    setDet({ tier: first.tier, source: first.source, reasons: first.reasons });
    // reduced-motion이면 어차피 움직임이 거의 없어 실측이 의미 없음 → 샘플링 생략
    if (first.signals.reducedMotion) return;
    ctl.current = startSampling(
      first.tier,
      (e) => {
        setDet((d) => ({ tier: e.to, source: 'measured', reasons: [...d.reasons, e.why] }));
        setEvents((ev) => [...ev, e]);
        saveStored(first.signals, e.to);
      },
      samplerOptions,
    );
    return () => ctl.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const policy = resolvePolicy(settings, det, systemReduced);
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.motion = policy.tier;
    el.dataset.reduced = policy.reduced ? 'true' : 'false';
  }, [policy.tier, policy.reduced]);

  const setSettings = useCallback(
    (s: MotionSettings) => {
      setSettingsState(s);
      onSettingsChange?.(s);
    },
    [onSettingsChange],
  );
  const value = useMemo<Ctx>(
    () => ({
      ...policy,
      budget: TIER_BUDGET[policy.tier],
      detected: det.tier,
      reasons: det.reasons,
      events,
      settings,
      setSettings,
      pauseSampling: () => ctl.current?.pause(),
      resumeSampling: () => ctl.current?.resume(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [policy.tier, policy.reduced, policy.source, det, events, settings, setSettings],
  );
  return <MotionCtx.Provider value={value}>{children}</MotionCtx.Provider>;
}

export function useMotionTier(): Ctx {
  const c = useContext(MotionCtx);
  if (!c) throw new Error('MotionTierProvider가 필요합니다');
  return c;
}
