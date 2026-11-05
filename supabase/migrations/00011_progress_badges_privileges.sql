-- ============================================================
-- user_progress·user_badges 클라이언트 쓰기를 진행 저장으로 제한 + 정책 재작성 (Idempotent)   (P1-04, B04·B05, B34)
-- 릴리즈 단계: ③ 권한 회수형 (새 앱 배포·동작 확인 뒤에만 적용)
--
-- 배경: 00001 의 정책·00003 의 ALL 권한으로 로그인 사용자가 브라우저에서
--   - user_progress 에 status='completed' 를 직접 써서 스테이지를 해금하고(B04-4·4b),
--   - hints_used·used_golden_key 를 되돌려 보상을 늘리고(B05, B04-11·12),
--   - 진행 행을 지우거나 status 를 되돌린 뒤 다시 완료해 XP 를 반복해서 받고(B04-24·25),
--   - user_badges 를 직접 INSERT·DELETE 할 수 있습니다(B04-5·5b).
--   P1-03 이후 완료·황금키·리셋·뱃지는 service_role 전용 RPC(00006)가, P1-04 이후 힌트 수는 record_hint(00010)가 씁니다.
--   새 앱이 사용자 클라이언트로 쓰는 곳은 진행 저장(auto-save·단계 이동) upsert 하나뿐입니다.
--
-- 전제: ① 00010 + 새 앱(auto-save 가 code_submitted·current_step·step_submissions 만 보냄, 힌트는 튜터 API 가 기록) 배포.
--   이전 앱은 auto-save 에 hints_used·status 를 넣으므로 이 파일을 먼저 적용하면 이전 앱의 진행 저장이 403 이 됩니다.
--   (배포 전에 열어 둔 브라우저 탭도 새로 고칠 때까지 진행 저장이 실패합니다. 완료·힌트는 서버 경로라 영향 없음)
--
-- 하는 일
--   1. user_progress: anon·authenticated 권한을 모두 회수하고 SELECT 만 다시 줌 (SELECT 는 건드리지 않음)
--      authenticated 에 진행 저장 컬럼만 INSERT·UPDATE: user_id, quest_id, code_submitted, current_step, step_submissions
--        user_id·quest_id 는 PostgREST upsert(on_conflict) 가 payload 의 모든 컬럼을 DO UPDATE SET 에 넣기 때문에 필요
--        (값은 그대로라 바뀌지 않음). status·completed_at·hints_used·used_golden_key·earned_xp 와 이후의
--        stars·best_stars·attempts 는 RPC 전용 (INSERT 하면 기본값: status 'in_progress'(00010)·hints_used 0 …)
--      DELETE 권한·progress_delete_own 정책 제거 (앱은 reset_progress RPC 와 탈퇴 cascade 로만 지움)
--   2. user_progress 키 고정 트리거: anon·authenticated 가 user_id·quest_id 를 다른 값으로 바꾸지 못함
--      (UPDATE (quest_id) 권한이 있어도 완료한 행의 quest_id 를 바꿔 다른 퀘스트를 완료로 만들 수 없게, B04-23)
--   3. user_badges: SELECT 만. INSERT·DELETE 정책·권한 제거 (지급은 complete_quest, 삭제는 reset_progress·탈퇴 cascade)
--   4. 정책을 TO authenticated + (select auth.uid()) 로 다시 씀 (B34 auth_rls_initplan). 동작은 같음:
--      user_progress·user_badges, 그리고 같은 경고가 남은 board_posts·board_comments·quests·stages.
--      auth.role() = 'authenticated' 정책은 TO authenticated + USING (true) 로 (anon 은 지금도 0행).
--      UPDATE 정책의 WITH CHECK 를 명시 (생략하면 USING 과 같은 식이 적용되던 것과 같음)
--      board_*·quests·stages 의 테이블 권한은 바꾸지 않습니다(정책만).
--   5. 자기 검증: 남은 쓰기 권한이 기대와 다르거나 auth.uid()/auth.role() 를 감싸지 않은 정책이 있으면 예외 → 전체 롤백
--
-- service_role 권한(00003 의 ALL)은 그대로 둡니다. RPC(00006·00010)는 SECURITY DEFINER 라 영향 없음.
-- 확인: supabase/tests B04-4·4b·5·5b·11·12·22~26 (deny), APP-W1·W2 (진행 저장 allow), APP-W10 (DELETE deny), ST-5 = 0
-- 되돌리기: supabase/rollback/00011_progress_badges_privileges.rollback.sql (00001·00003 의 권한·정책으로)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_progress 권한
--    REVOKE ALL 은 INSERT·UPDATE·DELETE·TRUNCATE·REFERENCES·TRIGGER(·PG17 MAINTAIN)과 기존 컬럼 권한까지 회수
-- ------------------------------------------------------------
REVOKE ALL ON TABLE public.user_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_progress TO anon, authenticated;
GRANT INSERT (user_id, quest_id, code_submitted, current_step, step_submissions)
  ON TABLE public.user_progress TO authenticated;
GRANT UPDATE (user_id, quest_id, code_submitted, current_step, step_submissions)
  ON TABLE public.user_progress TO authenticated;

-- ------------------------------------------------------------
-- 2. user_progress 키 고정 (anon·authenticated)
--    SECURITY INVOKER: current_user 가 요청한 역할 그대로입니다 (RPC 안에서는 함수 소유자).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_progress_lock_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.quest_id IS DISTINCT FROM OLD.quest_id) THEN
    RAISE EXCEPTION 'permission denied: user_progress 의 user_id·quest_id 는 바꿀 수 없습니다'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.user_progress_lock_keys() IS
  'anon/authenticated 가 user_progress 의 user_id·quest_id 를 바꾸지 못하게 함 (P1-04). upsert 때문에 두 컬럼에 UPDATE 권한이 있음';

REVOKE ALL ON FUNCTION public.user_progress_lock_keys() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_user_progress_lock_keys ON public.user_progress;
CREATE TRIGGER trg_user_progress_lock_keys
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.user_progress_lock_keys();

-- ------------------------------------------------------------
-- 3. user_badges 권한: SELECT 만
-- ------------------------------------------------------------
REVOKE ALL ON TABLE public.user_badges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_badges TO anon, authenticated;

-- ------------------------------------------------------------
-- 4. 정책
-- ------------------------------------------------------------
-- user_progress
DROP POLICY IF EXISTS "progress_delete_own" ON public.user_progress;

DROP POLICY IF EXISTS "progress_select_own" ON public.user_progress;
CREATE POLICY "progress_select_own" ON public.user_progress
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "progress_insert_own" ON public.user_progress;
CREATE POLICY "progress_insert_own" ON public.user_progress
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "progress_update_own" ON public.user_progress;
CREATE POLICY "progress_update_own" ON public.user_progress
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- user_badges
DROP POLICY IF EXISTS "badges_insert_own" ON public.user_badges;
DROP POLICY IF EXISTS "badges_delete_own" ON public.user_badges;

DROP POLICY IF EXISTS "badges_select_own" ON public.user_badges;
CREATE POLICY "badges_select_own" ON public.user_badges
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- stages·quests: 로그인 사용자 전체 조회 (anon 은 0행, 지금과 같음)
DROP POLICY IF EXISTS "stages_select_authenticated" ON public.stages;
CREATE POLICY "stages_select_authenticated" ON public.stages
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "quests_select_authenticated" ON public.quests;
CREATE POLICY "quests_select_authenticated" ON public.quests
  FOR SELECT TO authenticated
  USING (true);

-- board_posts
DROP POLICY IF EXISTS "board_posts_select_authenticated" ON public.board_posts;
CREATE POLICY "board_posts_select_authenticated" ON public.board_posts
  FOR SELECT TO authenticated
  USING (true);

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

-- board_comments
DROP POLICY IF EXISTS "board_comments_select_authenticated" ON public.board_comments;
CREATE POLICY "board_comments_select_authenticated" ON public.board_comments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "board_comments_insert_own" ON public.board_comments;
CREATE POLICY "board_comments_insert_own" ON public.board_comments
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "board_comments_delete_own" ON public.board_comments;
CREATE POLICY "board_comments_delete_own" ON public.board_comments
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 5. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  c_progress_cols CONSTANT TEXT[] := ARRAY['user_id', 'quest_id', 'code_submitted', 'current_step', 'step_submissions'];
  v_role     TEXT;
  v_col      TEXT;
  v_priv     TEXT;
  v_bad      TEXT[] := '{}';
  v_unwrapped INTEGER;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.user_progress', 'DELETE, TRUNCATE') THEN
      v_bad := v_bad || (v_role || ':user_progress DELETE/TRUNCATE');
    END IF;
    IF has_table_privilege(v_role, 'public.user_badges', 'INSERT, UPDATE, DELETE, TRUNCATE') THEN
      v_bad := v_bad || (v_role || ':user_badges 쓰기');
    END IF;
    FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE'] LOOP
      FOR v_col IN
        SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'user_progress'
      LOOP
        IF has_column_privilege(v_role, 'public.user_progress', v_col, v_priv)
           <> (v_role = 'authenticated' AND v_col = ANY (c_progress_cols)) THEN
          v_bad := v_bad || (v_role || ':' || v_priv || '(' || v_col || ')');
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename IN ('user_progress', 'user_badges')
                AND cmd IN ('INSERT', 'DELETE', 'ALL')
                AND NOT (tablename = 'user_progress' AND policyname = 'progress_insert_own')) THEN
    v_bad := v_bad || '남은 INSERT/DELETE 정책'::TEXT;
  END IF;

  -- B34: auth.uid()/auth.role() 를 (select …) 로 감싸지 않은 정책 (회귀 ST-5 와 같은 식)
  SELECT count(*) INTO v_unwrapped
    FROM pg_policies
   WHERE schemaname = 'public'
     AND regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                        'SELECT auth\.(uid|role)\(\)', '', 'g') ~ 'auth\.(uid|role)\(\)';
  IF v_unwrapped > 0 THEN
    v_bad := v_bad || (v_unwrapped || '개 정책이 auth.uid()/auth.role() 를 감싸지 않음');
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00011] 권한·정책이 기대와 다름: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00011] user_progress: SELECT + authenticated INSERT·UPDATE(%) 만, user_badges: SELECT 만, 감싸지 않은 auth.uid() 정책 0',
    array_to_string(c_progress_cols, ', ');
END $$;
