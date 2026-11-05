import OpenAI from 'openai';
import type { ReasoningEffort } from 'openai/resources/shared';
import type { LLMCallOptions, LLMProvider } from './types';
import { resolveModel } from './models';

/**
 * 기본 모델(gpt-6-luna)은 추론(reasoning) 모델이라 기본값(medium)이면 추론 토큰이 max_completion_tokens 를 먼저 쓴다.
 * 튜터의 짧은 설명에는 추론을 끈다(B35, 이전 gpt-4o 와 같은 동작). 확인한 모델에만 붙이고, env 로 바꾼 다른 모델
 * (추론을 지원하지 않는 모델은 이 필드가 400)에는 붙이지 않는다. https://developers.openai.com/api/docs/models/gpt-6-luna
 */
const REASONING_EFFORT: Record<string, ReasoningEffort> = {
  'gpt-6-luna': 'none',
};

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = resolveModel('openai', model);
  }

  private extraParams(): { reasoning_effort?: ReasoningEffort } {
    const effort = REASONING_EFFORT[this.model];
    return effort ? { reasoning_effort: effort } : {};
  }

  async call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    options?: LLMCallOptions,
  ): Promise<string> {
    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        max_completion_tokens: maxTokens,
        ...this.extraParams(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      { signal: options?.signal },
    );

    return response.choices[0]?.message?.content ?? '';
  }

  async *callStream(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    options?: LLMCallOptions,
  ): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        max_completion_tokens: maxTokens,
        ...this.extraParams(),
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      { signal: options?.signal },
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
