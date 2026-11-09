/**
 * 잠금 해제 연출 "본 기록" 비교 (P5-05, §12-Q49). 순수 함수라 서버(월드맵 데이터)와 화면이 같이 쓴다.
 *
 * 규칙
 * - 본 기록(`user_seen_unlocks`)을 읽지 못했으면(마이그레이션 00025 전 DB·조회 실패) 아무것도 하지 않는다: 연출도 기록도 없음
 * - 기록이 하나도 없는 사용자(배포 전부터 있던 사용자·새 사용자)는 지금 열린 스테이지를 모두 **연출 없이** 기록한다 (`silent`).
 *   배포 직후 기존 사용자에게 이미 열어 둔 스테이지마다 연출이 줄줄이 나오지 않게 하고, 새 사용자는 첫 스테이지가 기준이 된다
 * - 그 밖에는 열렸는데 아직 기록이 없는 스테이지가 "새로 열린" 스테이지 (`stageIds`)
 */

export interface UnlockPlan {
  /** 기록이 하나도 없음 → `stageIds`(지금 열린 전부)를 연출 없이 기록 */
  silent: boolean;
  /** silent 면 지금 열린 스테이지 전부, 아니면 새로 열린(아직 안 본) 스테이지. 열린 순서 그대로 */
  stageIds: string[];
}

export function planUnlocks(
  unlockedStageIds: readonly string[],
  seenStageIds: readonly string[] | null,
): UnlockPlan | null {
  if (!seenStageIds) return null;
  if (seenStageIds.length === 0)
    return { silent: true, stageIds: [...unlockedStageIds] };
  const seen = new Set(seenStageIds);
  return {
    silent: false,
    stageIds: unlockedStageIds.filter((id) => !seen.has(id)),
  };
}

/**
 * 지도에서 연출할 스테이지: 이 지도(order 순 스테이지)에서 새로 열린 것 중 가장 뒤 (= 지금 위치 파이뱀이 설 곳).
 * 여러 개가 한꺼번에 열렸으면(다른 기기에서 두 스테이지를 깸) 마지막 것 하나만 연출하고 나머지는 같이 기록한다. 없으면 -1
 */
export function pickUnlockIndex(
  stages: ReadonlyArray<{ id: string; status: string }>,
  newStageIds: readonly string[],
): number {
  const fresh = new Set(newStageIds);
  return stages.findLastIndex((s) => s.status !== 'locked' && fresh.has(s.id));
}
