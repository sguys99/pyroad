-- ============================================================
-- 게시판 클라이언트 쓰기 권한 회수: 글·댓글 쓰기는 서버(API Route, service_role)로만 (Idempotent)   (P1-18, B19)
-- 릴리즈 단계: ③ 권한 회수형 (새 앱 배포·동작 확인 뒤에만 적용)
--
-- 배경: 00001 의 board_*_insert_own·update_own·delete_own 정책과 00003 의 ALL 권한 때문에 로그인 사용자는
--   브라우저에서 POST /rest/v1/board_posts 로 직접 글을 쓸 수 있습니다. 그러면 API 의 금칙어·개인정보 필터
--   (src/lib/moderation)를 그대로 건너뜁니다. 길이·빈 값은 ① 00014 의 CHECK 가 막지만 금칙어는 DB 로 옮기지 않으므로
--   (목록이 데이터 파일이고 자주 보강함) 쓰기 경로를 API 하나로 모읍니다.
--
-- 전제: ① 00014 + 새 앱 배포. 새 앱의 /api/board/** 는 getUser() 로 사용자와 소유권을 확인한 뒤 service_role 로 씁니다.
--   이전 앱은 사용자 클라이언트로 INSERT·UPDATE·DELETE 하므로 이 파일을 먼저 적용하면 이전 앱의 글쓰기·수정·삭제가 500 이 됩니다.
--
-- 하는 일
--   1. board_posts·board_comments: anon·authenticated 권한을 모두 회수하고 SELECT 만 다시 줌 (조회 결과는 같음)
--   2. INSERT·UPDATE·DELETE 정책 삭제
--   3. SELECT 정책(숨긴 글·댓글은 작성자만)을 00014 와 같게 다시 만듦.
--      운영 순서는 ① 00014 → ③ 00011 → ③ 00015 이고, 00011 이 board SELECT 정책을 USING (true) 로 다시 쓰기 때문
--      (번호 순서로 적용하는 새 DB 에서는 00014 와 같은 정의라 변화 없음)
--   4. 자기 검증: 남은 쓰기 권한·정책이 있거나 SELECT 정책이 숨김을 거르지 않으면 예외 → 전체 롤백
--
-- service_role 권한(00003 의 ALL)은 그대로. 보호 트리거(00014)도 이중 방어로 남김.
-- 확인: supabase/tests BW-1~6 (deny), BH-1~3 (숨김 SELECT), APP-W4~W8 (서버 경로 allow)
-- 되돌리기: supabase/rollback/00015_board_write_privileges.rollback.sql (00003·00011 의 권한·정책으로)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00015] board_posts·board_comments: anon·authenticated SELECT 만, 쓰기 정책 0, 숨김 SELECT 정책 2` 확인
-- ============================================================

-- ------------------------------------------------------------
-- 1. 권한
-- ------------------------------------------------------------
REVOKE ALL ON TABLE public.board_posts, public.board_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.board_posts, public.board_comments TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. 쓰기 정책 삭제
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "board_posts_insert_own" ON public.board_posts;
DROP POLICY IF EXISTS "board_posts_update_own" ON public.board_posts;
DROP POLICY IF EXISTS "board_posts_delete_own" ON public.board_posts;
DROP POLICY IF EXISTS "board_comments_insert_own" ON public.board_comments;
DROP POLICY IF EXISTS "board_comments_delete_own" ON public.board_comments;

-- ------------------------------------------------------------
-- 3. SELECT 정책 (00014 와 같은 정의)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "board_posts_select_authenticated" ON public.board_posts;
CREATE POLICY "board_posts_select_authenticated" ON public.board_posts
  FOR SELECT TO authenticated
  USING (NOT is_hidden OR (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "board_comments_select_authenticated" ON public.board_comments;
CREATE POLICY "board_comments_select_authenticated" ON public.board_comments
  FOR SELECT TO authenticated
  USING (
    (NOT is_hidden OR (select auth.uid()) = user_id)
    AND EXISTS (SELECT 1 FROM public.board_posts p WHERE p.id = post_id)   -- 글의 SELECT 정책을 따름
  );

-- ------------------------------------------------------------
-- 4. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad  TEXT[] := '{}';
  v_role TEXT;
  v_tbl  TEXT;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH v_tbl IN ARRAY ARRAY['public.board_posts', 'public.board_comments'] LOOP
      IF has_table_privilege(v_role, v_tbl, 'INSERT, UPDATE, DELETE, TRUNCATE') THEN
        v_bad := v_bad || (v_role || ':' || v_tbl || ' 쓰기');
      END IF;
      IF has_any_column_privilege(v_role, v_tbl, 'INSERT, UPDATE') THEN
        v_bad := v_bad || (v_role || ':' || v_tbl || ' 컬럼 쓰기');
      END IF;
      IF NOT has_table_privilege(v_role, v_tbl, 'SELECT') THEN
        v_bad := v_bad || (v_role || ':' || v_tbl || ' SELECT 없음');
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename IN ('board_posts', 'board_comments')
                AND cmd <> 'SELECT') THEN
    v_bad := v_bad || '남은 쓰기 정책'::TEXT;
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public' AND tablename IN ('board_posts', 'board_comments')
         AND cmd = 'SELECT' AND qual LIKE '%is_hidden%') <> 2 THEN
    v_bad := v_bad || 'SELECT 정책이 숨김을 거르지 않음'::TEXT;
  END IF;
  IF NOT has_table_privilege('service_role', 'public.board_posts', 'INSERT, UPDATE, DELETE')
     OR NOT has_table_privilege('service_role', 'public.board_comments', 'INSERT, DELETE') THEN
    v_bad := v_bad || 'service_role 쓰기 없음'::TEXT;
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00015] 권한·정책이 기대와 다름: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00015] board_posts·board_comments: anon·authenticated SELECT 만, 쓰기 정책 0, 숨김 SELECT 정책 2';
END $$;
