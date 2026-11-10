// 월드맵 이어하기 CTA (P5-10): 진행 0 → "모험 시작하기", 하다 만 퀘스트 → 그 퀘스트로, 모바일은 아래 떠 있는 버튼
// (머리 버튼이 지나가면 나타나고, 아래 가운데 쪽지가 뜨면 비켜 줌)

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, PHONE_QUIZ_NOTE_KEY } from './support/test';
import { adminClient, completeQuests } from './support/admin';
import { stage } from './support/content';

const s1 = stage(1);
const head = (page: import('@playwright/test').Page) =>
  page.locator('[data-continue="head"]');

test('진행 0: 지도 머리에 "모험 시작하기" → 첫 퀘스트', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/world');
  const cta = head(page);
  await expect(cta).toContainText('모험 시작하기');
  await expect(cta).toContainText(`1단계 · ${s1.quests[0].title}`);
  // 넓은 화면은 떠 있는 버튼 없음
  await expect(page.getByTestId('continue-float')).toBeHidden();
  await cta.click();
  await expect(page).toHaveURL(new RegExp(`/quest/${s1.quests[0].id}$`));
});

test('하다 만 퀘스트가 있으면 다음 차례보다 그 퀘스트로 "이어서 하기"', async ({
  page,
  e2eUser,
}) => {
  const [q1, , q3] = s1.quests;
  await completeQuests(e2eUser.id, [{ id: q1.id, solution: q1.solution }]);
  // 퀘스트 화면의 자동 저장이 만드는 행과 같은 모양 (처음 코드를 고친 때)
  const { error } = await adminClient().from('user_progress').upsert(
    {
      user_id: e2eUser.id,
      quest_id: q3.id,
      status: 'in_progress',
      code_submitted: 'print("안녕")',
    },
    { onConflict: 'user_id,quest_id' },
  );
  expect(error).toBeNull();

  await page.goto('/world');
  const cta = head(page);
  await expect(cta).toContainText('이어서 하기');
  await expect(cta).toContainText(`1단계 · ${q3.title}`);
  await cta.click();
  await expect(page).toHaveURL(new RegExp(`/quest/${q3.id}$`));
});

test('360px: 지도를 내리면 아래에 떠 있는 이어하기, 쪽지가 뜨면 비켜 줌', async ({
  page,
  e2eUser,
}) => {
  const [q1, q2] = s1.quests;
  await completeQuests(e2eUser.id, [{ id: q1.id, solution: q1.solution }]);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/world');
  const float = page.getByTestId('continue-float');

  // 지도가 하이드레이션 뒤 지금 스테이지(맨 아래)로 스스로 내려간다 → 그 뒤에 맨 위로 (느린 CI 에서 순서가 뒤집혀 B48)
  await expect(page.locator('.world-node[data-current]')).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(head(page)).toBeInViewport();
  await expect(float).toBeHidden();

  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(float).toBeVisible();
  await expect(float).toContainText('이어서 하기');
  await expect(float).toContainText(`1단계 · ${q2.title}`);
  // 가로로 넘치지 않고 화면 안
  const box = (await float.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(box.y + box.height).toBeLessThanOrEqual(740);

  // 잠긴 노드를 누르면 아래 가운데 쪽지 → 떠 있는 버튼은 비킴
  // aria-disabled 라 포인터 클릭 대신 키보드로 (포커스·Enter 는 됨, 스크롤 위치를 바꾸지 않음)
  await page.locator('.wn[data-state="locked"] .wn-hit').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('단계를 통과하면 열려요')).toBeVisible();
  await expect(float).toBeHidden();
  await expect(float).toBeVisible({ timeout: 10_000 }); // 쪽지가 닫히면 돌아옴

  await float.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/quest/${q2.id}$`));
});

// 폰 퀴즈 추천 (P7-11, §12-Q3 C): 이어하기는 그대로 코드 퀘스트, 그 아래 보조로 이 스테이지의 안 푼 퀴즈
test('360px: 이어하기(코드 퀘스트) 아래 "폰에서 하기 좋은 퀴즈", 넓은 화면은 없음', async ({
  page,
  e2eUser,
}) => {
  const [q1, q2] = s1.quests;
  const [z1] = s1.quizzes;
  test.skip(!z1, '1스테이지에 퀴즈가 없음');
  await completeQuests(e2eUser.id, [{ id: q1.id, solution: q1.solution }]);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/world');
  await expect(head(page)).toContainText(q2.title);
  await expect(page.getByTestId('phone-quiz-pick')).toHaveCount(0);

  await page.setViewportSize({ width: 360, height: 740 });
  const pick = page.getByTestId('phone-quiz-pick');
  await expect(pick).toBeVisible();
  await expect(pick).toContainText('폰에서 하기 좋은 퀴즈');
  await expect(pick).toContainText(z1.title);
  // 주 버튼은 여전히 코드 퀘스트
  await expect(head(page)).toContainText(`1단계 · ${q2.title}`);
  const box = (await pick.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(360);

  await pick.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/quest/${z1.id}$`));
});

// 기기당 한 번(본 기록)은 단위 테스트(PhoneQuizNote.test.tsx)가 본다
test('360px 코드 퀘스트 첫 진입: 이 스테이지 퀴즈 쪽지 → 첫 퀴즈로', async ({
  page,
}) => {
  const [, q2] = s1.quests;
  const [z1] = s1.quizzes;
  test.skip(!z1, '1스테이지에 퀴즈가 없음');
  await page.setViewportSize({ width: 360, height: 740 });
  // 공통 픽스처가 "봤음"으로 두므로 지운다 (이 init 스크립트가 뒤에 실행됨)
  await page.addInitScript(
    (key) => localStorage.removeItem(key),
    PHONE_QUIZ_NOTE_KEY,
  );
  await page.goto(`/quest/${q2.id}`);
  const note = page.getByTestId('phone-quiz-note');
  await expect(note).toContainText('폰에선 퀴즈가 더 편해요');
  await note
    .getByRole('link', { name: `퀴즈 ${s1.quizzes.length}개 보기` })
    .click();
  await expect(page).toHaveURL(new RegExp(`/quest/${z1.id}$`));
});

// 스크린샷 (보고용): E2E_SHOTS=<폴더> 일 때만. 360·768·1280 × full·minimal
test.describe('이어하기 스크린샷', () => {
  const dir = process.env.E2E_SHOTS;
  test.skip(!dir, 'E2E_SHOTS 가 없으면 건너뜀');

  test('머리·떠 있는 버튼·첫 스테이지 파이뱀', async ({ page, e2eUser }) => {
    test.setTimeout(240_000);
    mkdirSync(dir!, { recursive: true });
    const q1 = s1.quests[0];
    await completeQuests(e2eUser.id, [{ id: q1.id, solution: q1.solution }]);
    for (const tier of ['full', 'minimal'] as const) {
      const { error } = await adminClient()
        .from('users')
        .update({
          settings: { motion: { tier, reduced: 'off' } },
        })
        .eq('id', e2eUser.id);
      expect(error).toBeNull();
      for (const width of [360, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/world');
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);
        await page.screenshot({
          path: join(dir!, `continue-top-${width}-${tier}.png`),
        });
        if (width < 1024) {
          await page.evaluate(() => window.scrollTo(0, 900));
          await page.waitForTimeout(800);
          await page.screenshot({
            path: join(dir!, `continue-float-${width}-${tier}.png`),
          });
        }
      }
    }
  });
});
