/**
 * 연출 단계 (§2.5, P0-16 §4.5).
 *
 * 모든 연출은 단계(full / lite / minimal)와 reduced-motion(별도 축)을 따른다. 실제 단계 감지
 * (정적 신호 → 실측 프레임으로 하향만)와 설정 저장은 P2-15의 `MotionTierProvider`가 맡고,
 * 지금은 기본 `full` + `prefers-reduced-motion`만 쓴다. 화면 코드는 `useMotionTier()`로 읽기만 하면
 * P2-15가 Provider를 바꿔 끼워도 그대로 동작한다.
 */

export type MotionTier = 'full' | 'lite' | 'minimal';

/** 사용자 설정의 "동작 줄이기" (`users.settings.motion.reduced`, P0-16 §4.6) */
export type ReducedMotionSetting = 'system' | 'on' | 'off';

export interface MotionBudget {
  /** 컨페티 파티클 배율 (full 100% / lite 30% / minimal 0) */
  particles: number;
  /** 일회성 이펙트 길이 배율 (lite는 짧게) */
  effectDuration: number;
  /** 스프링·바운스를 쓸지 (minimal은 페이드만) */
  springs: boolean;
}

export const MOTION_BUDGETS: Record<MotionTier, MotionBudget> = {
  full: { particles: 1, effectDuration: 1, springs: true },
  lite: { particles: 0.3, effectDuration: 0.7, springs: true },
  minimal: { particles: 0, effectDuration: 0.7, springs: false },
};

/** reduced-motion: 단계와 무관하게 움직임 0 · 파티클 0 (표정·색·글자로 피드백) */
export const REDUCED_BUDGET: MotionBudget = {
  particles: 0,
  effectDuration: 0,
  springs: false,
};

export function resolveReduced(
  setting: ReducedMotionSetting,
  systemPrefersReduced: boolean,
): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return systemPrefersReduced;
}

export function motionBudget(tier: MotionTier, reduced: boolean): MotionBudget {
  return reduced ? REDUCED_BUDGET : MOTION_BUDGETS[tier];
}
