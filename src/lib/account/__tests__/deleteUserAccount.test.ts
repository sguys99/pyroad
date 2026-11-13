import { beforeEach, describe, expect, it, vi } from 'vitest';

// B77: 계정이 지워지면 자랑 카드 이미지의 CDN 사본도 지움 (탈퇴·미동의 파기 크론 공통 경로)

const mocks = vi.hoisted(() => ({
  purge: vi.fn<(ids: string[]) => Promise<void>>(async () => {}),
  report: vi.fn(),
  analytics: vi.fn(async () => {}),
  order: [] as string[],
}));
vi.mock('@/lib/share-card/purge', () => ({
  purgeShareCards: (ids: string[]) => (
    mocks.order.push('purge'),
    mocks.purge(ids)
  ),
}));
vi.mock('@/lib/api/serverError', () => ({ reportServerError: mocks.report }));
vi.mock('@/lib/analytics/server', () => ({
  deleteUserAnalytics: mocks.analytics,
}));
vi.mock('@/lib/auth/providerUnlink', () => ({
  unlinkAllKakao: async () => 'skipped',
}));

import { deleteUserAccount } from '../deleteUserAccount';

function admin(
  cards: { data: { id: string }[] | null; error: unknown },
  deleteError: { message: string } | null = null,
) {
  return {
    from: (t: string) => {
      expect(t).toBe('share_cards');
      return {
        select: () => ({
          eq: async () => (mocks.order.push('read'), cards),
        }),
      };
    },
    auth: {
      admin: {
        deleteUser: async () => (
          mocks.order.push('delete'),
          { error: deleteError }
        ),
      },
    },
  } as never;
}

beforeEach(() => {
  mocks.purge.mockClear();
  mocks.report.mockClear();
  mocks.order = [];
});

describe('deleteUserAccount 자랑 카드 CDN 지우기 (B77)', () => {
  it('Auth 삭제 전에 카드 id 를 읽고, 삭제 뒤에 그 카드만 지움', async () => {
    const r = await deleteUserAccount(
      admin({ data: [{ id: 'c1' }, { id: 'c2' }], error: null }),
      'u',
      [],
    );
    expect(r.ok).toBe(true);
    expect(mocks.order).toEqual(['read', 'delete', 'purge']);
    expect(mocks.purge).toHaveBeenCalledWith(['c1', 'c2']);
  });

  it('Auth 삭제가 실패하면 지우지 않음', async () => {
    const r = await deleteUserAccount(
      admin({ data: [{ id: 'c1' }], error: null }, { message: 'x' }),
      'u',
      [],
    );
    expect(r).toEqual({ ok: false, error: 'x' });
    expect(mocks.purge).not.toHaveBeenCalled();
  });

  it('카드 읽기가 실패해도 계정은 지우고 로그만 남김', async () => {
    const r = await deleteUserAccount(
      admin({ data: null, error: new Error('db') }),
      'u',
      [],
    );
    expect(r.ok).toBe(true);
    expect(mocks.report).toHaveBeenCalledOnce();
    expect(mocks.purge).toHaveBeenCalledWith([]);
  });
});
