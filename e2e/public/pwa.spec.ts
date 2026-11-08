// 앱 매니페스트·아이콘 (P4-11, `public` 프로젝트). 빌드 때 만든 정적 응답이 비로그인으로 오고,
// 모든 페이지 <head>가 매니페스트·파비콘·홈 화면 아이콘을 가리키며, 미들웨어(세션·페이지 CSP)를 거치지 않는다.

import { test, expect } from '@playwright/test';

test('매니페스트: 이름·시작 주소·표시 방식·아이콘', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/manifest+json');
  // 정적 파일처럼 미들웨어를 건너뛴다 (페이지 CSP가 붙지 않음)
  expect(res.headers()['content-security-policy']).toBeUndefined();
  const m = await res.json();
  expect(m).toMatchObject({
    short_name: 'pyRoad',
    lang: 'ko',
    start_url: '/world',
    display: 'standalone',
  });
  expect(m.orientation).toBeUndefined();
  const sizes = m.icons.map(
    (i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`,
  );
  expect(sizes).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
  for (const icon of m.icons as { src: string; sizes: string }[]) {
    const img = await request.get(icon.src);
    expect(img.status(), icon.src).toBe(200);
    expect(img.headers()['content-type']).toBe('image/png');
    const buf = await img.body();
    const [w] = icon.sizes.split('x').map(Number);
    expect(buf.readUInt32BE(16), icon.src).toBe(w);
  }
});

test('모든 페이지 head: 매니페스트·파비콘 32·apple-touch-icon 180', async ({
  page,
  request,
}) => {
  await page.goto('/terms');
  const head = page.locator('head');
  await expect(head.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  const icon = head.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute('sizes', '32x32');
  const apple = head.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveAttribute('sizes', '180x180');
  for (const href of [
    await icon.getAttribute('href'),
    await apple.getAttribute('href'),
  ]) {
    const res = await request.get(href!);
    expect(res.status(), href!).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }
  // 테마 색 = 단색 바탕
  await expect(head.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#F6F4EF',
  );
});
