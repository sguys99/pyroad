-- ============================================================
-- 00006 되돌리기: 보상 RPC·규칙 함수·earned_xp 트리거와 컬럼 삭제   (P1-03)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 이전 앱(complete·golden-key·reset API 가 사용자 클라이언트로 쓰는 버전)으로 되돌린 뒤 실행합니다.
--    새 앱은 이 함수들이 없으면 퀘스트 완료·황금키·리셋이 500 을 냅니다.
-- ⚠️ earned_xp 컬럼을 지우면 퀘스트별 획득 XP 기록이 사라집니다 (다시 적용하면 백필이 현재 규칙으로 채움).
-- 실행 후 상태 = 00005 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00006_quest_reward_rpc.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.complete_quest(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS public.use_golden_key(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.reset_progress(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.is_stage_unlocked(UUID, UUID);
DROP FUNCTION IF EXISTS public.decide_new_badges(TEXT[], INTEGER, BOOLEAN, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.has_three_day_streak(TIMESTAMPTZ[]);
DROP FUNCTION IF EXISTS public.level_for_xp(INTEGER);
DROP FUNCTION IF EXISTS public.quest_xp(INTEGER, INTEGER, BOOLEAN);

DROP TRIGGER IF EXISTS trg_user_progress_protect_earned_xp ON public.user_progress;
DROP FUNCTION IF EXISTS public.user_progress_protect_earned_xp();

ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_earned_xp_nonneg;
ALTER TABLE public.user_progress DROP COLUMN IF EXISTS earned_xp;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname IN ('complete_quest', 'use_golden_key', 'reset_progress')) THEN
    RAISE EXCEPTION '[00006 rollback] 보상 RPC 가 남아 있습니다';
  END IF;
  RAISE NOTICE '[00006 rollback] 보상 RPC·earned_xp 삭제 완료';
END $$;
