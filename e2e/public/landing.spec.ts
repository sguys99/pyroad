// 비로그인 스펙 (P1-21, `public` 프로젝트). 로컬 Supabase 없이 돈다 → CI e2e-smoke
// 기존 character-visual.spec.ts 의 랜딩·반응형·reduced-motion 시나리오 + 404·CSP(B27)·보호 경로

import { test, expect } from '@playwright/test';
import { watchCspViolations } from '../support/test';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

test.describe('랜딩 캐릭터', () => {
  test('랜딩 페이지에 파이뱀 캐릭터가 표시된다', async ({ page }) => {
    await page.goto('/');

    // B32 이후 Lottie는 그리지 않음(testid 0개). 예전 testid는 회귀 확인용으로 남겨 둠
    const lottie = page.locator('[data-testid="lottie-character-pybaem"]');
    const avatar = page.locator('[data-testid^="character-avatar-pybaem"]');

    // 정적 SVG + 1회성 등장 연출(LottieCharacter)
    await expect(lottie.or(avatar).first()).toBeVisible({ timeout: 15_000 });

    // 처음부터 waving 표정
    await expect(
      page.getByTestId('character-avatar-pybaem-waving'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'pyRoad', exact: true }),
    ).toBeVisible();
  });
});

test.describe('반응형 뷰포트 테스트', () => {
  const viewports = [
    { name: '모바일 (320px)', width: 320, height: 568 },
    { name: '모바일 (360px)', width: 360, height: 740 },
    { name: '태블릿 (768px)', width: 768, height: 1024 },
    { name: '데스크톱 (1024px)', width: 1024, height: 768 },
    { name: '데스크톱 (1280px)', width: 1280, height: 800 },
    { name: '와이드 (1440px)', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`${vp.name}에서 랜딩 페이지 캐릭터가 표시된다`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      const avatar = page.locator('[data-testid^="character-avatar-pybaem"]');
      await expect(avatar.first()).toBeVisible({ timeout: 15_000 });

      // 캐릭터가 뷰포트를 넘지 않는지 확인
      const box = await avatar.first().boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1); // 1px 여유

      // 가로 스크롤이 생기지 않음
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(vp.width);
    });
  }
});

test.describe('reduced-motion 접근성', () => {
  test('reduced-motion 시 Lottie 대신 정적 SVG가 표시된다', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    // Lottie가 로드되지 않아야 함
    await expect(
      page.locator('[data-testid="lottie-character-pybaem"]'),
    ).toHaveCount(0);

    // 대신 정적 SVG 아바타가 표시
    const avatar = page.locator('[data-testid^="character-avatar-pybaem"]');
    await expect(avatar.first()).toBeVisible();
  });
});

test.describe('보안 헤더·없는 주소 (B27)', () => {
  test('정적 랜딩은 unsafe-eval 없는 CSP 와 보안 헤더를 받는다', async ({
    page,
  }) => {
    const response = await page.goto('/');
    const headers = response!.headers();
    const csp = headers['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBeTruthy();
    expect(headers['permissions-policy']).toBeTruthy();
    // 운영 빌드에서는 eval 계열을 막는다 (dev 서버만 예외)
    if (process.env.E2E_SERVER !== 'dev')
      expect(csp).not.toContain("'unsafe-eval'");
  });

  test('없는 주소는 쉬운 한국어 404 를 nonce CSP 로 보여 준다', async ({
    page,
  }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response!.status()).toBe(404);
    expect(response!.headers()['content-security-policy']).toMatch(
      /'nonce-[^']+'/,
    );
    await expect(
      page.getByRole('heading', { name: '길을 찾을 수 없어요' }),
    ).toBeVisible();

    // 스크립트가 nonce 로 동작해야 링크가 클라이언트 이동을 한다
    await page.getByRole('link', { name: '처음으로 가기' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByTestId('character-avatar-pybaem-waving'),
    ).toBeVisible();
  });
});

test.describe('보호 경로', () => {
  for (const path of [
    '/world',
    '/quest/b1000000-0000-0000-0000-000000000001',
    '/profile',
  ]) {
    test(`로그인하지 않으면 ${path} 에서 랜딩으로 돌아간다`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
      await expect(
        page.getByRole('heading', { name: 'pyRoad', exact: true }),
      ).toBeVisible();
    });
  }
});
