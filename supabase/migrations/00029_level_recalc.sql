-- ============================================================
-- 기존 사용자 레벨 재계산 — 레벨이 내려가지 않게 XP 보정 (Idempotent)   (P8-02, §3 F1, §12-Q17)
-- 릴리즈 단계: ① 추가형 (새 테이블 + 기존 행 값 보정. 이전 앱도 그대로 동작)
--
-- 배경
--   00028 이 레벨 곡선을 5단계 [0, 100, 300, 600, 1000] → 50단계 [0, 200, 490, 830, 1210, 1620, …] 로 바꿈.
--   새 곡선은 낮은 레벨 문턱이 더 높아 기존 사용자 일부는 같은 XP 로 레벨이 내려감 (예: 1,000 XP Lv 5 → Lv 4).
--   아이에게 레벨이 내려가는 경험은 나쁘므로 "레벨은 절대 내려가지 않음"을 기본값으로 함 (사용자 확인 항목, P8-02 보고)
--
-- 하는 일
--   1. level_curve_adjustments: 보정 근거 (사용자당 1행, service_role 읽기 전용, 탈퇴하면 함께 지워짐)
--      level_before = 보정 전 레벨, xp_before → xp_after (늘린 XP = 차이). P8-11 소급 보상·잔액 점검이 읽을 수 있음
--   2. 보정: 예전 레벨 L = max(1, min(current_level, 옛 곡선(total_xp))). total_xp 가 새 곡선의 Lv L 문턱보다 작으면
--      total_xp 를 그 문턱으로 올림 → 트리거(00028)가 current_level = L 로 맞춤 (레벨 그대로, 다음 레벨까지 남은 XP 만 늘어남)
--      - min(current_level, …): 옛 앱(v0.1)이 클라이언트에서 current_level 을 직접 쓸 수 있었으므로(B04) total_xp 와 맞는 쪽만 믿음
--      - 옛 레벨은 최대 5 → 문턱 표는 새 곡선의 Lv 1~5 [0, 200, 490, 830, 1210] 만 필요 (아래 자기 검증이 level_for_xp 와 대조)
--   3. 나머지 사용자: current_level 을 level_for_xp(total_xp) 로 맞춤 (UPDATE total_xp = total_xp → 트리거). 1,620 XP 이상은 Lv 6+ 로 오름
--   4. 자기 검증 + NOTICE (이번에 보정한 수·누적 보정 수·레벨 맞춘 수)
--
-- 멱등: 3 이후 모든 행이 current_level = level_for_xp(total_xp) 이고 그 문턱 ≤ total_xp 라 다시 실행해도 보정 대상이 없음.
--   한 사용자는 한 번만 보정 (PK + ON CONFLICT DO NOTHING). 언제 다시 실행해도 새로 가입한 사용자의 XP 를 올리지 않음
-- XP 출처 점검: total_xp ≠ user_progress.earned_xp 합 (이전 리셋 과다 차감·옛 앱 직접 쓰기)은 여기서 고치지 않음 —
--   v0.6 런북 "00029 사전 점검" 쿼리로 수를 보고 판단. 보정 XP 는 earned_xp 에 없으므로 스테이지 리셋(reset_progress 'stage')이
--   total_xp 를 earned_xp 합으로 다시 계산하면 보정분은 사라짐 (리셋은 XP 가 줄어드는 게 정상인 동작이라 그대로 둠)
-- 레벨 업 코인 소급은 P8-11: users.current_level(이 파일 뒤) 기준으로 Lv 2~current_level 의 levelUpCoins 를 주면 되고,
--   보정 사용자도 레벨이 그대로라 따로 다룰 것 없음
-- 전제: 00028 (level_for_xp 50단계·trg_users_sync_level). 없으면 오류로 멈춤
-- 적용 후 NOTICE `[00029] 레벨 재계산: 보정 N명(누적 M명), 레벨 맞춤 K명, 모든 사용자 current_level = level_for_xp(total_xp)` 확인
-- 확인: supabase/tests RW-15 (기존 데이터 리허설·두 번 실행)
-- 되돌리기: supabase/rollback/00029_level_recalc.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 0. 전제: 00028
-- ------------------------------------------------------------
DO $$
BEGIN
  IF public.level_for_xp(1210) <> 5 OR public.level_for_xp(1209) <> 4
     OR NOT EXISTS (SELECT 1 FROM pg_trigger
                     WHERE tgname = 'trg_users_sync_level' AND tgrelid = 'public.users'::regclass) THEN
    RAISE EXCEPTION '[00029] 00028(50단계 level_for_xp·trg_users_sync_level)을 먼저 적용하세요';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. 보정 근거
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.level_curve_adjustments (
  user_id      UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  level_before INTEGER NOT NULL,                  -- 보정 전(옛 곡선) 레벨 = 보정 후 레벨
  xp_before    INTEGER NOT NULL,
  xp_after     INTEGER NOT NULL,                  -- 새 곡선의 Lv level_before 문턱
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT level_curve_adjustments_xp_check CHECK (xp_after > xp_before)
);

COMMENT ON TABLE public.level_curve_adjustments IS
  '레벨 곡선 변경(00028) 때 레벨이 내려가지 않게 올려 준 XP (P8-02). 사용자당 1행, 00029 만 씀. service_role 읽기 전용';

ALTER TABLE public.level_curve_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.level_curve_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.level_curve_adjustments TO service_role;

-- ------------------------------------------------------------
-- 2·3. 보정 + 레벨 맞춤 + 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  -- 새 곡선 Lv 1~5 문턱 (00028 의 앞 5개)
  v_new5     INTEGER[] := ARRAY[0, 200, 490, 830, 1210];
  v_bumped   INTEGER;
  v_synced   INTEGER;
  v_total    INTEGER;
  v_bad      INTEGER;
BEGIN
  FOR i IN 1..5 LOOP
    IF public.level_for_xp(v_new5[i]) <> i OR (i > 1 AND public.level_for_xp(v_new5[i] - 1) <> i - 1) THEN
      RAISE EXCEPTION '[00029] 검증 실패: Lv % 문턱 %가 level_for_xp 와 다름', i, v_new5[i];
    END IF;
  END LOOP;

  WITH old AS (
    SELECT u.id, u.total_xp,
           GREATEST(1, LEAST(u.current_level,
                             (SELECT count(*)::integer
                                FROM unnest(ARRAY[0, 100, 300, 600, 1000]) AS t(threshold)
                               WHERE u.total_xp >= t.threshold))) AS lv
      FROM public.users u
  ), rec AS (
    INSERT INTO public.level_curve_adjustments (user_id, level_before, xp_before, xp_after)
    SELECT o.id, o.lv, o.total_xp, v_new5[o.lv]
      FROM old o
     WHERE o.total_xp < v_new5[o.lv]
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id, xp_after
  )
  UPDATE public.users u
     SET total_xp = rec.xp_after
    FROM rec
   WHERE u.id = rec.user_id;
  GET DIAGNOSTICS v_bumped = ROW_COUNT;

  UPDATE public.users
     SET total_xp = total_xp
   WHERE current_level IS DISTINCT FROM public.level_for_xp(total_xp);
  GET DIAGNOSTICS v_synced = ROW_COUNT;

  SELECT count(*) INTO v_bad FROM public.users
   WHERE current_level IS DISTINCT FROM public.level_for_xp(total_xp);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '[00029] 검증 실패: current_level ≠ level_for_xp(total_xp) 인 사용자 %', v_bad;
  END IF;
  IF has_table_privilege('anon', 'public.level_curve_adjustments', 'SELECT')
     OR has_table_privilege('authenticated', 'public.level_curve_adjustments', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.level_curve_adjustments', 'SELECT') THEN
    RAISE EXCEPTION '[00029] 검증 실패: level_curve_adjustments 가 service_role 전용이 아님';
  END IF;

  SELECT count(*) INTO v_total FROM public.level_curve_adjustments;
  RAISE NOTICE '[00029] 레벨 재계산: 보정 %명(누적 %명), 레벨 맞춤 %명, 모든 사용자 current_level = level_for_xp(total_xp)',
    v_bumped, v_total, v_synced;
END $$;
