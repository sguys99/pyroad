import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: '11111111-1111-1111-1111-111111111111' } as { id: string } | null,
  allowed: true,
  rpc: vi.fn(),
  quiz: null as unknown,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { prompt_skeleton: { quiz: mocks.quiz } },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
vi.mock('@/lib/api/serverError', () => ({ reportServerError: vi.fn() }));
vi.mock('@/lib/tutor/rateLimit', () => ({
  consumeRateLimit: async () => ({ allowed: mocks.allowed, retryAfter: 30 }),
}));
vi.mock('@/lib/quest/rewardRpc', () => ({
  submitQuizAnswerRpc: mocks.rpc,
  rewardError: (code: string) => Response.json({ code }, { status: 400 }),
}));

import { POST } from '../route';

const QUEST = 'b1000000-0000-0000-0000-000000000045';
const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/quest/answer', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

const rpcResult = {
  correct: false,
  attempt_no: 1,
  mode: 'first',
  stars: 0,
  best_stars: 0,
  xp_awarded: 0,
  total_xp: 0,
  level_before: 1,
  level_after: 1,
  explanation: '틀린 보기 해설',
  revealed: null,
  next_review_on: null,
  extra_field: 'x',
};

beforeEach(() => {
  mocks.user = { id: '11111111-1111-1111-1111-111111111111' };
  mocks.allowed = true;
  mocks.rpc.mockReset();
  mocks.rpc.mockResolvedValue({ ok: true, data: rpcResult });
  mocks.quiz = {
    kind: 'multiple_choice',
    question: '?',
    options: [
      { id: 'opt-a1b1', text: '1' },
      { id: 'opt-a1b2', text: '2' },
    ],
  };
});

describe('POST /api/quest/answer', () => {
  it('로그인 안 했으면 401, RPC 안 부름', async () => {
    mocks.user = null;
    expect((await post({ quest_id: QUEST, answer: 'opt-a1b1' })).status).toBe(
      401,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('한도 초과면 429 + Retry-After', async () => {
    mocks.allowed = false;
    const res = await post({ quest_id: QUEST, answer: 'opt-a1b1' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['multiple_choice', 'opt-a1b1'],
    ['fill_blank', { 'bk-a1b1': 'tok-a1b1', 'bk-a1b2': 'tok-a1b2' }],
    ['parsons', ['ln-a1b1', 'ln-a1b2']],
    [
      'parsons indent',
      [
        { id: 'ln-a1b1', indent: 0 },
        { id: 'ln-a1b2', indent: 1 },
      ],
    ],
    ['bug_hunt', { line: 'ln-a1b1', fix: 'fx-a1b1' }],
  ])('정규형 %s 는 그대로 RPC 로', async (_name, answer) => {
    const res = await post({ quest_id: QUEST, answer });
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      expect.anything(),
      mocks.user!.id,
      QUEST,
      answer,
    );
  });

  it.each([
    ['JSON 아님', 'nope'],
    ['quest_id 없음', { answer: 'opt-a1b1' }],
    ['uuid 아님', { quest_id: 'x', answer: 'opt-a1b1' }],
    ['차례형 id', { quest_id: QUEST, answer: 'a' }],
    ['숫자', { quest_id: QUEST, answer: 1 }],
    [
      'indent 범위',
      { quest_id: QUEST, answer: [{ id: 'ln-a1b1', indent: 9 }] },
    ],
    [
      'bug_hunt 키 더',
      { quest_id: QUEST, answer: { line: 'ln-a1b1', fix: 'fx-a1b1', x: 1 } },
    ],
    ['다른 키', { quest_id: QUEST, answer: 'opt-a1b1', user_id: 'u' }],
    [
      '너무 큼',
      { quest_id: QUEST, answer: Array.from({ length: 400 }, () => 'ln-a1b1') },
    ],
  ])('잘못된 입력 %s → 400·413, RPC 안 부름', async (_name, body) => {
    const res = await post(body);
    expect([400, 413]).toContain(res.status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('응답은 정해진 필드만 + 새로 섞은 next_quiz', async () => {
    const res = await post({ quest_id: QUEST, answer: 'opt-a1b2' });
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      [
        'correct',
        'attempt_no',
        'mode',
        'stars',
        'best_stars',
        'xp_awarded',
        'total_xp',
        'level_before',
        'level_after',
        'explanation',
        'revealed',
        'next_review_on',
        'next_quiz',
      ].sort(),
    );
    expect(
      body.next_quiz.options.map((o: { id: string }) => o.id).sort(),
    ).toEqual(['opt-a1b1', 'opt-a1b2']);
  });

  it('RPC 오류 응답은 그대로', async () => {
    mocks.rpc.mockResolvedValue({
      ok: false,
      response: Response.json({ code: 'stage_locked' }, { status: 403 }),
    });
    expect((await post({ quest_id: QUEST, answer: 'opt-a1b1' })).status).toBe(
      403,
    );
  });
});
