import type { LLMProvider, LLMProviderType } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

const ENV_KEY_MAP: Record<LLMProviderType, string> = {
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
};

// 환경변수 기반 싱글톤 캐시
const cache = new Map<string, LLMProvider>();

export function getAvailableProviders(): LLMProviderType[] {
  return (Object.keys(ENV_KEY_MAP) as LLMProviderType[]).filter(
    (type) => !!process.env[ENV_KEY_MAP[type]],
  );
}

/**
 * 서버 키로는 무료 티어 provider만 제공한다.
 * 유료 provider(Anthropic, OpenAI)는 사용자 본인 키로만 호출한다.
 */
export const FREE_TIER_PROVIDER: LLMProviderType = 'gemini';

/** 사용자가 본인 키를 등록한 provider 목록 (알 수 없는 키·빈 값 제외) */
export function getUserKeyedProviders(customKeys: unknown): LLMProviderType[] {
  const keys = (customKeys ?? {}) as Record<string, unknown>;
  return (Object.keys(ENV_KEY_MAP) as LLMProviderType[]).filter(
    (type) => typeof keys[type] === 'string' && keys[type] !== '',
  );
}

/**
 * 튜터 호출에 사용할 provider와 키를 결정한다.
 * - 선호 provider에 본인 키가 있으면 그 키로 호출
 * - 본인 키가 없거나 무료 티어를 선호하면 서버 무료 티어
 * - 그 외에는 본인 키가 있는 첫 provider
 */
export function resolveUserProvider(
  preferred: string | null | undefined,
  customKeys: unknown,
): { providerType: LLMProviderType; customApiKey?: string } {
  const keys = (customKeys ?? {}) as Record<string, string>;
  const keyed = getUserKeyedProviders(customKeys);
  const pref = preferred as LLMProviderType;

  if (keyed.includes(pref)) {
    return { providerType: pref, customApiKey: keys[pref] };
  }
  if (keyed.length === 0 || pref === FREE_TIER_PROVIDER) {
    return { providerType: FREE_TIER_PROVIDER };
  }
  return { providerType: keyed[0], customApiKey: keys[keyed[0]] };
}

export function createProvider(
  type: LLMProviderType,
  customApiKey?: string,
  modelOverride?: string,
): LLMProvider {
  const apiKey = customApiKey || process.env[ENV_KEY_MAP[type]];
  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${type}`);
  }

  // 커스텀 키나 모델 오버라이드는 캐시하지 않음
  if (customApiKey || modelOverride) {
    return instantiate(type, customApiKey || apiKey, modelOverride);
  }

  const cached = cache.get(type);
  if (cached) return cached;

  const provider = instantiate(type, apiKey);
  cache.set(type, provider);
  return provider;
}

function instantiate(type: LLMProviderType, apiKey: string, model?: string): LLMProvider {
  switch (type) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'gemini':
      return new GeminiProvider(apiKey, model);
  }
}
