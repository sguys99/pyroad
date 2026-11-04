// LLM 폴백 (B18 SSE 프로토콜). e2e 서버는 LLM 키를 모두 빈 값으로 띄우므로(support/env.ts) 외부 호출 없이
// 서버가 저장된 답변을 SSE 로 보낸다: delta → done{is_fallback:true} → 화면에 "저장된 답변" 배지 (P1-21)

import { test, expect } from './support/test';
import { stage } from './support/content';
import { outputPanel, setCode, waitForRunner } from './support/quest';

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

    // 대화 패널에 prompt_skeleton.fallback_text 가 "저장된 답변" 배지와 함께
    await expect(page.getByText(quest.fallbackText)).toBeVisible();
    await expect(page.getByText('저장된 답변').first()).toBeVisible();
  });

  test('API 키 없이 힌트 요청 시 정적 힌트 표시', async ({ page }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
    await expect(page.getByText(quest.fallbackText)).toBeVisible();

    await page.getByRole('button', { name: '힌트 받기' }).click();
    await expect(page.getByText(quest.hints[0])).toBeVisible();
    await expect(page.getByText('저장된 답변')).toHaveCount(2);
  });

  test('정답 피드백·격려도 저장된 답변으로 이어서 나온다', async ({ page }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
    await expect(page.getByText('저장된 답변')).toHaveCount(1);

    await setCode(page, quest.solution);
    await page.getByTestId('run-button').click();
    await expect(outputPanel(page)).toContainText('정답이에요!');

    // 소개 1 + 코드 피드백 1 + 격려 1
    await expect(page.getByText('저장된 답변')).toHaveCount(3);
  });
});
