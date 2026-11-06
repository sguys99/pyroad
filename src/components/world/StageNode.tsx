'use client';

import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { CheckCircle, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageWithStatus } from '@/lib/types/database';
import { StageIllustration } from './StageIllustration';
import { useSfx } from '@/components/providers/SoundProvider';

const statusConfig = {
  completed: {
    icon: CheckCircle,
    borderColor: 'border-primary/60',
    bgColor: 'bg-card/90',
    iconColor: 'text-primary-text',
    label: '완료!',
    labelClass: 'bg-primary-soft text-primary-text',
  },
  in_progress: {
    icon: Play,
    borderColor: 'border-accent',
    bgColor: 'bg-card/95',
    iconColor: 'text-accent-text',
    label: '도전하기',
    labelClass: 'bg-accent-soft text-accent-text',
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
}

export function StageNode({ stage }: StageNodeProps) {
  const router = useRouter();
  const play = useSfx();
  const config = statusConfig[stage.status];
  const Icon = config.icon;
  const isClickable = stage.status !== 'locked';
  // 현재 스테이지 빛 고리는 CSS 대기 루프(.stage-pulse), 완료 반짝임은 앰비언트(.stage-shimmer) — 단계·동작 줄이기는 CSS가 처리 (P2-15)
  const shouldPulse = stage.status === 'in_progress';
  const isCompleted = stage.status === 'completed';

  function handleClick() {
    if (!isClickable || !stage.firstIncompleteQuestId) return;
    play('tap');
    router.push(`/quest/${stage.firstIncompleteQuestId}`);
  }

  return (
    <m.button
      onClick={handleClick}
      disabled={!isClickable}
      whileTap={isClickable ? { scale: 0.95 } : undefined}
      whileHover={isClickable ? { scale: 1.05 } : undefined}
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
      {shouldPulse && <span aria-hidden className="stage-pulse" />}

      {/* 완료 스테이지 반짝임 (transform만) */}
      {isCompleted && <span aria-hidden className="stage-shimmer z-0" />}

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
          <p className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {stage.order}단계
          </p>
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
        {/* 버튼 안에는 제목 태그를 둘 수 없어 span으로 둠. 목록 제목은 WorldMap의 h2 (B33) */}
        <span className="block text-xs sm:text-sm font-bold text-foreground leading-tight truncate">
          {stage.title}
        </span>
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
          stage.status === 'in_progress' && 'bg-accent-soft',
          stage.status === 'locked' && 'bg-muted-foreground/10',
        )}
      >
        <Icon className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', config.iconColor)} />
      </div>
    </m.button>
  );
}
