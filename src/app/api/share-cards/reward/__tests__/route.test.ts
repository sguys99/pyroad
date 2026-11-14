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

// 처리방침 시행일 판정은 켜 둔다 (B79). 꺼진 경우는 따로 확인
const policy = vi.hoisted(() => ({ live: true }));
vi.mock('@/lib/legal/policyGate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/legal/policyGate')>()),
  isPolicyLive: async () => policy.live,
}));

const ID = 'rG6TzuP93C8blCS4ZdyehQ';
const req = (body: unknown) =>
  new Request('http://x/api/share-cards/reward', {
    method: 'POST',
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.rpc.mockReset().mockResolvedValue({
    data: { coins_earned: 15, coins_balance: 130, already_claimed: false },
    error: null,
  });
  mocks.revalidatePath.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/share-cards/reward (P9-10)', () => {
  it('처리방침 시행일 전(B79)은 404 not_yet, 보상 RPC 를 부르지 않음', async () => {
    policy.live = false;
    try {
      const res = await POST(req({ cardId: 'rG6TzuP93C8blCS4ZdyehQ' }));
      expect(res.status).toBe(404);
      expect(mocks.rpc).not.toHaveBeenCalled();
    } finally {
      policy.live = true;
    }
  });

  it('로그인하지 않으면 401, 잘못된 카드 id 는 400 — RPC 를 부르지 않음', async () => {
    mocks.user = null;
    expect((await POST(req({ cardId: ID }))).status).toBe(401);
    mocks.user = { id: 'u1' };
    expect((await POST(req({ cardId: '../x' }))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('확인한 사용자 id + 카드 id 만 넘기고(금액은 서버) 받으면 무효화', async () => {
    const res = await POST(req({ cardId: ID, coins: 9999 }));
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('claim_share_reward', {
      p_user_id: 'u1',
      p_card_id: ID,
    });
    expect((await res.json()).coins_earned).toBe(15);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/profile');
  });

  it('이미 받은 날은 200 + already_claimed, 무효화 안 함', async () => {
    mocks.rpc.mockResolvedValue({
      data: { coins_earned: 0, coins_balance: 130, already_claimed: true },
      error: null,
    });
    const res = await POST(req({ cardId: ID }));
    expect(res.status).toBe(200);
    expect((await res.json()).already_claimed).toBe(true);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('남의 카드·만료 카드는 404 아이용 문구', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'share_card_not_found', code: 'PT404' },
    });
    const res = await POST(req({ cardId: ID }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('share_card_not_found');
  });
});
