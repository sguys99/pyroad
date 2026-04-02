export type LLMProviderType = 'anthropic' | 'openai' | 'gemini';

export interface LLMProvider {
  call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): Promise<string>;

  callStream(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): AsyncIterable<string>;
}

export const PROVIDER_LABELS: Record<LLMProviderType, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI GPT',
  gemini: 'Google Gemini',
};
