import { describe, expect, it } from 'vitest';
import {
  checkAuthorizeRequest,
  mockRedirectLocation,
  parseAuthorizeRequest,
} from '../oauthMock';
import { getOAuthCredentials } from '../../../src/lib/auth/socialLogin';

// e2e 소셜 로그인 목업의 순수 함수 (P3-17). 앱의 진짜 인자(getOAuthCredentials)로 만든 authorize 주소를 검사해
// 목업이 앱 규칙과 어긋나지 않는지 Node만으로 확인한다

const SUPABASE = 'http://127.0.0.1:54521';
const BASE = 'http://localhost:3100';

/** supabase-js가 만드는 authorize 주소와 같은 모양 */
function authorizeUrl(
  provider: 'kakao' | 'naver' | 'google',
  { android = false, next }: { android?: boolean; next?: string } = {},
): string {
  const creds = getOAuthCredentials(provider, {
    origin: BASE,
    next,
    device: { isAndroid: android },
  });
  const q = new URLSearchParams({
    provider: creds.provider,
    redirect_to: creds.options!.redirectTo!,
    code_challenge: 'abc123',
    code_challenge_method: 's256',
  });
  for (const [k, v] of Object.entries(creds.options?.queryParams ?? {}))
    q.set(k, v);
  return `${SUPABASE}/auth/v1/authorize?${q}`;
}

describe('parseAuthorizeRequest · checkAuthorizeRequest', () => {
  it.each(['kakao', 'naver', 'google'] as const)(
    '%s: 앱의 진짜 인자는 규칙을 모두 통과',
    (provider) => {
      const req = parseAuthorizeRequest(authorizeUrl(provider));
      expect(req.provider).toBe(provider);
      expect(req.via).toBe(provider);
      expect(checkAuthorizeRequest(req, { baseURL: BASE, provider })).toEqual(
        [],
      );
    },
  );

  it('네이버는 custom:naver, Android면 appscheme=true까지', () => {
    const req = parseAuthorizeRequest(authorizeUrl('naver', { android: true }));
    expect(req.rawProvider).toBe('custom:naver');
    expect(
      checkAuthorizeRequest(req, {
        baseURL: BASE,
        provider: 'naver',
        android: true,
      }),
    ).toEqual([]);
    // Android인데 appscheme이 없으면 문제
    const desktop = parseAuthorizeRequest(authorizeUrl('naver'));
    expect(
      checkAuthorizeRequest(desktop, {
        baseURL: BASE,
        provider: 'naver',
        android: true,
      }),
    ).toContain('Android 네이버에 appscheme=true 없음');
  });

  it('규칙 위반을 잡는다: PKCE 없음, Kakao scope 키 빠짐(KOE205), 다른 출처', () => {
    const url = new URL(authorizeUrl('kakao'));
    url.searchParams.delete('code_challenge');
    url.searchParams.delete('scope');
    url.searchParams.set(
      'redirect_to',
      'https://evil.test/auth/callback?via=kakao',
    );
    const problems = checkAuthorizeRequest(parseAuthorizeRequest(url.href), {
      baseURL: BASE,
      provider: 'kakao',
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        'PKCE code_challenge 없음',
        'redirect_to 출처 https://evil.test',
        'Kakao scope 덮어쓰기 null (기대 빈 값, KOE205 방지)',
      ]),
    );
  });
});

describe('mockRedirectLocation', () => {
  it('success: 콜백 성공 경로와 같은 next + #lp=', () => {
    expect(
      mockRedirectLocation(
        'success',
        parseAuthorizeRequest(authorizeUrl('google')),
        BASE,
      ),
    ).toBe(`${BASE}/world#lp=google`);
    expect(
      mockRedirectLocation(
        'success',
        parseAuthorizeRequest(authorizeUrl('kakao', { next: '/settings' })),
        BASE,
      ),
    ).toBe(`${BASE}/settings#lp=kakao`);
  });

  it('cancel·server_error: 진짜 콜백 주소에 provider 오류를 붙임 (via 유지)', () => {
    const cancel = new URL(
      mockRedirectLocation(
        'cancel',
        parseAuthorizeRequest(authorizeUrl('naver')),
        BASE,
      ),
    );
    expect(cancel.pathname).toBe('/auth/callback');
    expect(cancel.searchParams.get('via')).toBe('naver');
    expect(cancel.searchParams.get('error')).toBe('access_denied');

    const server = new URL(
      mockRedirectLocation(
        'server_error',
        parseAuthorizeRequest(authorizeUrl('kakao')),
        BASE,
      ),
    );
    expect(server.searchParams.get('error')).toBe('server_error');
    expect(server.searchParams.get('error_description')).toContain(
      'Error getting user email',
    );
  });

  it('bad_state: GoTrue처럼 Site URL로', () => {
    expect(
      mockRedirectLocation(
        'bad_state',
        parseAuthorizeRequest(authorizeUrl('kakao')),
        BASE,
      ),
    ).toBe(
      `${BASE}/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+parameter+missing`,
    );
  });
});
