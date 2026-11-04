'use client';

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  motionBudget,
  resolveReduced,
  type MotionBudget,
  type MotionTier,
  type ReducedMotionSetting,
} from '@/lib/motion/tier';

/**
 * 연출 단계 자리 (§2.5, P0-16 §4.6). 지금은 단계 감지 없이 `full` + 기기의 `prefers-reduced-motion`.
 *
 * P2-15가 이 Provider를 `detectMotionTier()`·실측 하향·`users.settings.motion`을 쓰는 것으로 바꾼다.
 * Provider가 없으면 기본값(full, 기기 설정 따르기)이라 지금은 레이아웃에 두지 않아도 된다.
 * 테스트·화면 확인용으로 `tier`·`reduced`를 고정할 수 있다.
 */

interface MotionTierSettings {
  tier: MotionTier;
  reduced: ReducedMotionSetting;
}

const DEFAULT_SETTINGS: MotionTierSettings = {
  tier: 'full',
  reduced: 'system',
};

const MotionTierContext = createContext<MotionTierSettings>(DEFAULT_SETTINGS);

export function MotionTierProvider({
  tier = 'full',
  reduced = 'system',
  children,
}: Partial<MotionTierSettings> & { children: React.ReactNode }) {
  const value = useMemo(() => ({ tier, reduced }), [tier, reduced]);
  return (
    <MotionTierContext.Provider value={value}>
      {children}
    </MotionTierContext.Provider>
  );
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(REDUCED_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function readReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.(REDUCED_QUERY).matches
  );
}

/** 기기의 `prefers-reduced-motion` (서버 스냅샷은 false, 바뀌면 다시 그림) */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, readReduced, () => false);
}

export interface MotionTierState {
  tier: MotionTier;
  /** 움직임 0 (설정 또는 기기 설정) */
  reduced: boolean;
  budget: MotionBudget;
}

export function useMotionTier(): MotionTierState {
  const settings = useContext(MotionTierContext);
  const system = useSystemReducedMotion();
  const reduced = resolveReduced(settings.reduced, system);
  return useMemo(
    () => ({
      tier: settings.tier,
      reduced,
      budget: motionBudget(settings.tier, reduced),
    }),
    [settings.tier, reduced],
  );
}
