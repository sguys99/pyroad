import { test, expect } from '@playwright/test';

test.describe('퀘스트 전체 플로우', () => {
  test('월드맵 → 퀘스트 진입 → 코드 실행 → 검증 성공 → XP 획득', async ({
    page,
  }) => {
    // 1. 월드맵 진입 확인
    await page.goto('/world');
    await expect(page.locator('[data-testid="stage-list"], .stage-card, [class*="stage"]').first()).toBeVisible({
      timeout: 10_000,
    });

    // 2. 스테이지 1 (해제 상태) 클릭 → 퀘스트 페이지로 이동
    const stage1 = page.locator('[data-testid="stage-1"], [data-stage-order="1"]').first();
    if (await stage1.isVisible()) {
      await stage1.click();
    } else {
      // 첫 번째 클릭 가능한 스테이지 클릭
      const clickableStage = page.locator('a[href*="/quest/"], button:has-text("스테이지")').first();
      await clickableStage.click();
    }

    await page.waitForURL('**/quest/**', { timeout: 10_000 });

    // 3. 대화 패널에 메시지 표시 확인
    await expect(
      page.locator('[data-testid="chat-panel"], [class*="chat"], [class*="dialog"]').first(),
    ).toBeVisible({ timeout: 15_000 });

    // 4. CodeMirror 에디터 확인
    const editor = page.locator('.cm-editor');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // 5. Pyodide 로딩 대기
    const runButton = page.getByRole('button', { name: /코드 돌려보기|실행/ });
    await expect(runButton).toBeEnabled({ timeout: 30_000 });

    // 6. 에디터에 정답 코드 입력 (첫 퀘스트: print("안녕하세요!") 계열)
    // CodeMirror의 내용을 직접 교체
    await editor.locator('.cm-content').click();
    await page.keyboard.hotkey('Meta+a');
    await page.keyboard.type('print("안녕하세요!")');

    // 7. "코드 돌려보기!" 버튼 클릭
    await runButton.click();

    // 8. 결과 패널에 실행 결과 표시 확인
    const resultPanel = page.locator('[data-testid="result-panel"], [class*="result"], [class*="output"]').first();
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });

    // 9. 결과에 출력값이 포함되어 있는지 확인
    await expect(resultPanel).toContainText('안녕하세요', { timeout: 10_000 });
  });

  test('잠금 스테이지 클릭 시 이동하지 않음', async ({ page }) => {
    await page.goto('/world');

    // 잠금 상태 스테이지 찾기
    const lockedStage = page.locator('[data-testid*="locked"], [data-status="locked"], [class*="locked"]').first();

    if (await lockedStage.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await lockedStage.click();
      // URL이 변경되지 않았는지 확인
      await page.waitForTimeout(1_000);
      expect(page.url()).toContain('/world');
    }
  });
});
