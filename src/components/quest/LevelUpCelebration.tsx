'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Star } from 'lucide-react';

interface LevelUpCelebrationProps {
  newLevel: number;
  newTitle: string;
  onClose: () => void;
}

export function LevelUpCelebration({
  newLevel,
  newTitle,
  onClose,
}: LevelUpCelebrationProps) {
  useEffect(() => {
    // 강화된 confetti - 다중 발사
    const burst = () => {
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { x: 0.3, y: 0.5 },
      });
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { x: 0.7, y: 0.5 },
      });
    };
    burst();
    const timer2 = setTimeout(burst, 400);

    // 5초 후 자동 닫힘
    const autoClose = setTimeout(onClose, 5000);

    return () => {
      clearTimeout(timer2);
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
          <Star className="h-16 w-16 fill-yellow-400 text-yellow-400" />
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
      </motion.div>
    </motion.div>
  );
}
