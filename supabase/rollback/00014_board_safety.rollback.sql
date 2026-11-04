-- ============================================================
-- 00014 되돌리기: 게시판 CHECK·숨김·신고와 user_profiles_public 을 00013 까지의 상태로   (P1-18, B19)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면
--   - user_profiles_public 이 다시 users.display_name(기존 Google 사용자의 실명)·avatar_url(프로필 사진)을 로그인 사용자에게 보여 줍니다 (X1)
--   - 신고로 숨긴 글·댓글이 다시 모두에게 보입니다 → 실행 전에 숨긴 행을 확인하고 필요하면 지웁니다:
--       select 'post' t, id, user_id, title from public.board_posts where is_hidden
--       union all select 'comment', id, user_id, left(content, 40) from public.board_comments where is_hidden;
--   - 신고 기록(board_reports)이 사라집니다. 필요하면 먼저 CSV 로 내보냅니다
--   - 길이·빈 값 제한이 다시 API 에만 남습니다 (B19)
-- 새 앱은 이 상태에서 게시판 조회·쓰기는 동작하지만 신고는 500(일반 안내 문구)입니다. 00015 가 적용되어 있으면 먼저 00015 롤백.
-- 실행 후 상태 = 00013 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00014_board_safety.rollback.sql
-- ============================================================

DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.board_posts', 'INSERT') THEN
    RAISE EXCEPTION '00015 가 적용되어 있음. 먼저 supabase/rollback/00015_board_write_privileges.rollback.sql 을 실행하세요';
  END IF;
END $$;

-- 4. 뷰: 00001 정의 (권한은 00002·00003 그대로)
CREATE OR REPLACE VIEW public.user_profiles_public AS
  SELECT id, display_name, avatar_url
  FROM public.users;
COMMENT ON VIEW public.user_profiles_public IS NULL;
REVOKE ALL ON public.user_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_profiles_public TO authenticated;
GRANT ALL ON public.user_profiles_public TO service_role;

-- 3. 신고
DROP FUNCTION IF EXISTS public.report_board_content(UUID, TEXT, UUID, TEXT);
DROP TABLE IF EXISTS public.board_reports;

-- 2. 숨김: SELECT 정책은 00011 그대로, 트리거·컬럼 삭제
DROP POLICY IF EXISTS "board_posts_select_authenticated" ON public.board_posts;
CREATE POLICY "board_posts_select_authenticated" ON public.board_posts
  FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "board_comments_select_authenticated" ON public.board_comments;
CREATE POLICY "board_comments_select_authenticated" ON public.board_comments
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS trg_board_posts_protect_moderation ON public.board_posts;
DROP TRIGGER IF EXISTS trg_board_comments_protect_moderation ON public.board_comments;
DROP FUNCTION IF EXISTS public.board_protect_moderation();

ALTER TABLE public.board_posts DROP COLUMN IF EXISTS is_hidden;
ALTER TABLE public.board_posts DROP COLUMN IF EXISTS hidden_at;
ALTER TABLE public.board_comments DROP COLUMN IF EXISTS is_hidden;
ALTER TABLE public.board_comments DROP COLUMN IF EXISTS hidden_at;

-- 1. CHECK
ALTER TABLE public.board_posts DROP CONSTRAINT IF EXISTS board_posts_title_check;
ALTER TABLE public.board_posts DROP CONSTRAINT IF EXISTS board_posts_content_check;
ALTER TABLE public.board_comments DROP CONSTRAINT IF EXISTS board_comments_content_check;
