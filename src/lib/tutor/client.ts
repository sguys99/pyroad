import {
  createProvider,
  getAvailableProviders,
} from './providers/factory';
import type { LLMProviderType } from './providers/types';

// Anthropic 경량 모델 (quest_intro, encouragement용)
const FAST_MODEL: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TutorCallResult {
  text: string;
  ok: boolean;
  provider_used?: LLMProviderType;
  was_fallback?: boolean;
}

export async function callTutor(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  providerType: LLMProviderType,
  customApiKey?: string,
  fast = false,
  fallbackProviders: LLMProviderType[] = [],
): Promise<TutorCallResult> {
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
    );
    if (result.ok) return { ...result, provider_used: providerType, was_fallback: false };
  }

  // 허용된 폴백 provider만 서버 키로 시도, 그 외에는 rule-based fallback
  for (const fallback of fallbackProviders.filter((p) => available.includes(p))) {
    const fallbackResult = await attemptOnce(
      fallback,
      systemPrompt,
      userPrompt,
      maxTokens,
    );
    if (fallbackResult.ok) {
      console.warn(`[tutor] Fell back from ${providerType} to ${fallback}`);
      return { ...fallbackResult, provider_used: fallback, was_fallback: true };
    }
  }

  return { text: '', ok: false };
}

const encoder = new TextEncoder();

function sseMessage(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export function callTutorStream(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  providerType: LLMProviderType,
  customApiKey?: string,
  fast = false,
  fallbackProviders: LLMProviderType[] = [],
): ReadableStream<Uint8Array> {
  const available = getAvailableProviders();
  // 본인 키도 서버 키도 없는 provider는 호출하지 않음 (다른 유료 provider로 대체 금지)
  const canCallPrimary = !!customApiKey || available.includes(providerType);
  const fallbacks = fallbackProviders.filter((p) => available.includes(p));
  const modelOverride = fast ? FAST_MODEL[providerType] : undefined;

  return new ReadableStream({
    async start(controller) {
      // primary provider 스트리밍 시도
      let success =
        canCallPrimary &&
        (await tryStreamProvider(
          controller,
          providerType,
          systemPrompt,
          userPrompt,
          maxTokens,
          customApiKey,
          modelOverride,
        ));

      // 허용된 폴백 provider만 서버 키로 시도
      for (const fallback of fallbacks) {
        if (success) break;
        success = await tryStreamProvider(
          controller,
          fallback,
          systemPrompt,
          userPrompt,
          maxTokens,
        );
      }

      if (!success) {
        controller.enqueue(sseMessage({ error: true }));
      }

      controller.close();
    },
  });
}

async function tryStreamProvider(
  controller: ReadableStreamDefaultController<Uint8Array>,
  providerType: LLMProviderType,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  customApiKey?: string,
  modelOverride?: string,
): Promise<boolean> {
  try {
    const provider = createProvider(providerType, customApiKey, modelOverride);
    const stream = provider.callStream(systemPrompt, userPrompt, maxTokens);

    for await (const delta of stream) {
      controller.enqueue(sseMessage({ delta }));
    }

    controller.enqueue(sseMessage({ done: true, provider_used: providerType }));
    return true;
  } catch (error) {
    console.error(
      `[tutor] ${providerType} stream failed:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

async function attemptWithRetry(
  providerType: LLMProviderType,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  customApiKey?: string,
  modelOverride?: string,
): Promise<{ text: string; ok: boolean }> {
  const result = await attemptOnce(
    providerType,
    systemPrompt,
    userPrompt,
    maxTokens,
    customApiKey,
    modelOverride,
  );
  if (result.ok) return result;

  // 1회 재시도 (1초 후)
  await delay(1000);
  return attemptOnce(providerType, systemPrompt, userPrompt, maxTokens, customApiKey, modelOverride);
}

async function attemptOnce(
  providerType: LLMProviderType,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  customApiKey?: string,
  modelOverride?: string,
): Promise<{ text: string; ok: boolean }> {
  try {
    const provider = createProvider(providerType, customApiKey, modelOverride);
    const text = await provider.call(systemPrompt, userPrompt, maxTokens);
    return { text, ok: true };
  } catch (error) {
    console.error(
      `[tutor] ${providerType} call failed:`,
      error instanceof Error ? error.message : error,
    );
    return { text: '', ok: false };
  }
}
