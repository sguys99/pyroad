'use client';

import type { MotionBudget } from '@/lib/motion/tier';
import { RewardIcon } from '@/components/ui/reward-icon';
import { CelebrationCta, CountUp, Kicker, StarRow } from './parts';

interface RewardsCardProps {
  stars: { stars: 1 | 2 | 3; gained: number } | null;
  coins: number;
  budget: MotionBudget;
  onNext: () => void;
}

/**
 * 별·코인 (Phase 8 자리: P8-04·P8-05가 이벤트를 만들기 시작하면 쓰인다).
 * 퀘스트 결과 쪽 보상 띠(P6-08 `RewardStrip`)와 같은 조각: 별 1→3 prop 스프링 팝(`StarRow`) → 코인 카운트업(`CountUp`).
 * 효과음은 시퀀서가 낸다(`STEP_SPECS.rewards`, 별 상승음 rate는 P6-14)
 */
export function RewardsCard({
  stars,
  coins,
  budget,
  onNext,
}: RewardsCardProps) {
  const animate = budget.springs && budget.effectDuration > 0;
  return (
    <>
      <Kicker>보상</Kicker>
      <h2 id="celebration-title" className="sr-only">
        {[stars && `별 ${stars.stars}개`, coins > 0 && `코인 ${coins}개`]
          .filter(Boolean)
          .join(', ')}
      </h2>
      {stars && (
        <StarRow stars={stars.stars} budget={budget} settled={!animate} />
      )}
      {coins > 0 && (
        <p className="flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-2 pr-4 text-h3 font-bold text-accent-text">
          <RewardIcon kind="coin" size={28} />
          <b>
            +
            <CountUp
              to={coins}
              durationMs={700 * budget.effectDuration}
              delayMs={(stars ? 650 : 250) * budget.effectDuration}
              animate={animate}
            />
          </b>
          <span className="text-small">코인</span>
        </p>
      )}
      <CelebrationCta onClick={onNext}>좋아요!</CelebrationCta>
    </>
  );
}
