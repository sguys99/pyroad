-- ============================================================
-- 00040 되돌리기: 인벤토리(user_items)·구매·장착·상점 상태 함수 삭제   (P9-03)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P9-03 이전 앱으로 되돌린 뒤 실행합니다.
-- 잃는 데이터: 가진 영구 아이템 목록(user_items). 쓴 코인(원장 spend shop:…)·산 황금키·방패·avatar_config/settings 의 장착 값은 그대로
--   (다시 적용해도 user_items 는 비어 있음 — 필요하면 원장 spend shop:<item> 행으로 다시 채울 수 있음)
-- 실행 후 상태 = 00039 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00040_inventory.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.shop_status(UUID);
DROP FUNCTION IF EXISTS public.equip_item(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.purchase_item(UUID, TEXT);
DROP TABLE IF EXISTS public.user_items;
