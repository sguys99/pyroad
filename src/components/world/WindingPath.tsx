'use client';

import { m } from 'framer-motion';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { EASE } from '@/lib/motion/tokens';

interface WindingPathProps {
  progressFraction: number;
}

const PATH_D = [
  'M 200 413',
  'C 200 384, 100 372, 100 348',
  'C 100 312, 248 300, 248 283',
  'C 248 252, 100 236, 100 216',
  'C 100 184, 248 168, 248 149',
  'C 248 116, 100 104, 100 84',
  'C 100 52, 200 38, 200 19',
].join(' ');

export function WindingPath({ progressFraction }: WindingPathProps) {
  // 길 그리기: minimal·동작 줄이기는 즉시, lite는 70% 길이 (P2-15)
  const { budget } = useMotionTier();
  const instant = !budget.springs;

  return (
    <svg
      viewBox="0 0 400 480"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Background dashed path */}
      <path
        d={PATH_D}
        fill="none"
        stroke="oklch(0.82 0.02 85)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray="3 8"
        opacity={0.5}
      />

      {/* Progress colored path */}
      <m.path
        d={PATH_D}
        fill="none"
        stroke="oklch(0.6 0.16 145)"
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
            : { duration: 1.5 * budget.effectDuration, ease: EASE.ink }
        }
      />

      {/* Glow on progress path */}
      <m.path
        d={PATH_D}
        fill="none"
        stroke="oklch(0.6 0.16 145)"
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
            : { duration: 1.5 * budget.effectDuration, ease: EASE.ink }
        }
      />
    </svg>
  );
}
