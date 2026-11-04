import { describe, it, expect, vi, beforeEach } from 'vitest';

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn<
    (code: string) => Promise<{ error: Error | null }>
  >(async () => ({
    error: null,
  })),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
}));

import { GET } from '../route';

const origin = 'http://localhost:3000';

function callback(query: string, headers?: Record<string, string>) {
  return GET(new Request(`${origin}/auth/callback?${query}`, { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /auth/callback — next 검증 (B23)', () => {
  it('next가 없으면 /world', async () => {
    const res = await callback('code=abc');
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(res.headers.get('location')).toBe(`${origin}/world`);
  });

  it('같은 출처 경로는 그대로', async () => {
    const res = await callback(
      `code=abc&next=${encodeURIComponent('/settings?tab=account')}`,
    );
    expect(res.headers.get('location')).toBe(`${origin}/settings?tab=account`);
  });

  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    '%2F%2Fevil.com',
    '/%2F%2Fevil.com',
    '@evil.com',
    '.evil.com',
  ])('공격 값 %s 는 /world로', async (next) => {
    const res = await callback(`code=abc&next=${encodeURIComponent(next)}`);
    const location = res.headers.get('location')!;
    expect(new URL(location).origin).toBe(origin);
    expect(location).toBe(`${origin}/world`);
  });

  it('배포 환경(x-forwarded-host)에서도 출처를 벗어나지 않음', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const res = await callback(
        `code=abc&next=${encodeURIComponent('//evil.com')}`,
        {
          'x-forwarded-host': 'pyroad.vercel.app',
        },
      );
      expect(res.headers.get('location')).toBe(
        'https://pyroad.vercel.app/world',
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('code가 없거나 교환에 실패하면 /?error=auth', async () => {
    expect((await callback('next=/settings')).headers.get('location')).toBe(
      `${origin}/?error=auth`,
    );
    exchangeCodeForSession.mockResolvedValueOnce({ error: new Error('bad') });
    expect((await callback('code=abc')).headers.get('location')).toBe(
      `${origin}/?error=auth`,
    );
  });
});
