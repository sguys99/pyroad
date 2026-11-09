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

/**
 * 스테이지 보물상자 (§3 F11, P8 — 스테이지 별 합계 목표를 채우면 상자 개봉 + 내용 공개형 보상). 별·코인과 같은 방식(§12-Q52):
 * 축하 카드(`ChestCard`)는 완성해 두고 숨김 — 지금은 상자 이벤트를 만드는 곳이 없고, 와도 시퀀서가 건너뜀.
 * 카탈로그 `#celebrations`에서 열리는 모습을 확인. Phase 8에서 true
 */
export const SHOW_CHEST = false;
