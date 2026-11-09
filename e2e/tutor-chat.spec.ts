// "파이뱀에게 물어보기" (P6-10, §12-Q54). e2e 서버는 LLM 키가 없어 답은 모두 저장된 답변(SSE 폴백).
// 1280: 이야기 쪽 안에서 펼침(높이가 묶여 해 볼 일 카드를 밀어내지 않음) · 360 터치: 바텀시트.
// 닫혀 있을 때 파이뱀이 한 말은 줄에 새 이야기 수 + 미리 보기로, 질문은 정해진 버튼으로 보낸다

import { test, expect } from './support/test';
import { stage } from './support/content';
import { openTutorChat, runCode } from './support/quest';
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

/** "무엇을 하면 돼요?" → 내 말풍선 → 파이뱀 답(저장된 답변) */
async function askWhat(page: Page) {
  const chat = await openTutorChat(page);
  // 키가 없는 아이에게 기본 튜터 안내 (예전 책 위 띠)
  await expect(chat.getByTestId('api-key-note')).toContainText('나만의 API 키');
  await expect(chat.getByTestId('chat-tutor')).toHaveCount(1);
  // 아직 실행하지 않았으면 "왜 이렇게 나왔어요?"는 없음
  await expect(chat.getByTestId('ask-why')).toHaveCount(0);

  await chat.getByTestId('ask-what').click();
  await expect(chat.getByTestId('chat-student')).toHaveText(
    /무엇을 하면 돼요\?/,
  );
  await expect(chat.getByTestId('chat-tutor')).toHaveCount(2);
  await expect(chat.getByTestId('chat-tutor').last()).toContainText(
    '저장된 답변',
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

  test('닫혀 있을 때 온 실행 피드백 → 새 이야기 배지, 열면 "왜 이렇게 나왔어요?"', async ({
    page,
  }) => {
    await gotoQuest(page);
    await openTutorChat(page);
    await page.getByTestId('ask-pybaem').click(); // 접기 (소개는 읽음)
    await expect(page.getByTestId('ask-unread')).toHaveCount(0);

    await runCode(page, 'print("hello")');
    await expect(page.getByTestId('ask-unread')).toHaveText(/^1/);

    const chat = await openTutorChat(page);
    await chat.getByTestId('ask-why').click();
    await expect(chat.getByTestId('chat-student')).toHaveText(
      /왜 이렇게 나왔어요\?/,
    );
    await expect(chat.getByTestId('chat-tutor')).toHaveCount(3);
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
});
