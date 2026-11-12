-- ============================================================
-- 상점 아이템 카탈로그·가격표 + KST 주 시작 함수 (Idempotent)
--   (P9-01, §3 "코인 밸런스", §12-Q65 확정가, 근거 docs/balance.md "상점 가격표")
-- 릴리즈 단계: ① 추가형 (새 테이블 1개·새 함수 1개, 기존 객체는 건드리지 않음 — 이전 앱은 읽지 않음)
--
-- 하는 일
--   1. shop_items (정의, 로그인 사용자 읽기만): id·kind(costume|frame|editor_theme|pet|consumable)·slot(코스튬만 hat|glasses|cape|bg)·
--      name·description·price·rarity(common|rare|epic)·weekly_limit(소모품만, 한 주에 살 수 있는 개수)·sort·is_active.
--      원본은 src/lib/shop/catalog.ts 이고 이 표는 구매 RPC(P9-03)가 가격·한도를 서버에서 읽으려고 둔 사본.
--      vitest src/lib/shop/__tests__/catalog.test.ts 가 이 INSERT 를 읽어 열마다 대조(드리프트 테스트).
--      값을 바꿀 때는 새 마이그레이션에 같은 INSERT … ON CONFLICT DO UPDATE (테스트는 모든 마이그레이션의 마지막 값을 봄).
--      그만 팔 때는 지우지 않고 is_active = false (인벤토리·avatar_config 에 id 가 남음)
--      가격 범위 CHECK = §12-Q65: 코스튬 150~900 · 프레임 300 · 테마 450 · 펫 900~1,500 · 소모품 180~240
--   2. kst_week_start(date): 그 날짜가 든 주의 월요일 (상점 주 구매 한도의 "한 주" = KST 월 00:00 ~ 일 24:00,
--      TS src/lib/time/kst.ts kstWeekStart, 대조 reward-rules.json kst_week). 쓰는 곳은 P9-03 구매 RPC(service_role)
--   3. 권한 + 자기 검증
-- 적용 후 NOTICE `[00039] 상점 아이템 22종: 로그인 사용자 읽기만, kst_week_start service_role 전용` 확인
-- 확인: supabase/tests SH-1(읽기·쓰기 권한), RW-1(kst_week)
-- 되돌리기: supabase/rollback/00039_shop_items.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. shop_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_items (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  slot         TEXT,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  price        INTEGER NOT NULL,
  rarity       TEXT NOT NULL,
  weekly_limit INTEGER,
  sort         INTEGER NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT shop_items_id_format CHECK (id ~ '^[a-z][a-z0-9_]{1,39}$'),
  CONSTRAINT shop_items_kind_check CHECK (kind IN ('costume', 'frame', 'editor_theme', 'pet', 'consumable')),
  CONSTRAINT shop_items_slot_check CHECK (
    (kind = 'costume' AND slot IN ('hat', 'glasses', 'cape', 'bg')) OR (kind <> 'costume' AND slot IS NULL)),
  CONSTRAINT shop_items_rarity_check CHECK (rarity IN ('common', 'rare', 'epic')),
  CONSTRAINT shop_items_price_range CHECK (
    CASE kind
      WHEN 'costume'      THEN price BETWEEN 150 AND 900
      WHEN 'frame'        THEN price = 300
      WHEN 'editor_theme' THEN price = 450
      WHEN 'pet'          THEN price BETWEEN 900 AND 1500
      WHEN 'consumable'   THEN price BETWEEN 180 AND 240
    END),
  CONSTRAINT shop_items_weekly_limit_check CHECK (
    (kind = 'consumable' AND weekly_limit > 0) OR (kind <> 'consumable' AND weekly_limit IS NULL))
);

COMMENT ON TABLE public.shop_items IS
  '상점 아이템 카탈로그 (P9-01). 원본 src/lib/shop/catalog.ts 의 사본(드리프트 테스트). 로그인 사용자 읽기만, 마이그레이션이 upsert. 구매는 P9-03 RPC';

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shop_items FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.shop_items TO authenticated, service_role;

DROP POLICY IF EXISTS "shop_items_select_all" ON public.shop_items;
CREATE POLICY "shop_items_select_all" ON public.shop_items
  FOR SELECT TO authenticated
  USING (true);

-- 정의 (다시 실행하면 이 표대로). 순서·값은 catalog.ts SHOP_ITEMS 와 같게
INSERT INTO public.shop_items (id, kind, slot, name, description, price, rarity, weekly_limit, sort) VALUES
  ('hat_party',     'costume',      'hat',     '파티 고깔',       '줄무늬 고깔모자를 쓰면 매일이 생일 같아요!',   150,  'common', NULL, 10),
  ('glasses_round', 'costume',      'glasses', '동글 안경',       '똑똑해 보이는 동그란 안경이에요.',             150,  'common', NULL, 20),
  ('bg_paper',      'costume',      'bg',      '모험 공책 배경',  '모험 공책 한 장 위에 파이뱀이 서요.',          150,  'common', NULL, 30),
  ('hat_explorer',  'costume',      'hat',     '탐험가 모자',     '정글도 사막도 문제없는 챙 넓은 모자예요.',     300,  'common', NULL, 40),
  ('glasses_sun',   'costume',      'glasses', '멋쟁이 선글라스', '햇살이 쨍쨍해도 끄떡없어요.',                  300,  'common', NULL, 50),
  ('cape_hero',     'costume',      'cape',    '영웅 망토',       '바람에 펄럭이는 빨간 망토예요.',               450,  'rare',   NULL, 60),
  ('hat_wizard',    'costume',      'hat',     '마법사 모자',     '별이 반짝이는 코딩 마법사 모자예요.',          600,  'rare',   NULL, 70),
  ('bg_island',     'costume',      'bg',      '파이썬 섬 배경',  '모험이 시작된 파이썬 섬을 뒤에 둬요.',         600,  'rare',   NULL, 80),
  ('cape_night',    'costume',      'cape',    '밤하늘 망토',     '별빛처럼 깊은 파란 망토예요.',                 750,  'rare',   NULL, 90),
  ('hat_crown',     'costume',      'hat',     '황금 왕관',       '코드 왕국의 주인만 쓸 수 있는 왕관이에요!',    900,  'epic',   NULL, 100),
  ('frame_sprout',  'frame',        NULL,      '새싹 테두리',     '파릇파릇 새싹이 아바타를 감싸요.',             300,  'common', NULL, 110),
  ('frame_star',    'frame',        NULL,      '별빛 테두리',     '작은 별들이 아바타 둘레에서 반짝여요.',        300,  'common', NULL, 120),
  ('frame_wave',    'frame',        NULL,      '파도 테두리',     '시원한 파도가 아바타를 둘러요.',               300,  'common', NULL, 130),
  ('theme_night',   'editor_theme', NULL,      '밤하늘 공책',     '어두운 밤하늘 색 공책에서 코드를 써요.',       450,  'common', NULL, 210),
  ('theme_ocean',   'editor_theme', NULL,      '바다 공책',       '맑은 바닷물 색 공책이에요.',                   450,  'common', NULL, 220),
  ('theme_candy',   'editor_theme', NULL,      '솜사탕 공책',     '달콤한 분홍빛 공책이에요.',                    450,  'common', NULL, 230),
  ('pet_chick',     'pet',          NULL,      '삐약이',          '노란 병아리가 지도 위를 졸졸 따라와요.',       900,  'rare',   NULL, 310),
  ('pet_turtle',    'pet',          NULL,      '꼬북이',          '느려도 끝까지 가는 아기 거북이에요.',          1100, 'rare',   NULL, 320),
  ('pet_fox',       'pet',          NULL,      '여울이',          '꼬리가 복슬복슬한 아기 여우예요.',             1300, 'rare',   NULL, 330),
  ('pet_dragon',    'pet',          NULL,      '용용이',          '작은 날개를 파닥이는 아기 용이에요!',          1500, 'epic',   NULL, 340),
  ('streak_shield', 'consumable',   NULL,      '스트릭 방패',     '하루 쉬어도 불꽃이 꺼지지 않게 지켜 줘요. 한 주에 1개만 살 수 있어요.', 180, 'common', 1, 410),
  ('golden_key',    'consumable',   NULL,      '황금키',          '꽉 막힌 퀘스트 하나를 열어 줘요. 한 주에 1개만 살 수 있어요.',          240, 'common', 1, 420)
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind, slot = EXCLUDED.slot, name = EXCLUDED.name, description = EXCLUDED.description,
  price = EXCLUDED.price, rarity = EXCLUDED.rarity, weekly_limit = EXCLUDED.weekly_limit, sort = EXCLUDED.sort;

-- ------------------------------------------------------------
-- 2. kst_week_start
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kst_week_start(p_day DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT p_day - (extract(isodow FROM p_day)::integer - 1);
$$;

COMMENT ON FUNCTION public.kst_week_start(DATE) IS
  'KST 날짜 → 그 주 월요일 (P9-01 상점 주 구매 한도). 이번 주 = public.kst_week_start(public.kst_today()). TS kstWeekStart';

REVOKE ALL ON FUNCTION public.kst_week_start(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kst_week_start(DATE) TO service_role;

-- ------------------------------------------------------------
-- 3. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT[] := '{}';
  v_n   INTEGER;
BEGIN
  SELECT count(*) INTO v_n FROM public.shop_items WHERE is_active;
  IF v_n < 22 THEN
    v_bad := v_bad || '아이템 22종 미만'::TEXT;
  END IF;
  IF (SELECT count(*) FROM public.shop_items WHERE id IN ('golden_key', 'streak_shield') AND weekly_limit = 1) <> 2 THEN
    v_bad := v_bad || '황금키·방패 주 1개 한도'::TEXT;
  END IF;
  IF public.kst_week_start(DATE '2026-11-15') <> DATE '2026-11-09'
     OR public.kst_week_start(DATE '2026-11-16') <> DATE '2026-11-16' THEN
    v_bad := v_bad || 'kst_week_start'::TEXT;
  END IF;
  IF has_table_privilege('anon', 'public.shop_items', 'SELECT')
     OR has_table_privilege('authenticated', 'public.shop_items', 'INSERT')
     OR has_table_privilege('authenticated', 'public.shop_items', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.shop_items', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.shop_items', 'SELECT')
     OR has_function_privilege('anon', 'public.kst_week_start(date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.kst_week_start(date)', 'EXECUTE') THEN
    v_bad := v_bad || '권한'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00039] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00039] 상점 아이템 %종: 로그인 사용자 읽기만, kst_week_start service_role 전용', v_n;
END $$;
