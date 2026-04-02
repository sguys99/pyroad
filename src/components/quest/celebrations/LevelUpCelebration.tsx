'use client';

import { motion } from 'framer-motion';
import { CelebrationOverlay, type ConfettiBurst } from './CelebrationOverlay';
import { LottieCharacter } from '@/components/characters/LottieCharacter';

interface LevelUpCelebrationProps {
  newLevel: number;
  newTitle: string;
  onClose: () => void;
}

const confettiBursts: ConfettiBurst[] = [
  { particleCount: 80, spread: 100, origin: { x: 0.3, y: 0.5 }, delay: 0 },
  { particleCount: 80, spread: 100, origin: { x: 0.7, y: 0.5 }, delay: 0 },
  { particleCount: 80, spread: 100, origin: { x: 0.3, y: 0.5 }, delay: 400 },
  { particleCount: 80, spread: 100, origin: { x: 0.7, y: 0.5 }, delay: 400 },
];

export function LevelUpCelebration({
  newLevel,
  newTitle,
  onClose,
}: LevelUpCelebrationProps) {
  return (
    <CelebrationOverlay
      onClose={onClose}
      autoCloseMs={5000}
      confettiBursts={confettiBursts}
    >
      <motion.div
        initial={{ rotate: -30, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
      >
        <LottieCharacter
          character="pybaem"
          animation="level-up"
          size={80}
          fallbackExpression="celebrating"
        />
      </motion.div>

      <p className="text-sm font-medium text-muted-foreground">레벨 업!</p>

      <motion.p
        className="text-5xl font-black text-primary"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.3 }}
      >
        Lv.{newLevel}
      </motion.p>

      <motion.p
        className="text-xl font-bold text-foreground"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {newTitle}
      </motion.p>

      <motion.button
        className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        멋져요!
      </motion.button>
    </CelebrationOverlay>
  );
}
