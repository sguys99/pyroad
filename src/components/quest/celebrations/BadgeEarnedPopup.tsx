'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Code, Lightbulb, Map, Flame, Trophy } from 'lucide-react';
import { getBadgeDefinition, type BadgeType } from '@/lib/quest/badges';
import { CelebrationOverlay, type ConfettiBurst } from './CelebrationOverlay';

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
  const shouldReduceMotion = useReducedMotion();

  const advance = useCallback(() => {
    if (currentIndex < badges.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onComplete();
    }
  }, [currentIndex, badges.length, onComplete]);

  const badge = getBadgeDefinition(badges[currentIndex]);
  const Icon = ICON_MAP[badge.icon] ?? Code;

  const confettiBursts: ConfettiBurst[] = [
    { particleCount: 50, spread: 60, origin: { y: 0.6, x: 0.5 } },
  ];

  return (
    <CelebrationOverlay
      onClose={advance}
      autoCloseMs={3000}
      confettiBursts={confettiBursts}
      backdropClass="bg-black/30"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={badge.type}
          className="flex flex-col items-center gap-3"
          initial={shouldReduceMotion ? undefined : { scale: 0.5, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { scale: 0.8, opacity: 0, y: -20 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: 'spring', damping: 18, stiffness: 300 }
          }
        >
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20"
            initial={shouldReduceMotion ? undefined : { rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', delay: 0.15 }
            }
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
    </CelebrationOverlay>
  );
}
