-- ============================================================
-- 자랑하기 보상: 하루 1회 15코인 (Idempotent)   (P9-10, §12-Q67 ④, 원장·멱등은 00030, 금액표는 00031)
-- 릴리즈 단계: ① 추가형 (원장 source 허용 값 1개 추가 · coin_reward 에 'share' 행 추가 · 새 함수 1개.
--                       기존 값·권한은 그대로 — 이전 앱은 'share' 를 쓰지 않음)
--
-- 하는 일
--   1. coin_ledger.source 에 'share' 허용 (CHECK 넓히기)
--   2. coin_reward('share') = 15 (TS 사본 src/lib/quest/coins.ts COIN_RULES.share, 대조 reward-rules.json "coins")
--   3. claim_share_reward(user, card_id) (service_role, POST /api/share-cards/reward 가 getUser() 로 확인한 id 만 넘김):
--        - 본인 소유 · 공개 중 · 만료 전인 공유 카드가 있어야 함 (아니면 share_card_not_found) — 카드를 만들고 시트에서 보낸 뒤 부름
--        - 하루 한 번: coin_apply('share', '<KST 오늘 YYYY-MM-DD>', 15). 같은 날 다시·동시에 부르면 already_claimed + 0
--        - 반환 {coins_earned, coins_balance, already_claimed}
--   4. 권한 + 자기 검증
-- 적용 후 NOTICE `[00044] 자랑하기 보상: coin_reward('share') = 15, claim_share_reward service_role 전용` 확인
-- 확인: supabase/tests RW-1(금액표), SHR-1(권한), SHR-2(하루 1회·카드 소유)
-- 되돌리기: supabase/rollback/00044_share_reward.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 원장 source 에 'share'
-- ------------------------------------------------------------
ALTER TABLE public.coin_ledger DROP CONSTRAINT IF EXISTS coin_ledger_source_check;
ALTER TABLE public.coin_ledger ADD CONSTRAINT coin_ledger_source_check
  CHECK (source IN ('quest', 'star', 'quiz', 'mission', 'attendance', 'achievement', 'chest', 'level_up', 'retro', 'spend',
                    'share'));

-- ------------------------------------------------------------
-- 2. coin_reward: 00031 표 + share
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
  '코인 금액표 (P8-04, share P9-10). TS 사본 src/lib/quest/coins.ts, 대조 reward-rules.json coins. 모르는 kind·범위 밖 n 은 0';

REVOKE ALL ON FUNCTION public.coin_reward(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_reward(TEXT, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 3. claim_share_reward
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_share_reward(p_user_id UUID, p_card_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ref   TEXT := to_char(public.kst_today(), 'YYYY-MM-DD');
  v_coins INTEGER;
  v_res   JSONB;
BEGIN
  IF p_user_id IS NULL OR p_card_id IS NULL OR p_card_id !~ '^[A-Za-z0-9_-]{22}$' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 같은 사용자의 받기를 줄 세움 (coin_apply 와 같은 잠금 순서: users 먼저)
  SELECT u.coins INTO v_coins FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 실제로 보낸 카드: 본인 것 · 공개 중 · 만료 전
  IF NOT EXISTS (SELECT 1 FROM public.share_cards c
                  WHERE c.id = p_card_id AND c.user_id = p_user_id AND c.is_public AND c.expires_at > NOW()) THEN
    RAISE EXCEPTION 'share_card_not_found' USING ERRCODE = 'PT404';
  END IF;

  v_res := public.coin_apply(p_user_id, 'share', v_ref, public.coin_reward('share'));
  RETURN jsonb_build_object(
    'coins_earned',    (v_res->>'delta')::integer,
    'coins_balance',   (v_res->>'coins')::integer,
    'already_claimed', NOT (v_res->>'applied')::boolean);
END;
$$;

COMMENT ON FUNCTION public.claim_share_reward(UUID, TEXT) IS
  '자랑하기 보상 (P9-10). service_role 전용: /api/share-cards/reward. 본인 공개 카드가 있을 때 하루 한 번 15코인(원장 share/<KST 날짜>)';

-- ------------------------------------------------------------
-- 4. 권한 + 자기 검증
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.claim_share_reward(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_share_reward(UUID, TEXT) TO service_role;

DO $$
BEGIN
  IF public.coin_reward('share') <> 15 OR public.coin_reward('attendance', 7) <> 30 OR public.coin_reward('project') <> 40 THEN
    RAISE EXCEPTION '[00044] 검증 실패: coin_reward 금액표';
  END IF;
  IF has_function_privilege('anon', 'public.claim_share_reward(uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_share_reward(uuid, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.claim_share_reward(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00044] 검증 실패: claim_share_reward 실행 권한이 service_role 전용이 아님';
  END IF;
  RAISE NOTICE '[00044] 자랑하기 보상: coin_reward(''share'') = 15, claim_share_reward service_role 전용';
END $$;
