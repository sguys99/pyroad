-- ============================================================
-- 스테이지 보물상자: 별 합계 목표 + 상자 열기 RPC (Idempotent)
--   (P8-06, §3 F11, §2.6 내용 공개형, §12-Q62 ③ "받기" 버튼 수령, 금액은 00031 coin_reward('chest'))
-- 릴리즈 단계: ① 추가형 (새 함수만. 테이블·기존 함수 변경 없음 — 이전 앱은 부르지 않음)
--
-- 하는 일
--   1. stage_chest_goal(code_quests): 상자 목표 별 = ceil(코드 퀘스트 수 × 3 × 0.7) (TS 사본 src/lib/world/chest.ts chestGoal,
--      대조 supabase/tests/fixtures/reward-rules.json "chest_goal" — vitest rewardRules.test.ts 와 test:rls RW-1).
--      코드 퀘스트(보스·프로젝트 포함, 퀴즈 제외 = 스테이지 클리어와 같은 기준 §12-Q60)로만 정해 코드 퀘스트만으로도 닿고,
--      퀴즈 별도 합계에 들어가 보너스 퀴즈 복습이 상자를 앞당김. 예: 코드 퀘스트 7개 → 15⭐ (최대 21의 약 70%)
--   2. open_stage_chest(user, stage): 상자 열기 (service_role 전용, /api/world/chest 가 getUser() 로 확인한 id 만 넘김)
--        - 별 합계는 서버가 다시 셈: 그 스테이지 모든 퀘스트(퀴즈 포함)의 user_progress.best_stars 합 (월드맵 stage.stars 와 같음)
--        - 이미 열었으면(원장 chest/<stage_id> 있음) 별과 상관없이 {opened: true, already_opened: true, coins_earned: 0}
--        - 목표 미달이면 not_enough_stars (PT409), 없는 스테이지 stage_not_found (PT404), 코드 퀘스트가 없는 스테이지는 목표 0 → 상자 없음(not_enough_stars)
--        - 열기 = coin_apply(user, 'chest', '<stage_id>', coin_reward('chest', 마지막 스테이지(is_final) 2 · 그 밖 1)) → 30 / 50
--          원장 키가 상태: 새 테이블 없이 "열었음" = coin_ledger (user, 'chest', stage_id) 행. 동시 호출·리셋 뒤 다시 모아도 1회
--          (리셋은 코인을 회수하지 않고 같은 키는 다시 주지 않음, §12-Q63 보완)
--        반환 {opened, already_opened, coins_earned, coins_balance, stars, goal}
--   3. 권한 + 자기 검증
-- 적용 후 NOTICE `[00033] 보물상자: stage_chest_goal, open_stage_chest, service_role 전용` 확인
-- 확인: supabase/tests RW-1(목표 표), CH-1(권한), CH-2(목표 미달 거부·열기·멱등·동시·리셋 뒤), RPC-6
-- 되돌리기: supabase/rollback/00033_stage_chest.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. stage_chest_goal
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stage_chest_goal(p_code_quests INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  -- ceil(n × 3 × 0.7) 를 정수로: (21n + 9) / 10
  SELECT CASE WHEN COALESCE(p_code_quests, 0) <= 0 THEN 0 ELSE (p_code_quests * 21 + 9) / 10 END;
$$;

COMMENT ON FUNCTION public.stage_chest_goal(INTEGER) IS
  '스테이지 보물상자 목표 별 (P8-06) = ceil(코드 퀘스트 수 × 3 × 0.7). TS 사본 src/lib/world/chest.ts, 대조 reward-rules.json chest_goal';

-- ------------------------------------------------------------
-- 2. open_stage_chest
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_stage_chest(p_user_id UUID, p_stage_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_final BOOLEAN;
  v_goal  INTEGER;
  v_stars INTEGER;
  v_res   JSONB;
BEGIN
  IF p_user_id IS NULL OR p_stage_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT s.is_final INTO v_final FROM public.stages s WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'stage_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 같은 사용자의 열기를 줄 세움 (coin_apply 와 같은 잠금 순서: users 먼저)
  PERFORM 1 FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT public.stage_chest_goal(count(*)::integer) INTO v_goal
    FROM public.quests q
   WHERE q.stage_id = p_stage_id AND q.quest_type <> 'quiz';

  SELECT COALESCE(sum(up.best_stars), 0)::integer INTO v_stars
    FROM public.user_progress up
    JOIN public.quests q ON q.id = up.quest_id
   WHERE up.user_id = p_user_id AND q.stage_id = p_stage_id;

  IF NOT EXISTS (SELECT 1 FROM public.coin_ledger l
                  WHERE l.user_id = p_user_id AND l.source = 'chest' AND l.ref = p_stage_id::text)
     AND (v_goal = 0 OR v_stars < v_goal) THEN
    RAISE EXCEPTION 'not_enough_stars' USING ERRCODE = 'PT409';
  END IF;

  v_res := public.coin_apply(p_user_id, 'chest', p_stage_id::text,
                             public.coin_reward('chest', CASE WHEN v_final THEN 2 ELSE 1 END));

  RETURN jsonb_build_object(
    'opened',         true,
    'already_opened', NOT (v_res->>'applied')::boolean,
    'coins_earned',   (v_res->>'delta')::integer,
    'coins_balance',  (v_res->>'coins')::integer,
    'stars',          v_stars,
    'goal',           v_goal);
END;
$$;

COMMENT ON FUNCTION public.open_stage_chest(UUID, UUID) IS
  '스테이지 보물상자 열기 (P8-06). service_role 전용: /api/world/chest. 서버가 별 합계를 다시 세어 목표 이상이면 원장 chest/<stage_id> 로 30(마지막 스테이지 50) 코인 한 번';

-- ------------------------------------------------------------
-- 3. 권한
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.stage_chest_goal(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_chest_goal(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.open_stage_chest(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_stage_chest(UUID, UUID) TO service_role;

-- ------------------------------------------------------------
-- 4. 자기 검증: 목표 표본(reward-rules.json chest_goal) + 권한
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT[] := '{}';
BEGIN
  IF public.stage_chest_goal(0) <> 0 OR public.stage_chest_goal(1) <> 3 OR public.stage_chest_goal(5) <> 11
     OR public.stage_chest_goal(7) <> 15 OR public.stage_chest_goal(10) <> 21 THEN
    v_bad := v_bad || '목표 표본'::TEXT;
  END IF;
  IF public.coin_reward('chest', 1) <> 30 OR public.coin_reward('chest', 2) <> 50 THEN
    v_bad := v_bad || '상자 금액 (00031 이 먼저 있어야 함)'::TEXT;
  END IF;
  IF has_function_privilege('anon', 'public.open_stage_chest(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.open_stage_chest(uuid, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.open_stage_chest(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.stage_chest_goal(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.stage_chest_goal(integer)', 'EXECUTE') THEN
    v_bad := v_bad || '실행 권한'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00033] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00033] 보물상자: stage_chest_goal, open_stage_chest, service_role 전용';
END $$;
