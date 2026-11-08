// 비로그인 스펙 (`public` 프로젝트). 랜딩 #faq·바닥 글 (P4-08):
// 키보드로 여닫는 아코디언 · 높이 연출은 full만 · FAQPage JSON-LD · 바닥 글 링크(약관·방침·공지·고지·문의) · 360px

import { test, expect, type Page } from '@playwright/test';
import { watchCspViolations } from '../support/test';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

async function setMotion(
  page: Page,
  tier: 'full' | 'lite' | 'minimal',
  reduced: 'on' | 'off',
) {
  await page.addInitScript(
    ([t, r]) => {
      localStorage.setItem(
        'pyroad.motion.prefs.v1',
        JSON.stringify({ tier: t, reduced: r }),
      );
    },
    [tier, reduced] as const,
  );
}

/** 첫 질문 답 상자의 높이 전환 시간 (::details-content) */
async function contentTransition(page: Page): Promise<string> {
  return page
    .getByTestId('faq-free')
    .evaluate(
      (el) => getComputedStyle(el, '::details-content').transitionDuration,
    );
}

test.describe('랜딩 FAQ (P4-08)', () => {
  test('키보드로 질문을 열고 닫으며, 답과 약관 링크가 보인다', async ({
    page,
  }) => {
    await page.goto('/');
    const item = page.getByTestId('faq-free');
    const summary = item.locator('summary');
    await summary.scrollIntoViewIfNeeded();
    await expect(item).not.toHaveAttribute('open', '');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(item).toHaveAttribute('open', '');
    await expect(item.getByText(/모두 무료예요/)).toBeVisible();
    await expect(
      item.getByRole('link', { name: '이용약관 보기' }),
    ).toHaveAttribute('href', '/terms');
    await page.keyboard.press('Space');
    await expect(item).not.toHaveAttribute('open', '');
  });

  test('FAQPage 구조화 데이터가 질문 수만큼 있다', async ({ page }) => {
    await page.goto('/');
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const faq = blocks
      .map((b) => JSON.parse(b))
      .find((d) => d['@type'] === 'FAQPage');
    expect(faq).toBeTruthy();
    expect(faq.mainEntity).toHaveLength(
      await page.locator('#faq details').count(),
    );
  });

  test('full만 높이 연출, minimal·동작 줄이기는 즉시', async ({ page }) => {
    await setMotion(page, 'full', 'off');
    await page.goto('/');
    const full = await contentTransition(page);
    test.skip(
      full === '' || full === undefined,
      '::details-content를 지원하지 않는 브라우저',
    );
    expect(full).not.toMatch(/^0s(, 0s)*$/);
  });

  for (const mode of [
    { tier: 'minimal', reduced: 'off' },
    { tier: 'full', reduced: 'on' },
  ] as const) {
    test(`${mode.tier}${mode.reduced === 'on' ? ' + 동작 줄이기' : ''}: 열고 닫을 때 연출이 없다`, async ({
      page,
    }) => {
      await setMotion(page, mode.tier, mode.reduced);
      await page.goto('/');
      expect(await contentTransition(page)).toMatch(/^0s(, 0s)*$/);
      const item = page.getByTestId('faq-ai');
      await item.locator('summary').click();
      await expect(item.getByText(/정답 대신 힌트/)).toBeVisible();
    });
  }
});

test.describe('랜딩 바닥 글 (P4-08)', () => {
  test('약관·방침·공지·오픈소스 고지·문의가 있고 방침은 굵다', async ({
    page,
  }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    for (const [name, href] of [
      ['이용약관', '/terms'],
      ['개인정보처리방침', '/privacy'],
      ['공지사항', '/notice'],
      ['오픈소스 고지', '/licenses'],
    ] as const)
      await expect(footer.getByRole('link', { name })).toHaveAttribute(
        'href',
        href,
      );
    await expect(
      footer.getByRole('link', { name: '문의하기' }),
    ).toHaveAttribute('href', /^mailto:/);
    const weight = await footer
      .getByRole('link', { name: '개인정보처리방침' })
      .evaluate((el) => Number(getComputedStyle(el).fontWeight));
    expect(weight).toBeGreaterThanOrEqual(700);
    await expect(footer.locator('a[href="#about"]')).toHaveCount(0);
  });

  test('360px: 링크가 44px 이상이고 가로 스크롤이 없다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    const links = page.getByRole('contentinfo').getByRole('link');
    for (const link of await links.all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x + box!.width).toBeLessThanOrEqual(361);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });
});
