import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/api/serverError';
import { openStageChestRpc, rewardError } from '@/lib/quest/rewardRpc';

/**
 * 스테이지 보물상자 열기 (P8-06, §3 F11, §12-Q62 ③ "받기" 버튼). 스테이지 시트의 "열기" 버튼이 부른다.
 *
 * - 본문: `{ stageId: uuid }`. 사용자는 `auth.getUser()`로 확인한 id 만 쓴다
 * - 판정·지급은 service_role RPC `open_stage_chest`(00033)만: 서버가 별 합계를 다시 세어 목표 미달이면 409,
 *   이미 열었으면 200 + already_opened(코인 0) — 다시 눌러도·동시에 눌러도 한 번만
 * - 열면 월드맵 HUD 코인·상자 상태가 바뀌므로 무효화 (화면은 router.refresh())
 */
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
  const stageId = (body as { stageId?: unknown } | null)?.stageId;
  if (!isUuid(stageId)) return rewardError('invalid_arguments');

  const result = await openStageChestRpc(createAdminClient(), user.id, stageId);
  if (!result.ok) return result.response;
  if (!result.data.already_opened) {
    revalidatePath('/world', 'layout');
    revalidatePath('/worlds');
    revalidatePath('/profile');
  }
  return NextResponse.json(result.data);
}
