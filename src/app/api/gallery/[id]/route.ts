import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateAchievements } from '@/lib/quest/rewardRpc';
import { isAdminUser } from '@/lib/admin';
import { isUuid, reportServerError } from '@/lib/api/serverError';
import { REPORT_REASONS } from '@/lib/board/limits';
import { guardianWriteGate } from '@/lib/consent/server';
import { countStickers } from '@/lib/gallery/server';
import { STICKERS } from '@/lib/gallery/stickers';
import { purgeCreationShareCards } from '@/lib/share-card/purge';

/**
 * 갤러리 작품 하나에 하는 일 (P11-07). 사용자는 `auth.getUser()`로 확인한 id 만, 쓰기는 모두 service_role(00055)
 *
 * - `{action:'react', sticker, on}` 정해진 스티커 붙이기·떼기(F13). 남에게 보이는 쓰기라 보호자 동의 게이트 →
 *   요청 한도 `gallery:react` 분당 30·하루 300 → 공개·안 숨긴 남의 작품만(내 작품은 친구들이 붙여 줌)
 * - `{action:'report', reason}` 신고(제한 모드에서도 받음, 00014 과 같음) → 요청 한도 `gallery:report` 분당 3·하루 20 →
 *   `report_creation`(중복·본인 확인, 서로 다른 3명이면 자동 숨김)
 * - `{action:'moderate', hidden}` 운영자(`isAdminUser`)만: 숨기기(hidden_at) · 다시 보이기(hidden_at 지우고 published_at 새로 —
 *   그 뒤 신고만 셈)
 */

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('react'),
    sticker: z.enum(STICKERS),
    on: z.boolean(),
  }),
  z.object({ action: z.literal('report'), reason: z.enum(REPORT_REASONS) }),
  z.object({ action: z.literal('moderate'), hidden: z.boolean() }),
]);

const FAILED = '지금은 하지 못했어요. 잠시 뒤에 다시 해 줘요.';
const NOT_FOUND = '작품을 찾지 못했어요. 작가가 내렸을 수도 있어요.';

function bad(message: string, status = 400, code = 'invalid') {
  return NextResponse.json({ error: message, code }, { status });
}

type Admin = ReturnType<typeof createAdminClient>;

/** 요청 한도. 확인이 실패하면 막지 않는다(반응·신고는 DB 가 사람마다 한 번으로 막음) */
async function overQuota(
  admin: Admin,
  userId: string,
  bucket: string,
  perMinute: number,
  perDay: number,
) {
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_user_id: userId,
    p_bucket: bucket,
    p_per_minute: perMinute,
    p_per_day: perDay,
  });
  if (error) reportServerError(error, { area: 'gallery', op: 'rate_limit' });
  return (data as { allowed?: boolean } | null)?.allowed === false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return bad(NOT_FOUND, 404, 'not_found');
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad('요청이 이상해요.');
  const body = parsed.data;
  const admin = createAdminClient();

  if (body.action === 'moderate') {
    if (!isAdminUser(user)) return bad(NOT_FOUND, 404, 'not_found');
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from('creations')
      .update(
        body.hidden
          ? { hidden_at: now }
          : { hidden_at: null, published_at: now },
      )
      .eq('id', id)
      .select('id');
    if (error) {
      reportServerError(error, { area: 'gallery', op: 'moderate' });
      return bad(FAILED, 500, 'server');
    }
    if (!data?.length) return bad(NOT_FOUND, 404, 'not_found');
    // 숨기면 그 작품 자랑 카드도 닫힘(00056 트리거) → CDN 사본도 지움 (P11-08)
    if (body.hidden) await purgeCreationShareCards(admin, id);
    return NextResponse.json({ id, hidden: body.hidden });
  }

  if (body.action === 'report') {
    if (await overQuota(admin, user.id, 'gallery:report', 3, 20))
      return bad(
        '신고를 너무 많이 보냈어요. 잠깐 쉬었다가 해 줘요.',
        429,
        'rate_limited',
      );
    const { data, error } = await admin.rpc('report_creation', {
      p_reporter_id: user.id,
      p_creation_id: id,
      p_reason: body.reason,
    });
    if (error || !data) {
      reportServerError(error ?? new Error('결과 없음'), {
        area: 'gallery',
        op: 'report',
      });
      return bad(FAILED, 500, 'server');
    }
    const { result, hidden } = data as { result: string; hidden?: boolean };
    // 신고 3명 자동 숨김 → 자랑 카드도 닫힘(00056) → CDN 사본 지움 (P11-08)
    if (hidden) await purgeCreationShareCards(admin, id);
    if (result === 'own') return bad('내 작품은 신고할 수 없어요.', 400, 'own');
    if (result === 'not_found') return bad(NOT_FOUND, 404, 'not_found');
    return NextResponse.json({
      status: result,
      message:
        result === 'already'
          ? '이미 신고한 작품이에요. 어른이 살펴볼게요.'
          : '알려 줘서 고마워요! 어른이 살펴볼게요.',
    });
  }

  // 스티커
  const blocked = await guardianWriteGate(user.id, admin);
  if (blocked) return blocked;
  if (await overQuota(admin, user.id, 'gallery:react', 30, 300))
    return bad(
      '스티커를 너무 빨리 붙이고 있어요. 잠깐 쉬었다가 해 줘요.',
      429,
      'rate_limited',
    );
  const { data: work, error: readError } = await admin
    .from('gallery_creations')
    .select('author_id')
    .eq('id', id)
    .maybeSingle();
  if (readError) {
    reportServerError(readError, { area: 'gallery', op: 'react read' });
    return bad(FAILED, 500, 'server');
  }
  if (!work) return bad(NOT_FOUND, 404, 'not_found');
  if (work.author_id === user.id)
    return bad('내 작품에는 친구들이 스티커를 붙여 줘요.', 400, 'own');

  const { error } = body.on
    ? await admin
        .from('creation_reactions')
        .upsert(
          { creation_id: id, user_id: user.id, sticker: body.sticker },
          { onConflict: 'creation_id,user_id,sticker', ignoreDuplicates: true },
        )
    : await admin
        .from('creation_reactions')
        .delete()
        .eq('creation_id', id)
        .eq('user_id', user.id)
        .eq('sticker', body.sticker);
  if (error) {
    reportServerError(error, { area: 'gallery', op: 'react' });
    return bad(FAILED, 500, 'server');
  }
  // 업적 "응원 단장"(00057, 코인 없는 배지): 붙인 스티커만 셈
  if (body.on) await evaluateAchievements(admin, user.id);
  return NextResponse.json({ stickers: await countStickers(id) });
}
