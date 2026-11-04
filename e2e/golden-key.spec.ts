// 황금키 (P1-03 서버 차감·0 XP, P1-10 확인 카드). 새 시나리오 (P1-21)

import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  advanceCelebration,
  outputPanel,
  waitForRunner,
} from './support/quest';

const quest = stage(1).quests[0];

test.describe('황금키', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
    await expect(page.getByText('황금키: 3/3')).toBeVisible();
  });

  test('확인 창에서 취소하면 아무것도 바뀌지 않는다', async ({ page }) => {
    page.once('dialog', (dialog) => void dialog.dismiss());
    await page.getByRole('button', { name: '황금키', exact: true }).click();
    await expect(page.getByText('황금키: 3/3')).toBeVisible();
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
  });

  test('황금키를 쓰면 정답 코드가 실행되고, XP 없이 완료되며 확인 카드가 나온다', async ({
    page,
  }) => {
    page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('XP를 받을 수 없어요');
      void dialog.accept();
    });
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
    await expect(card).toContainText('XP 없이 완료돼요');
    await advanceCelebration(page, 'golden_key');
    // 첫 완료라 첫 코드 뱃지는 받는다 (황금키는 hint_master 만 빠짐, B11)
    await expect(page.getByTestId('celebration-step-badges')).toContainText(
      '첫 코드',
    );
    await advanceCelebration(page, 'badges');
    await expect(page.getByTestId('celebration-overlay')).toBeHidden();

    // 서버가 차감·0 XP 로 완료
    await expect(page.getByText('황금키: 2/3')).toBeVisible();
    await expect(page.getByText(/^\s*0 XP/)).toBeVisible();
    await page.reload();
    await expect(page.getByText('이미 완료한 퀘스트예요!')).toBeVisible();
    await expect(page.getByText('황금키: 2/3')).toBeVisible();
  });
});
