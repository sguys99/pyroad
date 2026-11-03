import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProvider } from '../providers/factory';
import { callTutor, callTutorStream } from '../client';
import type { LLMProvider, LLMProviderType } from '../providers/types';

vi.mock('../providers/factory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../providers/factory')>()),
  createProvider: vi.fn(),
}));

function fakeProvider(outcome: string | Error): LLMProvider {
  return {
    async call() {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
    async *callStream() {
      if (outcome instanceof Error) throw outcome;
      yield outcome;
    },
  };
}

function calledTypes(): LLMProviderType[] {
  return vi.mocked(createProvider).mock.calls.map((c) => c[0]);
}

describe('callTutor / callTutorStream — 서버 유료 키 보호', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'server-anthropic');
    vi.stubEnv('OPENAI_API_KEY', 'server-openai');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.mocked(createProvider).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('서버에 무료 티어 키가 없으면 다른 유료 provider로 대체하지 않는다', async () => {
    const result = await callTutor('s', 'u', 100, 'gemini');
    expect(result.ok).toBe(false);
    expect(createProvider).not.toHaveBeenCalled();
  });

  it('폴백 목록이 비어 있으면 실패해도 다른 provider를 호출하지 않는다', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    vi.mocked(createProvider).mockReturnValue(fakeProvider(new Error('fail')));
    vi.useFakeTimers();

    const promise = callTutor('s', 'u', 100, 'gemini');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(new Set(calledTypes())).toEqual(new Set(['gemini']));
  });

  it('본인 키 호출이 실패하면 무료 티어로만 폴백한다', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    vi.mocked(createProvider).mockImplementation((type) =>
      fakeProvider(type === 'gemini' ? '안녕' : new Error('fail')),
    );
    vi.useFakeTimers();

    const promise = callTutor('s', 'u', 100, 'openai', 'user-key', false, ['gemini']);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toMatchObject({ ok: true, provider_used: 'gemini', was_fallback: true });
    expect(calledTypes()).not.toContain('anthropic');
    expect(vi.mocked(createProvider).mock.calls[0]).toEqual(['openai', 'user-key', undefined]);
  });

  it('스트리밍도 서버에 무료 티어 키가 없으면 유료 provider를 호출하지 않는다', async () => {
    const text = await new Response(callTutorStream('s', 'u', 100, 'gemini')).text();
    expect(text).toContain('"error":true');
    expect(createProvider).not.toHaveBeenCalled();
  });
});
