// LLM 폴백 (B18 SSE 프로토콜). e2e 서버는 LLM 키를 모두 빈 값으로 띄우므로(support/env.ts) 외부 호출 없이
// 서버가 저장된 답변을 SSE 로 보낸다: delta → done{is_fallback:true} → 화면에 "저장된 답변" 배지 (P1-21)

import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  openTutorChat,
  outputPanel,
  setCode,
  waitForRunner,
} from './support/quest';

const quest = stage(1).quests[0];

test.describe('LLM 폴백 동작', () => {
  test('API 키 없이 퀘스트 진입 시 폴백 텍스트 표시', async ({ page }) => {
    const intro = page.waitForResponse(
      (res) =>
        res.url().endsWith('/api/tutor/stream') &&
        res.request().postDataJSON()?.type === 'quest_intro',
    );
    await page.goto(`/quest/${quest.id}`);

    // SSE 응답: 저장된 답변으로 정상 완료
    const res = await intro;
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/event-stream');
    const body = await res.text();
    expect(body).toContain('"is_fallback":true');

    // 닫힌 물어보기 줄에 새 이야기 1 (P6-10) → 열면 prompt_skeleton.fallback_text 가 "저장된 답변" 배지와 함께
    await expect(page.getByTestId('ask-unread')).toHaveText(/^1/);
    const chat = await openTutorChat(page);
    await expect(chat.getByText(quest.fallbackText)).toBeVisible();
    await expect(chat.getByText('저장된 답변').first()).toBeVisible();
  });

  test('API 키 없이 힌트 요청 시 정적 힌트 표시', async ({ page }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
    const chat = await openTutorChat(page);
    await expect(chat.getByText(quest.fallbackText)).toBeVisible();

    await page.getByRole('button', { name: '힌트 받기' }).click();
    await expect(page.getByText(quest.hints[0])).toBeVisible();
    await expect(page.getByText('저장된 답변')).toHaveCount(2);
  });

  test('정답 피드백·격려도 저장된 답변으로 이어서 나온다', async ({ page }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
    await openTutorChat(page);
    await expect(page.getByText('저장된 답변')).toHaveCount(1);

    await setCode(page, quest.solution);
    await page.getByTestId('run-button').click();
    await expect(outputPanel(page)).toContainText('정답이에요!');

    // 소개 1 + 코드 피드백 1 + 격려 1
    await expect(page.getByText('저장된 답변')).toHaveCount(3);
  });

  // v1.0 운영 = 서버 Gemini 키 없음 (§12-Q80, B117): 설정에서 Gemini 를 고르거나 Google 키를 넣는 자리가 없고, 막는 안내 대신 지금 상태를 알림
  test('설정: 서버 키가 없으면 Gemini 선택지·Google 키 칸이 없고 준비된 답 안내', async ({
    page,
  }) => {
    await page.goto('/settings');
    await expect(
      page.getByText('지금은 파이뱀이 준비해 둔 힌트와 답으로 도와줘요'),
    ).toBeVisible();
    await expect(page.getByText('Google Gemini')).toHaveCount(0);
    await expect(page.getByText('aistudio.google.com')).toHaveCount(0);
    await expect(page.getByText('Anthropic Claude').first()).toBeVisible();
  });
});
