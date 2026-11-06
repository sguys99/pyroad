'use client';

import { useEffect, useRef } from 'react';
import { m } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import type { MotionBudget } from '@/lib/motion/tier';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { popIn } from './motion';

/**
 * 축하 카드의 다음으로 버튼. 모든 축하 카드가 같은 모양·같은 testid(`celebration-cta`, §2.10 측정 하네스)를 쓴다.
 * 단계가 바뀔 때마다 포커스를 받는다 (스크린 리더·Tab 사용자). Enter/Space·Esc는 시퀀서가 창 전체에서 받으므로
 * 포커스 전에도 키보드로 넘길 수 있다.
 *
 * `autoFocus`를 쓰지 않는 이유: 커밋 중의 `focus()`가 스크롤·레이아웃을 강제로 계산해, CPU 4배에서 카드 등장 첫 프레임에
 * 수 초짜리 긴 작업이 생겼다 (P1-10 측정). 등장 스프링이 거의 끝난 뒤 `preventScroll`로 옮긴다.
 */
export const CTA_FOCUS_DELAY_MS = 320;

export function CelebrationCta({
  children,
  onClick,
  wide = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = setTimeout(
      () => ref.current?.focus({ preventScroll: true }),
      CTA_FOCUS_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  return (
    // 게임 버튼 (P2-11): 눌림 피드백은 버튼이, 소리는 시퀀서가 낸다
    <Button
      ref={ref}
      data-testid="celebration-cta"
      sfx={false}
      className={cn('mt-1', wide && 'w-full')}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** 카드 맨 위 작은 머리글 ("레벨 업!", "뱃지 획득!") */
export function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-xs font-bold tracking-wide text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** 배운 개념 칩: 하나씩 톡톡 (transform만) */
export function ConceptChips({
  concepts,
  budget,
  delay,
}: {
  concepts: string[];
  budget: MotionBudget;
  delay: number;
}) {
  if (concepts.length === 0) return null;
  return (
    <ul
      className="flex flex-wrap justify-center gap-1.5"
      aria-label="배운 개념"
    >
      {concepts.map((concept, i) => (
        <m.li
          key={concept}
          {...popIn(budget, delay + i * 0.05, { y: 6, scale: 0.85 })}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-text"
        >
          <CheckCircle className="h-3 w-3" aria-hidden />
          {concept}
        </m.li>
      ))}
    </ul>
  );
}
