import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { POST } from '../route';

const S1 = 'a1000000-0000-0000-0000-000000000001';
const S2 = 'a1000000-0000-0000-0000-000000000002';

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/world/unlocks', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.rpc.mockReset().mockResolvedValue({ data: 2, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/world/unlocks (P5-05)', () => {
  it('로그인 사용자 id 로 service_role RPC 를 한 번 부른다 (겹친 id 는 하나로)', async () => {
    const res = await post({ stageIds: [S1, S2, S1] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recorded: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith('record_seen_unlocks', {
      p_user_id: 'u1',
      p_stage_ids: [S1, S2],
    });
  });

  it('로그인 안 했으면 401', async () => {
    mocks.user = null;
    expect((await post({ stageIds: [S1] })).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['본문 없음', 'not json'],
    ['빈 목록', { stageIds: [] }],
    ['uuid 아님', { stageIds: ['stage-1'] }],
    ['너무 많음', { stageIds: Array.from({ length: 65 }, () => S1) }],
    ['다른 사용자 id 를 넣어도 무시되는 필드', { userId: 'u2' }],
  ])('잘못된 본문(%s)은 400', async (_, body) => {
    expect((await post(body)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('DB 오류는 응답에 넣지 않고 500', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied for table x' },
    });
    const res = await post({ stageIds: [S1] });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('permission');
  });
});
