// 로그인 화면의 캐릭터. 랜딩·반응형·reduced-motion 은 비로그인 스펙(public/landing.spec.ts)으로 옮김 (P1-21)

import { test, expect } from './support/test';

test.describe('캐릭터 시각적 확인', () => {
  test('월드맵에 파이뱀 캐릭터가 표시된다', async ({ page }) => {
    await page.goto('/world');
    await expect(page).toHaveURL(/\/world$/);

    // 지금 위치(진행 중 스테이지) 큰 파이뱀 + "지금 여기!" (P5-04 CurrentMarker, 정지 리그 그림)
    const here = page.getByTestId('world-current-marker');
    await expect(here).toBeVisible();
    await expect(here.locator('svg').first()).toBeVisible();
    await expect(here).toContainText('지금 여기!');
  });

  test('프로필 페이지에 내 파이뱀 아바타가 표시된다 (사진 없음, P3-13)', async ({
    page,
  }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile$/);

    // 공개 아바타 = 고른 색의 파이뱀(UserAvatar). 스킨을 안 골랐으면 기본 숲초록
    const avatar = page.getByTestId('user-avatar');
    await expect(avatar.first()).toBeVisible();
    await expect(avatar.first()).toHaveAttribute('data-skin', 'green');
    await expect(page.locator('img[alt="아바타"]')).toHaveCount(0);
  });

  test('로그인한 사용자가 랜딩을 열면 월드맵으로 간다', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/world$/);
  });
});
