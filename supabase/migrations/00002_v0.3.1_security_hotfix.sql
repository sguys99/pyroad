-- ============================================================
-- pyRoad v0.3.1 보안 핫픽스 (Idempotent)
-- 이미 00001 스키마가 적용된 DB에 Supabase SQL Editor에서 실행
-- (00001에도 같은 내용이 반영되어 있어 신규 DB는 00001만 실행하면 됨)
-- ============================================================

-- B02: 일반 사용자가 Supabase 클라이언트로 공지를 직접 작성·수정·삭제하던 정책 제거
--      공지 쓰기는 /api/notice 에서 관리자 검증 후 service role로만 수행
DROP POLICY IF EXISTS "notices_insert_authenticated" ON public.notices;
DROP POLICY IF EXISTS "notices_update_own" ON public.notices;
DROP POLICY IF EXISTS "notices_delete_own" ON public.notices;

-- B03: user_profiles_public 뷰는 users RLS를 우회하므로
--      비로그인(anon) 조회와 뷰를 통한 INSERT/UPDATE/DELETE를 차단하고 로그인 사용자 조회만 허용
REVOKE ALL ON public.user_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_profiles_public TO authenticated;
