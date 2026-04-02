import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from './types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
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
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: this.systemParam(systemPrompt),
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content[0];
    if (block.type === 'text') return block.text;
    return '';
  }

  async *callStream(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: maxTokens,
      system: this.systemParam(systemPrompt),
      messages: [{ role: 'user', content: userPrompt }],
    });

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
