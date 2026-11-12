-- ============================================================
-- 00039 되돌리기: 상점 아이템 카탈로그(shop_items)·kst_week_start 삭제   (P9-01)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면
--   - P9-03 이후의 인벤토리·구매 객체가 shop_items 를 참조하면 그 롤백을 먼저 실행합니다
--   - 잃는 데이터 없음: 표는 마이그레이션이 넣은 정의뿐입니다(원본 src/lib/shop/catalog.ts)
-- 실행 후 상태 = 00038 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00039_shop_items.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.kst_week_start(DATE);
DROP TABLE IF EXISTS public.shop_items;
