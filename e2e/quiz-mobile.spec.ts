// 모바일 퀴즈 퀘스트 (P7-15): 360px 터치(탭만)로 4종 정답 → 도장·별·XP 띠 → 서버 XP(새로고침 뒤에도),
// 회차 별 규칙(1·2·3번째 정답 3/2/1, 3번 틀리면 정답 공개 + ⭐1), 오답 응답에 정답 없음, 같은 날 다시 풀기 = 연습,
// 퀴즈는 보너스(안 풀어도 다음 스테이지), 오늘의 퀴즈 /daily 3문제·콤보·요약, 페이지 HTML·RSC·JS 에 정답 없음, 가로 스크롤 없음.
// 정답은 하드코딩하지 않고 service_role 로 quest_answer_keys 에서 읽는다 (support/admin.ts quizKey)

import { test, expect } from './support/test';
import {
  coinBalance,
  completeQuests,
  hasCoinKey,
  quizKey,
  totalXp,
} from './support/admin';
import { stage, stages } from './support/content';
import { stageButton } from './support/quest';
import { getXPProgress } from '../src/lib/quest/xp';
import type { Page } from '@playwright/test';

type Key = Awaited<ReturnType<typeof quizKey>>;
type Answer = unknown;
interface Graded {
  correct: boolean;
  attempt_no: number;
  mode: string;
  stars: number;
  xp_awarded: number;
  total_xp: number;
  explanation: string | null;
  revealed: { answer: unknown; explanation: string } | null;
  next_quiz: unknown;
  coins_earned: number;
  coins_balance: number;
  level_ups: { level: number; coins: number }[];
}

/** 화면에 보이는 것만: 퀘스트·/daily 페이지는 loading.tsx 뒤에 스트리밍되어 바꿔 끼우는 순간 숨은 사본이 같이 있음 (B48) */
const byId = (page: Page, id: string) =>
  page.getByTestId(id).filter({ visible: true });

const KINDS = ['multiple_choice', 'fill_blank', 'parsons', 'bug_hunt'];

/** 첫 월드에서 그 종류의 첫 퀴즈와, 그 스테이지를 열려면 끝내야 할 앞 스테이지 코드 퀘스트 */
function firstQuiz(kind: string) {
  for (const s of stages()) {
    const q = s.quizzes.find((z) => z.kind === kind);
    if (q)
      return {
        id: q.id,
        before: stages()
          .filter((p) => p.order < s.order)
          .flatMap((p) => p.quests),
      };
  }
  throw new Error(`[e2e] ${kind} 퀴즈가 content/ 에 없음`);
}

const blanks = (code: string) =>
  [...code.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]);

/** 답을 탭으로 넣는다 (값 모양은 content/README 퀴즈 정규형) */
async function tapAnswer(page: Page, key: Key, answer: Answer) {
  const card = byId(page, 'quiz-card');
  switch (key.kind) {
    case 'multiple_choice':
      await card
        .getByTestId('quiz-option')
        .filter({ has: page.locator(`input[value="${answer as string}"]`) })
        .tap();
      return;
    case 'fill_blank': {
      const fill = answer as Record<string, string>;
      const tokens = key.quiz.tokens as { id: string; text: string }[];
      for (const b of blanks(key.quiz.code as string)) {
        const text = tokens.find((t) => t.id === fill[b])!.text;
        await card
          .getByTestId('quiz-token')
          .filter({
            has: page.locator('code').getByText(text, { exact: true }),
          })
          .tap();
      }
      return;
    }
    case 'parsons': {
      const lines = answer as (string | { id: string; indent: number })[];
      for (const [i, x] of lines.entries()) {
        const id = typeof x === 'string' ? x : x.id;
        await card.locator(`[data-tray="${id}"]`).tap();
        for (let k = 0; typeof x !== 'string' && k < x.indent; k++)
          await card
            .getByRole('button', { name: `${i + 1}번째 줄 들여쓰기 늘리기` })
            .tap();
      }
      return;
    }
    case 'bug_hunt': {
      const { line, fix } = answer as { line: string; fix: string };
      await card
        .getByTestId('bughunt-line')
        .filter({ has: page.locator(`input[value="${line}"]`) })
        .tap();
      await card
        .getByTestId('bughunt-fix')
        .filter({ has: page.locator(`input[value="${fix}"]`) })
        .tap();
      return;
    }
  }
  throw new Error(`[e2e] 모르는 퀴즈 종류 ${key.kind}`);
}

/** "정답 확인"을 탭하고 채점 응답 본문 */
async function submit(page: Page): Promise<Graded> {
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/quest/answer') &&
        r.request().method() === 'POST',
    ),
    byId(page, 'quiz-submit').tap(),
  ]);
  expect(res.status()).toBe(200);
  return (await res.json()) as Graded;
}

async function answer(page: Page, key: Key, value: Answer): Promise<Graded> {
  await tapAnswer(page, key, value);
  return submit(page);
}

/** 객관식 오답 보기들 */
function wrongOptions(key: Key): string[] {
  return (key.quiz.options as { id: string }[])
    .map((o) => o.id)
    .filter((id) => !key.accepted.includes(id));
}

/** 오답 응답에 정답이 없음: revealed 없음, 정답 해설·정답 id 없음 (다시 풀 보기 next_quiz 는 모든 보기라 뺌) */
function expectNoAnswerLeak(r: Graded, key: Key) {
  expect(r.correct).toBe(false);
  expect(r.revealed).toBeNull();
  const body = JSON.stringify({ ...r, next_quiz: null });
  for (const id of key.accepted as string[]) expect(body).not.toContain(id);
  expect(body).not.toContain(key.explanation);
  expect(body).not.toMatch(/accepted|is_correct/);
}

async function noHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    '360px 에서 가로 스크롤 없음',
  ).toBe(true);
}

const verdict = (page: Page) => byId(page, 'quiz-verdict');

/** 월드맵 HUD 경험치 막대 (월드 HUD 와 같은 계산) */
async function expectHudXp(page: Page, total: number) {
  await page.goto('/world');
  const { currentLevelXP, nextLevelXP } = getXPProgress(total);
  await expect(
    page
      .getByTestId('world-hud')
      .getByRole('progressbar', { name: '다음 레벨까지 경험치' }),
  ).toHaveAttribute(
    'aria-valuetext',
    nextLevelXP === null
      ? '최고 레벨'
      : `${total - currentLevelXP} / ${nextLevelXP - currentLevelXP} XP`,
  );
}

test.describe('모바일 퀴즈 (360px 터치)', () => {
  test.use({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });

  for (const kind of KINDS) {
    test(`${kind}: 첫 시도 정답 → 도장·별 3개·30 XP, 새로고침 뒤 서버 XP·연습`, async ({
      page,
      e2eUser,
    }) => {
      const quiz = firstQuiz(kind);
      await completeQuests(e2eUser.id, quiz.before);
      const key = await quizKey(quiz.id);
      const before = await totalXp(e2eUser.id);
      // 별 코인 (P8-04): 별 번호마다 처음 한 번 5. 리셋은 원장을 지우지 않아 같은 실행에서 이미 받은 번호는 0
      const coinsBefore = await coinBalance(e2eUser.id);
      const newStars = (
        await Promise.all(
          [1, 2, 3].map((n) =>
            hasCoinKey(e2eUser.id, 'star', `${quiz.id}:${n}`),
          ),
        )
      ).filter((had) => !had).length;

      await page.goto(`/quest/${quiz.id}`);
      await noHorizontalScroll(page);
      const r = await answer(page, key, key.accepted[0]);
      expect(r).toMatchObject({
        correct: true,
        mode: 'first',
        attempt_no: 1,
        stars: 3,
        xp_awarded: 30,
        total_xp: before + 30,
      });
      await expect(verdict(page)).toHaveAttribute('data-status', 'correct');
      await expect(byId(page, 'quiz-verdict-stars')).toContainText('별 3개');
      await expect(verdict(page).locator('.qx-stamp')).toBeVisible();
      await expect(byId(page, 'reward-xp-count')).toHaveText('30');
      const levelCoins = r.level_ups.reduce((n, l) => n + l.coins, 0);
      expect(r.coins_earned - levelCoins).toBe(newStars * 5);
      expect(r.coins_balance).toBe(coinsBefore + r.coins_earned);
      if (newStars > 0)
        await expect(byId(page, 'reward-coins')).toContainText(
          String(newStars * 5),
        );
      await noHorizontalScroll(page);
      expect(await totalXp(e2eUser.id)).toBe(before + 30);

      // 새로고침: 상태바 XP 는 서버 값, 같은 날이라 연습
      await page.reload();
      await expect(
        page
          .getByText(`${before + 30} XP`, { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await expect(
        byId(page, 'quiz-card').getByText('연습', { exact: true }),
      ).toBeVisible();
      await expectHudXp(page, before + 30);
    });
  }

  test('오답 2번 → 정답이면 별 1개, 오답 응답에는 정답이 없음', async ({
    page,
    e2eUser,
  }) => {
    const quiz = firstQuiz('multiple_choice');
    const key = await quizKey(quiz.id);
    const [w1, w2] = wrongOptions(key);
    await page.goto(`/quest/${quiz.id}`);

    for (const [i, w] of [w1, w2].entries()) {
      const r = await answer(page, key, w);
      expect(r).toMatchObject({ attempt_no: i + 1, stars: 0, xp_awarded: 0 });
      expectNoAnswerLeak(r, key);
      await expect(verdict(page)).toHaveAttribute('data-status', 'wrong');
      // 오답 화면에도 정답 표시가 없음
      await expect(
        page.locator('[data-mark="correct"], [data-mark="answer"]'),
      ).toHaveCount(0);
      await byId(page, 'quiz-retry').tap();
    }
    const r = await answer(page, key, key.accepted[0]);
    expect(r).toMatchObject({
      correct: true,
      attempt_no: 3,
      stars: 1,
      xp_awarded: 10,
    });
    await expect(byId(page, 'quiz-verdict-stars')).toContainText('별 1개');
    await expect(byId(page, 'reward-xp-count')).toHaveText('10');
    expect(await totalXp(e2eUser.id)).toBe(10);
  });

  test('오답 3번 → 정답 공개 + 별 1개로 클리어', async ({ page, e2eUser }) => {
    const quiz = firstQuiz('multiple_choice');
    const key = await quizKey(quiz.id);
    const wrong = wrongOptions(key);
    expect(wrong.length).toBeGreaterThanOrEqual(3);
    await page.goto(`/quest/${quiz.id}`);

    for (const w of wrong.slice(0, 2)) {
      expectNoAnswerLeak(await answer(page, key, w), key);
      await byId(page, 'quiz-retry').tap();
    }
    const r = await answer(page, key, wrong[2]);
    expect(r).toMatchObject({
      correct: false,
      attempt_no: 3,
      stars: 1,
      xp_awarded: 10,
      revealed: { answer: key.accepted[0], explanation: key.explanation },
    });
    await expect(verdict(page)).toHaveAttribute('data-status', 'revealed');
    await expect(verdict(page)).toContainText(key.explanation);
    // 공개된 정답 보기에 "정답" 꼬리표
    await expect(
      byId(page, 'quiz-option').filter({
        has: page.locator(`input[value="${key.accepted[0] as string}"]`),
      }),
    ).toContainText('정답');
    await expect(byId(page, 'quest-reward')).toBeVisible();
    await noHorizontalScroll(page);
    expect(await totalXp(e2eUser.id)).toBe(10);
  });

  test('같은 날 다시 풀면 연습: 별·XP 그대로', async ({ page, e2eUser }) => {
    const quiz = firstQuiz('fill_blank');
    const key = await quizKey(quiz.id);
    await page.goto(`/quest/${quiz.id}`);
    await answer(page, key, key.accepted[0]);
    await expect(byId(page, 'reward-xp-count')).toHaveText('30');

    await byId(page, 'quiz-retry').tap();
    const card = byId(page, 'quiz-card');
    await expect(card.getByText('연습', { exact: true })).toBeVisible();
    await expect(byId(page, 'quiz-mode-note')).toContainText(
      '오늘은 연습이에요',
    );
    const r = await answer(page, key, key.accepted[0]);
    expect(r).toMatchObject({
      correct: true,
      mode: 'practice',
      stars: 0,
      xp_awarded: 0,
      total_xp: 30,
    });
    await expect(byId(page, 'quiz-verdict-practice')).toBeVisible();
    await expect(byId(page, 'quest-reward')).toContainText(
      '연습이라 별·XP·코인은 그대로예요',
    );
    await expect(byId(page, 'reward-xp')).toHaveCount(0);
    expect(await totalXp(e2eUser.id)).toBe(30);
  });

  test('퀴즈를 안 풀어도 코드 퀘스트만 끝내면 다음 스테이지가 열림 (보너스)', async ({
    page,
    e2eUser,
  }) => {
    const s1 = stage(1);
    expect(s1.quizzes.length).toBeGreaterThan(0);
    await page.goto('/world');
    await expect(stageButton(page, stage(2).title)).toBeDisabled();
    await completeQuests(e2eUser.id, s1.quests);
    await page.reload();
    await expect(stageButton(page, stage(2).title)).toBeEnabled();
  });

  test('오늘의 퀴즈: 월드맵 카드 → 3문제 연달아 → 콤보 배지 → 요약, 다시 열면 요약', async ({
    page,
  }) => {
    // 새 사용자는 스테이지 1만 열림 → 스테이지 1 퀴즈가 오늘의 퀴즈
    const keys = await Promise.all(stage(1).quizzes.map((q) => quizKey(q.id)));
    expect(keys).toHaveLength(3);

    await page.goto('/world');
    const card = byId(page, 'daily-card');
    await expect(card).toContainText('3문제 남았어요');
    await card.getByTestId('daily-card-go').tap();
    await expect(page).toHaveURL(/\/daily$/);
    await expect(byId(page, 'daily-quiz')).toBeVisible();

    for (let i = 0; i < 3; i++) {
      await expect(verdict(page)).toHaveCount(0);
      // 지금 문제: 문제 글로 찾음 (화면에 퀘스트 id 가 없음)
      const question = (await page
        .getByTestId('quiz-card')
        .locator('h2')
        .textContent())!.trim();
      const key = keys.find((k) => k.quiz.question === question)!;
      expect(key, `오늘의 퀴즈 ${i + 1}번이 스테이지 1 퀴즈`).toBeTruthy();
      const r = await answer(page, key, key.accepted[0]);
      expect(r).toMatchObject({ correct: true, stars: 3, xp_awarded: 30 });
      await expect(verdict(page)).toHaveAttribute('data-status', 'correct');
      if (i > 0)
        await expect(byId(page, 'quiz-combo')).toContainText(`${i + 1}연속`);
      await noHorizontalScroll(page);
      await byId(page, 'next-quest').tap();
    }

    const sum = byId(page, 'daily-summary');
    await expect(sum).toContainText('3문제 중 3문제 맞혔어요');
    await expect(byId(page, 'daily-sum-stars')).toContainText('9');
    await expect(byId(page, 'daily-sum-xp')).toContainText('+90');
    await expect(byId(page, 'daily-sum-combo')).toContainText('3');
    await noHorizontalScroll(page);

    // 다시 열면 요약부터 (XP·콤보는 이 화면에서 본 것만이라 빠짐)
    await page.reload();
    await expect(sum).toContainText('3문제 중 3문제 맞혔어요');
    await expect(byId(page, 'quiz-card')).toHaveCount(0);
    await page.goto('/world');
    await expect(card).toContainText('오늘 퀴즈 완료');
  });

  test('퀴즈 페이지 HTML·RSC·JS 에 정답이 없음', async ({ page, e2eUser }) => {
    const quizzes = KINDS.map(firstQuiz);
    await completeQuests(
      e2eUser.id,
      quizzes
        .flatMap((q) => q.before)
        .filter((q, i, all) => all.findIndex((x) => x.id === q.id) === i),
    );
    const scripts = new Set<string>();
    page.on('response', (r) => {
      if (r.url().includes('/_next/static/') && r.url().endsWith('.js'))
        scripts.add(r.url());
    });
    const secrets: string[] = [];
    for (const quiz of quizzes) {
      const key = await quizKey(quiz.id);
      const forbidden = [
        key.explanation,
        ...Object.values(key.explanations),
        // 객관식 정답은 보기 id 하나(공개 보기에도 있음)라 묶음 정답(빈칸·순서·버그)만
        ...(typeof key.accepted[0] === 'string'
          ? []
          : [JSON.stringify(key.accepted[0])]),
      ];
      secrets.push(...forbidden);
      const url = `/quest/${quiz.id}`;
      const publicId = (
        (key.quiz.options ?? key.quiz.tokens ?? key.quiz.lines) as {
          id: string;
        }[]
      )[0].id;
      const html = await (await page.request.get(url)).text();
      const rsc = await (
        await page.request.get(url, { headers: { RSC: '1' } })
      ).text();
      for (const body of [html, rsc]) {
        // 공개 부분(보기·조각 id)은 실려 있음 = 정말 그 퀴즈 페이지
        expect(body).toContain(publicId);
        expect(body).not.toMatch(/accepted|is_correct|solution_code/);
        for (const s of forbidden) expect(body).not.toContain(s);
        // 정답 보기 표시 (결과 전에는 없어야 함)
        expect(body).not.toMatch(/data-mark="(correct|answer)"/);
      }
      await page.goto(url);
      await expect(byId(page, 'quiz-card')).toBeVisible();
    }
    expect(scripts.size).toBeGreaterThan(0);
    for (const src of scripts) {
      const js = await (await page.request.get(src)).text();
      for (const s of secrets) expect(js, src).not.toContain(s);
    }
  });
});
