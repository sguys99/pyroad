import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/supabase/auth';
import { shopStatusRpc } from '@/lib/quest/rewardRpc';
import { PageTransition } from '@/components/shared/PageTransition';
import { ShopScreen } from '@/components/shop/ShopScreen';

export const metadata: Metadata = { title: '상점' };

/**
 * 상점 (P9-02). 월드맵 HUD 상점 칩·메뉴에서 들어옴. (protected) 레이아웃이 동적 렌더(CSP nonce).
 * 첫 상태는 `/api/shop`과 같은 service_role `shop_status`(00040)를 확인한 id 로 — 구매·장착은 화면이 `/api/shop/*`로(§2.3).
 * 못 읽으면(00040 전 DB 등) 화면이 오류 상태와 "다시 열기"를 보임
 */
export default async function ShopPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const status = await shopStatusRpc(createAdminClient(), user.id);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-4 sm:py-6 md:max-w-5xl">
      <ShopScreen initial={status.ok ? status.data : null} />
    </PageTransition>
  );
}
