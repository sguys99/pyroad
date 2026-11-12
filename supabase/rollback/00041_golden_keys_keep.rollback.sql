-- ============================================================
-- 00041 되돌리기: complete_quest(00036)·reset_progress(00030)·purchase_item(00040) 정의로   (B72)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 B72 이전 앱으로 되돌린 뒤 실행합니다 (새 앱은 3개 이상이어도 황금키 구매 버튼을 보여 주므로, 되돌린 DB 에서는 golden_keys_full 문구가 일반 오류로 보임).
-- 잃는 데이터: 없음. 지금 3개 넘게 가진 황금키는 그대로지만, 그 사용자가 다음에 스테이지를 깨거나 전체 리셋하면 3개로 줄어듦
-- 실행 후 상태 = 00040 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00041_golden_keys_keep.rollback.sql
-- ============================================================

-- complete_quest (00036)
CREATE OR REPLACE FUNCTION public.complete_quest(
  p_user_id    UUID,
  p_quest_id   UUID,
  p_submission JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_max_submission CONSTANT INTEGER := 65536;  -- 바이트. 코드 퀘스트 제출물은 수 KB
  v_quest          RECORD;
  v_user           RECORD;
  v_progress       RECORD;
  v_code           TEXT;
  v_passed         BOOLEAN;
  v_had_error      BOOLEAN;  -- 이번 풀이 중 실행 에러가 있었음 (브라우저가 알림, 실패 칭찬 업적에만)
  v_first          BOOLEAN;
  v_retry          BOOLEAN := false;  -- 이미 완료 + retry + 서버 재채점 통과 + 퀴즈 아님
  v_practice       BOOLEAN := false;  -- 그중 마지막 별 판정이 오늘(KST) → 연습 (Q64)
  v_direct         BOOLEAN := false;  -- 황금키 퀘스트의 첫 직접 풀이 (이번 요청)
  v_copy           BOOLEAN := false;  -- 황금키 정답을 그대로 다시 돌림
  v_has_stars      BOOLEAN;
  v_stars          INTEGER := 0;
  v_best           INTEGER;
  v_xp             INTEGER;
  v_total_xp       INTEGER;
  v_level_after    INTEGER;
  v_golden_keys    INTEGER;
  v_stage_total    INTEGER;
  v_stage_done     INTEGER;
  v_stage_cleared  BOOLEAN := false;
  v_stage_info     JSONB;
  v_next_quest_id  UUID;
  v_level_ups      JSONB;
  v_coins          INTEGER;
  v_achievements   JSONB;
BEGIN
  IF p_user_id IS NULL OR p_quest_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  p_submission := COALESCE(p_submission, '{}'::jsonb);
  IF jsonb_typeof(p_submission) <> 'object' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF pg_column_size(p_submission) > c_max_submission THEN
    RAISE EXCEPTION 'submission_too_large' USING ERRCODE = 'PT413';
  END IF;
  v_code := p_submission->>'code';
  v_passed := COALESCE(p_submission->'passed' = 'true'::jsonb, false);
  v_had_error := COALESCE(p_submission->'had_error' = 'true'::jsonb, false);

  SELECT q.id, q.stage_id, q."order", q.xp_reward, q.quest_type, s."order" AS stage_order, s.title AS stage_title, s.is_final
    INTO v_quest
    FROM public.quests q
    JOIN public.stages s ON s.id = q.stage_id
   WHERE q.id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quest_not_found' USING ERRCODE = 'PT404';
  END IF;
  -- 퀴즈 별은 submit_quiz_answer 가 정함 (00026)
  v_has_stars := v_quest.quest_type <> 'quiz';

  -- 잠금 순서: users → user_progress (reset_progress·use_golden_key 와 같음)
  SELECT u.total_xp, u.current_level, u.golden_keys, u.coins
    INTO v_user
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT up.status, up.hints_used, up.used_golden_key, up.best_stars, up.solved_directly_at, up.stars_judged_on
    INTO v_progress
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
     FOR UPDATE;

  -- 다음 퀘스트: 같은 스테이지에서 이 퀘스트 뒤의 첫 미완료 퀘스트
  SELECT q.id INTO v_next_quest_id
    FROM public.quests q
   WHERE q.stage_id = v_quest.stage_id
     AND q."order" > v_quest."order"
     AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                      WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed')
   ORDER BY q."order"
   LIMIT 1;

  v_first := v_progress.status IS DISTINCT FROM 'completed';

  IF NOT v_first THEN
    -- 다시 풀기는 화면이 retry 를 보내고 서버 재채점을 통과했을 때만. 나머지(중복 클릭·동시 요청)는 아무것도 바꾸지 않음
    v_retry := v_has_stars AND v_passed AND COALESCE(p_submission->'retry' = 'true'::jsonb, false);
    -- 복습 도전은 마지막 별 판정 다음 날(KST)부터 (Q64, 퀴즈와 같음). 판정 기록이 없는 예전 완료는 바로 복습 도전
    v_practice := v_retry AND v_progress.stars_judged_on IS NOT NULL
                  AND v_progress.stars_judged_on >= public.kst_today();
    IF v_retry AND NOT v_practice
       AND v_progress.used_golden_key AND v_progress.solved_directly_at IS NULL THEN
      v_copy := public.is_solution_copy(p_quest_id, v_code);
      v_direct := NOT v_copy;
    END IF;
    IF NOT v_retry OR v_practice OR v_copy THEN
      RETURN jsonb_build_object(
        'already_completed', true,
        'xp_gained',         0,
        'total_xp',          v_user.total_xp,
        'level_before',      v_user.current_level,
        'level_after',       v_user.current_level,
        'new_badges',        '[]'::jsonb,
        'new_achievements',  '[]'::jsonb,
        'stage_cleared',     NULL,
        'next_quest_id',     v_next_quest_id,
        'golden_keys',       v_user.golden_keys,
        'hints_used',        v_progress.hints_used,
        'used_golden_key',   v_progress.used_golden_key,
        'coins_earned',      0,
        'coins_balance',     v_user.coins,
        'level_ups',         '[]'::jsonb,
        'stars',             0,
        'best_stars',        v_progress.best_stars,
        'new_stars',         0,
        'solved_directly',   false,
        'solution_copy',     v_copy,
        'mode',              CASE WHEN v_practice THEN 'practice' END,
        'next_review_on',    to_char(v_progress.stars_judged_on + 1, 'YYYY-MM-DD'));
    END IF;
  END IF;

  IF NOT public.is_stage_unlocked(p_user_id, v_quest.stage_id) THEN
    RAISE EXCEPTION 'stage_locked' USING ERRCODE = 'PT403';
  END IF;

  IF v_first THEN
    IF NOT v_passed AND NOT COALESCE(v_progress.used_golden_key, false) THEN
      RAISE EXCEPTION 'not_passed' USING ERRCODE = 'PT422';
    END IF;

    -- 진행 행이 없으면 만든다 (users 잠금 아래라 동시 INSERT 경합 없음)
    IF v_progress.status IS NULL THEN
      INSERT INTO public.user_progress (user_id, quest_id, status)
      VALUES (p_user_id, p_quest_id, 'in_progress')
      ON CONFLICT (user_id, quest_id) DO NOTHING;
      SELECT up.status, up.hints_used, up.used_golden_key, up.best_stars, up.solved_directly_at, up.stars_judged_on
        INTO v_progress
        FROM public.user_progress up
       WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
         FOR UPDATE;
    END IF;

    -- 보상 계산은 DB 값으로 (B05)
    v_xp := public.quest_xp(v_quest.xp_reward, v_progress.hints_used, v_progress.used_golden_key);
    IF v_has_stars THEN
      v_stars := public.code_quest_stars(v_progress.hints_used, v_progress.used_golden_key);
    END IF;
    v_best := GREATEST(v_progress.best_stars, v_stars);

    UPDATE public.user_progress
       SET status          = 'completed',
           completed_at    = NOW(),
           earned_xp       = v_xp,
           code_submitted  = COALESCE(v_code, code_submitted),
           stars           = CASE WHEN v_has_stars THEN v_stars ELSE stars END,
           best_stars      = v_best,
           stars_judged_on = CASE WHEN v_has_stars THEN public.kst_today() ELSE stars_judged_on END,
           attempts        = attempts + CASE WHEN v_has_stars THEN 1 ELSE 0 END,
           -- 황금키로 받은 정답 완료는 "이겨 냄"이 아님
           overcame_error  = overcame_error OR (v_had_error AND v_passed AND NOT v_progress.used_golden_key)
     WHERE user_id = p_user_id AND quest_id = p_quest_id;

    -- 스테이지 클리어 (이번 완료 포함)
    SELECT count(*), count(*) FILTER (WHERE up.status = 'completed')
      INTO v_stage_total, v_stage_done
      FROM public.quests q
      LEFT JOIN public.user_progress up ON up.quest_id = q.id AND up.user_id = p_user_id
     WHERE q.stage_id = v_quest.stage_id
       AND q.quest_type <> 'quiz';  -- 퀴즈는 보너스 (00026)
    v_stage_cleared := v_stage_total > 0 AND v_stage_total = v_stage_done;
  ELSE
    -- 다시 풀기: 힌트·황금키 없이 통과 → 3. XP 는 황금키 퀘스트의 첫 직접 풀이 때만 (그 풀이까지 받은 힌트 기준)
    v_stars := public.code_quest_stars(0, false);
    v_best := GREATEST(v_progress.best_stars, v_stars);
    v_xp := CASE WHEN v_direct THEN public.quest_xp(v_quest.xp_reward, v_progress.hints_used, false) ELSE 0 END;

    UPDATE public.user_progress
       SET stars              = v_stars,
           best_stars         = v_best,
           stars_judged_on    = public.kst_today(),
           attempts           = attempts + 1,
           earned_xp          = earned_xp + v_xp,
           solved_directly_at = CASE WHEN v_direct THEN NOW() ELSE solved_directly_at END,
           overcame_error     = overcame_error OR v_had_error
     WHERE user_id = p_user_id AND quest_id = p_quest_id;
  END IF;

  v_total_xp := v_user.total_xp + v_xp;
  v_level_after := public.level_for_xp(v_total_xp);

  -- 스테이지를 클리어하면 다음 스테이지를 위해 황금키 3개로
  v_golden_keys := CASE WHEN v_stage_cleared THEN 3 ELSE v_user.golden_keys END;

  UPDATE public.users
     SET total_xp      = v_total_xp,
         current_level = v_level_after,
         golden_keys   = v_golden_keys
   WHERE id = p_user_id;

  -- 코인 (00031): 첫 완료 코인(황금키 완료는 XP 처럼 0 → 첫 직접 풀이 때, 퀴즈는 별 코인만) + 별 코인 + 레벨 업 코인.
  -- 원장 키(quest:<quest_id>, star:<quest_id>:<n>, level_up:<레벨>)가 남아 리셋 뒤·동시 요청에도 한 번
  IF v_has_stars AND (v_direct OR (v_first AND NOT v_progress.used_golden_key)) THEN
    PERFORM public.coin_apply(p_user_id, 'quest', p_quest_id::text, public.coin_reward(CASE WHEN v_quest.quest_type = 'project' THEN 'project' ELSE 'quest' END));
  END IF;
  -- 별 코인: 새로 얻은 별 번호만. 황금키 완료의 별 1개는 통과 표시라 주지 않음 → 직접 풀면 1..3 을 그때
  IF v_has_stars AND NOT (v_first AND v_progress.used_golden_key) THEN
    PERFORM public.grant_star_coins(p_user_id, p_quest_id, v_best);
  END IF;
  v_level_ups := public.grant_level_up_coins(p_user_id, v_user.current_level, v_level_after);
  SELECT u.coins INTO v_coins FROM public.users u WHERE u.id = p_user_id;

  IF v_stage_cleared THEN
    v_next_quest_id := NULL;
    SELECT jsonb_build_object(
             'stage_id', v_quest.stage_id,
             'order',    v_quest.stage_order,
             'title',    v_quest.stage_title,
             'concepts', COALESCE(jsonb_agg(q.concept ORDER BY q."order"), '[]'::jsonb))
      INTO v_stage_info
      FROM public.quests q
     WHERE q.stage_id = v_quest.stage_id;
  END IF;

  -- 업적 (P8-09): 기록이 바뀐 뒤 판정. 황금키 완료도 진행·레벨이 바뀔 수 있어 판정하되, 지표가 직접 푼 것만 셈
  v_achievements := public.evaluate_achievements(p_user_id);

  RETURN jsonb_build_object(
    'already_completed', NOT v_first,
    'xp_gained',         v_xp,
    'total_xp',          v_total_xp,
    'level_before',      v_user.current_level,
    'level_after',       v_level_after,
    'new_badges',        '[]'::jsonb,
    'new_achievements',  v_achievements,
    'stage_cleared',     v_stage_info,
    'next_quest_id',     v_next_quest_id,
    'golden_keys',       v_golden_keys,
    'hints_used',        v_progress.hints_used,
    'used_golden_key',   v_progress.used_golden_key,
    'coins_earned',      v_coins - v_user.coins,
    'coins_balance',     v_coins,
    'level_ups',         v_level_ups,
    'stars',             v_stars,
    'best_stars',        v_best,
    'new_stars',         v_best - v_progress.best_stars,
    'solved_directly',   v_direct,
    'solution_copy',     false,
    'mode',              CASE WHEN v_first THEN 'first' ELSE 'review' END,
    'next_review_on',    CASE WHEN v_has_stars THEN to_char(public.kst_today() + 1, 'YYYY-MM-DD') END);
END;
$$;

COMMENT ON FUNCTION public.complete_quest(UUID, UUID, JSONB) IS
  '퀘스트 완료·보상 (P1-03, Q25, 00026 퀴즈 제외, 00031 코인, 00032 별·다시 풀기, 00036 업적). service_role 전용: /api/quest/complete 가 getUser() 로 확인한 id 만 넘김. 처음 완료될 때만 XP, 다시 풀기는 새 별 코인만, 업적은 evaluate_achievements';

-- reset_progress (00030)
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
  v_removed_xp     INTEGER;
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
    -- 코인(users.coins·coin_ledger)은 그대로 (P8-03: 리셋은 코인을 회수하지 않고, 원장 키가 남아 같은 보상을 다시 주지 않음)
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
    RETURNING up.earned_xp
  )
  SELECT count(*), COALESCE(sum(d.earned_xp), 0)::integer INTO v_removed_quests, v_removed_xp FROM d;

  -- 리셋한 스테이지의 퀴즈 시도 기록 (B50)
  DELETE FROM public.quiz_attempts qa
   USING public.quests q, public.stages s, public.worlds w
   WHERE qa.user_id = p_user_id
     AND q.id = qa.quest_id
     AND s.id = q.stage_id
     AND w.id = s.world_id
     AND (w."order", s."order") >= (v_target_world, v_target_order);

  -- total_xp: 지운 진행에서 받은 XP 만 뺌 (B55. 레벨 보정·미션 등 퀘스트 밖 XP 는 남김. 황금키 0 XP 과다 차감 없음 B12)
  UPDATE public.users
     SET total_xp = GREATEST(0, total_xp - v_removed_xp)
   WHERE id = p_user_id
  RETURNING total_xp INTO v_total_xp;

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
  '진행 리셋 (P1-03, B12, 00027 B50, 00030 B55). service_role 전용: /api/account/reset. 스테이지 리셋은 지운 행의 earned_xp 만 빼고, 코인은 회수하지 않음';

-- purchase_item (00040)
CREATE OR REPLACE FUNCTION public.purchase_item(p_user_id UUID, p_item_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item    public.shop_items%ROWTYPE;
  v_keys    INTEGER;
  v_shields INTEGER;
  v_week    DATE := public.kst_week_start(public.kst_today());
  v_bought  INTEGER := 0;
  v_ref     TEXT;
  v_res     JSONB;
BEGIN
  IF p_user_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 같은 사용자의 구매를 줄 세움 (coin_apply 와 같은 잠금 순서: users 먼저)
  SELECT u.golden_keys INTO v_keys FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT * INTO v_item FROM public.shop_items i WHERE i.id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF NOT v_item.is_active THEN
    RAISE EXCEPTION 'item_inactive' USING ERRCODE = 'PT410';
  END IF;

  SELECT COALESCE((SELECT s.shields FROM public.user_streak_shields s WHERE s.user_id = p_user_id), 0) INTO v_shields;

  IF v_item.kind <> 'consumable' THEN
    IF EXISTS (SELECT 1 FROM public.user_items ui WHERE ui.user_id = p_user_id AND ui.item_id = p_item_id) THEN
      RAISE EXCEPTION 'already_owned' USING ERRCODE = 'PT409';
    END IF;
    v_ref := 'shop:' || p_item_id;
  ELSE
    SELECT count(*) INTO v_bought FROM public.coin_ledger l
     WHERE l.user_id = p_user_id AND l.source = 'spend'
       AND starts_with(l.ref, 'shop:' || p_item_id || ':' || v_week::text || ':');
    IF v_bought >= v_item.weekly_limit THEN
      RAISE EXCEPTION 'weekly_limit_reached' USING ERRCODE = 'PT409';
    END IF;
    IF p_item_id = 'streak_shield' AND v_shields >= 2 THEN
      RAISE EXCEPTION 'shields_full' USING ERRCODE = 'PT409';
    END IF;
    IF p_item_id = 'golden_key' AND v_keys >= 3 THEN
      RAISE EXCEPTION 'golden_keys_full' USING ERRCODE = 'PT409';
    END IF;
    v_ref := 'shop:' || p_item_id || ':' || v_week::text || ':' || (v_bought + 1);
  END IF;

  v_res := public.coin_apply(p_user_id, 'spend', v_ref, -v_item.price);  -- 모자라면 not_enough_coins

  IF v_item.kind <> 'consumable' THEN
    INSERT INTO public.user_items (user_id, item_id) VALUES (p_user_id, p_item_id);
  ELSIF p_item_id = 'golden_key' THEN
    UPDATE public.users SET golden_keys = golden_keys + 1 WHERE id = p_user_id RETURNING golden_keys INTO v_keys;
  ELSIF p_item_id = 'streak_shield' THEN
    INSERT INTO public.user_streak_shields AS s (user_id, shields) VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET shields = s.shields + 1, updated_at = NOW()
    RETURNING s.shields INTO v_shields;
  ELSE
    RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'PT404';  -- 모르는 소모품 (새 소모품은 여기에 지급을 더함)
  END IF;

  RETURN jsonb_build_object(
    'item_id',          p_item_id,
    'kind',             v_item.kind,
    'price',            v_item.price,
    'coins_balance',    (v_res->>'coins')::integer,
    'golden_keys',      v_keys,
    'shields',          v_shields,
    'bought_this_week', CASE WHEN v_item.kind = 'consumable' THEN v_bought + 1 ELSE 0 END);
END;
$$;

COMMENT ON FUNCTION public.purchase_item(UUID, TEXT) IS
  '상점 구매 (P9-03). service_role 전용: /api/shop/purchase. 가격·한도는 shop_items, 원장 spend shop:<item>[:<주>:<n>], 영구 재구매·주 한도·방패 2·황금키 3 거부';

REVOKE ALL ON FUNCTION public.complete_quest(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_progress(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_item(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quest(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_progress(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_item(UUID, TEXT) TO service_role;
