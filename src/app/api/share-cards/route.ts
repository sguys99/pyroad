import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/api/serverError';
import { guardianWriteGate } from '@/lib/consent/server';
import { createShareCardRpc, rewardError } from '@/lib/quest/rewardRpc';
import { isShareCardKind } from '@/lib/share-card/snapshot';
import { shareCardImagePath } from '@/lib/share-card/publicCard';
import { kstToday } from '@/lib/time/kst';
import { isPolicyLive, policyNotYet } from '@/lib/legal/policyGate';

const ACHIEVEMENT_ID = /^[a-z0-9_]{1,64}$/;

/**
 * 공유 카드 만들기 (P9-07, §2.5, §12-Q67). 본문 `{ kind, ref? }` — kind = levelup | stage | achievement | weekly,
 * ref = 스테이지 id(stage) · 업적 id(achievement). 사용자는 `auth.getUser()`로 확인한 id 만
 *
 * - 성과 숫자(레벨·별·업적·이번 주 합계)는 받지 않는다: service_role RPC `create_share_card`(00043)가 실제 기록으로 계산해
 *   공개 정보만 스냅샷으로 저장. 안 깬 스테이지·안 얻은 업적은 409
 * - 다른 사람에게 보이는 쓰기라 보호자 동의 게이트(guardianWriteGate, P3-15)를 건다
 * - 같은 카드를 다시 만들면 같은 id 로 다시 공개 + 새 90일(바뀌었으면 version + 1 → 이미지 주소가 바뀜)
 * - 응답: `{ id, kind, version, expiresAt, imageUrl, rewardClaimed }` (공유 페이지 `/share/{id}`·카카오는 P9-08·P9-09).
 *   rewardClaimed = 오늘(KST) 자랑하기 보상을 이미 받았는지(P9-10, 본인 원장 share/<날짜> — RLS 본인 읽기). 시트의 보상 안내 줄
 * - 처리방침 시행일 전에는 404 not_yet (B79)
 */
export async function POST(request: Request) {
  if (!(await isPolicyLive())) return policyNotYet();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    ref?: unknown;
  } | null;
  const kind = body?.kind;
  const ref = body?.ref;
  if (!isShareCardKind(kind)) return rewardError('invalid_arguments');
  if (kind === 'stage' && !isUuid(ref)) return rewardError('invalid_arguments');
  if (
    kind === 'achievement' &&
    (typeof ref !== 'string' || !ACHIEVEMENT_ID.test(ref))
  )
    return rewardError('invalid_arguments');

  const admin = createAdminClient();
  const blocked = await guardianWriteGate(user.id, admin);
  if (blocked) return blocked;

  const result = await createShareCardRpc(
    admin,
    user.id,
    kind,
    kind === 'stage' || kind === 'achievement' ? (ref as string) : null,
  );
  if (!result.ok) return result.response;
  const { id, version, expires_at } = result.data;
  const { data: claimed } = await supabase
    .from('coin_ledger')
    .select('id')
    .eq('user_id', user.id)
    .eq('source', 'share')
    .eq('ref', kstToday())
    .maybeSingle();
  return NextResponse.json({
    id,
    kind,
    version,
    expiresAt: expires_at,
    imageUrl: shareCardImagePath(id, version),
    rewardClaimed: !!claimed,
  });
}
