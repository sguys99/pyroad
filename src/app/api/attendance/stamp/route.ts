import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stampAttendanceRpc } from '@/lib/quest/rewardRpc';

/**
 * 출석 도장 (P8-08, §12-Q62 ①③). 월드맵 출석 카드의 "출석 도장"이 부른다. 본문 없음
 *
 * - 사용자는 `auth.getUser()`로 확인한 id 만. 날짜·칸·금액은 서버(`stamp_attendance`, 00035)가 KST 오늘로 정함
 * - 하루 한 번(원장 attendance/<KST 날짜>) — 다시·동시에 눌러도 200 + already_stamped(0)
 * - 찍으면 HUD 코인·출석 카드가 바뀌므로 무효화 (화면은 router.refresh())
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await stampAttendanceRpc(createAdminClient(), user.id);
  if (!result.ok) return result.response;
  if (!result.data.already_stamped) {
    revalidatePath('/world', 'layout');
    revalidatePath('/worlds');
    revalidatePath('/profile');
  }
  return NextResponse.json(result.data);
}
