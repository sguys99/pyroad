/**
 * /api/tutor/stream SSE 프로토콜 (서버 `callTutorStream`과 클라이언트 `useTutor`가 함께 쓴다).
 *
 * - `{ delta }`: 지금까지 받은 텍스트 뒤에 이어 붙인다
 * - `{ reset: true }`: 지금까지 받은 텍스트를 버린다. provider가 중간에 실패해서
 *   다음 provider가 처음부터 다시 쓰기 시작할 때 보낸다 (부분 응답 + 폴백이 이어 붙지 않게, B18)
 * - `{ done: true, provider_used?, is_fallback? }`: 정상 완료. 이 이벤트 없이 끝난 스트림은 실패로 본다.
 *   `is_fallback`이면 AI 대신 저장된 답변(rule-based)을 보낸 것
 * - `{ error: true }`: 모든 provider가 실패했고 저장된 답변도 없음. 클라이언트가 준비한 문구로 대체한다
 */
export type TutorStreamEvent =
  | { delta: string }
  | { reset: true }
  | { done: true; provider_used?: string; is_fallback?: boolean }
  | { error: true };

const encoder = new TextEncoder();

export function encodeSseEvent(event: TutorStreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export class TutorStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TutorStreamError';
  }
}

export interface ReadTutorStreamResult {
  text: string;
  providerUsed?: string;
  isFallback: boolean;
}

/**
 * SSE 본문을 끝까지 읽어 최종 텍스트를 돌려준다.
 * `onText`는 delta·reset마다 "지금까지의 전체 텍스트"로 호출된다 (reset이면 빈 문자열).
 * `onEvent`는 이벤트를 받을 때마다 호출된다 (유휴 타임아웃 갱신용).
 * `error` 이벤트를 받거나 `done` 없이 스트림이 끝나면 `TutorStreamError`를 던진다.
 */
export async function readTutorStream(
  body: ReadableStream<Uint8Array>,
  onText: (fullText: string) => void,
  onEvent?: () => void,
): Promise<ReadTutorStreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 파싱: "data: {...}\n\n" 형태. 마지막 요소는 불완전할 수 있으므로 buffer에 유지
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        let event: Partial<{
          delta: string;
          reset: boolean;
          done: boolean;
          error: boolean;
          provider_used: string;
          is_fallback: boolean;
        }>;
        try {
          event = JSON.parse(trimmed.slice(6));
        } catch {
          continue;
        }
        onEvent?.();

        if (event.reset) {
          fullText = '';
          onText(fullText);
        } else if (typeof event.delta === 'string' && event.delta) {
          fullText += event.delta;
          onText(fullText);
        } else if (event.error) {
          throw new TutorStreamError('튜터 스트림 실패');
        } else if (event.done) {
          return {
            text: fullText,
            providerUsed: event.provider_used,
            isFallback: event.is_fallback === true,
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // done 없이 끊긴 스트림의 부분 텍스트는 쓰지 않는다 (문장 중간에서 잘린 답변 방지)
  throw new TutorStreamError('튜터 스트림이 중간에 끊겼어요');
}
