// 데일리 미션 (P8-07, §3 F4): 월드맵 HUD 미션 칸 → 시트에 오늘 미션 3개(첫 칸은 퀘스트 미션) → 퀘스트를 끝내면 서버가
// 그날 기록에서 진행을 다시 셈 → "받기" → 코인(난이도 10·15·20) + XP 15 한 번(원장 mission/<날짜>:<id>) → HUD 잔액. 다시 받기는 0

import { test, expect } from './support/test';
import {
  adminClient,
  coinBalance,
  completeQuests,
  hasCoinKey,
  totalXp,
} from './support/admin';
import { stage } from './support/content';

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

test('퀘스트 완료 → 미션 진행 → 받기 → 코인·XP 15, HUD 반영, 다시 받으면 0', async ({
  page,
  e2eUser,
}) => {
  const s1 = stage(1);
  await page.goto('/world');
  const chip = page.getByTestId('hud-mission');
  await expect(chip).toBeVisible();

  // 배정은 그날 처음 연 때 (같은 실행의 다른 스펙이 먼저 열었을 수 있음) → 서버에서 읽어 기대값을 정함
  const { day, missions } = await todayMissions(e2eUser.id);
  expect(missions.length).toBeGreaterThan(0);
  const quest = missions[0];
  expect(quest.kind).toBe('quest_clear'); // 할 수 있으면 늘 첫 칸
  const already = await hasCoinKey(e2eUser.id, 'mission', `${day}:${quest.id}`);

  await chip.click();
  const sheet = page.getByRole('dialog', { name: '오늘의 미션' });
  const row = sheet.getByTestId(`mission-${quest.id}`);
  await expect(row).toHaveAttribute(
    'data-state',
    already ? 'claimed' : 'doing',
  );
  if (!already) {
    // 서버가 다시 세므로 달성 전 직접 부르면 409
    const early = await page.request.post('/api/missions/claim', {
      data: { day, missionId: quest.id },
    });
    expect(early.status()).toBe(409);
  }
  await page.keyboard.press('Escape');

  await completeQuests(
    e2eUser.id,
    s1.quests
      .slice(0, quest.target)
      .map((q) => ({ id: q.id, solution: q.solution })),
  );
  await page.goto('/world');
  if (!already) await expect(chip).toHaveAttribute('data-ready');
  await chip.click();
  await expect(row).toHaveAttribute(
    'data-state',
    already ? 'claimed' : 'ready',
  );

  if (!already) {
    const coins0 = await coinBalance(e2eUser.id);
    const xp0 = await totalXp(e2eUser.id);
    const res = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/missions/claim') &&
        r.request().method() === 'POST',
    );
    await row.getByTestId('mission-claim').click();
    const body = await (await res).json();
    expect(body).toMatchObject({
      already_claimed: false,
      mission_coins: quest.coins,
      xp_earned: 15,
    });
    expect(await coinBalance(e2eUser.id)).toBe(coins0 + body.coins_earned);
    expect(await totalXp(e2eUser.id)).toBe(xp0 + 15);
    if (body.new_achievements?.length) {
      // 미션으로 새 업적(첫 미션 완료 등, P8-09): 시트를 닫고 지도 위 업적 카드 → 나중에 받을래요
      const overlay = page.getByTestId('celebration-overlay');
      const badges = overlay.getByTestId('celebration-step-badges');
      await expect(badges).toBeVisible();
      await expect(sheet).toBeHidden();
      await badges.getByTestId('celebration-cta').click();
      await expect(overlay).toBeHidden();
    } else {
      await expect(row).toHaveAttribute('data-state', 'claimed');
      await expect(sheet.getByRole('status')).toContainText(
        `코인 ${quest.coins}개`,
      );
      await page.keyboard.press('Escape');
    }
    await expect(page.getByTestId('hud-coin')).toContainText(
      `코인 ${(coins0 + body.coins_earned).toLocaleString('ko-KR')}개`,
    );
  }

  // 다시 받기: 200 + already_claimed, 코인 그대로
  const before = await coinBalance(e2eUser.id);
  const again = await page.request.post('/api/missions/claim', {
    data: { day, missionId: quest.id },
  });
  expect(again.status()).toBe(200);
  expect((await again.json()).already_claimed).toBe(true);
  expect(await coinBalance(e2eUser.id)).toBe(before);
});

test('360px: 미션 칸이 HUD 에 남고(곧 열려요는 빠짐) 시트에 가로 넘침 없음', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/world');
  await expect(page.getByTestId('hud-mission')).toBeVisible();
  await expect(page.getByTestId('hud-soon')).toBeHidden();
  await page.getByTestId('hud-mission').click();
  await expect(page.getByTestId('mission-list')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
