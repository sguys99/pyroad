import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  exchangeCodeForSession,
  getUser,
  reportServerError,
  revokeNaver,
  analyticsDb,
} = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn<
    (code: string) => Promise<{
      data?: { user: Record<string, unknown> | null };
      error: (Error & { code?: string }) | null;
    }>
  >(async () => ({
    error: null,
  })),
  getUser: vi.fn<
    () => Promise<{ data: { user: Record<string, unknown> | null } }>
  >(async () => ({ data: { user: null } })),
  reportServerError: vi.fn(),
  revokeNaver: vi.fn(async () => 'ok' as const),
  analyticsDb: { current: null as unknown as FakeAnalyticsDb },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession, getUser },
  })),
}));
vi.mock('@/lib/api/serverError', () => ({ reportServerError }));
vi.mock('@/lib/auth/providerUnlink', () => ({ revokeNaver }));
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

  it('code가 없거나 교환에 실패하면 실패 안내로 (P3-10, 아래 절)', async () => {
    expect((await callback('')).headers.get('location')).toBe(
      `${origin}/?login_error=unknown`,
    );
    exchangeCodeForSession.mockResolvedValueOnce({ error: new Error('bad') });
    expect((await callback('code=abc')).headers.get('location')).toBe(
      `${origin}/?login_error=unknown`,
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

describe('GET /auth/callback — 실패·취소·동의 거부 사유 (P3-10)', () => {
  const location = async (query: string) =>
    (await callback(query)).headers.get('location');
  const authError = (code: string, name = 'AuthApiError') =>
    Object.assign(new Error('raw GoTrue message'), { code, name });

  it.each([
    // 취소·동의 거부 (provider 표준 값)
    ['error=access_denied&error_description=User+denied+access', 'cancelled'],
    [
      'error=access_denied&error_code=access_denied&error_description=Canceled+By+User',
      'cancelled',
    ],
    // 연결 충돌 (P3-07 linkIdentity)
    [
      'error=invalid_request&error_code=identity_already_exists&error_description=Identity+is+already+linked',
      'identity_taken',
    ],
    // state 만료·변조
    [
      'error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+parameter+missing',
      'expired',
    ],
    ['error=invalid_request&error_code=bad_oauth_callback', 'expired'],
    ['error=invalid_request&error_code=flow_state_expired', 'expired'],
    // 재전송
    ['error=invalid_request&error_code=flow_state_already_used', 'reused'],
    // 설정 오류 (Kakao email_optional 꺼짐 등)
    [
      'error=server_error&error_description=Error+getting+user+email+from+external+provider',
      'unavailable',
    ],
    ['error=invalid_request&error_code=provider_disabled', 'unavailable'],
    ['error=unauthorized_client', 'unknown'],
  ])('%s → %s', async (query, reason) => {
    expect(await location(`${query}&via=kakao`)).toBe(
      `${origin}/?login_error=${reason}&via=kakao`,
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each([
    [
      'pkce_code_verifier_not_found',
      'AuthPKCECodeVerifierMissingError',
      'other_browser',
    ],
    ['bad_code_verifier', 'AuthApiError', 'other_browser'],
    ['flow_state_expired', 'AuthApiError', 'expired'],
    ['flow_state_not_found', 'AuthApiError', 'reused'],
    ['unexpected_failure', 'AuthApiError', 'unavailable'],
    ['something_new', 'AuthApiError', 'unknown'],
  ])('교환 오류 %s(%s) → %s', async (code, name, reason) => {
    exchangeCodeForSession.mockResolvedValueOnce({
      error: authError(code, name),
    });
    expect(await location('code=abc&via=google')).toBe(
      `${origin}/?login_error=${reason}&via=google`,
    );
  });

  it('재전송인데 첫 요청이 이미 로그인시켰으면 next로 그대로', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      error: authError('flow_state_not_found'),
    });
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
    expect(
      await location(`code=abc&next=${encodeURIComponent('/settings')}`),
    ).toBe(`${origin}/settings`);
  });

  it('다른 화면에서 시작한 흐름(next 있음, 계정 연결)은 /auth/error 안내로, next는 safeNext 그대로', async () => {
    expect(
      await location(
        `error=invalid_request&error_code=identity_already_exists&via=naver&next=${encodeURIComponent('/settings?tab=account')}`,
      ),
    ).toBe(
      `${origin}/auth/error?reason=identity_taken&via=naver&next=%2Fsettings%3Ftab%3Daccount`,
    );
    // 공격 next는 /world → 랜딩 안내
    expect(
      await location(
        `error=access_denied&next=${encodeURIComponent('//evil.com')}`,
      ),
    ).toBe(`${origin}/?login_error=cancelled`);
  });

  it('via는 짧은 이름 3종만 (모르는 값은 버림)', async () => {
    expect(await location('error=access_denied&via=github')).toBe(
      `${origin}/?login_error=cancelled`,
    );
  });

  it('원문(error_description)은 주소에 싣지 않고, 설정 오류·모르는 오류만 코드 이름으로 보고', async () => {
    const loc = await location(
      'error=server_error&error_description=Error+getting+user+email+kid%40example.com',
    );
    expect(loc).not.toContain('example');
    expect(loc).not.toContain('Error');
    expect(reportServerError).toHaveBeenCalledTimes(1);
    const [err, tags] = reportServerError.mock.calls[0];
    expect(String(err)).toBe('Error: login_error unavailable (server_error)');
    expect(tags).toEqual({ area: 'auth', op: 'callback' });

    reportServerError.mockClear();
    await location('error=access_denied');
    exchangeCodeForSession.mockResolvedValueOnce({
      error: authError('pkce_code_verifier_not_found'),
    });
    await location('code=abc');
    expect(reportServerError).not.toHaveBeenCalled();
  });
});

describe('GET /auth/callback — 탈퇴 직전 네이버 재인증 (P3-16)', () => {
  const NAVER_USER = {
    id: 'u1',
    user_metadata: { iss: 'https://nid.naver.com' },
    created_at: '2026-01-01T00:00:00Z',
    last_sign_in_at: '2026-11-06T00:00:00Z',
  };
  const withdraw = `code=abc&via=naver&next=${encodeURIComponent('/profile?withdraw=naver')}`;

  it('네이버 기존 사용자면 세션의 provider 토큰으로 폐기하고 결과와 함께 프로필로 (삭제는 하지 않음)', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        user: NAVER_USER,
        session: { provider_refresh_token: 'rt', provider_token: 'at' },
      },
      error: null,
    } as never);
    revokeNaver.mockResolvedValueOnce('ok');
    const res = await callback(withdraw);
    expect(revokeNaver).toHaveBeenCalledWith({
      refreshToken: 'rt',
      accessToken: 'at',
    });
    expect(res.headers.get('location')).toBe(
      `${origin}/profile?withdraw=naver&naver=ok`,
    );
  });

  it.each([
    [
      '네이버가 아닌 로그인',
      { ...NAVER_USER, user_metadata: { iss: 'https://accounts.google.com' } },
    ],
    // 다른 네이버 계정으로 로그인해 새 계정이 막 만들어짐
    [
      '방금 만들어진 계정',
      { ...NAVER_USER, created_at: '2026-11-06T00:00:00Z' },
    ],
  ])('%s → 폐기하지 않고 mismatch', async (_, user) => {
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { user, session: { provider_refresh_token: 'rt' } },
      error: null,
    } as never);
    const res = await callback(withdraw);
    expect(revokeNaver).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe(
      `${origin}/profile?withdraw=naver&naver=mismatch`,
    );
  });

  it('평범한 로그인(next 없음)에서는 폐기하지 않음', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: NAVER_USER, session: { provider_refresh_token: 'rt' } },
      error: null,
    } as never);
    await callback('code=abc');
    expect(revokeNaver).not.toHaveBeenCalled();
  });

  it('재인증을 취소하면 /auth/error → 돌아가기가 탈퇴 화면(next) 그대로', async () => {
    expect(
      (
        await callback(
          `error=access_denied&via=naver&next=${encodeURIComponent('/profile?withdraw=naver')}`,
        )
      ).headers.get('location'),
    ).toBe(
      `${origin}/auth/error?reason=cancelled&via=naver&next=%2Fprofile%3Fwithdraw%3Dnaver`,
    );
  });
});
