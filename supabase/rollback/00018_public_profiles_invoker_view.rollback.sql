-- ============================================================
-- 00018 되돌리기: user_profiles_public 을 00014 정의(users 를 읽는 security definer 뷰)로, 게시판 FK 를 users 로   (B34)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면
--   - Advisors ERROR security_definer_view 가 다시 나옵니다 (뷰가 users RLS 를 우회)
--   - 보이는 값은 같습니다 (닉네임 → 모험가NNNN, 사진 NULL). 앱(이전·새)은 그대로 동작합니다
--   - user_public_profiles 테이블은 지웁니다 (users 에서 다시 계산할 수 있는 값뿐이라 잃는 데이터 없음)
-- 실행 후 상태 = 00017 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00018_public_profiles_invoker_view.rollback.sql
-- ============================================================

-- 4. 뷰: 00014 정의 (security_invoker 해제 → users 를 만든 사람 권한으로 읽음). 권한은 00014 그대로
ALTER VIEW public.user_profiles_public RESET (security_invoker);
CREATE OR REPLACE VIEW public.user_profiles_public AS
  SELECT id,
         coalesce(
           nickname,
           '모험가' || lpad((abs(pg_catalog.hashtextextended(id::text, 0)) % 10000)::text, 4, '0')
         ) AS display_name,
         NULL::text AS avatar_url
  FROM public.users;
COMMENT ON VIEW public.user_profiles_public IS
  '다른 사용자에게 보이는 이름: 닉네임, 없으면 "모험가NNNN" (P1-18). 실명·사진 없음. security_invoker 교체는 P3-13';
REVOKE ALL ON public.user_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_profiles_public TO authenticated;
GRANT ALL ON public.user_profiles_public TO service_role;

-- 3. 게시판 작성자 FK: 다시 users(id)
ALTER TABLE public.board_posts DROP CONSTRAINT IF EXISTS board_posts_user_id_fkey;
ALTER TABLE public.board_posts
  ADD CONSTRAINT board_posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.board_comments DROP CONSTRAINT IF EXISTS board_comments_user_id_fkey;
ALTER TABLE public.board_comments
  ADD CONSTRAINT board_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 5. FK 인덱스
DROP INDEX IF EXISTS public.idx_notices_user_id;
DROP INDEX IF EXISTS public.idx_board_reports_target_user_id;

-- 2. 동기화 트리거, 1. 공개 프로필 테이블
DROP TRIGGER IF EXISTS trg_users_sync_public_profile ON public.users;
DROP FUNCTION IF EXISTS public.sync_user_public_profile();
DROP TABLE IF EXISTS public.user_public_profiles;
