'use client';

import { m, type Variants } from 'framer-motion';
import type { StageWithStatus } from '@/lib/types/database';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import type { MotionBudget } from '@/lib/motion/tier';
import { EASE } from '@/lib/motion/tokens';
import { StageNode } from './StageNode';
import { WindingPath } from './WindingPath';
import { FloatingDecorations } from './FloatingDecorations';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';

/** 노드 차례 등장: full 크기+투명도, lite 70% 길이, minimal 페이드만, 동작 줄이기 즉시 (P2-15) */
function nodeVariants(budget: MotionBudget): {
  container: Variants;
  item: Variants;
} {
  const k = budget.effectDuration;
  return {
    container: {
      hidden: {},
      show: {
        transition: { staggerChildren: 0.1 * k, delayChildren: 0.3 * k },
      },
    },
    item: {
      hidden: budget.springs ? { opacity: 0, scale: 0.85 } : { opacity: 0 },
      show: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.45 * k, ease: EASE.out },
      },
    },
  };
}

/**
 * Zigzag node positions (bottom-to-top, matching SVG viewBox 0 0 400 600).
 * Each entry: left position (mobile / desktop) and top position, in percent.
 * Stages are displayed in reverse order (7 at top, 1 at bottom).
 */
const NODE_POSITIONS: Array<{
  mobileLeft: string;
  desktopLeft: string;
  top: string;
}> = [
  { mobileLeft: '30%', desktopLeft: '50%', top: '86%' }, // Stage 1 (bottom)
  { mobileLeft: '15%', desktopLeft: '22%', top: '72.5%' }, // Stage 2
  { mobileLeft: '45%', desktopLeft: '55%', top: '59%' }, // Stage 3
  { mobileLeft: '15%', desktopLeft: '22%', top: '45%' }, // Stage 4
  { mobileLeft: '45%', desktopLeft: '55%', top: '31%' }, // Stage 5
  { mobileLeft: '15%', desktopLeft: '22%', top: '17.5%' }, // Stage 6
  { mobileLeft: '30%', desktopLeft: '50%', top: '4%' }, // Stage 7 (top)
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
  const { budget } = useMotionTier();
  const { container, item } = nodeVariants(budget);
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const progressFraction = computeProgressFraction(stages);

  const inProgressStage = sorted.find((s) => s.status === 'in_progress');
  const inProgressIndex = inProgressStage
    ? sorted.findIndex((s) => s.id === inProgressStage.id)
    : -1;

  return (
    <div className="relative w-full aspect-[2/3] sm:aspect-[400/480]">
      {/* 화면 읽기 프로그램용 목록 제목 (페이지 h1 "모험 지도" 아래 단계, B33) */}
      <h2 className="sr-only">모험 스테이지</h2>

      {/* SVG winding path background */}
      <WindingPath progressFraction={progressFraction} />

      {/* Floating decorations (clouds, leaves) */}
      <FloatingDecorations />

      {/* 진행 중 스테이지의 파이뱀. 통통은 CSS 대기 루프(.mascot-bob, full·lite, §2.10) */}
      {inProgressIndex >= 0 && (
        <div
          className="world-node absolute z-20 pointer-events-none"
          style={
            {
              '--ml': NODE_POSITIONS[inProgressIndex].mobileLeft,
              '--dl': NODE_POSITIONS[inProgressIndex].desktopLeft,
              top: NODE_POSITIONS[inProgressIndex].top,
              transform: 'translate(-50%, -110%)',
            } as React.CSSProperties
          }
        >
          <div className="mascot-bob">
            <CharacterAvatar character="pybaem" expression="happy" size="sm" />
          </div>
        </div>
      )}

      {/* Stage nodes */}
      <m.div
        className="absolute inset-0"
        variants={container}
        initial={budget.effectDuration === 0 ? false : 'hidden'}
        animate="show"
      >
        {sorted.map((stage, index) => {
          const pos = NODE_POSITIONS[index];
          return (
            <m.div
              key={stage.id}
              className="world-node absolute z-10"
              style={
                {
                  '--ml': pos.mobileLeft,
                  '--dl': pos.desktopLeft,
                  top: pos.top,
                  transform: 'translate(-50%, -50%)',
                } as React.CSSProperties
              }
              variants={item}
            >
              <StageNode stage={stage} />
            </m.div>
          );
        })}
      </m.div>
    </div>
  );
}
