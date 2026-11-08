import type { MotionTier } from '@/lib/motion/tier';

/**
 * 세계관 지도가 펼쳐지는 방식 (P4-04, motion-guidelines §2·§6).
 * - `scroll`: full + 스크롤 연동 애니메이션 지원(`animation-timeline: view()`). CSS만으로 돈다 (JS가 할 일 없음)
 * - `once`: lite, 또는 full인데 브라우저가 스크롤 연동을 모름(Firefox 등) → 화면에 들어올 때 한 번 펼침 (JS가 `data-armed`·`data-open`)
 * - `static`: minimal·동작 줄이기 → 처음부터 펼쳐진 정지 상태
 */
export type RevealMode = 'scroll' | 'once' | 'static';

export function pickRevealMode(
  tier: MotionTier,
  reduced: boolean,
  supportsScrollTimeline: boolean,
): RevealMode {
  if (reduced || tier === 'minimal') return 'static';
  if (tier === 'full' && supportsScrollTimeline) return 'scroll';
  return 'once';
}

/** 브라우저가 CSS 스크롤 연동 애니메이션(view timeline)을 아는지 */
export function supportsViewTimeline(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timeline: view()')
  );
}
