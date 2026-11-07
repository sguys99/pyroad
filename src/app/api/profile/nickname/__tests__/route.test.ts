import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
  reportServerError: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('@/lib/api/serverError', () => ({
  reportServerError: mocks.reportServerError,
}));
vi.mock('@/lib/observability/server', () => ({ captureServerError: vi.fn() }));

import { GET } from '../route';

const get = (name: string) =>
  GET(
    new Request(
      `http://localhost/api/profile/nickname?name=${encodeURIComponent(name)}`,
    ),
  );

let taken = new Set<string>();
beforeEach(() => {
  mocks.user = { id: 'u1' };
  taken = new Set(['코딩왕']);
  mocks.rpc.mockReset();
  mocks.reportServerError.mockClear();
  mocks.rpc.mockImplementation(
    async (fn: string, args: Record<string, string>) => {
      if (fn === 'consume_rate_limit')
        return { data: { allowed: true }, error: null };
      if (fn === 'is_nickname_taken')
        return { data: taken.has(args.p_nickname.toLowerCase()), error: null };
      throw new Error(fn);
    },
  );
});

describe('GET /api/profile/nickname (P3-11)', () => {
  it('비어 있으면 ok + 저장할 모양(NFC·앞뒤 공백 제거)', async () => {
    const res = await get('  별빛코더 ');
    expect(await res.json()).toEqual({ ok: true, nickname: '별빛코더' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.rpc).toHaveBeenCalledWith('is_nickname_taken', {
      p_nickname: '별빛코더',
      p_user_id: 'u1',
    });
  });

  it('중복이면 taken + 숫자 붙인 추천', async () => {
    const json = await (await get('코딩왕')).json();
    expect(json).toMatchObject({ ok: false, reason: 'taken' });
    expect(json.suggestion).toMatch(/^코딩왕\d{2}$/);
  });

  it('글자 규칙·금칙어는 DB 를 부르지 않고 안내 (어떤 말인지 알려 주지 않음)', async () => {
    const rule = await (await get('ㄱㄴ')).json();
    expect(rule).toMatchObject({ ok: false, reason: 'jamo', char: 'ㄱ' });
    const banned = await (await get('fuckyou')).json();
    expect(banned).toMatchObject({ ok: false, reason: 'banned' });
    expect(JSON.stringify(banned)).not.toContain('moderation');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('로그인 안 함 → 401 · 한도 → 429 · DB 오류 → 500 일반 문구', async () => {
    mocks.user = null;
    expect((await get('별빛코더')).status).toBe(401);
    mocks.user = { id: 'u1' };
    mocks.rpc.mockImplementationOnce(async () => ({
      data: { allowed: false, retry_after: 9 },
      error: null,
    }));
    const limited = await get('별빛코더');
    expect(limited.status).toBe(429);
    expect((await limited.json()).reason).toBe('rate_limited');
    mocks.rpc.mockImplementation(async (fn: string) =>
      fn === 'consume_rate_limit'
        ? { data: { allowed: true }, error: null }
        : { data: null, error: { code: 'XX', message: 'secret' } },
    );
    const broken = await get('별빛코더');
    expect(broken.status).toBe(500);
    expect(JSON.stringify(await broken.json())).not.toContain('secret');
    expect(mocks.reportServerError).toHaveBeenCalledTimes(1);
  });
});
