// 소셜 로그인 실패 안내·인앱 브라우저 (P3-17, 비로그인 `public` 프로젝트 → CI e2e-smoke). 로컬 Supabase 없이 돈다:
// GoTrue authorize 이동을 가로채(support/oauthMock.ts) provider 결과를 흉내 내고, 실패 경로는 진짜 `/auth/callback`을 탄다.
// 로그인 성공 경로(세션이 필요)는 로그인 스펙 e2e/social-login.spec.ts. 방식과 한계는 e2e/README.md "소셜 로그인 목업".

import { test, expect, type Browser, type Page } from '@playwright/test';
import { appSupabaseUrl } from '../support/env';
import { watchCspViolations } from '../support/test';
import {
  installOAuthMock,
  type MockOutcome,
  type MockProvider,
} from '../support/oauthMock';

const UA = {
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36;KAKAOTALK 2410520',
  instagramIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 352.0.0.24.98 (iPhone16,1; iOS 17_6; ko_KR; ko; scale=3.00; 1179x2556; 646318484)',
};

let violations: string[] = [];
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

async function openSheet(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /모험 시작하기/ }).click();
  const sheet = page.getByTestId('login-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}

async function sheetOrder(page: Page): Promise<string[]> {
  return page
    .getByTestId('login-sheet')
    .locator('[data-provider]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-provider')!));
}

async function mobileContext(browser: Browser, userAgent: string) {
  const context = await browser.newContext({
    userAgent,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
  });
  const page = await context.newPage();
  violations = await watchCspViolations(page);
  return { context, page };
}

test.describe('실패·취소 안내 (P3-10)', () => {
  const cases: {
    provider: MockProvider;
    outcome: MockOutcome;
    title: string;
  }[] = [
    {
      provider: 'naver',
      outcome: 'cancel',
      title: '네이버 로그인을 그만뒀구나',
    },
    {
      provider: 'kakao',
      outcome: 'server_error',
      title: '지금은 카카오 로그인을 쓸 수 없어',
    },
  ];
  for (const { provider, outcome, title } of cases) {
    test(`${provider} ${outcome} → 진짜 콜백 → 랜딩 시트가 저절로 열려 안내`, async ({
      page,
      baseURL,
    }) => {
      violations = await watchCspViolations(page);
      const mock = await installOAuthMock(page, {
        supabaseUrl: appSupabaseUrl(),
        baseURL: baseURL!,
        provider,
        outcome,
      });
      const sheet = await openSheet(page);
      await sheet.getByTestId(`social-login-${provider}`).click();

      await expect(page.getByRole('dialog', { name: title })).toBeVisible();
      expect(mock.problems()).toEqual([]);
      // login_error 는 주소에서 지워진다 (시도한 수단은 sessionStorage, B43)
      await expect
        .poll(() => page.evaluate(() => window.location.search))
        .toBe('');
      // 버튼은 그대로라 바로 다시 해 볼 수 있다
      await expect(page.getByTestId(`social-login-${provider}`)).toBeEnabled();
    });
  }

  test('GoTrue가 Site URL로 바로 보낸 bad_oauth_state도 안내', async ({
    page,
  }) => {
    violations = await watchCspViolations(page);
    await page.goto(
      '/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+parameter+missing',
    );
    await expect(
      page.getByRole('dialog', { name: '로그인 시간이 지났어' }),
    ).toBeVisible();
  });
});

test.describe('인앱 브라우저 (P3-09)', () => {
  test('카카오톡(Android): 카카오가 맨 위에 크게, Google 안내 한 줄, 네이버는 인앱 그대로 + appscheme', async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await mobileContext(browser, UA.kakaoAndroid);
    try {
      const mock = await installOAuthMock(page, {
        supabaseUrl: appSupabaseUrl(),
        baseURL: baseURL!,
        provider: 'naver',
        outcome: 'cancel',
        android: true,
      });
      await openSheet(page);
      expect((await sheetOrder(page))[0]).toBe('kakao');
      await expect(page.getByTestId('social-login-kakao')).toHaveAttribute(
        'data-size',
        'lg',
      );
      await expect(page.getByTestId('social-login-inapp-note')).toBeVisible();

      await page.getByTestId('social-login-naver').click();
      await expect(
        page.getByRole('dialog', { name: '네이버 로그인을 그만뒀구나' }),
      ).toBeVisible();
      expect(
        mock.problems(),
        '인앱에서도 외부로 보내지 않고 appscheme',
      ).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('외부 브라우저를 열 수 없는 인앱(iOS 인스타그램)에서 Google → 안내 + 앱 안에서 되는 카카오', async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await mobileContext(browser, UA.instagramIOS);
    try {
      const mock = await installOAuthMock(page, {
        supabaseUrl: appSupabaseUrl(),
        baseURL: baseURL!,
        provider: 'google',
        outcome: 'cancel',
      });
      await openSheet(page);
      await page.getByTestId('social-login-google').click();
      const guide = page.getByTestId('inapp-guide');
      await expect(guide).toBeVisible();
      await expect(guide).toContainText('앗! 여기서는 Google 로그인이 안 돼요');
      await expect(page.getByTestId('inapp-guide-kakao')).toBeVisible();
      // Google은 signInWithOAuth 전에 멈춘다 (PKCE verifier가 이 웹뷰에 남지 않게)
      expect(mock.requests).toHaveLength(0);
    } finally {
      await context.close();
    }
  });
});
