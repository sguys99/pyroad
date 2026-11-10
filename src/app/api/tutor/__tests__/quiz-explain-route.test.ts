import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMProvider } from '@/lib/tutor/providers/types';

// 퀴즈 오답 해설 quiz_explain (P7-08): 학생 답은 서버가 quiz_attempts 에서 읽고, 정답이 섞인 답은 저장된 해설로

const QUIZ = {
  kind: 'multiple_choice',
  question: '이 코드를 돌리면 무엇이 나올까?',
  code: 'for i in range(3):\n    print(i)',
  options: [
    { id: 'opt-w9fa', text: '0 1 2 3' },
    { id: 'opt-k7qz', text: '0 1 2' },
    { id: 'opt-b2mx', text: '1 2 3' },
  ],
};
const QUEST = {
  id: 'q1',
  title: '반복 맞혀 보기',
  quest_type: 'quiz',
  stage: { id: 's1', title: '숲', order: 1, theme_name: 'forest' },
  prompt_skeleton: {
    topic: '반복문',
    learning_goals: ['range 이해'],
    story_context: '숲',
    fallback_text: '숫자를 하나씩 세어 봐요.',
    quiz: QUIZ,
  },
};
const QUIZ_KEY = {
  kind: 'multiple_choice',
  accepted: ['opt-k7qz'],
  explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
  explanations: { 'opt-b2mx': 'range는 0부터 세기 시작해요.' },
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
  attempt: { current: null as unknown },
  attemptFilters: [] as [string, unknown][],
  attemptOrder: [] as unknown[],
  quest: { current: null as unknown },
}));

function chain(data: unknown, record?: [string, unknown][]) {
  const q = {
    select: () => q,
    eq: (col: string, v: unknown) => {
      record?.push([col, v]);
      return q;
    },
    order: (...args: unknown[]) => {
      if (record) mocks.attemptOrder.push(args);
      return q;
    },
    limit: () => q,
    single: async () => ({ data, error: null }),
    maybeSingle: async () => ({ data, error: null }),
  };
  return q;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => chain({ preferred_provider: null }),
  }),
}));
vi.mock('@/lib/tutor/apiKeys', () => ({
  loadUserApiKeys: async () => ({ enabled: true, keys: {}, unreadable: [] }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string) => ({
      data: fn === 'is_stage_unlocked' ? true : QUOTA_OK,
      error: null,
    }),
    from: (table: string) =>
      table === 'quest_answer_keys'
        ? chain({ quiz_answer: QUIZ_KEY })
        : table === 'quiz_attempts'
          ? chain(mocks.attempt.current, mocks.attemptFilters)
          : chain(mocks.quest.current),
  }),
}));
vi.mock('@/lib/tutor/providers/factory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tutor/providers/factory')>()),
  createProvider: mocks.createProvider,
}));

import { POST } from '../route';
import { POST as POST_STREAM } from '../stream/route';

function post(body: object, path = '/api/tutor') {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** 받은 프롬프트를 남기고 정해진 답을 주는 provider */
function provider(reply: string, seen: string[] = []): LLMProvider {
  return {
    async call(s, u) {
      seen.push(s, u);
      return reply;
    },
    async *callStream() {
      yield reply;
    },
  };
}

describe('/api/tutor quiz_explain (P7-08)', () => {
  beforeEach(() => {
    mocks.quest.current = QUEST;
    mocks.attempt.current = { answer: 'opt-b2mx' };
    mocks.attemptFilters.length = 0;
    mocks.attemptOrder.length = 0;
    mocks.createProvider.mockReset();
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('이 사용자의 가장 최근 오답만 읽어 해설하고, 클라이언트가 보낸 답은 쓰지 않는다', async () => {
    const seen: string[] = [];
    mocks.createProvider.mockImplementation(() =>
      provider('range는 어디서부터 셀까요? 다시 세어 봐요!', seen),
    );
    const res = await POST(
      post({
        type: 'quiz_explain',
        quest_id: 'q1',
        answer: 'opt-k7qz',
        student_code: 'opt-k7qz',
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      message: 'range는 어디서부터 셀까요? 다시 세어 봐요!',
      is_fallback: false,
    });
    expect(mocks.attemptFilters).toEqual(
      expect.arrayContaining([
        ['user_id', 'u1'],
        ['quest_id', 'q1'],
        ['is_correct', false],
      ]),
    );
    expect(mocks.attemptOrder[0]).toEqual(['created_at', { ascending: false }]);
    const [system, user] = seen;
    expect(system).toContain('퀴즈 오답 해설 규칙');
    expect(user).toContain('학생이 낸 답 (틀림): 1 2 3');
  });

  it('LLM 답에 정답 글자가 있으면 버리고 저장된 해설을 보낸다', async () => {
    mocks.createProvider.mockImplementation(() =>
      provider('정답은 0 1 2 예요!'),
    );
    const body = await (
      await POST(post({ type: 'quiz_explain', quest_id: 'q1' }))
    ).json();
    expect(body.is_fallback).toBe(true);
    expect(body.message).toContain('range는 0부터 세기 시작해요.');
    expect(body.message).not.toContain('0 1 2 예요');
  });

  it('키가 없거나 AI 가 실패하면 저장된 해설', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const body = await (
      await POST(post({ type: 'quiz_explain', quest_id: 'q1' }))
    ).json();
    expect(body).toMatchObject({ is_fallback: true, no_api_key: true });
    expect(body.message).toContain('range는 0부터 세기 시작해요.');
  });

  it('틀린 제출 기록이 없으면 409, 퀴즈가 아니면 400, 스트림 route 는 400', async () => {
    mocks.attempt.current = null;
    expect(
      (await POST(post({ type: 'quiz_explain', quest_id: 'q1' }))).status,
    ).toBe(409);

    mocks.attempt.current = { answer: 'opt-b2mx' };
    mocks.quest.current = { ...QUEST, quest_type: 'code' };
    expect(
      (await POST(post({ type: 'quiz_explain', quest_id: 'q1' }))).status,
    ).toBe(400);

    mocks.quest.current = QUEST;
    expect(
      (
        await POST_STREAM(
          post({ type: 'quiz_explain', quest_id: 'q1' }, '/api/tutor/stream'),
        )
      ).status,
    ).toBe(400);
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });
});
