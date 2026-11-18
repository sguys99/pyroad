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

/**
 * 학생 본인 키로 부를 수 있는 provider (B117, §12-Q80). Gemini API 약관은 18세 미만 대상 서비스에서 쓰지 못하게 하므로
 * (유료·무료 모두) 학생의 Google 키는 받지도 쓰지도 않는다. 이미 저장된 Google 키는 설정 화면에서 지우기만 할 수 있음
 */
export const USER_KEY_PROVIDERS: readonly LLMProviderType[] = [
  'anthropic',
  'openai',
];

export const PROVIDER_LABELS: Record<LLMProviderType, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI GPT',
  gemini: 'Google Gemini',
};
