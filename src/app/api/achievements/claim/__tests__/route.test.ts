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

const CLAIMED = {
  claimed: true,
  already_claimed: false,
  coins_earned: 10,
  coins_balance: 110,
};

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/achievements/claim', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.rpc.mockReset().mockResolvedValue({ data: CLAIMED, error: null });
  mocks.revalidatePath.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/achievements/claim (P8-09)', () => {
  it('로그인 사용자 id 로 service_role RPC 를 부르고(본문 userId 무시) 결과를 그대로, 받으면 무효화', async () => {
    const res = await post({ id: 'first_code', userId: 'u2' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(CLAIMED);
    expect(mocks.rpc).toHaveBeenCalledWith('claim_achievement', {
      p_user_id: 'u1',
      p_achievement_id: 'first_code',
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/world', 'layout');
  });

  it('이미 받았으면 200 + already_claimed, 무효화 없음', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...CLAIMED, already_claimed: true, coins_earned: 0 },
      error: null,
    });
    const res = await post({ id: 'first_code' });
    expect((await res.json()).already_claimed).toBe(true);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('얻지 않은 업적 → 409 + 쉬운 문구', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'achievement_not_earned' },
    });
    const res = await post({ id: 'quests_30' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('아직 얻지 않은 업적이에요.');
  });

  it.each([[{}], [{ id: 'Bad-Id' }], [{ id: 3 }], ['not json']])(
    '잘못된 본문 %j → 400, RPC 안 부름',
    async (body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it('로그인 안 함 → 401', async () => {
    mocks.user = null;
    expect((await post({ id: 'first_code' })).status).toBe(401);
  });
});
