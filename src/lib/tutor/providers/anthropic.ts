import Anthropic from '@anthropic-ai/sdk';
import type { LLMCallOptions, LLMProvider } from './types';
import { resolveModel } from './models';

/**
 * 기본·경량 모델(Claude Sonnet 5.5·Haiku 5.5)은 생각(thinking)이 기본으로 켜져 있다. 생각도 max_tokens 를 쓰고
 * 응답 앞에 thinking 블록이 올 수 있어, 짧은 설명을 쓰는 튜터에서는 끈다(이전 4.x 기본 모델과 같은 동작, B35).
 * 끄는 방법이 모델마다 달라(Sonnet 5.5 는 `disabled`가 400, `between_tools`만 허용) 확인한 모델에만 붙이고,
 * env 로 바꾼 다른 모델에는 아무것도 붙이지 않는다.
 * https://platform.claude.com/docs/en/build-with-claude/thinking#turning-thinking-off
 */
const THINKING_OFF: Record<string, { type: 'between_tools' | 'disabled' }> = {
  'claude-sonnet-5-5': { type: 'between_tools' },
  'claude-haiku-5-5': { type: 'disabled' },
};

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = resolveModel('anthropic', model);
  }

  /** 모델별 추가 요청 필드. SDK 0.80 타입에 `between_tools`가 없어 넓은 타입으로 둔다 */
  private extraParams(): Record<string, unknown> {
    const thinking = THINKING_OFF[this.model];
    return thinking ? { thinking } : {};
  }

  private systemParam(systemPrompt: string) {
    return [
      {
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
    ];
  }

  async call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    options?: LLMCallOptions,
  ): Promise<string> {
    const response = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: maxTokens,
        system: this.systemParam(systemPrompt),
        messages: [{ role: 'user', content: userPrompt }],
        ...this.extraParams(),
      },
      { signal: options?.signal },
    );

    // 첫 블록이 thinking 일 수 있으므로(5.x 모델) 위치가 아니라 종류로 text 만 모은다
    return response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
  }

  async *callStream(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    options?: LLMCallOptions,
  ): AsyncIterable<string> {
    const stream = this.client.messages.stream(
      {
        model: this.model,
        max_tokens: maxTokens,
        system: this.systemParam(systemPrompt),
        messages: [{ role: 'user', content: userPrompt }],
        ...this.extraParams(),
      },
      { signal: options?.signal },
    );

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }
}
