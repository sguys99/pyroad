-- ============================================================
-- 코인 원장 + 잔액 캐시 + 지급·차감 RPC (서버 전용) + 부분 리셋이 퀘스트 밖 XP 를 지키게 (Idempotent)
--   (P8-03, B55, §2.2 coin_ledger·users.coins, §3 "초기 코인 밸런스안", §12-Q63)
-- 릴리즈 단계: ① 추가형 (새 컬럼·테이블·함수 + reset_progress 본문 교체. 인자·반환·권한 그대로라 이전 앱도 그대로 동작)
--
-- 하는 일
--   1. users.coins: 잔액 캐시 (0 이상). 클라이언트 쓰기 금지 — ③ 00008 이후 authenticated 는 users 테이블 UPDATE 권한이 없고
--      (컬럼 권한만), 보호 트리거 users_protect_coins 가 이중 방어:
--        anon·authenticated 가 쓴 값은 버림(①만 적용된 DB 대비, user_progress_protect_earned_xp 와 같은 방식),
--        그 밖의 역할(service_role·스크립트)은 "그 사용자 원장 마지막 행의 balance_after" 와 다른 값이면 오류(coins_ledger_only)
--        → 잔액은 원장(coin_apply)으로만 바뀜. INSERT 는 항상 0 (가입 = 원장 없음)
--   2. coin_ledger: 모든 코인 증감 1건 = 1행 (추가만, 고치거나 지우는 경로 없음. 탈퇴하면 CASCADE)
--        delta ≠ 0 · source(아래 목록) · ref(멱등 키, 1~200자) · balance_after(그 행 직후 잔액 ≥ 0)
--        UNIQUE (user_id, source, ref) = 멱등 지급: 같은 키로 다시 부르면 0 지급
--        source: quest · star · quiz · mission · attendance · achievement · chest · level_up · retro (지급, delta > 0)
--                spend (차감, delta < 0. Phase 9 상점·방패 등. ref 로 무엇을 샀는지 구분)
--        ref 형식(P8-04~11 이 따름): `<대상 id>` 또는 `<대상 id>:<회차>` — 예 quest `<quest_id>`, star `<quest_id>:<별 번호>`,
--          level_up `<레벨>`, mission `<KST 날짜>:<미션 id>`, attendance `<KST 날짜>`, chest `<stage_id>`, achievement `<업적 id>`
--      권한: RLS + 본인 행 SELECT(authenticated). 쓰기 권한은 아무에게도 없음(service_role 도 SELECT 만, 쓰기는 아래 함수 소유자)
--   3. coin_apply(user, source, ref, delta): 내부 헬퍼 (SECURITY INVOKER, 소유자만 실행 — 다른 SECURITY DEFINER RPC 가 안에서 부름).
--        users 행 FOR UPDATE 잠금 → 같은 키가 있으면 {applied:false, delta:0} → 잔액 부족이면 not_enough_coins(PT402)
--        → 원장 INSERT + users.coins 갱신을 한 트랜잭션에. 반환 {applied, delta, coins, source, ref}
--        잠금 순서는 다른 보상 RPC 와 같이 users 먼저 (complete_quest 등이 이미 users 를 잠근 채 불러도 됨)
--   4. grant_coins(user, source, ref, amount) / spend_coins(user, ref, amount): service_role 전용 SECURITY DEFINER 래퍼
--      (TS: src/lib/quest/rewardRpc.ts grantCoinsRpc·spendCoinsRpc). spend 도 같은 ref 면 한 번만 차감(재시도 안전)
--   5. coin_balance_mismatches(): users.coins ≠ 원장 합인 사용자 (service_role 전용, 완료 기준 "잔액 = 원장 합"). 정상이면 0행
--   6. B55 reset_progress: 00027 정의 + 스테이지(부분) 리셋의 total_xp 를 "남은 earned_xp 합"으로 다시 계산하던 것을
--      total_xp − (지운 진행 행의 earned_xp 합) (0 미만 없음) 으로 → 퀘스트 밖 XP(P8-02 레벨 보정, P8-07 미션 15 XP)를 지킴.
--      전체 리셋은 그대로 0. 코인은 어느 리셋도 회수하지 않고, 원장이 남아 있으므로 리셋 뒤 같은 퀘스트를 다시 풀어도
--      같은 키의 최초 보상 코인은 다시 받지 않음 (리셋 → 재풀이 코인 파밍 차단, 메인 결정 P8-03)
--   7. 권한 다시 적음 + 자기 검증
--   ⚠️ 00027 (또는 00006·00012) 파일을 다시 실행하면 reset_progress 가 그 정의로 돌아갑니다. 다시 실행했다면 00030 도 다시 실행
-- 적용 후 NOTICE `[00030] 코인 원장: service_role 전용 RPC·본인 행 읽기·보호 트리거, 잔액 = 원장 합 (어긋난 사용자 0), reset_progress B55` 확인
-- 확인: supabase/tests B04-13, CN-1~6, RPC-6, RW-7·RW-8
-- 되돌리기: supabase/rollback/00030_coin_ledger.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. users.coins (잔액 캐시)
-- ------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_coins_nonneg;
ALTER TABLE public.users ADD CONSTRAINT users_coins_nonneg CHECK (coins >= 0);
COMMENT ON COLUMN public.users.coins IS
  '코인 잔액 캐시 (P8-03). coin_ledger 합과 같음. grant_coins·spend_coins(coin_apply)만 바꿈, 클라이언트 쓰기 금지';

-- ------------------------------------------------------------
-- 2. coin_ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delta         INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  source        TEXT NOT NULL,
  ref           TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coin_ledger_delta_check CHECK (delta <> 0),
  CONSTRAINT coin_ledger_source_check CHECK (source IN ('quest', 'star', 'quiz', 'mission', 'attendance',
                                                        'achievement', 'chest', 'level_up', 'retro', 'spend')),
  CONSTRAINT coin_ledger_sign_check CHECK ((source = 'spend') = (delta < 0)),
  CONSTRAINT coin_ledger_balance_check CHECK (balance_after >= 0),
  CONSTRAINT coin_ledger_ref_check CHECK (char_length(ref) BETWEEN 1 AND 200),
  CONSTRAINT coin_ledger_key UNIQUE (user_id, source, ref)
);
CREATE INDEX IF NOT EXISTS coin_ledger_user_id_idx ON public.coin_ledger (user_id, id);

COMMENT ON TABLE public.coin_ledger IS
  '코인 원장 (P8-03). 증감 1건 = 1행, (user_id, source, ref) 유일 = 멱등. 쓰기는 coin_apply 만, 본인 행 읽기';

ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.coin_ledger FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.coin_ledger TO authenticated, service_role;

DROP POLICY IF EXISTS "coin_ledger_select_own" ON public.coin_ledger;
CREATE POLICY "coin_ledger_select_own" ON public.coin_ledger
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 1'. 보호 트리거 (원장 테이블이 있어야 하므로 여기서)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_protect_coins()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.coins := 0;
  ELSIF NEW.coins IS DISTINCT FROM OLD.coins THEN
    IF current_user IN ('anon', 'authenticated') THEN
      NEW.coins := OLD.coins;
    ELSIF NEW.coins IS DISTINCT FROM COALESCE((SELECT l.balance_after FROM public.coin_ledger l
                                                WHERE l.user_id = NEW.id ORDER BY l.id DESC LIMIT 1), 0) THEN
      RAISE EXCEPTION 'coins_ledger_only' USING ERRCODE = 'PT400',
        HINT = 'users.coins 는 grant_coins·spend_coins 로만 바꿉니다 (P8-03)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.users_protect_coins() IS
  'users.coins 보호 (P8-03): INSERT 는 0, anon/authenticated 가 쓴 값은 버림, 그 밖에는 원장 마지막 balance_after 와 같아야 함';

REVOKE ALL ON FUNCTION public.users_protect_coins() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_users_protect_coins ON public.users;
CREATE TRIGGER trg_users_protect_coins
  BEFORE INSERT OR UPDATE OF coins ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_protect_coins();

-- ------------------------------------------------------------
-- 3. coin_apply: 내부 헬퍼 (소유자만 실행)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coin_apply(
  p_user_id UUID,
  p_source  TEXT,
  p_ref     TEXT,
  p_delta   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_coins INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_source IS NULL OR p_ref IS NULL OR p_delta IS NULL
     OR p_delta = 0 OR abs(p_delta) > 100000
     OR char_length(p_ref) NOT BETWEEN 1 AND 200
     OR (p_source = 'spend') <> (p_delta < 0) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT u.coins INTO v_coins
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- users 행 잠금이 같은 사용자의 호출을 줄 세우므로 여기서 본 "없음"은 INSERT 까지 유효
  IF EXISTS (SELECT 1 FROM public.coin_ledger l
              WHERE l.user_id = p_user_id AND l.source = p_source AND l.ref = p_ref) THEN
    RETURN jsonb_build_object('applied', false, 'delta', 0, 'coins', v_coins, 'source', p_source, 'ref', p_ref);
  END IF;

  IF v_coins + p_delta < 0 THEN
    RAISE EXCEPTION 'not_enough_coins' USING ERRCODE = 'PT402';
  END IF;

  BEGIN
    INSERT INTO public.coin_ledger (user_id, delta, balance_after, source, ref)
    VALUES (p_user_id, p_delta, v_coins + p_delta, p_source, p_ref);
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';  -- 모르는 source
  END;
  UPDATE public.users SET coins = v_coins + p_delta WHERE id = p_user_id;

  RETURN jsonb_build_object('applied', true, 'delta', p_delta, 'coins', v_coins + p_delta, 'source', p_source, 'ref', p_ref);
END;
$$;

COMMENT ON FUNCTION public.coin_apply(UUID, TEXT, TEXT, INTEGER) IS
  '코인 증감 내부 헬퍼 (P8-03). 소유자만 실행: grant_coins·spend_coins·보상 RPC(SECURITY DEFINER) 안에서 부름. 멱등·잔액 부족 거부·원장과 잔액을 함께';

REVOKE ALL ON FUNCTION public.coin_apply(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. grant_coins / spend_coins (service_role 전용)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_coins(
  p_user_id UUID,
  p_source  TEXT,
  p_ref     TEXT,
  p_amount  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_source = 'spend' OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  RETURN public.coin_apply(p_user_id, p_source, p_ref, p_amount);
END;
$$;

COMMENT ON FUNCTION public.grant_coins(UUID, TEXT, TEXT, INTEGER) IS
  '코인 지급 (P8-03). service_role 전용. 같은 (user, source, ref) 는 한 번만 — 다시 부르면 applied=false, delta 0';

CREATE OR REPLACE FUNCTION public.spend_coins(
  p_user_id UUID,
  p_ref     TEXT,
  p_amount  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  RETURN public.coin_apply(p_user_id, 'spend', p_ref, -p_amount);
END;
$$;

COMMENT ON FUNCTION public.spend_coins(UUID, TEXT, INTEGER) IS
  '코인 차감 (P8-03, 상점은 Phase 9). service_role 전용. 잔액 부족이면 not_enough_coins(PT402), 같은 ref 는 한 번만';

REVOKE ALL ON FUNCTION public.grant_coins(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_coins(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_coins(UUID, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_coins(UUID, TEXT, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 5. 정합성 점검: 잔액 ≠ 원장 합 (정상이면 0행)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coin_balance_mismatches()
RETURNS TABLE (user_id UUID, coins INTEGER, ledger_sum BIGINT)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT u.id, u.coins, COALESCE(s.total, 0)
    FROM public.users u
    LEFT JOIN (SELECT l.user_id, sum(l.delta) AS total FROM public.coin_ledger l GROUP BY l.user_id) s
      ON s.user_id = u.id
   WHERE u.coins <> COALESCE(s.total, 0);
$$;

COMMENT ON FUNCTION public.coin_balance_mismatches() IS
  '잔액 캐시 점검 (P8-03): users.coins ≠ coin_ledger 합인 사용자. service_role 전용, 정상이면 0행';

REVOKE ALL ON FUNCTION public.coin_balance_mismatches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_balance_mismatches() TO service_role;

-- ------------------------------------------------------------
-- 6. B55 reset_progress: 00027 + 부분 리셋은 지운 행의 earned_xp 만 뺌 (코인은 건드리지 않음)
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

REVOKE ALL ON FUNCTION public.reset_progress(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_progress(UUID, TEXT, UUID) TO service_role;

-- ------------------------------------------------------------
-- 7. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_fn  TEXT;
  v_bad INTEGER;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['public.grant_coins(uuid, text, text, integer)', 'public.spend_coins(uuid, text, integer)',
                              'public.coin_balance_mismatches()', 'public.reset_progress(uuid, text, uuid)'] LOOP
    IF has_function_privilege('anon', v_fn::regprocedure, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn::regprocedure, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION '[00030] 검증 실패: % 실행 권한이 service_role 전용이 아님', v_fn;
    END IF;
  END LOOP;
  IF has_function_privilege('service_role', 'public.coin_apply(uuid, text, text, integer)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.coin_apply(uuid, text, text, integer)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION '[00030] 검증 실패: coin_apply 는 소유자만 실행해야 함';
  END IF;
  IF has_table_privilege('anon', 'public.coin_ledger', 'SELECT')
     OR has_table_privilege('authenticated', 'public.coin_ledger', 'INSERT')
     OR has_table_privilege('authenticated', 'public.coin_ledger', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.coin_ledger', 'DELETE')
     OR has_table_privilege('service_role', 'public.coin_ledger', 'INSERT')
     OR has_table_privilege('service_role', 'public.coin_ledger', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.coin_ledger', 'SELECT') THEN
    RAISE EXCEPTION '[00030] 검증 실패: coin_ledger 권한 (본인 읽기만, 쓰기 없음)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname = 'trg_users_protect_coins' AND tgrelid = 'public.users'::regclass) THEN
    RAISE EXCEPTION '[00030] 검증 실패: trg_users_protect_coins 없음';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.reset_progress(uuid, text, uuid)'::regprocedure
                    AND prosecdef AND prosrc LIKE '%v_removed_xp%' AND prosrc LIKE '%DELETE FROM public.quiz_attempts%') THEN
    RAISE EXCEPTION '[00030] 검증 실패: reset_progress 에 B55 규칙이 없음';
  END IF;
  SELECT count(*) INTO v_bad FROM public.coin_balance_mismatches();
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '[00030] 검증 실패: 잔액 ≠ 원장 합 사용자 %', v_bad;
  END IF;
  RAISE NOTICE '[00030] 코인 원장: service_role 전용 RPC·본인 행 읽기·보호 트리거, 잔액 = 원장 합 (어긋난 사용자 0), reset_progress B55';
END $$;
