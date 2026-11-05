-- ============================================================
-- pyRoad 기존 객체 권한 명시 (Idempotent)                    (P1-07)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용해도 안전, 권한을 넓히거나 좁히지 않음)
--
-- 배경: Supabase 의 "새 테이블 자동 노출" 기본값이 환경마다 다릅니다.
--   - 운영(legacy, 2026-11-04 확인): public 에 postgres 가 만든 테이블은 anon/authenticated/service_role
--     에게 arwdDxtm(ALL)이 자동으로 붙음
--   - 로컬 CLI 2.115 신규 기본값: Dxtm(TRUNCATE·REFERENCES·TRIGGER·MAINTAIN)만 붙어
--     00001 + 00002 만 적용하면 service_role 까지 SELECT 403
-- 이 파일은 00001·00002 가 만든 객체의 권한을 "운영에 지금 있는 그대로" 명시해서,
-- 어느 기본값에서 시작해도 같은 권한 결과가 나오게 합니다.
--   - 운영: 이미 같은 권한이 있으므로 아무것도 바뀌지 않음 (no-op)
--   - 로컬·CI 새 DB: 운영과 같은 권한이 됨
--
-- 주의: 아래 권한은 "안전한 목표"가 아니라 "운영 현재 상태"입니다. 넓은 권한은 RLS 가 막고 있고,
-- 좁히는 작업은 별도 ③ 마이그레이션에서 합니다 (P1-01 users UPDATE 컬럼 권한,
-- P1-04 user_progress·user_badges 쓰기 제한, B24 SECURITY DEFINER 함수 정리).
--
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 테이블 8개: 운영 legacy 기본값과 같은 ALL (= arwdDxtm)
--    행 단위 접근은 00001 Section 4 의 RLS 정책이 결정합니다.
-- ------------------------------------------------------------
GRANT ALL ON TABLE
  public.users,
  public.stages,
  public.quests,
  public.user_progress,
  public.user_badges,
  public.board_posts,
  public.board_comments,
  public.notices
TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 2. 뷰 user_profiles_public
--    anon·authenticated 는 00001/00002 의 REVOKE ALL + GRANT SELECT TO authenticated 그대로.
--    service_role 은 운영에서 회수한 적이 없어 legacy 기본값 ALL 을 가지고 있으므로 같게 맞춤.
-- ------------------------------------------------------------
GRANT ALL ON TABLE public.user_profiles_public TO service_role;

-- ------------------------------------------------------------
-- 3. 함수 2개 (handle_new_user, prevent_status_downgrade): 변경 없음
--    두 환경 모두 PostgreSQL 기본값인 PUBLIC EXECUTE 가 있어 실행 권한 결과가 이미 같습니다
--    (운영은 legacy 기본값으로 anon/authenticated/service_role 에도 직접 붙어 있음).
--    둘 다 트리거 함수라 RPC 로 직접 호출할 수 없습니다.
--    SECURITY DEFINER 인 handle_new_user 의 search_path 고정·EXECUTE 회수는 B24 에서 별도로 합니다.
--
-- 4. 시퀀스: public 에 시퀀스가 없음 (모든 PK 가 gen_random_uuid())
-- ------------------------------------------------------------
