// 월드맵 상단 HUD (P5-07, Q47): 스크롤해도 따라오는 바, 실제 값(닉네임·레벨·스트릭), 곧 열려요 쪽지, 메뉴 시트(공지·게시판·로그아웃)

import { test, expect } from './support/test';
import { completeQuests } from './support/admin';
import { stage } from './support/content';

test('360px: 스크롤해도 HUD가 위에 있고, 불꽃·곧 열려요·메뉴가 동작한다', async ({
  page,
  e2eUser,
}) => {
  const q = stage(1).quests[0];
  await completeQuests(e2eUser.id, [{ id: q.id, solution: q.solution }]);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/world');
  const hud = page.getByTestId('world-hud');
  await expect(hud).toBeVisible();

  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect.poll(async () => (await hud.boundingBox())?.y).toBe(0);
  const box = await hud.boundingBox();
  expect(box?.height).toBeLessThanOrEqual(64);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBe(0);

  await expect(hud.getByRole('link', { name: /내 프로필$/ })).toHaveAttribute(
    'href',
    '/profile',
  );
  await hud.getByRole('button', { name: '1일 연속 모험 중' }).click();
  await expect(page.getByRole('status', { name: 'HUD 안내' })).toContainText(
    '1일 연속 모험 중이에요!',
  );

  await hud
    .getByRole('button', { name: '코인·오늘의 미션·상점, 곧 열려요' })
    .click();
  await expect(page.getByRole('status', { name: 'HUD 안내' })).toContainText(
    '곧 열려요!',
  );

  await hud.getByRole('button', { name: '메뉴' }).click();
  const sheet = page.getByTestId('hud-menu-sheet');
  await expect(sheet.getByRole('link', { name: '공지사항' })).toBeVisible();
  await expect(sheet.getByRole('link', { name: '게시판' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: '로그아웃' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(hud.getByRole('button', { name: '메뉴' })).toBeFocused();
});
