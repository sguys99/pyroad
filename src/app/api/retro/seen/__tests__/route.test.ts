import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  calls: [] as unknown[][],
  error: null as { message: string } | null,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const q = {
      from: (...a: unknown[]) => (mocks.calls.push(['from', ...a]), q),
      update: (...a: unknown[]) => (mocks.calls.push(['update', ...a]), q),
      eq: (...a: unknown[]) => (mocks.calls.push(['eq', ...a]), q),
      is: async (...a: unknown[]) => {
        mocks.calls.push(['is', ...a]);
        return { error: mocks.error };
      },
    };
    return q;
  },
}));

import { POST } from '../route';

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.calls = [];
  mocks.error = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/retro/seen (P8-11)', () => {
  it('확인한 id 의 닫지 않은 소급 행에 seen_at', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(mocks.calls[0]).toEqual(['from', 'retro_rewards']);
    expect(mocks.calls[1][0]).toBe('update');
    expect(mocks.calls[1][1]).toHaveProperty('seen_at');
    expect(mocks.calls.slice(2)).toEqual([
      ['eq', 'user_id', 'u1'],
      ['is', 'seen_at', null],
    ]);
  });

  it('로그인 안 했으면 401, DB 안 부름', async () => {
    mocks.user = null;
    expect((await POST()).status).toBe(401);
    expect(mocks.calls).toEqual([]);
  });

  it('DB 오류 메시지는 응답에 넣지 않음', async () => {
    mocks.error = { message: 'secret detail' };
    const res = await POST();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});
