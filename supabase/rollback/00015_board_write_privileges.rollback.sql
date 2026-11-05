-- ============================================================
-- 00015 되돌리기: board_posts·board_comments 클라이언트 쓰기 권한·정책을 00003·00011 상태로   (P1-18)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면 로그인 사용자가 다시 브라우저에서 글·댓글을 직접 써서 금칙어·개인정보 필터를 건너뛸 수 있습니다
--    (길이·빈 값은 00014 CHECK 가 계속 막음). 원인을 고친 뒤 00015 를 다시 적용합니다.
-- 새 앱은 이 상태(①만 적용된 것과 같은 권한)에서도 동작합니다. 이전 앱으로 되돌릴 때는 먼저 이 파일을 실행합니다.
-- 실행 후 상태 = 00014 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00015_board_write_privileges.rollback.sql
-- ============================================================

-- 00003 의 테이블 ALL
GRANT ALL ON TABLE public.board_posts, public.board_comments TO anon, authenticated, service_role;

-- 정책: 00011 그대로
DROP POLICY IF EXISTS "board_posts_insert_own" ON public.board_posts;
CREATE POLICY "board_posts_insert_own" ON public.board_posts
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "board_posts_update_own" ON public.board_posts;
CREATE POLICY "board_posts_update_own" ON public.board_posts
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "board_posts_delete_own" ON public.board_posts;
CREATE POLICY "board_posts_delete_own" ON public.board_posts
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "board_comments_insert_own" ON public.board_comments;
CREATE POLICY "board_comments_insert_own" ON public.board_comments
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "board_comments_delete_own" ON public.board_comments;
CREATE POLICY "board_comments_delete_own" ON public.board_comments
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
