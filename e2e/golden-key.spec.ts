// 황금키 (P1-03 서버 차감·0 XP, P1-10 확인 카드, Q25 뱃지 없음). 새 시나리오 (P1-21)

import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  advanceCelebration,
  completedNotice,
  outputPanel,
  waitForRunner,
} from './support/quest';

const quest = stage(1).quests[0];

/** 하단 상태바의 황금키 수. 새로 고친 직후 스트리밍으로 바꿔 끼우는 동안 숨은 사본이 잠깐 같이 있어 보이는 것만 */
const goldenKeys = (page: Page, n: number) =>
  page.getByText(`황금키: ${n}/3`).filter({ visible: true });

test.describe('황금키', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
    await expect(goldenKeys(page, 3)).toBeVisible();
  });

  test('확인 창에서 취소하면 아무것도 바뀌지 않는다', async ({ page }) => {
    page.once('dialog', (dialog) => void dialog.dismiss());
    await page.getByRole('button', { name: '황금키', exact: true }).click();
    await expect(goldenKeys(page, 3)).toBeVisible();
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
  });

  test('황금키를 쓰면 정답 코드가 실행되고, XP·뱃지 없이 완료되며 확인 카드만 나온다', async ({
    page,
  }) => {
    page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('XP와 뱃지를 받을 수 없어요');
      void dialog.accept();
    });
    const completion = page.waitForResponse((res) =>
      res.url().endsWith('/api/quest/complete'),
    );
    await page.getByRole('button', { name: '황금키', exact: true }).click();

    // 정답 코드가 에디터에 들어가고 자동 실행 → 정답
    await expect(page.locator('.cm-editor .cm-content')).toContainText(
      quest.solution,
    );
    await expect(outputPanel(page)).toContainText('정답이에요!');
    await expect(page.getByText('🔑 황금키를 사용했어요!')).toBeVisible();

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

    // 서버가 차감·0 XP 로 완료
    await expect(goldenKeys(page, 2)).toBeVisible();
    await expect(page.getByText(/^\s*0 XP/)).toBeVisible();
    await page.reload();
    await expect(completedNotice(page)).toBeVisible();
    await expect(goldenKeys(page, 2)).toBeVisible();
  });
});
