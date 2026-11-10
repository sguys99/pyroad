-- ============================================================
-- 00027 되돌리기: reset_progress 를 00012 정의로   (B50)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 되돌리면 진행 리셋이 퀴즈 시도 기록을 지우지 않고(같은 날 리셋해도 오늘의 퀴즈가 "완료"로 남음),
-- stage_clear 유지 판정에 퀴즈가 다시 들어갑니다. 앱은 되돌리지 않아도 됩니다 (RPC 인자·반환 형태 같음)
-- 잃는 데이터: 없음 (00027 로 이미 지운 quiz_attempts 는 돌아오지 않음)
-- 실행 후 상태 = 00026 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00027_reset_quiz_attempts.rollback.sql
-- ============================================================

-- reset_progress (00012)
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

  -- total_xp 재계산: 남은 진행에서 실제로 받은 XP 의 합 (B12)
  SELECT COALESCE(sum(up.earned_xp), 0)::integer INTO v_total_xp
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.status = 'completed';

  UPDATE public.users
     SET total_xp = v_total_xp, current_level = public.level_for_xp(v_total_xp)
   WHERE id = p_user_id;

  -- stage_clear: 모든 퀘스트를 완료한 스테이지가 남아 있으면 유지
  WITH d AS (
    DELETE FROM public.user_badges b
     WHERE b.user_id = p_user_id
       AND b.badge_type = 'stage_clear'
       AND NOT EXISTS (
         SELECT 1
           FROM public.stages s
          WHERE EXISTS (SELECT 1 FROM public.quests q WHERE q.stage_id = s.id)
            AND NOT EXISTS (
              SELECT 1 FROM public.quests q
               WHERE q.stage_id = s.id
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
  '진행 리셋 (P1-03, B12). service_role 전용: /api/account/reset. earned_xp 합으로 total_xp 재계산';

REVOKE ALL ON FUNCTION public.reset_progress(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_progress(UUID, TEXT, UUID) TO service_role;
