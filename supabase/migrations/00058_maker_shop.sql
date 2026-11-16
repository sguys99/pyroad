-- ============================================================
-- 메이커 상점 물건 4종 (Idempotent)   (P11-14 제안 N, §12-Q75 ⑮, docs/balance.md 8.3)
-- 릴리즈 단계: ① 추가형 (shop_items 4행 upsert만 — 표·권한·구매 RPC 그대로. 이전 앱은 모르는 아이템을 버림:
--                       costumeFromAvatarConfig·petFromAvatarConfig·editorThemeFromSettings 가 모르는 id 를 무시)
--
-- 하는 일
--   1. shop_items 4행 (원본 src/lib/shop/catalog.ts, catalog.test.ts 가 이 INSERT 를 열마다 대조):
--        hat_beret 화가 베레모(모자 450 희귀) · hat_detective 탐정 모자(모자 600 희귀) ·
--        theme_arcade 밤하늘 오락실 공책(에디터 테마 450) · pet_neurit 느릿이(펫 1,200 희귀)
--      가격은 00039 범위 CHECK 안. 쓰지 않으면 3월드 끝 잔액이 Phase 9 카탈로그의 94~135% 라서(balance.md 8.2) 2,700 을 더함 → 14,100
--   2. 자기 검증
-- 적용 후 NOTICE `[00058] 메이커 상점 물건 4종: 상점 n종` 확인
-- 되돌리기: supabase/rollback/00058_maker_shop.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

INSERT INTO public.shop_items (id, kind, slot, name, description, price, rarity, weekly_limit, sort) VALUES
  ('hat_beret',     'costume',      'hat', '화가 베레모',        '물감 방울이 톡톡 묻은 거북이 화가의 베레모예요.',     450,  'rare',   NULL, 102),
  ('hat_detective', 'costume',      'hat', '탐정 모자',          '데이터 탐정처럼 단서를 찾는 체크무늬 모자예요.',      600,  'rare',   NULL, 104),
  ('theme_arcade',  'editor_theme', NULL,  '밤하늘 오락실 공책', '네온사인이 반짝이는 오락실 밤하늘 공책이에요.',       450,  'common', NULL, 240),
  ('pet_neurit',    'pet',          NULL,  '느릿이',             '메이커 시티의 화가 거북이가 붓을 메고 따라와요.',     1200, 'rare',   NULL, 350)
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind, slot = EXCLUDED.slot, name = EXCLUDED.name, description = EXCLUDED.description,
  price = EXCLUDED.price, rarity = EXCLUDED.rarity, weekly_limit = EXCLUDED.weekly_limit, sort = EXCLUDED.sort;

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  SELECT count(*) INTO v_n FROM public.shop_items WHERE is_active;
  IF (SELECT count(*) FROM public.shop_items
       WHERE id IN ('hat_beret', 'hat_detective', 'theme_arcade', 'pet_neurit') AND is_active) <> 4 THEN
    RAISE EXCEPTION '[00058] 검증 실패: 메이커 상점 물건 4종';
  END IF;
  RAISE NOTICE '[00058] 메이커 상점 물건 4종: 상점 %종', v_n;
END $$;
