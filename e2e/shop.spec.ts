// 상점 화면 (P9-02): 월드맵 HUD 에서 상점 열기 → 칸 → 시트에서 미리 입어 보기 → 구매 확인 → 서버 구매 → 구매 축하 → 바로 입기 →
// 칸·거울 무대·서버 장착(avatar_config)에 반영. 360(코인 칩으로 들어옴)·1280(상점 칩). 가로 넘침 0, 잔액 = 원장
// 사용자는 이번 실행 전용이지만 원장·가진 물건은 리셋되지 않아, 아직 안 가진 코스튬을 골라 씀

import { test, expect } from './support/test';
import { adminClient, coinMismatches, grantTestCoins } from './support/admin';

/** 슬롯 · 리그 그림 키 (data-look 에 보임) */
const CANDIDATES = [
  { id: 'glasses_round', name: '동글 안경', look: '"glasses":"round"' },
  { id: 'cape_hero', name: '영웅 망토', look: '"cape":' },
  { id: 'hat_explorer', name: '탐험가 모자', look: '"hat":"explorer"' },
  { id: 'glasses_sun', name: '멋쟁이 선글라스', look: '"glasses":"sun"' },
] as const;

for (const width of [360, 1280]) {
  test(`${width}px: 상점 열기 → 미리 입어 보기 → 구매 → 바로 입기가 화면·서버에 반영`, async ({
    page,
    e2eUser,
  }) => {
    await grantTestCoins(e2eUser.id, 1000);
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/world');
    const hud = page.getByTestId('world-hud');
    // 360 은 바에 상점 칩이 없어 코인 칩으로, 1280 은 상점 칩으로
    await (
      width < 640
        ? hud.getByTestId('hud-coin-shop')
        : hud.getByRole('link', { name: '상점', exact: true })
    ).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(
      page.getByRole('heading', { name: '파이뱀 상점' }),
    ).toBeVisible();

    const before = await (await page.request.get('/api/shop')).json();
    const pick = CANDIDATES.find((c) => !before.owned.includes(c.id))!;
    await expect(page.getByTestId('hud-coin')).toContainText(
      `코인 ${before.coins.toLocaleString('ko-KR')}개`,
    );

    // 칸 → 시트: 지금 모습 위에 그 물건을 입힌 미리 보기
    await page
      .getByRole('button', { name: new RegExp(`^${pick.name},`) })
      .click();
    const sheet = page.getByTestId('shop-sheet');
    await expect(sheet.getByRole('heading', { name: pick.name })).toBeVisible();
    await expect(sheet.getByTestId('shop-stage')).toHaveAttribute(
      'data-look',
      new RegExp(pick.look.replace(/[{}]/g, '')),
    );

    // 구매 확인: 가격·지금·남는 코인
    await sheet.getByTestId('shop-buy').click();
    const confirm = sheet.getByTestId('shop-confirm');
    await expect(confirm).toContainText('정말 살까요?');
    await confirm.getByTestId('shop-buy-confirm').click();

    // 구매 축하 → 바로 입기
    const card = page.getByTestId('celebration-step-purchase');
    await expect(card).toBeVisible();
    await expect(card).toContainText(pick.name);
    await card.getByTestId('purchase-wear').click();
    await expect(page.getByTestId('celebration-overlay')).toHaveCount(0);

    const tile = page.locator(`[data-item="${pick.id}"]`).first();
    await expect(tile).toHaveAttribute('data-state', 'equipped');
    await expect(
      page.getByTestId('shop-mirror').getByTestId('shop-stage'),
    ).toHaveAttribute('data-look', new RegExp(pick.look.replace(/[{}]/g, '')));
    await expect(
      page.getByRole('list', { name: '지금 입은 것' }),
    ).toContainText(pick.name);

    // 서버: 가짐 + 장착(avatar_config) + 잔액 = 원장
    const after = await (await page.request.get('/api/shop')).json();
    expect(after.owned).toContain(pick.id);
    expect(after.coins).toBe(before.coins - (await price(pick.id)));
    const { data } = await adminClient()
      .from('users')
      .select('avatar_config')
      .eq('id', e2eUser.id)
      .single();
    expect(Object.values(data!.avatar_config as object)).toContain(pick.id);
    await expect(page.getByTestId('hud-coin')).toContainText(
      `코인 ${after.coins.toLocaleString('ko-KR')}개`,
    );
    expect(await coinMismatches([e2eUser.id])).toEqual([]);

    // 내 옷장에서 벗기
    await page.getByRole('tab', { name: /내 옷장/ }).click();
    await page
      .getByTestId('shop-closet')
      .locator(`[data-item="${pick.id}"] button`)
      .click();
    await sheet.getByTestId('shop-equip').click();
    await expect(sheet.getByTestId('shop-equip')).toHaveText(/입기/);
    await page.keyboard.press('Escape');
    await expect(
      page.getByTestId('shop-closet').locator(`[data-item="${pick.id}"]`),
    ).toHaveAttribute('data-state', 'owned');

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}

async function price(id: string): Promise<number> {
  const { data } = await adminClient()
    .from('shop_items')
    .select('price')
    .eq('id', id)
    .single();
  return data!.price;
}
