import { callTutorStream } from '@/lib/tutor/client';
import { getCachedResponse, setCachedResponse, buildCacheKey } from '@/lib/tutor/cache';
import { encodeSseEvent } from '@/lib/tutor/sse';
import { prepareTutorCall, buildFallbackMessage } from '../helpers';
import { getMaxTokens } from '@/lib/tutor/config';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

export async function POST(request: Request) {
  const prepared = await prepareTutorCall(request);

  if (prepared instanceof Response) {
    return prepared;
  }

  const { systemPrompt, userPrompt, providerType, customApiKey, fast, fallbackProviders, quest, answerKey, body, recordHint } = prepared;

  // 캐시 히트 → 단일 delta 이벤트로 즉시 전송
  const cacheKey = buildCacheKey(body);
  if (cacheKey) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      const cachedStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encodeSseEvent({ delta: cached }));
          controller.enqueue(encodeSseEvent({ done: true }));
          controller.close();
        },
      });
      return new Response(cachedStream, { headers: SSE_HEADERS });
    }
  }

  // 클라이언트가 요청을 끊으면(request.signal) provider 호출도 멈춘다
  const stream = callTutorStream(
    systemPrompt,
    userPrompt,
    getMaxTokens(body.type, providerType),
    providerType,
    customApiKey,
    fast,
    fallbackProviders,
    {
      signal: request.signal,
      // 끝까지 성공한 한 provider의 전체 답만 캐시 (reset 전의 부분 응답은 들어가지 않음)
      onComplete: (text) => {
        if (cacheKey && text) setCachedResponse(cacheKey, text);
      },
      // 모든 provider가 실패하면 /api/tutor와 같은 저장된 답변(힌트는 해당 단계 힌트)을 보낸다
      fallbackText: buildFallbackMessage(body, quest, answerKey),
      // 힌트는 내용을 보내기 시작할 때 hints_used 를 기록 (P1-04, B05). 그 전에 취소·실패하면 세지 않음
      onFirstContent: recordHint ?? undefined,
    },
  );

  return new Response(stream, { headers: SSE_HEADERS });
}
