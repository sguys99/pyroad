// "파이뱀에게 물어보기" 자유 질문 (P9-17). e2e 서버는 LLM 키가 없어 정상 질문의 답은 저장된 답변(이번 개념 안내).
// 거르기는 서버가 한다: 개인정보를 쓰면 LLM 없이 칸 아래 안내, 질문은 대화에 들어가지 않고 글은 칸에 남아 고칠 수 있음.

import { test, expect } from './support/test';
import { stage } from './support/content';
import { openTutorChat } from './support/quest';
import type { Page } from '@playwright/test';

const quest = stage(1).quests[0];

function freeResponse(page: Page) {
  return page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/tutor') &&
      res.request().postDataJSON()?.type === 'free_question',
  );
}

async function askFree(page: Page, shot: string) {
  await page.goto(`/quest/${quest.id}`);
  const chat = await openTutorChat(page);
  const input = chat.getByTestId('free-ask-input');
  const send = chat.getByTestId('free-ask-send');
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('maxlength', '100');
  await expect(send).toBeDisabled();
  await expect(chat.getByTestId('free-ask-count')).toHaveText('0/100');

  // 정상 질문 → 내 말풍선 → 답 (키 없음 → 저장된 답변)
  const students = chat.getByTestId('chat-student');
  const before = await students.count();
  await input.fill('변수는 왜 써요?');
  await expect(chat.getByTestId('free-ask-count')).toHaveText('9/100');
  const answered = freeResponse(page);
  await input.press('Enter');
  const res = await answered;
  expect(res.status()).toBe(200);
  expect(await res.json()).not.toHaveProperty('blocked');
  await expect(students.last()).toHaveText(/변수는 왜 써요\?/);
  const reply = chat.getByTestId('chat-tutor').last();
  await expect(reply).toContainText('바로 답하기 어려워요');
  await expect(reply).toContainText('저장된 답변');
  await expect(input).toHaveValue('');
  await expect(chat.getByTestId('free-ask-count')).toHaveText(
    /^오늘 \d+번 남음 · 0\/100$/,
  );

  // 개인정보 → 거름 안내, 대화에 들어가지 않고 글은 남음
  const count = await students.count();
  expect(count).toBe(before + 1);
  await input.fill('제 전화번호는 010-1234-5678 이에요');
  const blocked = freeResponse(page);
  await send.click();
  expect((await (await blocked).json()).blocked).toBe('personal');
  const note = chat.getByTestId('free-ask-note');
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('role', 'alert');
  await expect(note).toContainText('전화번호');
  await expect(input).toHaveValue('제 전화번호는 010-1234-5678 이에요');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(students).toHaveCount(count);
  // 눈으로 보는 확인용 (답 + 거름 안내가 함께 보이는 순간)
  await page.screenshot({ path: test.info().outputPath(shot) });
  // 고치기 시작하면 안내가 사라짐
  await input.fill('전화번호부 프로그램은 어떻게 만들어요?');
  await expect(note).toHaveCount(0);
  return chat;
}

test.describe('자유 질문 · 1280', () => {
  test('정상 질문 → 답, 개인정보 → 거름 안내', async ({ page }) => {
    await askFree(page, 'free-question-1280.png');
  });
});

test.describe('자유 질문 · 360 터치 (바텀시트)', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('시트 안에서 묻고 거름 안내까지', async ({ page }) => {
    const chat = await askFree(page, 'free-question-360.png');
    await expect(chat.getByTestId('free-ask-input')).toBeInViewport();
  });
});
