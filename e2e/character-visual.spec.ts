import { test, expect } from '@playwright/test';

test.describe('캐릭터 시각적 확인', () => {
  test('랜딩 페이지에 파이뱀 캐릭터가 표시된다', async ({ page }) => {
    await page.goto('/');

    // Lottie entrance 또는 SVG waving 중 하나가 존재
    const lottie = page.locator('[data-testid="lottie-character-pybaem"]');
    const avatar = page.locator('[data-testid^="character-avatar-pybaem"]');

    // 둘 중 하나가 보이면 통과 (Lottie 로딩 후 SVG로 전환)
    await expect(lottie.or(avatar).first()).toBeVisible({ timeout: 15_000 });

    // Lottie가 끝나면 waving SVG로 전환
    await expect(
      page.locator('[data-testid="character-avatar-pybaem-waving"]'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('월드맵에 파이뱀 캐릭터가 표시된다', async ({ page }) => {
    await page.goto('/world');
    await page.waitForURL('**/world', { timeout: 10_000 });

    // in_progress 스테이지 근처 파이뱀 아바타
    const avatar = page.locator('[data-testid^="character-avatar-pybaem"]');
    await expect(avatar.first()).toBeVisible({ timeout: 10_000 });
  });

  test('프로필 페이지에 파이뱀 캐릭터가 표시된다', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL('**/profile', { timeout: 10_000 });

    const avatar = page.locator('[data-testid^="character-avatar-pybaem"]');
    await expect(avatar.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('반응형 뷰포트 테스트', () => {
  const viewports = [
    { name: '모바일 (320px)', width: 320, height: 568 },
    { name: '태블릿 (768px)', width: 768, height: 1024 },
    { name: '데스크톱 (1024px)', width: 1024, height: 768 },
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
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1); // 1px 여유
      }
    });
  }
});

test.describe('reduced-motion 접근성', () => {
  test('reduced-motion 시 Lottie 대신 정적 SVG가 표시된다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    // Lottie가 로드되지 않아야 함
    const lottie = page.locator('[data-testid="lottie-character-pybaem"]');
    await expect(lottie).toHaveCount(0, { timeout: 5_000 });

    // 대신 정적 SVG 아바타가 표시
    const avatar = page.locator('[data-testid^="character-avatar-pybaem"]');
    await expect(avatar.first()).toBeVisible({ timeout: 10_000 });
  });
});
