-- ============================================================
-- 00030 되돌리기: 코인 원장·잔액·지급/차감 RPC 삭제   (P8-03, B55)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 먼저 이전 앱으로 되돌린 뒤 실행 (새 앱은 users.coins·grant_coins 를 씀)
-- 잃는 데이터: 모든 코인 잔액(users.coins)과 원장(coin_ledger) — 다시 00030 을 적용해도 돌아오지 않음
-- reset_progress 는 이 파일로 바뀌지 않음 (B55 수정이 남음, 인자·반환 같아 이전 앱도 그대로 동작).
--   B55 이전 동작까지 되돌리려면 이어서 supabase/migrations/00027_reset_quiz_attempts.sql 을 다시 실행
-- 실행 후 상태 = 00029 까지 적용된 상태 (reset_progress 제외)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00030_coin_ledger.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.grant_coins(UUID, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.spend_coins(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.coin_apply(UUID, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.coin_balance_mismatches();
DROP TRIGGER IF EXISTS trg_users_protect_coins ON public.users;
DROP FUNCTION IF EXISTS public.users_protect_coins();
DROP TABLE IF EXISTS public.coin_ledger;
ALTER TABLE public.users DROP COLUMN IF EXISTS coins;
