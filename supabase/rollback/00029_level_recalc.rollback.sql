-- ============================================================
-- 00029 되돌리기: 레벨 보정으로 올려 준 XP 를 빼고 근거 테이블 삭제   (P8-02)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 잃는 데이터: 보정 근거(level_curve_adjustments). 보정 뒤 번 XP 는 그대로 두고 올려 준 만큼(xp_after − xp_before)만 뺌(0 미만 없음)
--   → 보정 사용자는 새 곡선에서 레벨이 내려갈 수 있음 (00028 도 되돌리면 옛 곡선 레벨로)
-- 실행 후 상태 = 00028 까지 적용된 상태 (current_level 은 트리거가 다시 맞춤)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00029_level_recalc.rollback.sql
-- ============================================================

UPDATE public.users u
   SET total_xp = GREATEST(0, u.total_xp - (a.xp_after - a.xp_before))
  FROM public.level_curve_adjustments a
 WHERE a.user_id = u.id;

DROP TABLE IF EXISTS public.level_curve_adjustments;
