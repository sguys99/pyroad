import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimAchievementRpc, rewardError } from '@/lib/quest/rewardRpc';
import { ACHIEVEMENT_ID } from '@/lib/quest/achievements';

/**
 * 업적 코인 받기 (P8-09, §3 F5, §12-Q62 ③ "받기" 버튼). 업적 축하 카드(·도감 P8-10)의 "받기"가 부른다.
 *
 * - 본문: `{ id }`(업적 id). 사용자는 `auth.getUser()`로 확인한 id 만 쓴다
 * - 지급은 service_role RPC `claim_achievement`(00036)만: 얻지 않은 업적 409, 이미 받았으면 200 + already_claimed(0)
 *   — 다시·동시에 눌러도 한 번(원장 achievement/<id>)
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
  const { id } = (body ?? {}) as { id?: unknown };
  if (typeof id !== 'string' || !ACHIEVEMENT_ID.test(id))
    return rewardError('invalid_arguments');

  const result = await claimAchievementRpc(createAdminClient(), user.id, id);
  if (!result.ok) return result.response;
  if (!result.data.already_claimed) {
    revalidatePath('/world', 'layout');
    revalidatePath('/worlds');
    revalidatePath('/profile');
  }
  return NextResponse.json(result.data);
}
