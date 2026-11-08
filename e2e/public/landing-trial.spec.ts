// 랜딩 30초 체험 공책 (P4-02 라이브 데모, `public` 프로젝트). 로컬 Supabase 없이 돈다
// - 서버 HTML(자바스크립트 없이)에도 완성된 주문·결과가 보인다 (opacity 0 없음)
// - full: 화면에 들어오면 print("안녕!")을 한 글자씩 치고(겹 레이어, aria-hidden) 결과를 보여 준 뒤 "이제 네 차례!"로 넘긴다
// - 공책을 건드리면 데모를 바로 끝내고 넘겨준다 / 화면 밖이면 멈춘다
// - minimal·동작 줄이기는 데모 없이 완성된 모습 그대로 (알림도 없음)

import { test, expect, type Page } from '@playwright/test';
import { watchCspViolations } from '../support/test';

const DEMO_CODE = 'print("안녕!")';

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

async function gotoTrial(page: Page) {
  await page.goto('/');
  await page.locator('#try').scrollIntoViewIfNeeded();
  await page.evaluate(() =>
    document.getElementById('try')?.scrollIntoView({ block: 'start' }),
  );
}

test.describe('랜딩 30초 체험 공책 (P4-02)', () => {
  test('자바스크립트 없이도 완성된 주문과 결과가 보인다', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 2, name: '첫 주문을 걸어 봐요' }),
    ).toBeVisible();
    await expect(page.getByLabel('파이썬 한 줄')).toHaveValue(DEMO_CODE);
    await expect(page.getByTestId('trial-ghost')).toHaveText(DEMO_CODE);
    await expect(page.getByTestId('trial-out')).toContainText('안녕!');
    const opacity = await page
      .getByTestId('trial-card')
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
    await ctx.close();
  });

  test('full: 화면에 들어오면 타이핑 → 결과 → 이제 네 차례', async ({
    page,
  }) => {
    await setMotion(page, 'full', 'off');
    await gotoTrial(page);
    const input = page.getByLabel('파이썬 한 줄');
    const ghost = page.getByTestId('trial-ghost');

    // 데모 중: 입력칸은 비어 있고 읽기 전용, 글자는 aria-hidden 겹 레이어에만
    await expect(ghost).toContainText('print(');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('readonly', '');
    await expect(ghost).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('trial-announce')).toHaveText('');

    // 결과가 나오고 넘겨받음 (대본 약 4.3초)
    await expect(page.getByTestId('trial-out')).toContainText('안녕!', {
      timeout: 8_000,
    });
    await expect(page.getByTestId('trial-announce')).toContainText(
      '이제 네 차례',
      { timeout: 8_000 },
    );
    await expect(input).toHaveValue(DEMO_CODE);
    await expect(input).not.toHaveAttribute('readonly', '');
    await expect(page.getByTestId('trial-bubble')).toContainText('네 차례', {
      timeout: 4_000,
    });
  });

  test('데모 중 공책을 누르면 바로 넘겨받고, 키보드로 주문을 걸 수 있다', async ({
    page,
  }) => {
    await setMotion(page, 'full', 'off');
    await gotoTrial(page);
    const input = page.getByLabel('파이썬 한 줄');
    await expect(page.getByTestId('trial-ghost')).toContainText('pr');
    await input.click();
    await expect(input).toHaveValue(DEMO_CODE);
    await expect(page.getByTestId('trial-announce')).toContainText(
      '이제 네 차례',
    );

    await input.fill('print("pyRoad")');
    await expect(page.getByTestId('trial-ghost')).toHaveText('print("pyRoad")');
    await input.press('Enter');
    await expect(page.getByTestId('trial-out')).toContainText('pyRoad');
    await expect(page.getByTestId('trial-announce')).toHaveText(
      '첫 주문 성공! 결과: pyRoad',
    );
  });

  test('키보드 Tab으로 들어와도 데모를 끝내고 넘겨준다', async ({ page }) => {
    await setMotion(page, 'full', 'off');
    await gotoTrial(page);
    await expect(page.getByTestId('trial-ghost')).toContainText('pr');
    await page
      .getByRole('heading', { level: 2, name: '첫 주문을 걸어 봐요' })
      .focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('파이썬 한 줄')).toBeFocused();
    await expect(page.getByLabel('파이썬 한 줄')).toHaveValue(DEMO_CODE);
  });

  test('화면 밖으로 나가면 데모가 멈춘다', async ({ page }) => {
    await setMotion(page, 'full', 'off');
    await gotoTrial(page);
    const ghost = page.getByTestId('trial-ghost');
    await expect(ghost).toContainText('pr');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const paused = await ghost.textContent();
    await page.waitForTimeout(1_200);
    await expect(ghost).toHaveText(paused ?? '');
    // 돌아오면 이어서 친다
    await page.evaluate(() =>
      document.getElementById('try')?.scrollIntoView({ block: 'start' }),
    );
    await expect(page.getByTestId('trial-announce')).toContainText(
      '이제 네 차례',
      { timeout: 8_000 },
    );
  });

  for (const mode of [
    { tier: 'minimal', reduced: 'off' },
    { tier: 'full', reduced: 'on' },
  ] as const) {
    test(`${mode.tier}${mode.reduced === 'on' ? ' + 동작 줄이기' : ''}: 데모 없이 완성된 모습`, async ({
      page,
    }) => {
      await setMotion(page, mode.tier, mode.reduced);
      await gotoTrial(page);
      await page.waitForTimeout(1_500);
      await expect(page.getByLabel('파이썬 한 줄')).toHaveValue(DEMO_CODE);
      await expect(page.getByTestId('trial-out')).toContainText('안녕!');
      await expect(page.locator('.ld-trial-caret')).toHaveCount(0);
      await expect(page.getByTestId('trial-announce')).toHaveText('');
    });
  }

  test('360px에서 가로 스크롤이 없다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await setMotion(page, 'full', 'off');
    await gotoTrial(page);
    await expect(page.getByTestId('trial-announce')).toContainText(
      '이제 네 차례',
      { timeout: 8_000 },
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('랜딩 30초 체험 (P4-03)', () => {
  /** 데모를 건너뛰고 공책을 넘겨받는다 */
  async function takeNotebook(page: Page) {
    await setMotion(page, 'full', 'off');
    await gotoTrial(page);
    const input = page.getByLabel('파이썬 한 줄');
    await input.click();
    await expect(input).toHaveValue(DEMO_CODE);
    return input;
  }

  test('틀리면 버그버그가 쉬운 말로 알려 주고, 고치면 도장·로그인 카드·추천 주문', async ({
    page,
  }) => {
    const input = await takeNotebook(page);
    const out = page.getByTestId('trial-out');

    await input.fill('print("안녕)');
    await input.press('Enter');
    await expect(out).toHaveAttribute('data-state', 'err');
    await expect(out).toContainText('SyntaxError');
    await expect(out).toContainText('따옴표를 열었으면 닫아 주세요');
    await expect(page.getByTestId('trial-buddy')).toHaveAttribute(
      'data-who',
      'bugbug',
    );
    await expect(page.getByTestId('trial-cta')).toHaveCount(0);

    await input.fill('pirnt("안녕")');
    await input.press('Enter');
    await expect(out).toContainText('NameError');
    await expect(out).toContainText('pirnt 대신 print');

    await input.fill('print("하" * 3)');
    await page.getByTestId('trial-run').click();
    await expect(out).toHaveAttribute('data-state', 'ok');
    await expect(out).toContainText('하하하');
    await expect(page.getByTestId('trial-announce')).toHaveText(
      '첫 주문 성공! 결과: 하하하',
    );
    await expect(page.getByTestId('trial-stamp')).toBeVisible();
    await expect(page.getByTestId('trial-buddy')).toHaveAttribute(
      'data-who',
      'pybaem',
    );

    // 추천 주문은 누르면 바로 건다
    await page.getByRole('button', { name: 'print(1 + 2 * 3)' }).click();
    await expect(input).toHaveValue('print(1 + 2 * 3)');
    await expect(out).toContainText('7');

    // 로그인 카드 → "모험을 저장하려면 로그인!" 시트
    const cta = page.getByTestId('trial-cta');
    await expect(cta).toContainText('모험을 저장하려면 로그인!');
    await cta.getByRole('button', { name: /모험 시작/ }).click();
    await expect(
      page.getByRole('dialog').getByText('모험을 저장하려면 로그인!'),
    ).toBeVisible();
  });

  test('키보드만으로 체험을 끝낼 수 있다', async ({ page }) => {
    await setMotion(page, 'minimal', 'off');
    await gotoTrial(page);
    await page
      .getByRole('heading', { level: 2, name: '첫 주문을 걸어 봐요' })
      .focus();
    await page.keyboard.press('Tab');
    const input = page.getByLabel('파이썬 한 줄');
    await expect(input).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type(' 파이뱀');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('trial-out')).toContainText('안녕! 파이뱀');
    await expect(page.getByTestId('trial-cta')).toBeVisible();
    // Tab으로 주문 걸기 → (추천 주문) → … → 로그인 카드 버튼까지 닿는다
    await expect(
      page.getByTestId('trial-cta').getByRole('button', { name: /모험 시작/ }),
    ).toBeEnabled();
  });

  test('휴대폰 둥근 따옴표는 코드 따옴표로 고쳐진다', async ({ page }) => {
    const input = await takeNotebook(page);
    await input.fill('print(“안녕”)');
    await expect(input).toHaveValue('print("안녕")');
    await input.press('Enter');
    await expect(page.getByTestId('trial-out')).toContainText('안녕');
  });

  test('보조 키 " ( ) 가 손가락 화면에서 커서 자리에 들어간다', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 780 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await setMotion(page, 'minimal', 'off');
    await gotoTrial(page);
    const input = page.getByLabel('파이썬 한 줄');
    await input.tap();
    await input.fill('print');
    await page.getByRole('button', { name: '( 쓰기' }).tap();
    await page.getByRole('button', { name: '" 쓰기' }).tap();
    await input.pressSequentially('hi');
    await page.getByRole('button', { name: '" 쓰기' }).tap();
    await page.getByRole('button', { name: ') 쓰기' }).tap();
    await expect(input).toHaveValue('print("hi")');
    await expect(input).toBeFocused();
    await ctx.close();
  });
});
