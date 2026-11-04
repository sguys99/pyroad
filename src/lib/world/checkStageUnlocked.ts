import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { captureServerError } from '@/lib/observability/server';

type AdminClient = SupabaseClient<Database>;

/**
 * 스테이지가 이 사용자에게 열렸는지 (B38). `is_stage_unlocked` 는 service_role 전용(00006, 00012에서 (월드, 스테이지) 순서)이라
 * admin 클라이언트로 부르고, 사용자 id 는 `auth.getUser()`로 확인한 값만 넘긴다. 완료 RPC(`complete_quest`·`use_golden_key`)와
 * 같은 SQL 규칙이라 화면·튜터·보상의 판단이 어긋나지 않는다 (src/lib/world/getStageStatuses.ts 는 월드맵 표시용 TS 사본).
 *
 * 조회에 실패하면 열린 것으로 본다(fail-open): 보상은 완료 RPC 가 따로 막으므로 드문 DB 오류로 아이의 학습을 멈추지 않는다.
 * 실패는 로그·Sentry 로 남긴다.
 */
export async function checkStageUnlocked(
  admin: AdminClient,
  userId: string,
  stageId: string,
  area: 'quest_page' | 'tutor',
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('is_stage_unlocked', {
      p_user_id: userId,
      p_stage_id: stageId,
    });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    return data !== false;
  } catch (error) {
    console.warn(
      `[stageLock] is_stage_unlocked 실패 (${area}):`,
      error instanceof Error ? error.message : error,
    );
    captureServerError(error, { tags: { area, op: 'is_stage_unlocked' } });
    return true;
  }
}
