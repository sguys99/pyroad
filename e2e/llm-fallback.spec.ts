import { test, expect } from '@playwright/test';

test.describe('LLM 폴백 동작', () => {
  // 이 테스트는 ANTHROPIC_API_KEY가 없는 환경에서 실행해야 합니다.
  // 수동 검증 또는 별도 환경 설정이 필요합니다.

  test.skip(
    !!process.env.ANTHROPIC_API_KEY,
    'LLM 폴백 테스트는 ANTHROPIC_API_KEY가 없는 환경에서 실행해야 합니다',
  );

  test('API 키 없이 퀘스트 진입 시 폴백 텍스트 표시', async ({ page }) => {
    await page.goto('/world');

    // 스테이지 1 클릭
    const stage1 = page.locator('a[href*="/quest/"], [data-stage-order="1"]').first();
    await stage1.click({ timeout: 10_000 });
    await page.waitForURL('**/quest/**', { timeout: 10_000 });

    // 대화 패널에 폴백 텍스트가 표시되는지 확인
    // (LLM 응답 대신 prompt_skeleton.fallback_text가 표시됨)
    const chatPanel = page.locator('[data-testid="chat-panel"], [class*="chat"], [class*="dialog"]').first();
    await expect(chatPanel).toBeVisible({ timeout: 15_000 });

    // 폴백 텍스트가 표시됨 (빈 패널이 아닌지 확인)
    await expect(chatPanel).not.toBeEmpty({ timeout: 10_000 });
  });

  test('API 키 없이 힌트 요청 시 정적 힌트 표시', async ({ page }) => {
    await page.goto('/world');

    const stage1 = page.locator('a[href*="/quest/"], [data-stage-order="1"]').first();
    await stage1.click({ timeout: 10_000 });
    await page.waitForURL('**/quest/**', { timeout: 10_000 });

    // 힌트 버튼 클릭
    const hintButton = page.getByRole('button', { name: /힌트/ });
    await expect(hintButton).toBeVisible({ timeout: 10_000 });
    await hintButton.click();

    // 정적 힌트가 대화 패널에 표시됨
    const chatPanel = page.locator('[data-testid="chat-panel"], [class*="chat"], [class*="dialog"]').first();
    await expect(chatPanel).not.toBeEmpty({ timeout: 10_000 });
  });
});
