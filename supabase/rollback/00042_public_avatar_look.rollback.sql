-- ============================================================
-- 00042 되돌리기: 공개 아바타의 꾸민 모습(avatar_look)을 빼고 user_profiles_public·동기화 트리거 함수를 00021 정의로   (P9-05)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면
--   - 새 앱(P9-05)은 게시판에서 user_profiles_public.avatar_look 을 읽으므로 게시판 조회가 실패합니다.
--     **먼저 P9-05 이전 앱으로 되돌린 뒤** 실행합니다
--   - 잃는 데이터 없음: avatar_look 은 users.avatar_config 에서 다시 계산하는 값입니다
-- 실행 후 상태 = 00041 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00042_public_avatar_look.rollback.sql
-- ============================================================

-- 5. 뷰: 컬럼을 줄이려면 다시 만들어야 함 (00021 정의·권한)
DROP VIEW IF EXISTS public.user_profiles_public;
CREATE VIEW public.user_profiles_public
  WITH (security_invoker = true) AS
  SELECT p.user_id     AS id,
         p.public_name AS display_name,
         NULL::text    AS avatar_url,
         p.avatar_skin AS avatar_skin
    FROM public.user_public_profiles p;
COMMENT ON VIEW public.user_profiles_public IS
  '다른 사용자에게 보이는 값: 이름(닉네임, 없으면 "모험가NNNN") + 파이뱀 스킨 (P1-18·P3-13). security_invoker 로 user_public_profiles 를 읽음 (B34). 실명·사진 없음';
REVOKE ALL ON public.user_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_profiles_public TO authenticated;
GRANT ALL ON public.user_profiles_public TO service_role;

-- 3. 동기화 트리거 함수: 00021 정의
CREATE OR REPLACE FUNCTION public.sync_user_public_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_public_profiles AS p (user_id, public_name, avatar_skin)
  VALUES (
    NEW.id,
    coalesce(
      NEW.nickname,
      '모험가' || lpad((abs(pg_catalog.hashtextextended(NEW.id::text, 0)) % 10000)::text, 4, '0')
    ),
    public.public_avatar_skin(NEW.avatar_config)
  )
  ON CONFLICT (user_id) DO UPDATE
    SET public_name = EXCLUDED.public_name,
        avatar_skin = EXCLUDED.avatar_skin,
        updated_at  = now()
    WHERE p.public_name IS DISTINCT FROM EXCLUDED.public_name
       OR p.avatar_skin IS DISTINCT FROM EXCLUDED.avatar_skin;
  RETURN NULL;
END;
$$;
COMMENT ON FUNCTION public.sync_user_public_profile() IS
  'users INSERT·nickname·avatar_config UPDATE → user_public_profiles (B34, P3-13). 트리거 전용, 실행 권한 없음';
REVOKE ALL ON FUNCTION public.sync_user_public_profile() FROM PUBLIC, anon, authenticated;

-- 2. 보조 함수, 1. 컬럼
DROP FUNCTION IF EXISTS public.public_avatar_look(JSONB);
ALTER TABLE public.user_public_profiles DROP CONSTRAINT IF EXISTS user_public_profiles_avatar_look_check;
ALTER TABLE public.user_public_profiles DROP COLUMN IF EXISTS avatar_look;
