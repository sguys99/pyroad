// 2월드 코드 바다 끝까지 (P10-12, Phase 10 완료 기준 ②): 1월드를 다 깬 새 학생이 2월드를 연다 →
//   화면에서 코드 퀘스트·보너스 퀴즈(2-1), 프로젝트 1단계(2-F 용돈 기입장), 최종 보스 "버그버그 선장"(2-F)을 풀고,
//   나머지는 서버 완료 RPC(앱 완료 API 가 채점 뒤 부르는 함수)로 스테이지 순서대로 끝냄 — 스테이지마다 지도에서 다음 스테이지가 열리는지 확인.
//   끝: 지도 7 스테이지 모두 클리어, 책장에서 코드 바다 "다 읽었어요" · 메이커 시티 "새로 열렸어요!" (P11-14부터 3월드 준비 완료).
// 실력 확인 퀴즈 합격 길(P10-03): 1월드 기록이 없는 새 학생이 책장 → 퀴즈 10문제 모두 맞힘 → 합격 + 배지 → 2월드 첫 스테이지만 열림.
// 정답은 하드코딩하지 않고 content/ YAML(코드 정답)과 service_role(퀴즈·보스·실력 확인 정답)에서 읽는다

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from './support/test';
import {
  adminClient,
  bossKey,
  coinMismatches,
  completeQuests,
  quizKey,
} from './support/admin';
import { allQuestIds, projectQuest, stages } from './support/content';
import { enterQuizAnswer } from './support/quizInput';
import { outputPanel, runCode, waitForRunner } from './support/quest';
import { createSocialUser, deleteSocialUsers } from './support/socialUsers';

const SEA = stages('code-sea');
const PROJECT = projectQuest('code-sea');
// 2-F 의 프로젝트 2개 (코드 퀘스트·보스·퀴즈가 아닌 것)
const PROJECTS = allQuestIds('code-sea').filter(
  (id) =>
    !SEA.some((s) => s.boss?.id === id || s.quests.some((q) => q.id === id)),
);

test.afterAll(deleteSocialUsers);

/** 화면에 보이는 것만 (퀘스트 페이지는 loading.tsx 뒤 스트리밍으로 숨은 사본이 잠깐 같이 있음, B48) */
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

async function expectSeaMap(page: Page, clear: number) {
  await page.goto('/world/code-sea');
  await expect(
    page.getByRole('heading', { level: 1, name: '코드 바다 모험 지도' }),
  ).toBeVisible();
  for (const [i, s] of SEA.entries())
    await expect(node(page, s.id)).toHaveAttribute(
      'data-state',
      i < clear ? 'clear' : i === clear ? /^(?!locked$)/ : 'locked',
    );
}

test('1월드를 다 깬 학생이 2월드 7 스테이지를 끝까지 (코드·퀴즈·프로젝트·최종 보스는 화면에서)', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(300_000);
  expect(SEA).toHaveLength(7);
  expect(PROJECTS).toHaveLength(2);
  const me = await signInNewStudent(context, baseURL!);
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1월드 클리어 → /world 는 코드 바다, 첫 스테이지만 열림
  await completeQuests(
    me,
    allQuestIds().map((id) => ({ id, solution: '' })),
  );
  await page.goto('/world');
  await expect(
    page.getByRole('heading', { level: 1, name: '코드 바다 모험 지도' }),
  ).toBeVisible();
  await expectSeaMap(page, 0);

  // 2-1 코드 퀘스트를 화면에서
  const first = SEA[0].quests[0];
  await page.goto(`/quest/${first.id}`);
  await runCode(page, first.solution);
  await expect(outputPanel(page)).toContainText('정답이에요!');

  // 2-1 보너스 퀴즈를 화면에서
  const quiz = SEA[0].quizzes[0];
  const qk = await quizKey(quiz.id);
  await page.goto(`/quest/${quiz.id}`);
  await enterQuizAnswer(
    page,
    byId(page, 'quiz-card'),
    qk,
    qk.accepted[0],
    false,
  );
  const [graded] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/quest/answer') &&
        r.request().method() === 'POST',
    ),
    byId(page, 'quiz-submit').click(),
  ]);
  expect(graded.status()).toBe(200);
  expect(await graded.json()).toMatchObject({ correct: true });

  // 2-1 ~ 2-6: 남은 코드 퀘스트 + 보스를 서버로 끝내고, 스테이지마다 다음 스테이지가 열림
  for (let i = 0; i < 6; i++) {
    await completeQuests(
      me,
      [
        ...SEA[i].quests.filter((q) => q.id !== first.id),
        { id: SEA[i].boss!.id, solution: '' },
      ],
      { withBoss: false },
    );
    await expectSeaMap(page, i + 1);
  }

  // 2-F 프로젝트 1단계를 화면에서 (단계 통과 박자)
  await page.goto(`/quest/${PROJECT.id}`);
  await runCode(page, PROJECT.steps[0].solution);
  await expect(
    page.getByTestId('step-strip').filter({ visible: true }),
  ).toContainText('1단계 통과!');
  // 프로젝트 2개는 서버로 끝냄 → 최종 보스가 열림
  await completeQuests(
    me,
    PROJECTS.map((id) => ({ id, solution: '' })),
  );

  // 최종 보스 "버그버그 선장"을 화면에서 모두 맞혀 이김 → 2월드 클리어
  const boss = SEA[6].boss!;
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
  await expect(page.getByTestId('celebration-overlay')).toBeVisible({
    timeout: 10_000,
  });

  // 끝: 지도 7 스테이지 모두 클리어, 책장 코드 바다 다 읽음, 메이커 시티 해제 조건은 코드 바다
  await expectSeaMap(page, 7);
  await page.goto('/worlds');
  const book = (slug: string) =>
    page.locator(`.wb-shelf [data-book-slug="${slug}"]`);
  await expect(book('python-island')).toContainText('다 읽었어요');
  await expect(book('code-sea')).toContainText('다 읽었어요');
  // P11-14부터 3월드도 다 써서, 2월드를 끝내면 메이커 시티가 바로 열림
  await expect(book('maker-city')).toContainText('새로 열렸어요!');
  expect(await coinMismatches([me])).toEqual([]);
});

/** 실력 확인 퀴즈 화면(안내 쪽이 떠 있음)에서 시작 → 10문제 모두 정답 → 채점. */
async function passSkillCheck(page: Page) {
  await expect(page.getByTestId('skill-check-intro')).toBeVisible();
  const [started] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/world/skill-check') &&
        r.request().method() === 'POST',
    ),
    page.getByTestId('skill-check-start').click(),
  ]);
  expect(started.status()).toBe(200);
  const { questions } = (await started.json()) as {
    questions: ({ kind: string; question: string } & Record<string, unknown>)[];
  };
  expect(questions).toHaveLength(10);
  const { data: rows, error } = await adminClient()
    .from('skill_check_questions')
    .select('quiz, answer');
  expect(error).toBeNull();
  const card = page.getByTestId('skill-check');
  for (const [i, q] of questions.entries()) {
    const row = rows!.find(
      (r) => (r.quiz as { question: string }).question === q.question,
    )!;
    expect(row, `${i + 1}번 문제 정답 행`).toBeTruthy();
    await expect(page.getByTestId('skill-check-round')).toContainText(
      `문제 ${i + 1} / 10`,
    );
    await enterQuizAnswer(
      page,
      card,
      { kind: q.kind, quiz: q },
      (row.answer as { accepted: unknown[] }).accepted[0],
      false,
    );
    if (i < questions.length - 1)
      await page.getByTestId('skill-check-next').click();
  }
  await page.getByTestId('skill-check-submit').click();
  await expect(page.getByTestId('skill-check-result')).toHaveAttribute(
    'data-passed',
    'true',
  );
}

test('실력 확인 퀴즈 합격: 1월드 기록 없이 10문제를 다 맞히면 2월드 첫 스테이지만 열림', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const me = await signInNewStudent(context, baseURL!);
  await page.setViewportSize({ width: 360, height: 780 });

  await page.goto('/worlds');
  await page
    .locator('.wb-shelf [data-book-slug="code-sea"]')
    .getByRole('link', { name: '실력 확인 퀴즈' })
    .click();
  await expect(page).toHaveURL(/\/world\/code-sea\/skill-check$/);
  await passSkillCheck(page);
  await expect(page.getByTestId('skill-check-score')).toContainText('10');
  await expect(page.getByTestId('skill-check-badge')).toContainText(
    '실력 인정',
  );

  await page.getByTestId('skill-check-go').click();
  // PR CI 러너에서 지도 첫 RSC 응답(합격 직후 다시 계산)이 10초를 넘긴 일이 있어 넉넉히 (B90)
  await expect(page).toHaveURL(/\/world\/code-sea$/, { timeout: 30_000 });
  await expect(node(page, SEA[0].id)).not.toHaveAttribute(
    'data-state',
    'locked',
  );
  for (const s of SEA.slice(1))
    await expect(node(page, s.id)).toHaveAttribute('data-state', 'locked');
  expect(await coinMismatches([me])).toEqual([]);
});

// 스크린샷 (PR 보고용): E2E_SHOTS=<폴더> 일 때만. 360·768·1280
test.describe('2월드 스크린샷', () => {
  const dir = process.env.E2E_SHOTS;
  test.skip(!dir, 'E2E_SHOTS 가 없으면 건너뜀');
  const WIDTHS = [360, 768, 1280];
  const settle = (page: Page) => page.waitForTimeout(1500);

  test('잠긴 지도·실력 확인 퀴즈 안내·합격', async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    mkdirSync(dir!, { recursive: true });
    for (const width of WIDTHS) {
      // 합격은 하루 한 번이라 폭마다 새 학생
      await signInNewStudent(context, baseURL!);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/world/code-sea');
      await settle(page);
      await page.screenshot({ path: join(dir!, `w2-map-locked-${width}.png`) });
      await page.goto('/world/code-sea/skill-check');
      await settle(page);
      await page.screenshot({
        path: join(dir!, `w2-skill-intro-${width}.png`),
        fullPage: true,
      });
      await passSkillCheck(page);
      await page.waitForTimeout(2500); // 컨페티가 지나간 뒤
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: join(dir!, `w2-skill-result-${width}.png`),
        fullPage: true,
      });
    }
  });

  test('열린 지도·코드 퀘스트·보스·업적 도감 코드 바다 띠', async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    mkdirSync(dir!, { recursive: true });
    const me = await signInNewStudent(context, baseURL!);
    // 1월드 + 2-1·2-2 클리어, 2-3 은 코드 퀘스트만 (보스가 기다림)
    await completeQuests(
      me,
      [
        ...allQuestIds().map((id) => ({ id, solution: '' })),
        ...SEA.slice(0, 2).flatMap((s) => [
          ...s.quests,
          { id: s.boss!.id, solution: '' },
        ]),
        ...SEA[2].quests,
      ],
      { withBoss: false },
    );
    const quest = SEA[2].quests[0];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/world/code-sea');
      await settle(page);
      await page.screenshot({ path: join(dir!, `w2-map-open-${width}.png`) });
      await page.goto(`/quest/${quest.id}`);
      // 좁은 화면은 이야기 쪽이 먼저(실행 버튼은 공책 탭) → 실행기 준비는 넓은 화면만 기다림
      if (width >= 1024) await waitForRunner(page);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: join(dir!, `w2-code-quest-${width}.png`) });
      await page.goto(`/quest/${SEA[2].boss!.id}`);
      await expect(byId(page, 'boss-intro')).toBeVisible();
      await settle(page);
      await page.screenshot({ path: join(dir!, `w2-boss-${width}.png`) });
      await page.goto('/profile/achievements');
      const band = page.locator('[data-category="sea"]');
      await band.scrollIntoViewIfNeeded();
      await settle(page);
      await band.screenshot({
        path: join(dir!, `w2-achievements-${width}.png`),
        animations: 'disabled',
      });
    }
  });
});
