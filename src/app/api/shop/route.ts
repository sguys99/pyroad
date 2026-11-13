import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { shopStatusRpc } from '@/lib/quest/rewardRpc';

/**
 * 상점 상태 (P9-03). 잔액·황금키·방패·가진 아이템·이번 주(KST 월요일) 소모품 구매 수·장착 (`ShopStatus`, src/lib/shop/api.ts).
 * 사용자는 `auth.getUser()`로 확인한 id 만, 계산은 service_role RPC `shop_status`(00040)
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await shopStatusRpc(createAdminClient(), user.id);
  if (!result.ok) return result.response;
  return NextResponse.json(result.data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
