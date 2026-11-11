import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
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
const OPENED = {
  opened: true,
  already_opened: false,
  coins_earned: 30,
  coins_balance: 130,
  stars: 15,
  goal: 15,
};

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/world/chest', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.rpc.mockReset().mockResolvedValue({ data: OPENED, error: null });
  mocks.revalidatePath.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/world/chest (P8-06)', () => {
  it('로그인 사용자 id 로 service_role RPC 를 부르고 결과를 그대로, 처음 열면 월드맵 무효화', async () => {
    const res = await post({ stageId: S1, userId: 'u2' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(OPENED);
    expect(mocks.rpc).toHaveBeenCalledWith('open_stage_chest', {
      p_user_id: 'u1',
      p_stage_id: S1,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/world', 'layout');
  });

  it('이미 연 상자는 200 + already_opened, 무효화 없음', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...OPENED, already_opened: true, coins_earned: 0 },
      error: null,
    });
    const res = await post({ stageId: S1 });
    expect((await res.json()).already_opened).toBe(true);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('별이 모자라면 409 + 쉬운 문구 (DB 메시지를 그대로 내보내지 않음)', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'not_enough_stars', code: 'PT409' },
    });
    const res = await post({ stageId: S1 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: '별이 아직 모자라요.',
      code: 'not_enough_stars',
    });
  });

  it('로그인 안 했으면 401', async () => {
    mocks.user = null;
    expect((await post({ stageId: S1 })).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['본문 없음', 'not json'],
    ['uuid 아님', { stageId: 'stage-1' }],
  ])('잘못된 본문(%s)은 400', async (_, body) => {
    expect((await post(body)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
