-- ============================================================
-- 00012 되돌리기: worlds · quest_type · 별·시도 · quiz_attempts · 프로필 컬럼 · KST 함수 삭제   (P1-08)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 이전 앱으로 되돌린 뒤 실행합니다. 새 앱(P1-08)은 worlds 임베딩(world:worlds(order))·stages.world_id 를 읽으므로
--    이 파일 뒤에는 월드맵·프로필·튜터의 스테이지 조회가 실패합니다.
-- ⚠️ 00013(③)이 적용되어 있으면 먼저 supabase/rollback/00013_auth_user_triggers.rollback.sql 을 실행합니다
--    (handle_new_user 가 last_login_provider 를 씀).
-- ⚠️ 지우는 데이터: quiz_attempts 전체, user_progress 의 stars·best_stars·attempts·stars_judged_on,
--    users 의 nickname·grade·avatar_config·settings·last_login_provider (Phase 1 에서는 앱이 아직 쓰지 않음)
-- 실행 후 상태 = 00011 까지 적용된 상태 (stages UNIQUE("order"), has_three_day_streak·is_stage_unlocked·reset_progress·
--   user_progress_protect_earned_xp 는 00006 본문)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00012_schema_expansion.rollback.sql
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_signed_in') THEN
    RAISE EXCEPTION '[00012 rollback] 00013 이 적용되어 있습니다. 먼저 00013 rollback 을 실행하세요';
  END IF;
  IF EXISTS (SELECT 1 FROM public.stages s JOIN public.worlds w ON w.id = s.world_id WHERE w.slug <> 'python-island') THEN
    RAISE EXCEPTION '[00012 rollback] 1월드가 아닌 스테이지가 있어 stages UNIQUE("order") 로 되돌릴 수 없습니다';
  END IF;
END $$;

-- 7. 함수 본문을 00006 으로 (권한은 CREATE OR REPLACE 가 유지)
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

  SELECT COALESCE(sum(up.earned_xp), 0)::integer INTO v_total_xp
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.status = 'completed';

  UPDATE public.users
     SET total_xp = v_total_xp, current_level = public.level_for_xp(v_total_xp)
   WHERE id = p_user_id;

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

-- 진행 보호 트리거: earned_xp 만 (00006)
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

-- 6. users
DROP INDEX IF EXISTS public.users_nickname_lower_key;
ALTER TABLE public.users DROP COLUMN IF EXISTS nickname;
ALTER TABLE public.users DROP COLUMN IF EXISTS grade;
ALTER TABLE public.users DROP COLUMN IF EXISTS avatar_config;
ALTER TABLE public.users DROP COLUMN IF EXISTS settings;
ALTER TABLE public.users DROP COLUMN IF EXISTS last_login_provider;

-- 5. quiz_attempts
DROP TABLE IF EXISTS public.quiz_attempts;

-- 4. user_progress
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_stars_range;
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_attempts_nonneg;
ALTER TABLE public.user_progress DROP COLUMN IF EXISTS stars;
ALTER TABLE public.user_progress DROP COLUMN IF EXISTS best_stars;
ALTER TABLE public.user_progress DROP COLUMN IF EXISTS attempts;
ALTER TABLE public.user_progress DROP COLUMN IF EXISTS stars_judged_on;

-- 3. quests (validation_type CHECK 는 00001 의 세 가지로. contains_any·all 을 퀘스트 전체 규칙에 쓴 행이 있으면 실패)
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_validation_type_check;
ALTER TABLE public.quests ADD CONSTRAINT quests_validation_type_check
  CHECK (validation_type IN ('output_match', 'contains', 'code_check'));
ALTER TABLE public.quests DROP COLUMN IF EXISTS quest_type;
ALTER TABLE public.quests DROP COLUMN IF EXISTS quiz_kind;
ALTER TABLE public.quests DROP COLUMN IF EXISTS is_mobile_friendly;

-- 2. stages (UNIQUE(world_id, "order") → UNIQUE("order"))
ALTER TABLE public.stages DROP CONSTRAINT IF EXISTS stages_world_id_order_key;
ALTER TABLE public.stages DROP COLUMN IF EXISTS world_id;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.stages'::regclass AND conname = 'stages_order_key') THEN
    ALTER TABLE public.stages ADD CONSTRAINT stages_order_key UNIQUE ("order");
  END IF;
END $$;

-- 1. worlds
DROP TABLE IF EXISTS public.worlds;

-- 0. KST 함수 (has_three_day_streak 는 위에서 00006 본문으로 되돌림)
DROP FUNCTION IF EXISTS public.kst_today();
DROP FUNCTION IF EXISTS public.kst_date(TIMESTAMPTZ);

DO $$
BEGIN
  IF to_regclass('public.worlds') IS NOT NULL OR to_regclass('public.quiz_attempts') IS NOT NULL THEN
    RAISE EXCEPTION '[00012 rollback] worlds/quiz_attempts 가 남아 있습니다';
  END IF;
  RAISE NOTICE '[00012 rollback] worlds·quiz_attempts·새 컬럼·KST 함수 삭제 완료';
END $$;
