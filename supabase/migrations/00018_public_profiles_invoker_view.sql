-- ============================================================
-- 공개 이름을 user_public_profiles 테이블로 옮기고 user_profiles_public 을 security_invoker 뷰로 (Idempotent)
--                                                                         (B34, B28)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱이 그대로 동작)
--
-- 배경
--   - B34 (Advisors ERROR security_definer_view): user_profiles_public 은 만든 사람(postgres) 권한으로 users 를 읽어
--     users RLS(본인 행만)를 우회합니다. 00002 는 비로그인 조회를, 00014 는 실명·사진을 막았지만 구조는 그대로라
--     뷰에 컬럼을 하나 잘못 더하면 다른 아이의 users 값이 그대로 나갑니다.
--     security_invoker = true 로 바꾸면 users RLS 때문에 게시판 작성자 이름이 본인 것 말고는 모두 비게 되므로,
--     다른 사람에게 보여도 되는 값(공개 이름)만 담은 테이블을 따로 두고 뷰가 그 테이블을 읽게 합니다.
--   - 범위: "ERROR 제거 + 같은 공개 정보". 뷰 이름·컬럼(id, display_name, avatar_url)·값(닉네임 → 모험가NNNN, 사진 NULL)은
--     00014 와 같습니다. 캐릭터 아바타·닉네임 온보딩 뒤 정식 교체는 P3-13·P3-12 (이 테이블에 컬럼을 더하면 됨)
--
-- 하는 일
--   1. user_public_profiles(user_id, public_name, updated_at)
--        - users 1행 = 1행. public_name = coalesce(nickname, "모험가NNNN") (00014 뷰와 같은 식)
--        - RLS ON + 로그인 사용자 SELECT 정책(모든 행) — 담긴 값이 원래 모두에게 보이는 게시판 작성자 이름뿐이라서
--        - 쓰기는 동기화 트리거(아래 2)와 service_role 만. anon 은 권한 없음 (B03 과 같음)
--   2. 동기화 트리거 sync_user_public_profile (AFTER INSERT OR UPDATE OF nickname ON users)
--        - SECURITY DEFINER + SET search_path = '' + EXECUTE 회수 (트리거는 실행 권한 없이 동작).
--          닉네임 UPDATE 권한을 클라이언트에 주는 P3-11 이후에도 사용자는 user_public_profiles 에 직접 쓰지 못함
--        - 자리표시자 식은 00013 placeholder_display_name 과 같음. 운영 순서상 이 파일(①)이 00013(③)보다 먼저
--          적용되어 함수가 아직 없으므로 식을 복사 (회귀 VIEW-3 이 함수와 대조)
--        - 기존 users 행은 여기서 한 번 채움 (다시 실행하면 다시 계산)
--   3. 게시판 작성자 FK 를 user_public_profiles 로
--        board_posts_user_id_fkey·board_comments_user_id_fkey: users(id) → user_public_profiles(user_id), 이름 그대로
--        PostgREST 는 뷰의 관계를 "뷰 컬럼이 가리키는 원본 테이블 컬럼"의 FK 로 찾습니다. 뷰가 users 를 읽지 않게 되면
--        board_posts → users FK 로는 user_profiles_public 을 임베딩할 수 없으므로, 같은 이름의 FK 가 새 테이블을
--        가리키게 해서 앱(이전 앱 포함)의 `user_profiles_public!board_posts_user_id_fkey(display_name)` 를 그대로 살림.
--        탈퇴 연쇄 삭제는 auth.users → users → user_public_profiles → board_posts → board_comments (모두 ON DELETE CASCADE)
--   4. user_profiles_public 재정의: WITH (security_invoker = true), user_public_profiles 를 읽음. 권한은 00014 와 같음
--      (authenticated SELECT, service_role ALL, anon 없음)
--   5. FK 인덱스 (Advisors INFO unindexed_foreign_keys): notices.user_id, board_reports.target_user_id
--      (탈퇴 때 연쇄 삭제·SET NULL 이 이 열로 찾음. 운영 행이 적어 바로 만듦)
--   6. 자기 검증: 뷰 security_invoker, 행 수·이름 일치, FK 대상·삭제 규칙, 권한이 기대와 다르면 예외 → 전체 롤백
--
-- 탈퇴(B28): 클라이언트에는 users DELETE 권한·정책이 없습니다(00008, P1-01). 탈퇴는 /api/account/delete 가
--   auth.admin.deleteUser 로 auth.users 를 지우고, public 의 사용자 데이터는 모두 ON DELETE CASCADE 로 함께 지워집니다
--   (users·user_public_profiles·user_progress·user_badges·quiz_attempts·board_posts·board_comments·board_reports(신고자)·
--    user_api_keys·api_rate_limits·notices). board_reports.target_user_id 만 SET NULL(다른 아이가 한 신고 기록은 남기되
--   탈퇴한 아이를 가리키지 않음). analytics_events 는 users 를 참조하지 않아(익명 ID = HMAC) 앱이 HMAC 으로 지웁니다(P1-17).
--   새 사용자 테이블도 users(id) 를 ON DELETE CASCADE 로 참조해야 합니다 (회귀 B28-1·B28-2 가 FK 와 실제 삭제를 확인)
--
-- 이전 앱: 뷰 이름·컬럼·값과 임베딩 FK 이름이 같아 게시판 목록·상세·댓글 작성자 표시가 그대로 동작합니다.
--   이전 앱의 사용자 클라이언트 board INSERT(③ 00015 전)도 FK 대상 행이 트리거로 항상 있어 그대로 동작합니다.
-- ③ 회수 파일은 없습니다 (기존 객체의 권한을 좁히지 않음).
-- 확인: supabase/tests VIEW-2(deny), VIEW-3, PP-1~5, B28-1·2, APP-13·14, ST-7(Advisors)
-- 되돌리기: supabase/rollback/00018_public_profiles_invoker_view.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00018] user_profiles_public: security_invoker, 공개 이름 N행 (users N행), 게시판 FK 2개 → user_public_profiles` 확인
-- ============================================================

-- ------------------------------------------------------------
-- 1. 공개 프로필 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_public_profiles (
  user_id     UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  public_name TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_public_profiles IS
  '다른 사용자에게 보여도 되는 값만 (B34). 동기화 트리거 sync_user_public_profile 이 users 에서 채움. 클라이언트는 읽기만';
COMMENT ON COLUMN public.user_public_profiles.public_name IS
  '게시판 작성자 이름: 닉네임, 없으면 "모험가NNNN" (= coalesce(nickname, placeholder_display_name(id))). 실명 아님';

ALTER TABLE public.user_public_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_public_profiles TO authenticated;
GRANT ALL ON TABLE public.user_public_profiles TO service_role;

-- 모든 행: 담긴 값이 게시판에서 원래 모두에게 보이는 이름뿐 (실명·사진·XP 등은 이 테이블에 두지 않음)
DROP POLICY IF EXISTS "user_public_profiles_select_authenticated" ON public.user_public_profiles;
CREATE POLICY "user_public_profiles_select_authenticated" ON public.user_public_profiles
  FOR SELECT TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- 2. 동기화 트리거
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_public_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_public_profiles AS p (user_id, public_name)
  VALUES (
    NEW.id,
    coalesce(
      NEW.nickname,
      -- = public.placeholder_display_name(id) (00013). 바꾸면 두 곳을 함께 (회귀 VIEW-3 이 대조)
      '모험가' || lpad((abs(pg_catalog.hashtextextended(NEW.id::text, 0)) % 10000)::text, 4, '0')
    )
  )
  ON CONFLICT (user_id) DO UPDATE
    SET public_name = EXCLUDED.public_name,
        updated_at  = now()
    WHERE p.public_name IS DISTINCT FROM EXCLUDED.public_name;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_user_public_profile() IS
  'users INSERT·nickname UPDATE → user_public_profiles (B34). 트리거 전용, 실행 권한 없음';

REVOKE ALL ON FUNCTION public.sync_user_public_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_users_sync_public_profile ON public.users;
CREATE TRIGGER trg_users_sync_public_profile
  AFTER INSERT OR UPDATE OF nickname ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_public_profile();

-- 기존 사용자 (다시 실행하면 다시 계산)
INSERT INTO public.user_public_profiles AS p (user_id, public_name)
SELECT u.id,
       coalesce(u.nickname,
                '모험가' || lpad((abs(pg_catalog.hashtextextended(u.id::text, 0)) % 10000)::text, 4, '0'))
  FROM public.users u
ON CONFLICT (user_id) DO UPDATE
  SET public_name = EXCLUDED.public_name,
      updated_at  = now()
  WHERE p.public_name IS DISTINCT FROM EXCLUDED.public_name;

-- ------------------------------------------------------------
-- 3. 게시판 작성자 FK: users(id) → user_public_profiles(user_id), 이름은 그대로 (PostgREST 임베딩 힌트)
--    모든 users 행에 공개 프로필 행이 있으므로(위 백필 + 트리거) 검증이 실패하지 않음
-- ------------------------------------------------------------
ALTER TABLE public.board_posts DROP CONSTRAINT IF EXISTS board_posts_user_id_fkey;
ALTER TABLE public.board_posts
  ADD CONSTRAINT board_posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_public_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.board_comments DROP CONSTRAINT IF EXISTS board_comments_user_id_fkey;
ALTER TABLE public.board_comments
  ADD CONSTRAINT board_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_public_profiles(user_id) ON DELETE CASCADE;

-- ------------------------------------------------------------
-- 4. 공개 뷰: security_invoker (읽는 사람의 권한·RLS 로 user_public_profiles 를 읽음)
--    이름·컬럼·값은 00014 와 같음. 계산 컬럼이 없어도 뷰에 쓰기 권한이 없으므로 수정·삭제는 42501
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_profiles_public
  WITH (security_invoker = true) AS
  SELECT p.user_id     AS id,
         p.public_name AS display_name,
         NULL::text    AS avatar_url   -- provider 프로필 사진을 내보내지 않음 (캐릭터 아바타는 P3-13)
    FROM public.user_public_profiles p;

COMMENT ON VIEW public.user_profiles_public IS
  '다른 사용자에게 보이는 이름: 닉네임, 없으면 "모험가NNNN" (P1-18). security_invoker 로 user_public_profiles 를 읽음 (B34). 실명·사진 없음';

REVOKE ALL ON public.user_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_profiles_public TO authenticated;
GRANT ALL ON public.user_profiles_public TO service_role;

-- ------------------------------------------------------------
-- 5. FK 인덱스 (Advisors unindexed_foreign_keys)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notices_user_id ON public.notices (user_id);
CREATE INDEX IF NOT EXISTS idx_board_reports_target_user_id ON public.board_reports (target_user_id);

-- ------------------------------------------------------------
-- 6. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad      TEXT[] := '{}';
  v_role     TEXT;
  v_users    INTEGER;
  v_profiles INTEGER;
  v_mismatch INTEGER;
BEGIN
  IF NOT coalesce((SELECT c.reloptions::text[] && ARRAY['security_invoker=true', 'security_invoker=on', 'security_invoker=1']
                     FROM pg_class c WHERE c.oid = 'public.user_profiles_public'::regclass), false) THEN
    v_bad := v_bad || 'user_profiles_public 이 security_invoker 가 아님'::TEXT;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_public_profiles'::regclass) THEN
    v_bad := v_bad || 'user_public_profiles RLS 꺼짐'::TEXT;
  END IF;

  -- 게시판 FK 2개가 user_public_profiles 를 ON DELETE CASCADE 로 가리킴
  IF (SELECT count(*) FROM pg_constraint
       WHERE conname IN ('board_posts_user_id_fkey', 'board_comments_user_id_fkey')
         AND contype = 'f' AND confrelid = 'public.user_public_profiles'::regclass AND confdeltype = 'c') <> 2 THEN
    v_bad := v_bad || '게시판 FK 2개'::TEXT;
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.user_public_profiles', 'INSERT, UPDATE, DELETE, TRUNCATE')
       OR has_table_privilege(v_role, 'public.user_profiles_public', 'INSERT, UPDATE, DELETE, TRUNCATE') THEN
      v_bad := v_bad || (v_role || ':쓰기 권한');
    END IF;
    IF has_function_privilege(v_role, 'public.sync_user_public_profile()', 'EXECUTE') THEN
      v_bad := v_bad || (v_role || ':EXECUTE sync_user_public_profile');
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.user_public_profiles', 'SELECT')
     OR has_table_privilege('anon', 'public.user_profiles_public', 'SELECT') THEN
    v_bad := v_bad || 'anon:SELECT'::TEXT;
  END IF;

  SELECT count(*) INTO v_users FROM public.users;
  SELECT count(*) INTO v_profiles FROM public.user_public_profiles;
  IF v_users <> v_profiles THEN
    v_bad := v_bad || format('공개 프로필 %s행 ≠ users %s행', v_profiles, v_users);
  END IF;

  -- 뷰 이름이 닉네임·자리표시자가 아닌 행 (= 실명이 나갈 수 있는 행). 00014 자기 검증과 같은 식
  SELECT count(*) INTO v_mismatch
    FROM public.users u
    LEFT JOIN public.user_profiles_public v ON v.id = u.id
   WHERE v.display_name IS DISTINCT FROM coalesce(
           u.nickname,
           '모험가' || lpad((abs(pg_catalog.hashtextextended(u.id::text, 0)) % 10000)::text, 4, '0'))
      OR v.avatar_url IS NOT NULL;
  IF v_mismatch > 0 THEN
    v_bad := v_bad || (v_mismatch || '행: 뷰 이름이 닉네임·자리표시자와 다름');
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00018] 기대와 다름: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00018] user_profiles_public: security_invoker, 공개 이름 %행 (users %행), 게시판 FK 2개 → user_public_profiles',
    v_profiles, v_users;
END $$;
