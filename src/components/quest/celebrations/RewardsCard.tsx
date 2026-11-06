'use client';

import { m } from 'framer-motion';
import { Coins, Star } from 'lucide-react';
import type { MotionBudget } from '@/lib/motion/tier';
import { cn } from '@/lib/utils';
import { CelebrationCta, Kicker } from './parts';
import { popIn } from './motion';

interface RewardsCardProps {
  stars: { stars: 1 | 2 | 3; gained: number } | null;
  coins: number;
  budget: MotionBudget;
  onNext: () => void;
}

/**
 * 별·코인 (Phase 8 자리: P8-04·P8-05가 이벤트를 만들기 시작하면 쓰인다). 별은 1→3 차례로 팝.
 * 디자인은 P6-08(별 1→3·코인 스프링 팝, 카운트업)에서 다시 정한다.
 */
export function RewardsCard({
  stars,
  coins,
  budget,
  onNext,
}: RewardsCardProps) {
  return (
    <>
      <Kicker>보상</Kicker>
      <h2 id="celebration-title" className="sr-only">
        {[stars && `별 ${stars.stars}개`, coins > 0 && `코인 ${coins}개`]
          .filter(Boolean)
          .join(', ')}
      </h2>
      {stars && (
        <div className="flex gap-1" aria-hidden>
          {[1, 2, 3].map((n) => (
            <m.span
              key={n}
              {...popIn(budget, 0.1 + n * 0.15, { scale: 0.3, rotate: -30 })}
            >
              <Star
                className={cn(
                  'h-10 w-10',
                  n <= stars.stars
                    ? 'fill-accent text-accent-lip'
                    : 'text-muted-foreground/40',
                )}
              />
            </m.span>
          ))}
        </div>
      )}
      {coins > 0 && (
        <m.p
          {...popIn(budget, 0.6, { scale: 0.7 })}
          className="flex items-center gap-1.5 rounded-full bg-accent-soft px-4 py-1 text-sm font-bold text-accent-text"
        >
          <Coins className="h-4 w-4" aria-hidden />+{coins} 코인
        </m.p>
      )}
      <CelebrationCta onClick={onNext}>좋아요!</CelebrationCta>
    </>
  );
}
