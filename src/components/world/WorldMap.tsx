'use client';

import { motion } from 'framer-motion';
import type { StageWithStatus } from '@/lib/types/database';
import { StageNode } from './StageNode';

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
};

interface WorldMapProps {
  stages: StageWithStatus[];
}

export function WorldMap({ stages }: WorldMapProps) {
  const reversed = [...stages].sort((a, b) => b.order - a.order);

  return (
    <motion.div
      className="flex flex-col items-center gap-2 px-4 pb-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {reversed.map((stage, index) => (
        <motion.div
          key={stage.id}
          className="flex flex-col items-center w-full"
          variants={item}
        >
          <StageNode stage={stage} />
          {index < reversed.length - 1 && (
            <motion.div
              className="h-6 w-0.5 bg-border"
              variants={item}
            />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
