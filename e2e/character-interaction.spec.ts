import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  openStageSheet,
  outputPanel,
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
    // 물어보기 줄(AskPybaem)의 파이뱀 얼굴 — 닫혀 있어도 보임 (P6-10)
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

  test('코드 실행 성공 시 통과 쪽지 + 파이뱀 축하 대사', async ({ page }) => {
    // 첫 퀘스트의 정답 코드 입력
    await runCode(page, quest.solution);

    // 결과 쪽지는 통과, 파이뱀은 이야기 쪽 대사창에서 축하 (P6-06: 결과 쪽지에는 파이뱀 얼굴을 두지 않음)
    const output = page.getByTestId('output-panel').first();
    await expect(output).toHaveAttribute('data-state', 'success');
    await expect(output).toHaveAttribute('data-verdict', 'pass');
    await expect(page.getByTestId('quest-dialogue')).toContainText('해냈어요');
  });

  test('코드 실행 오류 시 파이뱀 다독임 + BugBug가 표시된다', async ({
    page,
  }) => {
    // 일부러 에러 코드 입력
    await runCode(page, 'print(undefined_var)');

    // 에러 시 파이뱀은 대사창에서 다독임 (P6-06: 결과 쪽지에는 파이뱀 얼굴을 두지 않음)
    const output = page.getByTestId('output-panel').first();
    await expect(output).toHaveAttribute('data-state', 'error');
    // P6-07: 생각 박자 뒤 줄 번호와 함께 쉬운 설명 (LLM 없이 규칙표)
    const dialogue = page.getByTestId('quest-dialogue');
    await expect(dialogue).toContainText('버그는 고치라고');
    await expect(dialogue).toContainText(
      '1번째 줄을 봐요. undefined_var 라는 이름은 처음 봐요.',
    );

    // 버그버그가 오류 쪽지 아래에 나타나 한마디 (빨간 경고 없음)
    await expect(output.getByTestId('bugbug-helper')).toBeVisible();
    await expect(output.getByTestId('bugbug-aside')).toContainText(
      '히히, 1번째 줄에 숨었지!',
    );
    // 데스크톱은 설명이 이야기 쪽 대사창에만 (결과 쪽 파이뱀 쪽지는 lg 미만 전용)
    await expect(output.getByTestId('error-explain')).toBeHidden();

    // 고쳐서 다시 돌리면 버그버그가 화해하고 사라진다
    await runCode(page, quest.solution);
    await expect(output).toHaveAttribute('data-verdict', 'pass');
    await expect(output.getByTestId('bugbug-aside')).toHaveCount(0);
  });

  test('출력이 다르면 버그버그 없이 파이뱀이 갸우뚱 격려 (P6-07)', async ({
    page,
  }) => {
    await runCode(page, 'print("다른 글자")');
    const output = page.getByTestId('output-panel').first();
    await expect(output).toHaveAttribute('data-verdict', 'diff');
    await expect(output.getByTestId('bugbug-helper')).toHaveCount(0);
    await expect(page.getByTestId('quest-dialogue')).toContainText(
      '나온 글자가 조금 달라요',
    );
  });

  test('모바일: 결과 쪽에서 버그버그 + 파이뱀 설명 쪽지가 함께 보인다 (P6-07)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await page.getByRole('tab', { name: /공책/ }).click();
    await runCode(page, 'print(undefined_var)');
    // 실행하면 결과 쪽으로 넘어감 (Q55). 이야기 쪽 대사창은 안 보이므로 설명을 결과 쪽에 한 번 더
    await expect(page.getByRole('tab', { name: /결과/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const output = outputPanel(page);
    await expect(output).toHaveAttribute('data-state', 'error');
    await expect(output.getByTestId('bugbug-helper')).toBeVisible();
    await expect(output.getByTestId('error-explain')).toContainText(
      'undefined_var 라는 이름은 처음 봐요',
    );
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
