// 법적 고지 페이지 (P3-14, `public` 프로젝트). 비로그인으로 열리고, 정적 HTML(CSP 정적 정책)에서 스크립트가 막히지 않으며,
// 360px에서 가로 스크롤이 없다. 랜딩 아래 링크로 갈 수 있다.

import { test, expect } from '@playwright/test';
import { watchCspViolations } from '../support/test';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

const PAGES = [
  { path: '/terms', heading: '이용약관', nav: '이용약관' },
  { path: '/privacy', heading: '개인정보처리방침', nav: '개인정보처리방침' },
  { path: '/licenses', heading: '오픈소스·에셋 고지', nav: '오픈소스 고지' },
];

for (const { path, heading, nav } of PAGES) {
  test(`${path}: 비로그인으로 열리고 360px에서 가로 스크롤이 없다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
    // 지금 페이지 표시
    await expect(
      page
        .getByRole('navigation', { name: '약관과 정책' })
        .getByRole('link', { name: nav }),
    ).toHaveAttribute('aria-current', 'page');
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(360);
  });
}

test('개인정보처리방침: 쉬운 말 요약과 목차 이동, 만 14세 미만 절', async ({
  page,
}) => {
  await page.goto('/privacy');
  await expect(
    page.getByRole('heading', { name: '쉬운 말 요약' }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: '목차' })
    .getByRole('link', { name: /만 14세 미만/ })
    .click();
  await expect(page).toHaveURL(/#children$/);
  await expect(
    page.getByRole('heading', { level: 2, name: /만 14세 미만/ }),
  ).toBeInViewport();
});

test('오픈소스 고지: 라이선스 묶음을 펼치면 패키지와 전문이 보인다', async ({
  page,
}) => {
  await page.goto('/licenses');
  const mit = page
    .locator('details', { has: page.getByText('MIT License', { exact: true }) })
    .first();
  await mit.locator('summary').first().click();
  await expect(
    mit.getByRole('link', { name: /^react \d/ }).first(),
  ).toBeVisible();
  await expect(page.locator('section#runtime')).toContainText('Pyodide');
});

test('랜딩 아래에서 약관·방침·고지로 갈 수 있다', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  for (const name of ['이용약관', '개인정보처리방침', '오픈소스 고지']) {
    await expect(footer.getByRole('link', { name })).toBeVisible();
  }
  await footer.getByRole('link', { name: '개인정보처리방침' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});
