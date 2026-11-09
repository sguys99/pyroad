// "파이뱀에게 물어보기" (P6-10, §12-Q54). e2e 서버는 LLM 키가 없어 답은 모두 저장된 답변(SSE 폴백).
// 1280: 이야기 쪽 안에서 펼침(높이가 묶여 해 볼 일 카드를 밀어내지 않음) · 360 터치: 바텀시트.
// 닫혀 있을 때 파이뱀이 한 말은 줄에 새 이야기 수 + 미리 보기로, 질문은 정해진 버튼으로 보낸다.
// 실행 결과(오류·출력 다름)에는 AI를 자동으로 부르지 않고 결과 쪽지의 "파이뱀에게 더 물어보기"로만 (§12-Q56)

import { test, expect } from './support/test';
import { stage } from './support/content';
import { openTutorChat, outputPanel, runCode } from './support/quest';
import type { Page } from '@playwright/test';

const quest = stage(1).quests[0];

async function gotoQuest(page: Page) {
  const intro = page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/tutor/stream') &&
      res.request().postDataJSON()?.type === 'quest_intro',
  );
  await page.goto(`/quest/${quest.id}`);
  await intro;
  // 소개가 오면 닫힌 줄에 새 이야기 1
  await expect(page.getByTestId('ask-unread')).toHaveText(/^1/);
}

/** "무엇을 하면 돼요?"(지금 할 일) → "개념만 알려 줘요"(저장된 답변) */
async function askWhat(page: Page) {
  const chat = await openTutorChat(page);
  // 키가 없는 아이에게 기본 튜터 안내 (예전 책 위 띠)
  await expect(chat.getByTestId('api-key-note')).toContainText('나만의 API 키');
  await expect(chat.getByTestId('chat-tutor')).toHaveCount(1);
  // 아직 실행하지 않았으면 "왜 이렇게 나왔어요?"는 없음
  await expect(chat.getByTestId('ask-why')).toHaveCount(0);

  // 무엇을 하면 돼요? = 소개 되풀이가 아니라 해 볼 일 + 지금 상태 (LLM 요청 없음, Q58)
  let streamed = 0;
  const count = (req: { url(): string }) => {
    if (req.url().endsWith('/api/tutor/stream')) streamed++;
  };
  page.on('request', count);
  await chat.getByTestId('ask-what').click();
  await expect(chat.getByTestId('chat-student')).toHaveText(
    /무엇을 하면 돼요\?/,
  );
  await expect(chat.getByTestId('chat-tutor')).toHaveCount(2);
  const todo = chat.getByTestId('chat-tutor').last();
  await expect(todo).toContainText('지금 할 일');
  await expect(todo).toContainText('코드 돌려보기');
  await expect(todo).not.toContainText(quest.fallbackText);
  page.off('request', count);
  expect(streamed).toBe(0);

  // 개념만 알려 줘요 = concept_explain (키 없음 → 학습 주제로 만든 저장된 답변)
  const concept = page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/tutor/stream') &&
      res.request().postDataJSON()?.type === 'concept_explain',
  );
  await chat.getByTestId('ask-concept').click();
  expect((await concept).status()).toBe(200);
  await expect(chat.getByTestId('chat-student').last()).toHaveText(
    /개념만 알려 줘요/,
  );
  await expect(chat.getByTestId('chat-tutor')).toHaveCount(3);
  await expect(chat.getByTestId('chat-tutor').last()).toContainText(
    '저장된 답변',
  );
  await expect(chat.getByTestId('chat-tutor').last()).toContainText(
    '배우는 개념은',
  );
  await expect(chat.getByTestId('ask-what')).toBeEnabled();
  // 펼친 동안 온 말은 읽은 것
  await expect(page.getByTestId('ask-unread')).toHaveCount(0);
  return chat;
}

test.describe('파이뱀에게 물어보기 · 1280 (이야기 쪽 안에서 펼침)', () => {
  test('펼치기 → 질문 → 접기, 대화는 안에서만 스크롤', async ({ page }) => {
    await gotoQuest(page);
    const row = page.getByTestId('ask-pybaem');
    await expect(row).toHaveAttribute('aria-expanded', 'false');

    const chat = await askWhat(page);
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // 대화 높이는 화면 절반 정도로 묶임
    const log = await chat.getByTestId('chat-log').boundingBox();
    expect(log!.height).toBeLessThanOrEqual(720 * 0.5);

    await row.click();
    await expect(page.getByTestId('ask-panel')).toHaveCount(0);
    await expect(row).toHaveAttribute('aria-expanded', 'false');
  });

  test('실행 결과는 AI를 자동으로 부르지 않고, "파이뱀에게 더 물어보기"를 누르면 대화가 열리며 그 결과로 묻는다 (Q56)', async ({
    page,
  }) => {
    const feedback: Array<{ stderr: string }> = [];
    page.on('request', (req) => {
      if (!req.url().endsWith('/api/tutor/stream')) return;
      const body = req.postDataJSON();
      if (body?.type === 'code_feedback')
        feedback.push({ stderr: body.execution_result?.stderr ?? '' });
    });
    await gotoQuest(page);
    await openTutorChat(page);
    await page.getByTestId('ask-pybaem').click(); // 접기 (소개는 읽음)
    await expect(page.getByTestId('ask-unread')).toHaveCount(0);

    // 오류: 규칙표 설명은 바로, AI 피드백·새 이야기 배지는 없음
    await runCode(page, 'print(x)');
    const output = outputPanel(page);
    await expect(output).toHaveAttribute('data-state', 'error');
    await expect(page.getByTestId('quest-dialogue')).toContainText('버그');
    await page.waitForTimeout(500);
    expect(feedback).toEqual([]);
    await expect(page.getByTestId('ask-unread')).toHaveCount(0);

    // 오류 쪽지의 버튼 → 대화가 펼쳐지고 그 오류로 code_feedback
    const fed = page.waitForRequest(
      (req) =>
        req.url().endsWith('/api/tutor/stream') &&
        req.postDataJSON()?.type === 'code_feedback',
    );
    await page
      .locator('[data-testid="bugbug-aside"]:visible')
      .getByTestId('ask-more')
      .click();
    await fed;
    const chat = page.getByTestId('ask-panel');
    await expect(page.getByTestId('ask-pybaem')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(chat.getByTestId('chat-student')).toHaveText(
      /왜 이렇게 나왔어요\?/,
    );
    await expect(chat.getByTestId('chat-tutor')).toHaveCount(2);
    expect(feedback).toHaveLength(1);
    expect(feedback[0].stderr).toContain('NameError');

    // 출력이 다름도 자동 호출 없음, 견줘 보기의 같은 버튼으로만
    await runCode(page, 'print("hello")');
    await expect(output).toHaveAttribute('data-verdict', 'diff');
    await page.waitForTimeout(500);
    expect(feedback).toHaveLength(1);
    await output.getByTestId('ask-more').click();
    await expect(chat.getByTestId('chat-tutor')).toHaveCount(3);
    expect(feedback).toHaveLength(2);
    expect(feedback[1].stderr).toBe('');
  });
});

test.describe('파이뱀에게 물어보기 · 360 터치 (바텀시트)', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('시트 열기 → 질문 → 닫기', async ({ page }) => {
    await gotoQuest(page);
    const row = page.getByTestId('ask-pybaem');
    await expect(row).toHaveAttribute('aria-haspopup', 'dialog');

    const chat = await askWhat(page);
    const sheet = page.getByRole('dialog', { name: '파이뱀에게 물어보기' });
    await expect(sheet).toBeVisible();
    // 질문 버튼 줄이 시트 안 화면에 보임 (대화만 스크롤)
    await expect(chat.getByTestId('ask-what')).toBeInViewport();

    await sheet.getByRole('button', { name: '닫기' }).click();
    await expect(sheet).toBeHidden();
    await expect(row).toBeFocused();
  });

  test('결과 쪽 오류 쪽지에서 "파이뱀에게 더 물어보기" → 바텀시트가 열리며 질문 (Q56)', async ({
    page,
  }) => {
    await gotoQuest(page);
    await page.getByRole('tab', { name: /공책/ }).tap();
    await runCode(page, 'print(x)');
    // 실행하면 결과 쪽으로 넘어가고, 이야기 쪽(물어보기 줄)은 안 보이는 채로 시트만 열린다
    await page.getByTestId('ask-more').filter({ visible: true }).tap();
    const sheet = page.getByRole('dialog', { name: '파이뱀에게 물어보기' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('chat-student')).toHaveText(
      /왜 이렇게 나왔어요\?/,
    );
    await expect(sheet.getByTestId('chat-tutor')).toHaveCount(2);
  });
});
