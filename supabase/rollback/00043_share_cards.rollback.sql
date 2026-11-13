-- ============================================================
-- 00043 되돌리기: 공유 카드(share_cards)·만들기·공개 조회 함수 삭제   (P9-07)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P9-07 이전 앱으로 되돌린 뒤 실행합니다.
-- 잃는 데이터: 만든 공유 카드(share_cards). 이미 보낸 공유 링크·이미지는 404 가 됩니다(CDN 사본은 만료까지 남을 수 있음).
--   카드는 기록에서 다시 만들 수 있는 스냅샷이라 학습 기록·코인은 그대로
-- 실행 후 상태 = 00042 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00043_share_cards.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.share_card_public(TEXT);
DROP FUNCTION IF EXISTS public.create_share_card(UUID, TEXT, TEXT);
DROP TABLE IF EXISTS public.share_cards;
