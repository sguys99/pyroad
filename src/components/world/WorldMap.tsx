'use client';

import { m, useReducedMotion } from 'framer-motion';
import type { StageWithStatus } from '@/lib/types/database';
import { StageNode } from './StageNode';
import { WindingPath } from './WindingPath';
import { FloatingDecorations } from './FloatingDecorations';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const item = {
  hidden: { opacity: 0, scale: 0.85 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: 'easeOut' as const },
  },
};

/**
 * Zigzag node positions (bottom-to-top, matching SVG viewBox 0 0 400 600).
 * Each entry: [leftPercent, topPercent, alignment]
 * Stages are displayed in reverse order (7 at top, 1 at bottom).
 */
const NODE_POSITIONS: Array<{
  left: string;
  top: string;
  align: 'left' | 'right' | 'center';
}> = [
  { left: '50%', top: '86%', align: 'center' },      // Stage 1 (bottom)
  { left: '22%', top: '72.5%', align: 'left' },      // Stage 2
  { left: '55%', top: '59%', align: 'right' },       // Stage 3
  { left: '22%', top: '45%', align: 'left' },        // Stage 4
  { left: '55%', top: '31%', align: 'right' },       // Stage 5
  { left: '22%', top: '17.5%', align: 'left' },      // Stage 6
  { left: '50%', top: '4%', align: 'center' },       // Stage 7 (top)
];

function computeProgressFraction(stages: StageWithStatus[]): number {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  let completed = 0;

  for (const stage of sorted) {
    if (stage.status === 'completed') {
      completed++;
    } else if (stage.status === 'in_progress') {
      const partial =
        stage.totalQuestCount > 0
          ? stage.completedQuestCount / stage.totalQuestCount
          : 0;
      completed += partial;
      break;
    } else {
      break;
    }
  }

  return Math.min(completed / (sorted.length - 1), 1);
}

interface WorldMapProps {
  stages: StageWithStatus[];
}

export function WorldMap({ stages }: WorldMapProps) {
  const shouldReduceMotion = useReducedMotion();
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const progressFraction = computeProgressFraction(stages);

  const inProgressStage = sorted.find((s) => s.status === 'in_progress');
  const inProgressIndex = inProgressStage
    ? sorted.findIndex((s) => s.id === inProgressStage.id)
    : -1;

  return (
    <div className="relative w-full aspect-[2/3] sm:aspect-[400/480]">
      {/* SVG winding path background */}
      <WindingPath progressFraction={progressFraction} />

      {/* Floating decorations (clouds, leaves) */}
      <FloatingDecorations />

      {/* Pybaem character at in_progress stage */}
      {inProgressIndex >= 0 && (
        <m.div
          className="absolute z-20 pointer-events-none"
          style={{
            left: NODE_POSITIONS[inProgressIndex].left,
            top: NODE_POSITIONS[inProgressIndex].top,
            transform: 'translate(-50%, -110%)',
          }}
          animate={
            shouldReduceMotion ? undefined : { y: [0, -6, 0] }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <CharacterAvatar
            character="pybaem"
            expression="happy"
            size="sm"
          />
        </m.div>
      )}

      {/* Stage nodes */}
      <m.div
        className="absolute inset-0"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {sorted.map((stage, index) => {
          const pos = NODE_POSITIONS[index];
          return (
            <m.div
              key={stage.id}
              className="absolute z-10"
              style={{
                left: pos.left,
                top: pos.top,
                transform: 'translate(-50%, -50%)',
              }}
              variants={item}
            >
              <StageNode stage={stage} align={pos.align} />
            </m.div>
          );
        })}
      </m.div>
    </div>
  );
}
