// 잠긴 스테이지 안내 (B38). 서버(퀘스트 페이지 가드·튜터·보상 API)와 월드맵 화면이 같이 쓴다.

/** 아이에게 보여 주는 문구 (튜터 403, 보상 RPC stage_locked, 월드맵 안내) */
export const STAGE_LOCKED_MESSAGE =
  '아직 열리지 않은 스테이지예요. 앞 스테이지를 먼저 깨 볼까요?';

/** 월드맵이 안내를 띄우는 쿼리 값 (`/world?notice=stage-locked`) */
export const STAGE_LOCKED_NOTICE = 'stage-locked';

/**
 * 잠긴 퀘스트를 URL 로 열었을 때 보내는 곳. 고정 경로라 요청 값으로 목적지가 바뀌지 않는다 (오픈 리다이렉트 없음)
 */
export const STAGE_LOCKED_REDIRECT = `/world?notice=${STAGE_LOCKED_NOTICE}`;

/** 월드맵 `searchParams.notice` 가 잠긴 스테이지 안내인지 (배열·다른 값은 무시) */
export function isStageLockedNotice(
  notice: string | string[] | undefined,
): boolean {
  return notice === STAGE_LOCKED_NOTICE;
}
