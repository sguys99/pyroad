import { test, expect } from '@playwright/test';

test.describe('힌트 3단계 에스컬레이션', () => {
  test('힌트 버튼 3회 클릭 시 3단계 힌트 제공 후 비활성화', async ({
    page,
  }) => {
    // 퀘스트 페이지 진입 (첫 번째 퀘스트)
    await page.goto('/world');

    // 스테이지 1 클릭
    const stage1 = page.locator('a[href*="/quest/"], [data-stage-order="1"]').first();
    await stage1.click({ timeout: 10_000 });
    await page.waitForURL('**/quest/**', { timeout: 10_000 });

    // Pyodide 로딩 대기
    await page.waitForTimeout(3_000);

    // 힌트 버튼 찾기
    const hintButton = page.getByRole('button', { name: /힌트/ });
    await expect(hintButton).toBeVisible({ timeout: 10_000 });

    // 힌트 1단계
    await hintButton.click();
    await expect(page.getByText(/1\/3|레벨 1/)).toBeVisible({ timeout: 10_000 });

    // 힌트 2단계
    await hintButton.click();
    await expect(page.getByText(/2\/3|레벨 2/)).toBeVisible({ timeout: 10_000 });

    // 힌트 3단계
    await hintButton.click();
    await expect(page.getByText(/3\/3|레벨 3/)).toBeVisible({ timeout: 10_000 });

    // 힌트 버튼 비활성화 확인
    await expect(hintButton).toBeDisabled({ timeout: 5_000 });
  });
});
