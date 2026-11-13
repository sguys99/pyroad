// 축하 화면 자랑하기 + 하루 1회 보상 (P9-10, §12-Q67 ④): 새 학생으로 스테이지 마지막 퀘스트 → 스테이지 클리어 카드 "자랑하기" →
// 공유 시트 링크 복사 → /api/share-cards/reward 15코인(원장 share/<KST 오늘>) → 시트 "+15 코인" → 닫으면 축하 카드 그대로 →
// 프로필 레벨 카드 자랑하기는 "오늘 보상은 받았어요"(두 번째 공유는 지급 없음) → 잔액 = 원장. 360·1280 스크린샷.
// 공용 테스트 사용자는 다른 스펙(share-sheet)이 오늘 보상을 먼저 받을 수 있어 새 사용자로 절대값을 본다

import { test, expect } from './support/test';
import {
  adminClient,
  coinBalance,
  coinMismatches,
  completeQuests,
} from './support/admin';
import { stage } from './support/content';
import { createSocialUser, deleteSocialUsers } from './support/socialUsers';
import { outputPanel, runCode, toStageClear } from './support/quest';

const s1 = stage(1);
const lastQuest = s1.quests[s1.quests.length - 1];
const kstToday = () =>
  new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

test.afterAll(deleteSocialUsers);

/** 한 번짜리 연출(시트 떠오름 등)이 끝날 때까지 — 축하 카드의 반복 연출(무한)은 빼고 */
const settled = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.playState !== 'running' ||
          a.effect?.getTiming().iterations === Infinity,
      ),
  );

test('스테이지 클리어 → 자랑하기 → 링크 복사 → 15코인, 두 번째 공유는 지급 없음', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.setTimeout(150_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: baseURL,
  });
  const student = await createSocialUser({ onboarded: true });
  await context.clearCookies();
  await context.addCookies(
    (await student.signIn()).map((c) => ({
      ...c,
      url: baseURL!,
      sameSite: 'Lax' as const,
    })),
  );
  const me = student.id;
  await completeQuests(me, s1.quests.slice(0, -1));
  const before = await coinBalance(me);

  // 퀘스트는 1280에서 풀고(360은 이야기·공책 탭), 축하 카드는 두 폭에서 본 뒤 360에서 자랑하기
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/quest/${lastQuest.id}`);
  await runCode(page, lastQuest.solution);
  await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass');

  const card = await toStageClear(page);
  // 주 버튼(지도로)은 그대로, 자랑하기는 버튼 줄 끝의 글자 버튼
  await expect(card.getByTestId('celebration-map-cta')).toBeVisible();
  await expect(card).toHaveAttribute('data-settled', 'true');
  await page.screenshot({
    path: testInfo.outputPath('celebration-card-1280.png'),
  });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.screenshot({
    path: testInfo.outputPath('celebration-card-360.png'),
  });
  await card.getByTestId('celebration-share').click();
  const sheet = page.getByTestId('share-sheet');
  await expect(sheet).toBeVisible();
  const reward = sheet.getByTestId('share-reward');
  await expect(reward).toHaveText('오늘 처음 자랑하면 15코인');
  await expect(sheet.getByTestId('share-sheet-preview')).toBeVisible();
  await settled(page);
  await page.screenshot({
    path: testInfo.outputPath('celebration-share-sheet-360.png'),
  });

  const res = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/share-cards/reward') &&
      r.request().method() === 'POST',
  );
  await sheet.getByTestId('share-copy').click();
  const body = await (await res).json();
  expect(body).toMatchObject({ coins_earned: 15, already_claimed: false });
  await expect(reward).toHaveAttribute('data-state', 'got');
  await expect(reward).toContainText('+15 코인을 받았어요!');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /\/share\/[A-Za-z0-9_-]{22}$/,
  );
  await page.screenshot({
    path: testInfo.outputPath('celebration-share-reward-360.png'),
  });

  // 닫으면 축하 카드로 돌아옴 (시트 Esc 가 축하를 모두 닫지 않음)
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(card).toBeVisible();
  await expect(card.getByTestId('celebration-share')).toBeFocused();

  const { data: rows } = await adminClient()
    .from('coin_ledger')
    .select('source, ref, delta')
    .eq('user_id', me)
    .eq('source', 'share');
  expect(rows).toEqual([{ source: 'share', ref: kstToday(), delta: 15 }]);
  const afterFirst = await coinBalance(me);
  expect(afterFirst).toBe(body.coins_balance);
  expect(afterFirst - before).toBeGreaterThanOrEqual(15);

  // 두 번째 공유(다른 카드, 1280): 시트가 이미 받은 날로 안내하고, 보내도 지급 없음
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/profile');
  await page.getByTestId('share-open').click();
  const sheet2 = page.getByTestId('share-sheet');
  await expect(sheet2.getByTestId('share-sheet-preview')).toBeVisible();
  await expect(sheet2.getByTestId('share-reward')).toHaveText(
    '오늘 보상은 받았어요',
  );
  await sheet2.getByTestId('share-copy').click();
  await expect(sheet2.getByTestId('share-status')).toContainText(
    '링크를 복사했어요',
  );
  await settled(page);
  await page.screenshot({
    path: testInfo.outputPath('celebration-share-claimed-1280.png'),
  });
  // 보상 API 로 다시 받아도 0 (서버 멱등)
  const cardId = (await page.evaluate(() => navigator.clipboard.readText()))
    .split('/')
    .pop();
  const again = await page.request.post('/api/share-cards/reward', {
    data: { cardId },
  });
  expect(await again.json()).toMatchObject({
    coins_earned: 0,
    already_claimed: true,
  });

  const { data: rows2 } = await adminClient()
    .from('coin_ledger')
    .select('ref')
    .eq('user_id', me)
    .eq('source', 'share');
  expect(rows2).toHaveLength(1);
  expect(await coinBalance(me)).toBe(afterFirst);
  expect(await coinMismatches([me])).toEqual([]);
});
