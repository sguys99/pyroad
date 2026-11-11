import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimDailyMissionRpc, rewardError } from '@/lib/quest/rewardRpc';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MISSION_ID = /^[a-z0-9_]{1,40}$/;

/**
 * 데일리 미션 보상 받기 (P8-07, §3 F4, §12-Q62 ③ "받기" 버튼). HUD 미션 시트의 "받기"가 부른다.
 *
 * - 본문: `{ day: 'YYYY-MM-DD'(KST), missionId }`. 사용자는 `auth.getUser()`로 확인한 id 만 쓴다
 * - 판정·지급은 service_role RPC `claim_daily_mission`(00034)만: 서버가 그날 기록에서 진행을 다시 세어 미달 409,
 *   배정에 없으면 404, 7일 지난 날 410, 이미 받았으면 200 + already_claimed(0) — 다시·동시에 눌러도 한 번
 * - 받으면 HUD 코인·XP·레벨이 바뀌므로 무효화 (화면은 router.refresh())
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
  const { day, missionId } = (body ?? {}) as {
    day?: unknown;
    missionId?: unknown;
  };
  if (
    typeof day !== 'string' ||
    !DAY.test(day) ||
    typeof missionId !== 'string' ||
    !MISSION_ID.test(missionId)
  )
    return rewardError('invalid_arguments');

  const result = await claimDailyMissionRpc(
    createAdminClient(),
    user.id,
    day,
    missionId,
  );
  if (!result.ok) return result.response;
  if (!result.data.already_claimed) {
    revalidatePath('/world', 'layout');
    revalidatePath('/worlds');
    revalidatePath('/profile');
  }
  return NextResponse.json(result.data);
}
