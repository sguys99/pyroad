'use client';

import { m } from 'framer-motion';
import { Code, Flame, Lightbulb, Map, Trophy } from 'lucide-react';
import { BADGE_FIRST_AT_S, BADGE_STAGGER_S } from '@/lib/celebration/plan';
import { getBadgeDefinition, type BadgeType } from '@/lib/quest/badges';
import type { MotionBudget } from '@/lib/motion/tier';
import { cn } from '@/lib/utils';
import { CelebrationCta, Kicker } from './parts';
import { popIn } from './motion';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Code,
  Lightbulb,
  Map,
  Flame,
  Trophy,
};

interface BadgesCardProps {
  badges: BadgeType[];
  budget: MotionBudget;
  onNext: () => void;
}

/**
 * 뱃지 묶음: 이번에 받은 뱃지를 한 카드에 차례로(stagger) 띄운다. 하나씩 넘기던 예전 팝업보다
 * 짧고, 무엇을 받았는지 한눈에 보인다. 컨페티는 묶음에 한 번만.
 */
export function BadgesCard({ badges, budget, onNext }: BadgesCardProps) {
  const single = badges.length === 1;

  return (
    <>
      <Kicker className="text-accent-foreground">
        {single ? '뱃지 획득!' : `뱃지 ${badges.length}개 획득!`}
      </Kicker>
      <h2 id="celebration-title" className="sr-only">
        새 뱃지: {badges.map((b) => getBadgeDefinition(b).name).join(', ')}
      </h2>

      <ul
        className={cn(
          'grid w-full justify-items-center gap-x-2 gap-y-4',
          single
            ? 'grid-cols-1'
            : badges.length === 2
              ? 'grid-cols-2'
              : 'grid-cols-3',
        )}
      >
        {badges.map((type, i) => {
          const badge = getBadgeDefinition(type);
          const Icon = ICON_MAP[badge.icon] ?? Code;
          const delay = BADGE_FIRST_AT_S + i * BADGE_STAGGER_S;
          return (
            <li
              key={type}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <m.span
                {...popIn(budget, delay, { scale: 0.4, rotate: -18, y: 6 })}
                className={cn(
                  'flex items-center justify-center rounded-full bg-accent/20 ring-4 ring-accent/30',
                  single ? 'h-20 w-20' : 'h-16 w-16',
                )}
              >
                <Icon
                  className={cn(
                    'text-accent-foreground',
                    single ? 'h-10 w-10' : 'h-8 w-8',
                  )}
                />
              </m.span>
              <m.span
                {...popIn(budget, delay + 0.06, { y: 6, scale: 1 })}
                className="flex flex-col items-center gap-0.5"
              >
                <span
                  className={cn(
                    'font-bold text-foreground',
                    single ? 'text-lg' : 'text-sm',
                  )}
                >
                  {badge.name}
                </span>
                <span
                  className={cn(
                    'text-muted-foreground',
                    single ? 'text-sm' : 'text-[11px] leading-snug',
                  )}
                >
                  {badge.description}
                </span>
              </m.span>
            </li>
          );
        })}
      </ul>

      <CelebrationCta onClick={onNext}>좋아요!</CelebrationCta>
    </>
  );
}
