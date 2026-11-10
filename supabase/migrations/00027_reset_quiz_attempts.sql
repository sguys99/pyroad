-- ============================================================
-- 진행 리셋이 퀴즈 시도 기록도 지움 + stage_clear 유지 판정에서 퀴즈를 뺌 (Idempotent)   (B50, §12-Q60)
-- 릴리즈 단계: ① 추가형 (함수 본문 교체. 반환 형태·인자·권한은 그대로라 이전 앱도 같은 RPC 를 그대로 부름)
--
-- 하는 일
--   1. reset_progress: 00012 정의 +
--        - 'all'  : 그 사용자의 quiz_attempts 를 모두 지움
--        - 'stage': 리셋하는 스테이지(대상과 그 뒤)의 퀴즈 시도 기록을 지움
--        (오늘의 퀴즈 P7-10 dailyQuizResults 는 오늘 quiz_attempts 로 완료를 세므로, 같은 날 리셋해도 "완료"로 남던 문제)
--        - stage_clear 유지 판정: "모든 퀘스트를 완료한 스테이지"에서 퀴즈를 뺌 (00026 complete_quest 의 클리어 규칙과 같게.
--          퀴즈를 안 푼 학생이 뒤 스테이지만 리셋해도 stage_clear 가 지워지던 문제, B49 RW-7 에서 발견)
--      반환·오류·잠금 순서(users → user_progress)는 00012 그대로. 퀴즈 진행 행(별·XP)은 원래대로 user_progress 와 함께 지워짐
--   2. 권한 다시 적음 (service_role 전용) + 자기 검증
--   적용 후 NOTICE `[00027] reset_progress: service_role 전용, 퀴즈 시도 기록 삭제·stage_clear 퀴즈 제외 확인` 확인
--   ⚠️ 00006·00012 파일 전체를 다시 실행하면 reset_progress 가 그 정의로 돌아갑니다. 다시 실행했다면 00027 도 다시 실행
-- 확인: supabase/tests RW-7·RW-8·QZ-10
-- 되돌리기: supabase/rollback/00027_reset_quiz_attempts.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. reset_progress: 00012 + 퀴즈 시도 기록 삭제 + stage_clear 퀴즈 제외
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_progress(
  p_user_id  UUID,
  p_scope    TEXT,
  p_stage_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_golden_keys    INTEGER;
  v_target_world   INTEGER;
  v_target_order   INTEGER;
  v_reset_stages   JSONB;
  v_removed_quests INTEGER;
  v_removed_badges TEXT[];
  v_total_xp       INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_scope IS NULL OR p_scope NOT IN ('all', 'stage')
     OR (p_scope = 'stage' AND p_stage_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT u.golden_keys INTO v_golden_keys
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  IF p_scope = 'all' THEN
    -- 퀴즈 시도 기록도 지움 (B50: 오늘의 퀴즈 완료는 오늘 quiz_attempts 로 계산)
    DELETE FROM public.quiz_attempts WHERE user_id = p_user_id;
    WITH d AS (DELETE FROM public.user_badges WHERE user_id = p_user_id RETURNING badge_type)
    SELECT COALESCE(array_agg(badge_type ORDER BY badge_type), '{}') INTO v_removed_badges FROM d;
    WITH d AS (DELETE FROM public.user_progress WHERE user_id = p_user_id RETURNING 1)
    SELECT count(*) INTO v_removed_quests FROM d;
    UPDATE public.users
       SET total_xp = 0, current_level = 1, golden_keys = 3
     WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'scope',          'all',
      'reset_stages',   '[]'::jsonb,
      'removed_quests', v_removed_quests,
      'total_xp',       0,
      'level',          1,
      'golden_keys',    3,
      'removed_badges', to_jsonb(v_removed_badges));
  END IF;

  SELECT w."order", s."order" INTO v_target_world, v_target_order
    FROM public.stages s
    JOIN public.worlds w ON w.id = s.world_id
   WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'stage_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 대상 스테이지와 그 뒤 스테이지 (뒤 스테이지는 앞 스테이지를 다시 깨야 열리므로 함께 리셋)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'order', s."order", 'title', s.title)
                            ORDER BY w."order", s."order"), '[]'::jsonb)
    INTO v_reset_stages
    FROM public.stages s
    JOIN public.worlds w ON w.id = s.world_id
   WHERE (w."order", s."order") >= (v_target_world, v_target_order);

  WITH d AS (
    DELETE FROM public.user_progress up
     USING public.quests q, public.stages s, public.worlds w
     WHERE up.user_id = p_user_id
       AND q.id = up.quest_id
       AND s.id = q.stage_id
       AND w.id = s.world_id
       AND (w."order", s."order") >= (v_target_world, v_target_order)
    RETURNING 1
  )
  SELECT count(*) INTO v_removed_quests FROM d;

  -- 리셋한 스테이지의 퀴즈 시도 기록 (B50)
  DELETE FROM public.quiz_attempts qa
   USING public.quests q, public.stages s, public.worlds w
   WHERE qa.user_id = p_user_id
     AND q.id = qa.quest_id
     AND s.id = q.stage_id
     AND w.id = s.world_id
     AND (w."order", s."order") >= (v_target_world, v_target_order);

  -- total_xp 재계산: 남은 진행에서 실제로 받은 XP 의 합 (B12)
  SELECT COALESCE(sum(up.earned_xp), 0)::integer INTO v_total_xp
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.status = 'completed';

  UPDATE public.users
     SET total_xp = v_total_xp, current_level = public.level_for_xp(v_total_xp)
   WHERE id = p_user_id;

  -- stage_clear: 코드·프로젝트 퀘스트를 모두 완료한 스테이지가 남아 있으면 유지 (퀴즈는 보너스, complete_quest 와 같음. B50)
  WITH d AS (
    DELETE FROM public.user_badges b
     WHERE b.user_id = p_user_id
       AND b.badge_type = 'stage_clear'
       AND NOT EXISTS (
         SELECT 1
           FROM public.stages s
          WHERE EXISTS (SELECT 1 FROM public.quests q WHERE q.stage_id = s.id AND q.quest_type <> 'quiz')
            AND NOT EXISTS (
              SELECT 1 FROM public.quests q
               WHERE q.stage_id = s.id
                 AND q.quest_type <> 'quiz'
                 AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                                  WHERE up.user_id = p_user_id AND up.quest_id = q.id
                                    AND up.status = 'completed')))
    RETURNING badge_type
  )
  SELECT COALESCE(array_agg(badge_type), '{}') INTO v_removed_badges FROM d;

  RETURN jsonb_build_object(
    'scope',          'stage',
    'reset_stages',   v_reset_stages,
    'removed_quests', v_removed_quests,
    'total_xp',       v_total_xp,
    'level',          public.level_for_xp(v_total_xp),
    'golden_keys',    v_golden_keys,
    'removed_badges', to_jsonb(v_removed_badges));
END;
$$;


COMMENT ON FUNCTION public.reset_progress(UUID, TEXT, UUID) IS
  '진행 리셋 (P1-03, B12, 00027 B50). service_role 전용: /api/account/reset. earned_xp 합으로 total_xp 재계산, 리셋 범위의 quiz_attempts 도 삭제, stage_clear 는 퀴즈를 뺀 클리어 기준';

-- ------------------------------------------------------------
-- 2. 권한: service_role 만 실행 (CREATE OR REPLACE 는 기존 권한을 유지하지만 §2.2 대로 다시 적음)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.reset_progress(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_progress(UUID, TEXT, UUID) TO service_role;

-- ------------------------------------------------------------
-- 3. 자기 검증: 실행 권한 + 새 규칙이 함수 본문에 있는지
-- ------------------------------------------------------------
DO $$
DECLARE
  v_oid OID := 'public.reset_progress(uuid, text, uuid)'::regprocedure;
BEGIN
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION '[00027] 검증 실패: reset_progress 실행 권한이 service_role 전용이 아님';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_oid
                    AND prosecdef
                    AND prosrc LIKE '%DELETE FROM public.quiz_attempts%'
                    AND prosrc LIKE '%quest_type <> ''quiz''%') THEN
    RAISE EXCEPTION '[00027] 검증 실패: reset_progress 에 퀴즈 규칙이 없음 (00006·00012 를 다시 실행했나요?)';
  END IF;
  RAISE NOTICE '[00027] reset_progress: service_role 전용, 퀴즈 시도 기록 삭제·stage_clear 퀴즈 제외 확인';
END $$;
