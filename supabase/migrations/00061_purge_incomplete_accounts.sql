-- ============================================================
-- 온보딩·나이 확인을 마치지 않은 계정 파기 대상 목록 (Idempotent)   (B118, §12-Q81, P12-06 F7)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱은 새 함수를 부르지 않으므로 그대로 동작)
--
-- 배경
--   00024 의 파기 대상(list_expired_unconsented)은 "만 14세 미만 + 보호자 동의 없음"뿐이라, 로그인만 하고 온보딩(약속·나이 확인)을
--   끝내지 않고 떠난 계정은 Auth 정보(Google 이메일)와 함께 기한 없이 남았다(P12-06 F7). 사용자 결정(Q81): 가입 30일 뒤 자동 파기,
--   기존 크론(/api/cron/purge-unconsented)이 함께 지운다.
--
-- 하는 일
--   list_expired_incomplete(p_limit, p_user_id = NULL, p_now = now()) → setof uuid
--     대상 = (onboarded_at IS NULL OR age_band IS NULL)
--            AND 기한 = greatest(가입일, 이 마이그레이션을 적용한 시각) + 30일 이 지남
--            AND 활동 기록 없음 (진행·뱃지·게시글·댓글·공지·작품 — 온보딩 관문(P3-11) 전에 가입해 공부한 아이는 지우지 않음)
--     ⚠️ 유예: 기한의 기준을 가입일이 아니라 max(가입일, 적용 시각)로 둬 **배포 날 오래된 계정이 한꺼번에 지워지지 않게** 한다
--        (00024 가 기존 사용자 기한을 "나이 확인 시각 + 30일"로 둔 것과 같은 이유). 가장 단순하게 적용 시각을 함수 본문에 상수로 박는다
--        → 이 파일을 다시 실행하면 유예 시작이 그 시각으로 늦춰질 뿐(덜 지우는 쪽, 안전)
--     p_user_id: 크론이 지우기 직전에 한 명씩 다시 확인할 때. p_now: 회귀 테스트가 30일 뒤를 흉내 낼 때(기본 now())
--   관리자(app_metadata.role)는 invoker 함수가 auth.users 를 못 읽어 여기서 거르지 않고 크론이 지우기 전에 거른다
--
-- 확인: supabase/tests GC-5·GC-6
-- 되돌리기: supabase/rollback/00061_purge_incomplete_accounts.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00061] list_expired_incomplete: service_role 전용, 유예 시작 <적용 시각>` 확인
-- ============================================================

DO $mig$
BEGIN
  -- 적용 시각을 epoch 숫자로 박음 (DateStyle·줄바꿈과 무관)
  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION public.list_expired_incomplete(
      p_limit INTEGER,
      p_user_id UUID DEFAULT NULL,
      p_now TIMESTAMPTZ DEFAULT now()
    )
    RETURNS SETOF UUID
    LANGUAGE sql
    STABLE
    SECURITY INVOKER
    SET search_path = ''
    AS $body$
      SELECT u.id FROM public.users AS u
       WHERE (u.onboarded_at IS NULL OR u.age_band IS NULL)
         AND greatest(u.created_at, to_timestamp(%s)) + interval '30 days' < p_now
         AND (p_user_id IS NULL OR u.id = p_user_id)
         AND NOT EXISTS (SELECT 1 FROM public.user_progress AS x WHERE x.user_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM public.user_badges AS x WHERE x.user_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM public.board_posts AS x WHERE x.user_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM public.board_comments AS x WHERE x.user_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM public.notices AS x WHERE x.user_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM public.creations AS x WHERE x.user_id = u.id)
       ORDER BY u.created_at
       LIMIT greatest(1, least(coalesce(p_limit, 50), 500));
    $body$
  $f$, extract(epoch FROM now()));
END $mig$;

COMMENT ON FUNCTION public.list_expired_incomplete(INTEGER, UUID, TIMESTAMPTZ) IS
  '온보딩·나이 확인 미완료 + 활동 없음 + max(가입일, 00061 적용 시각) + 30일 지난 계정 (B118, Q81). service_role 전용: /api/cron/purge-unconsented';

REVOKE ALL ON FUNCTION public.list_expired_incomplete(INTEGER, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_expired_incomplete(INTEGER, UUID, TIMESTAMPTZ) TO service_role;

-- 자기 검증
DO $$
DECLARE
  v_fn TEXT := 'public.list_expired_incomplete(integer, uuid, timestamp with time zone)';
  v_from TEXT;
BEGIN
  IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION '[00061] anon/authenticated 가 % 를 실행할 수 있음', v_fn;
  END IF;
  IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION '[00061] service_role 이 % 를 실행할 수 없음', v_fn;
  END IF;
  SELECT substring(prosrc FROM 'to_timestamp\(([0-9.]+)\)') INTO v_from
    FROM pg_proc WHERE oid = to_regprocedure(v_fn);
  RAISE NOTICE '[00061] list_expired_incomplete: service_role 전용, 유예 시작 %', to_timestamp(v_from::numeric);
END $$;
