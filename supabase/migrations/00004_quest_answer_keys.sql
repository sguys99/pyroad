-- ============================================================
-- 정답 데이터 분리 ①: quest_answer_keys 테이블 + 정답 복사 (Idempotent)   (P1-02, B07·B08)
-- 릴리즈 단계: ① 추가형 (지금 운영 중인 이전 앱이 그대로 동작함)
--
-- 하는 일
--   1. quest_answer_keys 테이블 생성 (RLS ON + 정책 없음 + anon/authenticated 권한 전부 회수)
--      → service_role(BYPASSRLS)만 읽고 씀
--   2. 분리 트리거 함수 quests_split_answer_fields(mode) 와 트리거('copy' 모드)
--      quests 에 정답 필드가 들어오면 quest_answer_keys 로 병합(upsert)합니다.
--        quests.expected_output                         → expected_output
--        quests.prompt_skeleton.hints                   → hints
--        quests.prompt_skeleton.solution_code           → solution_code
--        quests.prompt_skeleton.steps[].expected_output → steps[].expected_output
--        quests.prompt_skeleton.steps[].hints           → steps[].hints
--        quests.prompt_skeleton.steps[].solution_code   → steps[].solution_code
--      'copy' 모드는 quests 에 원본을 남깁니다. 이전 앱이 quests 에서 정답을 읽기 때문입니다.
--      quests 에서 지우는 일('move' 모드 + CHECK 제약)은 새 앱 배포 뒤 ③ 00005 가 합니다.
--   3. 기존 정답을 복사하고 자기 검증 (개수가 맞지 않으면 예외 → 전체 롤백)
--
-- 운영 적용 순서 (Phase 1 릴리즈, §12-Q21)
--   ① 이 파일 → ② quest_answer_keys 를 먼저 읽고 없으면 quests 로 폴백하는 앱 배포
--   → ③ 00005_quest_answer_keys_strip.sql (quests 에서 정답 제거)
--   적용 후 NOTICE `[00004] expected_output 44→44, hints 44→44, solution_code 43→43, steps 1→1` 확인
--   (운영 2026-11-04 기준값, docs/4.upgrade-plan.md "6번 정답 데이터")
--
-- 운영 DB 전제: legacy 기본 권한(새 테이블이 만들자마자 anon 에게 ALL)이므로 아래 REVOKE 가 반드시 필요.
--   신규 기본값 환경에서도 GRANT/REVOKE 를 명시하므로 같은 결과가 됩니다.
-- 되돌리기: supabase/rollback/00004_quest_answer_keys.rollback.sql (00005 를 먼저 되돌려야 함)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 출발점: spikes/p0-08-answer-keys/00003_quest_answer_keys.draft.sql (P0-08)
-- ============================================================

-- ------------------------------------------------------------
-- 1. 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quest_answer_keys (
  -- DEFERRABLE: 분리 트리거가 quests INSERT 의 BEFORE 단계(부모 행이 아직 없음)에서
  --             정답 행을 먼저 쓰기 때문에 FK 검사를 커밋 시점으로 미룸
  quest_id        UUID PRIMARY KEY
                  REFERENCES public.quests(id) ON DELETE CASCADE
                  DEFERRABLE INITIALLY DEFERRED,
  -- 코드 퀘스트: output_match / contains / code_check 검증 기준
  expected_output TEXT  NOT NULL DEFAULT '',
  -- 단계별 힌트 원문 {"level_1": "...", "level_2": "...", "level_3": "..."}
  hints           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 황금키 정답 코드 (코드 퀘스트)
  solution_code   TEXT,
  -- 프로젝트 퀘스트 단계별 정답 [{"step_number":1,"expected_output":"...","hints":{...},"solution_code":"..."}]
  steps           JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- 퀴즈 정답 (P7-01). 채점은 accepted 중 하나와 "정확히 같은지"(jsonb =)로 판정
  --   multiple_choice: {"kind":"multiple_choice","accepted":["opt_k2"],"explanations":{"opt_k2":"...","_default":"..."}}
  --   fill_blank:      {"kind":"fill_blank","accepted":[["tok_range"]],...}           -- 빈칸 순서대로 토큰 id 배열
  --   parsons:         {"kind":"parsons","accepted":[["ln_x","ln_q","ln_m"]],...}     -- 정답 줄 순서(여러 정답 허용)
  --   bug_hunt:        {"kind":"bug_hunt","accepted":[{"line":"ln_q","fix":"fx_2"}],...}
  quiz_answer     JSONB,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quest_answer_keys_hints_is_object CHECK (jsonb_typeof(hints) = 'object'),
  CONSTRAINT quest_answer_keys_steps_is_array  CHECK (jsonb_typeof(steps) = 'array'),
  CONSTRAINT quest_answer_keys_quiz_answer_shape CHECK (
    quiz_answer IS NULL OR (
      jsonb_typeof(quiz_answer) = 'object'
      AND quiz_answer->>'kind' IN ('multiple_choice', 'fill_blank', 'parsons', 'bug_hunt')
      AND jsonb_typeof(quiz_answer->'accepted') = 'array'
      AND jsonb_array_length(quiz_answer->'accepted') > 0
    )
  )
);

COMMENT ON TABLE public.quest_answer_keys IS
  '퀘스트 정답·힌트·solution_code·퀴즈 정답. service_role 전용 (RLS ON, 정책 없음, anon/authenticated 권한 없음). '
  '앱은 src/lib/quest/answerKeys.ts 한 곳에서만 읽음. '
  '이 테이블을 참조하는 뷰나 anon/authenticated 가 실행할 수 있는 SECURITY DEFINER 함수를 만들지 말 것.';

-- ------------------------------------------------------------
-- 2. 접근 제어: service_role 전용
--    RLS ON + 정책 없음 → anon/authenticated 는 권한이 있어도 0행.
--    여기에 더해 테이블 권한 자체를 회수 → PostgREST 가 42501(permission denied)로 거부.
--    (둘 중 하나가 실수로 풀려도 다른 하나가 막음)
--    service_role 은 두 기본값 환경에서 같은 결과가 되도록 ALL 을 명시 (00003 과 같은 방식)
-- ------------------------------------------------------------
ALTER TABLE public.quest_answer_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quest_answer_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.quest_answer_keys TO service_role;

-- ------------------------------------------------------------
-- 3. 분리 트리거 함수 quests_split_answer_fields()
--    트리거 인자(TG_ARGV[0])로 동작을 고릅니다.
--      'copy' (이 파일, ①): quest_answer_keys 로 병합하고 quests 의 원본은 그대로 둠
--      'move' (00005, ③):   병합한 뒤 quests 에서 정답 필드를 지움
--    병합 규칙 (두 모드 같음)
--    - 들어온 필드만 덮어씀: seed 재실행처럼 solution_code 가 없는 데이터가 와도 기존 solution_code 유지
--    - hints 는 키 단위로 합침 (기존 || 새 값): level_3 하나만 고치는 보정도 나머지 단계를 지우지 않음
--    - steps 는 step_number 기준으로 단계마다 합침 (기존 단계 || 새 단계)
--    - INSERT ... ON CONFLICT DO UPDATE: 'move' 에서는 BEFORE INSERT 가 이미 지운 EXCLUDED 가
--      UPDATE 로 다시 들어오므로 두 번째 호출은 아무것도 쓰지 않음
--    - SECURITY INVOKER (기본값): quests 를 쓰는 주체(postgres, service_role)는 정답 테이블 권한이 있음.
--      authenticated 는 quests 쓰기 정책이 없어 정답 테이블에 쓸 수 없음 (권한이 없어 오류)
--    - RETURNS trigger 함수는 PostgREST RPC 로 노출되지 않음
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quests_split_answer_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_move     BOOLEAN := COALESCE(TG_ARGV[0], 'copy') = 'move';
  v_sk       JSONB := COALESCE(NEW.prompt_skeleton, '{}'::jsonb);
  v_hints    JSONB := NULLIF(NULLIF(v_sk->'hints', 'null'::jsonb), '{}'::jsonb);
  v_solution TEXT  := NULLIF(v_sk->>'solution_code', '');
  v_expected TEXT  := NULLIF(NEW.expected_output, '');
  v_steps    JSONB;  -- 이번에 들어온 단계별 정답 (없으면 NULL)
BEGIN
  IF jsonb_typeof(v_sk->'steps') = 'array' THEN
    SELECT jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'step_number',     s->'step_number',
               'expected_output', s->'expected_output',
               'hints',           s->'hints',
               'solution_code',   s->'solution_code'))
             ORDER BY ord)
      INTO v_steps
      FROM jsonb_array_elements(v_sk->'steps') WITH ORDINALITY AS t(s, ord)
     WHERE s ?| ARRAY['expected_output', 'hints', 'solution_code'];

    IF v_move THEN
      v_sk := jsonb_set(
        v_sk, '{steps}',
        (SELECT COALESCE(jsonb_agg(s - 'expected_output' - 'hints' - 'solution_code' ORDER BY ord), '[]'::jsonb)
           FROM jsonb_array_elements(v_sk->'steps') WITH ORDINALITY AS t(s, ord)));
    END IF;
  END IF;

  IF v_move THEN
    NEW.prompt_skeleton := v_sk - 'hints' - 'solution_code';
    NEW.expected_output := '';
  END IF;

  IF v_hints IS NULL AND v_solution IS NULL AND v_expected IS NULL AND v_steps IS NULL THEN
    RETURN NEW;  -- 옮길 정답 없음
  END IF;

  INSERT INTO public.quest_answer_keys AS k (quest_id, expected_output, hints, solution_code, steps)
  VALUES (NEW.id, COALESCE(v_expected, ''), COALESCE(v_hints, '{}'::jsonb), v_solution, COALESCE(v_steps, '[]'::jsonb))
  ON CONFLICT (quest_id) DO UPDATE SET
    expected_output = COALESCE(v_expected, k.expected_output),
    hints           = k.hints || COALESCE(v_hints, '{}'::jsonb),
    solution_code   = COALESCE(v_solution, k.solution_code),
    steps = CASE WHEN v_steps IS NULL THEN k.steps ELSE (
      SELECT COALESCE(jsonb_agg(COALESCE(e.s, '{}'::jsonb) || COALESCE(i.s, '{}'::jsonb)
                                ORDER BY COALESCE(e.n, i.n)), '[]'::jsonb)
        FROM (SELECT (x->>'step_number')::int AS n, x AS s FROM jsonb_array_elements(k.steps) x) e
        FULL JOIN (SELECT (x->>'step_number')::int AS n, x AS s FROM jsonb_array_elements(v_steps) x) i
          ON e.n = i.n
    ) END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.quests_split_answer_fields() IS
  'quests 에 들어온 정답 필드를 quest_answer_keys 로 병합. 트리거 인자 copy(00004, 원본 유지) | move(00005, quests 에서 제거). P1-12 콘텐츠 빌드 전환 후 삭제';

REVOKE ALL ON FUNCTION public.quests_split_answer_fields() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 4. 트리거 ('copy')
--    이미 있으면 건드리지 않음: 00005 가 'move' 로 바꾼 뒤 이 파일을 다시 실행해도 'copy' 로 되돌아가지 않게.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.quests'::regclass
       AND tgname = 'trg_quests_split_answer_fields'
  ) THEN
    CREATE TRIGGER trg_quests_split_answer_fields
      BEFORE INSERT OR UPDATE OF prompt_skeleton, expected_output ON public.quests
      FOR EACH ROW EXECUTE FUNCTION public.quests_split_answer_fields('copy');
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. 기존 데이터 복사 + 자기 검증
--    quests 를 "자기 자신으로 UPDATE" 해서 트리거가 복사하게 함
--    (트리거 로직 하나로 기존 데이터·seed 재실행·이후 콘텐츠 입력을 모두 처리)
--    검증: 정답이 있는 퀘스트 수가 quests(또는 이미 옮긴 quest_answer_keys)와 quest_answer_keys 에서 같고,
--          quests 에 남아 있는 정답이 quest_answer_keys 와 다르지 않음
--    새 DB(migrations → seed)에서는 quests 가 비어 있어 0→0 입니다. seed 의 정답은 트리거가 옮깁니다.
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
  v_mismatch        INT;
BEGIN
  -- 복사 전 개수 (이미 옮겨진 행 포함: 재실행·00005 적용 후에도 같은 결과가 나와야 함)
  SELECT
    count(*) FILTER (WHERE q.expected_output <> '' OR k.expected_output <> ''),
    count(*) FILTER (WHERE COALESCE(q.prompt_skeleton->'hints', '{}'::jsonb) NOT IN ('{}'::jsonb, 'null'::jsonb) OR k.hints <> '{}'::jsonb),
    count(*) FILTER (WHERE COALESCE(q.prompt_skeleton->>'solution_code', '') <> '' OR k.solution_code IS NOT NULL),
    count(*) FILTER (WHERE jsonb_path_exists(q.prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints) || exists(@.solution_code))')
                        OR jsonb_array_length(COALESCE(k.steps, '[]'::jsonb)) > 0)
  INTO v_before_expected, v_before_hints, v_before_solution, v_before_steps
  FROM public.quests q
  LEFT JOIN public.quest_answer_keys k ON k.quest_id = q.id;

  -- 트리거('copy' 또는 00005 이후 'move')가 정답을 quest_answer_keys 로 병합
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

  -- quests 에 남은 정답(①만 적용된 상태)이 quest_answer_keys 와 같은지
  SELECT count(*) INTO v_mismatch
    FROM public.quests q
    LEFT JOIN public.quest_answer_keys k ON k.quest_id = q.id
   WHERE (q.expected_output <> '' AND q.expected_output IS DISTINCT FROM k.expected_output)
      OR (jsonb_typeof(q.prompt_skeleton->'hints') = 'object'
          AND NOT (COALESCE(k.hints, '{}'::jsonb) @> (q.prompt_skeleton->'hints')))
      OR (q.prompt_skeleton ? 'solution_code' AND q.prompt_skeleton->>'solution_code' IS DISTINCT FROM k.solution_code);

  RAISE NOTICE '[00004] expected_output %→%, hints %→%, solution_code %→%, steps %→%, 불일치 %',
    v_before_expected, v_after_expected, v_before_hints, v_after_hints,
    v_before_solution, v_after_solution, v_before_steps, v_after_steps, v_mismatch;

  IF v_mismatch > 0
     OR v_after_expected <> v_before_expected
     OR v_after_hints    <> v_before_hints
     OR v_after_solution <> v_before_solution
     OR v_after_steps    <> v_before_steps THEN
    RAISE EXCEPTION '[00004] 정답 복사 검증 실패 (위 NOTICE 참고). 전체 롤백합니다.';
  END IF;
END $$;
