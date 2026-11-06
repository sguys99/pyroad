// 소셜 로그인 목업 (P3-17). 실제 provider·GoTrue provider 왕복 없이 로그인 화면 → 콜백 → 관문 → 월드맵을 브라우저로 시험한다.
//
// 어떻게: 앱이 `signInWithOAuth`(P1-14 헬퍼)로 이동하는 GoTrue `…/auth/v1/authorize?provider=…` 요청을 Playwright가 가로챈다.
// - 요청 자체는 진짜다: provider 이름(`custom:naver`), PKCE(`code_challenge`, S256), `redirect_to`(같은 출처 `/auth/callback`
//   + `via`), Kakao scope 덮어쓰기(`scope=` 빈 값), Android 네이버 `appscheme`를 검사(`checkAuthorizeRequest`)한다
// - 그 뒤 provider 쪽 결과를 흉내 낸다:
//   success      → 미리 만든 로컬 사용자로 세션 쿠키를 넣고, `/auth/callback`이 성공했을 때 보낼 주소(`next` + `#lp=<provider>`)로 302
//   cancel       → 진짜 `/auth/callback?…&error=access_denied` (취소·동의 거부: 콜백의 P3-10 사유 처리를 그대로 탄다)
//   server_error → 진짜 `/auth/callback?…&error=server_error&error_description=Error getting user email…` (설정 오류)
//   bad_state    → GoTrue처럼 Site URL `/`에 `error_code=bad_oauth_state` (콜백을 거치지 않는 경로)
//
// 시험하지 않는 것 (다른 곳에서 확인): provider ↔ GoTrue 토큰 교환과 identity 생성, `/auth/callback`의 code 교환 성공 경로.
// → 콜백 단위 테스트(src/app/auth/callback/__tests__), 실 앱 스모크(docs/release/v0.4-phase3-providers.md §9 K-·N-·L-),
//   P0-03·P0-04 스파이크 실험실(spikes/p0-03-naver, spikes/p0-04-kakao/e2e: 실제 GoTrue + 목업 provider).
// 이 파일의 순수 함수는 Node만으로 단위 테스트한다(e2e/support/__tests__/oauthMock.test.ts, vitest).

import type { Page, Route } from '@playwright/test';
import { withLastLoginFragment } from '../../src/lib/auth/lastLogin';

export type MockProvider = 'kakao' | 'naver' | 'google';
export type MockOutcome = 'success' | 'cancel' | 'server_error' | 'bad_state';

/** GoTrue provider 이름 → 짧은 이름 (`custom:naver` → naver) */
const GOTRUE_PROVIDER: Record<string, MockProvider> = {
  kakao: 'kakao',
  'custom:naver': 'naver',
  google: 'google',
};

export interface AuthorizeRequest {
  /** GoTrue에 보낸 provider 이름 그대로 (예: custom:naver) */
  rawProvider: string | null;
  provider: MockProvider | null;
  /** 앱 콜백 주소 (`redirect_to`) */
  redirectTo: string | null;
  /** redirect_to 의 via·next */
  via: string | null;
  next: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  /** Kakao scope 덮어쓰기 (null = 키 없음, '' = 빈 값) */
  scope: string | null;
  appscheme: string | null;
}

export function parseAuthorizeRequest(url: string): AuthorizeRequest {
  const u = new URL(url);
  const q = u.searchParams;
  const rawProvider = q.get('provider');
  const redirectTo = q.get('redirect_to');
  let via: string | null = null;
  let next: string | null = null;
  if (redirectTo) {
    try {
      const r = new URL(redirectTo);
      via = r.searchParams.get('via');
      next = r.searchParams.get('next');
    } catch {
      // checkAuthorizeRequest가 문제로 보고
    }
  }
  return {
    rawProvider,
    provider: rawProvider ? (GOTRUE_PROVIDER[rawProvider] ?? null) : null,
    redirectTo,
    via,
    next,
    codeChallenge: q.get('code_challenge'),
    codeChallengeMethod: q.get('code_challenge_method'),
    scope: q.get('scope'),
    appscheme: q.get('appscheme'),
  };
}

/**
 * 앱이 보낸 authorize 요청이 P1-14·P3-09·P3-10 규칙대로인지. 문제 목록(빈 배열이면 통과)
 * @param expect.android Android 기기면 네이버에 appscheme=true가 있어야 함
 */
export function checkAuthorizeRequest(
  req: AuthorizeRequest,
  {
    baseURL,
    provider,
    android = false,
  }: { baseURL: string; provider: MockProvider; android?: boolean },
): string[] {
  const problems: string[] = [];
  if (req.provider !== provider)
    problems.push(`provider ${req.rawProvider} (기대 ${provider})`);
  if (provider === 'naver' && req.rawProvider !== 'custom:naver')
    problems.push('네이버는 커스텀 OIDC provider custom:naver');
  if (!req.codeChallenge) problems.push('PKCE code_challenge 없음');
  if ((req.codeChallengeMethod ?? '').toLowerCase() !== 's256')
    problems.push(`code_challenge_method ${req.codeChallengeMethod}`);
  if (!req.redirectTo) {
    problems.push('redirect_to 없음');
  } else {
    const r = new URL(req.redirectTo);
    if (r.origin !== new URL(baseURL).origin)
      problems.push(`redirect_to 출처 ${r.origin}`);
    if (r.pathname !== '/auth/callback')
      problems.push(`redirect_to 경로 ${r.pathname}`);
  }
  if (req.via !== provider) problems.push(`via ${req.via} (기대 ${provider})`);
  if (provider === 'kakao' && req.scope !== '')
    problems.push(
      `Kakao scope 덮어쓰기 ${JSON.stringify(req.scope)} (기대 빈 값, KOE205 방지)`,
    );
  if (provider !== 'kakao' && req.scope !== null)
    problems.push(`${provider}에 scope 덮어쓰기가 붙음`);
  const wantAppscheme = provider === 'naver' && android;
  if (wantAppscheme && req.appscheme !== 'true')
    problems.push('Android 네이버에 appscheme=true 없음');
  if (!wantAppscheme && req.appscheme !== null)
    problems.push(`appscheme이 붙음 (${provider}, android=${android})`);
  return problems;
}

const DEFAULT_NEXT = '/world';

/** 결과별 302 주소 (절대 주소) */
export function mockRedirectLocation(
  outcome: MockOutcome,
  req: AuthorizeRequest,
  baseURL: string,
): string {
  const base = baseURL.replace(/\/$/, '');
  switch (outcome) {
    case 'success':
      // /auth/callback 성공 경로와 같은 모양 (next는 앱이 safeNext로 다시 검사하므로 여기서는 기본값만 채움)
      return `${base}${withLastLoginFragment(req.next ?? DEFAULT_NEXT, req.provider)}`;
    case 'bad_state':
      return `${base}/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+parameter+missing`;
    case 'cancel':
    case 'server_error': {
      const r = new URL(req.redirectTo ?? `${base}/auth/callback`);
      if (outcome === 'cancel') {
        r.searchParams.set('error', 'access_denied');
        r.searchParams.set('error_description', 'User denied access');
      } else {
        r.searchParams.set('error', 'server_error');
        r.searchParams.set(
          'error_description',
          'Error getting user email from external provider',
        );
      }
      return r.toString();
    }
  }
}

export interface OAuthMockHandle {
  /** 가로챈 authorize 요청 (순서대로) */
  requests: AuthorizeRequest[];
  /** 마지막 요청의 규칙 위반 목록 */
  problems: () => string[];
}

/**
 * 이 페이지의 GoTrue authorize 이동을 가로채 결과를 흉내 낸다.
 * @param signIn success일 때 브라우저에 넣을 세션 쿠키를 만든다(로컬 사용자 비밀번호 로그인, support/socialUsers.ts)
 */
export async function installOAuthMock(
  page: Page,
  {
    supabaseUrl,
    baseURL,
    provider,
    outcome,
    android = false,
    signIn,
  }: {
    supabaseUrl: string;
    baseURL: string;
    provider: MockProvider;
    outcome: MockOutcome;
    android?: boolean;
    signIn?: () => Promise<{ name: string; value: string }[]>;
  },
): Promise<OAuthMockHandle> {
  const requests: AuthorizeRequest[] = [];
  const authorize = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/authorize`;
  await page.route(
    (url) => `${url.origin}${url.pathname}` === authorize,
    async (route: Route) => {
      const req = parseAuthorizeRequest(route.request().url());
      requests.push(req);
      if (outcome === 'success') {
        if (!signIn)
          throw new Error('[e2e] success 목업에는 signIn이 필요해요');
        const cookies = await signIn();
        await page.context().addCookies(
          cookies.map((c) => ({
            ...c,
            url: baseURL,
            sameSite: 'Lax' as const,
          })),
        );
      }
      await route.fulfill({
        status: 302,
        headers: { location: mockRedirectLocation(outcome, req, baseURL) },
      });
    },
  );
  return {
    requests,
    problems: () =>
      requests.length === 0
        ? ['authorize 요청이 없음']
        : checkAuthorizeRequest(requests[requests.length - 1], {
            baseURL,
            provider,
            android,
          }),
  };
}
