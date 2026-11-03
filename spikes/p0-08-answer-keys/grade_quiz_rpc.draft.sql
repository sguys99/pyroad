-- ============================================================
-- [DRAFT · P0-08 스파이크] 퀴즈 채점 RPC (추천안)
-- 대상 작업: P7-02 (/api/quest/answer), P1-03 (complete_quest 와 같은 원칙)
-- 전제: 00003_quest_answer_keys.draft.sql 적용 후
--
-- 구조 (추천)
--   브라우저 → POST /api/quest/answer (Next.js API Route: 로그인 확인, rate limit, 입력 크기 제한, 로깅)
--            → service_role 클라이언트로 rpc('submit_quiz_answer', { p_user_id, p_quest_id, p_answer })
--            → 한 트랜잭션: 진행 행 잠금 → 시도 번호 부여·기록 → 채점(quest_answer_keys) → 별·XP 1회 지급
--            → { correct, attempt_no, stars, xp_awarded, explanation } 만 응답 (오답일 때 정답은 보내지 않음)
--   - 이 함수는 service_role 만 실행 가능 (anon/authenticated EXECUTE 회수). 클라이언트가 직접 호출 불가.
--   - 정답 키는 DB 밖(Next.js 프로세스, 로그)으로 나가지 않음.
--   - 시도 번호는 행 잠금 아래에서 매기므로 4개 보기를 동시에 보내도 "첫 시도"는 하나뿐 → 별 계산이 정확함.
--
-- ⚠️ 아래 "스파이크 전용 스키마" 부분은 P1-08(user_progress.stars·attempts) 설계 전 임시안입니다.
-- ============================================================

-- ------------------------------------------------------------
-- 스파이크 전용 스키마 (P1-08 에서 확정)
-- ------------------------------------------------------------
-- 시도 기록: 서버만 씀. 시도 번호의 원본(클라이언트가 user_progress 를 고쳐도 영향 없음)
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quest_id   UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL,
  answer     JSONB NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, quest_id, attempt_no)
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created ON public.quiz_attempts(user_id, created_at DESC);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.quiz_attempts TO authenticated;          -- 본인 기록 조회만 (정책으로 제한)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quiz_attempts TO service_role;
DROP POLICY IF EXISTS "quiz_attempts_select_own" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_select_own" ON public.quiz_attempts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- 별 (P1-08 에서 best_stars 등과 함께 확정). ⚠️ P1-04 에서 클라이언트 UPDATE 컬럼을 제한하기 전에는
-- 사용자가 PATCH /user_progress 로 stars 를 직접 바꿀 수 있음 (verify 의 B04 점검 참고)
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS stars SMALLINT CHECK (stars BETWEEN 0 AND 3);

-- ------------------------------------------------------------
-- submit_quiz_answer: 채점 + 시도 기록 + 별 + XP (service_role 전용)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_user_id  UUID,
  p_quest_id UUID,
  p_answer   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_rate_window CONSTANT INTERVAL := INTERVAL '10 seconds';
  c_rate_max    CONSTANT INTEGER  := 5;   -- 10초에 5번 넘게 제출하면 거부 (API Route rate limit 의 백스톱)
  c_reveal_after CONSTANT INTEGER := 3;   -- 3번 틀리면 정답 공개 (제품 결정 필요: 보고서 §8)
  v_key        JSONB;
  v_xp         INTEGER;
  v_status     TEXT;
  v_attempt    INTEGER;
  v_correct    BOOLEAN;
  v_stars      SMALLINT;
  v_xp_awarded INTEGER := 0;
  v_recent     INTEGER;
  v_expl       TEXT;
BEGIN
  IF p_user_id IS NULL OR p_quest_id IS NULL OR p_answer IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF pg_column_size(p_answer) > 4096 THEN
    RAISE EXCEPTION 'answer_too_large' USING ERRCODE = 'PT413';
  END IF;

  SELECT k.quiz_answer, q.xp_reward
    INTO v_key, v_xp
    FROM public.quest_answer_keys k
    JOIN public.quests q ON q.id = k.quest_id
   WHERE k.quest_id = p_quest_id;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'quiz_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 진행 행을 만들고 잠금 → 같은 사용자·퀘스트의 동시 제출을 직렬화
  INSERT INTO public.user_progress (user_id, quest_id, status)
  VALUES (p_user_id, p_quest_id, 'in_progress')
  ON CONFLICT (user_id, quest_id) DO NOTHING;

  SELECT status INTO v_status
    FROM public.user_progress
   WHERE user_id = p_user_id AND quest_id = p_quest_id
     FOR UPDATE;

  -- 남용 방지 (사용자 단위, 모든 퀴즈 합산)
  SELECT count(*) INTO v_recent
    FROM public.quiz_attempts
   WHERE user_id = p_user_id AND created_at > NOW() - c_rate_window;
  IF v_recent >= c_rate_max THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;

  SELECT COALESCE(max(attempt_no), 0) + 1 INTO v_attempt
    FROM public.quiz_attempts
   WHERE user_id = p_user_id AND quest_id = p_quest_id;

  -- 채점: accepted 중 하나와 "정확히 같은" 경우만 정답.
  -- ⚠️ @>(포함) 연산자를 쓰면 안 됨: '[["b","a"]]' @> '[["a","b"]]' 가 true 라서 순서 맞추기가 무조건 정답이 됨
  v_correct := EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_key->'accepted') AS a(v) WHERE a.v = p_answer
  );

  INSERT INTO public.quiz_attempts (user_id, quest_id, attempt_no, answer, is_correct)
  VALUES (p_user_id, p_quest_id, v_attempt, p_answer, v_correct);

  IF v_correct AND v_status <> 'completed' THEN
    -- 처음 맞힌 순간 1회만: 별 + 완료 + XP (잠금 아래라 중복 지급 없음)
    v_stars := CASE WHEN v_attempt = 1 THEN 3 WHEN v_attempt = 2 THEN 2 ELSE 1 END;
    UPDATE public.user_progress
       SET status = 'completed', completed_at = NOW(), stars = v_stars
     WHERE user_id = p_user_id AND quest_id = p_quest_id;
    UPDATE public.users SET total_xp = total_xp + v_xp WHERE id = p_user_id;
    v_xp_awarded := v_xp;
  END IF;

  -- 해설: 고른 보기 전용 해설 → 없으면 기본 해설
  v_expl := COALESCE(v_key->'explanations'->>(p_answer #>> '{}'), v_key->'explanations'->>'_default');

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'correct',           v_correct,
    'attempt_no',        v_attempt,
    'stars',             v_stars,
    'already_completed', v_status = 'completed',
    'xp_awarded',        v_xp_awarded,
    'explanation',       v_expl,
    -- 정답은 맞혔거나, c_reveal_after 번 틀린 뒤에만 공개
    'answer',            CASE WHEN v_correct OR v_attempt >= c_reveal_after THEN v_key->'accepted'->0 END
  ));
END;
$$;

-- 기본값: 모든 함수는 PUBLIC 에 EXECUTE 가 있고, 운영(legacy)에서는 anon/authenticated 에도 자동 부여됨
REVOKE ALL ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) TO service_role;
