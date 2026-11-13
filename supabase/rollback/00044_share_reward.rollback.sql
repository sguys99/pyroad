-- ============================================================
-- 00044 되돌리기: 자랑하기 보상 함수 삭제 · 금액표에서 share 빼기   (P9-10)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P9-10 이전 앱으로 되돌린 뒤 실행합니다.
-- 잃는 데이터: 없음. 이미 받은 자랑하기 코인(원장 source = 'share')은 지우지 않습니다 — 지우면 원장 잔액 사슬(balance_after)이 깨짐.
--   그런 행이 있으면 원장 source CHECK 는 'share' 를 허용한 채로 둡니다 (NOTICE 로 알림). 없으면 00030 의 목록으로 되돌림
-- 실행 후 상태 = 00043 까지 적용된 상태 (share 원장 행이 있으면 CHECK 만 넓은 채)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00044_share_reward.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.claim_share_reward(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.coin_reward(p_kind TEXT, p_n INTEGER DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(CASE p_kind
    WHEN 'quest'       THEN 10
    WHEN 'project'     THEN 40   -- 프로젝트 첫 완료 (§12-Q65 (a), XP 4배에 맞춤)
    WHEN 'star'        THEN 5
    WHEN 'level_up'    THEN CASE WHEN p_n BETWEEN 2 AND 50 THEN CASE WHEN p_n % 5 = 0 THEN 100 ELSE 20 END END
    WHEN 'mission'     THEN (ARRAY[10, 15, 20])[p_n]
    WHEN 'attendance'  THEN (ARRAY[5, 5, 10, 10, 15, 20, 30])[p_n]
    WHEN 'chest'       THEN (ARRAY[30, 50])[p_n]
    WHEN 'achievement' THEN (ARRAY[10, 30, 100])[p_n]
  END, 0);
$$;
REVOKE ALL ON FUNCTION public.coin_reward(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_reward(TEXT, INTEGER) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.coin_ledger WHERE source = 'share') THEN
    RAISE NOTICE '[00044 rollback] share 원장 행이 있어 source CHECK 는 그대로 둡니다';
  ELSE
    ALTER TABLE public.coin_ledger DROP CONSTRAINT IF EXISTS coin_ledger_source_check;
    ALTER TABLE public.coin_ledger ADD CONSTRAINT coin_ledger_source_check
      CHECK (source IN ('quest', 'star', 'quiz', 'mission', 'attendance', 'achievement', 'chest', 'level_up', 'retro', 'spend'));
  END IF;
END $$;
