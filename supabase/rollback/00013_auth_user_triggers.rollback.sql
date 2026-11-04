-- ============================================================
-- 00013 되돌리기: handle_new_user 를 00001 본문으로, 로그인 트리거·보조 함수 삭제   (B24, B16)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면 B16(provider 이름·사진을 공개 display_name·avatar_url 에 복사)과 B24(search_path·실행 권한) 구멍이 다시 열립니다.
--    원인을 고친 뒤 00013 을 다시 적용합니다. 앱(이전·새 앱 모두)은 이 파일과 무관하게 동작합니다.
-- 바꾸지 않는 것: 00013 이 맞춘 users.last_login_at·last_login_provider 값, 00013 이후 가입한 사용자의 자리표시자 이름
-- 실행 후 상태 = 00012 까지 적용된 상태 (prevent_status_downgrade 는 search_path 없음, 두 함수 모두 PUBLIC EXECUTE)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00013_auth_user_triggers.rollback.sql
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
DROP FUNCTION IF EXISTS public.handle_user_signed_in();

-- 00001 의 본문 (search_path 없음, provider 이름·사진 복사)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
ALTER FUNCTION public.handle_new_user() RESET search_path;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER FUNCTION public.prevent_status_downgrade() RESET search_path;

-- 00001·00003 의 권한 (PostgreSQL 기본 PUBLIC EXECUTE. 운영 legacy 는 anon·authenticated·service_role 에도 직접 부여)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prevent_status_downgrade() TO PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.placeholder_display_name(UUID);
DROP FUNCTION IF EXISTS public.social_login_provider(TEXT, TEXT);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_signed_in') THEN
    RAISE EXCEPTION '[00013 rollback] 로그인 트리거가 남아 있습니다';
  END IF;
  RAISE NOTICE '[00013 rollback] handle_new_user 00001 본문으로, 로그인 트리거·보조 함수 삭제 완료';
END $$;
