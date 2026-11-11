// Phase 8 핵심 루프 (P8-16): 새 학생 한 명으로 하루를 끝까지 —
// 출석 도장(+5, 원장 attendance/<오늘>) → 오늘 미션 3개 배정 → 힌트 없이 퀘스트 ⭐3(코인 10 + 별 15, XP) → HUD 코인·노드 별 →
// 미션 받기(코인·XP 15) → 업적 카드 "나중에" → 도감 받기 가능 → 프로필 달력 오늘 칸·스트릭 1 → 어제 학습 기록을 넣으면 스트릭 2 →
// 같은 날 다시 풀기는 연습(별·코인 그대로). 끝마다 잔액 = 원장 합(`coin_balance_mismatches()` 0행).
// 공용 테스트 사용자는 같은 실행의 다른 스펙이 출석·원장 키를 이미 썼을 수 있어, 이 스펙만 새 사용자로 절대값을 본다

import { test, expect } from './support/test';
import {
  adminClient,
  coinBalance,
  coinMismatches,
  completeQuests,
  bestStars,
  totalXp,
} from './support/admin';
import { stage } from './support/content';
import { createSocialUser, deleteSocialUsers } from './support/socialUsers';
import {
  openStageSheet,
  outputPanel,
  runCode,
  stageButton,
} from './support/quest';
import type { Page } from '@playwright/test';

const s1 = stage(1);
const [quest1, quest2] = s1.quests;

/** KST 오늘에서 n일 전 날짜 키 */
const kstDay = (n: number) =>
  new Date(Date.now() + 9 * 3600_000 - n * 86400_000)
    .toISOString()
    .slice(0, 10);

interface Mission {
  id: string;
  kind: string;
  target: number;
  progress: number;
  coins: number;
}

async function todayMissions(userId: string) {
  const { data, error } = await adminClient().rpc('daily_missions_today', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data as { day: string; missions: Mission[] };
}

async function ledger(userId: string) {
  const { data, error } = await adminClient()
    .from('coin_ledger')
    .select('source, ref, delta')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return data as Array<{ source: string; ref: string; delta: number }>;
}

/** 떠 있는 축하 카드를 "나중에"·"좋아요" 쪽(celebration-cta)으로 모두 넘긴다 (받기는 누르지 않음) */
async function dismissCelebrations(page: Page) {
  const overlay = page.getByTestId('celebration-overlay');
  await expect(async () => {
    if (await overlay.isVisible()) {
      await overlay.hover();
      await overlay
        .getByTestId('celebration-cta')
        .filter({ visible: true })
        .first()
        .click({ timeout: 1_000 });
    }
    await expect(overlay).toBeHidden({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

test.afterAll(deleteSocialUsers);

test('새 학생 하루: 출석 → 미션 배정 → 퀘스트 ⭐3·코인 → 미션 받기 → 업적 나중에 → 프로필 → 연습', async ({
  page,
  baseURL,
  e2eUser,
}) => {
  test.setTimeout(180_000);
  const student = await createSocialUser({ onboarded: true });
  await page.context().clearCookies();
  await page.context().addCookies(
    (await student.signIn()).map((c) => ({
      ...c,
      url: baseURL!,
      sameSite: 'Lax' as const,
    })),
  );
  const me = student.id;
  const today = kstDay(0);
  const hudCoin = page.getByTestId('hud-coin');
  const coinText = (n: number) => `코인 ${n.toLocaleString('ko-KR')}개`;
  expect(await coinBalance(me)).toBe(0);

  // 1. 월드맵 첫 방문 → 출석 카드 도장 → +5, 원장 attendance/<오늘> 한 행
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/world');
  const card = page.getByTestId('attendance-card');
  await expect(card.getByTestId('attendance-cell-1')).toHaveAttribute(
    'data-state',
    'next',
  );
  await card.getByTestId('attendance-stamp').click();
  await expect(card.getByRole('heading')).toContainText('1일째 출석 완료!');
  await expect(hudCoin).toContainText(coinText(5));
  expect(await ledger(me)).toEqual([
    { source: 'attendance', ref: today, delta: 5 },
  ]);

  // 2. 미션 시트: 오늘 미션 3개, 배정은 저장됨(user_daily_missions)
  const { day, missions } = await todayMissions(me);
  expect(day).toBe(today);
  expect(missions).toHaveLength(3);
  const { data: assigned } = await adminClient()
    .from('user_daily_missions')
    .select('mission_ids')
    .eq('user_id', me)
    .eq('day', today)
    .single();
  expect(assigned?.mission_ids).toEqual(missions.map((m) => m.id));
  const chip = page.getByTestId('hud-mission');
  await expect(chip).toHaveAccessibleName(/^오늘의 미션 0\/3 달성$/);
  await chip.click();
  const sheet = page.getByRole('dialog', { name: '오늘의 미션' });
  for (const m of missions)
    await expect(sheet.getByTestId(`mission-${m.id}`)).toHaveAttribute(
      'data-state',
      'doing',
    );
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // 3. 힌트 없이 첫 퀘스트 → ⭐3 · 코인 10 + 별 15 카운트업 · XP
  const sheetS = await openStageSheet(page, s1.title);
  await sheetS.getByTestId('stage-sheet-start').click();
  await expect(page).toHaveURL(new RegExp(`/quest/${quest1.id}$`));
  await runCode(page, quest1.solution);
  await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass');
  const reward = page.locator('[data-testid="quest-reward"]:visible');
  await expect(reward.getByTestId('reward-stars')).toHaveAccessibleName(
    '별 3개 / 3개',
  );
  await page.keyboard.press('Escape'); // 카운트업을 끝 값으로
  await expect(reward).toHaveAttribute('data-done', 'true');
  await expect(reward.getByTestId('reward-coins')).toContainText('+25');

  // 5. 업적 카드(첫 코드 등) → "나중에" (받기는 도감에서). 레벨 업 카드가 같이 오면 함께 넘김
  const badges = page.getByTestId('celebration-step-badges');
  await expect(badges.locator('[data-achievement="first_code"]')).toBeVisible();
  await dismissCelebrations(page);

  const xp = Number(await reward.getByTestId('reward-xp-count').innerText());
  expect(xp).toBeGreaterThan(0);
  expect(await totalXp(me)).toBe(xp);
  const coinsAfterQuest = await coinBalance(me);
  const rows = await ledger(me);
  expect(rows).toEqual(
    expect.arrayContaining([
      { source: 'quest', ref: quest1.id, delta: 10 },
      { source: 'star', ref: `${quest1.id}:1`, delta: 5 },
      { source: 'star', ref: `${quest1.id}:2`, delta: 5 },
      { source: 'star', ref: `${quest1.id}:3`, delta: 5 },
    ]),
  );
  // 레벨 업 코인 말고는 업적 코인 없음 ("나중에"라 아직 안 받음)
  expect(rows.filter((r) => r.source === 'achievement')).toEqual([]);
  expect(coinsAfterQuest).toBe(
    30 +
      rows
        .filter((r) => r.source === 'level_up')
        .reduce((a, r) => a + r.delta, 0),
  );
  expect(await coinMismatches([me])).toEqual([]);

  // 지도: HUD 코인, 노드 별 합계, 미션 진행 갱신
  await page.goto('/world');
  await expect(hudCoin).toContainText(coinText(coinsAfterQuest));
  await expect(stageButton(page, s1.title)).toHaveAccessibleName(/별 3\//);
  const after = await todayMissions(me);
  const expected = (m: Mission) =>
    m.kind === 'quest_clear' || m.kind === 'no_hint'
      ? Math.min(1, m.target)
      : 0;
  for (const m of after.missions) expect(m.progress).toBe(expected(m));
  const ready = after.missions.filter((m) => m.progress >= m.target);
  expect(ready.length).toBeGreaterThan(0); // 퀘스트 미션은 늘 첫 칸, 새 학생은 1개짜리로 맞춤 배정

  // 4. 미션 받기 → 코인(난이도) · XP 15, 레벨 업·업적이면 카드
  await expect(chip).toHaveAttribute('data-ready');
  for (const m of ready) {
    // 받기마다 지도를 새로 연다: 앞 받기의 새로 고침·축하 뒤 시트 닫기(뒤로 가기)가 새로 연 시트를 닫거나 다시 그리지 않게
    await page.goto('/world');
    await chip.click();
    const row = sheet.getByTestId(`mission-${m.id}`);
    await expect(row).toHaveAttribute('data-state', 'ready');
    const coins0 = await coinBalance(me);
    const xp0 = await totalXp(me);
    const res = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/missions/claim') &&
        r.request().method() === 'POST',
    );
    await row.getByTestId('mission-claim').click();
    const body = await (await res).json();
    expect(body).toMatchObject({
      already_claimed: false,
      mission_coins: m.coins,
      xp_earned: 15,
    });
    expect(await coinBalance(me)).toBe(coins0 + body.coins_earned);
    expect(await totalXp(me)).toBe(xp0 + 15);
    if (body.level_after > body.level_before || body.new_achievements?.length)
      await dismissCelebrations(page);
    else await expect(row).toHaveAttribute('data-state', 'claimed');
  }
  await page.goto('/world');
  const coinsAfterMissions = await coinBalance(me);
  await expect(hudCoin).toContainText(coinText(coinsAfterMissions));
  expect(await coinMismatches([me])).toEqual([]);

  // 5(이어서). 도감: 나중에 넘긴 첫 코드 업적이 받기 가능
  await page.goto('/profile/achievements');
  await expect(
    page.getByTestId('achievement-book').getByTestId('achievement-first_code'),
  ).toHaveAttribute('data-state', 'claimable');

  // 6. 프로필 (360px): 달력 오늘 칸 = 퀘스트 1개 + 출석 도장, 스트릭 1일, 코인 = 원장 합
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/profile');
  const todayCell = page.getByTestId(`cal-${today}`);
  await expect(todayCell).toContainText(
    /^오늘, \d+월 \d+일, 퀘스트 1개, 출석 도장/,
  );
  const streakN = page.getByTestId('stat-streak').locator('.pf-tile-n');
  await expect(streakN).toHaveText('1일');
  await expect(page.getByTestId('treasure-coins')).toContainText(
    coinText(coinsAfterMissions),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);

  // 7. 같은 날 같은 퀘스트 다시 풀기 = 연습: 완료 API 안 부름, 별·코인·원장 그대로
  await page.setViewportSize({ width: 1280, height: 800 });
  const ledgerBefore = (await ledger(me)).length;
  const completeCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/quest/complete')) completeCalls.push(r.url());
  });
  await page.goto(`/quest/${quest1.id}`);
  await runCode(page, quest1.solution);
  const replay = page.locator('[data-testid="quest-reward"]:visible');
  await expect(replay).toHaveAttribute('data-review', 'true');
  await expect(replay).toContainText('복습 완료');
  await expect(replay.getByTestId('reward-coins')).toHaveCount(0);
  expect(completeCalls).toEqual([]);
  expect(await bestStars(me, quest1.id)).toBe(3);
  expect(await coinBalance(me)).toBe(coinsAfterMissions);
  expect((await ledger(me)).length).toBe(ledgerBefore);

  // KST 날짜 경계: 어제 푼 기록을 넣으면(서버 시계는 못 바꿈 → 날짜 시드) 스트릭 2일, 어제 칸에 퀘스트 1개
  const yesterday = kstDay(1);
  await completeQuests(me, [quest2]);
  const { error } = await adminClient()
    .from('user_progress')
    .update({
      completed_at: `${yesterday}T03:00:00Z`,
      solved_directly_at: `${yesterday}T03:00:00Z`,
      stars_judged_on: yesterday,
    })
    .eq('user_id', me)
    .eq('quest_id', quest2.id);
  if (error) throw new Error(error.message);
  await page.goto('/profile');
  await expect(streakN).toHaveText('2일');
  if (yesterday.slice(0, 7) === today.slice(0, 7))
    await expect(page.getByTestId(`cal-${yesterday}`)).toContainText(
      '퀘스트 1개',
    );
  await page.goto('/world');
  await expect(page.getByTestId('hud-streak')).toContainText('2');

  // 끝: 잔액 = 원장 합 (새 학생 + 공용 테스트 사용자)
  expect(await coinMismatches([me, e2eUser.id])).toEqual([]);
});
