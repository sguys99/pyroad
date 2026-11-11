// 업적 도감 (P8-10, §3 F5): 퀘스트 첫 완료로 업적을 얻고 "나중에"로 넘긴 상태 → 월드맵 메뉴의 금색 점 → 도감 → 칸 "받기"
// → 원장 achievement/<id> 대로 코인, 지갑 칩이 응답 잔액. 360px 가로 넘침 없음, 프로필 업적 카드도 도감으로 감

import { test, expect } from './support/test';
import {
  adminClient,
  coinBalance,
  completeQuests,
  hasCoinKey,
} from './support/admin';
import { stage } from './support/content';

const noOverflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('360px: 메뉴 금색 점 → 도감 → 받기 → 코인 반영, 넘침 없음', async ({
  page,
  e2eUser,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  // 첫 완료 → complete_quest 안에서 first_code 등 업적 기록(코인은 아직, 받기로)
  await completeQuests(e2eUser.id, [stage(1).quests[0]]);
  const { data: rows } = await adminClient()
    .from('user_achievements')
    .select('achievement_id, claimed_at')
    .eq('user_id', e2eUser.id);
  expect(rows?.map((r) => r.achievement_id)).toContain('first_code');

  await page.goto('/world');
  await page
    .getByRole('button', { name: /^메뉴, 받을 업적 보상 \d+개$/ })
    .click();
  await page.getByTestId('menu-achievements').click();
  await expect(page).toHaveURL(/\/profile\/achievements$/);

  const book = page.getByTestId('achievement-book');
  await expect(book.getByRole('heading', { name: '업적 도감' })).toBeVisible();
  await expect(book.locator('.ab-count')).toContainText('/41');
  // 숨김 업적은 이름 없이 "???"
  await expect(book.getByTestId('achievement-level_50')).toContainText('???');
  // 아직 = 진행 막대 n/목표
  await expect(book.getByTestId('achievement-quests_10')).toHaveAttribute(
    'data-state',
    'locked',
  );
  await expect(book.getByTestId('achievement-quests_10')).toContainText('/10');
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);

  const tile = book.getByTestId('achievement-first_code');
  await expect(tile).toHaveAttribute('data-state', 'claimable');
  // 같은 사용자를 다시 돌린 실행이면 원장에 이미 있어 0 (리셋은 원장을 지우지 않음)
  const already = await hasCoinKey(e2eUser.id, 'achievement', 'first_code');
  const coins0 = await coinBalance(e2eUser.id);
  const res = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/achievements/claim') &&
      r.request().method() === 'POST',
  );
  await tile.getByTestId('achievement-claim').click();
  const body = await (await res).json();
  expect(body.coins_earned).toBe(already ? 0 : 10);
  await expect(tile).toHaveAttribute('data-state', 'earned');
  const coins1 = await coinBalance(e2eUser.id);
  expect(coins1).toBe(coins0 + body.coins_earned);
  await expect(page.locator('[data-ab-wallet]')).toContainText(
    `코인 ${coins1.toLocaleString('ko-KR')}개`,
  );
  expect(await hasCoinKey(e2eUser.id, 'achievement', 'first_code')).toBe(true);

  // 상세 시트: 받은 업적은 날짜와 "코인을 받았어요"
  await tile.getByRole('button', { name: /^첫 코드, 브론즈/ }).click();
  const sheet = page.getByTestId('achievement-sheet');
  await expect(sheet).toContainText('코인을 받았어요');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // 다시 들어와도 받은 상태, 프로필 카드도 도감으로
  await page.goto('/profile');
  await page.getByTestId('profile-achievements').click();
  await expect(page).toHaveURL(/\/profile\/achievements$/);
  await expect(
    page.getByTestId('achievement-book').getByTestId('achievement-first_code'),
  ).toHaveAttribute('data-state', 'earned');
});

test('1280px: 4열 진열, 넘침 없음', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/profile/achievements');
  const grid = page.locator('.ab-sec[data-category="learn"] .ab-grid');
  // evaluateAll 은 기다리지 않음 — 스트리밍 렌더가 칸을 그리기 전이면 0칸 (B58)
  await expect(grid.locator('.ab-tile').nth(3)).toBeVisible();
  const tops = await grid
    .locator('.ab-tile')
    .evaluateAll((els) =>
      els.slice(0, 4).map((e) => e.getBoundingClientRect().top),
    );
  expect(new Set(tops).size).toBe(1);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});
