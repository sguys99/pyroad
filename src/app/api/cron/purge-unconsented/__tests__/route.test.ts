import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ids: [] as string[],
  rows: {} as Record<string, unknown>,
  deleteUserAccount: vi.fn(async (...args: [unknown, string]) => ({
    args,
    ok: true as const,
    unlinked: { kakao: 'skipped' as const },
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: mocks.ids, error: null }),
    from: () => {
      let id = '';
      const b = {
        select: () => b,
        eq: (_c: string, v: string) => ((id = v), b),
        maybeSingle: async () => ({
          data: mocks.rows[id] ?? null,
          error: null,
        }),
      };
      return b;
    },
  }),
}));
vi.mock('@/lib/account/deleteUserAccount', () => ({
  deleteUserAccount: mocks.deleteUserAccount,
}));
vi.mock('@/lib/api/serverError', () => ({ reportServerError: vi.fn() }));

import { GET } from '../route';

const call = (auth?: string, q = '') =>
  GET(
    new Request(`http://localhost/api/cron/purge-unconsented${q}`, {
      headers: auth ? { authorization: auth } : {},
    }),
  );
const expired = {
  age_band: 'under14',
  guardian_consented_at: null,
  consent_deadline: '2020-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  vi.spyOn(console, 'info').mockImplementation(() => {});
  mocks.ids = [];
  mocks.rows = {};
  mocks.deleteUserAccount.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/cron/purge-unconsented (P3-15)', () => {
  it('CRON_SECRET 이 없으면 꺼짐(503), 다른 비밀이면 401 — 아무것도 지우지 않음', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer test-secret')).status).toBe(503);
    vi.stubEnv('CRON_SECRET', 'test-secret');
    expect((await call()).status).toBe(401);
    expect((await call('Bearer nope')).status).toBe(401);
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it('기한이 지난 미동의 계정만 탈퇴와 같은 경로로 지우고, 그사이 동의·기한 연장은 건너뜀 (응답은 수만)', async () => {
    mocks.ids = ['a', 'b', 'c'];
    mocks.rows = {
      a: expired,
      b: { ...expired, guardian_consented_at: '2026-11-01T00:00:00Z' },
      c: { ...expired, consent_deadline: '2999-01-01T00:00:00Z' },
    };
    const res = await call('Bearer test-secret');
    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      dry: false,
      candidates: 3,
      deleted: 1,
      skipped: 2,
      failed: 0,
      more: false,
    });
    expect(mocks.deleteUserAccount).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUserAccount.mock.calls[0][1]).toBe('a');
    expect(JSON.stringify(json)).not.toContain('"a"');
  });

  it('dry=1 이면 세기만', async () => {
    mocks.ids = ['a'];
    mocks.rows = { a: expired };
    const json = await (await call('Bearer test-secret', '?dry=1')).json();
    expect(json).toMatchObject({ dry: true, candidates: 1, deleted: 0 });
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });
});
