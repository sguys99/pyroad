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

export async function callTutor(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 500,
  providerType?: LLMProviderType,
  customApiKey?: string,
  fast = false,
): Promise<{ text: string; ok: boolean }> {
  const available = getAvailableProviders();
  const primary = providerType && (available.includes(providerType) || customApiKey)
    ? providerType
    : available[0];

  if (!primary && !customApiKey) {
    return { text: '', ok: false };
  }

  const modelOverride = fast && primary ? FAST_MODEL[primary] : undefined;

  // 1차 시도 + 재시도
  const result = await attemptWithRetry(
    primary!,
    systemPrompt,
    userPrompt,
    maxTokens,
    customApiKey,
    modelOverride,
  );
  if (result.ok) return result;

  // 자동 전환: 다른 가용 provider로 fallback
  const fallbacks = available.filter((p) => p !== primary);
  for (const fallback of fallbacks) {
    const fallbackResult = await attemptOnce(
      fallback,
      systemPrompt,
      userPrompt,
      maxTokens,
    );
    if (fallbackResult.ok) return fallbackResult;
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
  maxTokens = 500,
  providerType?: LLMProviderType,
  customApiKey?: string,
  fast = false,
): ReadableStream<Uint8Array> {
  const available = getAvailableProviders();
  const primary = providerType && (available.includes(providerType) || customApiKey)
    ? providerType
    : available[0];
  const modelOverride = fast && primary ? FAST_MODEL[primary] : undefined;

  return new ReadableStream({
    async start(controller) {
      if (!primary && !customApiKey) {
        controller.enqueue(sseMessage({ error: true }));
        controller.close();
        return;
      }

      // primary provider 스트리밍 시도
      const success = await tryStreamProvider(
        controller,
        primary!,
        systemPrompt,
        userPrompt,
        maxTokens,
        customApiKey,
        modelOverride,
      );

      if (!success) {
        // fallback providers 순차 시도
        const fallbacks = available.filter((p) => p !== primary);
        let fallbackSuccess = false;
        for (const fallback of fallbacks) {
          fallbackSuccess = await tryStreamProvider(
            controller,
            fallback,
            systemPrompt,
            userPrompt,
            maxTokens,
          );
          if (fallbackSuccess) break;
        }

        if (!fallbackSuccess) {
          controller.enqueue(sseMessage({ error: true }));
        }
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

    controller.enqueue(sseMessage({ done: true }));
    return true;
  } catch {
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
  } catch {
    return { text: '', ok: false };
  }
}
