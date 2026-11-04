-- ============================================================
-- [DRAFT · P0-08 스파이크] 00003: 정답 데이터 분리 (quest_answer_keys)
-- 대상 작업: P1-02 (B07), 이후 P7-01·P7-02 퀴즈 정답 저장소
--
-- 하는 일
--   1. quest_answer_keys 테이블 생성 (RLS ON + 정책 없음 + anon/authenticated 권한 전부 회수)
--      → service_role(BYPASSRLS)만 읽고 쓸 수 있음
--   2. quests 에 남아 있는 정답을 옮김 (멱등)
--        quests.expected_output                         → expected_output
--        quests.prompt_skeleton.hints                   → hints
--        quests.prompt_skeleton.solution_code           → solution_code
--        quests.prompt_skeleton.steps[].expected_output → steps[].expected_output
--        quests.prompt_skeleton.steps[].hints           → steps[].hints
--        quests.prompt_skeleton.steps[].solution_code   → steps[].solution_code
--   3. quests 쪽 원본 제거 (expected_output = '', jsonb 키 삭제)
--   4. 분리 트리거: 이후 quests 에 정답이 섞여 들어오면(현재 seed.sql 재실행 등)
--      자동으로 quest_answer_keys 로 옮기고 quests 에서는 지움
--   5. CHECK 제약(백스톱): 트리거가 꺼져도 quests 에 정답이 저장되지 않음
--   6. 자기 검증: 옮긴 개수가 맞지 않거나 quests 에 정답이 남아 있으면 예외 → 전체 롤백
--
-- 적용 방법
--   - 한 트랜잭션으로 실행해야 함: `supabase db push` / `supabase db reset` (파일 단위 트랜잭션)
--     또는 `psql -1 -v ON_ERROR_STOP=1 -f 00003_...sql`
--   - 앱 배포 순서 (무중단): ① 정답을 quest_answer_keys 에서 먼저 읽고 없으면 quests 로 폴백하는
--     앱 코드 배포 → ② 이 마이그레이션 적용 → ③ 폴백 코드 제거
--   - 되돌리기: 00003_quest_answer_keys.rollback.draft.sql
--
-- 운영 DB 전제
--   - 운영 프로젝트는 "새 테이블 자동 노출(legacy default privileges)" 상태로 추정됨
--     (B03 재현 시 anon 이 뷰를 읽음). 그래서 새 테이블은 anon/authenticated 에게 ALL 이
--     자동 부여되므로 아래 REVOKE 가 반드시 필요. 신규(자동 노출 꺼짐) 프로젝트에서도
--     이 파일은 같은 결과를 냄 (GRANT/REVOKE 를 명시하므로 환경과 무관).
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
  -- 코드 퀘스트: output_match / contains 검증 기준
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
  '이 테이블을 참조하는 뷰나 anon/authenticated 가 실행할 수 있는 SECURITY DEFINER 함수를 만들지 말 것.';

-- ------------------------------------------------------------
-- 2. 접근 제어: service_role 전용
--    RLS ON + 정책 없음 → anon/authenticated 는 권한이 있어도 0행.
--    여기에 더해 테이블 권한 자체를 회수 → PostgREST 가 42501(permission denied)로 거부.
--    (권한 회수만 하거나 RLS 만 켜는 경우보다 실수에 강함: 둘 중 하나가 풀려도 다른 하나가 막음)
-- ------------------------------------------------------------
ALTER TABLE public.quest_answer_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quest_answer_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quest_answer_keys TO service_role;

-- ------------------------------------------------------------
-- 3. 분리 트리거 함수
--    quests 에 정답 필드가 들어오면 quest_answer_keys 로 병합(upsert)하고 quests 에서 제거.
--    - 들어온 필드만 덮어씀 (seed 재실행처럼 solution_code 가 없는 데이터가 와도 기존 solution_code 유지)
--    - INSERT ... ON CONFLICT DO UPDATE: BEFORE INSERT 에서 이미 지운 EXCLUDED 가 UPDATE 로 다시
--      들어오므로 두 번째 호출에서는 아무것도 쓰지 않음
--    - SECURITY INVOKER (기본값): quests 를 쓰는 주체(postgres, service_role)는 정답 테이블 권한이 있음.
--      authenticated 는 quests 쓰기 정책이 없으므로 이 트리거에 도달하지 못함
--    - RETURNS trigger 함수는 PostgREST RPC 로 노출되지 않음
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quests_split_answer_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
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

    v_sk := jsonb_set(
      v_sk, '{steps}',
      (SELECT COALESCE(jsonb_agg(s - 'expected_output' - 'hints' - 'solution_code' ORDER BY ord), '[]'::jsonb)
         FROM jsonb_array_elements(v_sk->'steps') WITH ORDINALITY AS t(s, ord)));
  END IF;

  NEW.prompt_skeleton := v_sk - 'hints' - 'solution_code';
  NEW.expected_output := '';

  IF v_hints IS NULL AND v_solution IS NULL AND v_expected IS NULL AND v_steps IS NULL THEN
    RETURN NEW;  -- 옮길 정답 없음
  END IF;

  INSERT INTO public.quest_answer_keys AS k (quest_id, expected_output, hints, solution_code, steps)
  VALUES (NEW.id, COALESCE(v_expected, ''), COALESCE(v_hints, '{}'::jsonb), v_solution, COALESCE(v_steps, '[]'::jsonb))
  ON CONFLICT (quest_id) DO UPDATE SET
    expected_output = COALESCE(v_expected, k.expected_output),
    hints           = COALESCE(v_hints, k.hints),
    solution_code   = COALESCE(v_solution, k.solution_code),
    -- 단계는 step_number 기준으로 병합 (기존 || 새 값)
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

REVOKE ALL ON FUNCTION public.quests_split_answer_fields() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 4. 기존 데이터 이동 + 자기 검증
--    트리거를 먼저 만들고, quests 를 "자기 자신으로 UPDATE" 해서 트리거가 옮기게 함.
--    (트리거 로직 하나로 기존 데이터·seed 재실행·이후 콘텐츠 입력을 모두 처리)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_quests_split_answer_fields ON public.quests;
CREATE TRIGGER trg_quests_split_answer_fields
  BEFORE INSERT OR UPDATE OF prompt_skeleton, expected_output ON public.quests
  FOR EACH ROW EXECUTE FUNCTION public.quests_split_answer_fields();

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
  -- 이동 전 개수 (이미 옮겨진 행 포함: 재실행 시에도 같은 결과가 나와야 함)
  SELECT
    count(*) FILTER (WHERE q.expected_output <> '' OR k.expected_output <> ''),
    count(*) FILTER (WHERE COALESCE(q.prompt_skeleton->'hints', '{}'::jsonb) NOT IN ('{}'::jsonb, 'null'::jsonb) OR k.hints <> '{}'::jsonb),
    count(*) FILTER (WHERE COALESCE(q.prompt_skeleton->>'solution_code', '') <> '' OR k.solution_code IS NOT NULL),
    count(*) FILTER (WHERE jsonb_path_exists(q.prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints) || exists(@.solution_code))')
                        OR jsonb_array_length(COALESCE(k.steps, '[]'::jsonb)) > 0)
  INTO v_before_expected, v_before_hints, v_before_solution, v_before_steps
  FROM public.quests q
  LEFT JOIN public.quest_answer_keys k ON k.quest_id = q.id;

  -- 트리거가 정답을 옮기고 quests 에서 지움
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

  RAISE NOTICE '[00003] expected_output %→%, hints %→%, solution_code %→%, steps %→%, quests에 남은 정답 %',
    v_before_expected, v_after_expected, v_before_hints, v_after_hints,
    v_before_solution, v_after_solution, v_before_steps, v_after_steps, v_left;

  IF v_left > 0
     OR v_after_expected <> v_before_expected
     OR v_after_hints    <> v_before_hints
     OR v_after_solution <> v_before_solution
     OR v_after_steps    <> v_before_steps THEN
    RAISE EXCEPTION '[00003] 정답 이동 검증 실패 (위 NOTICE 참고). 전체 롤백합니다.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. 백스톱 CHECK: 트리거를 끄거나 지워도 quests 에 정답이 저장되지 않음
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
  'DEPRECATED (00003): 항상 빈 문자열. 정답은 quest_answer_keys.expected_output. P1-12(seed 생성기 전환) 후 컬럼 삭제.';
