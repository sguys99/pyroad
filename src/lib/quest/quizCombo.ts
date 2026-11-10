'use client';

import { useSyncExternalStore } from 'react';

/**
 * 퀴즈 연속 정답 콤보 (P7-09, §12-Q60 4c). 저장하지 않는 세션 표시: 모듈 메모리라 같은 탭 안에서
 * 다시 풀기·다음 퀴즈로 이동(클라이언트 내비게이션)해도 이어지고, 새로고침·새 탭이면 0부터.
 * 오답(3번째 공개 포함)이면 0. 오늘의 퀴즈 `/daily`(P7-10)도 같은 스토어를 쓴다.
 */
let combo = 0;
const listeners = new Set<() => void>();

/** 배지를 보이기 시작하는 콤보 */
export const COMBO_BADGE_MIN = 2;

export function getQuizCombo(): number {
  return combo;
}

/** 채점 결과 하나를 반영하고 새 콤보를 돌려준다 */
export function recordQuizAnswer(correct: boolean): number {
  combo = correct ? combo + 1 : 0;
  listeners.forEach((l) => l());
  return combo;
}

export function resetQuizCombo(): void {
  if (combo === 0) return;
  combo = 0;
  listeners.forEach((l) => l());
}

export function subscribeQuizCombo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 서버 렌더·하이드레이션은 0 (모듈 값은 클라이언트에만 있음) */
export function useQuizCombo(): number {
  return useSyncExternalStore(subscribeQuizCombo, getQuizCombo, () => 0);
}

/** 정답 'correct' 피치: 콤보 1 → 1, 2 → 1.12, 3 이상 → 1.26 (장3도에서 멈춤, 듣기 피로 방지) */
export function comboRate(n: number): number {
  return n >= 3 ? 1.26 : n === 2 ? 1.12 : 1;
}
