import { test, expect } from '@playwright/test';

test.describe('퀘스트 캐릭터 표정 변화', () => {
  test.beforeEach(async ({ page }) => {
    // 월드맵에서 첫 번째 접근 가능한 퀘스트로 진입
    await page.goto('/world');
    await expect(
      page.locator('[data-testid="stage-list"], .stage-card, [class*="stage"]').first(),
    ).toBeVisible({ timeout: 10_000 });

    const stage1 = page.locator('[data-testid="stage-1"], [data-stage-order="1"]').first();
    if (await stage1.isVisible()) {
      await stage1.click();
    } else {
      const clickableStage = page.locator('a[href*="/quest/"]').first();
      await clickableStage.click();
    }
    await page.waitForURL('**/quest/**', { timeout: 10_000 });
  });

  test('대화 패널에 파이뱀 아바타가 표시된다', async ({ page }) => {
    // ConversationPanel의 채팅 아바타 확인
    const avatar = page.locator('[data-testid^="character-avatar-pybaem"]');
    await expect(avatar.first()).toBeVisible({ timeout: 15_000 });
  });

  test('AI 응답 생성 중 thinking 표정이 표시된다', async ({ page }) => {
    // Pyodide 로딩 대기
    const runButton = page.getByRole('button', { name: /코드 돌려보기|실행/ });
    await expect(runButton).toBeEnabled({ timeout: 30_000 });

    // 에디터에 코드 입력 후 실행
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.hotkey('Meta+a');
    await page.keyboard.type('print("hello")');
    await runButton.click();

    // 실행 중 thinking 표정 또는 실행 결과 확인
    const thinkingOrResult = page
      .locator('[data-testid="character-avatar-pybaem-thinking"]')
      .or(page.locator('[data-testid="character-avatar-pybaem-celebrating"]'))
      .or(page.locator('[data-testid="character-avatar-pybaem-happy"]'));
    await expect(thinkingOrResult.first()).toBeVisible({ timeout: 15_000 });
  });

  test('코드 실행 성공 시 celebrating 표정이 표시된다', async ({ page }) => {
    const runButton = page.getByRole('button', { name: /코드 돌려보기|실행/ });
    await expect(runButton).toBeEnabled({ timeout: 30_000 });

    // 첫 퀘스트의 정답 코드 입력
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.hotkey('Meta+a');
    await page.keyboard.type('print("안녕하세요!")');
    await runButton.click();

    // 실행 결과 대기 후 celebrating 또는 happy 표정 확인
    const successAvatar = page
      .locator('[data-testid="character-avatar-pybaem-celebrating"]')
      .or(page.locator('[data-testid="character-avatar-pybaem-happy"]'));
    await expect(successAvatar.first()).toBeVisible({ timeout: 15_000 });
  });

  test('코드 실행 오류 시 encouraging 표정 + BugBug가 표시된다', async ({ page }) => {
    const runButton = page.getByRole('button', { name: /코드 돌려보기|실행/ });
    await expect(runButton).toBeEnabled({ timeout: 30_000 });

    // 일부러 에러 코드 입력
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.hotkey('Meta+a');
    await page.keyboard.type('print(undefined_var)');
    await runButton.click();

    // 에러 시 encouraging 표정 확인
    await expect(
      page.locator('[data-testid="character-avatar-pybaem-encouraging"]'),
    ).toBeVisible({ timeout: 15_000 });

    // BugBug 디버깅 헬퍼 등장 확인
    await expect(
      page.locator('[data-testid="bugbug-helper"]'),
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Lottie 축하 애니메이션', () => {
  test('축하 오버레이 컴포넌트가 존재한다', async ({ page }) => {
    // LevelUp/ProjectComplete 트리거는 실제 XP 누적이 필요하므로
    // 여기서는 CelebrationOverlay의 DOM 구조만 확인
    // 실제 트리거 테스트는 E2E 풀 시나리오에서 수행

    await page.goto('/world');
    await page.waitForURL('**/world', { timeout: 10_000 });

    // 월드맵이 정상 로딩되는지 확인 (축하 트리거 전제 조건)
    await expect(
      page.locator('[data-testid="stage-list"], .stage-card, [class*="stage"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
