import {
  createProvider,
  getAvailableProviders,
} from './providers/factory';
import type { LLMProviderType } from './providers/types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callTutor(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 600,
  providerType?: LLMProviderType,
  customApiKey?: string,
): Promise<{ text: string; ok: boolean }> {
  const available = getAvailableProviders();
  const primary = providerType && (available.includes(providerType) || customApiKey)
    ? providerType
    : available[0];

  if (!primary && !customApiKey) {
    return { text: '', ok: false };
  }

  // 1차 시도 + 재시도
  const result = await attemptWithRetry(
    primary!,
    systemPrompt,
    userPrompt,
    maxTokens,
    customApiKey,
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

async function attemptWithRetry(
  providerType: LLMProviderType,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  customApiKey?: string,
): Promise<{ text: string; ok: boolean }> {
  const result = await attemptOnce(
    providerType,
    systemPrompt,
    userPrompt,
    maxTokens,
    customApiKey,
  );
  if (result.ok) return result;

  // 1회 재시도 (1초 후)
  await delay(1000);
  return attemptOnce(providerType, systemPrompt, userPrompt, maxTokens, customApiKey);
}

async function attemptOnce(
  providerType: LLMProviderType,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  customApiKey?: string,
): Promise<{ text: string; ok: boolean }> {
  try {
    const provider = createProvider(providerType, customApiKey);
    const text = await provider.call(systemPrompt, userPrompt, maxTokens);
    return { text, ok: true };
  } catch {
    return { text: '', ok: false };
  }
}
