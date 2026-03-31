'use client';

import { Star, Lightbulb } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { getLevelTitle } from '@/lib/quest/xp';

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

export function QuestStatusBar({
  xp,
  level,
  hintsUsed,
  earnedXP,
}: QuestStatusBarProps) {
  const title = getLevelTitle(level);

  return (
    <div className="border-t border-border bg-card px-4 py-2.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          Lv.{level} {title}
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-primary">
            <Star className="h-4 w-4" />
            <AnimatedXP value={xp} /> XP
            {earnedXP !== null && (
              <motion.span
                className="ml-1 text-xs font-bold text-primary"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                +{earnedXP}
              </motion.span>
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
