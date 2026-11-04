import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMCallOptions, LLMProvider } from '@/lib/tutor/providers/types';

// 00005 이후의 quests 행: 정답 필드 없음 (P1-02)
const QUEST = {
  id: 'q1',
  title: '변수 상자',
  expected_output: '',
  stage: { id: 's1', title: '시작의 숲', order: 1, theme_name: 'forest' },
  prompt_skeleton: {
    topic: '변수',
    learning_goals: ['변수 만들기'],
    story_context: '숲 이야기',
    exercise_description: 'x에 10을 넣어요',
    starter_code: '',
    expected_output_hint: '10',
    fallback_text: '변수를 배워 봐요!',
  },
};

const HINTS = {
  level_1: '저장된 힌트 1',
  level_2: '저장된 힌트 2',
  level_3: '저장된 힌트 3',
};
const ANSWER_KEY = {
  expected_output: '10',
  hints: HINTS,
  solution_code: 'x = 10\nprint(x)',
  steps: [],
};

const mocks = vi.hoisted(() => ({
  createProvider: vi.fn(),
  // record_hint RPC (P1-04). 호출 순서를 남겨 done 보다 먼저 기록되는지 확인
  rpc: vi.fn(),
  // null 이면 quest_answer_keys 가 없는 DB(00004 적용 전)처럼 응답
  answerKey: { current: null as unknown },
  quest: { current: null as unknown },
}));

function chain(data: unknown, error: unknown = null) {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    single: async () => ({ data, error }),
    maybeSingle: async () => ({ data, error }),
  };
  return q;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => chain({ preferred_provider: null }),
  }),
}));
// 본인 API 키 없음 (B13: 키 저장소는 src/lib/tutor/__tests__/apiKeys.test.ts 에서 따로 확인)
vi.mock('@/lib/tutor/apiKeys', () => ({
  loadUserApiKeys: async () => ({ enabled: true, keys: {}, unreadable: [] }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) =>
      table === 'quest_answer_keys'
        ? mocks.answerKey.current
          ? chain(mocks.answerKey.current)
          : chain(null, { code: 'PGRST205', message: 'not found' })
        : chain(mocks.quest.current),
  }),
}));
vi.mock('@/lib/tutor/providers/factory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tutor/providers/factory')>()),
  createProvider: mocks.createProvider,
}));

import { POST } from '../stream/route';
import { POST as POST_JSON } from '../route';
import { clearTutorCache } from '@/lib/tutor/cache';
import { readTutorStream } from '@/lib/tutor/sse';

function post(body: object, signal?: AbortSignal) {
  return new Request('http://localhost/api/tutor/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

async function readText(res: Response) {
  return readTutorStream(res.body!, () => {});
}

/** 프롬프트를 그대로 되돌려주는 provider (어떤 입력으로 만들었는지 확인용) */
function echoProvider(
  seenSignals: (AbortSignal | undefined)[] = [],
): LLMProvider {
  return {
    async call(_s, u) {
      return u;
    },
    async *callStream(_s, u, _m, options?: LLMCallOptions) {
      seenSignals.push(options?.signal);
      yield u;
    },
  };
}

describe('/api/tutor/stream', () => {
  beforeEach(() => {
    clearTutorCache();
    mocks.quest.current = QUEST;
    mocks.answerKey.current = ANSWER_KEY;
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    mocks.createProvider.mockReset();
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: { recorded: true }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('격려 메시지는 학생마다 새로 만들고 다른 학생의 XP·힌트로 만든 답을 재사용하지 않는다 (B17)', async () => {
    mocks.createProvider.mockImplementation(() => echoProvider());

    const a = await readText(
      await POST(
        post({
          type: 'encouragement',
          quest_id: 'q1',
          earned_xp: 150,
          hints_used: 0,
        }),
      ),
    );
    const b = await readText(
      await POST(
        post({
          type: 'encouragement',
          quest_id: 'q1',
          earned_xp: 20,
          hints_used: 3,
        }),
      ),
    );

    expect(mocks.createProvider).toHaveBeenCalledTimes(2);
    expect(a.text).toContain('150');
    expect(b.text).toContain('20');
    expect(b.text).not.toContain('150');
  });

  it('퀘스트 소개는 퀘스트별로 캐시해서 두 번째 요청은 LLM을 호출하지 않는다', async () => {
    mocks.createProvider.mockImplementation(() => echoProvider());

    const first = await readText(
      await POST(post({ type: 'quest_intro', quest_id: 'q1' })),
    );
    const second = await readText(
      await POST(post({ type: 'quest_intro', quest_id: 'q1' })),
    );

    expect(mocks.createProvider).toHaveBeenCalledTimes(1);
    expect(second.text).toBe(first.text);
  });

  it('AI가 실패하면 저장된 답변(해당 단계 힌트)을 보내고 캐시하지 않는다', async () => {
    mocks.createProvider.mockImplementation(() => ({
      async call() {
        throw new Error('fail');
      },
      async *callStream() {
        throw new Error('fail');
      },
    }));

    const res = await readText(
      await POST(
        post({ type: 'hint_generator', quest_id: 'q1', hint_level: 2 }),
      ),
    );
    expect(res).toMatchObject({ text: '저장된 힌트 2', isFallback: true });
  });

  it('힌트 원문은 quest_answer_keys에서 읽어 프롬프트에 넣는다 (P1-02)', async () => {
    mocks.createProvider.mockImplementation(() => echoProvider());

    const res = await readText(
      await POST(
        post({ type: 'hint_generator', quest_id: 'q1', hint_level: 3 }),
      ),
    );
    expect(res.text).toContain('저장된 힌트 3');
  });

  it('quest_answer_keys가 없는 DB(00004 적용 전)에서는 quests의 힌트로 폴백한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.answerKey.current = null;
    mocks.quest.current = {
      ...QUEST,
      expected_output: '10',
      prompt_skeleton: { ...QUEST.prompt_skeleton, hints: HINTS },
    };
    mocks.createProvider.mockImplementation(() => echoProvider());

    const res = await readText(
      await POST(
        post({ type: 'hint_generator', quest_id: 'q1', hint_level: 1 }),
      ),
    );
    expect(res.text).toContain('저장된 힌트 1');
  });

  it('클라이언트가 요청을 끊으면(request.signal) 진행 중인 provider 스트림도 abort된다 (B18)', async () => {
    const seen: (AbortSignal | undefined)[] = [];
    mocks.createProvider.mockImplementation(() => ({
      async call() {
        return '';
      },
      async *callStream(
        _s: string,
        _u: string,
        _m: number,
        options?: LLMCallOptions,
      ) {
        seen.push(options?.signal);
        yield '첫 토큰';
        await new Promise((_, reject) =>
          options?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        );
      },
    }));
    const client = new AbortController();

    const res = await POST(
      post(
        {
          type: 'code_feedback',
          quest_id: 'q1',
          execution_result: { stdout: '', stderr: '', passed: false },
        },
        client.signal,
      ),
    );
    const reader = res.body!.getReader();
    await reader.read();
    expect(seen[0]?.aborted).toBe(false);

    client.abort();
    const rest = await reader.read();

    expect(seen[0]?.aborted).toBe(true);
    // 끊긴 요청에는 저장된 답변도 보내지 않음
    expect(rest.done).toBe(true);
  });
  describe('힌트 사용 기록 (P1-04, B05)', () => {
    /** SSE 이벤트를 하나씩 읽으며 그때까지 record_hint 가 불렸는지 남긴다 */
    async function readEvents(res: Response) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const events: { event: string; rpcCalls: number }[] = [];
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          events.push({
            event: part.replace(/^data: /, ''),
            rpcCalls: mocks.rpc.mock.calls.length,
          });
        }
      }
      return events;
    }

    it('힌트를 보내면 서버가 인증된 사용자 id 로 record_hint 를 한 번 부르고, 기록이 끝난 뒤 done 을 보낸다', async () => {
      mocks.createProvider.mockImplementation(() => ({
        async call() {
          return '';
        },
        async *callStream() {
          yield '힌트 ';
          yield '이어서';
        },
      }));
      let finishRpc: (v: unknown) => void = () => {};
      mocks.rpc.mockImplementation(
        () => new Promise((resolve) => (finishRpc = resolve)),
      );

      const res = await POST(
        post({
          type: 'hint_generator',
          quest_id: 'q1',
          hint_level: 2,
          // 클라이언트가 보낸 사용자·힌트 수는 쓰지 않음
          user_id: 'someone-else',
          hints_used: 0,
        }),
      );
      const reading = readEvents(res);
      await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
      finishRpc({ data: { recorded: true }, error: null });
      const events = await reading;

      expect(mocks.rpc).toHaveBeenCalledWith('record_hint', {
        p_user_id: 'u1',
        p_quest_id: 'q1',
        p_level: 2,
      });
      const done = events.find((e) => e.event.includes('"done"'));
      expect(done?.rpcCalls).toBe(1);
      expect(events.filter((e) => e.event.includes('"delta"'))).toHaveLength(2);
    });

    it('AI가 실패해 저장된 힌트를 보낼 때도 기록한다 (받은 힌트)', async () => {
      mocks.createProvider.mockImplementation(() => ({
        async call() {
          throw new Error('fail');
        },
        async *callStream() {
          throw new Error('fail');
        },
      }));

      const res = await readText(
        await POST(
          post({ type: 'hint_generator', quest_id: 'q1', hint_level: 1 }),
        ),
      );
      expect(res.text).toBe('저장된 힌트 1');
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
    });

    it('기록이 실패해도 힌트는 그대로 보낸다', async () => {
      mocks.createProvider.mockImplementation(() => echoProvider());
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'function not found' },
      });

      const res = await readText(
        await POST(
          post({ type: 'hint_generator', quest_id: 'q1', hint_level: 3 }),
        ),
      );
      expect(res.text).toContain('저장된 힌트 3');
      expect(console.error).toHaveBeenCalledWith(
        '[tutor] record_hint 실패:',
        expect.stringContaining('function not found'),
      );
    });

    it('힌트 글자를 보내기 전에 요청이 끊기면 기록하지 않는다', async () => {
      mocks.createProvider.mockImplementation(() => ({
        async call() {
          return '';
        },
        async *callStream(
          _s: string,
          _u: string,
          _m: number,
          options?: LLMCallOptions,
        ) {
          await new Promise((_, reject) =>
            options?.signal?.addEventListener('abort', () =>
              reject(new Error('aborted')),
            ),
          );
        },
      }));
      const client = new AbortController();

      const res = await POST(
        post(
          { type: 'hint_generator', quest_id: 'q1', hint_level: 1 },
          client.signal,
        ),
      );
      const reader = res.body!.getReader();
      const reading = reader.read();
      client.abort();
      expect((await reading).done).toBe(true);
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('비스트림 /api/tutor 로 힌트를 받아도 기록한다 (기록을 피하는 우회 경로 없음)', async () => {
      mocks.createProvider.mockImplementation(() => echoProvider());

      const res = await POST_JSON(
        post({ type: 'hint_generator', quest_id: 'q1', hint_level: 1 }),
      );
      expect((await res.json()).message).toContain('저장된 힌트 1');
      expect(mocks.rpc).toHaveBeenCalledWith('record_hint', {
        p_user_id: 'u1',
        p_quest_id: 'q1',
        p_level: 1,
      });
    });

    it('힌트가 아닌 요청은 기록하지 않는다', async () => {
      mocks.createProvider.mockImplementation(() => echoProvider());

      await readText(
        await POST(
          post({
            type: 'code_feedback',
            quest_id: 'q1',
            execution_result: { stdout: '', stderr: '', passed: false },
          }),
        ),
      );
      await readText(await POST(post({ type: 'quest_intro', quest_id: 'q1' })));
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
  });
});
