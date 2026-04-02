'use client';

import { Star, Lightbulb } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getLevelTitle } from '@/lib/quest/xp';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';

interface QuestStatusBarProps {
  xp: number;
  level: number;
  hintsUsed: number;
  earnedXP: number | null;
}

function AnimatedXP({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const display = useTransform(motionVal, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration: 0.8,
      ease: 'easeOut',
    });
    return controls.stop;
  }, [value, motionVal]);

  return <motion.span>{display}</motion.span>;
}

function ByeolttongiXPEffect() {
  const [phase, setPhase] = useState<'flying' | 'sparkling'>('flying');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('sparkling'), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="ml-0.5"
        initial={{ opacity: 0, x: -12, y: 8 }}
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.4 }}
      >
        <CharacterAvatar character="byeolttongi" expression={phase} size="sm" />
      </motion.div>
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
    <div className="border-t border-border bg-card px-3 py-2.5 sm:px-4">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <span className="shrink-0 font-medium text-foreground">
          Lv.{level} {title}
        </span>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="flex items-center gap-1 text-primary">
            <Star className="h-4 w-4" />
            <AnimatedXP value={xp} /> XP
            {earnedXP !== null && (
              <>
                <motion.span
                  className="ml-1 text-xs font-bold text-primary"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  +{earnedXP}
                </motion.span>
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
