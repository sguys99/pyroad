// 소셜 로그인 세 갈래 (P3-17): 로그인 시트 → (목업) provider → 콜백 → 온보딩 관문 → 월드맵, 최근 로그인 배지.
// 실패 안내·인앱 브라우저는 스택 없이 도는 e2e/public/social-login.spec.ts (CI e2e-smoke).
//
// provider 왕복은 Playwright가 GoTrue authorize 이동을 가로채 흉내 낸다(support/oauthMock.ts — 방식과 한계는 e2e/README.md "소셜 로그인 목업").
// 앱이 보내는 authorize 요청(provider 이름·PKCE·쿼리 없는 redirect_to·Kakao scope·Android 네이버 appscheme)은 진짜이고 매번 검사한다.
// 로그인 상태를 쓰지 않으므로 공용 사용자의 storageState를 비우고, 성공 시나리오마다 새 로컬 사용자를 만든다(로그인 4번).

import { test, expect, type Page } from '@playwright/test';
import { requireLocalStack } from './support/env';
import { watchCspViolations } from './support/test';
import { installOAuthMock } from './support/oauthMock';
import { createSocialUser, deleteSocialUsers } from './support/socialUsers';

test.use({ storageState: { cookies: [], origins: [] } });

let violations: string[] = [];

test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});
test.afterAll(async () => {
  await deleteSocialUsers();
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

async function lastLoginProvider(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('pyroad.lastLogin.v1');
    return raw ? (JSON.parse(raw) as { provider: string }).provider : null;
  });
}

test.describe('로그인 세 갈래 → 콜백 → 관문 (목업 provider)', () => {
  for (const provider of ['kakao', 'naver', 'google'] as const) {
    test(`${provider}: 새 사용자는 온보딩 관문으로, 최근 로그인 수단을 이 기기에 저장`, async ({
      page,
      baseURL,
    }) => {
      violations = await watchCspViolations(page);
      const stack = requireLocalStack();
      const user = await createSocialUser({ onboarded: false });
      const mock = await installOAuthMock(page, {
        supabaseUrl: stack.url,
        baseURL: baseURL!,
        provider,
        outcome: 'success',
        signIn: user.signIn,
      });

      const sheet = await openSheet(page);
      await sheet.getByTestId(`social-login-${provider}`).click();

      await expect(page).toHaveURL(/\/onboarding/);
      expect(mock.problems(), 'authorize 요청 (P1-14 헬퍼 규칙)').toEqual([]);
      await expect.poll(() => lastLoginProvider(page)).toBe(provider);
      // #lp= 조각은 저장 뒤 지워진다
      await expect
        .poll(() => page.evaluate(() => window.location.hash))
        .toBe('');
    });
  }

  test('온보딩을 끝낸 사용자는 월드맵으로, 로그아웃 뒤 시트에서 그 수단이 맨 위 + "최근에 사용"', async ({
    page,
    baseURL,
  }) => {
    violations = await watchCspViolations(page);
    const stack = requireLocalStack();
    const user = await createSocialUser({ onboarded: true });
    const mock = await installOAuthMock(page, {
      supabaseUrl: stack.url,
      baseURL: baseURL!,
      provider: 'naver',
      outcome: 'success',
      signIn: user.signIn,
    });

    const sheet = await openSheet(page);
    await sheet.getByTestId('social-login-naver').click();
    await expect(page).toHaveURL(/\/world$/);
    await expect(
      page.getByRole('heading', { name: '모험 지도' }),
    ).toBeVisible();
    expect(mock.problems()).toEqual([]);

    // 로그아웃(쿠키만 지움, 기기 저장값은 남음) → 랜딩
    await page.context().clearCookies();
    await openSheet(page);
    expect(await sheetOrder(page)).toEqual(['naver', 'kakao', 'google']);
    const naver = page.getByTestId('social-login-naver');
    await expect(naver).toHaveAttribute('data-recent', 'true');
    await expect(naver).toHaveAccessibleDescription(
      '최근에 네이버로 로그인했어요',
    );
    await expect(page.getByTestId('login-sheet-hint')).toContainText(
      '지난번엔 네이버로 들어왔어',
    );
  });
});
