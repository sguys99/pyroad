import type { Options } from 'canvas-confetti';

// canvas-confetti 모듈 사전 로드 (브라우저에서만). 이 모듈을 쓰는 화면의 청크가 로드될 때 함께 받음
const confettiReady =
  typeof window !== 'undefined'
    ? import('canvas-confetti').then((m) => m.default)
    : null;

/**
 * 컨페티 발사. 모든 컨페티는 이 함수로만 쏴서 reduced-motion을 항상 존중함 (B33)
 * - `disableForReducedMotion: true`: `prefers-reduced-motion: reduce`면 canvas-confetti가 아무것도 그리지 않음
 * - 서버에서는 아무 일도 하지 않음
 */
export function fireConfetti(
  options: Omit<Options, 'disableForReducedMotion'>,
): void {
  confettiReady
    ?.then((confetti) =>
      confetti({ ...options, disableForReducedMotion: true }),
    )
    .catch(() => {
      // 연출 실패는 무시 (학습 흐름에 영향 없음)
    });
}
