// 비로그인 스펙 (`public` 프로젝트). 랜딩 #parents 보호자 섹션 (P4-07):
// 헤더 "보호자 안내" 바로가기 · 편지 세 단과 로드맵 · 등장 연출은 full·lite만 · 360px 가로 스크롤 없음

import { test, expect, type Page } from '@playwright/test';
import { watchCspViolations } from '../support/test';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

async function setMotion(
  page: Page,
  tier: 'full' | 'lite' | 'minimal',
  reduced: 'on' | 'off',
) {
  await page.addInitScript(
    ([t, r]) => {
      localStorage.setItem(
        'pyroad.motion.prefs.v1',
        JSON.stringify({ tier: t, reduced: r }),
      );
    },
    [tier, reduced] as const,
  );
}

/** 이 섹션의 CSS 애니메이션 이름 (끝난 것 포함) */
async function parentsAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .map((a) => (a as CSSAnimation).animationName ?? '')
      .filter((n) => n.startsWith('ld-parents')),
  );
}

async function scrollThrough(page: Page) {
  const section = page.locator('#parents');
  await section.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await section.evaluate((el) => el.scrollIntoView({ block: 'end' }));
}

test.describe('랜딩 보호자 섹션 (P4-07)', () => {
  test('헤더 "보호자 안내"로 오면 안전·AI·배움 세 단과 배우는 길이 보인다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('link', { name: '보호자 안내' }).click();
    await expect(page).toHaveURL(/#parents$/);
    await expect(page.locator('#parents-title')).toBeFocused();
    const section = page.locator('#parents');
    for (const name of ['안전', 'AI 튜터 원칙', '배움', '배우는 길'])
      await expect(
        section.getByRole('heading', { level: 3, name }),
      ).toBeVisible();
    await expect(section.getByText('파이썬 마을 입구')).toBeVisible();
    await expect(section.getByText('프로젝트 왕국')).toBeVisible();
    // 월드 2·3은 "준비 중" (휴식 알림은 P8-12에서 생겨 편지로 옮김)
    await expect(section.getByText('준비 중', { exact: true })).toHaveCount(2);
  });

  test('full: 화면에 들어오면 한 번 떠오르고 길이 그려진다', async ({
    page,
  }) => {
    await setMotion(page, 'full', 'off');
    await page.goto('/');
    await scrollThrough(page);
    await expect(page.locator('.ld-parents-road')).toHaveAttribute(
      'data-in',
      'true',
    );
    const names = await parentsAnimations(page);
    expect(names).toContain('ld-parents-rise');
    expect(names).toContain('ld-parents-pin');
  });

  for (const mode of [
    { tier: 'minimal', reduced: 'off' },
    { tier: 'full', reduced: 'on' },
  ] as const) {
    test(`${mode.tier}${mode.reduced === 'on' ? ' + 동작 줄이기' : ''}: 등장 연출이 없다`, async ({
      page,
    }) => {
      await setMotion(page, mode.tier, mode.reduced);
      await page.goto('/');
      await scrollThrough(page);
      await expect(page.locator('.ld-parents-road')).toHaveAttribute(
        'data-in',
        'true',
      );
      expect(await parentsAnimations(page)).toEqual([]);
      await expect(page.locator('#parents-title')).toBeVisible();
    });
  }

  test('360px: 가로 스크롤이 없다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await scrollThrough(page);
    const box = await page.locator('.ld-parents-letter').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(361);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });
});
