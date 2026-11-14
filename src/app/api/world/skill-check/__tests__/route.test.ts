import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  questions: [] as { no: number; quiz: unknown }[],
  selects: [] as string[],
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      const q = {
        select: (cols: string) => {
          mocks.selects.push(`${table}:${cols}`);
          return q;
        },
        eq: () => q,
        order: async () => ({ data: mocks.questions, error: null }),
        maybeSingle: async () => ({
          data: table === 'worlds' ? { id: 'w2' } : null,
          error: null,
        }),
      };
      return q;
    },
  }),
}));

import { POST } from '../route';

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/world/skill-check', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

const RATE_OK = { data: { allowed: true }, error: null };
const MC = {
  kind: 'multiple_choice',
  question: 'q',
  options: [
    { id: 'opt-a1bc', text: '1' },
    { id: 'opt-b2cd', text: '2' },
  ],
};

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.rpc.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.questions = [{ no: 1, quiz: MC }];
  mocks.selects = [];
});

/** consume_rate_limit 다음에 부를 RPC 결과 */
const nextRpc = (data: unknown, error: unknown = null) =>
  mocks.rpc
    .mockResolvedValueOnce(RATE_OK)
    .mockResolvedValueOnce({ data, error });

describe('POST /api/world/skill-check (P10-03)', () => {
  it('시작: 확인한 사용자 id 로 skill_check_start, 오늘 묶음의 공개 모양만(정답 열은 읽지 않음)', async () => {
    nextRpc({ status: 'ready', set_no: 2, practice: [] });
    const res = await post({ world: 'code-sea' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.questions).toHaveLength(1);
    expect(
      body.questions[0].options.map((o: { id: string }) => o.id).sort(),
    ).toEqual(['opt-a1bc', 'opt-b2cd']);
    expect(mocks.rpc).toHaveBeenLastCalledWith('skill_check_start', {
      p_user_id: 'u1',
      p_world_id: 'w2',
    });
    expect(mocks.selects).toContain('skill_check_questions:no, quiz');
    expect(JSON.stringify(body)).not.toContain('accepted');
  });

  it('오늘 이미 냈으면 결과(점수·연습할 단계)만, 열린 월드면 open', async () => {
    const practice = [
      {
        quest_id: 'q',
        stage_id: 's',
        stage_order: 3,
        stage_title: '조건의 갈림길',
        world_slug: 'python-island',
      },
    ];
    nextRpc({ status: 'done', score: 6, total: 10, passed: false, practice });
    expect(await (await post({ world: 'code-sea' })).json()).toEqual({
      status: 'done',
      result: { score: 6, total: 10, pass_score: 8, passed: false, practice },
    });
    nextRpc({ status: 'open', practice: [] });
    expect(await (await post({ world: 'code-sea' })).json()).toEqual({
      status: 'open',
    });
  });

  it('제출: 답을 그대로 skill_check_submit 에, 합격하면 지도·책장·프로필 무효화', async () => {
    const result = {
      score: 8,
      total: 10,
      pass_score: 8,
      passed: true,
      practice: [],
      first_stage_id: 's2',
    };
    nextRpc(result);
    const answers = ['opt-a1bc', { 'bk-a1bc': 'tok-b2cd' }];
    const res = await post({ world: 'code-sea', answers });
    expect(await res.json()).toEqual(result);
    expect(mocks.rpc).toHaveBeenLastCalledWith('skill_check_submit', {
      p_user_id: 'u1',
      p_world_id: 'w2',
      p_answers: answers,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/worlds');
  });

  it('불합격은 무효화하지 않음, 같은 날 두 번째 제출은 409 문구', async () => {
    nextRpc({
      score: 3,
      total: 10,
      pass_score: 8,
      passed: false,
      practice: [],
    });
    await post({ world: 'code-sea', answers: ['opt-a1bc'] });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    nextRpc(null, { message: 'skill_check_done_today' });
    const res = await post({ world: 'code-sea', answers: ['opt-a1bc'] });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('내일');
  });

  it('로그인 안 했으면 401, 잘못된 본문은 400 (RPC 안 부름)', async () => {
    mocks.user = null;
    expect((await post({ world: 'code-sea' })).status).toBe(401);
    mocks.user = { id: 'u1' };
    for (const body of [
      'not json',
      { world: '../x' },
      { world: 'code-sea', answers: [] },
      { world: 'code-sea', user_id: 'u2' },
      { world: 'code-sea', answers: ['A'] },
    ])
      expect((await post(body)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
