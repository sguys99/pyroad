// 비로그인 스펙 (P1-21, `public` 프로젝트). 로컬 Supabase 없이 돈다 → CI e2e-smoke
// 랜딩 히어로(P4-01: 파이뱀 반응·바로가기·연출 단계)·반응형·reduced-motion + 404·CSP(B27)·보호 경로

import { test, expect, type Page } from '@playwright/test';
import { runningLoops } from '../support/motion';
import { watchCspViolations } from '../support/test';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

const HERO_TITLE = /코드 주문으로/;

/** 기기 사본 움직임 설정 (부트 스크립트가 첫 페인트 전에 읽는다, src/lib/motion/boot.ts) */
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

/** 돌고 있는 히어로 반복 연출(ha-*) 이름 */
async function heroLoops(page: Page): Promise<string[]> {
  const loops = await runningLoops(page);
  return [...new Set(loops.map((l) => l.name))].filter((n) =>
    n.startsWith('ha-'),
  );
}

test.describe('랜딩 히어로 (P4-01)', () => {
  test('제목·버튼·파이뱀이 보이고 섹션 앵커가 시안 순서대로 있다', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /모험 시작/ })).toBeVisible();
    await expect(page.getByTestId('hero-mascot')).toBeVisible();
    // B32 이후 Lottie는 그리지 않음
    await expect(
      page.locator('[data-testid="lottie-character-pybaem"]'),
    ).toHaveCount(0);
    const ids = await page
      .locator('main > section[id]')
      .evaluateAll((els) => els.map((e) => e.id));
    expect(ids).toEqual([
      'hero',
      'try',
      'worlds',
      'fun',
      'friends',
      'parents',
      'faq',
    ]);
  });

  test('파이뱀을 누르면(마우스·키보드) 표정과 말풍선이 바뀐다', async ({
    page,
  }) => {
    await page.goto('/');
    const mascot = page.getByTestId('hero-mascot');
    const bubble = page.getByTestId('hero-bubble');
    const first = await bubble.textContent();
    await mascot.click();
    await expect(mascot).not.toHaveAttribute('data-state', 'idle');
    await expect(bubble).not.toHaveText(first ?? '');
    const second = await bubble.textContent();
    await mascot.focus();
    await page.keyboard.press('Enter');
    await expect(bubble).not.toHaveText(second ?? '');
  });

  test('"30초 체험"은 #try로 스크롤하고 제목에 포커스를 옮긴다', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .locator('#hero')
      .getByRole('link', { name: /30초 체험/ })
      .click();
    await expect(page).toHaveURL(/#try$/);
    await expect(page.locator('#try-title')).toBeFocused();
    await expect(page.locator('#try-title')).toBeInViewport();
  });

  test('full: 포인터를 움직이면 레이어가 움직이고 앰비언트가 돈다', async ({
    page,
  }) => {
    await setMotion(page, 'full', 'off');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await page.mouse.move(1200, 100, { steps: 6 });
    await expect
      .poll(() =>
        page
          .locator('.hero-layer[data-layer="decor"]')
          .evaluate((el) => getComputedStyle(el).transform),
      )
      .not.toBe('none');
    // 앰비언트 규칙은 늦게 오는 CSS(hero-ambient.css, P4-12)라 붙을 때까지 기다린다
    await expect.poll(() => heroLoops(page)).toContain('ha-drift');
  });

  for (const mode of [
    { tier: 'lite', reduced: 'off' },
    { tier: 'minimal', reduced: 'off' },
    { tier: 'full', reduced: 'on' },
  ] as const) {
    test(`${mode.tier}${mode.reduced === 'on' ? ' + 동작 줄이기' : ''}: 패럴랙스·앰비언트가 멈추고 누르면 표정·말풍선만 바뀐다`, async ({
      page,
    }) => {
      await setMotion(page, mode.tier, mode.reduced);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute(
        'data-motion',
        mode.tier,
      );
      await page.mouse.move(1200, 100, { steps: 6 });
      await page.waitForTimeout(300);
      const transform = await page
        .locator('.hero-layer[data-layer="decor"]')
        .evaluate((el) => getComputedStyle(el).transform);
      expect(transform).toBe('none');
      expect(await heroLoops(page)).toEqual([]);
      const mascot = page.getByTestId('hero-mascot');
      await mascot.click();
      await expect(mascot).not.toHaveAttribute('data-state', 'idle');
      // 반짝이 터짐은 파티클 예산이 있는 단계(lite)만
      await expect(page.locator('.hero-burst')).toHaveCount(
        mode.tier === 'lite' && mode.reduced === 'off' ? 1 : 0,
      );
    });
  }
});

test.describe('반응형 뷰포트 테스트', () => {
  const viewports = [
    { name: '모바일 (320px)', width: 320, height: 568 },
    { name: '모바일 (360px)', width: 360, height: 740 },
    { name: '태블릿 (768px)', width: 768, height: 1024 },
    { name: '데스크톱 (1024px)', width: 1024, height: 768 },
    { name: '데스크톱 (1280px)', width: 1280, height: 800 },
    { name: '와이드 (1440px)', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`${vp.name}에서 히어로 제목·버튼·파이뱀이 화면 안에 있다`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      const mascot = page.getByTestId('hero-mascot');
      await expect(mascot).toBeVisible({ timeout: 15_000 });
      for (const el of [
        mascot,
        page.getByRole('heading', { level: 1, name: HERO_TITLE }),
        page.getByRole('button', { name: /모험 시작/ }),
      ]) {
        const box = await el.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1); // 1px 여유
      }

      // 가로 스크롤이 생기지 않음
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(vp.width);
    });
  }
});

test.describe('reduced-motion 접근성', () => {
  test('기기 reduced-motion이면 동작 줄이기로 시작하고 Lottie를 싣지 않는다', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
    await expect(
      page.locator('[data-testid="lottie-character-pybaem"]'),
    ).toHaveCount(0);
    await expect(page.getByTestId('hero-mascot')).toBeVisible();
  });
});

test.describe('보안 헤더·없는 주소 (B27)', () => {
  test('정적 랜딩은 unsafe-eval 없는 CSP 와 보안 헤더를 받는다', async ({
    page,
  }) => {
    const response = await page.goto('/');
    const headers = response!.headers();
    const csp = headers['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBeTruthy();
    expect(headers['permissions-policy']).toBeTruthy();
    // 운영 빌드에서는 eval 계열을 막는다 (dev 서버만 예외)
    if (process.env.E2E_SERVER !== 'dev')
      expect(csp).not.toContain("'unsafe-eval'");
  });

  test('없는 주소는 쉬운 한국어 404 를 nonce CSP 로 보여 준다', async ({
    page,
  }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response!.status()).toBe(404);
    expect(response!.headers()['content-security-policy']).toMatch(
      /'nonce-[^']+'/,
    );
    await expect(
      page.getByRole('heading', { name: '길을 찾을 수 없어요' }),
    ).toBeVisible();

    // 스크립트가 nonce 로 동작해야 링크가 클라이언트 이동을 한다
    await page.getByRole('link', { name: '처음으로 가기' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('hero-mascot')).toBeVisible();
  });
});

test.describe('보호 경로', () => {
  for (const path of [
    '/world',
    '/quest/b1000000-0000-0000-0000-000000000001',
    '/profile',
  ]) {
    test(`로그인하지 않으면 ${path} 에서 랜딩으로 돌아간다`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
      await expect(
        page.getByRole('heading', { level: 1, name: HERO_TITLE }),
      ).toBeVisible();
    });
  }
});
