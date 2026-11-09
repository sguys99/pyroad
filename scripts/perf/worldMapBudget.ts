// 월드맵 성능 예산 판정 (P5-14, §2.10). 측정은 world-map-bench.ts, 단위 테스트는 __tests__/world-map-bench.test.ts

import { tierIndex, type MotionTier } from '../../src/lib/motion/tier';

/** §2.10 월드맵 예산 */
export const WORLD_BUDGET = {
  idleMainBusyPct: 50,
  scrollRafP95Ms: 33,
  scrollCompositorFps: 50,
} as const;

export const pct = (xs: number[], p: number): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))];
};
export const median = (xs: number[]): number => pct(xs, 50);

export interface Measured {
  idleFull4x: { mainBusyPct: number };
  scroll4x: Array<{ tier: MotionTier; rafP95: number; compositorFps: number }>;
}

/** 예산 판정 (넘은 것만 문장으로) */
export function judge(m: Measured): string[] {
  const out: string[] = [];
  if (m.idleFull4x.mainBusyPct > WORLD_BUDGET.idleMainBusyPct)
    out.push(
      `대기 메인 스레드 ${m.idleFull4x.mainBusyPct}% > ${WORLD_BUDGET.idleMainBusyPct}%`,
    );
  for (const s of m.scroll4x) {
    if (s.rafP95 > WORLD_BUDGET.scrollRafP95Ms)
      out.push(
        `${s.tier} 스크롤 rAF p95 ${s.rafP95}ms > ${WORLD_BUDGET.scrollRafP95Ms}ms`,
      );
    if (s.compositorFps < WORLD_BUDGET.scrollCompositorFps)
      out.push(
        `${s.tier} 스크롤 컴포지터 ${s.compositorFps}fps < ${WORLD_BUDGET.scrollCompositorFps}fps`,
      );
  }
  return out;
}

/** 자동 단계가 정적 추정보다 높으면 잘못 (실측은 내리기만 함) */
export function tierOk(observed: MotionTier, guess: MotionTier): boolean {
  return tierIndex(observed) >= tierIndex(guess);
}
