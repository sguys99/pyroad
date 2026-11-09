import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resetProgressRpc } from '@/lib/quest/rewardRpc';
import { reportServerError } from '@/lib/api/serverError';

/**
 * 진행 리셋 (P1-03, B12)
 *
 * 진행·뱃지 삭제와 XP 재계산은 DB 함수 reset_progress 가 한 트랜잭션으로 처리합니다.
 * - 스테이지 리셋: 대상과 그 뒤 스테이지의 진행 삭제 → total_xp = 남은 진행의 earned_xp 합
 *   (황금키로 0 XP 받은 퀘스트를 과다 차감하지 않음), stage_clear 뱃지는 완료한 스테이지가 남지 않을 때만 삭제
 * - 전체 리셋: 진행·뱃지 전부 삭제, XP 0, 황금키 3개
 * 사용자 클라이언트로 user_badges 를 지우지 않습니다 (P1-04 에서 DELETE 정책을 없앰).
 */
interface ResetRequest {
  stageId?: string;
}

interface ResetRpcResult {
  scope: 'all' | 'stage';
  reset_stages: { id: string; order: number; title: string }[];
  removed_quests: number;
  total_xp: number;
  level: number;
  golden_keys: number;
  removed_badges: string[];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ResetRequest = {};
  try {
    body = await request.json();
  } catch {
    // body가 없으면 전체 리셋
  }

  if (body.stageId !== undefined && typeof body.stageId !== 'string') {
    return NextResponse.json(
      { error: '해당 스테이지를 찾을 수 없습니다.' },
      { status: 400 },
    );
  }

  const result = await resetProgressRpc<ResetRpcResult>(
    createAdminClient(),
    user.id,
    body.stageId ? { type: 'stage', stageId: body.stageId } : { type: 'all' },
  );
  if (!result.ok) return result.response;

  // 잠금 해제 본 기록(P5-05)도 지운다: 다음 방문에 지금 열린 스테이지를 조용히 다시 기록하고, 다시 여는 스테이지는 연출이 나옴.
  // 실패해도 리셋은 끝났으므로 로그만 (연출이 안 나올 뿐)
  const { error: seenError } = await createAdminClient()
    .from('user_seen_unlocks')
    .delete()
    .eq('user_id', user.id);
  if (seenError)
    reportServerError(seenError, { area: 'account', op: 'reset seen unlocks' });

  revalidatePath('/world', 'layout'); // /world/[slug] 포함 (P5-01)
  revalidatePath('/worlds');
  revalidatePath('/profile');

  const data = result.data;
  return NextResponse.json({
    success: true,
    type: data.scope === 'all' ? 'full' : 'stage',
    ...(data.scope === 'stage' && { resetStages: data.reset_stages }),
    total_xp: data.total_xp,
    level: data.level,
    golden_keys: data.golden_keys,
    removed_badges: data.removed_badges,
  });
}
