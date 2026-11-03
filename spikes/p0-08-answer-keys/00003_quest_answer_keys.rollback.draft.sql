-- ============================================================
-- [DRAFT · P0-08 스파이크] 00003 되돌리기
-- quest_answer_keys 의 정답을 quests 로 되돌리고 00003 이 만든 객체를 지웁니다.
-- 퀴즈 정답(quiz_answer)은 quests 에 돌려놓을 자리가 없으므로, 남아 있으면 중단합니다.
-- 한 트랜잭션으로 실행: psql -1 -v ON_ERROR_STOP=1 -f 00003_quest_answer_keys.rollback.draft.sql
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.quest_answer_keys') IS NULL THEN
    RAISE NOTICE '[00003 rollback] quest_answer_keys 가 없습니다. 할 일이 없습니다.';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.quest_answer_keys WHERE quiz_answer IS NOT NULL) THEN
    RAISE EXCEPTION '[00003 rollback] 퀴즈 정답이 있어 되돌릴 수 없습니다 (quests 에 저장할 곳 없음).';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_quests_split_answer_fields ON public.quests;
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_no_answer_fields;

UPDATE public.quests q
   SET expected_output = k.expected_output,
       prompt_skeleton =
         CASE WHEN jsonb_typeof(q.prompt_skeleton->'steps') = 'array' AND jsonb_array_length(k.steps) > 0 THEN
           jsonb_set(q.prompt_skeleton, '{steps}', (
             SELECT jsonb_agg(s || COALESCE((SELECT a - 'step_number' FROM jsonb_array_elements(k.steps) a
                                              WHERE a->'step_number' = s->'step_number'), '{}'::jsonb)
                              ORDER BY ord)
               FROM jsonb_array_elements(q.prompt_skeleton->'steps') WITH ORDINALITY AS t(s, ord)))
         ELSE q.prompt_skeleton END
         || CASE WHEN k.hints <> '{}'::jsonb THEN jsonb_build_object('hints', k.hints) ELSE '{}'::jsonb END
         || CASE WHEN k.solution_code IS NOT NULL THEN jsonb_build_object('solution_code', k.solution_code) ELSE '{}'::jsonb END
  FROM public.quest_answer_keys k
 WHERE k.quest_id = q.id;

DROP FUNCTION IF EXISTS public.quests_split_answer_fields();
DROP TABLE IF EXISTS public.quest_answer_keys;
COMMENT ON COLUMN public.quests.expected_output IS NULL;
