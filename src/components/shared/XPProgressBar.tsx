'use client';

import { motion } from 'framer-motion';
import { getXPProgress } from '@/lib/quest/xp';

interface XPProgressBarProps {
  totalXP: number;
  size?: 'sm' | 'md';
}

export function XPProgressBar({ totalXP, size = 'sm' }: XPProgressBarProps) {
  const { currentLevel, currentLevelXP, nextLevelXP, progressPercent } =
    getXPProgress(totalXP);

  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2.5';

  if (nextLevelXP === null) {
    return (
      <div className="flex flex-col gap-1">
        {size === 'md' && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Lv.{currentLevel}</span>
            <span className="font-bold text-primary">MAX</span>
          </div>
        )}
        <div className={`w-full overflow-hidden rounded-full bg-border ${barHeight}`}>
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {size === 'md' && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Lv.{currentLevel}</span>
          <span>
            {totalXP - currentLevelXP} / {nextLevelXP - currentLevelXP} XP
          </span>
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-border ${barHeight}`}>
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
