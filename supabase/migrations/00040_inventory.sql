-- ============================================================
-- 인벤토리·구매·장착 (Idempotent)   (P9-03, §2.3, §3 "코인 밸런스", §12-Q65, 가격·한도는 00039 shop_items)
-- 릴리즈 단계: ① 추가형 (새 테이블 1개·새 함수 3개, 기존 객체는 건드리지 않음 — 이전 앱은 부르지 않음)
--
-- 하는 일
--   1. user_items: 가진 영구 아이템(코스튬·프레임·에디터 테마·펫) (user, item) 1행. 본인 행 읽기만, 쓰기는 purchase_item 만.
--      소모품(황금키·방패)은 여기 넣지 않고 기존 자리에 더함: users.golden_keys · user_streak_shields.shields
--   2. 장착 원본은 따로 두지 않음 (user_equipped 테이블 없음 — 원본이 둘이면 어긋남):
--        아바타 외형 = users.avatar_config {skin, hat, glasses, cape, bg, pet, frame} (P9-05 렌더러가 이것 하나로 그림)
--        에디터 테마 = users.settings.editor_theme (개인 설정, 다른 사람에게 보이지 않음. 설정 API 는 motion·sound 키만 받으므로
--        클라이언트가 이 키를 쓸 길이 없음)
--   3. purchase_item(user, item) (service_role, /api/shop/purchase): users 행 잠금 아래에서
--        없는 아이템 item_not_found · 그만 판 아이템 item_inactive · 가진 영구 아이템 already_owned ·
--        소모품 이번 주(KST 월요일, kst_week_start(kst_today())) 한도 weekly_limit_reached ·
--        방패 2개(00035 CHECK) shields_full · 황금키 3개 golden_keys_full(스테이지를 깨면 3개로 채워지므로 3개 넘게 사면 사라짐) →
--        coin_apply(spend) 로 원장·잔액 함께 차감(모자라면 not_enough_coins) → 인벤토리/황금키/방패에 더함.
--        원장 ref: 영구 `shop:<item>` · 소모품 `shop:<item>:<주 월요일>:<n>` (n = 그 주 몇 번째) — 이번 주 구매 수도 원장으로 셈.
--        같은 사용자 요청은 users 잠금으로 줄 서므로 이중 클릭은 한 번만 사고 두 번째는 already_owned·weekly_limit_reached
--   4. equip_item(user, slot, item|NULL) (service_role, /api/shop/equip): slot = skin·hat·glasses·cape·bg·pet·frame·editor_theme.
--        NULL 이면 벗기(키 제거). skin 은 무료 6색(P3-13, public_avatar_skin 이 아는 값)만, 나머지는 가진 아이템이고 슬롯이 맞아야
--        (not_owned · wrong_slot). 그만 판 아이템도 가지고 있으면 장착 가능
--   5. shop_status(user) (service_role, GET /api/shop): 잔액·황금키·방패·가진 아이템·이번 주 소모품 구매 수·장착
--   6. 권한 + 자기 검증
-- 적용 후 NOTICE `[00040] 인벤토리: user_items 본인 읽기만, purchase_item·equip_item·shop_status service_role 전용` 확인
-- 확인: supabase/tests IV-1~1d(권한), IV-2(구매 규칙·동시), IV-3(장착)
-- 되돌리기: supabase/rollback/00040_inventory.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_items (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL REFERENCES public.shop_items(id),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

COMMENT ON TABLE public.user_items IS
  '가진 영구 아이템 (P9-03). 소모품은 users.golden_keys·user_streak_shields. 본인 행 읽기만, 쓰기는 purchase_item';

ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_items FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.user_items TO authenticated, service_role;

DROP POLICY IF EXISTS "user_items_select_own" ON public.user_items;
CREATE POLICY "user_items_select_own" ON public.user_items
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 3. purchase_item
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4. equip_item
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equip_item(p_user_id UUID, p_slot TEXT, p_item_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item     public.shop_items%ROWTYPE;
  v_avatar   JSONB;
  v_settings JSONB;
BEGIN
  IF p_user_id IS NULL OR p_slot IS NULL
     OR p_slot NOT IN ('skin', 'hat', 'glasses', 'cape', 'bg', 'pet', 'frame', 'editor_theme') THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  IF p_item_id IS NOT NULL THEN
    IF p_slot = 'skin' THEN
      -- 무료 6색 (P3-13). 공개 프로필 동기화와 같은 목록
      IF public.public_avatar_skin(jsonb_build_object('skin', p_item_id)) IS NULL THEN
        RAISE EXCEPTION 'wrong_slot' USING ERRCODE = 'PT400';
      END IF;
    ELSE
      SELECT * INTO v_item FROM public.shop_items i WHERE i.id = p_item_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'PT404';
      END IF;
      -- 코스튬은 자기 슬롯, 펫·프레임·테마는 종류 이름이 슬롯. 소모품은 장착 없음
      IF v_item.kind = 'consumable' OR p_slot <> COALESCE(v_item.slot, v_item.kind) THEN
        RAISE EXCEPTION 'wrong_slot' USING ERRCODE = 'PT400';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.user_items ui WHERE ui.user_id = p_user_id AND ui.item_id = p_item_id) THEN
        RAISE EXCEPTION 'not_owned' USING ERRCODE = 'PT403';
      END IF;
    END IF;
  END IF;

  IF p_slot = 'editor_theme' THEN
    UPDATE public.users
       SET settings = CASE WHEN p_item_id IS NULL THEN settings - 'editor_theme'
                           ELSE settings || jsonb_build_object('editor_theme', p_item_id) END
     WHERE id = p_user_id
    RETURNING avatar_config, settings INTO v_avatar, v_settings;
  ELSE
    UPDATE public.users
       SET avatar_config = CASE WHEN p_item_id IS NULL THEN avatar_config - p_slot
                                ELSE avatar_config || jsonb_build_object(p_slot, p_item_id) END
     WHERE id = p_user_id
    RETURNING avatar_config, settings INTO v_avatar, v_settings;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  RETURN jsonb_build_object(
    'slot',     p_slot,
    'item_id',  p_item_id,
    'equipped', v_avatar || jsonb_build_object('editor_theme', v_settings -> 'editor_theme'));
END;
$$;

COMMENT ON FUNCTION public.equip_item(UUID, TEXT, TEXT) IS
  '장착·벗기 (P9-03). service_role 전용: /api/shop/equip. 외형은 users.avatar_config, 에디터 테마는 users.settings.editor_theme. 가진 아이템·맞는 슬롯만, skin 은 무료 6색';

-- ------------------------------------------------------------
-- 5. shop_status
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shop_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_week DATE := public.kst_week_start(public.kst_today());
BEGIN
  SELECT * INTO v_user FROM public.users u WHERE u.id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  RETURN jsonb_build_object(
    'coins',       v_user.coins,
    'golden_keys', v_user.golden_keys,
    'shields',     COALESCE((SELECT s.shields FROM public.user_streak_shields s WHERE s.user_id = p_user_id), 0),
    'week_start',  to_char(v_week, 'YYYY-MM-DD'),
    'owned',       COALESCE((SELECT jsonb_agg(ui.item_id ORDER BY ui.acquired_at, ui.item_id)
                               FROM public.user_items ui WHERE ui.user_id = p_user_id), '[]'::jsonb),
    'bought_this_week', COALESCE((
      SELECT jsonb_object_agg(t.item_id, t.n) FROM (
        SELECT split_part(l.ref, ':', 2) AS item_id, count(*) AS n
          FROM public.coin_ledger l
         WHERE l.user_id = p_user_id AND l.source = 'spend'
           AND l.ref LIKE 'shop:%:' || v_week::text || ':%'
         GROUP BY 1) t), '{}'::jsonb),
    'equipped',    v_user.avatar_config || jsonb_build_object('editor_theme', v_user.settings -> 'editor_theme'));
END;
$$;

COMMENT ON FUNCTION public.shop_status(UUID) IS
  '상점 상태 (P9-03). service_role 전용: GET /api/shop. 잔액·황금키·방패·가진 아이템·이번 주(KST 월요일) 소모품 구매 수·장착';

-- ------------------------------------------------------------
-- 6. 권한 + 자기 검증
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.purchase_item(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equip_item(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_status(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_item(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.equip_item(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_status(UUID) TO service_role;

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['public.purchase_item(uuid, text)', 'public.equip_item(uuid, text, text)',
                              'public.shop_status(uuid)'] LOOP
    IF has_function_privilege('anon', v_fn::regprocedure, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn::regprocedure, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION '[00040] 검증 실패: % 실행 권한이 service_role 전용이 아님', v_fn;
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.user_items', 'SELECT')
     OR has_table_privilege('authenticated', 'public.user_items', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_items', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.user_items', 'DELETE')
     OR has_table_privilege('service_role', 'public.user_items', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.user_items', 'SELECT') THEN
    RAISE EXCEPTION '[00040] 검증 실패: user_items 권한 (본인 읽기만, 쓰기는 purchase_item)';
  END IF;
  RAISE NOTICE '[00040] 인벤토리: user_items 본인 읽기만, purchase_item·equip_item·shop_status service_role 전용';
END $$;
