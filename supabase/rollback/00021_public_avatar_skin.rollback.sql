-- ============================================================
-- 00021 되돌리기: 공개 아바타(avatar_skin)를 빼고 user_profiles_public·동기화 트리거를 00018 정의로   (P3-13)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면
--   - 새 앱(P3-13)은 user_public_profiles.avatar_skin·뷰의 avatar_skin 을 읽으므로 월드맵·프로필·게시판 조회가 실패합니다.
--     **먼저 이전 앱으로 되돌린 뒤** 실행합니다. 이전 앱은 이 컬럼을 읽지 않아 그대로 동작합니다
--   - 잃는 데이터 없음: avatar_skin 은 users.avatar_config.skin 에서 다시 계산하는 값입니다
--   - 00018 을 되돌릴 때는 이 파일을 먼저 (뷰에 avatar_skin 이 있으면 00018 롤백의 CREATE OR REPLACE VIEW 가 실패)
-- 실행 후 상태 = 00020 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00021_public_avatar_skin.rollback.sql
-- ============================================================

-- 5. 뷰: 컬럼을 줄이려면 다시 만들어야 함 (00018 정의·권한)
DROP VIEW IF EXISTS public.user_profiles_public;
CREATE VIEW public.user_profiles_public
  WITH (security_invoker = true) AS
  SELECT p.user_id     AS id,
         p.public_name AS display_name,
         NULL::text    AS avatar_url
    FROM public.user_public_profiles p;
COMMENT ON VIEW public.user_profiles_public IS
  '다른 사용자에게 보이는 이름: 닉네임, 없으면 "모험가NNNN" (P1-18). security_invoker 로 user_public_profiles 를 읽음 (B34). 실명·사진 없음';
REVOKE ALL ON public.user_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_profiles_public TO authenticated;
GRANT ALL ON public.user_profiles_public TO service_role;

-- 3. 동기화 트리거: 00018 정의 (nickname 만)
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

-- 2. 보조 함수, 1. 컬럼
DROP FUNCTION IF EXISTS public.public_avatar_skin(JSONB);
ALTER TABLE public.user_public_profiles DROP CONSTRAINT IF EXISTS user_public_profiles_avatar_skin_check;
ALTER TABLE public.user_public_profiles DROP COLUMN IF EXISTS avatar_skin;
