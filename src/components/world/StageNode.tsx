'use client';

import { useRouter } from 'next/navigation';
import { m, useReducedMotion } from 'framer-motion';
import { CheckCircle, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageWithStatus } from '@/lib/types/database';
import { StageIllustration } from './StageIllustration';

const statusConfig = {
  completed: {
    icon: CheckCircle,
    borderColor: 'border-primary/60',
    bgColor: 'bg-card/90',
    iconColor: 'text-primary',
    label: '완료!',
    labelClass: 'bg-primary/20 text-primary',
  },
  in_progress: {
    icon: Play,
    borderColor: 'border-secondary',
    bgColor: 'bg-card/95',
    iconColor: 'text-secondary-foreground',
    label: '도전하기',
    labelClass: 'bg-secondary/20 text-secondary-foreground',
  },
  locked: {
    icon: Lock,
    borderColor: 'border-muted',
    bgColor: 'bg-muted/80',
    iconColor: 'text-muted-foreground',
    label: '잠김',
    labelClass: 'bg-muted-foreground/10 text-muted-foreground',
  },
} as const;

interface StageNodeProps {
  stage: StageWithStatus;
  align?: 'left' | 'right' | 'center';
}

export function StageNode({ stage, align = 'center' }: StageNodeProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const config = statusConfig[stage.status];
  const Icon = config.icon;
  const isClickable = stage.status !== 'locked';
  const shouldPulse = stage.status === 'in_progress' && !shouldReduceMotion;
  const isCompleted = stage.status === 'completed';

  function handleClick() {
    if (!isClickable || !stage.firstIncompleteQuestId) return;
    router.push(`/quest/${stage.firstIncompleteQuestId}`);
  }

  return (
    <m.button
      onClick={handleClick}
      disabled={!isClickable}
      whileTap={isClickable ? { scale: 0.95 } : undefined}
      whileHover={isClickable ? { scale: 1.05 } : undefined}
      animate={
        shouldPulse
          ? {
              boxShadow: [
                '0 0 0 0 rgba(76, 175, 80, 0)',
                '0 0 12px 4px rgba(76, 175, 80, 0.3)',
                '0 0 0 0 rgba(76, 175, 80, 0)',
              ],
            }
          : undefined
      }
      transition={
        shouldPulse
          ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          : undefined
      }
      className={cn(
        'relative flex flex-row items-center gap-2 rounded-xl border-2 px-2.5 py-2 sm:px-3 sm:py-2.5 transition-colors',
        stage.order === 1
          ? 'w-[200px] sm:w-[240px] backdrop-blur-sm'
          : 'w-[170px] sm:w-[210px] backdrop-blur-sm',
        config.borderColor,
        config.bgColor,
        isClickable
          ? 'cursor-pointer hover:shadow-lg'
          : 'cursor-not-allowed opacity-60',
        isCompleted && 'overflow-hidden',
      )}
    >
      {/* Shimmer overlay for completed stages */}
      {isCompleted && (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,215,0,0.12), transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s ease-in-out infinite',
          }}
        />
      )}

      {/* Illustration */}
      <div className="relative z-10 w-10 h-10 sm:w-12 sm:h-12 shrink-0">
        <StageIllustration
          themeName={stage.theme_name}
          className="w-full h-full"
        />
      </div>

      {/* Stage info */}
      <div className="relative z-10 flex-1 min-w-0 text-left">
        <div className="flex items-center gap-0.5">
          <p className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{stage.order}단계</p>
          <span
            className={cn(
              'rounded-full px-1 py-px text-[9px] sm:text-[10px] font-semibold shrink-0 whitespace-nowrap',
              'sm:px-1.5',
              config.labelClass,
            )}
          >
            {config.label}
          </span>
        </div>
        <h3 className="text-xs sm:text-sm font-bold text-foreground leading-tight truncate">
          {stage.title}
        </h3>
        {stage.status !== 'locked' && (
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">
            {stage.completedQuestCount}/{stage.totalQuestCount} 퀘스트
          </p>
        )}
      </div>

      {/* Status icon */}
      <div
        className={cn(
          'relative z-10 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full shrink-0',
          stage.status === 'completed' && 'bg-primary/20',
          stage.status === 'in_progress' && 'bg-secondary/20',
          stage.status === 'locked' && 'bg-muted-foreground/10',
        )}
      >
        <Icon className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', config.iconColor)} />
      </div>
    </m.button>
  );
}
