import type { LLMProvider, LLMProviderType } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import {
  DEFAULT_MODELS,
  MODEL_ENV,
  isModelNotFoundError,
  resolveModel,
} from './models';
import { captureServerMessage } from '@/lib/observability/server';

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
  const resolved = resolveModel(type, model);
  const fallbackModel = DEFAULT_MODELS[type];
  // 코드가 정한 모델(경량 모델)과 기본 모델은 그대로. env 모델만 404 시 기본 모델로 바꿔 다시 부른다 (B35)
  if (model || resolved === fallbackModel) return build(type, apiKey, resolved);
  if (notFoundModels.has(`${type}:${resolved}`)) return build(type, apiKey, fallbackModel);
  return withModelFallback(
    type,
    resolved,
    build(type, apiKey, resolved),
    () => build(type, apiKey, fallbackModel),
  );
}

function build(type: LLMProviderType, apiKey: string, model: string): LLMProvider {
  switch (type) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'gemini':
      return new GeminiProvider(apiKey, model);
  }
}

/** 404(모델 없음)를 낸 env 모델. 이 인스턴스에서는 다음 provider 부터 처음부터 기본 모델로 만든다 (본인 키는 요청마다 새로 만듦) */
const notFoundModels = new Set<string>();

/**
 * env `*_MODEL`이 없는 모델(제공 종료·오타)을 가리켜 404 가 나면 경고하고 기본 모델로 한 번 다시 부른다 (B35).
 * 이미 알려진 종료 모델은 `resolveModel`이 먼저 걸러 이 경로는 새로 종료된 모델용이다. 스트림은 내용을 보내기 전에
 * 실패했을 때만 다시 부른다(404 는 첫 응답 전에 나므로 이어 붙는 일이 없음)
 */
function withModelFallback(
  type: LLMProviderType,
  model: string,
  primary: LLMProvider,
  makeFallback: () => LLMProvider,
): LLMProvider {
  let fallback: LLMProvider | null = null;
  const fallbackFor = (error: unknown): LLMProvider | null => {
    if (!isModelNotFoundError(error)) return null;
    const key = `${type}:${model}`;
    if (!notFoundModels.has(key)) {
      notFoundModels.add(key);
      console.warn(
        `[tutor] ${MODEL_ENV[type]}=${model} 이 404(없는 모델) → 기본 모델 ${DEFAULT_MODELS[type]} 로 다시 부릅니다. env 를 고치세요 (B35)`,
      );
      captureServerMessage('tutor env model not found', 'warning', {
        tags: { area: 'tutor', op: 'model_fallback', provider: type },
        extra: { model },
      });
    }
    fallback ??= makeFallback();
    return fallback;
  };

  return {
    async call(systemPrompt, userPrompt, maxTokens, options) {
      if (fallback) return fallback.call(systemPrompt, userPrompt, maxTokens, options);
      try {
        return await primary.call(systemPrompt, userPrompt, maxTokens, options);
      } catch (error) {
        const next = fallbackFor(error);
        if (!next || options?.signal?.aborted) throw error;
        return next.call(systemPrompt, userPrompt, maxTokens, options);
      }
    },
    async *callStream(systemPrompt, userPrompt, maxTokens, options) {
      if (fallback) {
        yield* fallback.callStream(systemPrompt, userPrompt, maxTokens, options);
        return;
      }
      let emitted = false;
      let next: LLMProvider | null = null;
      try {
        for await (const delta of primary.callStream(systemPrompt, userPrompt, maxTokens, options)) {
          emitted = true;
          yield delta;
        }
        return;
      } catch (error) {
        next = emitted ? null : fallbackFor(error);
        if (!next || options?.signal?.aborted) throw error;
      }
      yield* next.callStream(systemPrompt, userPrompt, maxTokens, options);
    },
  };
}
