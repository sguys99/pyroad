-- ============================================================
-- 정답 데이터 분리 ③: quests 에서 정답 제거 + 백스톱 CHECK (Idempotent)   (P1-02, B07)
-- 릴리즈 단계: ③ 회수형 (새 앱 배포·동작 확인 뒤에만 적용)
--
-- 전제: 00004 적용 + quest_answer_keys 를 먼저 읽고 없으면 quests 로 폴백하는 앱(P1-02)이 배포됨.
--   이전 앱은 quests 에서 정답을 읽으므로 이 파일을 먼저 적용하면 채점·힌트·황금키가 깨집니다.
--
-- 하는 일
--   1. 분리 트리거를 'move' 모드로 바꿈: 이후 quests 에 정답이 들어와도(현재 seed.sql 재실행 등)
--      quest_answer_keys 로 옮기고 quests 에서는 지움
--   2. quests 의 정답 필드 제거 (expected_output = '', prompt_skeleton 의 hints·solution_code·steps[] 정답 키 삭제)
--   3. 자기 검증: quest_answer_keys 의 개수가 바뀌거나 quests 에 정답이 남으면 예외 → 전체 롤백
--   4. 백스톱 CHECK: 트리거가 꺼져도 quests 에 정답이 저장되지 않음
--
-- 적용 후 NOTICE `[00005] expected_output 44→44, hints 44→44, solution_code 43→43, steps 1→1, quests에 남은 정답 0` 확인
-- 확인: 로그인 사용자로 GET /rest/v1/quests?select=id,expected_output 에 정답이 없음 (supabase/tests B07-2·B07-3)
-- 되돌리기: supabase/rollback/00005_quest_answer_keys_strip.rollback.sql (정답을 quests 로 복원)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 트리거를 'move' 모드로
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_quests_split_answer_fields ON public.quests;
CREATE TRIGGER trg_quests_split_answer_fields
  BEFORE INSERT OR UPDATE OF prompt_skeleton, expected_output ON public.quests
  FOR EACH ROW EXECUTE FUNCTION public.quests_split_answer_fields('move');

-- ------------------------------------------------------------
-- 2·3. quests 에서 정답 제거 + 자기 검증
--    quests 를 "자기 자신으로 UPDATE" → 트리거가 quest_answer_keys 에 병합(00004 와 같은 값)하고 quests 에서 지움
-- ------------------------------------------------------------
DO $$
DECLARE
  v_before_expected INT;
  v_before_hints    INT;
  v_before_solution INT;
  v_before_steps    INT;
  v_after_expected  INT;
  v_after_hints     INT;
  v_after_solution  INT;
  v_after_steps     INT;
  v_left            INT;
BEGIN
  SELECT
    count(*) FILTER (WHERE q.expected_output <> '' OR k.expected_output <> ''),
    count(*) FILTER (WHERE COALESCE(q.prompt_skeleton->'hints', '{}'::jsonb) NOT IN ('{}'::jsonb, 'null'::jsonb) OR k.hints <> '{}'::jsonb),
    count(*) FILTER (WHERE COALESCE(q.prompt_skeleton->>'solution_code', '') <> '' OR k.solution_code IS NOT NULL),
    count(*) FILTER (WHERE jsonb_path_exists(q.prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints) || exists(@.solution_code))')
                        OR jsonb_array_length(COALESCE(k.steps, '[]'::jsonb)) > 0)
  INTO v_before_expected, v_before_hints, v_before_solution, v_before_steps
  FROM public.quests q
  LEFT JOIN public.quest_answer_keys k ON k.quest_id = q.id;

  UPDATE public.quests
     SET prompt_skeleton = prompt_skeleton,
         expected_output = expected_output
   WHERE expected_output <> ''
      OR prompt_skeleton ?| ARRAY['hints', 'solution_code']
      OR jsonb_path_exists(prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints) || exists(@.solution_code))');

  SELECT
    count(*) FILTER (WHERE expected_output <> ''),
    count(*) FILTER (WHERE hints <> '{}'::jsonb),
    count(*) FILTER (WHERE solution_code IS NOT NULL),
    count(*) FILTER (WHERE jsonb_array_length(steps) > 0)
  INTO v_after_expected, v_after_hints, v_after_solution, v_after_steps
  FROM public.quest_answer_keys;

  SELECT count(*) INTO v_left
    FROM public.quests
   WHERE expected_output <> ''
      OR prompt_skeleton ?| ARRAY['hints', 'solution_code']
      OR jsonb_path_exists(prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints) || exists(@.solution_code))');

  RAISE NOTICE '[00005] expected_output %→%, hints %→%, solution_code %→%, steps %→%, quests에 남은 정답 %',
    v_before_expected, v_after_expected, v_before_hints, v_after_hints,
    v_before_solution, v_after_solution, v_before_steps, v_after_steps, v_left;

  IF v_left > 0
     OR v_after_expected <> v_before_expected
     OR v_after_hints    <> v_before_hints
     OR v_after_solution <> v_before_solution
     OR v_after_steps    <> v_before_steps THEN
    RAISE EXCEPTION '[00005] 정답 제거 검증 실패 (위 NOTICE 참고). 전체 롤백합니다.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. 백스톱 CHECK: 트리거를 끄거나 지워도 quests 에 정답이 저장되지 않음
--    (CHECK 는 BEFORE 트리거 다음에 평가되므로 트리거가 정상이면 항상 통과)
--    퀴즈(P7-01): 정답 표시용 키(is_correct, accepted, solution_code)는 어느 깊이에도 두지 못함
-- ------------------------------------------------------------
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_no_answer_fields;
ALTER TABLE public.quests ADD CONSTRAINT quests_no_answer_fields CHECK (
  expected_output = ''
  AND NOT (prompt_skeleton ?| ARRAY['hints', 'solution_code'])
  AND NOT jsonb_path_exists(prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints))')
  AND NOT jsonb_path_exists(prompt_skeleton, 'lax $.** ? (exists(@.solution_code) || exists(@.is_correct) || exists(@.accepted))')
);

COMMENT ON COLUMN public.quests.expected_output IS
  'DEPRECATED (00005): 항상 빈 문자열. 정답은 quest_answer_keys.expected_output. P1-12(콘텐츠 빌드 전환) 후 컬럼 삭제.';
