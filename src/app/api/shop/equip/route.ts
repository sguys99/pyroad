import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { equipItemRpc, rewardError } from '@/lib/quest/rewardRpc';
import { EQUIP_SLOTS, ITEM_ID, type EquipSlot } from '@/lib/shop/api';
import { withShareCardPurge } from '@/lib/share-card/purge';

/**
 * 장착·벗기 (P9-03). 본문 `{ slot, itemId }` — itemId null 이면 벗기. 사용자는 `auth.getUser()`로 확인한 id 만
 *
 * - 외형(skin·hat·glasses·cape·bg·pet·frame)은 `users.avatar_config`, 에디터 테마는 `users.settings.editor_theme` 에 서버 RPC
 *   `equip_item`(00040)이 씀. 가진 아이템·맞는 슬롯만(not_owned·wrong_slot), skin 은 무료 6색(P3-13)
 * - 공개 모습(스킨·모자·안경·망토·배경·테두리)이 바뀌면 00045 트리거가 내 자랑 카드를 다시 그리게(version + 1) 하고,
 *   여기서 그 카드들의 CDN 사본을 지운다(P9-11)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    slot?: unknown;
    itemId?: unknown;
  } | null;
  const slot = body?.slot;
  const itemId = body?.itemId ?? null;
  if (
    !EQUIP_SLOTS.includes(slot as EquipSlot) ||
    (itemId !== null && (typeof itemId !== 'string' || !ITEM_ID.test(itemId)))
  )
    return rewardError('invalid_arguments');

  const admin = createAdminClient();
  const result = await withShareCardPurge(admin, user.id, () =>
    equipItemRpc(admin, user.id, slot as EquipSlot, itemId as string | null),
  );
  if (!result.ok) return result.response;
  // 꾸민 모습이 보이는 화면 (P9-05가 avatar_config 로 그림)
  revalidatePath('/world', 'layout');
  revalidatePath('/profile');
  return NextResponse.json(result.data);
}
