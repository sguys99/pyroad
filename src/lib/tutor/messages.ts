/**
 * 튜터 서버와 연결이 안 될 때(네트워크 끊김, 응답 지연 등) 아이에게 보여 주는 문구.
 * AI 호출만 실패한 경우에는 서버가 저장된 답변을 보내므로 이 문구가 쓰이지 않는다.
 */
export const TUTOR_UNAVAILABLE_HINT_MESSAGE =
  '앗, 지금은 파이뱀 선생님과 연결이 잘 안 돼요. 힌트는 줄어들지 않았으니 잠시 뒤에 다시 눌러 볼래요? 🙏';

/** 요청 한도(P1-19)를 넘은 창: 분당 한도 | 하루(KST) 한도 */
export type TutorRateLimitScope = 'minute' | 'day';

/**
 * 요청 한도를 넘었을 때 아이에게 보여 주는 문구 (서버 429 응답과 `useTutor`의 대기 시간이 같이 씀).
 * 하루 한도는 다음 날 자정(KST)까지라 시간 대신 "내일"로 말한다.
 */
export function tutorRateLimitMessage(
  retryAfterSec: number,
  scope: TutorRateLimitScope,
): string {
  if (scope === 'day') {
    return '파이뱀 선생님이 오늘은 이야기를 많이 해서 쉬고 있어요. 내일 다시 물어봐요! 🌙';
  }
  const sec = Math.max(1, Math.ceil(retryAfterSec));
  const wait = sec < 60 ? `${sec}초` : `${Math.ceil(sec / 60)}분`;
  return `파이뱀 선생님이 잠깐 쉬고 있어요. ${wait} 뒤에 다시 물어봐요!`;
}
