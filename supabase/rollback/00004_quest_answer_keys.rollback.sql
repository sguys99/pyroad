-- ============================================================
-- 00004 되돌리기: quest_answer_keys 와 분리 트리거를 지움   (P1-02)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 전제: 00005 를 먼저 되돌렸음 (supabase/rollback/00005_quest_answer_keys_strip.rollback.sql).
--   00004 만 적용된 상태에서는 quests 에 정답 원본이 그대로 있으므로 테이블만 지우면 됩니다.
-- 퀴즈 정답(quiz_answer)은 quests 에 돌려놓을 자리가 없으므로, 남아 있으면 중단합니다.
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00004_quest_answer_keys.rollback.sql
-- ============================================================

DO $$
DECLARE
  v_lost INT;
BEGIN
  IF to_regclass('public.quest_answer_keys') IS NULL THEN
    RAISE NOTICE '[00004 rollback] quest_answer_keys 가 없습니다. 할 일이 없습니다.';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quests_no_answer_fields'
                AND conrelid = 'public.quests'::regclass) THEN
    RAISE EXCEPTION '[00004 rollback] 00005 가 적용되어 있습니다. 00005 rollback 을 먼저 실행하세요.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quest_answer_keys WHERE quiz_answer IS NOT NULL) THEN
    RAISE EXCEPTION '[00004 rollback] 퀴즈 정답이 있어 되돌릴 수 없습니다 (quests 에 저장할 곳 없음).';
  END IF;
  -- quests 에 없는 정답이 quest_answer_keys 에만 있으면 지우기 전에 멈춤
  SELECT count(*) INTO v_lost
    FROM public.quest_answer_keys k JOIN public.quests q ON q.id = k.quest_id
   WHERE (k.expected_output <> '' AND q.expected_output = '')
      OR (k.solution_code IS NOT NULL AND NOT (q.prompt_skeleton ? 'solution_code'))
      OR (k.hints <> '{}'::jsonb AND NOT (q.prompt_skeleton ? 'hints'));
  IF v_lost > 0 THEN
    RAISE EXCEPTION '[00004 rollback] quest_answer_keys 에만 있는 정답 %건. 00005 rollback 을 먼저 실행하세요.', v_lost;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_quests_split_answer_fields ON public.quests;
DROP FUNCTION IF EXISTS public.quests_split_answer_fields();
DROP TABLE IF EXISTS public.quest_answer_keys;
