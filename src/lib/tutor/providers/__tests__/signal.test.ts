import { describe, it, expect, vi, beforeEach } from 'vitest';

const sdk = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  anthropicStream: vi.fn(),
  openaiCreate: vi.fn(),
  geminiGenerate: vi.fn(),
  geminiGenerateStream: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: sdk.anthropicCreate, stream: sdk.anthropicStream };
  },
}));
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: sdk.openaiCreate } };
  },
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: sdk.geminiGenerate,
      generateContentStream: sdk.geminiGenerateStream,
    };
  },
}));

import { AnthropicProvider } from '../anthropic';
import { OpenAIProvider } from '../openai';
import { GeminiProvider } from '../gemini';

async function* asyncOf<T>(items: T[]) {
  for (const item of items) yield item;
}

async function drain(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const t of stream) text += t;
  return text;
}

describe('provider SDK 호출에 AbortSignal 전달 (B18)', () => {
  const signal = new AbortController().signal;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Anthropic: call·callStream 모두 요청 옵션으로 signal을 넘긴다', async () => {
    sdk.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: '답' }],
    });
    sdk.anthropicStream.mockReturnValue(
      asyncOf([
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: '스트림' },
        },
      ]),
    );
    const provider = new AnthropicProvider('key');

    expect(await provider.call('s', 'u', 10, { signal })).toBe('답');
    expect(await drain(provider.callStream('s', 'u', 10, { signal }))).toBe(
      '스트림',
    );

    expect(sdk.anthropicCreate.mock.calls[0][1]).toEqual({ signal });
    expect(sdk.anthropicStream.mock.calls[0][1]).toEqual({ signal });
  });

  it('OpenAI: call·callStream 모두 요청 옵션으로 signal을 넘긴다', async () => {
    sdk.openaiCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: '답' } }] })
      .mockResolvedValueOnce(
        asyncOf([{ choices: [{ delta: { content: '스트림' } }] }]),
      );
    const provider = new OpenAIProvider('key');

    expect(await provider.call('s', 'u', 10, { signal })).toBe('답');
    expect(await drain(provider.callStream('s', 'u', 10, { signal }))).toBe(
      '스트림',
    );

    expect(sdk.openaiCreate.mock.calls[0][1]).toEqual({ signal });
    expect(sdk.openaiCreate.mock.calls[1][1]).toEqual({ signal });
  });

  it('Gemini: config.abortSignal로 signal을 넘긴다', async () => {
    sdk.geminiGenerate.mockResolvedValue({ text: '답' });
    sdk.geminiGenerateStream.mockResolvedValue(asyncOf([{ text: '스트림' }]));
    const provider = new GeminiProvider('key');

    expect(await provider.call('s', 'u', 10, { signal })).toBe('답');
    expect(await drain(provider.callStream('s', 'u', 10, { signal }))).toBe(
      '스트림',
    );

    expect(sdk.geminiGenerate.mock.calls[0][0].config.abortSignal).toBe(signal);
    expect(sdk.geminiGenerateStream.mock.calls[0][0].config.abortSignal).toBe(
      signal,
    );
  });
});
