// 잠금 해제 연출 (P5-05, Q49): 새로 열린 스테이지에서 한 번만 → 서버 본 기록 → 새로고침하면 다시 안 나옴.
// 기록이 없는 사용자의 첫 방문은 연출 없이 조용히 기록, 동작 줄이기는 끝 상태로 바로 + 문구, 누르면 건너뛰기

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

import { test, expect } from './support/test';
import { adminClient, completeQuests } from './support/admin';
import { stage } from './support/content';
import { outputPanel, runCode, toStageClear } from './support/quest';

const s1 = stage(1);
const s2 = stage(2);
const opened = `새 스테이지가 열렸어요! 2단계 ${s2.title}`;

async function setMotion(
  userId: string,
  motion: { tier: string; reduced: string },
) {
  const { error } = await adminClient()
    .from('users')
    .update({ settings: { motion } })
    .eq('id', userId);
  expect(error).toBeNull();
}

const recorded = (page: Page) =>
  page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/world/unlocks') && r.request().method() === 'POST',
  );

async function seenIds(userId: string): Promise<string[]> {
  const { data, error } = await adminClient()
    .from('user_seen_unlocks')
    .select('stage_id')
    .eq('user_id', userId);
  expect(error).toBeNull();
  return (data ?? []).map((r) => r.stage_id as string).sort();
}

/** 첫 방문: 기록이 없으니 지금 열린 스테이지(1단계)를 연출 없이 기록 */
async function firstVisit(page: Page, userId: string) {
  const res = recorded(page);
  await page.goto('/world');
  expect((await res).status()).toBe(200);
  await expect(page.locator('.wu-fx')).toHaveCount(0);
  expect(await seenIds(userId)).toEqual([s1.id]);
}

test.afterEach(async ({ e2eUser }) => {
  await setMotion(e2eUser.id, { tier: 'auto', reduced: 'system' });
});

test('퀘스트를 깨서 다음 스테이지가 열리면 지도에서 연출 한 번 → 새로고침하면 다시 안 나옴', async ({
  page,
  e2eUser,
}) => {
  test.setTimeout(120_000);
  await setMotion(e2eUser.id, { tier: 'full', reduced: 'off' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await firstVisit(page, e2eUser.id);

  // 마지막 퀘스트를 화면에서 풀어 1단계를 통과
  await completeQuests(e2eUser.id, s1.quests.slice(0, -1));
  const last = s1.quests[s1.quests.length - 1];
  await page.goto(`/quest/${last.id}`);
  await runCode(page, last.solution);
  await expect(outputPanel(page)).toContainText('정답이에요!');
  // 축하의 맨 뒤 스테이지 클리어 카드 → "지도에서 새 길 보기" (P6-13): 소프트 이동으로 지도에 가서 해제 연출
  const stageCard = await toStageClear(page);
  const res = recorded(page);
  await stageCard.getByTestId('celebration-map-cta').click();
  await expect(page).toHaveURL(/\/world/);
  // 연출 중: 새 노드는 잠김 모습 + 자물쇠, 이전 노드 → 새 노드
  await expect(page.locator('.wu-lock')).toHaveCount(1);
  await expect(page.locator('.world-node[data-unlock="to"]')).toHaveCount(1);
  await expect(page.getByText(opened)).toBeVisible({ timeout: 15_000 });
  expect((await res).status()).toBe(200);
  await expect(page.locator(`[data-stage-id="${s2.id}"]`)).toHaveAttribute(
    'data-state',
    'open',
  );
  await expect(page.locator('.world-node[data-unlock]')).toHaveCount(0);
  await expect(page.getByTestId('world-current-marker')).toContainText(
    '새 곳 도착!',
  );
  expect(await seenIds(e2eUser.id)).toEqual([s1.id, s2.id].sort());

  await page.reload();
  await expect(page.locator(`[data-stage-id="${s2.id}"]`)).toHaveAttribute(
    'data-state',
    'open',
  );
  await page.waitForTimeout(1500);
  await expect(page.locator('.wu-fx')).toHaveCount(0);
  await expect(page.getByText(opened)).toHaveCount(0);
});

test('기록이 없는 사용자는 이미 열린 스테이지가 많아도 연출 없이 조용히 기록', async ({
  page,
  e2eUser,
}) => {
  await setMotion(e2eUser.id, { tier: 'full', reduced: 'off' });
  await completeQuests(e2eUser.id, s1.quests);
  const res = recorded(page);
  await page.goto('/world');
  expect((await res).status()).toBe(200);
  await page.waitForTimeout(1000);
  await expect(page.locator('.wu-fx')).toHaveCount(0);
  await expect(page.getByText('새 스테이지가 열렸어요!')).toHaveCount(0);
  expect(await seenIds(e2eUser.id)).toEqual([s1.id, s2.id].sort());
});

test('동작 줄이기: 연출 없이 끝 상태로 바로 + 문구 한 번', async ({
  page,
  e2eUser,
}) => {
  await setMotion(e2eUser.id, { tier: 'full', reduced: 'on' });
  await firstVisit(page, e2eUser.id);
  await completeQuests(e2eUser.id, s1.quests);

  const res = recorded(page);
  await page.goto('/world');
  await expect(page.getByText(opened)).toBeVisible();
  expect((await res).status()).toBe(200);
  await expect(page.locator(`[data-stage-id="${s2.id}"]`)).toHaveAttribute(
    'data-state',
    'open',
  );
  // 자물쇠·도장·잉크 겹이 아예 없고, 지도 안에 돌고 있는 1회성 애니메이션도 없음
  await expect(page.locator('.wu-fx, .wu-ink, .wu-road')).toHaveCount(0);
  const running = await page.evaluate(() =>
    document
      .getAnimations()
      .filter(
        (a) =>
          a.playState === 'running' &&
          !(a instanceof CSSAnimation) &&
          // 지도 안 (페이지 틀 PageTransition 의 등장은 따로 동작 줄이기 규칙)
          !!((a.effect as KeyframeEffect)?.target as Element | null)?.closest(
            '.world-map',
          ),
      )
      .map(
        (a) =>
          `${a.constructor.name} ${((a.effect as KeyframeEffect)?.target as Element | null)?.className}`,
      ),
  );
  expect(running).toEqual([]);
});

test('360px: 화면 밖이면 스크롤하고, 누르면 끝 상태로 건너뜀 (밑의 노드는 안 눌림)', async ({
  page,
  e2eUser,
}) => {
  await setMotion(e2eUser.id, { tier: 'full', reduced: 'off' });
  await page.setViewportSize({ width: 360, height: 740 });
  await firstVisit(page, e2eUser.id);
  await completeQuests(e2eUser.id, s1.quests);

  await page.goto('/world');
  await expect(page.locator('.wu-lock')).toHaveCount(1);
  // 새 노드가 화면 안으로
  await expect(
    page.locator(`[data-stage-id="${s2.id}"] .wn-plate`),
  ).toBeInViewport({ timeout: 5_000 });
  const res = recorded(page);
  await page.locator(`[data-stage-id="${s2.id}"] .wn-hit`).click();
  await expect(page.getByText(opened)).toBeVisible({ timeout: 2_000 });
  expect((await res).status()).toBe(200);
  await expect(page.locator('.wu-fx.is-done')).toHaveCount(1);
  // 건너뛰기 누름이 차례 시트를 열지 않음
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/world$/);
});

// 스크린샷 (보고용): E2E_SHOTS=<폴더> 일 때만. 360·1280 × full(연출 중 프레임)·minimal(끝 상태)
test.describe('잠금 해제 스크린샷', () => {
  const dir = process.env.E2E_SHOTS;
  test.skip(!dir, 'E2E_SHOTS 가 없으면 건너뜀');

  test('연출 프레임', async ({ page, e2eUser }) => {
    test.setTimeout(240_000);
    mkdirSync(dir!, { recursive: true });
    await completeQuests(e2eUser.id, s1.quests);
    for (const tier of ['full', 'minimal'] as const) {
      await setMotion(e2eUser.id, { tier, reduced: 'off' });
      for (const width of [360, 1280]) {
        // 2단계만 안 본 상태로 되돌림 (1단계는 봄)
        await adminClient()
          .from('user_seen_unlocks')
          .delete()
          .eq('user_id', e2eUser.id)
          .eq('stage_id', s2.id);
        await adminClient()
          .from('user_seen_unlocks')
          .upsert({ user_id: e2eUser.id, stage_id: s1.id });
        await page.setViewportSize({ width, height: 900 });
        const res = recorded(page);
        await page.goto('/world');
        const frames = tier === 'full' ? [900, 1500, 2300, 4200] : [1200];
        let t0 = 0;
        for (const t of frames) {
          await page.waitForTimeout(t - t0);
          t0 = t;
          await page.screenshot({
            path: join(dir!, `unlock-${width}-${tier}-${t}.png`),
          });
        }
        await res;
      }
    }
  });
});
