// 첫 로그인 온보딩 "모험가 등록증" + 30초 튜토리얼 (P3-11)
//
// - 공용 테스트 사용자(auth.setup.ts)는 이미 온보딩을 끝낸 상태라, 여기서는 테스트마다 새 사용자를 만들어 로그인한다
//   (로그인 한도 5분 30회 안: 이 파일은 3번). 끝나면 지운다
// - 닉네임 중복은 다른 새 사용자에게 닉네임을 미리 넣어 재현한다 (service_role)

import { randomBytes } from 'node:crypto';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { adminClient, completeQuests } from './support/admin';
import { stage } from './support/content';
import { requireLocalStack } from './support/env';
import { watchCspViolations } from './support/test';

const created: string[] = [];

async function newUser(): Promise<{
  id: string;
  cookies: { name: string; value: string }[];
}> {
  const stack = requireLocalStack();
  const admin = adminClient();
  const email = `e2e-ob-${Date.now()}-${randomBytes(3).toString('hex')}@e2e.pyroad.test`;
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // 실명 모양 이름: 온보딩 입력칸에 제안되면 안 됨 (§2.8)
    user_metadata: { full_name: '김민준' },
  });
  if (error || !data.user)
    throw new Error(`[e2e] 사용자 생성 실패: ${error?.message}`);
  created.push(data.user.id);
  const jar = new Map<string, string>();
  const sb = createServerClient(stack.url, stack.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) =>
        cs.forEach(({ name, value }) =>
          value ? jar.set(name, value) : jar.delete(name),
        ),
    },
  });
  const { error: signInError } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`[e2e] 로그인 실패: ${signInError.message}`);
  return {
    id: data.user.id,
    cookies: [...jar].map(([name, value]) => ({ name, value })),
  };
}

async function openAs(
  browser: Browser,
  baseURL: string,
  cookies: { name: string; value: string }[],
  options: { reducedMotion?: 'reduce' | 'no-preference' } = {},
): Promise<{ page: Page; violations: string[] }> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    locale: 'ko-KR',
    reducedMotion: options.reducedMotion ?? 'no-preference',
  });
  await context.addCookies(
    cookies.map((c) => ({ ...c, url: baseURL, sameSite: 'Lax' as const })),
  );
  const page = await context.newPage();
  const violations = await watchCspViolations(page);
  return { page, violations };
}

test.afterAll(async () => {
  const admin = adminClient();
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

test('새 사용자: 관문 → 약속 → 닉네임(규칙·중복·추천) → 색 → 학년 건너뛰기 → 도장 → 튜토리얼 → 월드맵', async ({
  browser,
  baseURL,
}) => {
  const admin = adminClient();
  // 중복 닉네임 하나를 미리
  const other = await newUser();
  const takenName = `겹침${(randomBytes(2).readUInt16BE() % 9000) + 1000}`;
  await admin.from('users').update({ nickname: takenName }).eq('id', other.id);

  const me = await newUser();
  const { page, violations } = await openAs(browser, baseURL!, me.cookies);

  // 관문: 로그인 화면 어디로 가도 온보딩
  await page.goto('/world');
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByTestId('onboarding-step-agree')).toBeVisible();
  // provider 이름(실명 모양)은 제안하지 않음
  await expect(page.getByTestId('registration-card-compact')).not.toContainText(
    '김민준',
  );

  // 1. 약속: 안 하고 누르면 빠진 항목 안내
  await page.getByTestId('onboarding-next').click();
  await expect(
    page.getByTestId('onboarding-step-agree').getByRole('alert'),
  ).toContainText('동의해야');
  await page.getByTestId('agreement-all').check();
  await page.getByTestId('onboarding-next').click();

  // 2. 닉네임
  await expect(page.getByTestId('onboarding-step-nickname')).toBeVisible();
  const input = page.getByTestId('nickname-input');
  const hint = page.getByTestId('nickname-hint');
  await expect(input).not.toHaveValue('');
  await input.fill('파이 뱀');
  await expect(hint).toHaveAttribute('data-status', 'invalid');
  await expect(hint).toContainText('띄어쓰기');
  await expect(page.getByTestId('onboarding-next')).toBeDisabled();

  await input.fill(takenName.toLowerCase());
  await expect(hint).toHaveAttribute('data-status', 'taken');
  await expect(hint).toContainText('이미 다른 친구가 쓰고 있어요');
  const use = page.getByTestId('nickname-use-suggestion');
  await expect(use).toBeVisible();
  const suggestion = (await use.textContent())!
    .replace(/\s*쓰기\s*$/, '')
    .trim();
  expect(suggestion).toMatch(/\d{2}$/);
  await use.click();
  await expect(input).toHaveValue(suggestion);
  await expect(hint).toHaveAttribute('data-status', 'ok');

  // 주사위: 다른 이름으로 바뀜, 그 뒤 직접 쓰면 그 값이 남음
  await page.getByTestId('nickname-roll').click();
  await expect(input).not.toHaveValue(suggestion);
  // 굴러가는 동안(이름이 몇 번 바뀜)이 끝난 뒤 직접 쓰기
  await expect(
    page.locator('[data-testid="nickname-input"][data-rolling]'),
  ).toHaveCount(0);
  const myName = `별빛${(randomBytes(2).readUInt16BE() % 9000) + 1000}`;
  await input.fill(myName);
  await expect(hint).toHaveAttribute('data-status', 'ok');
  await page.waitForTimeout(500);
  await expect(input).toHaveValue(myName);
  await expect(page.getByTestId('registration-card-compact')).toContainText(
    myName,
  );
  await page.getByTestId('onboarding-next').click();

  // 3. 색: 고르기 전에는 다음 불가, 화살표로 옮기며 고름
  await expect(page.getByTestId('onboarding-step-skin')).toBeVisible();
  await expect(page.getByTestId('onboarding-next')).toBeDisabled();
  const green = page.locator('[data-skin="green"]');
  await green.click();
  await expect(green).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const sunset = page.locator('[data-skin="sunset"]');
  await expect(sunset).toHaveAttribute('aria-checked', 'true');
  await expect(sunset).toBeFocused();
  await expect(
    page.getByRole('radiogroup').getByRole('radio', { checked: true }),
  ).toHaveCount(1);
  await page.getByTestId('onboarding-next').click();

  // 4. 학년: 건너뛰기 → 저장 → 도장
  await expect(page.getByTestId('onboarding-step-grade')).toBeVisible();
  await page.getByTestId('grade-skip').click();
  await expect(page.getByTestId('onboarding-step-stamp')).toBeVisible();
  const card = page.getByTestId('registration-card');
  await expect(card).toContainText(myName);
  await expect(card).toContainText('노을주황');
  await expect(card).toContainText('비밀');
  // 연출 중 아무 데나 누르면 끝 상태로 (§12-Q28)
  await page.mouse.click(5, 5);
  await expect(page.getByRole('img', { name: '등록 도장' })).toBeVisible();
  const running = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === 'running' &&
            a.effect?.getTiming().iterations !== Infinity &&
            (a.effect as KeyframeEffect).target?.closest?.(
              '[data-testid="registration-card"]',
            ),
        ).length,
  );
  expect(running).toBe(0);

  // DB: 한 번에 저장됨 (닉네임·스킨·학년 없음·완료 시각·동의 2건)
  const { data: row } = await admin
    .from('users')
    .select('nickname, grade, avatar_config, onboarded_at')
    .eq('id', me.id)
    .single();
  expect(row).toMatchObject({
    nickname: myName,
    grade: null,
    avatar_config: { skin: 'sunset' },
  });
  expect(row?.onboarded_at).toBeTruthy();
  const { count } = await admin
    .from('user_agreements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', me.id);
  expect(count).toBe(2);

  // 5. 쪽 넘김 → 튜토리얼 → 넘겨 보고 건너뛰기 → 월드맵
  await page.getByTestId('onboarding-next').click();
  const tutorial = page.getByTestId('onboarding-tutorial');
  await expect(tutorial).toBeVisible();
  await expect(page.getByTestId('tutorial-scene-map')).toBeVisible();
  await page.getByTestId('tutorial-next').click();
  await expect(page.getByTestId('tutorial-scene-code')).toBeVisible();
  await page.getByTestId('tutorial-skip').click();
  await expect(page).toHaveURL(/\/world$/);
  await expect(page.getByRole('heading', { name: '모험 지도' })).toBeVisible();

  // 끝낸 아이는 온보딩으로 돌아가지 않음
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/world$/);
  expect(violations).toEqual([]);
});

test('튜토리얼 다시 보기: 설정에서 열고 4장면 → 모험 시작! → 월드맵 / 온보딩 전이면 온보딩으로', async ({
  browser,
  baseURL,
}) => {
  const me = await newUser();
  const { page, violations } = await openAs(browser, baseURL!, me.cookies);
  await page.goto('/onboarding/tutorial');
  await expect(page).toHaveURL(/\/onboarding$/);

  await adminClient()
    .from('users')
    .update({
      onboarded_at: new Date().toISOString(),
      nickname: `다시${(randomBytes(2).readUInt16BE() % 9000) + 1000}`,
    })
    .eq('id', me.id);
  await page.goto('/settings');
  await page.getByTestId('settings-tutorial').click();
  await expect(page).toHaveURL(/\/onboarding\/tutorial$/);
  for (const scene of ['map', 'code', 'hint']) {
    await expect(page.getByTestId(`tutorial-scene-${scene}`)).toBeVisible();
    await page.getByTestId('tutorial-next').click();
  }
  await expect(page.getByTestId('tutorial-scene-reward')).toBeVisible();
  await page.getByTestId('tutorial-done').click();
  await expect(page).toHaveURL(/\/world$/);
  expect(violations).toEqual([]);
});

test('동작 줄이기: 도장은 처음부터 제자리(움직임 0), 튜토리얼 장면도 연출 없이 끝 상태', async ({
  browser,
  baseURL,
}) => {
  const me = await newUser();
  const { page } = await openAs(browser, baseURL!, me.cookies, {
    reducedMotion: 'reduce',
  });
  await page.goto('/onboarding');
  await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
  await page.getByTestId('agreement-all').check();
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('nickname-hint')).toHaveAttribute(
    'data-status',
    'ok',
  );
  await page.getByTestId('onboarding-next').click();
  await page.locator('[data-skin="berry"]').click();
  await page.getByTestId('onboarding-next').click();
  await page
    .locator('[data-testid="grade-picker"] [role="radio"]')
    .nth(4)
    .click();
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('onboarding-step-stamp')).toBeVisible();
  // 도장에 걸린 WAAPI 연출이 없음 (즉시 제자리)
  const stampAnims = await page.evaluate(
    () =>
      document
        .querySelector('[data-testid="onboarding-stamp"]')
        ?.getAnimations().length ?? -1,
  );
  expect(stampAnims).toBe(0);
  await expect(page.getByTestId('registration-card')).toContainText('5학년');
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('tutorial-scene-map')).toBeVisible();
  const sceneAnims = await page.evaluate(
    () =>
      document
        .querySelector('[data-testid="tutorial-scene-map"]')!
        .getAnimations({ subtree: true })
        .filter((a) => a.playState === 'running').length,
  );
  expect(sceneAnims).toBe(0);
});

test('기존 사용자(P3-12): 반가운 말 + 바뀐 점, 예전 닉네임 그대로, 튜토리얼 없이 바로 이어서, 경험치·진행 그대로', async ({
  browser,
  baseURL,
}) => {
  const admin = adminClient();
  const me = await newUser();
  // 온보딩 전부터 학습하던 아이: 첫 퀘스트 완료(서버 완료 RPC) + 예전 닉네임
  const quest = stage(1).quests[0];
  await completeQuests(me.id, [quest]);
  const oldName = `예전${(randomBytes(2).readUInt16BE() % 9000) + 1000}`;
  await admin.from('users').update({ nickname: oldName }).eq('id', me.id);
  const { data: before } = await admin
    .from('users')
    .select('total_xp, current_level')
    .eq('id', me.id)
    .single();
  expect(before!.total_xp).toBeGreaterThan(0);

  const { page, violations } = await openAs(browser, baseURL!, me.cookies, {
    reducedMotion: 'reduce',
  });
  await page.goto('/world');
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByTestId('onboarding-news')).toContainText('그대로예요');
  await expect(
    page.getByRole('heading', { name: '새 약속 확인하기' }),
  ).toBeVisible();
  await page.getByTestId('agreement-all').check();
  await page.getByTestId('onboarding-next').click();

  await expect(page.getByTestId('nickname-input')).toHaveValue(oldName);
  await expect(page.getByTestId('nickname-hint')).toHaveAttribute(
    'data-status',
    'ok',
  );
  await page.getByTestId('onboarding-next').click();
  await page.locator('[data-skin="violet"]').click();
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('grade-skip').click();

  await expect(page.getByTestId('onboarding-kept')).toContainText(
    `${before!.total_xp} XP`,
  );
  await expect(page.getByTestId('onboarding-tutorial-offer')).toBeVisible();
  await expect(page.getByTestId('onboarding-next')).toHaveText(/이미 알아요/);
  await page.getByTestId('onboarding-next').click();
  await expect(page).toHaveURL(/\/world$/);

  const { data: after } = await admin
    .from('users')
    .select('total_xp, current_level, nickname, onboarded_at')
    .eq('id', me.id)
    .single();
  expect(after).toMatchObject({
    total_xp: before!.total_xp,
    current_level: before!.current_level,
    nickname: oldName,
  });
  expect(after!.onboarded_at).toBeTruthy();
  const { count } = await admin
    .from('user_progress')
    .select('quest_id', { count: 'exact', head: true })
    .eq('user_id', me.id)
    .eq('status', 'completed');
  expect(count).toBe(1);
  expect(violations).toEqual([]);
});
