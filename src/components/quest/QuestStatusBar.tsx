'use client';

import { Star, Lightbulb } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { framerSpring, sec } from '@/lib/motion/tokens';
import { useEffect, useState } from 'react';
import { getLevelTitle } from '@/lib/quest/xp';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { LevelSeal } from '@/components/ui/hud';
import { useCountUp } from '@/components/ui/use-count-up';

interface QuestStatusBarProps {
  xp: number;
  level: number;
  hintsUsed: number;
  earnedXP: number | null;
}

/** XP 숫자 카운트업 (공통 HUD 훅, P2-11): full 700ms · lite 70% · minimal·동작 줄이기 즉시 */
function AnimatedXP({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <span className="hud-num min-w-0">{shown}</span>;
}

function ByeolttongiXPEffect() {
  const [phase, setPhase] = useState<'flying' | 'sparkling'>('flying');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('sparkling'), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      <m.div
        className="ml-0.5"
        initial={{ opacity: 0, x: -12, y: 8 }}
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
        }}
        transition={framerSpring('body', { delay: sec('slow') })}
      >
        <CharacterAvatar character="byeolttongi" expression={phase} size="sm" />
      </m.div>
    </AnimatePresence>
  );
}

export function QuestStatusBar({
  xp,
  level,
  hintsUsed,
  earnedXP,
}: QuestStatusBarProps) {
  const title = getLevelTitle(level);

  return (
    <div className="border-t border-border bg-card px-3 py-1.5 sm:px-4">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <span className="flex shrink-0 items-center gap-2 font-medium text-foreground">
          <LevelSeal level={level} size="sm" />
          <span className="max-sm:sr-only">{title}</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="flex items-center gap-1 text-primary-text">
            <Star className="h-4 w-4" />
            <AnimatedXP value={xp} /> XP
            {earnedXP !== null && (
              <>
                <m.span
                  className="ml-1 text-xs font-bold text-primary-text"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: sec('base') }}
                >
                  +{earnedXP}
                </m.span>
                <ByeolttongiXPEffect />
              </>
            )}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            힌트: {hintsUsed}/3
          </span>
        </div>
      </div>
    </div>
  );
}
