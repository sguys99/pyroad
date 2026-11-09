// 황금키 (P1-03 서버 차감·0 XP, P1-10 확인 카드, Q25 뱃지 없음). 새 시나리오 (P1-21)

import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  advanceCelebration,
  completedNotice,
  openTutorChat,
  outputPanel,
  waitForRunner,
} from './support/quest';

const quest = stage(1).quests[0];

/** 이야기 쪽 황금키 버튼의 남은 수 (P6-09). 새로 고친 직후 스트리밍으로 바꿔 끼우는 동안 숨은 사본이 잠깐 같이 있어 보이는 것만 */
const goldenKeys = (page: Page, n: number) =>
  page
    .getByRole('button', { name: `황금키 쓰기 (${n}개 남음)` })
    .filter({ visible: true });

/** 황금키 버튼 → 확인 창 (P6-09: 브라우저 confirm 대신 공통 확인 모달) */
async function openKeyDialog(page: Page) {
  await goldenKeys(page, 3).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('황금키를 쓸까요?');
  return dialog;
}

test.describe('황금키', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
    await expect(goldenKeys(page, 3)).toBeVisible();
  });

  test('확인 창에서 취소하면 아무것도 바뀌지 않는다', async ({ page }) => {
    const dialog = await openKeyDialog(page);
    await dialog.getByRole('button', { name: '그만둘래요' }).click();
    await expect(dialog).toBeHidden();
    await expect(goldenKeys(page, 3)).toBeVisible();
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
  });

  test('황금키를 쓰면 정답 코드가 실행되고, XP·뱃지 없이 완료되며 확인 카드만 나온다', async ({
    page,
  }) => {
    const completion = page.waitForResponse((res) =>
      res.url().endsWith('/api/quest/complete'),
    );
    // 쓰기 전에 결과를 알려 준다: 정답 공개, XP·뱃지 없음, 남는 키
    const dialog = await openKeyDialog(page);
    await expect(dialog).toContainText('경험치(XP)와 뱃지 없이 끝나요');
    await expect(dialog).toContainText('황금키 3개 → 2개');
    await dialog
      .getByRole('button', { name: '황금키 쓰기', exact: true })
      .click();

    // 정답 코드가 에디터에 들어가고 자동 실행 → 정답
    await expect(page.locator('.cm-editor .cm-content')).toContainText(
      quest.solution,
    );
    await expect(outputPanel(page)).toContainText('정답이에요!');

    // 큰 축하 대신 작은 확인 카드 (컨페티 없음)
    const card = page.getByTestId('celebration-step-golden_key');
    await expect(card).toContainText('황금키로 문을 열었어요');
    await expect(card).toContainText('XP와 뱃지 없이 완료돼요');
    // 첫 완료여도 황금키 완료는 뱃지가 없으므로(B11 후속, Q25) 확인 카드 하나로 끝난다.
    // 뱃지 카드는 자동으로 넘어가 overlay 숨김만으로는 없었는지 알 수 없어 서버 응답으로 확인
    const res = await completion;
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      xp_gained: 0,
      used_golden_key: true,
      new_badges: [],
    });
    await advanceCelebration(page, 'golden_key');
    await expect(page.getByTestId('celebration-overlay')).toBeHidden();
    await expect(page.getByTestId('celebration-step-badges')).toHaveCount(0);

    // 황금키 알림은 파이뱀 대화에 (P6-10: 닫혀 있으면 물어보기 줄에 새 이야기 수)
    await expect(page.getByTestId('ask-unread')).toBeVisible();
    const chat = await openTutorChat(page);
    await expect(chat.getByText('🔑 황금키를 사용했어요!')).toBeVisible();

    // 서버가 차감·0 XP 로 완료
    await expect(goldenKeys(page, 2)).toBeVisible();
    await expect(page.getByText(/^\s*0 XP/)).toBeVisible();
    await page.reload();
    await expect(completedNotice(page)).toBeVisible();
    await expect(goldenKeys(page, 2)).toBeVisible();
  });
});
