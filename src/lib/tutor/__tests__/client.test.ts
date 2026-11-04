import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProvider } from '../providers/factory';
import { callTutor, callTutorStream } from '../client';
import type { LLMCallOptions, LLMProvider, LLMProviderType } from '../providers/types';
import type { TutorStreamEvent } from '../sse';

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

  it('서버 키 전역 예산(allowServerKey)은 서버 키 호출에만 묻고, 거부되면 그 provider 를 건너뛴다 (P1-22)', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    vi.mocked(createProvider).mockImplementation((type) =>
      fakeProvider(type === 'gemini' ? '안녕' : new Error('fail')),
    );
    const allowServerKey = vi.fn().mockResolvedValue(false);
    vi.useFakeTimers();

    // 서버 키 1차 호출이 거부되면 provider 를 만들지도 않는다
    expect(
      await callTutor('s', 'u', 100, 'gemini', undefined, false, [], { allowServerKey }),
    ).toEqual({ text: '', ok: false });
    expect(createProvider).not.toHaveBeenCalled();
    expect(allowServerKey).toHaveBeenCalledWith('gemini');

    // 본인 키 1차 호출은 묻지 않고, 서버 키 폴백만 묻는다
    allowServerKey.mockClear();
    const promise = callTutor('s', 'u', 100, 'openai', 'user-key', false, ['gemini'], {
      allowServerKey,
    });
    await vi.runAllTimersAsync();
    expect(await promise).toEqual({ text: '', ok: false });
    expect(allowServerKey.mock.calls).toEqual([['gemini']]);
    expect(calledTypes()).toEqual(['openai', 'openai']);
  });

  it('스트리밍도 서버에 무료 티어 키가 없으면 유료 provider를 호출하지 않는다', async () => {
    const text = await new Response(callTutorStream('s', 'u', 100, 'gemini')).text();
    expect(text).toContain('"error":true');
    expect(createProvider).not.toHaveBeenCalled();
  });
});

/** 토큰 일부를 보낸 뒤 실패하는 스트림 provider */
function partialThenFail(tokens: string[]): LLMProvider {
  return {
    async call() {
      throw new Error('fail');
    },
    async *callStream() {
      for (const t of tokens) yield t;
      throw new Error('connection reset');
    },
  };
}

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<TutorStreamEvent[]> {
  const text = await new Response(stream).text();
  return text
    .split('\n\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)));
}

describe('callTutorStream — 부분 스트림 실패 시 이어 붙지 않음 (B18)', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    vi.mocked(createProvider).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('1차 provider가 토큰을 보낸 뒤 실패하면 reset 후 폴백이 처음부터 다시 쓴다', async () => {
    vi.mocked(createProvider).mockImplementation((type) =>
      type === 'openai' ? partialThenFail(['변수는 ', '상자']) : fakeProvider('완전한 답'),
    );

    const events = await readEvents(
      callTutorStream('s', 'u', 100, 'openai', 'user-key', false, ['gemini']),
    );

    expect(events).toEqual([
      { delta: '변수는 ' },
      { delta: '상자' },
      { reset: true },
      { delta: '완전한 답' },
      { done: true, provider_used: 'gemini' },
    ]);
  });

  it('토큰을 보내기 전에 실패했으면 reset 없이 폴백한다', async () => {
    vi.mocked(createProvider).mockImplementation((type) =>
      fakeProvider(type === 'openai' ? new Error('401') : '답'),
    );
    const events = await readEvents(
      callTutorStream('s', 'u', 100, 'openai', 'user-key', false, ['gemini']),
    );
    expect(events).toEqual([{ delta: '답' }, { done: true, provider_used: 'gemini' }]);
  });

  it('모든 provider가 실패하면 부분 응답을 reset하고 저장된 답변으로 끝낸다', async () => {
    vi.mocked(createProvider).mockReturnValue(partialThenFail(['반쯤 쓴']));
    const onComplete = vi.fn();

    const events = await readEvents(
      callTutorStream('s', 'u', 100, 'gemini', undefined, false, [], {
        fallbackText: '저장된 힌트',
        onComplete,
      }),
    );

    expect(events).toEqual([
      { delta: '반쯤 쓴' },
      { reset: true },
      { delta: '저장된 힌트' },
      { done: true, is_fallback: true },
    ]);
    // 부분 응답이나 저장된 답변은 캐시하지 않음
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('저장된 답변이 없으면 reset 후 error', async () => {
    vi.mocked(createProvider).mockReturnValue(partialThenFail(['반쯤']));
    const events = await readEvents(callTutorStream('s', 'u', 100, 'gemini'));
    expect(events).toEqual([{ delta: '반쯤' }, { reset: true }, { error: true }]);
  });

  it('성공한 provider의 전체 텍스트만 onComplete로 넘긴다', async () => {
    vi.mocked(createProvider).mockReturnValue(fakeProvider('전체 답'));
    const onComplete = vi.fn();
    await readEvents(callTutorStream('s', 'u', 100, 'gemini', undefined, false, [], { onComplete }));
    expect(onComplete).toHaveBeenCalledWith('전체 답', 'gemini');
  });
});

describe('abort 전달 (B18)', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    vi.mocked(createProvider).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** signal이 abort될 때까지 토큰을 하나 보내고 기다리는 provider */
  function hangingProvider(seen: (AbortSignal | undefined)[]): LLMProvider {
    return {
      async call(_s, _u, _m, options?: LLMCallOptions) {
        seen.push(options?.signal);
        throw new Error('fail');
      },
      async *callStream(_s, _u, _m, options?: LLMCallOptions) {
        seen.push(options?.signal);
        yield '첫 토큰';
        await new Promise((_, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      },
    };
  }

  it('요청 signal이 abort되면 provider 스트림 signal도 abort되고 폴백·error를 보내지 않는다', async () => {
    const seen: (AbortSignal | undefined)[] = [];
    vi.mocked(createProvider).mockImplementation(() => hangingProvider(seen));
    const request = new AbortController();

    const stream = callTutorStream('s', 'u', 100, 'openai', 'user-key', false, ['gemini'], {
      signal: request.signal,
    });
    const reader = stream.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('첫 토큰');

    request.abort();
    const rest = await reader.read();

    expect(rest.done).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.aborted).toBe(true);
    expect(calledTypes()).toEqual(['openai']);
  });

  it('응답 스트림이 cancel되면(클라이언트 연결 종료) provider 호출을 abort한다', async () => {
    const seen: (AbortSignal | undefined)[] = [];
    vi.mocked(createProvider).mockImplementation(() => hangingProvider(seen));

    const stream = callTutorStream('s', 'u', 100, 'gemini');
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    await Promise.resolve();

    expect(seen[0]?.aborted).toBe(true);
  });

  it('callTutor는 signal을 provider에 넘기고, abort되면 재시도·폴백하지 않는다', async () => {
    const seen: (AbortSignal | undefined)[] = [];
    vi.mocked(createProvider).mockImplementation(() => hangingProvider(seen));
    const request = new AbortController();
    request.abort();

    const result = await callTutor('s', 'u', 100, 'openai', 'user-key', false, ['gemini'], {
      signal: request.signal,
    });

    expect(result.ok).toBe(false);
    expect(seen).toEqual([request.signal]);
    expect(calledTypes()).toEqual(['openai']);
  });
});
