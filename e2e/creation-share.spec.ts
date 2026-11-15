// 작품 자랑 카드 (P11-08): 갤러리에 전시 중인 내 작품 → 작품 보기 "자랑 카드 만들기" → 공유 시트(미리보기·안내)
// → 비로그인 공유 페이지(작품 이름·대화 앞 줄은 카드 그림에만, 코드·user id 없음) → 갤러리에서 내리기 → 링크·그림 404
// → 내 자랑 카드 "작품이 갤러리에 없어서 닫혔어요" · 다시 공개 API 409. 비공개 작품은 처음부터 만들 수 없음(409).
// CDN 지우기는 Vercel 밖이라 아무 일도 안 함(런북에서 확인). CSP 위반은 자동 픽스처(cspGuard)가 잡는다.

import { test, expect } from './support/test';
import { adminClient } from './support/admin';

const SECRET_CODE = 'print("비밀코드_e2e")';

test('작품 카드 만들기 → 공개 페이지 → 내리기 → 404', async ({
  page,
  e2eUser,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const db = adminClient();
  await db
    .from('users')
    .update({ nickname: '퀴즈쇼작가' })
    .eq('id', e2eUser.id);
  const { data: work, error } = await db
    .from('creations')
    .insert({
      user_id: e2eUser.id,
      kind: 'conversation',
      title: '두근두근 퀴즈쇼',
      code: SECRET_CODE,
      transcript: [
        { text: '퀴즈쇼에 온 걸 환영해요! 이름이 뭐예요?' },
        { text: '번개', answer: true },
        { text: '첫 문제! 파이썬의 마스코트는?' },
        { text: '파이뱀', answer: true },
        { text: '정답이에요! 다섯째 줄은 카드에 안 나와요' },
      ],
      visibility: 'public',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  const workId = work!.id as string;
  const { data: priv } = await db
    .from('creations')
    .insert({
      user_id: e2eUser.id,
      kind: 'conversation',
      title: '비밀 일기',
      transcript: [{ text: '나만 볼래' }],
    })
    .select('id')
    .single();
  const anon = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    // 비공개 작품은 카드를 만들 수 없음
    const denied = await page.request.post('/api/share-cards', {
      data: { kind: 'creation', ref: priv!.id },
    });
    expect(denied.status()).toBe(409);

    // 작품 보기 → 자랑 카드 만들기 → 시트
    await page.goto(`/gallery/${workId}`);
    const made = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/share-cards') && r.request().method() === 'POST',
    );
    await page.getByTestId('owner-share-card').click();
    const card = await (await made).json();
    expect(card.kind).toBe('creation');
    const sheet = page.getByTestId('share-sheet');
    await expect(sheet.getByTestId('share-notice')).toContainText(
      '코드는 보이지 않아요',
    );
    await expect
      .poll(() =>
        sheet
          .getByTestId('share-sheet-preview')
          .evaluate((el: HTMLImageElement) => el.naturalWidth),
      )
      .toBe(1200);
    await sheet.screenshot({ path: testInfo.outputPath('sheet.png') });
    await page.keyboard.press('Escape');

    // 비로그인 공유 페이지: 작품 문구, 코드·개인정보 없음
    const sharePath = `/share/${card.id}`;
    const res = await anon.request.get(sharePath);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('두근두근 퀴즈쇼');
    expect(html).toContain('구경해 주세요');
    for (const leak of [
      '비밀코드_e2e',
      e2eUser.id,
      workId,
      '다섯째 줄',
      e2eUser.email,
    ])
      expect(html).not.toContain(leak);
    expect(html).toMatch(/name="robots" content="noindex/);
    const img = await anon.request.get(card.imageUrl);
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toBe('image/png');

    const viewer = await anon.newPage();
    for (const width of [360, 1280]) {
      await viewer.setViewportSize({ width, height: 800 });
      await viewer.goto(sharePath);
      await expect
        .poll(() =>
          viewer
            .getByTestId('share-card-image')
            .evaluate((el: HTMLImageElement) => el.naturalWidth),
        )
        .toBe(1200);
      const sw = await viewer.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(sw).toBeLessThanOrEqual(width);
      await viewer.screenshot({
        path: testInfo.outputPath(`share-page-${width}.png`),
        fullPage: true,
      });
    }

    // 갤러리에서 내리기 → 링크·그림 모두 404
    await page.getByTestId('owner-unpublish').click();
    await expect(page.getByTestId('owner-unpublish-dialog')).toContainText(
      '자랑 카드 링크도 닫혀요',
    );
    await page.getByTestId('owner-unpublish-confirm').click();
    await expect(page.getByTestId('owner-status')).toContainText('내렸어요');
    expect((await anon.request.get(sharePath)).status()).toBe(404);
    expect((await anon.request.get(card.imageUrl)).status()).toBe(404);

    // 내 자랑 카드: 닫힌 까닭 + 다시 공개 버튼 대신 안내, API 로도 다시 못 엶
    await page.goto('/profile/cards');
    const item = page
      .getByTestId('my-card')
      .filter({ hasText: '두근두근 퀴즈쇼' });
    await expect(item).toContainText('작품이 갤러리에 없어서 닫혔어요');
    await expect(item.getByTestId('my-card-show')).toHaveCount(0);
    const reshow = await page.request.patch(`/api/share-cards/${card.id}`, {
      data: { action: 'show' },
    });
    expect(reshow.status()).toBe(409);

    // 작품을 지우면 카드 행도 사라짐
    await db.from('creations').delete().eq('id', workId);
    const { count } = await db
      .from('share_cards')
      .select('id', { count: 'exact', head: true })
      .eq('id', card.id);
    expect(count).toBe(0);
  } finally {
    await anon.close();
    await db.from('creations').delete().in('id', [workId, priv!.id]);
  }
});
