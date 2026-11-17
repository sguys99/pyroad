'use client';

import { m } from 'framer-motion';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { EASE, sec } from '@/lib/motion/tokens';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 화면 등장 전환. 단계표(P2-15): full = 살짝 올라오기(보이는 채로, B102), lite = 짧은 페이드, minimal·동작 줄이기 = 없음(즉시).
 * 서버 렌더·첫 하이드레이션은 full 값이다 (단계는 마운트 직후에 정해짐).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const { budget } = useMotionTier();
  if (budget.pageTransition === 'none') {
    return (
      // y 도 0으로: 첫 렌더(full)의 올라오기가 끝나기 전에 단계가 바뀌면 12px 내려간 채 멈췄음 (B96)
      <m.div
        className={className}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0 }}
      >
        {children}
      </m.div>
    );
  }
  const slide = budget.pageTransition === 'slide';
  return (
    <m.div
      className={className}
      // slide(= 서버 렌더·첫 하이드레이션)는 보이는 채로 올라오기만: opacity 0으로 서버가 그리면 JS가 돌 때까지 화면이 비고
      // LCP가 하이드레이션 뒤로 밀림 (§2.10 규칙, B102). fade는 클라이언트에서 단계가 lite일 때만이라 서버 HTML에 안 나옴
      initial={slide ? { y: 12 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: sec(slide ? 'slow' : 'fast'),
        ease: EASE.out,
      }}
    >
      {children}
    </m.div>
  );
}
