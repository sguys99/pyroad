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

const STAMPED = {
  stamped: true,
  already_stamped: false,
  day_n: 7,
  coins_earned: 30,
  coins_balance: 130,
  shield_granted: 1,
  shields: 1,
};

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.rpc.mockReset().mockResolvedValue({ data: STAMPED, error: null });
  mocks.revalidatePath.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/attendance/stamp (P8-08)', () => {
  it('로그인 사용자 id 로 service_role RPC, 찍으면 월드맵 무효화', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(STAMPED);
    expect(mocks.rpc).toHaveBeenCalledWith('stamp_attendance', {
      p_user_id: 'u1',
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/world', 'layout');
  });

  it('로그인 안 했으면 401, RPC 안 부름', async () => {
    mocks.user = null;
    expect((await POST()).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('이미 찍었으면 그대로 200, 무효화 없음', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...STAMPED, already_stamped: true, coins_earned: 0 },
      error: null,
    });
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).already_stamped).toBe(true);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('DB 오류 메시지는 응답에 넣지 않음 (500 일반 문구)', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'relation x does not exist', code: '42P01' },
    });
    const res = await POST();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('relation');
  });
});
