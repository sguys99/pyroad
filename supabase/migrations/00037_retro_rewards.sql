-- ============================================================
-- 기존 사용자 소급 보상: 완료 퀘스트 별 채우기 · 퀘스트·별·레벨 업 코인 · 업적 조용히 판정 (Idempotent)
--   (P8-11, §3 F1·F3·F5, 금액 00031 coin_reward, 별 규칙 00032 code_quest_stars, 업적 00036 evaluate_achievements)
-- 릴리즈 단계: ① 추가형 (새 테이블 + 기존 행 값 채우기·원장 행 추가. 함수·권한 변경 없음, 이전 앱도 그대로 동작)
--   묶음 v0.6-phase8 의 마지막 — 00029(레벨 보정)·00030~00032(원장·금액·별)·00036(업적) 뒤에 실행해야 함 (아래 0 이 확인)
--
-- 하는 일 (모두 집합 연산, 사용자 수에 비례하는 문장 수 없음 — 업적 판정만 사용자마다 함수 한 번)
--   0. users 전체 FOR UPDATE: 실행 중 다른 보상 RPC(coin_apply 도 users 먼저 잠금)와 섞이지 않게
--   1. 별 채우기: P8-05 이전에 완료한 코드·프로젝트 행(status completed, best_stars 0, stars_judged_on 없음)
--      stars = best_stars = code_quest_stars(hints_used, used_golden_key) (황금키 1 / 힌트 0회 3 / 1회 2 / 그 외 1)
--      stars_judged_on = 완료한 날(KST) — 판정은 그때 한 것이라 복습 도전은 지금처럼 바로 가능하고, 오늘을 넣으면
--        streak_learning_days(00035)가 오늘을 학습일로 잘못 셈. attempts = max(attempts, 1) (첫 판정 1번, 00036 reviews 기준)
--      퀴즈는 00026 부터 판정 때 별을 적으므로 채울 것 없음
--   2. 코인 (원래 source/ref 그대로 → 이미 받은 것·이후 실시간 지급과 키가 겹쳐 두 번 주지 않음, 원장 UNIQUE):
--        quest/<quest_id>      코드·프로젝트 완료 중 직접 푼 것(황금키 아님 또는 solved_directly_at)  coin_reward('quest') 10
--        star/<quest_id>:<n>   직접 푼 완료(퀴즈 포함)의 별 번호 1..best_stars                       coin_reward('star') 5
--                              (황금키 완료의 별 1개는 통과 표시라 코인 없음, Q59)
--        level_up/<레벨>       Lv 2..current_level (00029 보정 뒤 레벨)                              coin_reward('level_up', n)
--      원장에 같은 키가 없는 것만. 사용자마다 마지막 balance_after 에서 이어 쌓고(창 함수), users.coins 를 마지막 행으로 맞춤
--      (보호 트리거 users_protect_coins 가 원장 마지막 balance_after 와 같은지 확인). 업적 이관분 5종은 받기 가능 상태라 코인 없음(00036)
--   3. retro_rewards: 이번 실행에서 코인을 받은 사용자 1행 (granted_at = 이 트랜잭션 now() = 그 원장 행들의 created_at).
--      월드맵 첫 방문의 "그동안의 모험 보상" 카드(별 보상 수·코인)와 되돌리기의 원장 행 식별에 씀. 본인 행 읽기, seen_at 은 service_role 만
--   4. 업적 조용히 판정: 기록이 있는 사용자마다 evaluate_achievements — 축하 카드 없이 도감 "받기 가능"으로만 남음
--      (안 하면 다음 보상 때 그동안의 업적 카드가 한꺼번에 뜸)
--   5. 자기 검증 + NOTICE (채운 별·코인 합·업적·잔액 = 원장)
--
-- 멱등: 1 은 best_stars 0 행만, 2 는 원장에 없는 키만, 4 는 ON CONFLICT 라 두 번째 실행은 아무것도 바꾸지 않음(retro_rewards 행도 없음).
-- 사전 점검(대상 수·코인 합 예상)·확인·되돌리기: docs/release/v0.6-runbook.md "00037"
-- 적용 후 NOTICE `[00037] 소급 보상: 별 채운 완료 N개, 코인 M명 K개(퀘스트 a · 별 b · 레벨 업 c), 업적 판정 P명 새 업적 Q개, 잔액 = 원장 (어긋난 사용자 0)` 확인
-- 확인: supabase/tests RT-1(옛 상태 리허설·두 번 실행)·RT-2(권한)
-- 되돌리기: supabase/rollback/00037_retro_rewards.rollback.sql (소급 원장 행·조용히 얻은 업적만)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 0. 전제: 00029·00031·00032·00036
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.level_curve_adjustments') IS NULL
     OR to_regprocedure('public.coin_reward(text, integer)') IS NULL
     OR to_regprocedure('public.code_quest_stars(integer, boolean)') IS NULL
     OR to_regprocedure('public.evaluate_achievements(uuid)') IS NULL THEN
    RAISE EXCEPTION '[00037] 00029·00031·00032·00036 을 먼저 적용하세요';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. retro_rewards (2 보다 먼저 만들어 둠)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retro_rewards (
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL,          -- 실행 트랜잭션 시각 = 그 소급 원장 행들의 created_at
  stars      INTEGER NOT NULL DEFAULT 0,     -- 코인을 받은 별 수 (star 원장 행 수)
  coins      INTEGER NOT NULL,               -- 받은 코인 합 (퀘스트·별·레벨 업)
  seen_at    TIMESTAMPTZ,                    -- 환영 카드를 닫은 시각 (/api/retro/seen)
  PRIMARY KEY (user_id, granted_at),
  CONSTRAINT retro_rewards_values_check CHECK (stars >= 0 AND coins > 0)
);

COMMENT ON TABLE public.retro_rewards IS
  '기존 사용자 소급 보상 요약 (P8-11, 00037 만 씀). 월드맵 환영 카드·되돌리기 근거. 본인 행 읽기, seen_at 쓰기는 service_role';

ALTER TABLE public.retro_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.retro_rewards FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.retro_rewards TO authenticated, service_role;
GRANT UPDATE (seen_at) ON TABLE public.retro_rewards TO service_role;

DROP POLICY IF EXISTS "retro_rewards_select_own" ON public.retro_rewards;
CREATE POLICY "retro_rewards_select_own" ON public.retro_rewards
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 1·2·4·5. 소급 + 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_now      TIMESTAMPTZ := now();
  v_filled   INTEGER;
  v_users    INTEGER;
  v_coins    BIGINT;
  v_quest    BIGINT;
  v_star     BIGINT;
  v_level    BIGINT;
  v_rows     INTEGER;
  v_judged   INTEGER;
  v_new_ach  BIGINT;
  v_bad      INTEGER;
BEGIN
  -- 0. 잠금 (users 먼저 — 보상 RPC 와 같은 순서)
  PERFORM 1 FROM public.users ORDER BY id FOR UPDATE;

  -- 1. 별 채우기
  UPDATE public.user_progress up
     SET stars           = public.code_quest_stars(up.hints_used, up.used_golden_key),
         best_stars      = public.code_quest_stars(up.hints_used, up.used_golden_key),
         stars_judged_on = public.kst_date(COALESCE(up.completed_at, up.created_at)),
         attempts        = GREATEST(up.attempts, 1)
    FROM public.quests q
   WHERE q.id = up.quest_id
     AND q.quest_type <> 'quiz'
     AND up.status = 'completed'
     AND up.best_stars = 0
     AND up.stars_judged_on IS NULL;
  GET DIAGNOSTICS v_filled = ROW_COUNT;

  -- 2. 줄 코인 (원장에 없는 키만). rank = 사용자 안에서 쌓는 순서 (퀘스트 → 별 → 레벨)
  CREATE TEMP TABLE IF NOT EXISTS retro_grants (
    user_id UUID    NOT NULL,
    source  TEXT    NOT NULL,
    ref     TEXT    NOT NULL,
    delta   INTEGER NOT NULL,
    rank    INTEGER NOT NULL,
    n       INTEGER NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.retro_grants;  -- 같은 트랜잭션에서 두 번 실행(리허설)

  INSERT INTO pg_temp.retro_grants (user_id, source, ref, delta, rank, n)
  SELECT g.user_id, g.source, g.ref, g.delta, g.rank, g.n
    FROM (
      SELECT up.user_id, 'quest' AS source, up.quest_id::text AS ref, public.coin_reward('quest') AS delta, 1 AS rank, 0 AS n
        FROM public.user_progress up
        JOIN public.quests q ON q.id = up.quest_id
       WHERE up.status = 'completed' AND q.quest_type <> 'quiz'
         AND (NOT up.used_golden_key OR up.solved_directly_at IS NOT NULL)
      UNION ALL
      SELECT up.user_id, 'star', up.quest_id::text || ':' || s.n, public.coin_reward('star'), 2, s.n
        FROM public.user_progress up
        CROSS JOIN LATERAL generate_series(1, LEAST(up.best_stars, 3)) AS s(n)
       WHERE up.status = 'completed' AND up.best_stars > 0
         AND (NOT up.used_golden_key OR up.solved_directly_at IS NOT NULL)
      UNION ALL
      SELECT u.id, 'level_up', l.n::text, public.coin_reward('level_up', l.n), 3, l.n
        FROM public.users u
        CROSS JOIN LATERAL generate_series(2, u.current_level) AS l(n)
    ) g
   WHERE g.delta > 0
     AND NOT EXISTS (SELECT 1 FROM public.coin_ledger c
                      WHERE c.user_id = g.user_id AND c.source = g.source AND c.ref = g.ref);

  -- 사용자마다 마지막 잔액에서 이어 쌓음. id 는 ORDER BY 순서대로 매겨져 마지막 행 = 최종 잔액
  INSERT INTO public.coin_ledger (user_id, delta, balance_after, source, ref, created_at)
  SELECT g.user_id, g.delta,
         b.bal + sum(g.delta) OVER (PARTITION BY g.user_id ORDER BY g.rank, g.ref, g.n ROWS UNBOUNDED PRECEDING),
         g.source, g.ref, v_now
    FROM pg_temp.retro_grants g
    JOIN (SELECT gu.user_id,
                 COALESCE((SELECT c.balance_after FROM public.coin_ledger c
                            WHERE c.user_id = gu.user_id ORDER BY c.id DESC LIMIT 1), 0) AS bal
            FROM (SELECT DISTINCT user_id FROM pg_temp.retro_grants) gu) b
      ON b.user_id = g.user_id
   ORDER BY g.user_id, g.rank, g.ref, g.n;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  UPDATE public.users u
     SET coins = last.balance_after
    FROM (SELECT DISTINCT ON (c.user_id) c.user_id, c.balance_after
            FROM public.coin_ledger c
           WHERE c.user_id IN (SELECT DISTINCT user_id FROM pg_temp.retro_grants)
           ORDER BY c.user_id, c.id DESC) last
   WHERE u.id = last.user_id
     AND u.coins IS DISTINCT FROM last.balance_after;

  -- 3. 요약 (같은 트랜잭션에서 두 번 실행해도 두 번째는 줄 것이 없음)
  INSERT INTO public.retro_rewards (user_id, granted_at, stars, coins)
  SELECT user_id, v_now, count(*) FILTER (WHERE source = 'star'), sum(delta)
    FROM pg_temp.retro_grants
   GROUP BY user_id
  ON CONFLICT (user_id, granted_at) DO NOTHING;

  SELECT count(DISTINCT user_id), COALESCE(sum(delta), 0),
         COALESCE(sum(delta) FILTER (WHERE source = 'quest'), 0),
         COALESCE(sum(delta) FILTER (WHERE source = 'star'), 0),
         COALESCE(sum(delta) FILTER (WHERE source = 'level_up'), 0)
    INTO v_users, v_coins, v_quest, v_star, v_level
    FROM pg_temp.retro_grants;

  -- 4. 업적 조용히 판정 (기록이 있는 사용자만 — 업적 지표는 모두 진행·원장·레벨에서 나옴)
  SELECT count(*), COALESCE(sum(jsonb_array_length(public.evaluate_achievements(u.id))), 0)
    INTO v_judged, v_new_ach
    FROM public.users u
   WHERE u.current_level > 1
      OR EXISTS (SELECT 1 FROM public.user_progress up WHERE up.user_id = u.id AND up.status = 'completed')
      OR EXISTS (SELECT 1 FROM public.coin_ledger c WHERE c.user_id = u.id);

  -- 5. 자기 검증
  IF v_rows <> (SELECT count(*) FROM pg_temp.retro_grants) THEN
    RAISE EXCEPTION '[00037] 검증 실패: 원장 행 % ≠ 줄 코인 %', v_rows, (SELECT count(*) FROM pg_temp.retro_grants);
  END IF;
  SELECT count(*) INTO v_bad
    FROM public.user_progress up JOIN public.quests q ON q.id = up.quest_id
   WHERE q.quest_type <> 'quiz' AND up.status = 'completed' AND up.best_stars = 0;
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '[00037] 검증 실패: 별 0 인 완료 코드 퀘스트 %', v_bad;
  END IF;
  SELECT count(*) INTO v_bad FROM public.users u
   WHERE EXISTS (SELECT 1 FROM generate_series(2, u.current_level) l(n)
                  WHERE NOT EXISTS (SELECT 1 FROM public.coin_ledger c
                                     WHERE c.user_id = u.id AND c.source = 'level_up' AND c.ref = l.n::text));
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '[00037] 검증 실패: 레벨 업 코인이 빠진 사용자 %', v_bad;
  END IF;
  SELECT count(*) INTO v_bad FROM public.coin_balance_mismatches();
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '[00037] 검증 실패: 잔액 ≠ 원장 합 사용자 %', v_bad;
  END IF;
  IF has_table_privilege('anon', 'public.retro_rewards', 'SELECT')
     OR has_table_privilege('authenticated', 'public.retro_rewards', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.retro_rewards', 'INSERT')
     OR NOT has_column_privilege('service_role', 'public.retro_rewards', 'seen_at', 'UPDATE')
     OR has_column_privilege('service_role', 'public.retro_rewards', 'coins', 'UPDATE') THEN
    RAISE EXCEPTION '[00037] 검증 실패: retro_rewards 권한 (본인 읽기·service_role seen_at 만)';
  END IF;

  RAISE NOTICE '[00037] 소급 보상: 별 채운 완료 %개, 코인 %명 %개(퀘스트 % · 별 % · 레벨 업 %), 업적 판정 %명 새 업적 %개, 잔액 = 원장 (어긋난 사용자 0)',
    v_filled, v_users, v_coins, v_quest, v_star, v_level, v_judged, v_new_ach;
END $$;
