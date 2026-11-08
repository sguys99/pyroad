import type { PybaemState } from '@/components/characters/rig';

/**
 * 공책 옆 파이뱀 정지 그림 값 (P4-12). 서버 컴포넌트(TrialSection)가 그리는 첫 화면 정지 그림과
 * 라이브 리그(TrialBuddy)가 같은 크기·표정이어야 바꿔 끼울 때 튀지 않는다.
 */
export const TRIAL_BUDDY_SIZE = 184;

/** 서버 첫 화면(데모가 끝나고 넘겨준 모습)의 파이뱀 표정 = TrialNotebook이 처음 그리는 상태 */
export const TRIAL_BUDDY_FIRST_STATE: PybaemState = 'encourage';
