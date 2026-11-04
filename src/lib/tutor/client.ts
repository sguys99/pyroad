import {
  createProvider,
  getAvailableProviders,
} from './providers/factory';
import type { LLMProviderType } from './providers/types';
import { encodeSseEvent, type TutorStreamEvent } from './sse';

// Anthropic 경량 모델 (quest_intro, encouragement용)
const FAST_MODEL: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
};

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}

export interface TutorCallResult {
  text: string;
  ok: boolean;
  provider_used?: LLMProviderType;
  was_fallback?: boolean;
}

export interface TutorCallOptions {
  /** 요청 취소 신호 (route에서 `request.signal`). 취소되면 재시도·폴백 없이 멈춘다 */
  signal?: AbortSignal;
}

export async function callTutor(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  providerType: LLMProviderType,
  customApiKey?: string,
  fast = false,
  fallbackProviders: LLMProviderType[] = [],
  options: TutorCallOptions = {},
): Promise<TutorCallResult> {
  const { signal } = options;
  const available = getAvailableProviders();

  // 본인 키도 서버 키도 없는 provider는 호출하지 않음 (다른 유료 provider로 대체 금지)
  if (customApiKey || available.includes(providerType)) {
    const modelOverride = fast ? FAST_MODEL[providerType] : undefined;

    // 1차 시도 + 재시도
    const result = await attemptWithRetry(
      providerType,
      systemPrompt,
      userPrompt,
      maxTokens,
      customApiKey,
      modelOverride,
      signal,
    );
    if (result.ok) return { ...result, provider_used: providerType, was_fallback: false };
  }

  // 허용된 폴백 provider만 서버 키로 시도, 그 외에는 rule-based fallback
  for (const fallback of fallbackProviders.filter((p) => available.includes(p))) {
    if (signal?.aborted) break;
    const fallbackResult = await attemptOnce(
      fallback,
      systemPrompt,
      userPrompt,
      maxTokens,
      undefined,
      undefined,
      signal,
    );
    if (fallbackResult.ok) {
      console.warn(`[tutor] Fell back from ${providerType} to ${fallback}`);
      return { ...fallbackResult, provider_used: fallback, was_fallback: true };
    }
  }

  return { text: '', ok: false };
}

export interface TutorStreamOptions extends TutorCallOptions {
  /** provider 하나가 끝까지 성공했을 때 전체 텍스트로 호출 (캐시 저장용) */
  onComplete?: (text: string, providerUsed: LLMProviderType) => void;
  /** 모든 provider가 실패하면 대신 보낼 저장된 답변. 없으면 `error` 이벤트 */
  fallbackText?: string;
}

interface StreamAttempt {
  providerType: LLMProviderType;
  customApiKey?: string;
  modelOverride?: string;
}

/**
 * provider 스트림을 SSE로 내보낸다 (프로토콜은 `./sse.ts`).
 *
 * 1차 provider가 토큰을 일부 보낸 뒤 실패하면 `reset`을 보내고 다음 provider(또는 저장된 답변)가
 * 처음부터 다시 쓴다. 그래서 클라이언트에는 항상 한 출처의 온전한 답만 남는다
 * (부분 응답 + 폴백 이어 붙기 방지, B18).
 * 요청이 취소되거나(`options.signal`) 응답 스트림이 cancel되면 진행 중인 SDK 호출을 abort하고
 * 폴백도 시도하지 않는다.
 */
export function callTutorStream(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  providerType: LLMProviderType,
  customApiKey?: string,
  fast = false,
  fallbackProviders: LLMProviderType[] = [],
  options: TutorStreamOptions = {},
): ReadableStream<Uint8Array> {
  const available = getAvailableProviders();
  const attempts: StreamAttempt[] = [];
  // 본인 키도 서버 키도 없는 provider는 호출하지 않음 (다른 유료 provider로 대체 금지)
  if (customApiKey || available.includes(providerType)) {
    attempts.push({
      providerType,
      customApiKey,
      modelOverride: fast ? FAST_MODEL[providerType] : undefined,
    });
  }
  // 허용된 폴백 provider만 서버 키로 시도
  for (const fallback of fallbackProviders.filter((p) => available.includes(p))) {
    attempts.push({ providerType: fallback });
  }

  // 요청 취소와 응답 스트림 cancel을 하나의 signal로 모아 SDK에 넘긴다
  const abort = new AbortController();
  const requestSignal = options.signal;
  const onRequestAbort = () => abort.abort(requestSignal?.reason);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: TutorStreamEvent) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encodeSseEvent(event));
        } catch {
          // 이미 닫힌 스트림 (클라이언트 연결 종료)
        }
      };

      if (requestSignal?.aborted) {
        abort.abort(requestSignal.reason);
      } else {
        requestSignal?.addEventListener('abort', onRequestAbort, { once: true });
      }

      try {
        for (const attempt of attempts) {
          if (abort.signal.aborted) return;

          const result = await tryStreamProvider(
            attempt,
            systemPrompt,
            userPrompt,
            maxTokens,
            (delta) => send({ delta }),
            abort.signal,
          );

          if (result.ok) {
            options.onComplete?.(result.text, attempt.providerType);
            send({ done: true, provider_used: attempt.providerType });
            return;
          }
          // 이미 내보낸 부분 응답은 클라이언트가 버리게 하고 다음 provider로
          if (result.emitted) send({ reset: true });
        }

        if (options.fallbackText) {
          send({ delta: options.fallbackText });
          send({ done: true, is_fallback: true });
        } else {
          send({ error: true });
        }
      } finally {
        requestSignal?.removeEventListener('abort', onRequestAbort);
        try {
          controller.close();
        } catch {
          // cancel된 스트림은 이미 닫혀 있음
        }
      }
    },
    cancel(reason) {
      abort.abort(reason);
    },
  });
}

async function tryStreamProvider(
  attempt: StreamAttempt,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  onDelta: (delta: string) => void,
  signal: AbortSignal,
): Promise<{ ok: boolean; text: string; emitted: boolean }> {
  let text = '';
  try {
    const provider = createProvider(
      attempt.providerType,
      attempt.customApiKey,
      attempt.modelOverride,
    );
    const stream = provider.callStream(systemPrompt, userPrompt, maxTokens, { signal });

    for await (const delta of stream) {
      if (signal.aborted) break;
      text += delta;
      onDelta(delta);
    }

    if (signal.aborted) return { ok: false, text, emitted: text.length > 0 };
    return { ok: true, text, emitted: text.length > 0 };
  } catch (error) {
    if (!signal.aborted) {
      console.error(
        `[tutor] ${attempt.providerType} stream failed:`,
        error instanceof Error ? error.message : error,
      );
    }
    return { ok: false, text, emitted: text.length > 0 };
  }
}

async function attemptWithRetry(
  providerType: LLMProviderType,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  customApiKey?: string,
  modelOverride?: string,
  signal?: AbortSignal,
): Promise<{ text: string; ok: boolean }> {
  const result = await attemptOnce(
    providerType,
    systemPrompt,
    userPrompt,
    maxTokens,
    customApiKey,
    modelOverride,
    signal,
  );
  if (result.ok || signal?.aborted) return result;

  // 1회 재시도 (1초 후)
  await delay(1000, signal);
  if (signal?.aborted) return result;
  return attemptOnce(providerType, systemPrompt, userPrompt, maxTokens, customApiKey, modelOverride, signal);
}

async function attemptOnce(
  providerType: LLMProviderType,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  customApiKey?: string,
  modelOverride?: string,
  signal?: AbortSignal,
): Promise<{ text: string; ok: boolean }> {
  try {
    const provider = createProvider(providerType, customApiKey, modelOverride);
    const text = await provider.call(systemPrompt, userPrompt, maxTokens, { signal });
    return { text, ok: true };
  } catch (error) {
    if (!signal?.aborted) {
      console.error(
        `[tutor] ${providerType} call failed:`,
        error instanceof Error ? error.message : error,
      );
    }
    return { text: '', ok: false };
  }
}
