-- ============================================================
-- 00011 되돌리기: user_progress·user_badges 권한·정책과 다른 정책을 00001·00003 상태로   (P1-04)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면 로그인 사용자가 다시 진행 상태·힌트 수·황금키 사용·뱃지를 직접 바꾸고, 진행 행을 지워 XP 를 반복해서
--    받을 수 있습니다(B04·B05). 원인을 고친 뒤 00011 을 다시 적용합니다.
-- 새 앱은 이 상태(①만 적용된 것과 같은 권한)에서도 동작합니다. 이전 앱으로 되돌릴 때는 먼저 이 파일을 실행합니다.
-- 실행 후 상태 = 00010 까지 적용된 상태 (00008·00009 와는 무관)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00011_progress_badges_privileges.rollback.sql
-- ============================================================

-- 컬럼 단위 권한을 지우고 00003 의 테이블 ALL 로
REVOKE ALL ON TABLE public.user_progress FROM anon, authenticated;
GRANT ALL ON TABLE public.user_progress TO anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_badges FROM anon, authenticated;
GRANT ALL ON TABLE public.user_badges TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_user_progress_lock_keys ON public.user_progress;
DROP FUNCTION IF EXISTS public.user_progress_lock_keys();

-- 정책: 00001 그대로
DROP POLICY IF EXISTS "progress_select_own" ON public.user_progress;
CREATE POLICY "progress_select_own" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "progress_insert_own" ON public.user_progress;
CREATE POLICY "progress_insert_own" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "progress_update_own" ON public.user_progress;
CREATE POLICY "progress_update_own" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "progress_delete_own" ON public.user_progress;
CREATE POLICY "progress_delete_own" ON public.user_progress FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "badges_select_own" ON public.user_badges;
CREATE POLICY "badges_select_own" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "badges_insert_own" ON public.user_badges;
CREATE POLICY "badges_insert_own" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "badges_delete_own" ON public.user_badges;
CREATE POLICY "badges_delete_own" ON public.user_badges FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "stages_select_authenticated" ON public.stages;
CREATE POLICY "stages_select_authenticated" ON public.stages FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "quests_select_authenticated" ON public.quests;
CREATE POLICY "quests_select_authenticated" ON public.quests FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "board_posts_select_authenticated" ON public.board_posts;
CREATE POLICY "board_posts_select_authenticated" ON public.board_posts FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "board_posts_insert_own" ON public.board_posts;
CREATE POLICY "board_posts_insert_own" ON public.board_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "board_posts_update_own" ON public.board_posts;
CREATE POLICY "board_posts_update_own" ON public.board_posts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "board_posts_delete_own" ON public.board_posts;
CREATE POLICY "board_posts_delete_own" ON public.board_posts FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_comments_select_authenticated" ON public.board_comments;
CREATE POLICY "board_comments_select_authenticated" ON public.board_comments FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "board_comments_insert_own" ON public.board_comments;
CREATE POLICY "board_comments_insert_own" ON public.board_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "board_comments_delete_own" ON public.board_comments;
CREATE POLICY "board_comments_delete_own" ON public.board_comments FOR DELETE USING (auth.uid() = user_id);
