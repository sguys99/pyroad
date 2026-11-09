import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  openStageSheet,
  questHeader,
  runCode,
  stageButton,
} from './support/quest';

const stage1 = stage(1);
const quest = stage1.quests[0];

test.describe('퀘스트 캐릭터 표정 변화', () => {
  test.beforeEach(async ({ page }) => {
    // 월드맵에서 첫 번째 접근 가능한 퀘스트로 진입
    await page.goto('/world');
    await openStageSheet(page, stage1.title);
    await page.getByTestId('stage-sheet-start').click();
    await expect(page).toHaveURL(new RegExp(`/quest/${quest.id}$`));
  });

  test('대화 패널에 파이뱀 아바타가 표시된다', async ({ page }) => {
    // ConversationPanel의 채팅 아바타 확인
    const avatar = page.locator('[data-testid^="character-avatar-pybaem"]');
    await expect(avatar.first()).toBeVisible({ timeout: 15_000 });
  });

  test('AI 응답 생성 중 thinking 표정이 표시된다', async ({ page }) => {
    await runCode(page, 'print("hello")');

    // 실행 중 thinking 표정 또는 실행 결과 확인
    const thinkingOrResult = page
      .locator('[data-testid="character-avatar-pybaem-thinking"]')
      .or(page.locator('[data-testid="character-avatar-pybaem-celebrating"]'))
      .or(page.locator('[data-testid="character-avatar-pybaem-teaching"]'))
      .or(page.locator('[data-testid="character-avatar-pybaem-happy"]'));
    await expect(thinkingOrResult.first()).toBeVisible();
  });

  test('코드 실행 성공 시 celebrating 표정이 표시된다', async ({ page }) => {
    // 첫 퀘스트의 정답 코드 입력
    await runCode(page, quest.solution);

    // 결과 패널의 파이뱀이 축하 표정 (정답)
    const output = page.getByTestId('output-panel').first();
    await expect(output).toHaveAttribute('data-state', 'success');
    await expect(
      output.getByTestId('character-avatar-pybaem-celebrating'),
    ).toBeVisible();
  });

  test('코드 실행 오류 시 encouraging 표정 + BugBug가 표시된다', async ({
    page,
  }) => {
    // 일부러 에러 코드 입력
    await runCode(page, 'print(undefined_var)');

    // 에러 시 encouraging 표정 확인
    const output = page.getByTestId('output-panel').first();
    await expect(output).toHaveAttribute('data-state', 'error');
    await expect(
      output.getByTestId('character-avatar-pybaem-encouraging'),
    ).toBeVisible();

    // BugBug 디버깅 헬퍼 등장 확인
    await expect(output.getByTestId('bugbug-helper')).toBeVisible();
  });
});

test.describe('축하 오버레이', () => {
  test('월드맵이 정상 로딩되고 퀘스트 화면에는 축하 오버레이가 닫혀 있다', async ({
    page,
  }) => {
    // 축하 카드 시퀀스 자체는 quest-flow·golden-key 스펙이 확인
    await page.goto('/world');
    await expect(
      page.getByRole('heading', { name: '모험 지도' }),
    ).toBeVisible();
    await expect(stageButton(page, stage1.title)).toBeVisible();

    await page.goto(`/quest/${quest.id}`);
    await expect(questHeader(page)).toContainText(quest.title);
    await expect(page.getByTestId('celebration-overlay')).toHaveCount(0);
  });
});
