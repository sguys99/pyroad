import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { exchangeCodeForSession, analyticsDb } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn<
    (code: string) => Promise<{
      data?: { user: Record<string, unknown> | null };
      error: Error | null;
    }>
  >(async () => ({
    error: null,
  })),
  analyticsDb: { current: null as unknown as FakeAnalyticsDb },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => analyticsDb.current.client,
}));

import { GET } from '../route';
import {
  fakeAnalyticsDb,
  type FakeAnalyticsDb,
} from '@/lib/analytics/__tests__/fakeAnalyticsDb';
import { anonymizeUserId } from '@/lib/analytics/server';

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

describe('GET /auth/callback — 로그인 성공 분석 이벤트 (P1-17)', () => {
  const SALT = 'callback-test-salt-0123456789abcdefghijkl';
  const U1 = '11111111-1111-1111-1111-111111111111';
  const user = (created: string, signedIn: string) => ({
    id: U1,
    created_at: created,
    last_sign_in_at: signedIn,
    app_metadata: { provider: 'google' },
    user_metadata: {
      iss: 'https://accounts.google.com',
      email: 'kid@example.com',
      full_name: '김철수',
    },
  });

  beforeEach(() => {
    analyticsDb.current = fakeAnalyticsDb();
    vi.stubEnv('ANALYTICS_SALT', SALT);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('서버가 login_success 를 기록 (가입 직후면 new_user, 사용자당 한 번). 이메일·이름은 남기지 않음', async () => {
    const signup = user('2026-11-04T01:00:00Z', '2026-11-04T01:00:02Z');
    exchangeCodeForSession.mockResolvedValue({
      data: { user: signup },
      error: null,
    });
    const res = await callback('code=abc', {
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile',
    });
    // 최근 로그인 배지 조각이 붙는다 (P3-08)
    expect(res.headers.get('location')).toBe(`${origin}/world#lp=google`);
    await vi.waitFor(() => expect(analyticsDb.current.rows).toHaveLength(1));
    expect(analyticsDb.current.rows[0]).toEqual({
      name: 'login_success',
      actor: 'user',
      anon_id: anonymizeUserId(U1, SALT),
      source: 'server',
      props: { provider: 'google', new_user: true },
      device: 'mobile',
      path: '/auth/callback',
      dedupe_key: 'login_success:new_user',
    });
    const stored = JSON.stringify(analyticsDb.current.rows);
    expect(stored).not.toContain('kid@example.com');
    expect(stored).not.toContain('김철수');
    expect(stored).not.toContain(U1);

    // 다음 날 다시 로그인: new_user 아님, dedupe 없음
    exchangeCodeForSession.mockResolvedValue({
      data: { user: user('2026-11-04T01:00:00Z', '2026-11-05T09:00:00Z') },
      error: null,
    });
    await callback('code=def');
    await vi.waitFor(() => expect(analyticsDb.current.rows).toHaveLength(2));
    expect(analyticsDb.current.rows[1]).toMatchObject({
      props: { provider: 'google', new_user: false },
      dedupe_key: null,
    });
  });

  it('교환에 실패하면 기록하지 않음', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: new Error('bad') });
    await callback('code=abc');
    await new Promise((r) => setTimeout(r, 10));
    expect(analyticsDb.current.upserts).toHaveLength(0);
  });
});

describe('GET /auth/callback — 최근 로그인 배지 #lp= (P3-08)', () => {
  const withUser = (user: Record<string, unknown>) =>
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { user },
      error: null,
    });

  it.each([
    ['https://kapi.kakao.com', 'kakao'],
    ['https://nid.naver.com', 'naver'],
    ['https://accounts.google.com', 'google'],
  ])('user_metadata.iss %s → 리다이렉트 주소에 #lp=%s', async (iss, lp) => {
    withUser({ user_metadata: { iss }, identities: [] });
    const res = await callback(
      `code=abc&next=${encodeURIComponent('/settings?tab=account')}`,
    );
    expect(res.headers.get('location')).toBe(
      `${origin}/settings?tab=account#lp=${lp}`,
    );
  });

  it('공격 next는 여전히 /world (조각만 붙음)', async () => {
    withUser({ user_metadata: { iss: 'https://kapi.kakao.com' } });
    const res = await callback(
      `code=abc&next=${encodeURIComponent('//evil.com')}`,
    );
    expect(res.headers.get('location')).toBe(`${origin}/world#lp=kakao`);
  });

  it('provider를 모르면(iss 없음 + 연결 2개) 조각 없이', async () => {
    withUser({
      user_metadata: {},
      identities: [{ provider: 'google' }, { provider: 'kakao' }],
    });
    const res = await callback('code=abc');
    expect(res.headers.get('location')).toBe(`${origin}/world`);
  });

  it('next에 이미 조각이 있으면 건드리지 않음', async () => {
    withUser({ user_metadata: { iss: 'https://accounts.google.com' } });
    const res = await callback(
      `code=abc&next=${encodeURIComponent('/notice#top')}`,
    );
    expect(res.headers.get('location')).toBe(`${origin}/notice#top`);
  });
});
