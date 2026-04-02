'use client';

import { motion } from 'framer-motion';
import { CelebrationOverlay, type ConfettiBurst } from './CelebrationOverlay';
import { LottieCharacter } from '@/components/characters/LottieCharacter';

interface ProjectCompleteCelebrationProps {
  earnedXP: number;
  questName?: string;
  onClose: () => void;
}

const confettiBursts: ConfettiBurst[] = [
  {
    particleCount: 100,
    spread: 120,
    origin: { x: 0.2, y: 0.5 },
    delay: 0,
    colors: ['#22c55e', '#facc15', '#f97316', '#3b82f6', '#a855f7'],
  },
  {
    particleCount: 100,
    spread: 120,
    origin: { x: 0.5, y: 0.5 },
    delay: 300,
    colors: ['#22c55e', '#facc15', '#f97316', '#3b82f6', '#a855f7'],
  },
  {
    particleCount: 100,
    spread: 120,
    origin: { x: 0.8, y: 0.5 },
    delay: 600,
    colors: ['#22c55e', '#facc15', '#f97316', '#3b82f6', '#a855f7'],
  },
  {
    particleCount: 60,
    spread: 160,
    origin: { x: 0.5, y: 0.4 },
    delay: 1200,
  },
];

export function ProjectCompleteCelebration({
  earnedXP,
  questName = '프로젝트',
  onClose,
}: ProjectCompleteCelebrationProps) {
  return (
    <CelebrationOverlay
      onClose={onClose}
      autoCloseMs={6000}
      confettiBursts={confettiBursts}
    >
      <motion.div
        initial={{ rotate: -30, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
      >
        <LottieCharacter
          character="pybaem"
          animation="project-complete"
          size={80}
          fallbackExpression="celebrating"
        />
      </motion.div>

      <motion.p
        className="text-lg font-bold text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        프로젝트 완성!
      </motion.p>

      <motion.p
        className="text-center text-xl font-black text-primary"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {questName}을
        <br />
        완성했어요!
      </motion.p>

      <motion.p
        className="text-sm font-medium text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        +{earnedXP} XP 획득!
      </motion.p>

      <motion.button
        className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        대단해요!
      </motion.button>
    </CelebrationOverlay>
  );
}
