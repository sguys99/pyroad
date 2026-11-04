-- ============================================================
-- 힌트 사용 기록 RPC record_hint + 진행 행 status 기본값 'in_progress'   (P1-04, B04·B05)
-- 릴리즈 단계: ① 추가형 (지금 운영 중인 이전 앱이 그대로 동작함)
--
-- 배경: 지금은 클라이언트(QuestShell·ProjectQuestShell)가 힌트를 받은 뒤 user_progress.hints_used 를 직접 upsert 합니다.
--   complete_quest(00006)는 이 DB 값으로 보상을 계산하므로(B05), 클라이언트가 hints_used 를 0 으로 되돌리면 1.5배 XP 를
--   받을 수 있습니다(회귀 B04-11). P1-04 에서 클라이언트의 hints_used·status 쓰기를 없애고(③ 00011 컬럼 권한),
--   힌트 수는 힌트를 내주는 튜터 API(/api/tutor, /api/tutor/stream)가 이 함수로 기록합니다.
--
-- 하는 일
--   1. user_progress.status 기본값 'not_started' → 'in_progress'
--      새 앱의 auto-save 는 status 를 보내지 않으므로(③ 이후에는 보낼 수도 없음) 진행 행을 처음 만들 때 기본값을 씁니다.
--      'not_started' 는 앱이 쓰지 않는 값입니다(완료 여부만 봄). 이전 앱·RPC 는 status 를 항상 명시하므로 영향 없음.
--   2. record_hint(p_user_id, p_quest_id, p_level)  (SECURITY DEFINER, service_role 전용)
--        튜터 API 가 힌트 내용을 보내기 시작할 때 부릅니다(받지 못한 힌트는 기록하지 않음, 아래 "언제 기록하나").
--        코드 퀘스트: hints_used = GREATEST(hints_used, p_level)  — 클라이언트 표시(힌트 n/3 = 받은 가장 높은 단계)와 같음.
--                     같은 단계를 다시 받아도 늘지 않고, 받은 힌트 단계보다 작게 기록되지 않음.
--        프로젝트 퀘스트(prompt_skeleton.steps 가 있음): hints_used + 1  — 단계마다 1~3 단계 힌트를 다시 받으므로 누적 횟수.
--        이미 완료한 퀘스트는 바꾸지 않음(보상이 끝남). 진행 행이 없으면 status 'in_progress' 로 만듦.
--        늘기만 하므로 이 함수로 힌트 수를 줄일 수는 없습니다.
--   3. 자기 검증: anon/authenticated 가 record_hint 를 실행할 수 없음
--
-- 언제 기록하나 (src/app/api/tutor/helpers.ts recordHintUsage)
--   스트림: 첫 번째 힌트 글자(delta)를 보낼 때 기록을 시작하고 done 전에 끝남을 기다림. 글자를 받기 전에 취소·실패하면
--   기록하지 않음(클라이언트도 횟수를 되돌림, B18). done 직전에만 기록하면 내용을 다 읽고 done 전에 끊어서
--   기록을 피할 수 있으므로 "내용을 보내기 시작한 때"를 기준으로 합니다.
--   비스트림: 응답을 만든 뒤(요청이 끊기지 않았을 때) 기록하고 응답.
--
-- 동시성: users → user_progress 순서로 잠급니다(complete_quest·use_golden_key·reset_progress 와 같음, 교착 방지).
--   같은 사용자의 완료와 힌트 기록이 직렬화되어, 완료 뒤에 도착한 힌트 기록은 무시됩니다.
-- 운영 적용 순서 (Phase 1 릴리즈, §12-Q21): ① 이 파일 → ② 튜터 API 가 이 함수를 부르는 앱 배포 → ③ 00011
--   적용 후 NOTICE `[00010] record_hint: anon/authenticated 실행 불가, status 기본값 in_progress` 확인
-- 되돌리기: supabase/rollback/00010_record_hint_rpc.rollback.sql (이전 앱은 이 함수를 쓰지 않음.
--   새 앱은 함수가 없으면 힌트는 그대로 보내고 기록만 실패를 로그로 남김)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. status 기본값
-- ------------------------------------------------------------
ALTER TABLE public.user_progress ALTER COLUMN status SET DEFAULT 'in_progress';

-- ------------------------------------------------------------
-- 2. record_hint
--   p_level: 받은 힌트 단계 1~3 (튜터 API 가 검증한 hint_level)
--   반환: { recorded, hints_used, status }   recorded = 값이 바뀌었는지 (완료한 퀘스트·같은 단계 반복이면 false)
--   오류 (message): invalid_arguments(PT400) · quest_not_found(PT404) · user_not_found(PT404)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_hint(
  p_user_id  UUID,
  p_quest_id UUID,
  p_level    INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_project BOOLEAN;
  v_before     INTEGER;
  v_progress   RECORD;
BEGIN
  IF p_user_id IS NULL OR p_quest_id IS NULL OR p_level IS NULL OR p_level NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT CASE WHEN jsonb_typeof(q.prompt_skeleton->'steps') = 'array'
              THEN jsonb_array_length(q.prompt_skeleton->'steps') > 0 ELSE false END
    INTO v_is_project
    FROM public.quests q
   WHERE q.id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quest_not_found' USING ERRCODE = 'PT404';
  END IF;
  v_is_project := COALESCE(v_is_project, false);

  -- 잠금 순서: users → user_progress (다른 보상 RPC 와 같음)
  PERFORM 1 FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT up.hints_used INTO v_before
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
     FOR UPDATE;

  INSERT INTO public.user_progress AS up (user_id, quest_id, status, hints_used)
  VALUES (p_user_id, p_quest_id, 'in_progress', CASE WHEN v_is_project THEN 1 ELSE p_level END)
  ON CONFLICT (user_id, quest_id) DO UPDATE
     SET hints_used = CASE
                        WHEN up.status = 'completed' THEN up.hints_used
                        WHEN v_is_project THEN up.hints_used + 1
                        ELSE GREATEST(up.hints_used, p_level)
                      END
  RETURNING up.status, up.hints_used INTO v_progress;

  RETURN jsonb_build_object(
    'recorded',   v_before IS DISTINCT FROM v_progress.hints_used,
    'hints_used', v_progress.hints_used,
    'status',     v_progress.status);
END;
$$;

COMMENT ON FUNCTION public.record_hint(UUID, UUID, INTEGER) IS
  '힌트 사용 기록 (P1-04, B05). 코드 퀘스트는 받은 최고 단계, 프로젝트는 누적 횟수. 완료한 퀘스트는 그대로. service_role 전용: /api/tutor·/api/tutor/stream';

REVOKE ALL ON FUNCTION public.record_hint(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_hint(UUID, UUID, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 3. 자기 검증
-- ------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.record_hint(uuid, uuid, integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.record_hint(uuid, uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00010] anon/authenticated 가 record_hint 를 실행할 수 있음';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.record_hint(uuid, uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00010] service_role 이 record_hint 를 실행할 수 없음';
  END IF;
  IF (SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'status')
     NOT LIKE '''in_progress''%' THEN
    RAISE EXCEPTION '[00010] user_progress.status 기본값이 in_progress 가 아님';
  END IF;
  RAISE NOTICE '[00010] record_hint: anon/authenticated 실행 불가, status 기본값 in_progress';
END $$;
