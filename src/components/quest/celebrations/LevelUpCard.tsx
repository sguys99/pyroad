'use client';

import { useCallback, useRef } from 'react';
import { useCountUp } from '@/lib/celebration/ticker';
import type { MotionBudget } from '@/lib/motion/tier';
import { CelebrationCta, CelebrationMascot, Kicker, delayStyle } from './parts';

interface LevelUpCardProps {
  level: number;
  fromLevel: number;
  title: string;
  budget: MotionBudget;
  settled: boolean;
  onNext: () => void;
  /** 숫자가 새 레벨에 도착한 순간 (작은 별 컨페티) */
  onPop?: () => void;
}

/** 카운트업 시작 (카드 등장 기준). 숫자가 새 레벨에 닿는 순간 파이뱀이 기쁨 점프(`happy`)를 시작한다 */
const COUNT_DELAY_MS = 500;

/**
 * 레벨 업 (P6-13, 시안 LevelUpStage): 초록 레벨 도장 안 숫자가 이전 레벨에서 새 레벨로 넘어가며 톡(+ 금색 빛 고리) →
 * "레벨 N 달성" → 파이뱀 기쁨 점프 + 금색 새 칭호 도장. 여러 레벨을 한 번에 오르면 차례로 센다(최대 0.9초).
 * 건너뛰기·동작 줄이기면 처음부터 새 레벨. 장면 약 1.6~2.2초(§12-Q28 3.6초 안)
 */
export function LevelUpCard({
  level,
  fromLevel,
  title,
  budget,
  settled,
  onNext,
  onPop,
}: LevelUpCardProps) {
  const animate = budget.effectDuration > 0 && !settled;
  const popRef = useRef<HTMLSpanElement>(null);
  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;
  const popped = useRef(false);
  const handleDone = useCallback(() => {
    if (popped.current) return;
    popped.current = true;
    popRef.current?.setAttribute('data-popped', 'true');
    onPopRef.current?.();
  }, []);

  const from = Math.min(fromLevel, level);
  const countMs = Math.min(300 * (level - from), 900);
  const count = useCountUp<HTMLSpanElement>({
    from,
    to: level,
    durationMs: countMs * budget.effectDuration,
    delayMs: COUNT_DELAY_MS * budget.effectDuration,
    animate,
    onDone: animate ? handleDone : undefined,
  });

  return (
    <>
      <span ref={popRef} className="cel-seal-wrap" aria-hidden>
        <span className="cel-ring" />
        <span className="cel-seal cel-pop">
          <span className="cel-seal-lv">Lv</span>
          <span
            ref={count.ref}
            className="cel-seal-n font-display tabular-nums"
          >
            {count.initial}
          </span>
        </span>
      </span>

      <div className="cel-head">
        <Kicker>레벨 업!</Kicker>
        <h2
          id="celebration-title"
          className="cel-t font-display cel-rise"
          style={delayStyle(150)}
        >
          레벨 {level} 달성
        </h2>
      </div>

      <div className="cel-row">
        <CelebrationMascot
          size={88}
          budget={budget}
          settled={settled}
          jumpAtMs={COUNT_DELAY_MS + countMs}
        />
        <p
          className="cel-titlecard cel-tilt"
          style={delayStyle(COUNT_DELAY_MS + countMs + 150)}
        >
          <small>새 칭호</small>
          <b className="font-display">{title}</b>
        </p>
      </div>

      <div className="cel-actions">
        <CelebrationCta onClick={onNext}>멋져요!</CelebrationCta>
      </div>
    </>
  );
}
