// 보스 배틀 (P9-12): 스테이지 코드 퀘스트를 다 끝낸 학생이 1단계 보스와 싸운다.
//   승리 경로(1280): 도전! → 1번 문제 한 번 틀림(하트 2/3, 무대·낭독 글자) → 모두 맞힘(HP n→0) → 승리 쪽(별 2 = 남은 하트) +
//     스테이지 클리어 축하 + 다음 스테이지로 · 자랑하기 → 원장 quest/<보스> 20 + 별 2×5, 잔액 = 원장, XP 별 2 × xp_reward/3, 2단계 열림
//   패배 → 다시 도전(360): 세 번 틀림 → 패배 쪽(다시 도전 · 복습하러 가기 = 관련 퀘스트) → 다시 도전 → 하트 3으로 새 판 → 이김(별 3)
//   잠긴 보스: 코드 퀘스트가 남으면 도전 버튼 없이 안내, API 도 409 boss_locked
// 응답에는 정답이 없다(오답 응답 본문에 accepted·정답 id 없음). 정답은 service_role 로 quest_answer_keys 에서 읽는다

import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './support/test';
import {
  adminClient,
  bestStars,
  bossKey,
  coinMismatches,
  completeQuests,
  totalXp,
} from './support/admin';
import { stage } from './support/content';
import { createSocialUser, deleteSocialUsers } from './support/socialUsers';
import { enterQuizAnswer } from './support/quizInput';
import { stageButton } from './support/quest';

const s1 = stage(1);
const s2 = stage(2);
const BOSS = s1.boss!;

test.afterAll(deleteSocialUsers);

type Key = Awaited<ReturnType<typeof bossKey>>;

/** 화면에 보이는 것만 (퀘스트 페이지는 loading.tsx 뒤 스트리밍으로 숨은 사본이 잠깐 같이 있음, B48) */
const byId = (page: Page, id: string) =>
  page.getByTestId(id).filter({ visible: true });

/** 라운드의 n번째 틀린 답 (화면에 있는 다른 보기·수정안). 틀린 답은 흐려져 다시 못 고르므로 매번 다른 것 */
function wrongAnswer(r: Key['rounds'][number], n = 0): unknown {
  switch (r.kind) {
    case 'multiple_choice':
      return (r.quiz.options as { id: string }[]).filter(
        (o) => !r.accepted.includes(o.id),
      )[n].id;
    case 'bug_hunt': {
      const right = r.accepted[0] as { line: string; fix: string };
      const fix = (r.quiz.fixes as { id: string }[]).filter(
        (f) => f.id !== right.fix,
      )[n].id;
      return { line: right.line, fix };
    }
    default:
      throw new Error(`[e2e] 틀린 답을 만들 수 없는 종류 ${r.kind}`);
  }
}

async function post(page: Page, testId: string) {
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/quest/boss') && r.request().method() === 'POST',
    ),
    byId(page, testId).click(),
  ]);
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    correct: boolean | null;
    round: number;
    hearts: number;
    result: string | null;
    reward: Record<string, unknown> | null;
  };
}

async function answer(page: Page, key: Key, i: number, value: unknown) {
  await enterQuizAnswer(
    page,
    byId(page, 'boss-card'),
    key.rounds[i],
    value,
    false,
  );
  return post(page, 'boss-submit');
}

/** i번째 문제부터 끝까지 맞힘 (마지막 문제 뒤엔 다음 문제 버튼이 없음) */
async function winFrom(page: Page, key: Key, from: number) {
  let last;
  for (let i = from; i < key.rounds.length; i++) {
    await expect(byId(page, 'boss-round')).toContainText(
      `문제 ${i + 1} / ${key.rounds.length}`,
    );
    last = await answer(page, key, i, key.rounds[i].accepted[0]);
    expect(last.correct).toBe(true);
    await expect(byId(page, 'boss-hp')).toHaveAttribute(
      'data-hp',
      String(key.rounds.length - i - 1),
    );
    if (i < key.rounds.length - 1) await byId(page, 'boss-next').click();
  }
  return last!;
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test('승리: 한 번 틀리고 모두 맞히면 별 2 · 보상 원장 일치 · 스테이지 클리어 → 다음 스테이지', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.setTimeout(150_000);
  const student = await createSocialUser({ onboarded: true });
  await context.clearCookies();
  await context.addCookies(
    (await student.signIn()).map((c) => ({
      ...c,
      url: baseURL!,
      sameSite: 'Lax' as const,
    })),
  );
  const me = student.id;
  await completeQuests(me, s1.quests, { withBoss: false });
  const xpBefore = await totalXp(me);
  const key = await bossKey(BOSS.id);

  await page.setViewportSize({ width: 1280, height: 900 });
  // 지도: 코드 퀘스트를 다 끝낸 1단계 노드에 "보스!" · 시트 맨 아래 보스 줄(잠김 딱지 없음)
  await page.goto('/world');
  const bossChip = page.getByTestId('stage-node-boss');
  await expect(bossChip).toBeVisible();
  await expect(
    page.locator(`.wn[data-stage-id="${s1.id}"] .wn-hit`),
  ).toHaveAttribute('aria-label', /보스가 기다려요/);
  // 노드 둘레만 (노드는 반복 연출이 있어 요소 스크린샷의 "멈춤" 기다리기를 쓰지 않음)
  await bossChip.scrollIntoViewIfNeeded();
  const node = (await page
    .locator(`.wn[data-stage-id="${s1.id}"]`)
    .boundingBox())!;
  await page.screenshot({
    path: testInfo.outputPath('boss-map-node-1280.png'),
    clip: {
      x: Math.max(0, node.x - 120),
      y: Math.max(0, node.y - 160),
      width: node.width + 240,
      height: node.height + 220,
    },
  });
  await stageButton(page, s1.title).click();
  const sheet = page.getByTestId('stage-sheet');
  await expect(sheet.locator('.ss-row[data-kind="boss"]')).toContainText(
    BOSS.title,
  );
  await expect(sheet.getByTestId('stage-sheet-boss-lock')).toHaveCount(0);
  await page.goto(`/quest/${BOSS.id}`);
  // 등장: 보스 한마디 · 하트 3/3 · HP 5/5 · 규칙 · 도전!
  await expect(byId(page, 'boss-intro')).toBeVisible();
  await expect(byId(page, 'boss-line')).toContainText(key.intro);
  await expect(byId(page, 'boss-hearts')).toHaveAttribute(
    'aria-label',
    '하트 3개 남음',
  );
  await expect(byId(page, 'boss-hp').getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    `보스 HP ${key.rounds.length}/${key.rounds.length}`,
  );
  await shot(page, testInfo, 'boss-intro-1280');

  const started = await post(page, 'boss-start');
  expect(started).toMatchObject({ round: 0, hearts: 3, result: null });

  // 1번 문제 틀림 → 하트 2/3, 같은 문제, 응답에 정답 없음
  const [resWrong] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/quest/boss')),
    (async () => {
      await enterQuizAnswer(
        page,
        byId(page, 'boss-card'),
        key.rounds[0],
        wrongAnswer(key.rounds[0]),
        false,
      );
      await byId(page, 'boss-submit').click();
    })(),
  ]);
  const wrongBody = await resWrong.text();
  expect(JSON.parse(wrongBody)).toMatchObject({
    correct: false,
    hearts: 2,
    round: 0,
  });
  expect(wrongBody).not.toContain(JSON.stringify(key.rounds[0].accepted[0]));
  expect(wrongBody).not.toMatch(/accepted/);
  await expect(byId(page, 'boss-hearts')).toHaveAttribute(
    'aria-label',
    '하트 2개 남음',
  );
  await expect(byId(page, 'boss-verdict')).toHaveAttribute(
    'data-status',
    'wrong',
  );
  await expect(page.getByTestId('boss-announce')).toHaveText(
    `아쉬워요. 하트 2개 남음, 보스 HP ${key.rounds.length}/${key.rounds.length}.`,
  );
  await expect(byId(page, 'boss-round')).toContainText(
    `문제 1 / ${key.rounds.length}`,
  );
  await shot(page, testInfo, 'boss-hurt-1280');

  const last = await winFrom(page, key, 0);
  expect(last).toMatchObject({ result: 'win', hearts: 2 });
  expect(last.reward).toMatchObject({
    stars: 2,
    best_stars: 2,
    xp_gained: (BOSS.xp / 3) * 2,
    mode: 'first',
  });

  // 승리 쪽 + 스테이지 클리어 축하
  const won = byId(page, 'boss-won');
  await expect(won).toBeVisible({ timeout: 10_000 });
  const overlay = page.getByTestId('celebration-overlay');
  await expect(overlay).toBeVisible({ timeout: 10_000 });
  await shot(page, testInfo, 'boss-won-celebration-1280');
  await overlay.getByRole('button', { name: /모두 닫기|닫기/ }).click();
  await expect(overlay).toBeHidden();
  await expect(won.getByTestId('quest-reward')).toContainText('격파');
  await expect(won.getByTestId('boss-next-stage')).toHaveAttribute(
    'href',
    /\/world/,
  );
  await expect(won.getByTestId('boss-share')).toBeVisible();
  await expect(byId(page, 'boss-hp')).toHaveAttribute('data-hp', '0');
  await shot(page, testInfo, 'boss-won-1280');

  // 서버: 별 2, XP +40(레벨 업과 무관하게 퀘스트 XP), 원장 quest 20 + 별 1·2, 잔액 = 원장
  expect(await bestStars(me, BOSS.id)).toBe(2);
  expect((await totalXp(me)) - xpBefore).toBe((BOSS.xp / 3) * 2);
  const { data: ledger } = await adminClient()
    .from('coin_ledger')
    .select('source, ref, delta')
    .eq('user_id', me)
    .like('ref', `${BOSS.id}%`)
    .order('ref');
  expect(ledger).toEqual([
    { source: 'quest', ref: BOSS.id, delta: 20 },
    { source: 'star', ref: `${BOSS.id}:1`, delta: 5 },
    { source: 'star', ref: `${BOSS.id}:2`, delta: 5 },
  ]);
  expect(await coinMismatches([me])).toEqual([]);

  // 다음 스테이지로 → 지도에서 2단계가 열림
  await won.getByTestId('boss-next-stage').click();
  await expect(page).toHaveURL(/\/world/);
  await expect(stageButton(page, s2.title)).toBeEnabled({ timeout: 15_000 });
});

test('패배 → 다시 도전: 하트 0이면 격려 + 다시 도전·복습하러 가기, 새 판은 하트 3으로 (360)', async ({
  page,
  e2eUser,
}, testInfo) => {
  test.setTimeout(120_000);
  await completeQuests(e2eUser.id, s1.quests, { withBoss: false });
  const key = await bossKey(BOSS.id);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/quest/${BOSS.id}`);
  await post(page, 'boss-start');
  // 1번 문제(객관식, 틀린 보기 3개)를 세 번 다르게 틀려 진다 → 복습은 그 문제의 관련 퀘스트
  for (const [n, hearts] of [2, 1, 0].entries()) {
    const r = await answer(page, key, 0, wrongAnswer(key.rounds[0], n));
    expect(r.hearts).toBe(hearts);
    if (hearts === 1) await shot(page, testInfo, 'boss-battle-360');
  }
  const lost = byId(page, 'boss-lost');
  await expect(lost).toBeVisible({ timeout: 10_000 });
  await expect(lost).toContainText('다시 도전');
  await expect(byId(page, 'boss-hearts')).toHaveAttribute(
    'aria-label',
    '하트 0개 남음',
  );
  await expect(lost.getByTestId('boss-review')).toHaveAttribute(
    'href',
    `/quest/${key.reviewQuests[0]}`,
  );
  // 가로 스크롤 없음
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await lost.scrollIntoViewIfNeeded();
  await shot(page, testInfo, 'boss-lost-360');
  // 진 판은 보상·완료 없음
  expect(await bestStars(e2eUser.id, BOSS.id)).toBe(0);

  // 다시 도전 → 새 판: 하트 3 · 1번 문제부터 · HP 가득
  const again = await post(page, 'boss-retry');
  expect(again).toMatchObject({ round: 0, hearts: 3 });
  await expect(byId(page, 'boss-hearts')).toHaveAttribute(
    'aria-label',
    '하트 3개 남음',
  );
  await expect(byId(page, 'boss-hp')).toHaveAttribute(
    'data-hp',
    String(key.rounds.length),
  );
  const last = await winFrom(page, key, 0);
  expect(last).toMatchObject({ result: 'win', hearts: 3 });
  await expect(byId(page, 'boss-won')).toBeVisible({ timeout: 10_000 });
  expect(await bestStars(e2eUser.id, BOSS.id)).toBe(3);
});

test('잠긴 보스: 코드 퀘스트가 남으면 도전 대신 안내, API 도 막음', async ({
  page,
  e2eUser,
}) => {
  await completeQuests(e2eUser.id, s1.quests.slice(0, 1));
  await page.goto(`/quest/${BOSS.id}`);
  await expect(byId(page, 'boss-locked')).toBeVisible();
  await expect(page.getByTestId('boss-start')).toHaveCount(0);
  const res = await page.request.post('/api/quest/boss', {
    data: { quest_id: BOSS.id, round: 0, answer: null },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).code).toBe('boss_locked');
});
