export type LLMProviderType = 'anthropic' | 'openai' | 'gemini';

export interface LLMCallOptions {
  /** 요청이 취소되면(학생이 퀘스트를 떠남 등) SDK 호출을 멈춘다 (B18) */
  signal?: AbortSignal;
}

export interface LLMProvider {
  call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    options?: LLMCallOptions,
  ): Promise<string>;

  callStream(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    options?: LLMCallOptions,
  ): AsyncIterable<string>;
}

export const PROVIDER_LABELS: Record<LLMProviderType, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI GPT',
  gemini: 'Google Gemini',
};
