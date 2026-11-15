-- ============================================================
-- 00055 되돌리기: 갤러리 뷰·신고·스티커 반응 삭제   (P11-07)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 먼저 P11-07 이전 앱으로 되돌립니다 (지금 앱은 /gallery·/api/gallery 에서 이 객체들을 씀).
-- 잃는 데이터: 스티커 반응과 신고 기록 전부. 작품(creations)·공개 여부·숨김(hidden_at)은 그대로 남음
--   (이전 앱에는 다른 학생이 공개 작품을 보는 길이 없어 그대로 둬도 안전)
-- 실행 후 상태 = 00054 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00055_gallery.rollback.sql
-- ============================================================

DROP VIEW IF EXISTS public.gallery_creations;
DROP INDEX IF EXISTS public.creations_gallery_idx;
DROP FUNCTION IF EXISTS public.report_creation(UUID, UUID, TEXT);
DROP TABLE IF EXISTS public.creation_reports;
DROP TABLE IF EXISTS public.creation_reactions;
