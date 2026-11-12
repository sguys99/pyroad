import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { purchaseItemRpc, rewardError } from '@/lib/quest/rewardRpc';
import { trackServerEvent } from '@/lib/analytics/server';
import { ITEM_ID } from '@/lib/shop/api';

/**
 * 상점 구매 (P9-03, §3 "코인 밸런스", §12-Q65). 본문 `{ itemId }`. 사용자는 `auth.getUser()`로 확인한 id 만
 *
 * - 가격·주 한도·보유 상한은 서버(`purchase_item`, 00040)가 shop_items 에서 읽음 — 클라이언트가 보낸 가격은 받지 않음
 * - 실패는 아이용 이유 코드: not_enough_coins · already_owned · weekly_limit_reached · shields_full · golden_keys_full ·
 *   item_inactive · item_not_found (`RPC_ERRORS`)
 * - 이중 클릭: users 행 잠금으로 줄 서서 한 번만 사고, 두 번째는 already_owned·weekly_limit_reached
 * - 다른 사람에게 보이는 쓰기가 아니라 보호자 동의 게이트(guardianWriteGate)는 걸지 않음
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    itemId?: unknown;
  } | null;
  const itemId = body?.itemId;
  if (typeof itemId !== 'string' || !ITEM_ID.test(itemId))
    return rewardError('invalid_arguments');

  const result = await purchaseItemRpc(createAdminClient(), user.id, itemId);
  if (!result.ok) return result.response;
  trackServerEvent({
    headers: request.headers,
    userId: user.id,
    name: 'shop_purchase',
    props: {
      item_id: itemId,
      kind: result.data.kind,
      price: result.data.price,
    },
    path: '/shop',
  });
  // HUD 코인·황금키·방패가 바뀜 (화면은 router.refresh())
  revalidatePath('/world', 'layout');
  revalidatePath('/profile');
  return NextResponse.json(result.data);
}
