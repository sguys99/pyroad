-- ============================================================
-- 00037 되돌리기: 소급으로 넣은 원장 행·조용히 얻은 업적(아직 안 받은 것)을 지우고 잔액을 원장으로 다시 맞춤, retro_rewards 삭제   (P8-11)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P8-11 이전 앱으로 되돌린 뒤 실행합니다 (새 앱은 retro_rewards 가 없으면 환영 카드만 안 보임 — 앱은 그대로 둬도 동작).
-- 소급 원장 행 식별: retro_rewards (user_id, granted_at) 와 같은 사용자 · created_at = granted_at · source quest·star·level_up
--   (00037 이 한 트랜잭션에서 넣어 created_at 이 모두 그 now(). 실시간 지급은 다른 트랜잭션이라 시각이 다름)
-- 잃는 데이터: 소급 코인(그 사용자 잔액에서 빠짐 — 이미 써서 0 미만이 되면 coin_ledger_balance_check 로 전체가 멈춤, 그때는 그 사용자를
--   빼고 판단), 소급 실행 때 얻고 아직 받지 않은 업적(다음 보상 때 다시 판정돼 카드로 뜸). 이미 받은 업적·그 코인은 그대로.
--   채운 별(user_progress stars·best_stars·stars_judged_on)은 기존 기록에서 계산한 맞는 값이고
--   P8-05 뒤의 첫 완료와 구별할 수 없어 남김 (다시 00037 을 실행해도 별은 그대로, 코인만 다시 줌)
-- 실행 후 상태 = 00036 까지 적용된 상태 (다시 00037 을 실행하면 같은 소급을 다시 줌)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00037_retro_rewards.rollback.sql
-- ============================================================

DO $$
DECLARE
  v_rows INTEGER;
  v_ach  INTEGER;
BEGIN
  IF to_regclass('public.retro_rewards') IS NULL THEN
    RAISE NOTICE '[00037 rollback] retro_rewards 없음 — 할 일 없음';
    RETURN;
  END IF;

  PERFORM 1 FROM public.users ORDER BY id FOR UPDATE;

  -- 조용히 얻은 업적 (소급 실행 시각에 얻었고 아직 안 받은 것)
  DELETE FROM public.user_achievements ua
   WHERE ua.claimed_at IS NULL
     AND ua.achieved_at IN (SELECT DISTINCT granted_at FROM public.retro_rewards);
  GET DIAGNOSTICS v_ach = ROW_COUNT;

  -- 소급 원장 행
  DELETE FROM public.coin_ledger c
   USING public.retro_rewards r
   WHERE c.user_id = r.user_id AND c.created_at = r.granted_at
     AND c.source IN ('quest', 'star', 'level_up');
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- 남은 행의 balance_after 를 다시 쌓고 잔액을 마지막 행으로 (보호 트리거가 원장 마지막 행과 같은지 확인)
  UPDATE public.coin_ledger c
     SET balance_after = x.bal
    FROM (SELECT l.id, sum(l.delta) OVER (PARTITION BY l.user_id ORDER BY l.id) AS bal
            FROM public.coin_ledger l
           WHERE l.user_id IN (SELECT user_id FROM public.retro_rewards)) x
   WHERE c.id = x.id AND c.balance_after <> x.bal;

  UPDATE public.users u
     SET coins = COALESCE((SELECT l.balance_after FROM public.coin_ledger l
                            WHERE l.user_id = u.id ORDER BY l.id DESC LIMIT 1), 0)
   WHERE u.id IN (SELECT user_id FROM public.retro_rewards);

  IF EXISTS (SELECT 1 FROM public.coin_balance_mismatches()) THEN
    RAISE EXCEPTION '[00037 rollback] 잔액 ≠ 원장 합 사용자가 남음';
  END IF;

  DROP TABLE public.retro_rewards;
  RAISE NOTICE '[00037 rollback] 소급 원장 행 %개·업적 %개 지움, 잔액 = 원장', v_rows, v_ach;
END $$;

