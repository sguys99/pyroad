// 처음부터 끝까지 한 학생 여정 (P12-01): 랜딩 → 카카오 로그인(목업) → 온보딩(만 14세 미만 + 보호자와 함께 동의) →
//   지도에서 1단계 첫 코드 퀘스트 → 보너스 퀴즈 → (남은 코드 퀘스트는 서버 완료 RPC) → 1단계 보스 승리 →
//   보상(XP·코인·별 = 원장, HUD 잔액, 지도 클리어·2단계 열림) → 번 코인으로 상점에서 사서 바로 입기 →
//   프로필 레벨 카드 자랑하기(링크 복사 + 오늘 첫 공유 15코인) → 링크를 받은 사람이 로그인 없이 열람.
// 단계마다 깊은 검사는 각 스펙이 한다(social-login·onboarding·quest-flow·quiz-mobile·boss-battle·shop·share-sheet·share-page).
// 여기는 단계가 이어지는지만: 앞 단계가 만든 상태(세션·동의·코인·장착)가 다음 단계에서 그대로 쓰이는지.
// 로그인 3종의 provider 요청 검사는 social-login.spec.ts, 여정은 카카오 하나로 돈다.

import { test, expect } from './support/test';
import {
  adminClient,
  bestStars,
  bossKey,
  coinBalance,
  coinMismatches,
  completeQuests,
  quizKey,
  totalXp,
} from './support/admin';
import { stage } from './support/content';
import { requireLocalStack } from './support/env';
import { installOAuthMock } from './support/oauthMock';
import { enterQuizAnswer } from './support/quizInput';
import {
  openStageSheet,
  outputPanel,
  runCode,
  stageButton,
} from './support/quest';
import { createSocialUser, deleteSocialUsers } from './support/socialUsers';
import type { Page } from '@playwright/test';

const s1 = stage(1);
const s2 = stage(2);
const BOSS = s1.boss!;
// 가장 싼 물건 중 하나 (150코인). 새 학생이라 가진 것이 없음
const ITEM = { id: 'glasses_round', name: '동글 안경' };

// 로그인부터 시작하므로 공용 사용자 쿠키를 쓰지 않음
test.use({ storageState: { cookies: [], origins: [] } });
test.afterAll(deleteSocialUsers);

/** 화면에 보이는 것만 (퀘스트 페이지는 loading.tsx 뒤 스트리밍으로 숨은 사본이 잠깐 같이 있음, B48) */
const byId = (page: Page, id: string) =>
  page.getByTestId(id).filter({ visible: true });

const coinText = (n: number) => `코인 ${n.toLocaleString('ko-KR')}개`;

test('새 학생 여정: 로그인 → 온보딩 → 코드·퀴즈·보스 → 보상 → 상점 → 자랑하기', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  expect(s1.quizzes.length, '1단계 보너스 퀴즈').toBeGreaterThan(0);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: baseURL,
  });
  const student = await createSocialUser({ onboarded: false });
  const me = student.id;
  const mock = await installOAuthMock(page, {
    supabaseUrl: requireLocalStack().url,
    baseURL: baseURL!,
    provider: 'kakao',
    outcome: 'success',
    signIn: student.signIn,
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1. 로그인: 랜딩 → 시트 → 카카오(목업) → 새 사용자는 온보딩 관문
  await page.goto('/');
  await page.getByRole('button', { name: /모험 시작/ }).click();
  await page
    .getByTestId('login-sheet')
    .getByTestId('social-login-kakao')
    .click();
  await expect(page).toHaveURL(/\/onboarding$/);
  expect(mock.problems(), 'authorize 요청').toEqual([]);

  // 2. 온보딩: 약속 → 나이 모름(= 만 14세 미만) → 보호자와 함께 동의 → 닉네임(추천 그대로) → 색 → 학년 건너뛰기 → 도장 → 튜토리얼 건너뛰기
  await page.getByTestId('agreement-all').check();
  await page.getByTestId('onboarding-next').click();
  await page.locator('[data-year="unknown"]').click();
  await expect(page.getByTestId('age-result')).toBeVisible();
  await page.getByTestId('onboarding-next').click();
  const guardian = page.getByTestId('guardian-panel');
  await guardian.getByTestId('agreement-all').check();
  await page.getByTestId('guardian-relation-mother').click();
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('nickname-hint')).toHaveAttribute(
    'data-status',
    'ok',
  );
  const nickname = await page.getByTestId('nickname-input').inputValue();
  await page.getByTestId('onboarding-next').click();
  await page.locator('[data-skin="green"]').click();
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('grade-skip').click();
  await expect(page.getByTestId('onboarding-step-stamp')).toBeVisible();
  // 보호자 동의를 마쳐 제한 모드가 아님 → 뒤의 자랑하기(공유 쓰기)가 열림
  await expect(page.getByTestId('onboarding-restricted')).toHaveCount(0);
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('tutorial-skip').click();
  await expect(page).toHaveURL(/\/world$/);
  await expect(page.getByRole('heading', { name: '모험 지도' })).toBeVisible();
  expect(await coinBalance(me)).toBe(0);

  // 3. 코드 퀘스트: 지도 → 1단계 시트 → 시작 → 첫 퀘스트 정답
  const first = s1.quests[0];
  const sheet = await openStageSheet(page, s1.title);
  await sheet.getByTestId('stage-sheet-start').click();
  await expect(page).toHaveURL(new RegExp(`/quest/${first.id}$`));
  await runCode(page, first.solution);
  await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass');
  // 완료 행은 채점 응답 뒤 완료 요청이 만든다
  await expect.poll(() => bestStars(me, first.id).catch(() => 0)).toBe(3);

  // 4. 보너스 퀴즈 (1단계 첫 퀴즈)
  const quiz = s1.quizzes[0];
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
  expect(await graded.json()).toMatchObject({ correct: true });

  // 5. 보스: 남은 코드 퀘스트는 서버로 끝내고(화면 흐름은 quest-flow·code-keyboard), 지도의 "보스!" → 모두 맞혀 승리
  await completeQuests(me, s1.quests.slice(1), { withBoss: false });
  await page.goto('/world');
  await expect(page.getByTestId('stage-node-boss')).toBeVisible();
  const xpBefore = await totalXp(me);
  const coinsBefore = await coinBalance(me);
  const key = await bossKey(BOSS.id);
  await page.goto(`/quest/${BOSS.id}`);
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
  const overlay = page.getByTestId('celebration-overlay');
  await expect(overlay).toBeVisible({ timeout: 10_000 });
  await overlay.getByRole('button', { name: /모두 닫기|닫기/ }).click();
  await expect(overlay).toBeHidden();

  // 6. 보상: 하트 3개 그대로 → 별 3, XP = 보스 xp, 코인 = 보스 20 + 별 3×5 (+ 레벨 업 코인), 잔액 = 원장, HUD·지도에 보임
  expect(await bestStars(me, BOSS.id)).toBe(3);
  expect((await totalXp(me)) - xpBefore).toBe(BOSS.xp);
  const coins = await coinBalance(me);
  expect(coins - coinsBefore).toBeGreaterThanOrEqual(20 + 3 * 5);
  expect(await coinMismatches([me])).toEqual([]);
  await byId(page, 'boss-won').getByTestId('boss-next-stage').click();
  await expect(page).toHaveURL(/\/world/);
  await expect(page.getByTestId('hud-coin')).toContainText(coinText(coins));
  await expect(
    page.locator(`[data-stage-id="${s1.id}"]`).first(),
  ).toHaveAttribute('data-state', 'clear');
  await expect(stageButton(page, s2.title)).toBeEnabled({ timeout: 15_000 });
  // 2단계 해제 연출 중 누르면 연출만 건너뛰므로(P5-05) 끝난 뒤 다음으로
  await expect(page.locator('.world-node[data-unlock]')).toHaveCount(0, {
    timeout: 15_000,
  });

  // 7. 상점: 번 코인으로 사서 바로 입기 (지원 코인 없음)
  await page
    .getByTestId('world-hud')
    .getByRole('link', { name: '상점', exact: true })
    .click();
  await expect(page).toHaveURL(/\/shop$/);
  const { data: item } = await adminClient()
    .from('shop_items')
    .select('price')
    .eq('id', ITEM.id)
    .single();
  const price = item!.price as number;
  expect(coins, '여정에서 번 코인으로 살 수 있음').toBeGreaterThanOrEqual(
    price,
  );
  await page
    .getByRole('button', { name: new RegExp(`^${ITEM.name},`) })
    .click();
  const shopSheet = page.getByTestId('shop-sheet');
  await shopSheet.getByTestId('shop-buy').click();
  await shopSheet.getByTestId('shop-buy-confirm').click();
  const bought = page.getByTestId('celebration-step-purchase');
  await expect(bought).toContainText(ITEM.name);
  await bought.getByTestId('purchase-wear').click();
  await expect(page.getByTestId('celebration-overlay')).toHaveCount(0);
  await expect(
    page.locator(`[data-item="${ITEM.id}"]`).first(),
  ).toHaveAttribute('data-state', 'equipped');
  const afterShop = coins - price;
  expect(await coinBalance(me)).toBe(afterShop);
  await expect(page.getByTestId('hud-coin')).toContainText(coinText(afterShop));

  // 8. 자랑하기: 프로필 레벨 카드 → 링크 복사 → 오늘 첫 공유 15코인 → 받은 사람이 로그인 없이 열람
  await page.goto('/profile');
  await page.getByTestId('share-open').click();
  const share = page.getByTestId('share-sheet');
  await expect(share.getByTestId('share-sheet-preview')).toBeVisible();
  await expect(share.getByTestId('share-reward')).toHaveText(
    '오늘 처음 자랑하면 15코인',
  );
  const [rewarded] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/share-cards/reward') &&
        r.request().method() === 'POST',
    ),
    share.getByTestId('share-copy').click(),
  ]);
  expect(await rewarded.json()).toMatchObject({
    coins_earned: 15,
    coins_balance: afterShop + 15,
  });
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/share\/[A-Za-z0-9_-]{22}$/);
  expect(await coinMismatches([me])).toEqual([]);

  const anon = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const visitor = await anon.newPage();
    const res = await visitor.goto(new URL(link).pathname);
    expect(res!.status()).toBe(200);
    await expect(visitor.getByRole('heading', { level: 1 })).toContainText(
      `${nickname}님`,
    );
  } finally {
    await anon.close();
  }
});
