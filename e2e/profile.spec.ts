// 프로필 (P8-13): 레벨·칭호, 학습 달력(KST, 그날 푼 퀘스트 수만큼 진한 초록), 모험 기록, 업적 카드 → 도감, 별과 보물.
// 360 한 열 · 1280 두 열, 가로 넘침 없음. PROFILE_SHOTS=<폴더> 면 데이터가 찬 화면을 찍어 둠 (보고용)

import { test, expect } from './support/test';
import { adminClient, completeQuests } from './support/admin';
import { stage } from './support/content';

const noOverflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** KST 오늘에서 n일 전 날짜 키 */
const kstDay = (n: number) =>
  new Date(Date.now() + 9 * 3600_000 - n * 86400_000)
    .toISOString()
    .slice(0, 10);

/** 1·2단계 코드 퀘스트를 풀고, 완료 날짜를 지난 며칠에 흩어 둠 (달력에 잔디가 보이게) */
async function seed(userId: string) {
  // 스테이지 보스(P9-12·13)는 completeQuests 가 그 스테이지 코드 퀘스트 뒤에 끝냄 → 날짜를 흩을 목록에도 그 자리에 넣음
  const quests = [1, 2].flatMap((n) => {
    const { quests: qs, boss } = stage(n);
    return [...qs, ...(boss ? [{ id: boss.id, solution: '' }] : [])];
  });
  await completeQuests(userId, quests);
  // 오늘 3개 · 1일 전 2개 · 그 밖은 하루 하나씩 띄엄띄엄
  const offsets = [0, 0, 0, 1, 1, 2, 4, 4, 4, 4, 5, 7, 8, 9, 11, 12];
  const db = adminClient();
  for (const [i, q] of quests.entries()) {
    const day = kstDay(
      offsets[i % offsets.length] + 14 * Math.floor(i / offsets.length),
    );
    const { error } = await db
      .from('user_progress')
      .update({ completed_at: `${day}T03:00:00Z`, stars_judged_on: day })
      .eq('user_id', userId)
      .eq('quest_id', q.id);
    if (error) throw new Error(error.message);
  }
  // 오늘 출석 도장 (달력 금색 점). 같은 날 다시 돌린 실행이면 이미 찍혀 있음
  await db.rpc('stamp_attendance', { p_user_id: userId });
  return quests.length;
}

test('360px: 한 열 · 달력 오늘 칸 낭독 · 모험 기록 · 업적 카드 → 도감, 넘침 없음', async ({
  page,
  e2eUser,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const solved = await seed(e2eUser.id);
  await page.goto('/profile');

  await expect(page.getByTestId('profile-hero')).toContainText('칭호');
  const today = page.getByTestId(`cal-${kstDay(0)}`);
  await expect(today).toHaveAttribute('data-today', 'true');
  await expect(today).toHaveAttribute('data-level', '2');
  await expect(today).toContainText(/^오늘, \d+월 \d+일, 퀘스트 3개/);
  await expect(page.getByTestId('stat-quests')).toContainText(String(solved));

  // 이전 달로 갔다가 돌아오기 (기록이 이번 달에만 있으면 이전 달 버튼이 꺼짐)
  const prev = page.getByRole('button', { name: '이전 달' });
  if (await prev.isEnabled()) {
    await prev.click();
    await page.getByRole('button', { name: '다음 달' }).click();
  }
  await expect(today).toBeVisible();

  // 카드는 한 열(같은 왼쪽)
  const lefts = await page
    .locator('.pf .pf-card, [data-testid="profile-achievements"]')
    .evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().left)),
    );
  expect(new Set(lefts).size).toBe(1);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);

  if (process.env.PROFILE_SHOTS)
    await page.screenshot({
      path: `${process.env.PROFILE_SHOTS}/프로필-360-v2.png`,
      fullPage: true,
    });

  await page.getByTestId('profile-achievements').click();
  await expect(page).toHaveURL(/\/profile\/achievements$/);
});

test('1280px: 두 열(왼쪽 달력·기록 / 오른쪽 업적·보물), 넘침 없음', async ({
  page,
  e2eUser,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(e2eUser.id);
  await page.goto('/profile');
  await expect(page.getByTestId('profile-achievements')).toBeVisible();
  // 두 상자를 한 프레임에서 잰다: 따로 재면 화면 등장 전환(PageTransition, 12px 올라옴) 사이에 위치가 달라짐 (B71)
  const [cal, ach] = await page.evaluate(() =>
    ['profile-calendar', 'profile-achievements'].map((id) =>
      document
        .querySelector(`[data-testid="${id}"]`)!
        .getBoundingClientRect()
        .toJSON(),
    ),
  );
  expect(Math.abs(cal.y - ach.y)).toBeLessThan(2);
  expect(ach.x > cal.x + cal.width).toBe(true);
  // 계정 관리는 접혀 있음 (위험 동작이 바로 보이지 않게)
  await expect(page.getByTestId('reset-scope')).toBeHidden();
  await page.getByText('계정 관리').click();
  await expect(page.getByTestId('reset-scope')).toBeVisible();
  await page.getByText('계정 관리').click();
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);

  if (process.env.PROFILE_SHOTS)
    await page.screenshot({
      path: `${process.env.PROFILE_SHOTS}/프로필-1280-v2.png`,
      fullPage: true,
    });
});
