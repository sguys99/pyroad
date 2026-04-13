import { callTutorStream } from '@/lib/tutor/client';
import { getCachedResponse, setCachedResponse, buildCacheKey } from '@/lib/tutor/cache';
import { prepareTutorCall, CACHEABLE_TYPES } from '../helpers';
import { getMaxTokens } from '@/lib/tutor/config';

const encoder = new TextEncoder();

export async function POST(request: Request) {
  const prepared = await prepareTutorCall(request);

  if (prepared instanceof Response) {
    return prepared;
  }

  const { systemPrompt, userPrompt, providerType, customApiKey, fast, body } = prepared;

  // 캐시 히트 → 단일 delta 이벤트로 즉시 전송
  const cacheable = CACHEABLE_TYPES.has(body.type);
  if (cacheable) {
    const cached = getCachedResponse(buildCacheKey(body.type, body.quest_id));
    if (cached) {
      const cachedStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: cached })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        },
      });
      return new Response(cachedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }
  }

  // 스트리밍 응답 + 캐시 수집
  const innerStream = callTutorStream(
    systemPrompt,
    userPrompt,
    getMaxTokens(body.type, providerType),
    providerType,
    customApiKey,
    fast,
  );

  // 캐시 대상이면 전체 텍스트를 수집하여 완료 시 저장
  let fullText = '';
  const wrappedStream = cacheable
    ? innerStream.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            // SSE 청크에서 delta 텍스트 수집
            const text = new TextDecoder().decode(chunk);
            const match = text.match(/"delta":"((?:[^"\\]|\\.)*)"/);
            if (match) fullText += JSON.parse(`"${match[1]}"`);

            // done 이벤트 시 캐시 저장
            if (text.includes('"done":true') && fullText) {
              setCachedResponse(buildCacheKey(body.type, body.quest_id), fullText);
            }

            controller.enqueue(chunk);
          },
        }),
      )
    : innerStream;

  return new Response(wrappedStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
