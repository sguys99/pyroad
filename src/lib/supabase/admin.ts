import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * RLS를 우회하는 서비스 역할 클라이언트.
 * stages, quests 등 레퍼런스 데이터 조회와 관리자 검증을 마친 공지 쓰기에만 사용할 것.
 * 사용자별 데이터(user_progress, user_badges 등)에는 사용 금지.
 * 예외: service_role 전용 객체 — 보상 RPC(src/lib/quest/rewardRpc.ts), 스테이지 잠금 is_stage_unlocked(src/lib/world/checkStageUnlocked.ts), 사용자 API 키 user_api_keys(src/lib/tutor/apiKeys.ts),
 *       게시판 쓰기·신고(src/app/api/board/**: 금칙어 검사 후, P1-18 ③ 00015 이후 클라이언트 쓰기 권한 없음),
 *       분석 이벤트 analytics_events·한도(src/lib/analytics/server.ts, src/app/api/analytics: 익명 ID 만 저장, P1-17).
 *       이때도 `auth.getUser()`로 확인한 사용자 id 로만 조회·저장할 것.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
