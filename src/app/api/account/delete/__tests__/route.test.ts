import { beforeEach, describe, expect, it, vi } from 'vitest';

// 탈퇴 (B28 + P3-16): Auth 삭제 전에 Kakao 연결 끊기, 실패해도 삭제는 계속

const { getUser, deleteUser, getUserById, unlinkAllKakao, order } = vi.hoisted(
  () => {
    const order: string[] = [];
    return {
      order,
      getUser: vi.fn(),
      deleteUser: vi.fn(async () => {
        order.push('deleteUser');
        return { error: null as { message: string } | null };
      }),
      getUserById: vi.fn(),
      unlinkAllKakao: vi.fn(async () => {
        order.push('unlink');
        return 'ok' as 'ok' | 'failed' | 'skipped';
      }),
    };
  },
);
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser, getUserById } },
    from: () => ({
      select: () => ({ eq: async () => ({ data: [], error: null }) }),
    }),
  }),
}));
vi.mock('@/lib/share-card/purge', () => ({ purgeShareCards: vi.fn() }));
vi.mock('@/lib/analytics/server', () => ({
  deleteUserAnalytics: vi.fn(async () => {}),
}));
vi.mock('@/lib/auth/providerUnlink', () => ({ unlinkAllKakao }));

import { DELETE } from '../route';

const KAKAO_USER = {
  id: 'u1',
  identities: [{ provider: 'kakao', id: '1234567890', identity_data: {} }],
};

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('DELETE /api/account/delete', () => {
  it('로그인하지 않으면 401, 아무것도 부르지 않음', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(unlinkAllKakao).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('Kakao identity → Auth 삭제 **전에** 연결 끊기, 결과를 알려 준다(식별자 없음)', async () => {
    getUser.mockResolvedValueOnce({ data: { user: KAKAO_USER } });
    const res = await DELETE();
    expect(unlinkAllKakao).toHaveBeenCalledWith(KAKAO_USER.identities);
    expect(order).toEqual(['unlink', 'deleteUser']);
    expect(deleteUser).toHaveBeenCalledWith('u1');
    expect(await res.json()).toEqual({
      success: true,
      unlinked: { kakao: 'ok' },
    });
  });

  it.each(['failed', 'skipped'] as const)(
    '연결 끊기가 %s여도 탈퇴는 계속',
    async (outcome) => {
      getUser.mockResolvedValueOnce({ data: { user: KAKAO_USER } });
      unlinkAllKakao.mockResolvedValueOnce(outcome);
      const res = await DELETE();
      expect(deleteUser).toHaveBeenCalledWith('u1');
      expect(res.status).toBe(200);
      expect((await res.json()).unlinked.kakao).toBe(outcome);
    },
  );

  it('세션 사용자에 identities가 없으면 관리자 API로 다시 읽는다', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
    getUserById.mockResolvedValueOnce({ data: { user: KAKAO_USER } });
    await DELETE();
    expect(getUserById).toHaveBeenCalledWith('u1');
    expect(unlinkAllKakao).toHaveBeenCalledWith(KAKAO_USER.identities);
  });

  it('Auth 삭제가 실패하면 500 (원문 오류 없이)', async () => {
    getUser.mockResolvedValueOnce({ data: { user: KAKAO_USER } });
    deleteUser.mockResolvedValueOnce({ error: { message: 'db boom' } });
    const res = await DELETE();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('boom');
  });
});
