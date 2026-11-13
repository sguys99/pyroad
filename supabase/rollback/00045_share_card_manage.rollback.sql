-- ============================================================
-- 00045 되돌리기: 공유 카드 관리 함수·카드 동기화 트리거 삭제   (P9-11)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P9-11 이전 앱으로 되돌린 뒤 실행합니다.
-- 잃는 데이터: 없음. 숨긴 카드는 숨긴 채(다시 만들면 공개), 지운 카드는 이미 없음. 이후 닉네임·꾸민 모습을 바꿔도 카드는 옛 값 그대로
-- 실행 후 상태 = 00044 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00045_share_card_manage.rollback.sql
-- ============================================================

DROP TRIGGER IF EXISTS sync_share_card_profile ON public.user_public_profiles;
DROP FUNCTION IF EXISTS public.sync_share_card_profile();
DROP FUNCTION IF EXISTS public.manage_share_card(UUID, TEXT, TEXT);

DO $$
BEGIN
  RAISE NOTICE '[00045 rollback] manage_share_card·sync_share_card_profile 삭제 완료';
END $$;
