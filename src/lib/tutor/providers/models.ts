import type { LLMProviderType } from './types';

/**
 * provider별 기본 모델 (B35). env `*_MODEL`이 비어 있으면 이 값을 쓴다.
 *
 * 2026-11-04 각 provider 문서로 확인한 값:
 * - gemini: `gemini-3.5-flash-lite` — Stable, 무료 티어 있음, thinking 기본 minimal(짧은 답에 토큰을 덜 씀).
 *   이전 기본값 `gemini-2.5-flash`는 지원 중단 예정(2026-12-01부터 이 모델로 자동 연결)이라 미리 옮김.
 *   https://aistudio.google.com/docs/deprecations
 * - anthropic: `claude-sonnet-5-5` (현재 Sonnet). https://platform.claude.com/docs/en/about-claude/models/overview
 * - openai: `gpt-6-luna` — `gpt-4o`(2027-01-14 제공 종료)의 공식 대체 모델. https://developers.openai.com/api/docs/deprecations
 *
 * Anthropic·OpenAI는 학생 본인 키로만 호출한다(서버 유료 키는 쓰지 않음, factory.ts).
 */
export const DEFAULT_MODELS: Record<LLMProviderType, string> = {
  gemini: 'gemini-3.5-flash-lite',
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-6-luna',
};

/** 속도 우선 유형(quest_intro·encouragement·stage_summary·concept_explain)에 쓰는 경량 모델. 없는 provider는 기본 모델 */
export const FAST_MODELS: Partial<Record<LLMProviderType, string>> = {
  anthropic: 'claude-haiku-5-5',
};

export const MODEL_ENV: Record<LLMProviderType, string> = {
  gemini: 'GEMINI_MODEL',
  anthropic: 'ANTHROPIC_MODEL',
  openai: 'OPENAI_MODEL',
};

/**
 * 제공이 끝나 404 가 나는 모델 (2026-11-04 각 provider 지원 중단 문서 기준).
 * env 가 이 모델을 가리키면 경고하고 기본 모델을 쓴다. 여기 없는 모델이 404 를 내면 `withModelFallback`이 처리한다
 */
const RETIRED_MODELS: Record<LLMProviderType, RegExp[]> = {
  gemini: [
    /^gemini-(1\.0|1\.5|2\.0)-/,
    /^gemini-pro(-vision)?$/,
    /^gemini-3-pro-preview$/,
    /^gemini-3\.1-flash-lite-preview/,
  ],
  anthropic: [
    /^claude-(instant|1|2)/,
    /^claude-3-/,
    /^claude-(sonnet-4|opus-4)-(0|20250514)$/,
    /^claude-opus-4-1(-20250805)?$/,
  ],
  openai: [
    /^gpt-3\.5-turbo/,
    /^gpt-4$/,
    /^gpt-4-(0314|0613|1106-preview|0125-preview|turbo)/,
    /^gpt-4o-2024-05-13$/,
    /^chatgpt-4o-latest$/,
    /^gpt-4\.1-nano/,
    /^(o1|o1-pro|o3-mini|o4-mini)(-|$)/,
    /^gpt-5(\.[123])?-chat-latest$/,
  ],
};

export function isRetiredModel(type: LLMProviderType, model: string): boolean {
  return RETIRED_MODELS[type].some((re) => re.test(model));
}

const warnedRetired = new Set<string>();

/**
 * 호출에 쓸 모델. 코드가 정한 모델(경량 모델 등)이 있으면 그것, 아니면 env `*_MODEL`, 비어 있으면 기본 모델.
 * env 가 제공이 끝난 모델이면 인스턴스마다 한 번 경고하고 기본 모델을 쓴다 (B35: 404 로 튜터가 늘 실패하던 문제)
 */
export function resolveModel(
  type: LLMProviderType,
  explicit?: string,
  env: Record<string, string | undefined> = process.env,
): string {
  if (explicit) return explicit;
  const name = MODEL_ENV[type];
  const fromEnv = env[name]?.trim();
  if (!fromEnv) return DEFAULT_MODELS[type];
  if (isRetiredModel(type, fromEnv)) {
    const key = `${name}=${fromEnv}`;
    if (!warnedRetired.has(key)) {
      warnedRetired.add(key);
      console.warn(
        `[tutor] ${key} 는 제공이 끝난 모델이라 기본 모델 ${DEFAULT_MODELS[type]} 을 씁니다. env 에서 ${name} 을 지우거나 바꾸세요 (B35)`,
      );
    }
    return DEFAULT_MODELS[type];
  }
  return fromEnv;
}

/** SDK 에러가 "모델 없음"(HTTP 404)인지. 세 SDK 모두 에러 객체에 `status`를 둔다 */
export function isModelNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: unknown }).status === 404
  );
}
