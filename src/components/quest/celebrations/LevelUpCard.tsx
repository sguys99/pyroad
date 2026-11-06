'use client';

import { useCallback, useRef } from 'react';
import { m } from 'framer-motion';
import { LottieCharacter } from '@/components/characters/LottieCharacter';
import { useCountUp } from '@/lib/celebration/ticker';
import type { MotionBudget } from '@/lib/motion/tier';
import { CelebrationCta, Kicker } from './parts';
import { popIn } from './motion';

interface LevelUpCardProps {
  level: number;
  fromLevel: number;
  title: string;
  budget: MotionBudget;
  onNext: () => void;
  /** 숫자가 새 레벨에 도착한 순간 (작은 별 컨페티) */
  onPop?: () => void;
}

/** 카운트업 시작 (카드 등장 기준). 끝나는 순간 파이뱀이 점프를 시작한다 (LottieCharacter level-up 0.6초 + 웅크림) */
const COUNT_DELAY_MS = 500;

/**
 * 레벨 업: 이전 레벨 숫자가 보였다가 새 레벨로 넘어가며 톡 튄다(CSS 1회성 pop + 빛 고리).
 * 여러 레벨을 한 번에 오르면 차례로 센다. reduced-motion이면 처음부터 새 레벨.
 */
export function LevelUpCard({
  level,
  fromLevel,
  title,
  budget,
  onNext,
  onPop,
}: LevelUpCardProps) {
  const animate = budget.effectDuration > 0;
  const popRef = useRef<HTMLSpanElement>(null);
  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;
  const handleDone = useCallback(() => {
    popRef.current?.setAttribute('data-popped', 'true');
    onPopRef.current?.();
  }, []);

  const from = Math.min(fromLevel, level);
  const count = useCountUp<HTMLSpanElement>({
    from,
    to: level,
    durationMs: Math.min(300 * (level - from), 900) * budget.effectDuration,
    delayMs: COUNT_DELAY_MS * budget.effectDuration,
    animate,
    onDone: animate ? handleDone : undefined,
  });

  return (
    <>
      <LottieCharacter
        character="pybaem"
        animation="level-up"
        size={96}
        expression="celebrating"
      />

      <Kicker>레벨 업!</Kicker>

      <h2 id="celebration-title" className="sr-only">
        레벨 {level} 달성
      </h2>
      <span
        ref={popRef}
        aria-hidden
        className="celebration-pop relative inline-flex items-baseline gap-1 text-primary-text"
      >
        <span className="celebration-ring" />
        <span className="text-2xl font-black">Lv.</span>
        <span ref={count.ref} className="text-6xl font-black tabular-nums">
          {count.initial}
        </span>
      </span>

      <m.p
        {...popIn(budget, 0.2, { y: 8, scale: 0.95 })}
        className="flex flex-col items-center gap-1"
      >
        <span className="rounded-full bg-accent/25 px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground">
          새 칭호
        </span>
        <span className="text-xl font-bold text-foreground">{title}</span>
      </m.p>

      <CelebrationCta onClick={onNext}>멋져요!</CelebrationCta>
    </>
  );
}
