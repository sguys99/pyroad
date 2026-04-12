import { createClient } from '@supabase/supabase-js';

/**
 * RLS를 우회하는 서비스 역할 클라이언트.
 * stages, quests 등 레퍼런스 데이터 조회에만 사용할 것.
 * 사용자별 데이터(user_progress, user_badges 등)에는 사용 금지.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
