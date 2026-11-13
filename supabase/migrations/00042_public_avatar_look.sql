-- ============================================================
-- 공개 아바타에 꾸민 모습(코스튬·프레임)을 더함 (Idempotent)   (P9-05, §2.6, 00021 avatar_skin 과 같은 구조)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱이 그대로 동작)
--
-- 배경
--   - P9-03 이 장착을 users.avatar_config {skin, hat, glasses, cape, bg, pet, frame} 에 씀. 내 화면은 avatar_config 를 직접 읽지만,
--     다른 아이(게시판 작성자·댓글)의 avatar_config 는 RLS 로 읽을 수 없어 게시판 아바타에 모자·테두리가 보이지 않음.
--     §2.6 공개 정보 = 닉네임 + 캐릭터 아바타 → 아바타에 보이는 조각(모자·안경·망토·배경·테두리)만 공개 프로필에 복사.
--     펫(지도 동행)·에디터 테마(개인 설정)는 아바타 그림이 아니라 공개하지 않음
--
-- 하는 일
--   1. user_public_profiles.avatar_look JSONB NOT NULL DEFAULT '{}' (CHECK 객체). 키는 hat·glasses·cape·bg·frame 만,
--      값은 shop_items 에 있는 아이템 id 이고 종류·슬롯이 맞을 때만 (avatar_config 의 다른 키·모르는 값은 새지 않음)
--   2. public_avatar_look(avatar_config) → 위 객체 (STABLE, search_path 고정, PUBLIC·anon·authenticated 실행 불가, 트리거·백필 전용)
--   3. 동기화 트리거 재정의: sync_user_public_profile 이 avatar_look 도 씀 (00021 정의 + 한 열. 트리거 열 nickname·avatar_config 그대로)
--   4. 기존 행 백필 (다시 실행하면 다시 계산)
--   5. user_profiles_public 에 avatar_look 컬럼을 맨 뒤에 추가 (CREATE OR REPLACE VIEW 는 뒤에 붙이는 것만 허용)
--   6. 자기 검증
--
-- 왜 ① 인가: 새 컬럼·새 함수·트리거 함수 재정의·데이터 채우기뿐이고 권한을 좁히지 않음. sync_user_public_profile 은 ① 00018·00021 이
--   만든 것이라 ① 에서 바꿔도 운영 적용 순서(①들 → ③들)에서 덮이지 않음. 이전 앱은 avatar_look 을 읽지 않음
-- 확인: supabase/tests B03-3(뷰 컬럼), PP-6(꾸민 모습 동기화), APP-4·APP-13·APP-14(앱 쿼리)
-- 되돌리기: supabase/rollback/00042_public_avatar_look.rollback.sql (avatar_config 에서 다시 계산하는 값이라 잃는 데이터 없음)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00042] user_public_profiles.avatar_look: N행 중 꾸민 모습 있음 M, 뷰 avatar_look 추가` 확인
-- ============================================================

-- ------------------------------------------------------------
-- 1. 공개 프로필의 꾸민 모습 컬럼
-- ------------------------------------------------------------
ALTER TABLE public.user_public_profiles
  ADD COLUMN IF NOT EXISTS avatar_look JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_public_profiles DROP CONSTRAINT IF EXISTS user_public_profiles_avatar_look_check;
ALTER TABLE public.user_public_profiles
  ADD CONSTRAINT user_public_profiles_avatar_look_check
  CHECK (pg_catalog.jsonb_typeof(avatar_look) = 'object');

COMMENT ON COLUMN public.user_public_profiles.avatar_look IS
  '공개 아바타의 꾸민 모습 {hat, glasses, cape, bg, frame} = shop_items id (P9-05). users.avatar_config 에서 동기화, 펫·에디터 테마 없음';

-- ------------------------------------------------------------
-- 2. avatar_config → 공개 꾸민 모습
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_avatar_look(p_avatar_config JSONB)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(pg_catalog.jsonb_object_agg(k.slot, i.id), '{}'::jsonb)
    FROM (VALUES ('hat'), ('glasses'), ('cape'), ('bg'), ('frame')) AS k(slot)
    JOIN public.shop_items i
      ON pg_catalog.jsonb_typeof(p_avatar_config -> k.slot) = 'string'
     AND i.id = p_avatar_config ->> k.slot
     AND i.kind IN ('costume', 'frame')
     AND coalesce(i.slot, i.kind) = k.slot
$$;

COMMENT ON FUNCTION public.public_avatar_look(JSONB) IS
  'users.avatar_config → 공개 꾸민 모습 {hat, glasses, cape, bg, frame} (P9-05). 동기화 트리거·백필 전용';

REVOKE ALL ON FUNCTION public.public_avatar_look(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_avatar_look(JSONB) TO service_role;

-- ------------------------------------------------------------
-- 3. 동기화 트리거 함수 (00021 + avatar_look)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_public_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_public_profiles AS p (user_id, public_name, avatar_skin, avatar_look)
  VALUES (
    NEW.id,
    coalesce(
      NEW.nickname,
      -- = public.placeholder_display_name(id) (00013). 바꾸면 두 곳을 함께 (회귀 VIEW-3 이 대조)
      '모험가' || lpad((abs(pg_catalog.hashtextextended(NEW.id::text, 0)) % 10000)::text, 4, '0')
    ),
    public.public_avatar_skin(NEW.avatar_config),
    public.public_avatar_look(NEW.avatar_config)
  )
  ON CONFLICT (user_id) DO UPDATE
    SET public_name = EXCLUDED.public_name,
        avatar_skin = EXCLUDED.avatar_skin,
        avatar_look = EXCLUDED.avatar_look,
        updated_at  = now()
    WHERE p.public_name IS DISTINCT FROM EXCLUDED.public_name
       OR p.avatar_skin IS DISTINCT FROM EXCLUDED.avatar_skin
       OR p.avatar_look IS DISTINCT FROM EXCLUDED.avatar_look;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_user_public_profile() IS
  'users INSERT·nickname·avatar_config UPDATE → user_public_profiles (B34, P3-13, P9-05). 트리거 전용, 실행 권한 없음';

REVOKE ALL ON FUNCTION public.sync_user_public_profile() FROM PUBLIC, anon, authenticated;

-- 트리거 자체(UPDATE OF nickname, avatar_config)는 00021 그대로

-- ------------------------------------------------------------
-- 4. 기존 사용자
-- ------------------------------------------------------------
UPDATE public.user_public_profiles p
   SET avatar_look = public.public_avatar_look(u.avatar_config),
       updated_at  = now()
  FROM public.users u
 WHERE u.id = p.user_id
   AND p.avatar_look IS DISTINCT FROM public.public_avatar_look(u.avatar_config);

-- ------------------------------------------------------------
-- 5. 공개 뷰: avatar_look 을 맨 뒤에 (security_invoker·권한은 00021 과 같음)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_profiles_public
  WITH (security_invoker = true) AS
  SELECT p.user_id     AS id,
         p.public_name AS display_name,
         NULL::text    AS avatar_url,   -- provider 프로필 사진을 내보내지 않음 (아바타는 avatar_skin·avatar_look)
         p.avatar_skin AS avatar_skin,
         p.avatar_look AS avatar_look
    FROM public.user_public_profiles p;

COMMENT ON VIEW public.user_profiles_public IS
  '다른 사용자에게 보이는 값: 이름(닉네임, 없으면 "모험가NNNN") + 파이뱀 스킨 + 꾸민 모습 (P1-18·P3-13·P9-05). security_invoker 로 user_public_profiles 를 읽음 (B34). 실명·사진 없음';

REVOKE ALL ON public.user_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_profiles_public TO authenticated;
GRANT ALL ON public.user_profiles_public TO service_role;

-- ------------------------------------------------------------
-- 6. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad      TEXT[] := '{}';
  v_role     TEXT;
  v_users    INTEGER;
  v_looked   INTEGER;
  v_mismatch INTEGER;
BEGIN
  IF NOT coalesce((SELECT c.reloptions::text[] && ARRAY['security_invoker=true', 'security_invoker=on', 'security_invoker=1']
                     FROM pg_class c WHERE c.oid = 'public.user_profiles_public'::regclass), false) THEN
    v_bad := v_bad || 'user_profiles_public 이 security_invoker 가 아님'::TEXT;
  END IF;
  IF (SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute
       WHERE attrelid = 'public.user_profiles_public'::regclass AND attnum > 0 AND NOT attisdropped)
     IS DISTINCT FROM 'id,display_name,avatar_url,avatar_skin,avatar_look' THEN
    v_bad := v_bad || '뷰 컬럼이 id,display_name,avatar_url,avatar_skin,avatar_look 이 아님'::TEXT;
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_function_privilege(v_role, 'public.public_avatar_look(jsonb)', 'EXECUTE')
       OR has_function_privilege(v_role, 'public.sync_user_public_profile()', 'EXECUTE') THEN
      v_bad := v_bad || (v_role || ':EXECUTE');
    END IF;
    IF has_table_privilege(v_role, 'public.user_public_profiles', 'INSERT, UPDATE, DELETE, TRUNCATE')
       OR has_table_privilege(v_role, 'public.user_profiles_public', 'INSERT, UPDATE, DELETE, TRUNCATE') THEN
      v_bad := v_bad || (v_role || ':쓰기 권한');
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.user_profiles_public', 'SELECT') THEN
    v_bad := v_bad || 'anon:SELECT'::TEXT;
  END IF;

  -- 함수 동작: 슬롯이 맞는 아이템만, 펫·테마·스킨·모르는 값·문자열 아닌 값은 빠짐
  IF public.public_avatar_look('{"hat": "hat_party", "frame": "frame_star", "pet": "pet_chick", "skin": "sky", "editor_theme": "theme_night"}'::jsonb)
       IS DISTINCT FROM '{"hat": "hat_party", "frame": "frame_star"}'::jsonb
     OR public.public_avatar_look('{"hat": "glasses_round", "cape": "hat_crown", "bg": "nope"}'::jsonb) IS DISTINCT FROM '{}'::jsonb
     OR public.public_avatar_look('{"hat": ["hat_party"], "frame": 1}'::jsonb) IS DISTINCT FROM '{}'::jsonb
     OR public.public_avatar_look(NULL) IS DISTINCT FROM '{}'::jsonb THEN
    v_bad := v_bad || 'public_avatar_look 결과가 다름'::TEXT;
  END IF;

  SELECT count(*) INTO v_users FROM public.users;
  SELECT count(*) FILTER (WHERE p.avatar_look <> '{}'::jsonb),
         count(*) FILTER (WHERE p.user_id IS NULL
                             OR p.avatar_look IS DISTINCT FROM public.public_avatar_look(u.avatar_config)
                             OR v.avatar_look IS DISTINCT FROM p.avatar_look)
    INTO v_looked, v_mismatch
    FROM public.users u
    LEFT JOIN public.user_public_profiles p ON p.user_id = u.id
    LEFT JOIN public.user_profiles_public v ON v.id = u.id;
  IF v_mismatch > 0 THEN
    v_bad := v_bad || (v_mismatch || '행: 공개 꾸민 모습이 avatar_config 와 다름');
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00042] 기대와 다름: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00042] user_public_profiles.avatar_look: %행 중 꾸민 모습 있음 %, 뷰 avatar_look 추가', v_users, v_looked;
END $$;
