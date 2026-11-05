// 힌트 3단계 (P1-04: 힌트 수는 서버가 기록). LLM 키가 없어 저장된 힌트가 단계별로 나온다 (P1-21)

import { test, expect } from './support/test';
import { stage } from './support/content';
import { waitForRunner } from './support/quest';

const quest = stage(1).quests[0];

test.describe('힌트 3단계 에스컬레이션', () => {
  test('힌트 버튼 3회 클릭 시 3단계 힌트 제공 후 비활성화', async ({
    page,
  }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);

    const hintButton = page.getByRole('button', { name: '힌트 받기' });
    await expect(hintButton).toBeEnabled();

    for (const level of [1, 2, 3] as const) {
      await hintButton.click();
      // 단계 표시(시스템 메시지) + 그 단계의 저장된 힌트
      await expect(
        page.getByText(`힌트 ${level}/3`, { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(quest.hints[level - 1])).toBeVisible();
      if (level < 3) await expect(hintButton).toBeEnabled(); // 답을 다 받으면 다시 누를 수 있음
    }

    // 힌트 버튼 비활성화 확인
    const used = page.getByRole('button', { name: '힌트 모두 사용' });
    await expect(used).toBeDisabled();

    // 서버에 기록됐으므로 새로 고쳐도 그대로 (P1-04)
    await page.reload();
    await expect(
      page.getByRole('button', { name: '힌트 모두 사용' }),
    ).toBeDisabled();
  });
});
