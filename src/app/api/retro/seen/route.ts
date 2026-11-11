import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';

/**
 * "그동안의 모험 보상" 카드 닫기 (P8-11). 월드맵 `RetroWelcomeCard`의 "좋아요!"가 부른다. 본문 없음
 *
 * - 사용자는 `auth.getUser()`로 확인한 id 만. 그 사용자의 닫지 않은 소급 행에 seen_at 을 적음(service_role, 00037 컬럼 권한)
 * - 보상과 무관한 본 기록이라 여러 번 불러도 같음. 무효화하지 않음 (카드는 화면에서 바로 사라지고 다음 방문은 새로 렌더)
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await createAdminClient()
    .from('retro_rewards')
    .update({ seen_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('seen_at', null);
  if (error) {
    reportServerError(error, { area: 'retro', op: 'seen' });
    return NextResponse.json({ error: '기록하지 못했어요.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
