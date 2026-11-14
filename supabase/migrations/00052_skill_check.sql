-- ============================================================
-- 실력 확인 퀴즈로 다음 월드 건너뛰기 (Idempotent)   (P10-03, §12-Q2·Q72 ②·Q73, docs/curriculum/world2.md §7·§8)
-- 릴리즈 단계: ① 추가형 (새 테이블 2개·새 함수 3개 · is_stage_unlocked 에 "실력 확인 퀴즈 합격" OR 추가.
--                       이전 앱은 새 객체를 읽지 않고, 합격 기록이 없으면 잠금 결과도 같음)
--
-- 월드 해제 규칙 (worlds.unlock_rule = previous_world_cleared, §12-Q2)
--   월드의 첫 스테이지는 앞 월드의 마지막 스테이지를 클리어하면 열림 — 1월드는 7단계 "프로젝트 왕국"(프로젝트 + 최종 보스, Q69)
--   = 이전 월드의 최종 프로젝트 완료. 지금까지처럼 스테이지를 (월드 order, 스테이지 order) 한 줄로 이어 "앞 스테이지 클리어"로 셈
--   여기에 OR: 그 월드의 실력 확인 퀴즈에 합격했으면 그 월드의 첫 스테이지가 열림 (뒤 스테이지는 평소처럼 앞 스테이지를 깨야 열림)
--   TS 사본: src/lib/world/getStageStatuses.ts (skillPassWorldIds)
--
-- 실력 확인 퀴즈
--   문제: 월드마다 문제 묶음(set) n벌 × 10문제. 원본 content/worlds/<slug>/skill-check.yaml → content:build → seed
--   하루 묶음: KST 날짜로 번갈아 (skill_check_set_for) · 하루 1번 (시작하면 그날 도전을 씀, 같은 날 다시 열면 같은 묶음 이어 풀기)
--   채점: 서버만 · 합격 = 맞힌 수 ≥ ceil(문제 수 × 0.8) (10문제면 8) · 정답·해설은 응답에 없음 (틀린 문제의 복습 스테이지만)
--   보상: XP·코인 없음. 합격 기록(skill_check_attempts.passed)만 — 업적 "실력 인정"은 P10-11 이 이 행을 보고 줌
--
-- 하는 일
--   1. skill_check_questions: 문제(공개 quiz + 정답 answer, review_quest_id). service_role 전용(RLS ON, 정책 없음) — 정답이 있어 학생은 못 읽음
--   2. skill_check_attempts: 사용자·월드·KST 날짜마다 한 행 (하루 1번). 본인 읽기만(합격·오늘 도전 표시), 쓰기는 RPC 만
--   3. skill_check_set_for(date, int): 그날의 묶음 번호 (IMMUTABLE, service_role)
--   4. skill_check_start(user, world) → jsonb (SECURITY DEFINER, service_role 전용: /api/world/skill-check)
--   5. skill_check_submit(user, world, answers) → jsonb (SECURITY DEFINER, service_role 전용)
--   6. is_stage_unlocked: 00046 + 실력 확인 퀴즈 합격이면 그 월드의 첫 스테이지 열림
--   7. 권한 + 자기 검증
--
-- skill_check_start 반환 { status, set_no, attempt_on, score, total, passed, practice }
--   status: ready(오늘 묶음 풀기 — 처음이면 오늘 도전을 씀) · done(오늘 이미 제출) · open(이미 열린 월드 — 합격했거나 앞 월드를 깸)
--   오류 (message): invalid_arguments · user_not_found · world_not_found(PT404) · skill_check_missing(PT404, 문제 없음·스테이지 없는 월드)
-- skill_check_submit 반환 { score, total, pass_score, passed, practice: [{quest_id, stage_id, stage_order, stage_title, world_slug}], first_stage_id }
--   practice: 틀린 문제의 복습 퀘스트가 있는 스테이지 (스테이지마다 한 번, (월드, 스테이지) 순서). 어떤 문제를 틀렸는지·정답은 없음
--   오류: invalid_arguments · answer_too_large(PT413) · user_not_found · world_not_found · skill_check_missing
--         skill_check_not_started(PT409, 오늘 시작 안 함 — 자정이 지남) · skill_check_done_today(PT409)
--
-- 적용 후 NOTICE `[00052] 실력 확인 퀴즈: skill_check_start·submit service_role 전용, 문제 잠김, 도전 기록 본인 읽기만` 확인
-- 확인: supabase/tests SKC-1(권한)·SKC-2(하루 1번·번갈이·채점·해제)
-- 되돌리기: supabase/rollback/00052_skill_check.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. skill_check_questions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skill_check_questions (
  world_id        UUID     NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  set_no          SMALLINT NOT NULL,
  no              SMALLINT NOT NULL,
  review_quest_id UUID     NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  quiz            JSONB    NOT NULL,
  answer          JSONB    NOT NULL,
  PRIMARY KEY (world_id, set_no, no),
  CONSTRAINT skill_check_questions_set_range CHECK (set_no BETWEEN 1 AND 9),
  CONSTRAINT skill_check_questions_no_range  CHECK (no BETWEEN 1 AND 20),
  CONSTRAINT skill_check_questions_shape CHECK (
    jsonb_typeof(quiz) = 'object'
    AND quiz->>'kind' IN ('multiple_choice', 'fill_blank', 'parsons', 'bug_hunt')
    AND answer->>'kind' = quiz->>'kind'
    AND jsonb_typeof(answer->'accepted') = 'array'
    AND jsonb_array_length(answer->'accepted') > 0
    AND NOT (quiz ? 'accepted')
  )
);

CREATE INDEX IF NOT EXISTS skill_check_questions_review_quest_idx ON public.skill_check_questions (review_quest_id);

COMMENT ON TABLE public.skill_check_questions IS
  '실력 확인 퀴즈 문제 (P10-03). quiz = 공개 모양(퀴즈와 같음), answer = 정답(accepted·해설). service_role 전용 — 원본 content/worlds/<slug>/skill-check.yaml';

ALTER TABLE public.skill_check_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.skill_check_questions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.skill_check_questions TO service_role;

-- ------------------------------------------------------------
-- 2. skill_check_attempts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skill_check_attempts (
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  world_id     UUID        NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  attempt_on   DATE        NOT NULL DEFAULT public.kst_today(),
  set_no       SMALLINT    NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score        SMALLINT,
  total        SMALLINT,
  passed       BOOLEAN     NOT NULL DEFAULT false,
  -- 더 연습하면 좋은 스테이지 (skill_check_submit 반환의 practice 그대로, 같은 날 다시 열면 결과 화면에 다시 보여 줌)
  practice     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (user_id, world_id, attempt_on),
  CONSTRAINT skill_check_attempts_result CHECK (
    (submitted_at IS NULL AND score IS NULL AND total IS NULL AND NOT passed)
    OR (submitted_at IS NOT NULL AND score BETWEEN 0 AND total AND total > 0)
  )
);

CREATE INDEX IF NOT EXISTS skill_check_attempts_world_idx ON public.skill_check_attempts (world_id);
-- is_stage_unlocked 가 찾는 합격 행
CREATE INDEX IF NOT EXISTS skill_check_attempts_passed_idx ON public.skill_check_attempts (user_id, world_id) WHERE passed;

COMMENT ON TABLE public.skill_check_attempts IS
  '실력 확인 퀴즈 도전 (P10-03). 사용자·월드·KST 날짜마다 한 행(하루 1번). passed = 합격 → 그 월드 첫 스테이지 열림(is_stage_unlocked), 업적 "실력 인정"(P10-11)의 근거. 본인 읽기만, 쓰기는 skill_check_start·submit';

ALTER TABLE public.skill_check_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.skill_check_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.skill_check_attempts TO authenticated;
GRANT ALL ON TABLE public.skill_check_attempts TO service_role;

DROP POLICY IF EXISTS "skill_check_attempts_select_own" ON public.skill_check_attempts;
CREATE POLICY "skill_check_attempts_select_own" ON public.skill_check_attempts
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- 3. skill_check_set_for: KST 날짜 → 묶음 번호 1..n (날마다 번갈아)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.skill_check_set_for(p_day DATE, p_sets INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN p_sets IS NULL OR p_sets < 1 THEN 1
              ELSE (((p_day - DATE '2026-01-01') % p_sets) + p_sets) % p_sets + 1 END
$$;

COMMENT ON FUNCTION public.skill_check_set_for(DATE, INTEGER) IS
  '실력 확인 퀴즈 그날의 묶음 번호 (P10-03): 2026-01-01 부터 센 날짜를 묶음 수로 나눈 나머지 + 1 → 하루씩 번갈아';

-- ------------------------------------------------------------
-- 4. skill_check_start
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.skill_check_start(p_user_id UUID, p_world_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today   DATE := public.kst_today();
  v_first   UUID;
  v_sets    INTEGER;
  v_set     INTEGER;
  v_attempt RECORD;
BEGIN
  IF p_user_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.worlds w WHERE w.id = p_world_id) THEN
    RAISE EXCEPTION 'world_not_found' USING ERRCODE = 'PT404';
  END IF;
  -- 같은 사용자의 동시 시작·제출을 한 줄로 (보상 RPC 와 같은 앞 순서: users 먼저)
  PERFORM 1 FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT s.id INTO v_first FROM public.stages s WHERE s.world_id = p_world_id ORDER BY s."order" LIMIT 1;
  SELECT count(DISTINCT q.set_no) INTO v_sets FROM public.skill_check_questions q WHERE q.world_id = p_world_id;
  IF v_first IS NULL OR v_sets = 0 THEN
    RAISE EXCEPTION 'skill_check_missing' USING ERRCODE = 'PT404';
  END IF;

  IF public.is_stage_unlocked(p_user_id, v_first) THEN
    RETURN jsonb_build_object('status', 'open', 'set_no', NULL, 'attempt_on', to_char(v_today, 'YYYY-MM-DD'),
                              'score', NULL, 'total', NULL, 'passed', NULL, 'practice', '[]'::jsonb);
  END IF;

  SELECT a.set_no, a.submitted_at, a.score, a.total, a.passed, a.practice INTO v_attempt
    FROM public.skill_check_attempts a
   WHERE a.user_id = p_user_id AND a.world_id = p_world_id AND a.attempt_on = v_today;
  IF FOUND AND v_attempt.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'done', 'set_no', v_attempt.set_no, 'attempt_on', to_char(v_today, 'YYYY-MM-DD'),
                              'score', v_attempt.score, 'total', v_attempt.total, 'passed', v_attempt.passed,
                              'practice', v_attempt.practice);
  END IF;
  IF FOUND THEN
    v_set := v_attempt.set_no;
  ELSE
    -- 묶음 번호는 실제로 있는 묶음 중에서 (1..n 이 다 있다고 가정하지 않음)
    SELECT x.set_no INTO v_set
      FROM (SELECT DISTINCT q.set_no FROM public.skill_check_questions q WHERE q.world_id = p_world_id) x
     ORDER BY x.set_no
    OFFSET public.skill_check_set_for(v_today, v_sets) - 1
     LIMIT 1;
    INSERT INTO public.skill_check_attempts (user_id, world_id, attempt_on, set_no)
    VALUES (p_user_id, p_world_id, v_today, v_set);
  END IF;
  RETURN jsonb_build_object('status', 'ready', 'set_no', v_set, 'attempt_on', to_char(v_today, 'YYYY-MM-DD'),
                            'score', NULL, 'total', NULL, 'passed', NULL, 'practice', '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.skill_check_start(UUID, UUID) IS
  '실력 확인 퀴즈 시작 (P10-03): 오늘 도전을 쓰고 오늘 묶음 번호를 줌(같은 날 다시 부르면 같은 묶음). service_role 전용: /api/world/skill-check';

-- ------------------------------------------------------------
-- 5. skill_check_submit
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.skill_check_submit(p_user_id UUID, p_world_id UUID, p_answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_max_answers CONSTANT INTEGER := 65536;  -- 바이트 (문제 20개 × 퀴즈 한 답 4096 보다 넉넉히 작게)
  v_today    DATE := public.kst_today();
  v_attempt  RECORD;
  v_q        RECORD;
  v_a        JSONB;
  v_total    INTEGER := 0;
  v_score    INTEGER := 0;
  v_pass     INTEGER;
  v_passed   BOOLEAN;
  v_wrong    UUID[] := '{}';
  v_practice JSONB;
  v_first    UUID;
BEGIN
  IF p_user_id IS NULL OR p_world_id IS NULL OR p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF octet_length(p_answers::text) > c_max_answers THEN
    RAISE EXCEPTION 'answer_too_large' USING ERRCODE = 'PT413';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.worlds w WHERE w.id = p_world_id) THEN
    RAISE EXCEPTION 'world_not_found' USING ERRCODE = 'PT404';
  END IF;
  PERFORM 1 FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT a.set_no, a.submitted_at INTO v_attempt
    FROM public.skill_check_attempts a
   WHERE a.user_id = p_user_id AND a.world_id = p_world_id AND a.attempt_on = v_today
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'skill_check_not_started' USING ERRCODE = 'PT409';
  END IF;
  IF v_attempt.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'skill_check_done_today' USING ERRCODE = 'PT409';
  END IF;

  SELECT count(*) INTO v_total
    FROM public.skill_check_questions q
   WHERE q.world_id = p_world_id AND q.set_no = v_attempt.set_no;
  IF v_total = 0 THEN
    RAISE EXCEPTION 'skill_check_missing' USING ERRCODE = 'PT404';
  END IF;
  IF jsonb_array_length(p_answers) <> v_total THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 문제 no 순서 = 답 배열 순서. 정답 accepted 중 하나와 jsonb = 이면 정답 (퀴즈·보스와 같은 비교, 모양이 틀린 답은 오답)
  FOR v_q IN
    SELECT q.no, q.review_quest_id, q.answer->'accepted' AS accepted,
           row_number() OVER (ORDER BY q.no) - 1 AS idx
      FROM public.skill_check_questions q
     WHERE q.world_id = p_world_id AND q.set_no = v_attempt.set_no
     ORDER BY q.no
  LOOP
    v_a := p_answers -> v_q.idx::int;
    IF v_a IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_q.accepted) AS x(v) WHERE x.v = v_a) THEN
      v_score := v_score + 1;
    ELSE
      v_wrong := v_wrong || v_q.review_quest_id;
    END IF;
  END LOOP;

  v_pass := ceil(v_total * 0.8)::int;
  v_passed := v_score >= v_pass;

  -- 더 연습하면 좋은 스테이지: 틀린 문제의 복습 퀘스트가 있는 스테이지 (스테이지마다 첫 복습 퀘스트 하나)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'quest_id', x.quest_id, 'stage_id', x.stage_id, 'stage_order', x.stage_order,
           'stage_title', x.stage_title, 'world_slug', x.world_slug)
           ORDER BY x.world_order, x.stage_order), '[]'::jsonb)
    INTO v_practice
    FROM (
      SELECT DISTINCT ON (s.id) q.id AS quest_id, s.id AS stage_id, s."order" AS stage_order, s.title AS stage_title,
             w.slug AS world_slug, w."order" AS world_order
        FROM public.quests q
        JOIN public.stages s ON s.id = q.stage_id
        JOIN public.worlds w ON w.id = s.world_id
       WHERE q.id = ANY (v_wrong)
       ORDER BY s.id, q."order"
    ) x;

  UPDATE public.skill_check_attempts
     SET submitted_at = NOW(), score = v_score, total = v_total, passed = v_passed, practice = v_practice
   WHERE user_id = p_user_id AND world_id = p_world_id AND attempt_on = v_today;

  IF v_passed THEN
    SELECT s.id INTO v_first FROM public.stages s WHERE s.world_id = p_world_id ORDER BY s."order" LIMIT 1;
  END IF;
  -- P10-11: 업적 "실력 인정"은 이 합격 행(skill_check_attempts.passed)을 보고 evaluate_achievements 에서 줌. 여기서는 보상 없음

  RETURN jsonb_build_object(
    'score',          v_score,
    'total',          v_total,
    'pass_score',     v_pass,
    'passed',         v_passed,
    'practice',       v_practice,
    'first_stage_id', v_first);
END;
$$;

COMMENT ON FUNCTION public.skill_check_submit(UUID, UUID, JSONB) IS
  '실력 확인 퀴즈 제출·채점 (P10-03): 하루 1번, 정답·해설 없이 점수와 복습 스테이지만. 보상 없음. service_role 전용: /api/world/skill-check';

-- ------------------------------------------------------------
-- 6. is_stage_unlocked: 00046 + 실력 확인 퀴즈 합격이면 그 월드의 첫 스테이지 열림
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_stage_unlocked(p_user_id UUID, p_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH cur AS (
    SELECT w."order" AS world_order, s."order" AS stage_order, s.world_id
      FROM public.stages s
      JOIN public.worlds w ON w.id = s.world_id
     WHERE s.id = p_stage_id
  ),
  prev AS (
    SELECT p.id
      FROM cur
      JOIN public.stages p ON true
      JOIN public.worlds pw ON pw.id = p.world_id
     WHERE (pw."order", p."order") < (cur.world_order, cur.stage_order)
     ORDER BY pw."order" DESC, p."order" DESC
     LIMIT 1
  )
  SELECT NOT EXISTS (SELECT 1 FROM prev)
      OR (
        EXISTS (SELECT 1 FROM public.quests q JOIN prev ON q.stage_id = prev.id
                 WHERE q.quest_type <> 'quiz')
        AND NOT EXISTS (
          SELECT 1
            FROM public.quests q
            JOIN prev ON q.stage_id = prev.id
           WHERE q.quest_type <> 'quiz'
             AND NOT EXISTS (
               SELECT 1 FROM public.user_progress up
                WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed'))
      )
      -- 00046: 이 스테이지나 뒤 스테이지에서 이미 완료한 퀘스트가 있으면 계속 열림 (앞 스테이지에 보스가 새로 생겨도)
      OR EXISTS (
        SELECT 1
          FROM cur
          JOIN public.user_progress up ON up.user_id = p_user_id AND up.status = 'completed'
          JOIN public.quests q ON q.id = up.quest_id
          JOIN public.stages s ON s.id = q.stage_id
          JOIN public.worlds w ON w.id = s.world_id
         WHERE (w."order", s."order") >= (cur.world_order, cur.stage_order)
      )
      -- 00052: 그 월드의 실력 확인 퀴즈에 합격했으면 월드의 첫 스테이지가 열림
      OR EXISTS (
        SELECT 1
          FROM cur
          JOIN public.skill_check_attempts a ON a.user_id = p_user_id AND a.world_id = cur.world_id AND a.passed
         WHERE NOT EXISTS (SELECT 1 FROM public.stages s2
                            WHERE s2.world_id = cur.world_id AND s2."order" < cur.stage_order)
      );
$$;

COMMENT ON FUNCTION public.is_stage_unlocked(UUID, UUID) IS
  '스테이지 잠금 (00012, 00026 퀴즈 제외, 00046 이 스테이지·뒤 스테이지에 완료가 있으면 열림, 00052 실력 확인 퀴즈 합격이면 월드 첫 스테이지 열림). TS 사본 src/lib/world/getStageStatuses.ts';

-- ------------------------------------------------------------
-- 7. 권한 + 자기 검증
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.skill_check_set_for(DATE, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.skill_check_start(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.skill_check_submit(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_stage_unlocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skill_check_set_for(DATE, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.skill_check_start(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.skill_check_submit(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_stage_unlocked(UUID, UUID) TO service_role;

DO $$
BEGIN
  IF public.skill_check_set_for(DATE '2026-11-14', 2) = public.skill_check_set_for(DATE '2026-11-15', 2)
     OR public.skill_check_set_for(DATE '2026-11-14', 2) <> public.skill_check_set_for(DATE '2026-11-16', 2)
     OR public.skill_check_set_for(DATE '2025-12-31', 2) NOT IN (1, 2)
     OR public.skill_check_set_for(DATE '2026-11-14', 1) <> 1 THEN
    RAISE EXCEPTION '[00052] 검증 실패: skill_check_set_for 가 날마다 번갈지 않음';
  END IF;
  IF has_function_privilege('authenticated', 'public.skill_check_start(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.skill_check_start(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.skill_check_submit(uuid, uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.skill_check_submit(uuid, uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.skill_check_set_for(date, integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.skill_check_submit(uuid, uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.is_stage_unlocked(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00052] 검증 실패: skill_check_* · is_stage_unlocked 실행 권한이 service_role 전용이 아님';
  END IF;
  IF has_table_privilege('authenticated', 'public.skill_check_questions', 'SELECT')
     OR has_table_privilege('anon', 'public.skill_check_questions', 'SELECT')
     OR has_table_privilege('anon', 'public.skill_check_attempts', 'SELECT')
     OR has_table_privilege('authenticated', 'public.skill_check_attempts', 'INSERT')
     OR has_table_privilege('authenticated', 'public.skill_check_attempts', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.skill_check_attempts', 'DELETE') THEN
    RAISE EXCEPTION '[00052] 검증 실패: 문제는 service_role 전용, 도전 기록은 본인 읽기만이어야 함';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.is_stage_unlocked(uuid, uuid)'::regprocedure
                    AND prosrc LIKE '%skill_check_attempts%' AND prosrc LIKE '%quest_type <> ''quiz''%') THEN
    RAISE EXCEPTION '[00052] 검증 실패: is_stage_unlocked 에 실력 확인 퀴즈 규칙이 없음';
  END IF;
  RAISE NOTICE '[00052] 실력 확인 퀴즈: skill_check_start·submit service_role 전용, 문제 잠김, 도전 기록 본인 읽기만';
END $$;
