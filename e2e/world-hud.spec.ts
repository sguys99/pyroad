// 월드맵 상단 HUD (P5-07, Q47): 스크롤해도 따라오는 바, 실제 값(닉네임·레벨·스트릭·코인 P8-04·미션 칸 P8-07), 곧 열려요 쪽지, 메뉴 시트(공지·게시판·로그아웃, 400px 미만은 소리)

import { test, expect } from './support/test';
import { coinBalance, completeQuests, grantTestCoins } from './support/admin';
import { stage } from './support/content';

test('360px: 스크롤해도 HUD가 위에 있고, 불꽃·코인·곧 열려요·메뉴가 동작한다', async ({
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

  // 코인 칩: 서버 잔액 (P8-04. 리셋은 코인을 지우지 않아 같은 실행의 다른 스펙 몫도 들어 있음)
  await expect(hud.getByTestId('hud-coin')).toContainText(
    `코인 ${(await coinBalance(e2eUser.id)).toLocaleString('ko-KR')}개`,
  );

  // 640px 미만은 곧 열려요 버튼이 빠지고(코인·미션 칸 자리, P8-07), 400px 미만은 닉네임 글자와 바의 소리 토글도 빠짐
  // (아바타 링크 이름은 그대로, 소리는 메뉴 시트 안)
  await expect(
    hud.getByRole('button', { name: '상점, 곧 열려요' }),
  ).toBeHidden();
  await expect(hud.getByTestId('hud-mission')).toBeVisible();
  await expect(hud.locator('.wh-name')).toBeHidden();
  await expect(hud.getByTestId('sound-toggle')).toBeHidden();
  await page.setViewportSize({ width: 768, height: 740 });
  await expect(hud.getByTestId('sound-toggle')).toBeVisible();
  await hud.getByRole('button', { name: '상점, 곧 열려요' }).click();
  await expect(page.getByRole('status', { name: 'HUD 안내' })).toContainText(
    '곧 열려요!',
  );
  await page.setViewportSize({ width: 360, height: 740 });

  await hud.getByRole('button', { name: '메뉴' }).click();
  const sheet = page.getByTestId('hud-menu-sheet');
  await expect(sheet.getByRole('link', { name: '공지사항' })).toBeVisible();
  await expect(sheet.getByRole('link', { name: '게시판' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: '로그아웃' })).toBeVisible();
  await expect(sheet.getByTestId('sound-toggle')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(hud.getByRole('button', { name: '메뉴' })).toBeFocused();
});

test('코인을 받고 지도로 돌아오면 코인 칩이 지난번 본 값에서 새 잔액까지 오른다 (P8-04)', async ({
  page,
  e2eUser,
}) => {
  await page.goto('/world');
  const coin = page.getByTestId('world-hud').getByTestId('hud-coin');
  const before = await coinBalance(e2eUser.id);
  await expect(coin).toContainText(`코인 ${before.toLocaleString('ko-KR')}개`);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('pyroad:hud-coins')))
    .toBe(String(before));

  await grantTestCoins(e2eUser.id, 7);
  await page.reload();
  const after = (before + 7).toLocaleString('ko-KR');
  await expect(coin).toContainText(`코인 ${after}개`);
  // 카운트업이 끝나면 보이는 숫자도 새 잔액
  await expect(coin.locator('.hud-num')).toHaveText(after);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('pyroad:hud-coins')))
    .toBe(String(before + 7));
});
