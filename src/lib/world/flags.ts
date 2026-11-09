/**
 * 별 표시 (§12-Q51). 별(`best_stars`)은 Phase 8 별점 시스템(P8-05)부터 기록되므로 그 전에는 별 대신 퀘스트 수로 보인다.
 * 노드(`StageNode` 이름표 아래)와 스테이지 시트(`StageSheet` 진행 요약·퀘스트별 별)가 함께 바뀐다. P8-05에서 true로
 */
export const SHOW_STARS = false;

/**
 * 코인 표시 (§12-Q52). 코인은 Phase 8 재화(P8-04)부터 받으므로 그 전에는 퀘스트 통과 보상에 XP만 보인다.
 * 별(`SHOW_STARS`)과 함께 연출 코드는 완성해 두고 숨김 — 카탈로그 `#success-staging`에서 켠 모습을 확인. P8-04에서 true
 */
export const SHOW_COINS = false;
