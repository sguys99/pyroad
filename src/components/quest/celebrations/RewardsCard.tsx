'use client';

import { rewardsCardTiming } from '@/lib/celebration/plan';
import type { MotionBudget } from '@/lib/motion/tier';
import { RewardIcon } from '@/components/ui/reward-icon';
import { CelebrationCta, CountUp, Kicker, StarRow } from './parts';

interface RewardsCardProps {
  stars: { stars: 1 | 2 | 3; gained: number } | null;
  coins: number;
  budget: MotionBudget;
  settled: boolean;
  onNext: () => void;
}

/**
 * 별·코인 (Phase 8 자리: P8-04·P8-05가 이벤트를 만들기 시작하면 쓰인다, §12-Q52).
 * 퀘스트 결과 쪽 보상 띠(P6-08 `RewardStrip`)와 같은 조각: 별 1→3 prop 스프링 팝(`StarRow`) → 코인 카운트업(`CountUp`).
 * 효과음은 시퀀서가 같은 박자(`rewardsCardTiming`)로 낸다: 별마다 'star' rate 1 → 1.26 → 1.5, 숫자가 오르는 동안 'coin' 여러 번(`sfxSchedule`)
 */
export function RewardsCard({
  stars,
  coins,
  budget,
  settled,
  onNext,
}: RewardsCardProps) {
  const animate = budget.springs && budget.effectDuration > 0 && !settled;
  const timing = rewardsCardTiming(!!stars, budget);
  return (
    <>
      <div className="cel-head">
        <Kicker gold>보상</Kicker>
        <h2 id="celebration-title" className="cel-t font-display" data-size="m">
          보상을 받았어요
        </h2>
      </div>
      {stars && (
        <StarRow stars={stars.stars} budget={budget} settled={!animate} />
      )}
      {coins > 0 && (
        <ul className="cel-gains" aria-label="받은 보상">
          <li className="cel-gain">
            <RewardIcon kind="coin" size={30} />
            <b>
              +
              <CountUp
                to={coins}
                durationMs={timing.countMs}
                delayMs={timing.countAtMs}
                animate={animate}
              />
            </b>
            코인
          </li>
        </ul>
      )}
      <div className="cel-actions">
        <CelebrationCta onClick={onNext}>좋아요!</CelebrationCta>
      </div>
    </>
  );
}
