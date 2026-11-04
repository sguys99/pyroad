import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import {
  DEFAULT_MODELS,
  FAST_MODELS,
  isModelNotFoundError,
  isRetiredModel,
  resolveModel,
} from '../models';
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

function notFound(): Error {
  return Object.assign(new Error('model not found'), { status: 404 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('기본 모델·제공 종료 모델 (B35)', () => {
  it('기본 모델은 제공 종료 목록에 없다', () => {
    for (const [type, model] of Object.entries(DEFAULT_MODELS)) {
      expect(isRetiredModel(type as keyof typeof DEFAULT_MODELS, model)).toBe(false);
    }
    expect(isRetiredModel('anthropic', FAST_MODELS.anthropic!)).toBe(false);
  });

  it.each([
    ['gemini', 'gemini-2.0-flash', true],
    ['gemini', 'gemini-2.0-flash-lite-001', true],
    ['gemini', 'gemini-1.5-pro', true],
    ['gemini', 'gemini-2.5-flash', false], // 지원 중단 예정이지만 자동 연결이라 404 아님
    ['gemini', 'gemini-3.6-flash', false],
    ['anthropic', 'claude-3-5-haiku-20241022', true],
    ['anthropic', 'claude-sonnet-4-20250514', true],
    ['anthropic', 'claude-sonnet-4-6', false],
    ['anthropic', 'claude-haiku-4-5-20251001', false],
    ['openai', 'chatgpt-4o-latest', true],
    ['openai', 'gpt-4-turbo', true],
    ['openai', 'o1', true],
    ['openai', 'gpt-4o', false], // 2027-01-14 종료 예정
    ['openai', 'gpt-4o-mini', false],
  ] as const)('%s %s → 제공 종료 %s', (type, model, retired) => {
    expect(isRetiredModel(type, model)).toBe(retired);
  });

  it('env 가 비어 있으면 기본 모델, 있으면 env, 코드가 정한 모델이 가장 우선', () => {
    expect(resolveModel('gemini', undefined, {})).toBe(DEFAULT_MODELS.gemini);
    expect(resolveModel('gemini', undefined, { GEMINI_MODEL: '  ' })).toBe(DEFAULT_MODELS.gemini);
    expect(resolveModel('gemini', undefined, { GEMINI_MODEL: 'gemini-3.6-flash' })).toBe(
      'gemini-3.6-flash',
    );
    expect(
      resolveModel('anthropic', 'claude-haiku-5-5', { ANTHROPIC_MODEL: 'claude-sonnet-4-6' }),
    ).toBe('claude-haiku-5-5');
  });

  it('env 가 제공 종료 모델이면 404 대신 기본 모델을 쓰고 한 번만 경고한다', () => {
    const env = { GEMINI_MODEL: 'gemini-2.0-flash' };
    expect(resolveModel('gemini', undefined, env)).toBe(DEFAULT_MODELS.gemini);
    expect(resolveModel('gemini', undefined, env)).toBe(DEFAULT_MODELS.gemini);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('GEMINI_MODEL=gemini-2.0-flash'),
    );
  });

  it('provider 생성자도 같은 규칙을 쓴다', async () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.0-flash-001');
    sdk.geminiGenerate.mockResolvedValue({ text: '답' });
    await new GeminiProvider('k').call('s', 'u', 10);
    expect(sdk.geminiGenerate.mock.calls[0][0].model).toBe(DEFAULT_MODELS.gemini);
  });

  it('404 판별: status 404 만', () => {
    expect(isModelNotFoundError(notFound())).toBe(true);
    expect(isModelNotFoundError(Object.assign(new Error('x'), { status: 429 }))).toBe(false);
    expect(isModelNotFoundError(new Error('x'))).toBe(false);
    expect(isModelNotFoundError(null)).toBe(false);
  });
});

describe('기본 모델에 맞춘 요청 필드 (B35)', () => {
  it('Anthropic Sonnet 5.5 는 between_tools, Haiku 5.5 는 disabled 로 생각을 끈다', async () => {
    sdk.anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: '답' }] });
    sdk.anthropicStream.mockReturnValue(asyncOf([]));

    await new AnthropicProvider('k').call('s', 'u', 10);
    expect(sdk.anthropicCreate.mock.calls[0][0]).toMatchObject({
      model: 'claude-sonnet-5-5',
      thinking: { type: 'between_tools' },
    });

    await drain(new AnthropicProvider('k', 'claude-haiku-5-5').callStream('s', 'u', 10));
    expect(sdk.anthropicStream.mock.calls[0][0]).toMatchObject({
      model: 'claude-haiku-5-5',
      thinking: { type: 'disabled' },
    });
  });

  it('env 로 바꾼 다른 Anthropic 모델에는 thinking 을 붙이지 않는다 (모델마다 허용 값이 다름)', async () => {
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-6');
    sdk.anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: '답' }] });
    await new AnthropicProvider('k').call('s', 'u', 10);
    expect(sdk.anthropicCreate.mock.calls[0][0].model).toBe('claude-sonnet-4-6');
    expect(sdk.anthropicCreate.mock.calls[0][0]).not.toHaveProperty('thinking');
  });

  it('Anthropic 응답 앞에 thinking 블록이 와도 text 블록만 모은다', async () => {
    sdk.anthropicCreate.mockResolvedValue({
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text: '안녕' },
        { type: 'text', text: '하세요' },
      ],
    });
    expect(await new AnthropicProvider('k').call('s', 'u', 10)).toBe('안녕하세요');
  });

  it('OpenAI gpt-6-luna 는 추론을 끄고(reasoning_effort none), 다른 모델에는 붙이지 않는다', async () => {
    sdk.openaiCreate.mockResolvedValue({ choices: [{ message: { content: '답' } }] });
    await new OpenAIProvider('k').call('s', 'u', 10);
    expect(sdk.openaiCreate.mock.calls[0][0]).toMatchObject({
      model: 'gpt-6-luna',
      reasoning_effort: 'none',
    });

    sdk.openaiCreate.mockResolvedValue(asyncOf([]));
    await drain(new OpenAIProvider('k', 'gpt-4o').callStream('s', 'u', 10));
    expect(sdk.openaiCreate.mock.calls[1][0].model).toBe('gpt-4o');
    expect(sdk.openaiCreate.mock.calls[1][0]).not.toHaveProperty('reasoning_effort');
  });
});

describe('env 모델이 404 면 기본 모델로 다시 부른다 (B35)', () => {
  // factory 의 provider 캐시·404 기록이 테스트끼리 섞이지 않게 매번 새로 불러온다
  async function freshFactory() {
    vi.resetModules();
    return import('../factory');
  }

  it('call: 경고 1번 + 기본 모델로 다시 불러 답하고, 그 뒤로는 처음부터 기본 모델', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    vi.stubEnv('GEMINI_MODEL', 'gemini-9-gone');
    sdk.geminiGenerate.mockImplementation(async ({ model }: { model: string }) => {
      if (model === 'gemini-9-gone') throw notFound();
      return { text: `${model} 답` };
    });
    const { createProvider } = await freshFactory();

    expect(await createProvider('gemini').call('s', 'u', 10)).toBe(
      `${DEFAULT_MODELS.gemini} 답`,
    );
    expect(await createProvider('gemini').call('s', 'u', 10)).toBe(
      `${DEFAULT_MODELS.gemini} 답`,
    );
    expect(sdk.geminiGenerate.mock.calls.map((c) => c[0].model)).toEqual([
      'gemini-9-gone',
      DEFAULT_MODELS.gemini,
      DEFAULT_MODELS.gemini,
    ]);
    expect(console.warn).toHaveBeenCalledTimes(1);

    // 본인 키(요청마다 새 provider)도 이미 404 를 낸 모델은 다시 시도하지 않는다
    await createProvider('gemini', 'user-key').call('s', 'u', 10);
    expect(sdk.geminiGenerate.mock.calls.at(-1)![0].model).toBe(DEFAULT_MODELS.gemini);
  });

  it('stream: 내용을 보내기 전 404 면 기본 모델 스트림으로 이어 간다', async () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-9-gone');
    sdk.geminiGenerateStream.mockImplementation(async ({ model }: { model: string }) => {
      if (model === 'gemini-9-gone') throw notFound();
      return asyncOf([{ text: '기본 ' }, { text: '모델' }]);
    });
    const { createProvider } = await freshFactory();

    expect(await drain(createProvider('gemini', 'user-key').callStream('s', 'u', 10))).toBe(
      '기본 모델',
    );
  });

  it('404 가 아닌 실패와 기본 모델·코드가 정한 모델의 실패는 그대로 던진다', async () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.6-flash');
    sdk.geminiGenerate.mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }));
    const { createProvider } = await freshFactory();
    await expect(createProvider('gemini', 'user-key').call('s', 'u', 10)).rejects.toThrow('quota');
    expect(sdk.geminiGenerate).toHaveBeenCalledTimes(1);

    sdk.anthropicCreate.mockRejectedValue(notFound());
    await expect(
      createProvider('anthropic', 'user-key', 'claude-haiku-5-5').call('s', 'u', 10),
    ).rejects.toThrow('model not found');
    expect(sdk.anthropicCreate).toHaveBeenCalledTimes(1);
  });
});
