// 비로그인 스펙 (`public` 프로젝트). 랜딩 #friends 세 친구 (P4-06):
// 화면 근처에서 라이브 리그로 바뀜 · 들어오면 한 명씩 인사 · 누르면(마우스·키보드) 반응 · 연출 단계별 반짝이 · 360px 가로 스크롤 없음

import { test, expect, type Page } from '@playwright/test';
import { watchCspViolations } from '../support/test';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

const FRIENDS = [
  { id: 'pybaem', name: '파이뱀', greet: 'wave' },
  { id: 'bugbug', name: '버그버그', greet: 'appear' },
  { id: 'byeolttongi', name: '별똥이', greet: 'flyIn' },
] as const;

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

async function toFriends(page: Page) {
  await page
    .locator('#friends')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
}

test.describe('랜딩 세 친구 (P4-06)', () => {
  test('이름·역할이 보이고, 화면에 들어오면 한 명씩 인사한 뒤 라이브 리그로 바뀐다', async ({
    page,
  }) => {
    await page.goto('/');
    const section = page.locator('#friends');
    for (const f of FRIENDS) {
      await expect(
        section.getByRole('heading', { level: 3, name: f.name }),
      ).toBeAttached();
      await expect(
        section.getByRole('button', { name: `${f.name} 콕 누르기` }),
      ).toBeAttached();
    }
    // 인사 상태를 놓치지 않게 data-state 변화를 모두 기록
    await page.evaluate(() => {
      const w = window as unknown as { __friendStates: string[] };
      w.__friendStates = [];
      for (const el of document.querySelectorAll<HTMLElement>(
        '#friends [data-testid$="-btn"]',
      )) {
        new MutationObserver(() =>
          w.__friendStates.push(
            `${el.dataset.testid}:${el.getAttribute('data-state')}`,
          ),
        ).observe(el, { attributes: true, attributeFilter: ['data-state'] });
      }
    });
    await toFriends(page);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { __friendStates: string[] })
                .__friendStates,
          ),
        { timeout: 6_000 },
      )
      .toEqual(
        expect.arrayContaining(
          FRIENDS.map((f) => `friend-${f.id}-btn:${f.greet}`),
        ),
      );
    // 서버가 그린 정지 그림(id 접두사 ldfr-)이 라이브 리그로 바뀌었다
    await expect(section.locator('[id^="ldfr-"]')).toHaveCount(0);
    await expect(section.locator('svg.ld-friends-svg')).toHaveCount(3);
  });

  test('누르면(마우스·키보드) 표정과 말풍선이 바뀌고 대사를 한 번 읽어 준다', async ({
    page,
  }) => {
    await page.goto('/');
    await toFriends(page);
    for (const f of FRIENDS) {
      const btn = page.getByTestId(`friend-${f.id}-btn`);
      const bubble = page.getByTestId(`friend-${f.id}-bubble`);
      // 인사가 끝나 대기로 돌아온 뒤
      await expect(btn).toHaveAttribute('data-state', 'idle', {
        timeout: 6_000,
      });
      const first = await bubble.textContent();
      await btn.click();
      await expect(btn).not.toHaveAttribute('data-state', 'idle');
      await expect(bubble).not.toHaveText(first ?? '');
      await expect(page.getByTestId('friends-said')).toContainText(f.name);
      const second = await bubble.textContent();
      await btn.focus();
      await page.keyboard.press('Enter');
      await expect(bubble).not.toHaveText(second ?? '');
    }
  });

  for (const mode of [
    { tier: 'full', reduced: 'off', burst: 1 },
    { tier: 'lite', reduced: 'off', burst: 1 },
    { tier: 'minimal', reduced: 'off', burst: 0 },
    { tier: 'full', reduced: 'on', burst: 0 },
  ] as const) {
    test(`${mode.tier}${mode.reduced === 'on' ? ' + 동작 줄이기' : ''}: 누르면 반응하고 반짝이는 ${mode.burst ? '터진다' : '없다'}`, async ({
      page,
    }) => {
      await setMotion(page, mode.tier, mode.reduced);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute(
        'data-motion',
        mode.tier,
      );
      await toFriends(page);
      const btn = page.getByTestId('friend-bugbug-btn');
      await expect(btn).toHaveAttribute('data-state', 'idle', {
        timeout: 6_000,
      });
      await btn.click();
      await expect(btn).toHaveAttribute('data-state', 'search');
      await expect(page.locator('#friends .ld-friends-burst')).toHaveCount(
        mode.burst,
      );
    });
  }

  test('360px: 세 친구가 화면 안에 있고 가로 스크롤이 없다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await toFriends(page);
    for (const f of FRIENDS) {
      const box = await page.getByTestId(`friend-${f.id}`).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(361);
      const btn = await page.getByTestId(`friend-${f.id}-btn`).boundingBox();
      expect(btn!.width).toBeGreaterThanOrEqual(44);
      expect(btn!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });
});
