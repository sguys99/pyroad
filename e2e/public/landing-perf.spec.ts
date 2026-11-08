// 비로그인 스펙 (`public` 프로젝트). 랜딩 성능 예산 장치 (P4-12, §2.10):
// 첫 화면 글자는 하이드레이션 전에도 보인다(opacity 0 SSR 없음) · 렌더 차단 CSS는 첫 화면 것만 ·
// 늦게 오는 아래쪽 섹션 CSS가 오기 전에는 깨진 모습 대신 빈 자리 · 바로가기는 CSS를 기다렸다가 제목으로 · 설치 띠 막기

import { test, expect, type Page, type Route } from '@playwright/test';
import { watchCspViolations } from '../support/test';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

/** 랜딩 HTML이 처음부터 거는 스타일시트 (렌더 차단 CSS) */
async function blockingCss(page: Page): Promise<string[]> {
  const html = await (await page.request.get('/')).text();
  return [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map((m) => m[1])
    .map((h) => h.replace(/[?#].*$/, ''));
}

/** HTML에 없는 CSS(늦게 오는 아래쪽 섹션 CSS)를 `release()` 때까지 붙잡는다 */
async function holdLateCss(page: Page) {
  const first = new Set(await blockingCss(page));
  const held: Route[] = [];
  let open = false;
  await page.route('**/_next/static/**/*.css*', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (open || first.has(path)) return route.continue();
    held.push(route);
  });
  return {
    heldCount: () => held.length,
    release: async () => {
      open = true;
      await Promise.all(held.splice(0).map((r) => r.continue()));
    },
  };
}

/** 섹션 본문(머리글 밖 첫 자식)의 visibility */
function bodyVisibility(page: Page, id: string) {
  return page
    .locator(`#${id} > .ld-sec-in > :not(.ld-sec-head)`)
    .first()
    .evaluate((el) => getComputedStyle(el).visibility);
}

test('하이드레이션 전에도 첫 화면 글자가 보인다 (opacity 0 서버 렌더 없음, §2.10)', async ({
  page,
}) => {
  // 번들 JS를 막아 서버 HTML + 렌더 차단 CSS만으로 그린 모습을 본다 (인라인 부트 스크립트는 돈다)
  await page.route('**/_next/static/chunks/*.js*', (r) => r.abort());
  await page.goto('/');
  for (const sel of ['#hero-title', '.hero-sub', '.hero-cta', '#try-title']) {
    const el = page.locator(sel).first();
    await expect(el).toBeVisible();
    // 자기와 조상 중 opacity가 0인 것이 없다
    const minOpacity = await el.evaluate((node) => {
      let min = 1;
      for (let n: Element | null = node; n; n = n.parentElement)
        min = Math.min(min, Number(getComputedStyle(n).opacity));
      return min;
    });
    expect(minOpacity, sel).toBeGreaterThan(0.9);
  }
});

test('렌더 차단 CSS는 2개(전역 + 첫 화면)뿐이고 앱 화면 CSS는 싣지 않는다', async ({
  page,
}) => {
  const sheets = await blockingCss(page);
  expect(sheets).toHaveLength(2);
  const css = (
    await Promise.all(
      sheets.map(async (h) => (await page.request.get(h)).text()),
    )
  ).join('\n');
  expect(css).not.toContain('--pyroad-app-css'); // src/app/app.css
  expect(css).not.toContain('.ld-worlds'); // 아래쪽 섹션 CSS는 늦게
  expect(css).toContain('.hero-title'); // 첫 화면은 처음부터
  expect(css).toContain('.ld-trial');
});

test('아래쪽 섹션 CSS가 오기 전에는 본문을 숨기고(깨진 모습 없음), 오면 보인다', async ({
  page,
}) => {
  const late = await holdLateCss(page);
  await page.goto('/');
  await expect.poll(() => late.heldCount()).toBeGreaterThan(0);
  await page.locator('#worlds').scrollIntoViewIfNeeded();
  // 머리글은 첫 화면 CSS라 보이고, 본문은 빈 자리
  await expect(page.locator('#worlds-title')).toBeVisible();
  expect(await bodyVisibility(page, 'worlds')).toBe('hidden');
  expect(await bodyVisibility(page, 'faq')).toBe('hidden');
  await late.release();
  await expect.poll(() => bodyVisibility(page, 'worlds')).toBe('visible');
  await expect.poll(() => bodyVisibility(page, 'fun')).toBe('visible');
  await expect.poll(() => bodyVisibility(page, 'friends')).toBe('visible');
  await expect.poll(() => bodyVisibility(page, 'parents')).toBe('visible');
  await expect.poll(() => bodyVisibility(page, 'faq')).toBe('visible');
  await expect(page.getByTestId('worlds-map')).toBeVisible();
});

test('바로가기는 아래쪽 섹션 CSS를 기다렸다가 그 제목으로 간다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const late = await holdLateCss(page);
  await page.goto('/');
  // 늦은 CSS 요청은 하이드레이션 뒤 효과에서 나가므로, 붙잡혔으면 헤더 바로가기도 JS로 동작한다
  await expect.poll(() => late.heldCount()).toBeGreaterThan(0);
  await page
    .locator('header')
    .getByRole('link', { name: '보호자 안내' })
    .click();
  await page.waitForTimeout(300);
  await late.release();
  await expect(page).toHaveURL(/#parents$/);
  await expect(page.locator('#parents-title')).toBeFocused();
  await expect(page.locator('#parents-title')).toBeInViewport();
  expect(await bodyVisibility(page, 'parents')).toBe('visible');
});

test('주소에 #faq를 달고 들어와도 CSS가 붙은 뒤 FAQ 제목이 화면에 있다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#faq');
  await expect.poll(() => bodyVisibility(page, 'faq')).toBe('visible');
  await expect(page.locator('#faq-title')).toBeInViewport();
});

test('랜딩은 설치 띠(beforeinstallprompt)의 기본 동작을 막는다 (설치 안내는 로그인 뒤에만, P4-11)', async ({
  page,
}) => {
  await page.goto('/');
  const prevented = await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(prevented).toBe(true);
});
