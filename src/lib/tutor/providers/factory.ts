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
