// 로그인 모달·시트 (P4-09, 비로그인 `public` 프로젝트 → CI e2e-smoke). 로컬 Supabase 없이 돈다(provider로 떠나지 않음).
// - 반응형: 768px 미만은 화면 아래에 붙은 바텀 시트, 이상은 가운데 대화 상자
// - 열기·닫기: 맥락별 제목(히어로·헤더), 포커스 가두기, Esc·닫기 버튼·기기 뒤로 가기로 닫히고 랜딩에 머묾, 연 버튼으로 포커스 복귀, 바깥 스크롤 잠금
// - 등장 연출 단계: full·lite는 transform 전환(첫 열림부터), minimal은 opacity만, 동작 줄이기는 전환 없음
// - 최근 로그인 배지: full만 한 번 살랑(유한), 동작 줄이기는 애니메이션 없음
// 로그인 왕복·실패 안내·인앱은 social-login 스펙 두 개.

import { test, expect, type Page } from '@playwright/test';
import { watchCspViolations } from '../support/test';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

const MOTION_PREFS_KEY = 'pyroad.motion.prefs.v1';
const LAST_LOGIN_KEY = 'pyroad.lastLogin.v1';

/** 첫 페인트 전에 이 기기의 움직임 설정·최근 로그인 수단을 심는다 (부트 스크립트가 읽음) */
async function seed(
  page: Page,
  opts: {
    tier?: 'full' | 'lite' | 'minimal';
    reduced?: 'on' | 'off';
    lastLogin?: 'kakao' | 'naver' | 'google';
  },
) {
  await page.addInitScript(
    ([key, prefs, lastKey, last]) => {
      if (prefs) window.localStorage.setItem(key, prefs);
      if (last)
        window.localStorage.setItem(
          lastKey,
          JSON.stringify({ provider: last, at: new Date().toISOString() }),
        );
    },
    [
      MOTION_PREFS_KEY,
      opts.tier
        ? JSON.stringify({ tier: opts.tier, reduced: opts.reduced ?? 'off' })
        : null,
      LAST_LOGIN_KEY,
      opts.lastLogin ?? null,
    ] as const,
  );
}

const heroCta = (page: Page) =>
  page.getByRole('button', { name: /모험 시작/ }).first();
const headerCta = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: '로그인' });

test.describe('반응형: 모바일 시트 · 넓은 화면 모달 (P4-09)', () => {
  test('360px: 아래에 붙은 바텀 시트, Esc로 닫으면 "모험 시작!"으로 포커스 복귀', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await page.goto('/');
    const cta = heroCta(page);
    await cta.click();
    const dialog = page.getByRole('dialog', {
      name: '어떤 계정으로 모험을 시작할까?',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('data-slot', 'sheet');
    // 등장 스프링이 끝난 뒤 자리: 화면 아래 끝에 붙고 화면 너비 그대로
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box ? Math.round(box.y + box.height) : -1;
      })
      .toBe(760);
    const box = (await dialog.boundingBox())!;
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(360);
    // 가로 스크롤 없음
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(dialog.getByTestId('login-sheet-guardian')).toContainText(
      '만 14세',
    );

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(cta).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
  });

  for (const width of [768, 1280]) {
    test(`${width}px: 가운데 대화 상자, 헤더 "로그인"이면 헤더 머리말, 닫기 버튼으로 닫으면 포커스 복귀`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const cta = headerCta(page);
      await cta.click();
      const dialog = page.getByRole('dialog', {
        name: '어떤 계정으로 들어갈까?',
      });
      await expect(dialog).toBeVisible();
      await expect
        .poll(async () => {
          const b = await dialog.boundingBox();
          if (!b) return null;
          // 가운데: 좌우·위아래 여백이 같다 (1px 오차)
          return [
            Math.abs(b.x - (width - b.x - b.width)) <= 1,
            Math.abs(b.y - (900 - b.y - b.height)) <= 1,
            b.width < width,
          ];
        })
        .toEqual([true, true, true]);

      await dialog.getByRole('button', { name: '닫기' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(cta).toBeFocused();
      // 닫기로 닫으면 시트가 쌓은 기록 항목을 거둔다
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              !!(window.history.state as Record<string, unknown> | null)?.[
                '__pyroadOverlay'
              ],
          ),
        )
        .toBe(false);
    });
  }
});

test.describe('열린 동안 (P4-09)', () => {
  test('포커스는 안에 갇히고, 바깥은 스크롤되지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await heroCta(page).click();
    const dialog = page.getByTestId('login-sheet');
    await expect(dialog).toBeVisible();
    // 열린 뒤 포커스가 안으로 들어올 때까지 (Base UI가 다음 프레임에 옮김)
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      // 마지막 요소에서 처음으로 돌아갈 때 Base UI 포커스 가드(팝업 밖 span)를 잠깐 거치므로 poll
      await expect
        .poll(
          () => dialog.evaluate((el) => el.contains(document.activeElement)),
          { message: `Tab ${i + 1}번째도 시트 안` },
        )
        .toBe(true);
    }
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(40, 400);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('기기 뒤로 가기: 시트만 닫히고 랜딩에 머문다, 다시 열 수 있다', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    violations = await watchCspViolations(page);
    try {
      await page.goto('/');
      const cta = heroCta(page);
      await cta.click();
      const dialog = page.getByTestId('login-sheet');
      await expect(dialog).toBeVisible();
      // 시트가 기록 항목을 쌓을 때까지 (다음 틱)
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              !!(window.history.state as Record<string, unknown> | null)?.[
                '__pyroadOverlay'
              ],
          ),
        )
        .toBe(true);
      await page.goBack();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      await cta.click();
      await expect(page.getByTestId('login-sheet')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('등장 연출 단계 (P4-09)', () => {
  const cases = [
    { name: 'full', tier: 'full', reduced: 'off', want: 'transform' },
    { name: 'lite', tier: 'lite', reduced: 'off', want: 'transform' },
    { name: 'minimal', tier: 'minimal', reduced: 'off', want: 'opacity-only' },
    { name: '동작 줄이기', tier: 'full', reduced: 'on', want: 'none' },
  ] as const;
  for (const c of cases) {
    test(`${c.name}: 첫 열림부터 단계에 맞는 전환`, async ({ page }) => {
      await seed(page, { tier: c.tier, reduced: c.reduced });
      await page.setViewportSize({ width: 360, height: 760 });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-motion', c.tier);
      // 누르기 전에 전환 시작을 모은다 (짧은 페이드가 확인 전에 끝나는 일이 있음, design-catalog 스펙과 같은 방식)
      await page.evaluate(() => {
        const w = window as unknown as { __loginTransitions: Set<string> };
        w.__loginTransitions = new Set();
        document.addEventListener('transitionrun', (e) => {
          const el = e.target as Element | null;
          if (el?.matches?.('[data-testid="login-sheet"]'))
            w.__loginTransitions.add(e.propertyName);
        });
      });
      await heroCta(page).click();
      await expect(page.getByTestId('login-sheet')).toBeVisible();
      await page.waitForTimeout(400);
      const props = await page.evaluate(() =>
        [
          ...(window as unknown as { __loginTransitions: Set<string> })
            .__loginTransitions,
        ].sort(),
      );
      if (c.want === 'none') expect(props).toEqual([]);
      else if (c.want === 'opacity-only') expect(props).toEqual(['opacity']);
      else expect(props).toContain('transform');
    });
  }

  test('최근 로그인 배지: full은 팝 + 한 번 살랑(유한), 동작 줄이기는 애니메이션 없음', async ({
    page,
  }) => {
    await seed(page, { tier: 'full', reduced: 'off', lastLogin: 'google' });
    await page.goto('/');
    await heroCta(page).click();
    const top = page
      .getByTestId('login-sheet')
      .locator('[data-provider]')
      .first();
    await expect(top).toHaveAttribute('data-provider', 'google');
    const badge = top.locator('.g-social-recent');
    await expect(badge).toHaveText('최근에 사용');
    const anim = await badge.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        names: cs.animationName,
        counts: cs.animationIterationCount,
      };
    });
    expect(anim.names).toContain('g-social-recent-wiggle');
    expect(anim.counts).not.toContain('infinite');
    await expect(page.getByTestId('login-sheet-hint')).toContainText(
      '지난번엔 Google로 들어왔어',
    );
  });

  test('최근 로그인 배지: 동작 줄이기는 움직이지 않는다', async ({ page }) => {
    await seed(page, { tier: 'full', reduced: 'on', lastLogin: 'google' });
    await page.goto('/');
    await heroCta(page).click();
    const badge = page.getByTestId('login-sheet').locator('.g-social-recent');
    await expect(badge).toBeVisible();
    expect(
      await badge.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none');
  });
});
