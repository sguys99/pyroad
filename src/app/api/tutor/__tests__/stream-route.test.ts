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

const QUOTA_OK = {
  allowed: true,
  retry_after: 0,
  remaining: 5,
  scope: null,
  denied_minute: 0,
  denied_today: 0,
};

const mocks = vi.hoisted(() => ({
  createProvider: vi.fn(),
  // record_hint RPC (P1-04). 호출 순서를 남겨 done 보다 먼저 기록되는지 확인
  rpc: vi.fn(),
  // consume_rate_limit (P1-19)·is_stage_unlocked 는 따로 받아 record_hint 호출 수에 섞이지 않게
  quota: vi.fn(),
  stageUnlocked: vi.fn(),
  apiKeys: { current: {} as Record<string, string> },
  preferredProvider: { current: null as string | null },
  // null 이면 quest_answer_keys 가 없는 DB(00004 적용 전)처럼 응답
  answerKey: { current: null as unknown },
  quest: { current: null as unknown },
  // 본인 진행 (잠긴 스테이지에서 완료한 퀘스트 복습 판단, B38)
  progress: { current: null as unknown },
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
    from: (table: string) =>
      table === 'user_progress'
        ? chain(mocks.progress.current)
        : chain({ preferred_provider: mocks.preferredProvider.current }),
  }),
}));
// 본인 API 키 없음 (B13: 키 저장소는 src/lib/tutor/__tests__/apiKeys.test.ts 에서 따로 확인)
vi.mock('@/lib/tutor/apiKeys', () => ({
  loadUserApiKeys: async () => ({
    enabled: true,
    keys: mocks.apiKeys.current,
    unreadable: [],
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: (fn: string, args: unknown) =>
      fn === 'consume_rate_limit'
        ? mocks.quota(args)
        : fn === 'is_stage_unlocked'
          ? mocks.stageUnlocked(args)
          : mocks.rpc(fn, args),
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
import { STAGE_LOCKED_MESSAGE } from '@/lib/world/stageLock';

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
    mocks.quota.mockReset();
    mocks.quota.mockResolvedValue({ data: QUOTA_OK, error: null });
    mocks.stageUnlocked.mockReset();
    mocks.stageUnlocked.mockResolvedValue({ data: true, error: null });
    mocks.apiKeys.current = {};
    mocks.preferredProvider.current = null;
    mocks.progress.current = null;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
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

  describe('요청 한도·비정상 요청 기록 (P1-19)', () => {
    const abuseLines = () =>
      [
        ...vi.mocked(console.info).mock.calls,
        ...vi.mocked(console.warn).mock.calls,
      ]
        .filter(([tag]) => tag === '[tutor-abuse]')
        .map(([, line]) => JSON.parse(line as string));

    it('한도를 넘으면 퀘스트 조회·LLM·힌트 기록 없이 429 + Retry-After + 아이용 문구', async () => {
      mocks.createProvider.mockImplementation(() => echoProvider());
      mocks.quota.mockResolvedValue({
        data: {
          allowed: false,
          retry_after: 17,
          remaining: 0,
          scope: 'minute',
          denied_minute: 1,
          denied_today: 1,
        },
        error: null,
      });

      for (const route of [POST, POST_JSON]) {
        const res = await route(
          post({
            type: 'hint_generator',
            quest_id: 'q1',
            hint_level: 1,
            student_code: 'print("비밀 코드")',
          }),
        );
        expect(res.status).toBe(429);
        expect(res.headers.get('Retry-After')).toBe('17');
        expect(await res.json()).toEqual({
          error: 'rate_limited',
          message: '파이뱀 선생님이 잠깐 쉬고 있어요. 17초 뒤에 다시 물어봐요!',
          retry_after: 17,
          scope: 'minute',
        });
      }
      expect(mocks.createProvider).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled(); // record_hint
      expect(mocks.stageUnlocked).not.toHaveBeenCalled(); // 잠금 확인·정답 조회까지 가지 않음
      expect(mocks.quota).toHaveBeenCalledWith({
        p_user_id: 'u1',
        p_bucket: 'tutor:hint_generator',
        p_per_minute: 6,
        p_per_day: 60,
      });

      // 구조화 로그: 사용자 해시·유형·사유만 (학생 코드·user id 없음). 한두 번 초과는 info
      const lines = abuseLines();
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({
        event: 'tutor_abuse',
        level: 'info',
        reason: 'rate_limited',
        kind: 'hint_generator',
        scope: 'minute',
        own_key: false,
      });
      expect(lines[0].user).toMatch(/^[0-9a-f]{16}$/);
      expect(JSON.stringify(lines)).not.toContain('비밀 코드');
      expect(JSON.stringify(lines)).not.toContain('"u1"');
    });

    it('짧은 시간에 반복해서 넘으면 warning 으로 올림', async () => {
      mocks.quota.mockResolvedValue({
        data: {
          allowed: false,
          retry_after: 30,
          remaining: 0,
          scope: 'minute',
          denied_minute: 5,
          denied_today: 9,
        },
        error: null,
      });
      await POST(post({ type: 'quest_intro', quest_id: 'q1' }));
      expect(abuseLines()).toEqual([
        expect.objectContaining({
          level: 'warning',
          reason: 'rate_limited',
          denied_minute: 5,
        }),
      ]);
      expect(console.warn).toHaveBeenCalledWith(
        '[tutor-abuse]',
        expect.any(String),
      );
    });

    it('하루 한도는 "내일" 문구', async () => {
      mocks.quota.mockResolvedValue({
        data: {
          allowed: false,
          retry_after: 7200,
          remaining: 0,
          scope: 'day',
          denied_minute: 1,
          denied_today: 1,
        },
        error: null,
      });
      const res = await POST(post({ type: 'quest_intro', quest_id: 'q1' }));
      expect(res.status).toBe(429);
      expect((await res.json()).message).toContain('내일 다시 물어봐요');
    });

    it('본인 키 사용자는 느슨한 한도 (분 ×2, 하루 ×5), env 로 덮어쓰기', async () => {
      mocks.createProvider.mockImplementation(() => echoProvider());
      mocks.apiKeys.current = { openai: 'sk-own' };
      mocks.preferredProvider.current = 'openai';
      vi.stubEnv('TUTOR_LIMIT_FEEDBACK', '3/10');

      await readText(
        await POST(
          post({
            type: 'code_feedback',
            quest_id: 'q1',
            execution_result: { stdout: '', stderr: '', passed: false },
          }),
        ),
      );
      expect(mocks.quota).toHaveBeenCalledWith(
        expect.objectContaining({
          p_bucket: 'tutor:code_feedback',
          p_per_minute: 6,
          p_per_day: 50,
        }),
      );
    });

    it('캐시 적중(quest_intro)도 한도를 센다 (인스턴스마다 캐시가 달라 적중 여부로 한도가 바뀌지 않게)', async () => {
      mocks.createProvider.mockImplementation(() => echoProvider());
      await readText(await POST(post({ type: 'quest_intro', quest_id: 'q1' })));
      await readText(await POST(post({ type: 'quest_intro', quest_id: 'q1' })));
      expect(mocks.createProvider).toHaveBeenCalledTimes(1); // 두 번째는 캐시
      expect(mocks.quota).toHaveBeenCalledTimes(2);
    });

    it('한도 RPC 가 실패하면(00016 미적용 등) 튜터를 막지 않고 통과시키며 로그를 남긴다 (fail-open)', async () => {
      mocks.createProvider.mockImplementation(() => echoProvider());
      mocks.quota.mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'function not found' },
      });
      const res = await readText(
        await POST(post({ type: 'quest_intro', quest_id: 'q1' })),
      );
      expect(res.text).toContain('변수 상자');
      expect(console.error).toHaveBeenCalledWith(
        '[tutor] consume_rate_limit 실패:',
        expect.stringContaining('function not found'),
      );
    });

    it('형식이 잘못된 요청은 한도를 쓰기 전에 거부하고 warning 으로 기록 (보낸 값은 남기지 않음)', async () => {
      const cases: [Request, number, string][] = [
        [
          new Request('http://localhost/api/tutor/stream', {
            method: 'POST',
            body: '{not json',
          }),
          400,
          'invalid_json',
        ],
        [
          new Request('http://localhost/api/tutor/stream', {
            method: 'POST',
            body: 'null',
          }),
          400,
          'invalid_json',
        ],
        [post({ type: 'steal_answers', quest_id: 'q1' }), 400, 'invalid_type'],
        [post({ type: 'quest_intro' }), 400, 'missing_quest_id'],
        [
          post({ type: 'hint_generator', quest_id: 'q1', hint_level: 9 }),
          400,
          'invalid_hint_level',
        ],
        [
          post({ type: 'code_feedback', quest_id: 'q1' }),
          400,
          'missing_execution_result',
        ],
        [
          post({
            type: 'code_feedback',
            quest_id: 'q1',
            student_code: 'x'.repeat(70_000),
          }),
          413,
          'body_too_large',
        ],
      ];
      for (const [req, status, reason] of cases) {
        const res = await POST(req);
        expect(res.status, reason).toBe(status);
        expect(abuseLines().at(-1), reason).toMatchObject({
          level: 'warning',
          reason,
        });
      }
      expect(abuseLines()[2].kind).toBe('unknown'); // 알 수 없는 type 문자열은 그대로 남기지 않음
      expect(JSON.stringify(abuseLines())).not.toContain('steal_answers');
      expect(mocks.quota).not.toHaveBeenCalled();
    });

    it('content-length 가 상한을 넘으면 본문을 읽지 않고 413', async () => {
      const req = post({ type: 'quest_intro', quest_id: 'q1' });
      const big = new Request(req, {
        headers: { 'content-length': String(1024 * 1024) },
      });
      const res = await POST(big);
      expect(res.status).toBe(413);
      expect(abuseLines().at(-1)).toMatchObject({
        reason: 'body_too_large',
        bytes: 1024 * 1024,
      });
    });

    it('긴 입력은 잘라서 계속 진행하고 필드 이름만 info 로 기록', async () => {
      mocks.createProvider.mockImplementation(() => echoProvider());
      const res = await readText(
        await POST(
          post({
            type: 'code_feedback',
            quest_id: 'q1',
            student_code: 'y'.repeat(3000),
            execution_result: {
              stdout: 'o'.repeat(4000),
              stderr: '',
              passed: false,
            },
          }),
        ),
      );
      expect(res.text).not.toContain('y'.repeat(2001));
      expect(abuseLines()).toEqual([
        expect.objectContaining({
          level: 'info',
          reason: 'input_too_long',
          fields: 'student_code',
        }),
      ]);
    });

    it('없는 퀘스트는 404 + warning (한도는 이미 씀)', async () => {
      mocks.quest.current = null;
      const res = await POST(
        post({
          type: 'quest_intro',
          quest_id: 'b1000000-0000-0000-0000-00000000ffff',
        }),
      );
      expect(res.status).toBe(404);
      expect(mocks.quota).toHaveBeenCalledTimes(1);
      expect(abuseLines()).toEqual([
        expect.objectContaining({
          level: 'warning',
          reason: 'quest_not_found',
          quest_id: 'b1000000-0000-0000-0000-00000000ffff',
        }),
      ]);
    });

    describe('잠긴 스테이지 (B38)', () => {
      it('잠긴 스테이지의 퀘스트는 LLM·힌트 기록 없이 403 + 아이용 문구, warning 으로 기록', async () => {
        mocks.createProvider.mockImplementation(() => echoProvider());
        mocks.stageUnlocked.mockResolvedValue({ data: false, error: null });

        for (const route of [POST, POST_JSON]) {
          const res = await route(
            post({ type: 'hint_generator', quest_id: 'q1', hint_level: 1 }),
          );
          expect(res.status).toBe(403);
          expect(await res.json()).toEqual({
            error: 'stage_locked',
            message: STAGE_LOCKED_MESSAGE,
          });
        }
        expect(mocks.createProvider).not.toHaveBeenCalled();
        expect(mocks.rpc).not.toHaveBeenCalled(); // record_hint
        expect(mocks.stageUnlocked).toHaveBeenCalledWith({
          p_user_id: 'u1',
          p_stage_id: 's1',
        });
        expect(abuseLines()).toEqual([
          expect.objectContaining({
            level: 'warning',
            reason: 'stage_locked',
            kind: 'hint_generator',
            quest_id: 'invalid',
          }),
          expect.objectContaining({ level: 'warning', reason: 'stage_locked' }),
        ]);
      });

      it('잠긴 스테이지라도 이미 완료한 퀘스트(복습)는 튜터를 쓸 수 있다', async () => {
        mocks.createProvider.mockImplementation(() => echoProvider());
        mocks.stageUnlocked.mockResolvedValue({ data: false, error: null });
        mocks.progress.current = { status: 'completed' };
        const res = await readText(
          await POST(post({ type: 'quest_intro', quest_id: 'q1' })),
        );
        expect(res.text).toContain('변수 상자');
        expect(abuseLines()).toEqual([]);
      });

      it('열린 스테이지는 진행을 다시 읽지 않는다 (평소 응답 지연 없음)', async () => {
        mocks.createProvider.mockImplementation(() => echoProvider());
        mocks.progress.current = { status: 'in_progress' };
        const res = await readText(
          await POST(post({ type: 'quest_intro', quest_id: 'q1' })),
        );
        expect(res.text).toContain('변수 상자');
        expect(mocks.stageUnlocked).toHaveBeenCalledTimes(1);
      });

      it('잠금 확인이 실패하면 막지 않는다 (fail-open, 로그)', async () => {
        mocks.createProvider.mockImplementation(() => echoProvider());
        mocks.stageUnlocked.mockResolvedValue({
          data: null,
          error: { code: '42883', message: 'function not found' },
        });
        const res = await readText(
          await POST(post({ type: 'quest_intro', quest_id: 'q1' })),
        );
        expect(res.text).toContain('변수 상자');
        expect(console.warn).toHaveBeenCalledWith(
          '[stageLock] is_stage_unlocked 실패 (tutor):',
          '42883 function not found',
        );
      });
    });
  });
});
