'use client';

import { m } from 'framer-motion';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { DURATION, EASE } from '@/lib/motion/tokens';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 화면 등장 전환. 단계표(P2-15): full = 살짝 올라오며 페이드, lite = 짧은 페이드, minimal·동작 줄이기 = 없음(즉시).
 * 서버 렌더·첫 하이드레이션은 full 값이다 (단계는 마운트 직후에 정해짐).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const { budget } = useMotionTier();
  if (budget.pageTransition === 'none') {
    return (
      <m.div className={className} initial={false} animate={{ opacity: 1 }}>
        {children}
      </m.div>
    );
  }
  const slide = budget.pageTransition === 'slide';
  return (
    <m.div
      className={className}
      initial={slide ? { opacity: 0, y: 12 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: (slide ? 300 : DURATION.fast) / 1000,
        ease: EASE.out,
      }}
    >
      {children}
    </m.div>
  );
}
