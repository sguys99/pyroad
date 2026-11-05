-- ============================================================
-- 00005 되돌리기: quests 에 정답을 복원하고 분리 트리거를 'copy' 모드로 되돌림   (P1-02)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 실행 후 상태 = 00004 만 적용된 상태 (quests 와 quest_answer_keys 양쪽에 정답, 이전 앱도 동작)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00005_quest_answer_keys_strip.rollback.sql
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.quest_answer_keys') IS NULL THEN
    RAISE EXCEPTION '[00005 rollback] quest_answer_keys 가 없습니다 (00004 가 적용되지 않음).';
  END IF;
END $$;

ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_no_answer_fields;
DROP TRIGGER IF EXISTS trg_quests_split_answer_fields ON public.quests;

-- quest_answer_keys → quests 복원 (단계 정답은 step_number 로 맞춤)
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

CREATE TRIGGER trg_quests_split_answer_fields
  BEFORE INSERT OR UPDATE OF prompt_skeleton, expected_output ON public.quests
  FOR EACH ROW EXECUTE FUNCTION public.quests_split_answer_fields('copy');

COMMENT ON COLUMN public.quests.expected_output IS NULL;

DO $$
DECLARE
  v_missing INT;
BEGIN
  SELECT count(*) INTO v_missing
    FROM public.quest_answer_keys k JOIN public.quests q ON q.id = k.quest_id
   WHERE (k.expected_output <> '' AND q.expected_output <> k.expected_output)
      OR (k.solution_code IS NOT NULL AND q.prompt_skeleton->>'solution_code' IS DISTINCT FROM k.solution_code)
      OR (k.hints <> '{}'::jsonb AND q.prompt_skeleton->'hints' IS DISTINCT FROM k.hints);
  RAISE NOTICE '[00005 rollback] quests 로 복원하지 못한 정답 %', v_missing;
  IF v_missing > 0 THEN
    RAISE EXCEPTION '[00005 rollback] 복원 검증 실패. 전체 롤백합니다.';
  END IF;
END $$;
