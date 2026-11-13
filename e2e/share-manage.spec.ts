// 내 자랑 카드 (P9-11): 프로필 → /profile/cards 에서 숨기기 → 공유 페이지·이미지 404 → 다시 공개 → 200,
// 닉네임을 바꾸면 version + 1 (og:image ?v= 가 바뀜), 지우기(확인) → 404. CDN 지우기는 Vercel 밖이라 아무 일도 안 함(런북에서 확인).

import { test, expect } from './support/test';
import { adminClient } from './support/admin';

test('숨기기·다시 공개·닉네임 변경·지우기', async ({
  page,
  e2eUser,
  browser,
  baseURL,
}, testInfo) => {
  const db = adminClient();
  const { data: before } = await db
    .from('users')
    .select('nickname')
    .eq('id', e2eUser.id)
    .single();
  await db.from('users').update({ nickname: '카드주인' }).eq('id', e2eUser.id);
  // 다른 스펙이 만든 카드를 치움 (service_role 은 share_cards 를 직접 지울 수 없어 RPC 로)
  const { data: old } = await db
    .from('share_cards')
    .select('id')
    .eq('user_id', e2eUser.id);
  for (const c of old ?? [])
    await db.rpc('manage_share_card', {
      p_user_id: e2eUser.id,
      p_card_id: c.id,
      p_action: 'delete',
    });
  const anon = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const made = await page.request.post('/api/share-cards', {
      data: { kind: 'levelup' },
    });
    expect(made.status()).toBe(200);
    const card = await made.json();
    const pagePath = `/share/${card.id}`;
    const status = async (path: string) =>
      (await anon.request.get(path)).status();
    const ogImage = async () => {
      const html = await (await anon.request.get(pagePath)).text();
      return /property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? '';
    };
    expect(await status(pagePath)).toBe(200);
    expect(await status(card.imageUrl)).toBe(200);

    // 프로필 → 내 자랑 카드
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/profile');
    await expect(page.getByTestId('profile-share-cards')).toContainText(
      '1장 · 지금 1장 공개 중',
    );
    await page.getByTestId('profile-share-cards').screenshot({
      path: testInfo.outputPath('profile-entry-360.png'),
    });
    await page.getByTestId('profile-share-cards').click();
    await expect(page).toHaveURL(/\/profile\/cards$/);
    const item = page.getByTestId('my-card').first();
    await expect(item).toHaveAttribute('data-state', 'public');
    await expect(item.getByTestId('my-card-state')).toHaveText('공개 중');
    await expect(item).toContainText('레벨 업 카드');
    await expect(item).toContainText(/90일 남음|89일 남음/);
    await expect
      .poll(() =>
        item.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth),
      )
      .toBe(1200);
    await page.screenshot({
      path: testInfo.outputPath('cards-360.png'),
      fullPage: true,
    });

    // 숨기기 → 링크·그림 모두 404
    await item.getByTestId('my-card-hide').click();
    await expect(page.getByTestId('my-cards-status')).toContainText(
      '카드를 숨겼어요',
    );
    await expect(item).toHaveAttribute('data-state', 'hidden');
    expect(await status(pagePath)).toBe(404);
    expect(await status(card.imageUrl)).toBe(404);
    await page.screenshot({
      path: testInfo.outputPath('cards-hidden-360.png'),
      fullPage: true,
    });

    // 다시 공개 → 200, 다시 보내기 시트는 같은 카드(만들기 요청 없음)
    await item.getByTestId('my-card-show').click();
    await expect(item).toHaveAttribute('data-state', 'public');
    expect(await status(pagePath)).toBe(200);
    expect(await status(card.imageUrl)).toBe(200);
    let created = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/share-cards'))
        created++;
    });
    await item.getByTestId('my-card-share').click();
    await expect(page.getByTestId('share-sheet-preview')).toHaveAttribute(
      'src',
      card.imageUrl,
    );
    await page.keyboard.press('Escape');
    expect(created).toBe(0);

    // 닉네임을 바꾸면 카드가 새 이름으로 다시 그려지고 이미지 주소 ?v= 가 바뀜
    const oldImage = await ogImage();
    await db
      .from('users')
      .update({ nickname: '새카드주인' })
      .eq('id', e2eUser.id);
    const newImage = await ogImage();
    expect(oldImage).toContain(`?v=${card.version}`);
    expect(newImage).toContain(`?v=${card.version + 1}`);
    expect(await (await anon.request.get(pagePath)).text()).toContain(
      '새카드주인',
    );

    // 1280: 두 열
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await page.screenshot({
      path: testInfo.outputPath('cards-1280.png'),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(1280);

    // 지우기: 확인 대화 상자 → 목록에서 사라지고 404
    await page.setViewportSize({ width: 360, height: 780 });
    await page
      .getByTestId('my-card')
      .first()
      .getByTestId('my-card-delete')
      .click();
    const dialog = page.getByTestId('my-card-delete-dialog');
    await expect(dialog).toContainText('이 카드를 지울까요?');
    // 등장 연출이 끝난 뒤 찍음
    await dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
    await page.screenshot({
      path: testInfo.outputPath('cards-delete-360.png'),
    });
    await dialog.getByTestId('my-card-delete-confirm').click();
    await expect(page.getByTestId('my-cards-empty')).toBeVisible();
    expect(await status(pagePath)).toBe(404);
    expect(await status(card.imageUrl)).toBe(404);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  } finally {
    await anon.close();
    await db.from('users').update(before!).eq('id', e2eUser.id);
  }
});
