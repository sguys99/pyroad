/** 퀘스트 헤더 스테이지 진행 점 하나 (P6-02). 서버가 그 스테이지 퀘스트·내 완료 여부를 붙여 준다 */
export interface StageQuestDot {
  id: string;
  order: number;
  title: string;
  completed: boolean;
  /** 퀘스트 유형: 코드 퀘스트의 폰 퀴즈 쪽지(P7-11)가 이 스테이지 퀴즈를 센다 */
  quest_type?: string;
}

/** done 끝냄 · todo 아직(열림) · locked 열 수 없음 */
export type DotState = 'done' | 'todo' | 'locked';

export interface StageDot extends StageQuestDot {
  state: DotState;
  /** 지금 이 화면의 퀘스트 */
  current: boolean;
}

/**
 * 진행 점 상태. 열린 스테이지 안 퀘스트는 서버 규칙상 모두 열린다(B38 가드는 스테이지 단위, StageSheet와 같음).
 * 잠긴 스테이지의 완료 퀘스트를 복습할 때만(`stageUnlocked` false) 안 끝낸 퀘스트가 잠김 — 열면 월드맵으로 돌려보내짐.
 * `currentCompleted`: 지금 퀘스트를 이번 세션에 통과하면 서버 값보다 먼저 완료로 바꾼다
 */
export function stageDots(
  quests: StageQuestDot[],
  currentId: string,
  currentCompleted: boolean,
  stageUnlocked = true,
): StageDot[] {
  return [...quests]
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      const current = q.id === currentId;
      const completed = q.completed || (current && currentCompleted);
      return {
        ...q,
        completed,
        current,
        state: completed
          ? 'done'
          : stageUnlocked || current
            ? 'todo'
            : 'locked',
      };
    });
}
