// 상점 API (P9-03): 로그인 세션으로 구매 → 장착 → 상태에 반영 → 벗기. API 계약만 확인 (화면 흐름은 shop.spec.ts, P9-02).
// 코인은 테스트 키로 지급, 가격은 서버(shop_items)가 정하고, 장착은 users.avatar_config(외형)·settings.editor_theme(테마)

import { test, expect } from './support/test';
import { adminClient, coinMismatches, grantTestCoins } from './support/admin';

test('구매 → 장착 → 상태·avatar_config 반영, 다시 사기·안 가진 것 장착은 거부, 벗기', async ({
  page,
  e2eUser,
}) => {
  await grantTestCoins(e2eUser.id, 400);
  const before = await (await page.request.get('/api/shop')).json();

  const buy = await page.request.post('/api/shop/purchase', {
    data: { itemId: 'hat_party' },
  });
  // 같은 사용자로 다시 돌린 실행이면 이미 가짐
  if (!before.owned.includes('hat_party')) {
    expect(buy.status()).toBe(200);
    expect((await buy.json()).coins_balance).toBe(before.coins - 150);
  } else expect(buy.status()).toBe(409);

  const again = await page.request.post('/api/shop/purchase', {
    data: { itemId: 'hat_party' },
  });
  expect(again.status()).toBe(409);
  expect(await again.json()).toMatchObject({ code: 'already_owned' });

  const notOwned = await page.request.post('/api/shop/equip', {
    data: { slot: 'hat', itemId: 'hat_crown' },
  });
  expect(notOwned.status()).toBe(403);

  const on = await page.request.post('/api/shop/equip', {
    data: { slot: 'hat', itemId: 'hat_party' },
  });
  expect(on.status()).toBe(200);
  const status = await (await page.request.get('/api/shop')).json();
  expect(status.owned).toContain('hat_party');
  expect(status.equipped.hat).toBe('hat_party');
  // 렌더링 원본 avatar_config 에 슬롯별 아이템 id (P9-05가 costumeFromAvatarConfig 로 그림)
  const { data } = await adminClient()
    .from('users')
    .select('avatar_config')
    .eq('id', e2eUser.id)
    .single();
  expect(data!.avatar_config).toMatchObject({ hat: 'hat_party' });

  const off = await page.request.post('/api/shop/equip', {
    data: { slot: 'hat', itemId: null },
  });
  expect(off.status()).toBe(200);
  expect((await off.json()).equipped.hat).toBeUndefined();
  expect(await coinMismatches([e2eUser.id])).toEqual([]);
});
