'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Code, Lightbulb, Map, Flame, Trophy } from 'lucide-react';
import { getBadgeDefinition, type BadgeType } from '@/lib/quest/badges';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Code,
  Lightbulb,
  Map,
  Flame,
  Trophy,
};

interface BadgeEarnedPopupProps {
  badges: BadgeType[];
  onComplete: () => void;
}

export function BadgeEarnedPopup({
  badges,
  onComplete,
}: BadgeEarnedPopupProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const advance = useCallback(() => {
    if (currentIndex < badges.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onComplete();
    }
  }, [currentIndex, badges.length, onComplete]);

  useEffect(() => {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    const timer = setTimeout(advance, 3000);
    return () => clearTimeout(timer);
  }, [currentIndex, advance]);

  const badge = getBadgeDefinition(badges[currentIndex]);
  const Icon = ICON_MAP[badge.icon] ?? Code;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={advance}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={badge.type}
          className="mx-4 flex max-w-xs flex-col items-center gap-3 rounded-2xl border-2 border-accent bg-card p-6 shadow-xl"
          initial={{ scale: 0.5, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20"
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', delay: 0.15 }}
          >
            <Icon className="h-8 w-8 text-accent" />
          </motion.div>

          <p className="text-xs font-medium text-muted-foreground">
            뱃지 획득!
          </p>
          <p className="text-lg font-bold text-foreground">{badge.name}</p>
          <p className="text-center text-sm text-muted-foreground">
            {badge.description}
          </p>

          {badges.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {currentIndex + 1} / {badges.length}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
