'use client';

import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageWithStatus } from '@/lib/types/database';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';

const statusConfig = {
  completed: {
    icon: CheckCircle,
    bg: 'bg-primary/10 border-primary',
    iconColor: 'text-primary',
    label: '완료!',
  },
  in_progress: {
    icon: Play,
    bg: 'bg-secondary/10 border-secondary',
    iconColor: 'text-secondary-foreground',
    label: '도전하기',
  },
  locked: {
    icon: Lock,
    bg: 'bg-muted border-muted',
    iconColor: 'text-muted-foreground',
    label: '잠김',
  },
} as const;

interface StageNodeProps {
  stage: StageWithStatus;
}

export function StageNode({ stage }: StageNodeProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const config = statusConfig[stage.status];
  const Icon = config.icon;
  const isClickable = stage.status !== 'locked';
  const shouldPulse = stage.status === 'in_progress' && !shouldReduceMotion;

  function handleClick() {
    if (!isClickable || !stage.firstIncompleteQuestId) return;
    router.push(`/quest/${stage.firstIncompleteQuestId}`);
  }

  return (
    <div className="relative w-full max-w-md">
      {stage.status === 'in_progress' && (
        <motion.div
          className="absolute -right-2 -top-4 z-10"
          animate={shouldReduceMotion ? undefined : { y: [0, -4, 0] }}
          transition={shouldReduceMotion ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <CharacterAvatar character="pybaem" expression="happy" size="sm" />
        </motion.div>
      )}
      <motion.button
        onClick={handleClick}
        disabled={!isClickable}
        whileTap={isClickable ? { scale: 0.97 } : undefined}
        whileHover={isClickable ? { scale: 1.02 } : undefined}
        animate={
          shouldPulse
            ? {
                boxShadow: [
                  '0 0 0 0 rgba(76, 175, 80, 0)',
                  '0 0 8px 3px rgba(76, 175, 80, 0.25)',
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
          'flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors',
          'min-h-[68px]',
          config.bg,
          isClickable
            ? 'cursor-pointer hover:shadow-md'
            : 'cursor-not-allowed opacity-60',
        )}
      >
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            stage.status === 'completed' && 'bg-primary/20',
            stage.status === 'in_progress' && 'bg-secondary/20',
            stage.status === 'locked' && 'bg-muted-foreground/10',
          )}
        >
          <Icon className={cn('h-6 w-6', config.iconColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {stage.order}단계
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                stage.status === 'completed' &&
                  'bg-primary/20 text-primary',
                stage.status === 'in_progress' &&
                  'bg-secondary/20 text-secondary-foreground',
                stage.status === 'locked' &&
                  'bg-muted-foreground/10 text-muted-foreground',
              )}
            >
              {config.label}
            </span>
          </div>
          <h3 className="font-bold text-foreground truncate">{stage.title}</h3>
          {stage.status !== 'locked' && (
            <p className="text-xs text-muted-foreground">
              {stage.completedQuestCount}/{stage.totalQuestCount} 퀘스트 완료
            </p>
          )}
        </div>
      </motion.button>
    </div>
  );
}
