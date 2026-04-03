'use client';

import { m, useReducedMotion } from 'framer-motion';

interface WindingPathProps {
  progressFraction: number;
}

const PATH_D = [
  'M 200 516',
  'C 200 480, 100 465, 100 435',
  'C 100 390, 248 375, 248 354',
  'C 248 315, 100 295, 100 270',
  'C 100 230, 248 210, 248 186',
  'C 248 145, 100 130, 100 105',
  'C 100 65, 200 48, 200 24',
].join(' ');

export function WindingPath({ progressFraction }: WindingPathProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <svg
      viewBox="0 0 400 600"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
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
        initial={{ strokeDashoffset: shouldReduceMotion ? 1 - progressFraction : 1 }}
        animate={{ strokeDashoffset: 1 - progressFraction }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 1.5, ease: 'easeOut' }
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
        initial={{ strokeDashoffset: shouldReduceMotion ? 1 - progressFraction : 1 }}
        animate={{ strokeDashoffset: 1 - progressFraction }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 1.5, ease: 'easeOut' }
        }
      />
    </svg>
  );
}
