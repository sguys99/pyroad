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
  mission_coins: 15,
  xp_earned: 15,
  coins_earned: 35,
  coins_balance: 135,
  total_xp: 205,
  level_before: 1,
  level_after: 2,
  level_ups: [{ level: 2, coins: 20 }],
};

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/missions/claim', {
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

describe('POST /api/missions/claim (P8-07)', () => {
  it('로그인 사용자 id 로 service_role RPC 를 부르고(본문 userId 무시) 결과를 그대로, 받으면 월드맵 무효화', async () => {
    const res = await post({
      day: '2026-11-11',
      missionId: 'quest_2',
      userId: 'u2',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(CLAIMED);
    expect(mocks.rpc).toHaveBeenCalledWith('claim_daily_mission', {
      p_user_id: 'u1',
      p_day: '2026-11-11',
      p_mission_id: 'quest_2',
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/world', 'layout');
  });

  it('이미 받은 미션은 200 + already_claimed, 무효화 없음', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...CLAIMED, already_claimed: true, coins_earned: 0 },
      error: null,
    });
    const res = await post({ day: '2026-11-11', missionId: 'quest_2' });
    expect((await res.json()).already_claimed).toBe(true);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ['mission_not_done', 409, '아직 미션을 다 하지 않았어요.'],
    ['mission_not_found', 404, '오늘의 미션이 아니에요.'],
    ['mission_expired', 410, '받을 수 있는 날이 지났어요.'],
  ])('%s → %i + 쉬운 문구', async (code, status, error) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    const res = await post({ day: '2026-11-11', missionId: 'quest_2' });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error, code });
  });

  it('로그인 안 했으면 401', async () => {
    mocks.user = null;
    expect(
      (await post({ day: '2026-11-11', missionId: 'quest_2' })).status,
    ).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['본문 없음', 'not json'],
    ['날짜 모양', { day: '11/11', missionId: 'quest_2' }],
    ['미션 id 모양', { day: '2026-11-11', missionId: 'Quest 2!' }],
    ['빠짐', { day: '2026-11-11' }],
  ])('잘못된 본문(%s)은 400', async (_, body) => {
    expect((await post(body)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
