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
    from: () => chain({ preferred_provider: null, custom_api_keys: {} }),
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
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
});
