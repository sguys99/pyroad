/**
 * 연출 단계 → 리그 동작 정책 (P2-15 `MotionBudget`을 그대로 읽는다).
 * 단계 이름으로 분기하지 않고 budget 값(`mascot`·`mascotFps`·`mascotSecondary`·`blink`·`blur`)만 본다.
 *
 * | | full | lite | minimal | 동작 줄이기 (별개 축, §12-Q26) |
 * |---|---|---|---|---|
 * | 루프 | 모든 레이어 60fps | 모든 레이어 30fps 상한 | 상태 전환만, 끝나면 정지 | 위치·크기 변화 0, 표정·색만 즉시 |
 * | 2차 움직임 | 두리번·오버래핑·선 떨림 | 끔 | 끔 | 끔 |
 * | 종이 필터 | 켬 | 끔 (외곽선만) | 끔 | 단계 따름 (정지) |
 * | 눈 깜빡임 | 보통 | 보통 | 끔 | 느리게 (7초마다 0.4초) |
 * | 후광 색 | 없음 | 없음 | 상태 색 | 상태 색 |
 */
import { motionBudget, type MotionTier } from '../../../../lib/motion/tier';

export interface RigPolicy {
  tier: MotionTier;
  reduced: boolean;
  /** live = 모든 레이어, transitions = 상태 전환만(대기 CPU 0), still = 움직임 0 */
  mode: 'live' | 'transitions' | 'still';
  /** 프레임 상한. 0이면 대기 루프 없음 (전환은 30fps로 그림) */
  fps: number;
  /** 두리번·오버래핑 액션·B안 선 떨림 */
  secondary: boolean;
  blink: 'normal' | 'slow' | 'off';
  /** SVG 필터(종이 결·선 흔들림)를 그리나 */
  filters: boolean;
  /** 상태별 후광 색으로 알리나 (움직임을 줄였을 때의 단서) */
  halo: boolean;
}

export function rigPolicy(tier: MotionTier, reduced: boolean): RigPolicy {
  const b = motionBudget(tier, reduced);
  return {
    tier,
    reduced,
    mode: b.mascot,
    fps: b.mascotFps,
    secondary: b.mascotSecondary,
    blink: b.blink,
    filters: b.blur,
    halo: b.mascot !== 'live',
  };
}

/** 렌더 간격(초): 단계 상한. 전환만 그리는 단계는 30fps */
export function policyInterval(p: RigPolicy): number {
  if (p.mode === 'still') return 0;
  const fps = p.mode === 'transitions' ? 30 : p.fps;
  return fps >= 60 ? 0 : 1 / fps;
}
