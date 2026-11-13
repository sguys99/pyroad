// 꾸민 캐릭터 반영 (P9-05): 상점 옷장에서 마법사 모자·별빛 테두리·삐약이를 입으면 → (상점 "월드맵" 링크로 클라이언트 이동) 월드맵 HUD 아바타·
// 지금 위치 파이뱀·동행 펫 → 퀘스트 대화 패널 파이뱀 → 프로필 머리 아바타 → 게시판 공개 아바타(00042 avatar_look)에 모두 보임. 360·1280,
// 스크린샷은 test-results 에 붙임. 물건은 API 로 사 두고(구매 화면 흐름은 shop.spec.ts), 입기는 상점 화면에서

import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect } from './support/test';
import { adminClient, grantTestCoins } from './support/admin';
import { stage } from './support/content';

const WEAR = [
  { id: 'hat_wizard', name: '마법사 모자', slot: 'hat' },
  { id: 'frame_star', name: '별빛 테두리', slot: 'frame' },
  { id: 'pet_chick', name: '삐약이', slot: 'pet' },
] as const;

for (const width of [360, 1280]) {
  test(`${width}px: 상점에서 입은 모습이 지도·HUD·퀘스트·프로필·게시판에 반영`, async ({
    page,
    e2eUser,
  }, testInfo) => {
    await grantTestCoins(e2eUser.id, 3000);
    for (const w of WEAR) {
      const buy = await page.request.post('/api/shop/purchase', {
        data: { itemId: w.id },
      });
      expect([200, 409]).toContain(buy.status());
      await page.request.post('/api/shop/equip', {
        data: { slot: w.slot, itemId: null },
      });
    }

    await page.setViewportSize({ width, height: 800 });
    await page.goto('/shop');
    await page.getByRole('tab', { name: /내 옷장/ }).click();
    const sheet = page.getByTestId('shop-sheet');
    for (const w of WEAR) {
      await page
        .getByTestId('shop-closet')
        .locator(`[data-item="${w.id}"] button`)
        .click();
      await sheet.getByTestId('shop-equip').click();
      await expect(
        page.getByTestId('shop-closet').locator(`[data-item="${w.id}"]`),
      ).toHaveAttribute('data-state', 'equipped');
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
    }

    // 상점 → 월드맵 (클라이언트 이동: 로그인 레이아웃은 다시 그려지지 않아 MyLookProvider 를 상점이 갱신)
    await page.getByRole('link', { name: '월드맵' }).click();
    await expect(page).toHaveURL(/\/world/);
    const hudAvatar = page
      .getByTestId('hud-profile')
      .getByTestId('user-avatar');
    await expect(hudAvatar).toHaveAttribute('data-hat', 'wizard');
    await expect(hudAvatar).toHaveAttribute('data-frame', 'star');
    await expect(hudAvatar.locator('[data-hat="wizard"]')).toHaveCount(1);
    const marker = page.getByTestId('world-current-marker');
    await expect(marker.locator('[data-hat="wizard"]')).toHaveCount(1);
    await expect(page.getByTestId('world-pet')).toHaveAttribute(
      'data-pet',
      'pet_chick',
    );
    // 32px 아바타: 모자 끝까지 칩 안 (칩 밖으로 나가지 않음)
    const chip = await hudAvatar.boundingBox();
    const hat = await hudAvatar.locator('[data-hat="wizard"]').boundingBox();
    expect(hat!.y).toBeGreaterThanOrEqual(chip!.y - 0.5);
    await marker.scrollIntoViewIfNeeded();
    await expect(marker).toBeVisible();
    // 지도 노드 등장 연출이 끝난 모습으로
    await page.waitForTimeout(1200);
    await shot(testInfo, `world-${width}`, page);

    // 새로 고침해도 (서버 avatar_config 로) 같은 모습
    await page.reload();
    await expect(
      page.getByTestId('hud-profile').getByTestId('user-avatar'),
    ).toHaveAttribute('data-hat', 'wizard');

    // 퀘스트 대화 패널
    await page.goto(`/quest/${stage(1).quests[0].id}`);
    const dialogue = page.getByTestId('quest-dialogue');
    await expect(dialogue.locator('[data-hat="wizard"]')).toHaveCount(1);
    await shot(testInfo, `quest-${width}`, page);

    // 프로필 머리
    await page.goto('/profile');
    const heroAvatar = page
      .getByTestId('profile-hero')
      .getByTestId('user-avatar');
    await expect(heroAvatar).toHaveAttribute('data-hat', 'wizard');
    await expect(heroAvatar).toHaveAttribute('data-frame', 'star');
    await shot(testInfo, `profile-${width}`, page.getByTestId('profile-hero'));

    // 게시판: 다른 아이에게 보이는 공개 아바타 (user_profiles_public.avatar_look)
    const admin = adminClient();
    const { data: post } = await admin
      .from('board_posts')
      .insert({
        user_id: e2eUser.id,
        title: 'P9-05 꾸민 아바타',
        content: '모자랑 테두리가 보여요',
      })
      .select('id')
      .single();
    try {
      await page.goto('/board');
      const card = page
        .locator('a, article, li')
        .filter({ hasText: 'P9-05 꾸민 아바타' })
        .first();
      const pub = card.getByTestId('user-avatar');
      await expect(pub).toHaveAttribute('data-hat', 'wizard');
      await expect(pub).toHaveAttribute('data-frame', 'star');
      await shot(testInfo, `board-${width}`, card);
    } finally {
      await admin.from('board_posts').delete().eq('id', post!.id);
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}

/** 눈으로 보는 확인용 스크린샷 (test-results/…/<이름>.png + 보고서 첨부) */
async function shot(
  testInfo: TestInfo,
  name: string,
  target: Page | Locator,
): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await target.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}
