-- ============================================================
-- 퀘스트 완료·보상 RPC: complete_quest · use_golden_key · reset_progress + earned_xp   (P1-03, B05·B06·B11·B12)
-- 릴리즈 단계: ① 추가형 (지금 운영 중인 이전 앱이 그대로 동작함)
--
-- 하는 일
--   1. user_progress.earned_xp 컬럼 (이 퀘스트로 실제로 받은 XP. 리셋 때 SUM 으로 total_xp 재계산, B12)
--      + 클라이언트(anon/authenticated)가 earned_xp 를 쓰지 못하게 하는 트리거 (이전 앱은 이 컬럼을 쓰지 않음)
--   2. 보상 규칙 함수 (src/lib/quest/xp.ts·checkBadges.ts 와 같은 규칙. supabase/tests/fixtures/reward-rules.json 으로 대조)
--        quest_xp(base, hints_used, used_golden_key)  황금키 0 / 힌트 0회 1.5배 / 1회 1.25배 / 그 외 기본
--        level_for_xp(total_xp)                        LEVEL_THRESHOLDS [0, 100, 300, 600, 1000]
--        has_three_day_streak(completed_at[])          최근 완료일 3개가 연속 (KST)
--        decide_new_badges(...)                        새로 줄 뱃지 (B11: 황금키를 썼으면 hint_master 없음)
--        is_stage_unlocked(user_id, stage_id)          스테이지 잠금 (src/lib/world/getStageStatuses.ts 와 같은 규칙)
--   3. RPC (SECURITY DEFINER, service_role 전용. API Route 가 auth.getUser() 로 확인한 id 만 넘김, §2.3)
--        complete_quest(p_user_id, p_quest_id, p_submission)  완료 + XP + 레벨 + 뱃지 + 스테이지 클리어를 한 트랜잭션으로
--        use_golden_key(p_user_id, p_quest_id, p_step)        황금키 1개 차감 + used_golden_key 기록
--        reset_progress(p_user_id, p_scope, p_stage_id)       전체/스테이지 리셋 (뱃지 삭제도 여기서, P1-04 대비)
--   4. 기존 완료 행의 earned_xp 백필 + 자기 검증
--
-- 동시성: 세 RPC 모두 users 행 → user_progress 행 순서로 FOR UPDATE 잠금을 잡습니다(교착 방지).
--   같은 사용자의 완료·황금키·리셋은 직렬화되고, completed 로 처음 바뀔 때만 XP·뱃지를 지급합니다.
-- 서버 값: 힌트 수·황금키 사용은 요청 본문이 아니라 user_progress 의 값을 씁니다(B05).
--   ⚠️ hints_used·status 는 P1-04(③)에서 컬럼 권한을 좁히기 전까지 클라이언트가 직접 쓸 수 있습니다(B04-4·11 known-gap).
--
-- 운영 적용 순서 (Phase 1 릴리즈, §12-Q21)
--   ① 이 파일 → ② complete·golden-key·reset API 가 이 RPC 를 부르는 앱 배포
--   → ②-확인 뒤 아래 "4. 백필" 의 UPDATE 를 한 번 더 실행 (①~② 사이 이전 앱이 완료한 행. docs/release/v0.4-runbook.md)
--   적용 후 NOTICE `[00006] 완료 행 N, earned_xp 백필 N (황금키 0 XP N), anon/authenticated 실행 가능 함수 0` 확인
-- 되돌리기: 이 파일의 객체만 지우면 됨 (DROP FUNCTION … , DROP TRIGGER …, ALTER TABLE … DROP COLUMN earned_xp).
--   이전 앱은 이 객체들을 쓰지 않습니다.
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 출발점: spikes/p0-08-answer-keys/grade_quiz_rpc.draft.sql 의 submit_quiz_answer (잠금·1회 지급)
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_progress.earned_xp
--    이 퀘스트를 완료하며 실제로 받은 XP. 황금키로 완료하면 0. 완료 전에는 0.
--    total_xp 는 리셋 때 이 값의 합으로 다시 계산합니다 (B12).
-- ------------------------------------------------------------
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS earned_xp INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.user_progress'::regclass
       AND conname = 'user_progress_earned_xp_nonneg'
  ) THEN
    ALTER TABLE public.user_progress
      ADD CONSTRAINT user_progress_earned_xp_nonneg CHECK (earned_xp >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.user_progress.earned_xp IS
  '이 퀘스트로 받은 XP (서버 전용: complete_quest 만 씀, 클라이언트 쓰기는 트리거가 무시). 리셋 때 SUM 으로 total_xp 재계산 (B12)';

-- 클라이언트 쓰기 무시: 지금은 user_progress 의 INSERT·UPDATE 권한이 테이블 단위라
-- (컬럼 권한은 P1-04 ③) 새 컬럼도 클라이언트가 쓸 수 있습니다. earned_xp 는 리셋의 XP 재계산 기준이므로
-- anon/authenticated 가 쓴 값은 버립니다 (INSERT → 0, UPDATE → 이전 값). 이전 앱은 이 컬럼을 쓰지 않습니다.
-- SECURITY INVOKER: current_user 가 요청한 역할 그대로입니다 (RPC 안에서는 함수 소유자, service_role 은 service_role).
CREATE OR REPLACE FUNCTION public.user_progress_protect_earned_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.earned_xp := 0;
    ELSE
      NEW.earned_xp := OLD.earned_xp;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.user_progress_protect_earned_xp() IS
  'anon/authenticated 가 user_progress.earned_xp 에 쓴 값을 버림 (P1-03). P1-04 컬럼 권한 이후에도 이중 방어로 유지';

REVOKE ALL ON FUNCTION public.user_progress_protect_earned_xp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_user_progress_protect_earned_xp ON public.user_progress;
CREATE TRIGGER trg_user_progress_protect_earned_xp
  BEFORE INSERT OR UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.user_progress_protect_earned_xp();

-- ------------------------------------------------------------
-- 2. 보상 규칙 함수
--    TS 쪽 규칙(src/lib/quest/xp.ts, checkBadges.ts)과 같아야 합니다. 바꾸면 두 곳과
--    supabase/tests/fixtures/reward-rules.json 을 함께 고칩니다 (vitest 와 test:rls 가 같은 표로 대조).
--    순수 함수라 비밀은 없지만, 앱이 쓰지 않으므로 다른 함수와 같이 service_role 만 실행합니다.
-- ------------------------------------------------------------

-- XP: 황금키 0 / 힌트 0회 1.5배 / 1회 1.25배 / 2회 이상 기본 (반올림)
CREATE OR REPLACE FUNCTION public.quest_xp(
  p_base            INTEGER,
  p_hints_used      INTEGER,
  p_used_golden_key BOOLEAN
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
           WHEN p_used_golden_key THEN 0
           WHEN p_hints_used = 0 THEN round(p_base * 1.5)::integer
           WHEN p_hints_used = 1 THEN round(p_base * 1.25)::integer
           ELSE p_base
         END;
$$;

-- 레벨: LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000] 중 넘은 개수 (최소 1)
CREATE OR REPLACE FUNCTION public.level_for_xp(p_total_xp INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT GREATEST(1, (SELECT count(*)::integer
                        FROM unnest(ARRAY[0, 100, 300, 600, 1000]) AS t(threshold)
                       WHERE p_total_xp >= t.threshold));
$$;

-- 3일 연속: 완료한 날(KST)을 최근 순으로 3개 뽑아 하루씩 이어지는지.
-- checkBadges.ts 는 최근 완료 50건만 봤지만 여기서는 모든 완료일을 봅니다 (하루에 50개 넘게 풀면 놓치던 경우).
-- 날짜 기준은 KST (P1-05 에서 앱 전체를 KST 로 통일)
CREATE OR REPLACE FUNCTION public.has_three_day_streak(p_completed_at TIMESTAMPTZ[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH d AS (
    SELECT day, row_number() OVER (ORDER BY day DESC) AS rn
      FROM (SELECT DISTINCT (t AT TIME ZONE 'Asia/Seoul')::date AS day
              FROM unnest(p_completed_at) AS t
             WHERE t IS NOT NULL) x
  )
  SELECT COALESCE(
           (SELECT count(*) = 3
                   AND max(day) FILTER (WHERE rn = 1) - max(day) FILTER (WHERE rn = 2) = 1
                   AND max(day) FILTER (WHERE rn = 2) - max(day) FILTER (WHERE rn = 3) = 1
              FROM d WHERE rn <= 3),
           false);
$$;

-- 새로 줄 뱃지 (checkBadges.ts 의 decideNewBadges 와 같은 순서·규칙)
--   first_code       완료한 퀘스트가 이번 것 하나
--   hint_master      힌트 0회 + 황금키 미사용 (B11)
--   stage_clear      이번 완료로 스테이지의 모든 퀘스트 완료
--   project_builder  최종 프로젝트(is_final 스테이지) 완료
--   streak_3         3일 연속 완료
CREATE OR REPLACE FUNCTION public.decide_new_badges(
  p_earned          TEXT[],
  p_completed_count INTEGER,
  p_stage_cleared   BOOLEAN,
  p_is_final_stage  BOOLEAN,
  p_hints_used      INTEGER,
  p_used_golden_key BOOLEAN,
  p_streak_3        BOOLEAN
)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN NOT ('first_code' = ANY (COALESCE(p_earned, '{}')))
               AND p_completed_count = 1 THEN 'first_code' END,
    CASE WHEN NOT ('hint_master' = ANY (COALESCE(p_earned, '{}')))
               AND p_hints_used = 0 AND NOT COALESCE(p_used_golden_key, false) THEN 'hint_master' END,
    CASE WHEN NOT ('stage_clear' = ANY (COALESCE(p_earned, '{}')))
               AND COALESCE(p_stage_cleared, false) THEN 'stage_clear' END,
    CASE WHEN NOT ('project_builder' = ANY (COALESCE(p_earned, '{}')))
               AND COALESCE(p_is_final_stage, false) THEN 'project_builder' END,
    CASE WHEN NOT ('streak_3' = ANY (COALESCE(p_earned, '{}')))
               AND COALESCE(p_streak_3, false) THEN 'streak_3' END
  ], NULL);
$$;

-- 스테이지 잠금: 첫 스테이지는 항상 열림, 나머지는 바로 앞 스테이지의 퀘스트를 모두 완료해야 열림
-- (src/lib/world/getStageStatuses.ts 와 같은 규칙. P1-08 에서 worlds 가 생기면 이 함수 하나만 고침)
CREATE OR REPLACE FUNCTION public.is_stage_unlocked(p_user_id UUID, p_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH prev AS (
    SELECT p.id
      FROM public.stages s
      JOIN public.stages p ON p."order" < s."order"
     WHERE s.id = p_stage_id
     ORDER BY p."order" DESC
     LIMIT 1
  )
  SELECT NOT EXISTS (SELECT 1 FROM prev)
      OR (
        EXISTS (SELECT 1 FROM public.quests q JOIN prev ON q.stage_id = prev.id)
        AND NOT EXISTS (
          SELECT 1
            FROM public.quests q
            JOIN prev ON q.stage_id = prev.id
           WHERE NOT EXISTS (
             SELECT 1 FROM public.user_progress up
              WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed'))
      );
$$;

-- ------------------------------------------------------------
-- 3-1. complete_quest: 퀘스트 완료 + 보상 (한 트랜잭션)
--   p_submission: {"code": "<제출 코드>", "passed": true|false}
--     passed 는 API Route 가 quest_answer_keys 기준으로 채점한 결과 (src/lib/quest/grade.ts).
--     통과하지 않았으면 완료하지 않습니다. 단, 황금키를 쓴 퀘스트(DB 의 used_golden_key)는 정답 코드를 받았으므로
--     채점 없이 완료할 수 있습니다 (XP 0).
--     hints_used·used_golden_key 가 들어 있어도 쓰지 않습니다 (B05: DB 값 사용).
--   반환 (이번 호출에서 새로 일어난 일):
--     { already_completed, xp_gained, total_xp, level_before, level_after, new_badges[],
--       stage_cleared: null | {stage_id, order, title, concepts[]}, next_quest_id, golden_keys,
--       hints_used, used_golden_key }
--   오류 (message): invalid_arguments(PT400) · submission_too_large(PT413) · quest_not_found(PT404)
--                   user_not_found(PT404) · stage_locked(PT403) · not_passed(PT422)
-- ------------------------------------------------------------
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
  v_xp             INTEGER;
  v_total_xp       INTEGER;
  v_level_after    INTEGER;
  v_golden_keys    INTEGER;
  v_stage_total    INTEGER;
  v_stage_done     INTEGER;
  v_stage_cleared  BOOLEAN;
  v_stage_info     JSONB;
  v_completed      INTEGER;
  v_completions    TIMESTAMPTZ[];
  v_earned         TEXT[];
  v_to_award       TEXT[];
  v_new_badges     TEXT[];
  v_next_quest_id  UUID;
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

  SELECT q.id, q.stage_id, q."order", q.xp_reward, s."order" AS stage_order, s.title AS stage_title, s.is_final
    INTO v_quest
    FROM public.quests q
    JOIN public.stages s ON s.id = q.stage_id
   WHERE q.id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quest_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 잠금 순서: users → user_progress (reset_progress·use_golden_key 와 같음)
  SELECT u.total_xp, u.current_level, u.golden_keys
    INTO v_user
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT up.status, up.hints_used, up.used_golden_key
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

  -- 이미 완료: 아무것도 바꾸지 않고 현재 값만 (중복 클릭·동시 요청·다시 풀기)
  IF v_progress.status = 'completed' THEN
    RETURN jsonb_build_object(
      'already_completed', true,
      'xp_gained',         0,
      'total_xp',          v_user.total_xp,
      'level_before',      v_user.current_level,
      'level_after',       v_user.current_level,
      'new_badges',        '[]'::jsonb,
      'stage_cleared',     NULL,
      'next_quest_id',     v_next_quest_id,
      'golden_keys',       v_user.golden_keys,
      'hints_used',        v_progress.hints_used,
      'used_golden_key',   v_progress.used_golden_key);
  END IF;

  IF NOT public.is_stage_unlocked(p_user_id, v_quest.stage_id) THEN
    RAISE EXCEPTION 'stage_locked' USING ERRCODE = 'PT403';
  END IF;

  IF NOT v_passed AND NOT COALESCE(v_progress.used_golden_key, false) THEN
    RAISE EXCEPTION 'not_passed' USING ERRCODE = 'PT422';
  END IF;

  -- 진행 행이 없으면 만든다 (users 잠금 아래라 동시 INSERT 경합 없음)
  IF v_progress.status IS NULL THEN
    INSERT INTO public.user_progress (user_id, quest_id, status)
    VALUES (p_user_id, p_quest_id, 'in_progress')
    ON CONFLICT (user_id, quest_id) DO NOTHING;
    SELECT up.status, up.hints_used, up.used_golden_key
      INTO v_progress
      FROM public.user_progress up
     WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
       FOR UPDATE;
  END IF;

  -- 보상 계산은 DB 값으로 (B05)
  v_xp := public.quest_xp(v_quest.xp_reward, v_progress.hints_used, v_progress.used_golden_key);

  UPDATE public.user_progress
     SET status         = 'completed',
         completed_at   = NOW(),
         earned_xp      = v_xp,
         code_submitted = COALESCE(v_code, code_submitted)
   WHERE user_id = p_user_id AND quest_id = p_quest_id;

  v_total_xp := v_user.total_xp + v_xp;
  v_level_after := public.level_for_xp(v_total_xp);

  -- 스테이지 클리어 (이번 완료 포함)
  SELECT count(*), count(*) FILTER (WHERE up.status = 'completed')
    INTO v_stage_total, v_stage_done
    FROM public.quests q
    LEFT JOIN public.user_progress up ON up.quest_id = q.id AND up.user_id = p_user_id
   WHERE q.stage_id = v_quest.stage_id;
  v_stage_cleared := v_stage_total > 0 AND v_stage_total = v_stage_done;

  -- 스테이지를 클리어하면 다음 스테이지를 위해 황금키 3개로
  v_golden_keys := CASE WHEN v_stage_cleared THEN 3 ELSE v_user.golden_keys END;

  UPDATE public.users
     SET total_xp      = v_total_xp,
         current_level = v_level_after,
         golden_keys   = v_golden_keys
   WHERE id = p_user_id;

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

  -- 뱃지
  SELECT COALESCE(array_agg(b.badge_type), '{}') INTO v_earned
    FROM public.user_badges b WHERE b.user_id = p_user_id;
  SELECT count(*), array_agg(up.completed_at)
    INTO v_completed, v_completions
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.status = 'completed';

  v_to_award := public.decide_new_badges(
    v_earned,
    v_completed,
    v_stage_cleared,
    v_quest.is_final,
    v_progress.hints_used,
    v_progress.used_golden_key,
    CASE WHEN 'streak_3' = ANY (v_earned) THEN false
         ELSE public.has_three_day_streak(v_completions) END);

  WITH ins AS (
    INSERT INTO public.user_badges (user_id, badge_type)
    SELECT p_user_id, b FROM unnest(v_to_award) AS b
    ON CONFLICT (user_id, badge_type) DO NOTHING
    RETURNING badge_type
  )
  SELECT COALESCE(array_agg(badge_type), '{}') INTO v_new_badges FROM ins;

  RETURN jsonb_build_object(
    'already_completed', false,
    'xp_gained',         v_xp,
    'total_xp',          v_total_xp,
    'level_before',      v_user.current_level,
    'level_after',       v_level_after,
    -- decide_new_badges 순서를 유지 (축하 연출 순서)
    'new_badges',        COALESCE((SELECT jsonb_agg(b ORDER BY o)
                                     FROM unnest(v_to_award) WITH ORDINALITY AS t(b, o)
                                    WHERE b = ANY (v_new_badges)), '[]'::jsonb),
    'stage_cleared',     v_stage_info,
    'next_quest_id',     v_next_quest_id,
    'golden_keys',       v_golden_keys,
    'hints_used',        v_progress.hints_used,
    'used_golden_key',   v_progress.used_golden_key);
END;
$$;

COMMENT ON FUNCTION public.complete_quest(UUID, UUID, JSONB) IS
  '퀘스트 완료·보상 (P1-03). service_role 전용: /api/quest/complete 가 getUser() 로 확인한 id 만 넘김. 처음 완료될 때만 지급';

-- ------------------------------------------------------------
-- 3-2. use_golden_key: 황금키 1개로 정답 코드 받기
--   정답 코드는 API Route 가 quest_answer_keys 에서 읽어 응답합니다(answerKeys.ts). 이 함수는 차감과 기록만.
--   p_step: 프로젝트 퀘스트는 단계 번호(1..단계 수), 코드 퀘스트는 NULL 또는 0
--   코드 퀘스트를 이미 황금키로 열었다면 다시 차감하지 않습니다 (같은 정답을 다시 보여 주는 것뿐, 중복 클릭 대비).
--   반환: { golden_keys, charged, step }
--   오류: invalid_arguments · quest_not_found · user_not_found · invalid_step(PT400) · stage_locked
--         already_completed(PT409) · no_golden_keys(PT402)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.use_golden_key(
  p_user_id  UUID,
  p_quest_id UUID,
  p_step     INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage_id    UUID;
  v_step_count  INTEGER;
  v_golden_keys INTEGER;
  v_progress    RECORD;
  v_charged     BOOLEAN := true;
BEGIN
  IF p_user_id IS NULL OR p_quest_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT q.stage_id,
         CASE WHEN jsonb_typeof(q.prompt_skeleton->'steps') = 'array'
              THEN jsonb_array_length(q.prompt_skeleton->'steps') ELSE 0 END
    INTO v_stage_id, v_step_count
    FROM public.quests q
   WHERE q.id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quest_not_found' USING ERRCODE = 'PT404';
  END IF;

  IF (v_step_count > 0 AND (p_step IS NULL OR p_step < 1 OR p_step > v_step_count))
     OR (v_step_count = 0 AND COALESCE(p_step, 0) <> 0) THEN
    RAISE EXCEPTION 'invalid_step' USING ERRCODE = 'PT400';
  END IF;

  SELECT u.golden_keys INTO v_golden_keys
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  IF NOT public.is_stage_unlocked(p_user_id, v_stage_id) THEN
    RAISE EXCEPTION 'stage_locked' USING ERRCODE = 'PT403';
  END IF;

  INSERT INTO public.user_progress (user_id, quest_id, status)
  VALUES (p_user_id, p_quest_id, 'in_progress')
  ON CONFLICT (user_id, quest_id) DO NOTHING;

  SELECT up.status, up.used_golden_key
    INTO v_progress
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
     FOR UPDATE;

  IF v_progress.status = 'completed' THEN
    RAISE EXCEPTION 'already_completed' USING ERRCODE = 'PT409';
  END IF;

  IF v_step_count = 0 AND v_progress.used_golden_key THEN
    v_charged := false;
  ELSIF v_golden_keys <= 0 THEN
    RAISE EXCEPTION 'no_golden_keys' USING ERRCODE = 'PT402';
  ELSE
    v_golden_keys := v_golden_keys - 1;
    UPDATE public.users SET golden_keys = v_golden_keys WHERE id = p_user_id;
  END IF;

  UPDATE public.user_progress
     SET used_golden_key = true,
         status = 'in_progress'
   WHERE user_id = p_user_id AND quest_id = p_quest_id;

  RETURN jsonb_build_object(
    'golden_keys', v_golden_keys,
    'charged',     v_charged,
    'step',        NULLIF(COALESCE(p_step, 0), 0));
END;
$$;

COMMENT ON FUNCTION public.use_golden_key(UUID, UUID, INTEGER) IS
  '황금키 차감 + used_golden_key 기록 (P1-03, B05). service_role 전용: /api/quest/golden-key';

-- ------------------------------------------------------------
-- 3-3. reset_progress: 진행 리셋 (B12)
--   p_scope = 'all'   : 진행·뱃지 전부 삭제, total_xp 0, 레벨 1, 황금키 3
--   p_scope = 'stage' : p_stage_id 와 그 뒤 스테이지(order 이상)의 진행 삭제
--                       → total_xp = 남은 진행의 earned_xp 합 (황금키로 0 XP 받은 퀘스트를 과다 차감하지 않음)
--                       → stage_clear 뱃지는 모두 완료한 스테이지가 하나도 남지 않을 때만 삭제
--   반환: { scope, reset_stages[{id, order, title}], removed_quests, total_xp, level, golden_keys, removed_badges[] }
--   오류: invalid_arguments · user_not_found · stage_not_found(PT404)
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

  SELECT s."order" INTO v_target_order FROM public.stages s WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'stage_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 대상 스테이지와 그 뒤 스테이지 (뒤 스테이지는 앞 스테이지를 다시 깨야 열리므로 함께 리셋)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'order', s."order", 'title', s.title)
                            ORDER BY s."order"), '[]'::jsonb)
    INTO v_reset_stages
    FROM public.stages s
   WHERE s."order" >= v_target_order;

  WITH d AS (
    DELETE FROM public.user_progress up
     USING public.quests q, public.stages s
     WHERE up.user_id = p_user_id
       AND q.id = up.quest_id
       AND s.id = q.stage_id
       AND s."order" >= v_target_order
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

-- ------------------------------------------------------------
-- 3-4. 권한: 모두 service_role 만 실행 (§2.2. 운영 legacy 는 새 함수에 anon/authenticated EXECUTE 를 자동 부여)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.quest_xp(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.level_for_xp(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_three_day_streak(TIMESTAMPTZ[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_new_badges(TEXT[], INTEGER, BOOLEAN, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_stage_unlocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_quest(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.use_golden_key(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_progress(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.quest_xp(INTEGER, INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.level_for_xp(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_three_day_streak(TIMESTAMPTZ[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_new_badges(TEXT[], INTEGER, BOOLEAN, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_stage_unlocked(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_quest(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_golden_key(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_progress(UUID, TEXT, UUID) TO service_role;

-- ------------------------------------------------------------
-- 4. 백필: 기존 완료 행의 earned_xp (지금 complete API 의 규칙)
--    황금키를 쓴 퀘스트는 0 (이전 앱은 코드 퀘스트에서 황금키로 완료하면 0 XP).
--    ⚠️ 이전 앱의 프로젝트 퀘스트는 중간 단계에서 황금키를 쓰고 마지막 단계를 직접 풀면 XP 를 전부 줬지만,
--       DB 에는 어느 단계에서 썼는지 남아 있지 않아 0 으로 둡니다 (NOTICE 의 "프로젝트 황금키" 수).
--    힌트 보너스는 완료 때 저장된 hints_used 기준 (이전 complete API 가 요청 본문 값을 그대로 저장함).
--    다시 실행해도 안전: earned_xp 가 0 이고 황금키를 쓰지 않은 완료 행만 채움
--    (새 규칙에서 황금키 없이 완료한 행은 항상 xp_reward 이상이므로 이미 채운 행은 건드리지 않음).
--    ② 배포 뒤 이 UPDATE 를 한 번 더 실행해 ①~② 사이에 이전 앱이 완료한 행을 채웁니다 (런북).
-- ------------------------------------------------------------
UPDATE public.user_progress p
   SET earned_xp = public.quest_xp(q.xp_reward, p.hints_used, false)
  FROM public.quests q
 WHERE q.id = p.quest_id
   AND p.status = 'completed'
   AND p.earned_xp = 0
   AND NOT p.used_golden_key;

-- ------------------------------------------------------------
-- 5. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_completed    INT;
  v_filled       INT;
  v_unfilled     INT;
  v_golden       INT;
  v_golden_proj  INT;
  v_mismatch     INT;
  v_exec         TEXT;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE p.earned_xp > 0),
         count(*) FILTER (WHERE NOT p.used_golden_key AND p.earned_xp = 0
                            AND public.quest_xp(q.xp_reward, p.hints_used, false) > 0),
         count(*) FILTER (WHERE p.used_golden_key),
         count(*) FILTER (WHERE p.used_golden_key AND jsonb_typeof(q.prompt_skeleton->'steps') = 'array')
    INTO v_completed, v_filled, v_unfilled, v_golden, v_golden_proj
    FROM public.user_progress p
    JOIN public.quests q ON q.id = p.quest_id
   WHERE p.status = 'completed';

  -- 참고: total_xp 가 earned_xp 합과 다른 사용자 수 (이전 리셋의 과다 차감 등. 다음 스테이지 리셋 때 합으로 맞춰짐)
  SELECT count(*) INTO v_mismatch
    FROM public.users u
   WHERE u.total_xp <> COALESCE((SELECT sum(p.earned_xp) FROM public.user_progress p
                                  WHERE p.user_id = u.id AND p.status = 'completed'), 0);

  -- 이 파일의 함수는 anon/authenticated 가 실행할 수 없어야 함
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_exec
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('quest_xp', 'level_for_xp', 'has_three_day_streak', 'decide_new_badges',
                       'is_stage_unlocked', 'complete_quest', 'use_golden_key', 'reset_progress',
                       'user_progress_protect_earned_xp')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_exec IS NOT NULL THEN
    RAISE EXCEPTION '[00006] anon/authenticated 가 실행할 수 있는 함수: %', v_exec;
  END IF;

  IF v_unfilled <> 0 THEN
    RAISE EXCEPTION '[00006] earned_xp 를 채우지 못한 완료 행 % (황금키 미사용인데 0)', v_unfilled;
  END IF;

  RAISE NOTICE '[00006] 완료 행 %, earned_xp 백필 % (황금키 0 XP %, 그중 프로젝트 황금키 %), total_xp≠합 사용자 %, anon/authenticated 실행 가능 함수 0',
    v_completed, v_filled, v_golden, v_golden_proj, v_mismatch;
END $$;
