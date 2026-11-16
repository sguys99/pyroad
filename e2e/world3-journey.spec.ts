// 3월드 메이커 시티 끝까지 (P11-14, world2-journey 의 3월드 짝): 1·2월드를 다 깬 새 학생이 3월드를 연다 →
//   화면에서 거북이 그림 코드 퀘스트(3-1), 입력 퀘스트를 직접 해 보고 시험 손님으로 채점(3-2), 키 손님 채점(3-6),
//   3-F "나만의 작품" 4단계(기획 도우미 아이디어 카드 → 저장된 카드, 작품 평가 친구 → 저장된 답, 키 없는 e2e 서버),
//   완성 작품 저장 → 갤러리 출품, 최종 보스 "메가 로봇 버그버그"를 풀고, 나머지는 서버 완료 RPC 로 스테이지 순서대로.
//   끝: 지도 7 스테이지 모두 클리어, 책장 메이커 시티 "다 읽었어요", 메이커 업적(첫 작품·첫 전시·명예 시민) 기록.
// 폰(360): 3-2 입력 퀘스트를 대화창에 직접 답해 실행 (데스크톱 입력은 위 테스트) — input() 데스크톱·모바일 완료 기준
// 정답은 하드코딩하지 않고 content/ YAML(코드 정답)과 service_role(퀴즈·보스 정답)에서 읽는다

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from './support/test';
import {
  adminClient,
  bossKey,
  coinMismatches,
  completeQuests,
  grantTestCoins,
} from './support/admin';
import { allQuestIds, projectQuest, stages } from './support/content';
import { enterQuizAnswer } from './support/quizInput';
import {
  outputPanel,
  runButton,
  runCode,
  setCode,
  waitForRunner,
} from './support/quest';
import { createSocialUser, deleteSocialUsers } from './support/socialUsers';

const CITY = stages('maker-city');
// 3월드 프로젝트 7개 (스테이지마다 하나, 3-F 가 마지막)
const PROJECT_IDS = allQuestIds('maker-city').filter(
  (id) =>
    !CITY.some((s) => s.boss?.id === id || s.quests.some((q) => q.id === id)),
);
// 3-F 나만의 작품 = 7번째(마지막) 프로젝트
const FAIR = projectQuest('maker-city', 6);

test.afterAll(deleteSocialUsers);

const byId = (page: Page, id: string) =>
  page.getByTestId(id).filter({ visible: true });

async function signInNewStudent(context: BrowserContext, baseURL: string) {
  const student = await createSocialUser({ onboarded: true });
  await context.clearCookies();
  await context.addCookies(
    (await student.signIn()).map((c) => ({
      ...c,
      url: baseURL,
      sameSite: 'Lax' as const,
    })),
  );
  return student.id;
}

const node = (page: Page, stageId: string) =>
  page.locator(`[data-stage-id="${stageId}"]`).first();

async function expectCityMap(page: Page, clear: number) {
  await page.goto('/world/maker-city');
  await expect(
    page.getByRole('heading', { level: 1, name: '메이커 시티 모험 지도' }),
  ).toBeVisible();
  for (const [i, s] of CITY.entries())
    await expect(node(page, s.id)).toHaveAttribute(
      'data-state',
      i < clear ? 'clear' : i === clear ? /^(?!locked$)/ : 'locked',
    );
}

/** 1·2월드를 다 깬 학생 (서버 완료 RPC) */
async function clearWorlds12(me: string) {
  await completeQuests(
    me,
    [...allQuestIds(), ...allQuestIds('code-sea')].map((id) => ({
      id,
      solution: '',
    })),
  );
}

/** 3월드 스테이지 i 의 남은 것(코드·프로젝트·보스)을 서버로. 프로젝트는 스테이지마다 하나씩 스테이지 순서대로 */
async function finishStage(me: string, i: number, skip: string[] = []) {
  const s = CITY[i];
  await completeQuests(
    me,
    [
      ...s.quests,
      { id: PROJECT_IDS[i], solution: '' },
      ...(s.boss ? [{ id: s.boss.id, solution: '' }] : []),
    ].filter((q) => !skip.includes(q.id)),
    { withBoss: false },
  );
}

async function closeCelebrations(page: Page) {
  const overlay = page.getByTestId('celebration-overlay');
  await expect(overlay).toBeVisible({ timeout: 10_000 });
  await expect(async () => {
    if (await overlay.isVisible()) await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

test('1·2월드를 다 깬 학생이 3월드 7 스테이지를 끝까지 (그림·입력·키 손님·3-F 작품·출품·최종 보스는 화면에서)', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(480_000);
  expect(CITY).toHaveLength(7);
  expect(PROJECT_IDS).toHaveLength(7);
  expect(FAIR.steps).toHaveLength(4);
  const me = await signInNewStudent(context, baseURL!);
  await page.setViewportSize({ width: 1280, height: 900 });
  await clearWorlds12(me);
  await expectCityMap(page, 0);

  // 3-1 거북이 그림 코드 퀘스트: 그림 규칙 채점 (서버가 명령을 다시 분석)
  const square = CITY[0].quests[0];
  await page.goto(`/quest/${square.id}`);
  await runCode(page, square.solution);
  await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass');
  await expect(byId(page, 'turtle-stage')).toBeVisible();
  await finishStage(me, 0, [square.id]);
  await expectCityMap(page, 1);

  // 3-2 입력 퀘스트: 데스크톱에서 직접 답해 보기(채점 없음) → 시험 손님 부르기로 채점
  const hello = CITY[1].quests[0];
  await page.goto(`/quest/${hello.id}`);
  await runCode(page, hello.solution);
  const field = byId(page, 'input-reply-field');
  await field.fill('콩콩');
  await field.press('Enter');
  await expect(outputPanel(page)).toHaveAttribute('data-state', 'success');
  await expect(outputPanel(page)).toContainText('콩콩');
  await byId(page, 'grade-button').click();
  await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass');
  const guests = byId(page, 'test-guests');
  await expect(guests.getByTestId('test-guest').first()).toHaveAttribute(
    'data-passed',
    'true',
  );
  for (let i = 1; i < 5; i++) {
    await finishStage(me, i, i === 1 ? [hello.id] : []);
    await expectCityMap(page, i + 1);
  }

  // 3-6 키 손님: 화살표 손님이 키를 눌러 채점 (잠 건너뛰기)
  const arrow = CITY[5].quests[1];
  await page.goto(`/quest/${arrow.id}`);
  await waitForRunner(page);
  await setCode(page, arrow.solution);
  await byId(page, 'grade-button').click();
  await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass', {
    timeout: 30_000,
  });
  await finishStage(me, 5, [arrow.id]);
  await expectCityMap(page, 6);

  // 3-F 나만의 작품: 1단계 기획 도우미 (키 없음 → 저장된 아이디어 카드)
  await page.goto(`/quest/${FAIR.id}`);
  const planner = byId(page, 'maker-planner');
  await expect(planner).toBeVisible({ timeout: 20_000 });
  await planner.getByTestId('maker-card-game').click();
  const chat = byId(page, 'ask-panel');
  await expect(chat).toContainText('나만의 미니 게임', { timeout: 20_000 });
  await expect(chat).toContainText('kind = "게임"');
  await runCode(page, FAIR.steps[0].solution);
  await expect(byId(page, 'step-strip')).toContainText('1단계 통과!');
  for (const [k, step] of FAIR.steps.slice(1, 3).entries()) {
    await waitForRunner(page);
    await runCode(page, step.solution);
    await expect(byId(page, 'step-strip')).toContainText(`${k + 2}단계 통과!`, {
      timeout: 30_000,
    });
  }
  // 4단계: 아직 크레딧 없는 작품을 끝까지 돌려 작품 평가 친구에게 (채점은 떨어지지만 실행은 성공)
  await waitForRunner(page);
  await runCode(page, FAIR.steps[2].solution);
  await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'diff');
  const feedback = byId(page, 'maker-feedback');
  await feedback.getByTestId('maker-feedback-ask').click();
  await expect(chat).toContainText('잘한 점', { timeout: 20_000 });
  await expect(chat).toContainText('다음엔 무엇을 더하고 싶어요?');
  // 크레딧을 붙여 완성 → 퀘스트 완료
  await runCode(page, FAIR.steps[3].solution);
  await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass', {
    timeout: 30_000,
  });
  await closeCelebrations(page);

  // 완성 작품 저장 → 갤러리 출품 (3월드 프로젝트 완료라 출품 자격)
  const bar = page.locator('[data-testid="save-creation-bar"]:visible');
  await bar.getByTestId('save-creation-open').click();
  await expect(
    page.getByTestId('save-creation-preview').locator('img'),
  ).toBeVisible();
  await page.getByTestId('save-creation-submit').click();
  await expect(bar).toContainText('내 작품함에 저장했어요');
  const { data: saved } = await adminClient()
    .from('creations')
    .select('id')
    .eq('user_id', me)
    .single();
  await page.goto(`/gallery/${saved!.id}`);
  await page.getByTestId('owner-publish-open').click();
  await page
    .getByTestId('publish-sheet')
    .getByTestId('publish-confirm')
    .check();
  await page.getByTestId('publish-submit').click();
  await expect(page.getByTestId('owner-public')).toBeVisible();

  // 최종 보스 "메가 로봇 버그버그"를 화면에서 모두 맞혀 이김 → 3월드 클리어
  const boss = CITY[6].boss!;
  const key = await bossKey(boss.id);
  await page.goto(`/quest/${boss.id}`);
  await expect(byId(page, 'boss-intro')).toBeVisible();
  const post = async (testId: string) => {
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith('/api/quest/boss') &&
          r.request().method() === 'POST',
      ),
      byId(page, testId).click(),
    ]);
    expect(res.status()).toBe(200);
    return (await res.json()) as { correct: boolean | null; result: string };
  };
  await post('boss-start');
  let last = null;
  for (let i = 0; i < key.rounds.length; i++) {
    await expect(byId(page, 'boss-round')).toContainText(
      `문제 ${i + 1} / ${key.rounds.length}`,
    );
    await enterQuizAnswer(
      page,
      byId(page, 'boss-card'),
      key.rounds[i],
      key.rounds[i].accepted[0],
      false,
    );
    last = await post('boss-submit');
    expect(last.correct).toBe(true);
    if (i < key.rounds.length - 1) await byId(page, 'boss-next').click();
  }
  expect(last).toMatchObject({ result: 'win' });
  await expect(byId(page, 'boss-won')).toBeVisible({ timeout: 10_000 });

  // 끝: 지도 7 스테이지 모두 클리어, 책장 메이커 시티 다 읽음, 메이커 업적
  await expectCityMap(page, 7);
  await page.goto('/worlds');
  await expect(
    page.locator('.wb-shelf [data-book-slug="maker-city"]'),
  ).toContainText('다 읽었어요');
  const { data: got } = await adminClient()
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', me);
  expect(got!.map((r) => r.achievement_id)).toEqual(
    expect.arrayContaining([
      'maker_first_save',
      'maker_first_post',
      'maker_boss_first',
      'maker_citizen',
    ]),
  );
  expect(await coinMismatches([me])).toEqual([]);
});

test.describe('폰 입력 (360)', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('3-2 입력 퀘스트: 폰 대화창에 직접 답해 실행', async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const me = await signInNewStudent(context, baseURL!);
    await clearWorlds12(me);
    await finishStage(me, 0);
    const hello = CITY[1].quests[0];
    await page.goto(`/quest/${hello.id}`);
    await page.getByRole('tab', { name: /공책/ }).tap();
    await waitForRunner(page);
    await setCode(page, hello.solution);
    await runButton(page).tap();
    const field = byId(page, 'input-reply-field');
    await expect(field).toBeInViewport();
    await expect(field).toHaveAttribute('enterkeyhint', 'send');
    await field.fill('별똥');
    await field.press('Enter');
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'success');
    await expect(outputPanel(page)).toContainText('별똥');
  });
});

// 스크린샷 (PR 보고용): E2E_SHOTS=<폴더> 일 때만. 360·768·1280
test.describe('3월드 스크린샷', () => {
  const dir = process.env.E2E_SHOTS;
  test.skip(!dir, 'E2E_SHOTS 가 없으면 건너뜀');

  test('3-F 메이커 작업대·보스·업적 도감 메이커 띠·상점', async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    mkdirSync(dir!, { recursive: true });
    const me = await signInNewStudent(context, baseURL!);
    await clearWorlds12(me);
    for (let i = 0; i < 6; i++) await finishStage(me, i);
    await grantTestCoins(me, 5000);
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/world/maker-city');
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: join(dir!, `p11-14-map-${width}.png`),
      });
      await page.goto(`/quest/${FAIR.id}`);
      const planner = byId(page, 'maker-planner');
      await planner.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      await planner.screenshot({
        path: join(dir!, `p11-14-planner-${width}.png`),
        animations: 'disabled',
      });
      await page.goto(`/quest/${CITY[6].boss!.id}`);
      await expect(byId(page, 'boss-intro')).toBeVisible();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(dir!, `p11-14-boss-${width}.png`) });
      await page.goto('/profile/achievements');
      const band = page.locator('[data-category="maker"]');
      await band.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await band.screenshot({
        path: join(dir!, `p11-14-achievements-${width}.png`),
        animations: 'disabled',
      });
      await page.goto('/shop');
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: join(dir!, `p11-14-shop-${width}.png`),
        fullPage: true,
      });
    }
  });
});
