// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTutor, STREAM_IDLE_TIMEOUT_MS } from '../useTutor';
import { encodeSseEvent, type TutorStreamEvent } from '../sse';
import type { TutorRequest } from '../types';

interface PendingStream {
  url: string;
  signal: AbortSignal;
  push(event: TutorStreamEvent): void;
  close(): void;
}

let streams: PendingStream[] = [];

function mockFetch() {
  streams = [];
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/settings') {
      return Response.json({ has_custom_keys: [] });
    }
    const signal = init!.signal!;
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    // 실제 fetch처럼 abort되면 본문 읽기가 AbortError로 끝남
    signal.addEventListener('abort', () => {
      try {
        controller.error(new DOMException('aborted', 'AbortError'));
      } catch {
        // 이미 닫힘
      }
    });
    streams.push({
      url,
      signal,
      push: (event) => controller.enqueue(encodeSseEvent(event)),
      close: () => controller.close(),
    });
    return new Response(body, { status: 200 });
  });
}

const intro: TutorRequest = { type: 'quest_intro', quest_id: 'q1' };

/** fetch가 호출되고 스트림이 준비될 때까지 마이크로태스크를 흘림 */
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('useTutor — AbortController (B18)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('새 스트림 요청을 보내면 이전 요청을 abort하고, 이전 요청은 에러 없이 null로 끝난다', async () => {
    const { result } = renderHook(() => useTutor());
    const onDeltaA = vi.fn();
    const onDeltaB = vi.fn();

    let a!: Promise<unknown>;
    await act(async () => {
      a = result.current.sendTutorStreamRequest(intro, onDeltaA);
      await flush();
    });
    const streamA = streams.at(-1)!;
    await act(async () => {
      streamA.push({ delta: '첫 번째' });
      await flush();
    });

    let b!: Promise<unknown>;
    await act(async () => {
      b = result.current.sendTutorStreamRequest(
        { ...intro, type: 'hint_generator', hint_level: 1 },
        onDeltaB,
      );
      await flush();
    });
    const streamB = streams.at(-1)!;

    expect(streamA.signal.aborted).toBe(true);
    await expect(a).resolves.toBeNull();
    expect(onDeltaA.mock.calls.map((c) => c[0])).toEqual(['첫 번째']);

    await act(async () => {
      streamB.push({ delta: '두 번째' });
      streamB.push({ done: true, provider_used: 'gemini' });
      await flush();
    });
    await expect(b).resolves.toMatchObject({
      message: '두 번째',
      provider_used: 'gemini',
    });
    expect(streamB.signal.aborted).toBe(false);
  });

  it('언마운트(퀘스트를 떠남)하면 진행 중인 요청을 abort하고 onDelta·에러 없이 null', async () => {
    const { result, unmount } = renderHook(() => useTutor());
    const onDelta = vi.fn();

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.sendTutorStreamRequest(intro, onDelta);
      await flush();
    });
    const stream = streams.at(-1)!;

    unmount();

    expect(stream.signal.aborted).toBe(true);
    await expect(pending).resolves.toBeNull();
    expect(onDelta).not.toHaveBeenCalled();
  });

  it('언마운트하면 스트림이 아닌 요청(/api/tutor)도 abort한다', async () => {
    const seen: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/settings')
          return Promise.resolve(Response.json({ has_custom_keys: [] }));
        seen.push(init!.signal!);
        return new Promise((_, reject) =>
          init!.signal!.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        );
      }),
    );
    const { result, unmount } = renderHook(() => useTutor());

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.sendTutorRequest({
        type: 'encouragement',
        quest_id: 'q1',
      });
      await flush();
    });
    unmount();

    expect(seen[0].aborted).toBe(true);
    await expect(pending).resolves.toBeNull();
  });

  it('reset을 받으면 말풍선을 비우고 새 답만 돌려준다', async () => {
    const { result } = renderHook(() => useTutor());
    const onDelta = vi.fn();

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.sendTutorStreamRequest(intro, onDelta);
      await flush();
    });
    const stream = streams.at(-1)!;
    await act(async () => {
      stream.push({ delta: '중간에 끊긴' });
      stream.push({ reset: true });
      stream.push({ delta: '저장된 답변' });
      stream.push({ done: true, is_fallback: true });
      await flush();
    });

    await expect(pending).resolves.toEqual({
      message: '저장된 답변',
      is_fallback: true,
      provider_used: undefined,
    });
    expect(onDelta.mock.calls.map((c) => c[0])).toEqual([
      '중간에 끊긴',
      '',
      '저장된 답변',
    ]);
  });

  it('연결이 끊기면(done 없이 종료) 부분 텍스트를 쓰지 않고 실패로 알린다', async () => {
    const { result } = renderHook(() => useTutor());

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.sendTutorStreamRequest(intro, () => {});
      await flush();
    });
    const stream = streams.at(-1)!;
    const settled = pending.then(
      () => 'resolved',
      (e: Error) => e.message,
    );
    await act(async () => {
      stream.push({
        delta:
          '이 문장은 한참 길게 이어지다가 중간에서 갑자기 끊어져 버리는 답변입니다',
      });
      stream.close();
      await flush();
    });

    await expect(settled).resolves.toBe('AI 튜터 요청에 실패했습니다');
  });

  it(`${STREAM_IDLE_TIMEOUT_MS / 1000}초 동안 아무 이벤트가 없으면 요청을 끊고 실패로 알린다`, async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result } = renderHook(() => useTutor());

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.sendTutorStreamRequest(intro, () => {});
      await flush();
    });
    const stream = streams.at(-1)!;
    const settled = pending.then(
      () => 'resolved',
      (e: Error) => e.message,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STREAM_IDLE_TIMEOUT_MS + 1);
    });

    expect(stream.signal.aborted).toBe(true);
    await expect(settled).resolves.toBe('AI 튜터 요청에 실패했습니다');
  });
});

describe('useTutor — 로딩 표시 (B18 남은 문제)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('비스트림 요청이 끝나도 진행 중인 스트림의 로딩 표시는 꺼지지 않는다', async () => {
    const base = mockFetch();
    let resolveJson!: (res: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) =>
        url === '/api/tutor'
          ? new Promise<Response>((r) => (resolveJson = r))
          : base(url, init),
      ),
    );
    const { result } = renderHook(() => useTutor());

    await act(async () => {
      void result.current.sendTutorStreamRequest(intro, () => {});
      await flush();
    });
    let json!: Promise<unknown>;
    await act(async () => {
      json = result.current.sendTutorRequest({
        type: 'code_feedback',
        quest_id: 'q1',
      });
      await flush();
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveJson(Response.json({ message: '잘했어요', is_fallback: false }));
      await json;
    });
    // 스트림은 아직 진행 중
    expect(result.current.isLoading).toBe(true);

    // 호출자가 스트림 말풍선을 정리하면 꺼짐
    act(() => result.current.setIsLoading(false));
    expect(result.current.isLoading).toBe(false);
  });

  it('스트림이 없으면 비스트림 요청이 끝날 때 로딩 표시가 꺼진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/settings'
          ? Response.json({ has_custom_keys: [] })
          : Response.json({ message: '잘했어요', is_fallback: false }),
      ),
    );
    const { result } = renderHook(() => useTutor());
    await act(async () => {
      await result.current.sendTutorRequest({
        type: 'code_feedback',
        quest_id: 'q1',
      });
    });
    expect(result.current.isLoading).toBe(false);
  });
});
