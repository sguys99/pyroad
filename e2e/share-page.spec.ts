// 공유 페이지 /share/[cardId] (P9-08): 로그인 사용자가 카드를 만들고 → 링크를 받은 사람이 로그인 없이 연다.
// 메타(og:image·og:url·noindex), 이미지 캐시 헤더, 개인정보(user id·실명·이메일·쿼리 문자열 글자) 없음, 없는 카드 404.

import { test, expect, watchCspViolations } from './support/test';
import { adminClient } from './support/admin';

const NICK = '공유별명';
const REAL_NAME = '홍길동실명';

test('카드 만들기 → 비로그인 열람·메타·이미지 헤더 → 없는 카드는 404', async ({
  page,
  e2eUser,
  browser,
  baseURL,
}, testInfo) => {
  const db = adminClient();
  const { data: before } = await db
    .from('users')
    .select('nickname, display_name')
    .eq('id', e2eUser.id)
    .single();
  // 실명(display_name)과 공개 이름(nickname)을 구분되게 두고 페이지에 실명이 없는지 본다
  await db
    .from('users')
    .update({ nickname: NICK, display_name: REAL_NAME })
    .eq('id', e2eUser.id);
  try {
    const made = await page.request.post('/api/share-cards', {
      data: { kind: 'levelup' },
    });
    expect(made.status()).toBe(200);
    const card = await made.json();
    const pagePath = `/share/${card.id}`;

    // 설정의 로그인 storageState 를 물려받지 않게 비워 둔다
    const anon = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
      viewport: { width: 360, height: 780 },
    });
    const visitor = await anon.newPage();
    const csp = await watchCspViolations(visitor);
    // 쿼리 문자열 글자는 그리지 않는다
    const res = await visitor.goto(
      `${pagePath}?nickname=${encodeURIComponent('해커')}&title=${encodeURIComponent('<b>가짜</b>')}`,
    );
    expect(res!.status()).toBe(200);
    await expect(visitor.getByRole('heading', { level: 1 })).toContainText(
      `${NICK}님이 레벨`,
    );
    const img = visitor.getByTestId('share-card-image');
    await expect(img).toHaveAttribute(
      'alt',
      new RegExp(`^레벨업 카드. ${NICK}님`),
    );
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBe(1200);

    const meta = (sel: string) =>
      visitor.locator(sel).first().getAttribute('content');
    // 메타 주소는 metadataBase(사이트 주소) 기준 절대 주소 — 경로만 비교
    const pathOf = async (sel: string) => {
      const u = new URL((await meta(sel))!);
      return u.pathname + u.search;
    };
    expect(await meta('meta[name="robots"]')).toContain('noindex');
    expect(await pathOf('meta[property="og:image"]')).toBe(card.imageUrl);
    expect(await meta('meta[property="og:image:width"]')).toBe('1200');
    expect(await meta('meta[property="og:image:height"]')).toBe('630');
    expect(await meta('meta[property="og:image:alt"]')).toContain(NICK);
    expect(await pathOf('meta[property="og:url"]')).toBe(pagePath);
    expect(await pathOf('meta[name="twitter:image"]')).toBe(card.imageUrl);

    const html = await (await anon.request.get(pagePath)).text();
    for (const secret of [
      e2eUser.id,
      e2eUser.email,
      REAL_NAME,
      '해커',
      '가짜',
    ]) {
      expect(html, secret).not.toContain(secret);
    }

    await visitor.screenshot({
      path: testInfo.outputPath('share-360.png'),
      fullPage: true,
    });
    await visitor.setViewportSize({ width: 768, height: 1000 });
    await visitor.screenshot({
      path: testInfo.outputPath('share-768.png'),
      fullPage: true,
    });
    await visitor.setViewportSize({ width: 1280, height: 800 });
    await visitor.screenshot({
      path: testInfo.outputPath('share-1280.png'),
      fullPage: true,
    });
    const wide = await visitor.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(wide).toBeLessThanOrEqual(1280);

    // 이미지: 비로그인 열람·캐시 헤더 (P9-07 라우트, 계획서 P9-08 표)
    const png = await anon.request.get(card.imageUrl);
    expect(png.status()).toBe(200);
    expect(png.headers()['cache-control']).toBe('public, max-age=3600');
    expect(png.headers()['vercel-cdn-cache-control']).toMatch(
      /^public, max-age=\d+$/,
    );
    expect(png.headers()['vercel-cache-tag']).toBe(`share-card-${card.id}`);

    // "나도 해보기" → 랜딩 30초 체험 (비로그인)
    await visitor.getByTestId('share-cta').click();
    await expect(visitor).toHaveURL(/\/#try$/);
    expect(csp).toEqual([]);

    // 없는 id·틀린 모양·비공개·만료 → 친절한 404, 아이 정보 없음
    const gone = async (path: string) => {
      const r = await visitor.goto(path);
      expect(r!.status(), path).toBe(404);
      await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(
        '이 카드는 더 이상 볼 수 없어요',
      );
      await expect(visitor.getByTestId('share-cta')).toBeVisible();
      expect(await meta('meta[name="robots"]')).toContain('noindex');
      expect(await visitor.content()).not.toContain(NICK);
    };
    await gone('/share/AAAAAAAAAAAAAAAAAAAAAA');
    await gone('/share/not-a-card');
    await visitor.setViewportSize({ width: 360, height: 780 });
    await visitor.screenshot({
      path: testInfo.outputPath('share-gone-360.png'),
      fullPage: true,
    });

    // 비공개·만료는 share_card_public 이 0행(= 없는 카드와 같은 null 경로) — SQL 은 RLS 회귀 SC-2 가 확인
    // (service_role 에 share_cards UPDATE 권한이 없어 e2e 에서 뒤집지 않음)
    expect(csp).toEqual([]);
    await anon.close();
  } finally {
    await db.from('users').update(before!).eq('id', e2eUser.id);
  }
});
