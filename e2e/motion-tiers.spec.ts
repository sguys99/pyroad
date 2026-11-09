// 앱 화면의 연출 단계 대체 검사 (P2-12, docs/design/catalog.md §4). 카탈로그 스펙(e2e/public/design-catalog.spec.ts)과 같은 기준을
// 실제 월드맵·퀘스트 화면에 건다: 사용자 설정(users.settings.motion)으로 단계를 고정하고(로그인 레이아웃이 첫 페인트 전에 적용)
// 돌고 있는 무한 반복 애니메이션이 허용 목록(e2e/support/motion.ts) 밖에 없는지, lite부터 앰비언트·흐림이 꺼지는지 본다.

import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { adminClient } from './support/admin';
import { stage } from './support/content';
import { questHeader } from './support/quest';
import {
  AMBIENT,
  IDLE_LOOPS,
  MOTION_MODES,
  blurredCount,
  loopNames,
  loopViolations,
  runningLoops,
  type MotionMode,
} from './support/motion';

const quest = stage(1).quests[0];

async function setMotion(
  userId: string,
  motion: { tier: string; reduced: string },
) {
  const db = adminClient();
  const { data, error } = await db
    .from('users')
    .select('settings')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`settings 읽기 실패: ${error.message}`);
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const { error: updateError } = await db
    .from('users')
    .update({ settings: { ...settings, motion } })
    .eq('id', userId);
  if (updateError)
    throw new Error(`settings 쓰기 실패: ${updateError.message}`);
}

async function check(page: Page, mode: MotionMode, where: string) {
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-motion', mode.tier);
  await expect(html).toHaveAttribute(
    'data-reduced',
    mode.reduced === 'on' ? 'true' : 'false',
  );
  await page.waitForTimeout(800);
  const loops = await runningLoops(page);
  const names = loopNames(loops);
  expect(
    loopViolations(mode, loops),
    `${where} ${mode.name}: ${names.join(', ')}`,
  ).toEqual([]);
  const blurred = await blurredCount(page);
  if (mode.tier !== 'full') expect(blurred, `${where} 흐림`).toBe(0);
  return { names, blurred };
}

test.describe('앱 화면 연출 단계 대체 (P2-12)', () => {
  test.afterEach(async ({ e2eUser }) => {
    await setMotion(e2eUser.id, { tier: 'auto', reduced: 'system' });
  });

  for (const mode of MOTION_MODES) {
    test(`${mode.name}: 월드맵·퀘스트에 허용 목록 밖 반복 연출이 없다`, async ({
      page,
      e2eUser,
    }) => {
      await setMotion(e2eUser.id, { tier: mode.tier, reduced: mode.reduced });

      await page.goto('/world');
      await expect(
        page.getByRole('heading', { name: '모험 지도' }),
      ).toBeVisible();
      const world = await check(page, mode, '월드맵');
      if (mode.tier === 'full' && mode.reduced === 'off') {
        // 검사가 실제로 무언가를 잡는지: 지도 앰비언트(P5-09 구름·물결·배·새·반짝임·나뭇잎)·파이뱀 통통·지금 노드 고리(대기 루프).
        // 노드 이름표는 흐림 없음(P5-04)
        expect(world.names).toEqual(
          expect.arrayContaining([
            'wm-cloud',
            'wm-wave',
            'wm-boat',
            'wm-bird',
            'wm-flap',
            'wm-spark',
            'wm-leaf',
            'mascot-bob',
            'wn-ring',
          ]),
        );
        // 앰비언트는 transform·opacity만 (P0-07·§2.10). 흐림 없음
        expect(world.blurred).toBe(0);
      }
      if (mode.tier === 'lite' && mode.reduced === 'off') {
        expect(world.names.filter((n) => AMBIENT.includes(n))).toEqual([]);
        expect(world.names.some((n) => IDLE_LOOPS.includes(n))).toBe(true);
      }

      await page.goto(`/quest/${quest.id}`);
      await expect(questHeader(page)).toContainText(quest.title);
      await check(page, mode, '퀘스트');
    });
  }
});
