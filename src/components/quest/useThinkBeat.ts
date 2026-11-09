'use client';

import { useEffect, useState } from 'react';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { tierDuration } from '@/lib/motion/tokens';

/** 생각하는 박자 (full 기준, lite·minimal 70%, 동작 줄이기 0) */
const THINK_MS = 1100;

/**
 * `key`(실행 결과)가 바뀐 뒤 잠깐 true — 파이뱀이 `think`로 고민한 다음 설명하게 (P6-07).
 * `on`이 아니거나 동작 줄이기면 늘 false
 */
export function useThinkBeat(key: unknown, on: boolean): boolean {
  const { budget } = useMotionTier();
  const ms = tierDuration(THINK_MS, budget);
  const [doneKey, setDoneKey] = useState<unknown>(null);
  useEffect(() => {
    if (!on || !ms) return;
    const t = setTimeout(() => setDoneKey(key), ms);
    return () => clearTimeout(t);
  }, [key, on, ms]);
  return on && ms > 0 && doneKey !== key;
}
