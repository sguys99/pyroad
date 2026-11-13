-- ============================================================
-- 보스 배틀 (Idempotent)   (P9-12, §2.3, F9)
-- 릴리즈 단계: ① 추가형 (새 테이블·함수 · CHECK 넓히기 · coin_reward 에 'boss' 행 · is_stage_unlocked 에 "이미 간 곳은 계속 열림" OR 추가.
--                       이전 앱은 boss_answer 를 부르지 않고, 보스 콘텐츠가 없으면 잠금 결과도 같음)
--
-- 보스 퀘스트 (quests.quest_type = 'boss', 00012 CHECK 에 이미 있음): 퀴즈 문제 n개(라운드)를 이어서 푸는 스테이지 마지막 관문
--   공개 문제 = quests.prompt_skeleton.boss.rounds[] (퀴즈 공개 모양 그대로) · 정답 = quest_answer_keys.quiz_answer
--   {"kind": "boss", "rounds": [{"kind": <퀴즈 종류>, "accepted": [...], "explanation", "explanations"?}, …]}
--   보스는 퀴즈가 아니라 스테이지 클리어·잠금에 드는 퀘스트 (quest_type <> 'quiz' 인 모든 계산이 그대로 셈)
--
-- 하는 일
--   1. quest_answer_keys_quiz_answer_shape CHECK: kind = 'boss' + rounds 배열(1개 이상) 허용
--   2. boss_runs: 지금 판 (사용자·보스마다 한 행: 몇 번째 문제·남은 하트). service_role 전용(RLS ON, 정책 없음)
--      채점이 서버에서 한 문제씩 이뤄지므로 하트·진행도 서버에만 둠 → 화면이 하트 수를 꾸며 보낼 수 없음
--   3. coin_reward('boss') = 20 (첫 승리, TS 사본 src/lib/quest/coins.ts COIN_RULES.boss, 대조 reward-rules.json "coins")
--   4. is_stage_unlocked: 00026 + "이 스테이지나 뒤 스테이지에서 완료한 퀘스트가 있으면 열림"
--      보스가 새로 생긴 스테이지 뒤로 이미 나아간 학생이 갑자기 잠기지 않게 (완료는 RPC 만 쓰므로 화면이 꾸밀 수 없음).
--      TS 사본: src/lib/world/getStageStatuses.ts
--   5. boss_answer(user, quest, round, answer) → jsonb (SECURITY DEFINER, service_role 전용: /api/quest/boss)
--   6. 권한 + 자기 검증
--
-- boss_answer 흐름 (한 트랜잭션, 잠금 users → user_progress → boss_runs)
--   공통 확인: 보스 퀘스트 · 스테이지 열림(stage_locked) · 같은 스테이지의 다른 퀘스트(퀴즈 빼고)를 모두 완료(boss_locked)
--   mode (퀴즈·코드와 같은 규칙, Q64): first 아직 완료 전 · review 마지막 별 판정일 < 오늘(KST) · practice 오늘 이미 판정
--   시작 (answer IS NULL, round 0): 판을 round 0 · 하트 3 으로 새로 (재도전도 같음). 진행 행이 없으면 in_progress 로 만듦
--   답 (answer, round = 판의 round): 그 라운드 accepted 중 하나와 jsonb = 이면 정답 → round + 1, 아니면 하트 − 1 (같은 문제 다시)
--     판이 끝났거나(하트 0·모든 라운드) 없으면 boss_run_over, round 가 다르면(두 번 누름·다른 탭) boss_round_mismatch
--     하트 0 = 패배(lose), 마지막 라운드 정답 = 승리(win). 판이 끝나면 user_progress.attempts + 1
--   승리 보상 (first·review, practice 는 무변화):
--     별 = 남은 하트 (3·2·1) · best_stars = max · XP = (새 best − 이전 best) × xp_reward / 3 (콘텐츠 xp_reward 는 3의 배수)
--     코인: 첫 승리 coin_reward('boss') (원장 quest/<quest_id>) + 새 별 번호마다 5 (grant_star_coins) + 레벨 업 (grant_level_up_coins)
--     첫 승리면 스테이지 클리어 계산(complete_quest 와 같음: 퀴즈 빼고 모두 완료 → stage_cleared · 황금키 GREATEST(3, 지금))
--     업적 evaluate_achievements
--   반환 { correct, round(다음에 풀 라운드 = 깬 문제 수), hearts, total, mode, result(null|'win'|'lose'), explanation,
--          reward(승리 때만: complete_quest 반환과 같은 키) }
--     explanation: 정답 → 그 라운드 정답 해설 / 오답 → 고른 보기(bug_hunt 는 수정안→줄)의 해설만, 없으면 null. 정답은 응답에 없음
--   오류 (message): invalid_arguments · answer_too_large · quest_not_found · not_boss(PT400) · answer_key_missing(PT500)
--                   user_not_found · stage_locked · boss_locked(PT409) · boss_run_over(PT409) · boss_round_mismatch(PT409)
--
-- 적용 후 NOTICE `[00046] 보스 배틀: boss_answer service_role 전용, boss_runs 잠김, coin_reward('boss') = 20` 확인
-- 확인: supabase/tests BOSS-1(권한)·BOSS-2(승리·패배·하트·별·원장·잠금·연습)·RW-1(금액표)
-- 되돌리기: supabase/rollback/00046_boss_battle.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 보스 정답 모양
-- ------------------------------------------------------------
ALTER TABLE public.quest_answer_keys DROP CONSTRAINT IF EXISTS quest_answer_keys_quiz_answer_shape;
ALTER TABLE public.quest_answer_keys ADD CONSTRAINT quest_answer_keys_quiz_answer_shape CHECK (
  quiz_answer IS NULL OR (
    jsonb_typeof(quiz_answer) = 'object'
    AND (
      (quiz_answer->>'kind' IN ('multiple_choice', 'fill_blank', 'parsons', 'bug_hunt')
       AND jsonb_typeof(quiz_answer->'accepted') = 'array'
       AND jsonb_array_length(quiz_answer->'accepted') > 0)
      OR
      (quiz_answer->>'kind' = 'boss'
       AND jsonb_typeof(quiz_answer->'rounds') = 'array'
       AND jsonb_array_length(quiz_answer->'rounds') > 0)
    )
  )
);

-- ------------------------------------------------------------
-- 2. boss_runs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boss_runs (
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quest_id   UUID        NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  round      INTEGER     NOT NULL DEFAULT 0,
  hearts     INTEGER     NOT NULL DEFAULT 3,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, quest_id),
  CONSTRAINT boss_runs_round_range  CHECK (round BETWEEN 0 AND 20),
  CONSTRAINT boss_runs_hearts_range CHECK (hearts BETWEEN 0 AND 3)
);

COMMENT ON TABLE public.boss_runs IS
  '보스 배틀 지금 판 (P9-12): 사용자·보스마다 몇 번째 문제·남은 하트. service_role 전용(RLS ON, 정책 없음). boss_answer 만 씀';

ALTER TABLE public.boss_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.boss_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.boss_runs TO service_role;

-- ------------------------------------------------------------
-- 3. coin_reward: 00044 표 + boss
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coin_reward(p_kind TEXT, p_n INTEGER DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(CASE p_kind
    WHEN 'quest'       THEN 10
    WHEN 'project'     THEN 40   -- 프로젝트 첫 완료 (§12-Q65 (a), XP 4배에 맞춤)
    WHEN 'boss'        THEN 20   -- 보스 첫 승리 (P9-12, 문제 5개 안팎 = 퀴즈 두세 개 몫, docs/balance.md)
    WHEN 'star'        THEN 5
    WHEN 'level_up'    THEN CASE WHEN p_n BETWEEN 2 AND 50 THEN CASE WHEN p_n % 5 = 0 THEN 100 ELSE 20 END END
    WHEN 'mission'     THEN (ARRAY[10, 15, 20])[p_n]
    WHEN 'attendance'  THEN (ARRAY[5, 5, 10, 10, 15, 20, 30])[p_n]
    WHEN 'chest'       THEN (ARRAY[30, 50])[p_n]
    WHEN 'achievement' THEN (ARRAY[10, 30, 100])[p_n]
    WHEN 'share'       THEN 15   -- 자랑하기 하루 1회 (P9-10, §12-Q67 ④)
  END, 0);
$$;

COMMENT ON FUNCTION public.coin_reward(TEXT, INTEGER) IS
  '코인 금액표 (P8-04, share P9-10, boss P9-12). TS 사본 src/lib/quest/coins.ts, 대조 reward-rules.json coins. 모르는 kind·범위 밖 n 은 0';

REVOKE ALL ON FUNCTION public.coin_reward(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_reward(TEXT, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 4. is_stage_unlocked: 00026 + 이미 간 곳은 계속 열림
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_stage_unlocked(p_user_id UUID, p_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH cur AS (
    SELECT w."order" AS world_order, s."order" AS stage_order
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
      );
$$;

COMMENT ON FUNCTION public.is_stage_unlocked(UUID, UUID) IS
  '스테이지 잠금 (00012, 00026 퀴즈 제외, 00046 이 스테이지·뒤 스테이지에 완료가 있으면 열림). TS 사본 src/lib/world/getStageStatuses.ts';

-- ------------------------------------------------------------
-- 5. boss_answer
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boss_answer(
  p_user_id  UUID,
  p_quest_id UUID,
  p_round    INTEGER,
  p_answer   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_hearts      CONSTANT INTEGER := 3;
  c_max_answer  CONSTANT INTEGER := 4096;  -- 바이트 (퀴즈와 같음)
  v_quest       RECORD;
  v_user        RECORD;
  v_progress    RECORD;
  v_run         RECORD;
  v_rounds      JSONB;
  v_key         JSONB;
  v_total       INTEGER;
  v_today       DATE := public.kst_today();
  v_mode        TEXT;
  v_first       BOOLEAN;
  v_correct     BOOLEAN;
  v_round       INTEGER;
  v_hearts      INTEGER;
  v_result      TEXT;
  v_explanation TEXT;
  v_stars       INTEGER := 0;
  v_best        INTEGER;
  v_xp          INTEGER := 0;
  v_total_xp    INTEGER;
  v_level_after INTEGER;
  v_golden_keys INTEGER;
  v_stage_total INTEGER;
  v_stage_done  INTEGER;
  v_stage_info  JSONB;
  v_next_id     UUID;
  v_level_ups   JSONB := '[]'::jsonb;
  v_coins       INTEGER;
  v_achieved    JSONB := '[]'::jsonb;
  v_reward      JSONB;
BEGIN
  IF p_user_id IS NULL OR p_quest_id IS NULL OR p_round IS NULL OR p_round < 0 OR p_round > 20
     OR (p_answer IS NULL AND p_round <> 0) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF p_answer IS NOT NULL AND octet_length(p_answer::text) > c_max_answer THEN
    RAISE EXCEPTION 'answer_too_large' USING ERRCODE = 'PT413';
  END IF;

  SELECT q.id, q.stage_id, q."order", q.quest_type, q.xp_reward, s."order" AS stage_order, s.title AS stage_title
    INTO v_quest
    FROM public.quests q
    JOIN public.stages s ON s.id = q.stage_id
   WHERE q.id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quest_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_quest.quest_type <> 'boss' THEN
    RAISE EXCEPTION 'not_boss' USING ERRCODE = 'PT400';
  END IF;

  SELECT k.quiz_answer->'rounds' INTO v_rounds
    FROM public.quest_answer_keys k
   WHERE k.quest_id = p_quest_id AND k.quiz_answer->>'kind' = 'boss';
  IF v_rounds IS NULL OR jsonb_typeof(v_rounds) <> 'array' OR jsonb_array_length(v_rounds) = 0 THEN
    RAISE EXCEPTION 'answer_key_missing' USING ERRCODE = 'PT500';
  END IF;
  v_total := jsonb_array_length(v_rounds);

  -- 잠금 순서: users → user_progress → boss_runs (다른 보상 RPC 와 같은 앞 순서, 교착 없음)
  SELECT u.total_xp, u.current_level, u.golden_keys, u.coins
    INTO v_user
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  IF NOT public.is_stage_unlocked(p_user_id, v_quest.stage_id) THEN
    RAISE EXCEPTION 'stage_locked' USING ERRCODE = 'PT403';
  END IF;
  -- 보스는 스테이지 마지막 관문: 같은 스테이지의 다른 퀘스트(퀴즈는 보너스라 빼고)를 모두 끝내야 열림
  IF EXISTS (
    SELECT 1 FROM public.quests q
     WHERE q.stage_id = v_quest.stage_id AND q.id <> p_quest_id AND q.quest_type NOT IN ('quiz', 'boss')
       AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                        WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed')
  ) THEN
    RAISE EXCEPTION 'boss_locked' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.user_progress (user_id, quest_id, status)
  VALUES (p_user_id, p_quest_id, 'in_progress')
  ON CONFLICT (user_id, quest_id) DO NOTHING;
  SELECT up.status, up.best_stars, up.stars_judged_on
    INTO v_progress
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
     FOR UPDATE;
  v_first := v_progress.status IS DISTINCT FROM 'completed';
  v_mode := CASE
              WHEN v_first THEN 'first'
              WHEN v_progress.stars_judged_on IS NULL OR v_progress.stars_judged_on < v_today THEN 'review'
              ELSE 'practice'
            END;

  -- 시작·재도전: 새 판
  IF p_answer IS NULL THEN
    INSERT INTO public.boss_runs (user_id, quest_id, round, hearts, started_at, updated_at)
    VALUES (p_user_id, p_quest_id, 0, c_hearts, NOW(), NOW())
    ON CONFLICT (user_id, quest_id)
      DO UPDATE SET round = 0, hearts = c_hearts, started_at = NOW(), updated_at = NOW();
    RETURN jsonb_build_object(
      'correct', NULL, 'round', 0, 'hearts', c_hearts, 'total', v_total, 'mode', v_mode,
      'result', NULL, 'explanation', NULL, 'reward', NULL);
  END IF;

  SELECT r.round, r.hearts INTO v_run
    FROM public.boss_runs r
   WHERE r.user_id = p_user_id AND r.quest_id = p_quest_id
     FOR UPDATE;
  IF NOT FOUND OR v_run.hearts <= 0 OR v_run.round >= v_total THEN
    RAISE EXCEPTION 'boss_run_over' USING ERRCODE = 'PT409';
  END IF;
  IF v_run.round <> p_round THEN
    RAISE EXCEPTION 'boss_round_mismatch' USING ERRCODE = 'PT409';
  END IF;

  v_key := v_rounds -> p_round;
  -- 모양만 확인 (정규형은 API 의 zod 가 먼저 봄). 틀린 id 는 오답으로 채점 (submit_quiz_answer 와 같음)
  IF NOT COALESCE(CASE v_key->>'kind'
           WHEN 'multiple_choice' THEN jsonb_typeof(p_answer) = 'string'
           WHEN 'fill_blank'      THEN jsonb_typeof(p_answer) = 'object'
           WHEN 'parsons'         THEN jsonb_typeof(p_answer) = 'array'
           WHEN 'bug_hunt'        THEN jsonb_typeof(p_answer) = 'object'
                                       AND jsonb_typeof(p_answer->'line') = 'string'
                                       AND jsonb_typeof(p_answer->'fix') = 'string'
           ELSE false
         END, false) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  v_correct := EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_key->'accepted') AS a(v) WHERE a.v = p_answer);
  v_round := v_run.round + CASE WHEN v_correct THEN 1 ELSE 0 END;
  v_hearts := v_run.hearts - CASE WHEN v_correct THEN 0 ELSE 1 END;
  UPDATE public.boss_runs
     SET round = v_round, hearts = v_hearts, updated_at = NOW()
   WHERE user_id = p_user_id AND quest_id = p_quest_id;

  v_explanation := CASE
    WHEN v_correct THEN v_key->>'explanation'
    WHEN jsonb_typeof(p_answer) = 'string' THEN v_key->'explanations'->>(p_answer#>>'{}')
    WHEN v_key->>'kind' = 'bug_hunt'
      THEN COALESCE(v_key->'explanations'->>(p_answer->>'fix'), v_key->'explanations'->>(p_answer->>'line'))
    ELSE NULL
  END;
  v_result := CASE WHEN v_hearts <= 0 THEN 'lose' WHEN v_round >= v_total THEN 'win' END;

  IF v_result IS NOT NULL THEN
    UPDATE public.user_progress SET attempts = attempts + 1
     WHERE user_id = p_user_id AND quest_id = p_quest_id;
  END IF;

  IF v_result = 'win' THEN
    v_stars := v_hearts;
    v_best := v_progress.best_stars;
    v_total_xp := v_user.total_xp;
    v_level_after := v_user.current_level;
    v_golden_keys := v_user.golden_keys;

    IF v_mode <> 'practice' THEN
      v_best := GREATEST(v_progress.best_stars, v_stars);
      v_xp := (v_best - v_progress.best_stars) * (v_quest.xp_reward / 3);
      UPDATE public.user_progress
         SET status          = 'completed',
             completed_at    = COALESCE(completed_at, NOW()),
             stars           = v_stars,
             best_stars      = v_best,
             stars_judged_on = v_today,
             earned_xp       = earned_xp + v_xp
       WHERE user_id = p_user_id AND quest_id = p_quest_id;

      v_total_xp := v_user.total_xp + v_xp;
      v_level_after := public.level_for_xp(v_total_xp);

      IF v_first THEN
        -- 스테이지 클리어 (complete_quest 와 같은 셈: 퀴즈 빼고 모두 완료)
        SELECT count(*), count(*) FILTER (WHERE up.status = 'completed')
          INTO v_stage_total, v_stage_done
          FROM public.quests q
          LEFT JOIN public.user_progress up ON up.quest_id = q.id AND up.user_id = p_user_id
         WHERE q.stage_id = v_quest.stage_id
           AND q.quest_type <> 'quiz';
        IF v_stage_total > 0 AND v_stage_total = v_stage_done THEN
          v_golden_keys := GREATEST(3, v_user.golden_keys);
          SELECT jsonb_build_object(
                   'stage_id', v_quest.stage_id,
                   'order',    v_quest.stage_order,
                   'title',    v_quest.stage_title,
                   'concepts', COALESCE(jsonb_agg(q.concept ORDER BY q."order"), '[]'::jsonb))
            INTO v_stage_info
            FROM public.quests q
           WHERE q.stage_id = v_quest.stage_id;
        END IF;
      END IF;

      UPDATE public.users
         SET total_xp = v_total_xp, current_level = v_level_after, golden_keys = v_golden_keys
       WHERE id = p_user_id;

      IF v_first THEN
        PERFORM public.coin_apply(p_user_id, 'quest', p_quest_id::text, public.coin_reward('boss'));
      END IF;
      PERFORM public.grant_star_coins(p_user_id, p_quest_id, v_best);
      v_level_ups := public.grant_level_up_coins(p_user_id, v_user.current_level, v_level_after);
      v_achieved := public.evaluate_achievements(p_user_id);
    END IF;

    IF v_stage_info IS NULL THEN
      SELECT q.id INTO v_next_id
        FROM public.quests q
       WHERE q.stage_id = v_quest.stage_id
         AND q."order" > v_quest."order"
         AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                          WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed')
       ORDER BY q."order"
       LIMIT 1;
    END IF;
    SELECT u.coins INTO v_coins FROM public.users u WHERE u.id = p_user_id;

    v_reward := jsonb_build_object(
      'already_completed', NOT v_first,
      'xp_gained',         v_xp,
      'total_xp',          v_total_xp,
      'level_before',      v_user.current_level,
      'level_after',       v_level_after,
      'new_badges',        '[]'::jsonb,
      'new_achievements',  v_achieved,
      'stage_cleared',     v_stage_info,
      'next_quest_id',     v_next_id,
      'golden_keys',       v_golden_keys,
      'hints_used',        0,
      'used_golden_key',   false,
      'coins_earned',      v_coins - v_user.coins,
      'coins_balance',     v_coins,
      'level_ups',         v_level_ups,
      'stars',             v_stars,
      'best_stars',        v_best,
      'new_stars',         v_best - v_progress.best_stars,
      'solved_directly',   false,
      'solution_copy',     false,
      'mode',              v_mode,
      'next_review_on',    to_char(CASE WHEN v_mode = 'practice' THEN v_progress.stars_judged_on ELSE v_today END + 1, 'YYYY-MM-DD'));
  END IF;

  RETURN jsonb_build_object(
    'correct',     v_correct,
    'round',       v_round,
    'hearts',      v_hearts,
    'total',       v_total,
    'mode',        v_mode,
    'result',      v_result,
    'explanation', v_explanation,
    'reward',      v_reward);
END;
$$;

COMMENT ON FUNCTION public.boss_answer(UUID, UUID, INTEGER, JSONB) IS
  '보스 배틀 한 문제 채점·하트·승리 보상 (P9-12, §2.3). service_role 전용: /api/quest/boss 가 getUser() 로 확인한 id 만 넘김. 정답은 응답에 없음';

-- ------------------------------------------------------------
-- 6. 권한 + 자기 검증
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.boss_answer(UUID, UUID, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_stage_unlocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boss_answer(UUID, UUID, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_stage_unlocked(UUID, UUID) TO service_role;

DO $$
BEGIN
  IF public.coin_reward('boss') <> 20 OR public.coin_reward('share') <> 15 OR public.coin_reward('project') <> 40 THEN
    RAISE EXCEPTION '[00046] 검증 실패: coin_reward 금액표';
  END IF;
  IF has_function_privilege('anon', 'public.boss_answer(uuid, uuid, integer, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.boss_answer(uuid, uuid, integer, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.boss_answer(uuid, uuid, integer, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.is_stage_unlocked(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00046] 검증 실패: boss_answer·is_stage_unlocked 실행 권한이 service_role 전용이 아님';
  END IF;
  IF has_table_privilege('anon', 'public.boss_runs', 'SELECT')
     OR has_table_privilege('authenticated', 'public.boss_runs', 'SELECT')
     OR has_table_privilege('authenticated', 'public.boss_runs', 'INSERT')
     OR has_table_privilege('authenticated', 'public.boss_runs', 'UPDATE') THEN
    RAISE EXCEPTION '[00046] 검증 실패: boss_runs 가 service_role 전용이 아님';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.is_stage_unlocked(uuid, uuid)'::regprocedure
                    AND prosrc LIKE '%quest_type <> ''quiz''%') THEN
    RAISE EXCEPTION '[00046] 검증 실패: is_stage_unlocked 퀴즈 제외 규칙이 없음';
  END IF;
  RAISE NOTICE '[00046] 보스 배틀: boss_answer service_role 전용, boss_runs 잠김, coin_reward(''boss'') = 20';
END $$;
