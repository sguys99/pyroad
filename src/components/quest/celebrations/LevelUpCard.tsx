'use client';

import { useCallback, useRef } from 'react';
import { useCountUp } from '@/lib/celebration/ticker';
import type { MotionBudget } from '@/lib/motion/tier';
import { isMilestoneLevel } from '@/lib/quest/xp';
import { RewardIcon } from '@/components/ui/reward-icon';
import {
  CelebrationCta,
  CelebrationMascot,
  CountUp,
  Kicker,
  delayStyle,
} from './parts';

interface LevelUpCardProps {
  level: number;
  fromLevel: number;
  title: string;
  /** 지나간 레벨들에서 받은 코인 (P8-04). 0이면 줄을 그리지 않음 */
  coins?: number;
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
 * 5레벨마다(§12-Q62)는 "큰 칭호": 레벨 도장이 금색 메달(금색 테), 칭호 도장은 금색 면에 굵은 테두리 (P8-01)
 * 레벨 업 코인(P8-04, 레벨마다 20 · 5레벨마다 100)은 칭호 도장 뒤에 보상 알약으로 톡 → 0부터 카운트업
 */
export function LevelUpCard({
  level,
  fromLevel,
  title,
  coins = 0,
  budget,
  settled,
  onNext,
  onPop,
}: LevelUpCardProps) {
  const animate = budget.effectDuration > 0 && !settled;
  const big = isMilestoneLevel(level);
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
      <span
        ref={popRef}
        className="cel-seal-wrap"
        data-big={big || undefined}
        aria-hidden
      >
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
        <Kicker gold={big}>{big ? '큰 레벨 업!' : '레벨 업!'}</Kicker>
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
          data-big={big || undefined}
          data-testid="celebration-title-seal"
          style={delayStyle(COUNT_DELAY_MS + countMs + 150)}
        >
          <small>{big ? '큰 칭호' : '새 칭호'}</small>
          <b className="font-display">{title}</b>
        </p>
      </div>

      {coins > 0 && (
        <ul className="cel-gains" aria-label="레벨 업 보상">
          <li
            className="cel-gain cel-pop"
            style={delayStyle(COUNT_DELAY_MS + countMs + 450)}
            data-testid="celebration-level-coins"
          >
            <RewardIcon kind="coin" size={30} />
            <b>
              +
              <CountUp
                to={coins}
                durationMs={600 * budget.effectDuration}
                delayMs={
                  (COUNT_DELAY_MS + countMs + 550) * budget.effectDuration
                }
                animate={animate}
              />
            </b>
            코인
          </li>
        </ul>
      )}

      <div className="cel-actions">
        <CelebrationCta onClick={onNext}>멋져요!</CelebrationCta>
      </div>
    </>
  );
}
