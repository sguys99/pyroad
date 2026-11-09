'use client';

import { m } from 'framer-motion';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { EASE, sec } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

interface WindingPathProps {
  progressFraction: number;
  /** 길 SVG path (지도 설정에서 만듦, P5-03) */
  d: string;
  width: number;
  height: number;
  className?: string;
}

export function WindingPath({
  progressFraction,
  d: PATH_D,
  width,
  height,
  className,
}: WindingPathProps) {
  // 길 그리기: minimal·동작 줄이기는 즉시, lite는 70% 길이 (P2-15)
  const { budget } = useMotionTier();
  const instant = !budget.springs;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('absolute inset-0 h-full w-full', className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Background dashed path */}
      <path
        d={PATH_D}
        fill="none"
        stroke="var(--line)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray="3 8"
        opacity={0.5}
      />

      {/* Progress colored path */}
      <m.path
        d={PATH_D}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={6}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        initial={{
          strokeDashoffset: instant ? 1 - progressFraction : 1,
        }}
        animate={{ strokeDashoffset: 1 - progressFraction }}
        transition={
          instant
            ? { duration: 0 }
            : { duration: sec('draw') * budget.effectDuration, ease: EASE.ink }
        }
      />

      {/* Glow on progress path */}
      <m.path
        d={PATH_D}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={12}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        opacity={0.15}
        initial={{
          strokeDashoffset: instant ? 1 - progressFraction : 1,
        }}
        animate={{ strokeDashoffset: 1 - progressFraction }}
        transition={
          instant
            ? { duration: 0 }
            : { duration: sec('draw') * budget.effectDuration, ease: EASE.ink }
        }
      />
    </svg>
  );
}
