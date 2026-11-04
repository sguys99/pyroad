-- ============================================================
-- [P0-08 비교 실험 · 채택하지 않음] 클라이언트가 직접 호출하는 채점 RPC
-- verify.sh 에서 공격·지연 측정용으로만 적용합니다. 운영에 적용하지 마세요.
-- 전제: 00003 + grade_quiz_rpc.draft.sql 적용 후
-- ============================================================

-- (A) 순수 채점 함수: 맞다/틀리다만 돌려주고 아무것도 기록하지 않음
--     → 보기 4개를 차례로 넣어 보면 흔적 없이 정답을 알아낼 수 있음 (정답 오라클)
CREATE OR REPLACE FUNCTION public.grade_quiz(p_quest_id UUID, p_answer JSONB)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.quest_answer_keys k, jsonb_array_elements(k.quiz_answer->'accepted') AS a(v)
     WHERE k.quest_id = p_quest_id AND a.v = p_answer
  );
$$;
REVOKE ALL ON FUNCTION public.grade_quiz(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_quiz(UUID, JSONB) TO authenticated;

-- (B) 기록하는 채점 함수를 클라이언트에 직접 노출 (auth.uid() 사용)
--     시도는 기록되므로 별 계산은 안전하지만, API Route 의 rate limit·로깅·LLM 해설을 거치지 않음
CREATE OR REPLACE FUNCTION public.submit_quiz_answer_self(p_quest_id UUID, p_answer JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401';
  END IF;
  RETURN public.submit_quiz_answer(auth.uid(), p_quest_id, p_answer);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_quiz_answer_self(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer_self(UUID, JSONB) TO authenticated;
