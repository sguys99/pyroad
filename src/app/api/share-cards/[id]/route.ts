import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardianWriteGate } from '@/lib/consent/server';
import { manageShareCardRpc, rewardError } from '@/lib/quest/rewardRpc';
import { trackServerEvent } from '@/lib/analytics/server';
import { isShareCardKind, SHARE_CARD_ID } from '@/lib/share-card/snapshot';
import { shareCardImagePath } from '@/lib/share-card/publicCard';
import { purgeShareCards } from '@/lib/share-card/purge';
import { isPolicyLive, policyNotYet } from '@/lib/legal/policyGate';

/**
 * 내 자랑 카드 숨기기·다시 공개·지우기 (P9-11). `PATCH {action: 'hide' | 'show'}` · `DELETE`. 사용자는 `auth.getUser()`로 확인한 id 만
 *
 * - 쓰기는 service_role RPC `manage_share_card`(00045, 본인 카드만 — 아니면 404)
 * - 숨기기·지우기 뒤 CDN 사본을 태그로 바로 지움(`purgeShareCards`) → 공유 페이지(캐시 없음)·이미지 모두 바로 404
 * - 다시 공개(새 90일)는 다른 사람에게 보이는 쓰기라 보호자 동의 게이트(만들기와 같음). 숨기기·지우기는 늘 허용
 * - 처리방침 시행일 전에는 404 not_yet (B79)
 */
async function manage(
  request: Request,
  params: Promise<{ id: string }>,
  action: 'hide' | 'show' | 'delete',
) {
  if (!(await isPolicyLive())) return policyNotYet();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!SHARE_CARD_ID.test(id)) return rewardError('invalid_arguments');

  const admin = createAdminClient();
  if (action === 'show') {
    const blocked = await guardianWriteGate(user.id, admin);
    if (blocked) return blocked;
  }

  const result = await manageShareCardRpc(admin, user.id, id, action);
  if (!result.ok) return result.response;
  const card = result.data;
  if (action !== 'show') await purgeShareCards([id]);

  if (isShareCardKind(card.kind))
    trackServerEvent({
      headers: request.headers,
      userId: user.id,
      name: 'share_manage',
      props: { kind: card.kind, action },
      path: '/profile/cards',
    });

  return NextResponse.json({
    id: card.id,
    kind: card.kind,
    version: card.version,
    isPublic: card.is_public,
    expiresAt: card.expires_at,
    imageUrl: shareCardImagePath(card.id, card.version),
    deleted: card.deleted,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
  } | null;
  const action = body?.action;
  if (action !== 'hide' && action !== 'show')
    return rewardError('invalid_arguments');
  return manage(request, params, action);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return manage(request, params, 'delete');
}
