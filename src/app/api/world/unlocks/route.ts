import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid, reportServerError } from '@/lib/api/serverError';

/**
 * 잠금 해제 연출 본 기록 (P5-05, §12-Q49). 월드맵이 연출을 보여 준 뒤(또는 기록이 없는 사용자의 첫 방문에 조용히) 보낸다.
 *
 * - 본문: `{ stageIds: uuid[] }` (1~64개). 사용자는 `auth.getUser()`로 확인한 id 만 쓴다
 * - 쓰기는 service_role RPC `record_seen_unlocks`(00025)만: 잠긴 스테이지·없는 id 는 DB 가 걸러 기록하지 않고, 이미 있으면 그대로
 * - 실패해도 화면은 그대로다(다음 방문에 연출이 한 번 더 나올 수 있음). 클라이언트는 응답을 보지 않는다
 */
const MAX_IDS = 64;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const ids = (body as { stageIds?: unknown } | null)?.stageIds;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_IDS ||
    !ids.every(isUuid)
  )
    return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });

  const { data, error } = await createAdminClient().rpc('record_seen_unlocks', {
    p_user_id: user.id,
    p_stage_ids: [...new Set(ids)],
  });
  if (error) {
    reportServerError(error, { area: 'world', op: 'record seen unlocks' });
    return NextResponse.json({ error: '기록하지 못했어요.' }, { status: 500 });
  }
  return NextResponse.json({ recorded: data ?? 0 });
}
