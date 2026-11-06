import type { TargetAndTransition, Transition } from 'framer-motion';
import type { MotionBudget } from '@/lib/motion/tier';
import { EASE, framerSpring, sec } from '@/lib/motion/tokens';

/**
 * 축하 카드 연출 값 (P1-10). 연출 단계·reduced-motion에 따라 한 곳에서 고른다.
 *
 * - 카드 등장: 스프링(살짝 튀었다 자리 잡음), 퇴장: 짧게(fast 140ms) — 다음 카드가 빨리 이어지게
 * - 카드 안 글자는 처음부터 보인다. 안쪽 요소는 transform(위치·크기)만 움직인다 (§2.10)
 * - minimal: 페이드만, reduced-motion: 움직임 0 (즉시)
 */
export interface CardMotionProps {
  initial: TargetAndTransition | false;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
}

/** 카드·모달 등장 = body 스프링 (모션 토큰, 새 스프링을 만들지 않는다) */
const CARD_SPRING: Transition = {
  ...framerSpring('body'),
  // 글자가 opacity 0에 오래 머물지 않게 투명도는 짧게
  opacity: { duration: sec('fast'), ease: EASE.out },
};

export function cardMotion(budget: MotionBudget): CardMotionProps {
  if (budget.effectDuration === 0) {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0 } },
      transition: { duration: 0 },
    };
  }
  if (!budget.springs) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: sec('instant') } },
      transition: { duration: sec('fade') },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.9, y: 24 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: {
      opacity: 0,
      scale: 0.96,
      y: -10,
      transition: {
        duration: sec('fast') * budget.effectDuration,
        ease: EASE.inOut,
      },
    },
    transition: CARD_SPRING,
  };
}

/**
 * 카드 안 요소 하나가 톡 튀어 오르는 등장 (transform만, 글자는 처음부터 보임).
 * @param delay 카드 등장 기준 초
 */
export function popIn(
  budget: MotionBudget,
  delay: number,
  from: TargetAndTransition = { y: 10, scale: 0.92 },
): {
  initial: TargetAndTransition | false;
  animate: TargetAndTransition;
  transition: Transition;
} {
  if (!budget.springs || budget.effectDuration === 0) {
    return {
      initial: false,
      animate: { y: 0, scale: 1, rotate: 0 },
      transition: { duration: 0 },
    };
  }
  return {
    initial: from,
    animate: { y: 0, scale: 1, rotate: 0 },
    // 소품 팝 = prop 스프링 (코인·별·배지)
    transition: framerSpring('prop', { delay: delay * budget.effectDuration }),
  };
}
