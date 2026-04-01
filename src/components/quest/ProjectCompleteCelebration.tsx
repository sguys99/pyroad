'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy } from 'lucide-react';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';

interface ProjectCompleteCelebrationProps {
  earnedXP: number;
  onClose: () => void;
}

export function ProjectCompleteCelebration({
  earnedXP,
  onClose,
}: ProjectCompleteCelebrationProps) {
  useEffect(() => {
    // 3연속 confetti (좌, 중앙, 우)
    const burst = (x: number, delay: number) =>
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 120,
          origin: { x, y: 0.5 },
          colors: ['#22c55e', '#facc15', '#f97316', '#3b82f6', '#a855f7'],
        });
      }, delay);

    burst(0.2, 0);
    burst(0.5, 300);
    burst(0.8, 600);

    // 추가 발사
    const extra = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 160,
        origin: { x: 0.5, y: 0.4 },
      });
    }, 1200);

    const autoClose = setTimeout(onClose, 6000);

    return () => {
      clearTimeout(extra);
      clearTimeout(autoClose);
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl bg-card p-8 shadow-xl"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ rotate: -30, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
        >
          <Trophy className="h-16 w-16 fill-yellow-400 text-yellow-400" />
        </motion.div>

        <motion.p
          className="text-lg font-bold text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          프로젝트 완성!
        </motion.p>

        <motion.div
          className="flex items-center gap-2 text-4xl"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.3 }}
        >
          <CharacterAvatar character="pybaem" expression="celebrating" size="md" animated />
          <span>🎉</span>
          <span>🏆</span>
        </motion.div>

        <motion.p
          className="text-center text-xl font-black text-primary"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          숫자 맞추기 게임을
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
      </motion.div>
    </motion.div>
  );
}
