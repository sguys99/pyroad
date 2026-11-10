'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DURATION, tierDuration } from '@/lib/motion/tokens';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';

/**
 * 숫자 올리기 (P2-11, 시안 `countUp`): 값이 바뀌면 이전 값에서 새 값까지 ease-out(3차)으로 센다.
 * full은 `DURATION.progress`(700ms), lite는 70%, minimal·동작 줄이기는 즉시(스프링을 못 쓰는 단계 = 움직임 없는 숫자 교체).
 * 처음 그릴 때는 세지 않는다(첫 화면 숫자가 0에서 시작하지 않게). `from`(value보다 작을 때만)을 주면 처음에 그 값에서 센다
 * — 다른 화면에서 오른 값(퀘스트에서 받은 코인 → 월드맵 HUD, P8-04). 서버 HTML은 value 그대로, 그리기 전에 from으로 바꿈
 */
export function useCountUp(value: number, from?: number): number {
  const { budget } = useMotionTier();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  // 처음 한 번만 (아래 효과보다 먼저 돌아 shownRef 에서 세기 시작)
  useLayoutEffect(() => {
    if (from === undefined || from >= value) return;
    shownRef.current = from;
    setShown(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const from = shownRef.current;
    const ms = budget.springs ? tierDuration(DURATION.progress, budget) : 0;
    if (
      from === value ||
      ms <= 0 ||
      typeof requestAnimationFrame !== 'function'
    ) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const v = Math.round(from + (value - from) * (1 - (1 - k) ** 3));
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, budget]);

  return shown;
}
