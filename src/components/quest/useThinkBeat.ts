'use client';

import { useEffect, useState } from 'react';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { tierDuration } from '@/lib/motion/tokens';

/** 생각하는 박자 (full 기준, lite·minimal 70%, 동작 줄이기 0) */
const THINK_MS = 1100;

/** 성공 박자: 기쁨 점프(`happy` 두 번 + 젤리)를 보여 준 뒤 응원(`cheer`)으로 (P6-08, 성공 장면 길이와 같게) */
export const HAPPY_MS = 1600;

/**
 * `key`(실행 결과)가 바뀐 뒤 잠깐 true — 파이뱀이 `think`로 고민한 다음 설명하게 (P6-07),
 * 성공이면 `happy`로 뛴 다음 `cheer`로 (P6-08, `fullMs = HAPPY_MS`).
 * `on`이 아니거나 동작 줄이기면 늘 false
 */
export function useThinkBeat(
  key: unknown,
  on: boolean,
  fullMs = THINK_MS,
): boolean {
  const { budget } = useMotionTier();
  const ms = tierDuration(fullMs, budget);
  const [doneKey, setDoneKey] = useState<unknown>(null);
  useEffect(() => {
    if (!on || !ms) return;
    const t = setTimeout(() => setDoneKey(key), ms);
    return () => clearTimeout(t);
  }, [key, on, ms]);
  return on && ms > 0 && doneKey !== key;
}
