import type { Options } from 'canvas-confetti';
import { MOTION_BUDGETS, isMotionTier } from '@/lib/motion/tier';

// canvas-confetti 모듈 사전 로드 (브라우저에서만). 이 모듈을 쓰는 화면의 청크가 로드될 때 함께 받음.
// 기본 cannon은 OffscreenCanvas Worker에서 그리므로 메인 스레드 비용은 메시지 전송뿐이다
// (Worker를 못 만들면 메인 스레드 rAF 하나로 그림).
const confettiReady =
  typeof window !== 'undefined'
    ? import('canvas-confetti').then((m) => m.default)
    : null;

/** 화면에 한꺼번에 떠 있을 수 있는 파티클 상한 (연속 축하에서 겹쳐 과해지지 않게, §2.6·§2.10) */
export const MAX_LIVE_PARTICLES = 220;
/** 파티클 하나가 떠 있는 대략의 시간 (ticks 90~110, gravity 2.2 기준) */
export const PARTICLE_LIFETIME_MS = 1600;
/** 상한에 걸려 이보다 적게 남으면 쏘지 않는다 (몇 개만 툭 떨어지는 것보다 깔끔) */
const MIN_BURST = 8;

/**
 * 최근에 쏜 파티클을 시간에 따라 줄여 가며 세는 예산. 남은 자리만큼만 쏜다.
 * 모듈 하나가 모든 컨페티(정답·단계 통과·축하 카드)를 함께 센다.
 */
export function createConfettiBudget(
  cap = MAX_LIVE_PARTICLES,
  lifetimeMs = PARTICLE_LIFETIME_MS,
) {
  let bursts: Array<{ at: number; count: number }> = [];

  function live(now: number): number {
    bursts = bursts.filter((b) => now - b.at < lifetimeMs);
    return bursts.reduce(
      (sum, b) => sum + b.count * (1 - (now - b.at) / lifetimeMs),
      0,
    );
  }

  return {
    /** 쏴도 되는 개수 (0이면 쏘지 않음)를 정하고 기록한다 */
    take(requested: number, now: number): number {
      const room = Math.floor(cap - live(now));
      const count = Math.min(Math.max(0, Math.round(requested)), room);
      if (count < MIN_BURST) return 0;
      bursts.push({ at: now, count });
      return count;
    },
    live,
    reset() {
      bursts = [];
    },
  };
}

const budget = createConfettiBudget();

/**
 * 동작 줄이기가 켜졌는지. `<html data-reduced>`(사용자 설정까지 반영, P2-15)가 있으면 그것을, 없으면 기기 설정을 본다.
 * 사용자가 "동작 줄이기: 끄기"를 고르면 기기 설정이 켜져 있어도 쏜다.
 */
function reducedMotionActive(): boolean {
  if (typeof window === 'undefined') return false;
  const attr = document.documentElement.dataset.reduced;
  if (attr === 'true' || attr === 'false') return attr === 'true';
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** `<html data-motion>`의 파티클 상한 (호출하는 쪽이 배율을 빠뜨려도 lite 30%·minimal 0을 넘지 않게) */
function tierParticleCap(): number {
  if (typeof document === 'undefined') return 1;
  const tier = document.documentElement.dataset.motion;
  return isMotionTier(tier) ? MOTION_BUDGETS[tier].particles : 1;
}

export interface FireConfettiOptions {
  /** 연출 단계의 파티클 배율 (`useMotionTier().budget.particles`). 0이면 쏘지 않음. `<html data-motion>` 상한을 넘지 않음 */
  scale?: number;
}

/**
 * 컨페티 발사. 모든 컨페티는 이 함수로만 쏴서 reduced-motion·파티클 상한을 항상 지킴 (B33, P1-10, P2-15)
 * - 동작 줄이기(`<html data-reduced>`, 없으면 `prefers-reduced-motion`)면 모듈 호출도 하지 않음
 * - `disableForReducedMotion: true`: canvas-confetti도 기기 설정을 한 번 더 확인. 사용자가 "동작 줄이기: 끄기"를 고른 때만 false
 * - 연출 단계 배율(`scale`, `<html data-motion>` 상한 이하)을 곱한 뒤, 화면에 남은 파티클 상한(`MAX_LIVE_PARTICLES`)만큼만 쏨
 * - 서버에서는 아무 일도 하지 않음
 * @returns 실제로 쏜 파티클 수
 */
export function fireConfetti(
  options: Omit<Options, 'disableForReducedMotion'>,
  { scale = 1 }: FireConfettiOptions = {},
): number {
  const effectiveScale = Math.min(scale, tierParticleCap());
  if (!confettiReady || effectiveScale <= 0 || reducedMotionActive()) return 0;
  const particleCount = budget.take(
    (options.particleCount ?? 50) * effectiveScale,
    performance.now(),
  );
  if (particleCount === 0) return 0;
  const disableForReducedMotion =
    document.documentElement.dataset.reduced !== 'false';
  confettiReady
    .then((confetti) =>
      confetti({ ...options, particleCount, disableForReducedMotion }),
    )
    .catch(() => {
      // 연출 실패는 무시 (학습 흐름에 영향 없음)
    });
  return particleCount;
}

/** 떠 있는 컨페티를 지운다 (축하를 모두 닫거나 화면을 떠날 때) */
export function resetConfetti(): void {
  budget.reset();
  confettiReady?.then((confetti) => confetti.reset()).catch(() => {});
}
