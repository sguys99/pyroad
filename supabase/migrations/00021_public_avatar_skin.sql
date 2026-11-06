-- ============================================================
-- 공개 아바타(파이뱀 스킨)를 user_public_profiles·user_profiles_public 에 더함 (Idempotent)   (P3-13, §12-Q34)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱이 그대로 동작)
--
-- 배경
--   - §2.6 공개 정보 = 닉네임 + 캐릭터 아바타. 00018(B34)이 공개 이름은 user_public_profiles 로 옮겼고 사진은 NULL 로 막았지만,
--     "캐릭터 아바타"를 다른 사람에게 보여 줄 값이 없음. Q34: 아바타 = 온보딩(P3-11)에서 고른 파이뱀 색
--     (users.avatar_config.skin), 리그 팔레트 덮어쓰기로 그림. id 목록은 src/lib/avatar/skins.ts 의 SKIN_IDS
--   - users 는 본인 행만 읽을 수 있으므로(RLS) 다른 아이의 avatar_config 를 직접 읽을 수 없음 → 공개해도 되는 값(스킨 id)만
--     공개 프로필 테이블에 복사 (00018 과 같은 구조)
--
-- 하는 일
--   1. user_public_profiles.avatar_skin TEXT (NULL = 아직 안 고름 → 기본 숲초록으로 그림)
--      CHECK: NULL 또는 스킨 6종 id. 공개 테이블에는 정해진 짧은 값만 들어감(avatar_config 의 다른 키·긴 문자열이 새지 않음)
--   2. public_avatar_skin(avatar_config) → 스킨 id | NULL (모르는 값·문자열이 아닌 값은 NULL). IMMUTABLE, search_path 고정,
--      PUBLIC·anon·authenticated 실행 불가 (트리거·백필 전용, SECURITY INVOKER)
--   3. 동기화 트리거 재정의: sync_user_public_profile 이 avatar_skin 도 씀, 트리거를 UPDATE OF nickname, avatar_config 로 넓힘.
--      공개 이름 식은 00018 그대로(= placeholder_display_name(id), 00013 ③ 보다 먼저 적용될 수 있어 식을 복사. 회귀 VIEW-3·PP-4)
--   4. 기존 행 백필 (다시 실행하면 다시 계산)
--   5. user_profiles_public 에 avatar_skin 컬럼을 맨 뒤에 추가 (CREATE OR REPLACE VIEW 는 뒤에 붙이는 것만 허용).
--      id·display_name·avatar_url(NULL) 은 그대로 → 이전 앱의 `user_profiles_public!…(display_name)` 임베딩이 그대로 동작
--   6. 자기 검증
--
-- ⚠️ 스킨 id 목록은 이 파일의 ARRAY[…] 두 곳(CHECK·public_avatar_skin)과 src/lib/avatar/skins.ts SKIN_IDS 가 같아야 합니다
--    (단위 테스트 src/lib/avatar/__tests__/skins.test.ts 가 대조). 스킨을 늘릴 때는 새 마이그레이션에서 둘 다 바꿉니다.
--
-- 왜 ① 인가: 새 컬럼·새 함수·트리거 재정의·데이터 채우기뿐이고 기존 권한을 좁히지 않음. 함수 sync_user_public_profile 은
--   ① 00018 이 처음 만든 것이라 ① 에서 바꿔도 운영 적용 순서(①들 → ③들)에서 덮이지 않음.
--   이전 앱은 avatar_skin 을 읽지 않고, 기존 컬럼·값·FK 이름이 같아 그대로 동작합니다.
--   기존 사용자의 실명 display_name·사진 avatar_url 정리는 되돌릴 수 없는 삭제라 ③ 00022 (새 앱 배포·확인 뒤)
-- 확인: supabase/tests B03-3(뷰 컬럼), PP-3·PP-4, PP-5(스킨 동기화), APP-4·APP-13·APP-14, VIEW-3
-- 되돌리기: supabase/rollback/00021_public_avatar_skin.rollback.sql (00018 정의로, avatar_skin 은 users.avatar_config 에서
--   다시 계산하는 값이라 잃는 데이터 없음)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00021] user_public_profiles.avatar_skin: N행 중 스킨 있음 M, 뷰 avatar_skin 추가, 트리거 nickname·avatar_config` 확인
-- ============================================================

-- ------------------------------------------------------------
-- 1. 공개 프로필의 스킨 컬럼
-- ------------------------------------------------------------
ALTER TABLE public.user_public_profiles ADD COLUMN IF NOT EXISTS avatar_skin TEXT;

ALTER TABLE public.user_public_profiles DROP CONSTRAINT IF EXISTS user_public_profiles_avatar_skin_check;
ALTER TABLE public.user_public_profiles
  ADD CONSTRAINT user_public_profiles_avatar_skin_check
  CHECK (avatar_skin IS NULL
         OR avatar_skin = ANY (ARRAY['green', 'sky', 'sunset', 'berry', 'violet', 'sunny']::TEXT[]));

COMMENT ON COLUMN public.user_public_profiles.avatar_skin IS
  '공개 아바타: 파이뱀 스킨 id (src/lib/avatar/skins.ts). users.avatar_config.skin 에서 동기화, 모르는 값·안 고름은 NULL(= 기본 green) (P3-13)';

-- ------------------------------------------------------------
-- 2. avatar_config → 공개 스킨 id
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_avatar_skin(p_avatar_config JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN pg_catalog.jsonb_typeof(p_avatar_config -> 'skin') = 'string'
         AND (p_avatar_config ->> 'skin') = ANY (ARRAY['green', 'sky', 'sunset', 'berry', 'violet', 'sunny']::TEXT[])
    THEN p_avatar_config ->> 'skin'
  END
$$;

COMMENT ON FUNCTION public.public_avatar_skin(JSONB) IS
  'users.avatar_config → 공개 스킨 id | NULL (P3-13). 동기화 트리거·백필 전용';

REVOKE ALL ON FUNCTION public.public_avatar_skin(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_avatar_skin(JSONB) TO service_role;

-- ------------------------------------------------------------
-- 3. 동기화 트리거 (00018 재정의: avatar_skin 추가, avatar_config UPDATE 에도)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_public_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_public_profiles AS p (user_id, public_name, avatar_skin)
  VALUES (
    NEW.id,
    coalesce(
      NEW.nickname,
      -- = public.placeholder_display_name(id) (00013). 바꾸면 두 곳을 함께 (회귀 VIEW-3 이 대조)
      '모험가' || lpad((abs(pg_catalog.hashtextextended(NEW.id::text, 0)) % 10000)::text, 4, '0')
    ),
    public.public_avatar_skin(NEW.avatar_config)
  )
  ON CONFLICT (user_id) DO UPDATE
    SET public_name = EXCLUDED.public_name,
        avatar_skin = EXCLUDED.avatar_skin,
        updated_at  = now()
    WHERE p.public_name IS DISTINCT FROM EXCLUDED.public_name
       OR p.avatar_skin IS DISTINCT FROM EXCLUDED.avatar_skin;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_user_public_profile() IS
  'users INSERT·nickname·avatar_config UPDATE → user_public_profiles (B34, P3-13). 트리거 전용, 실행 권한 없음';

REVOKE ALL ON FUNCTION public.sync_user_public_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_users_sync_public_profile ON public.users;
CREATE TRIGGER trg_users_sync_public_profile
  AFTER INSERT OR UPDATE OF nickname, avatar_config ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_public_profile();

-- ------------------------------------------------------------
-- 4. 기존 사용자 (다시 실행하면 다시 계산. 공개 이름도 00018 과 같은 식으로 맞춤)
-- ------------------------------------------------------------
INSERT INTO public.user_public_profiles AS p (user_id, public_name, avatar_skin)
SELECT u.id,
       coalesce(u.nickname,
                '모험가' || lpad((abs(pg_catalog.hashtextextended(u.id::text, 0)) % 10000)::text, 4, '0')),
       public.public_avatar_skin(u.avatar_config)
  FROM public.users u
ON CONFLICT (user_id) DO UPDATE
  SET public_name = EXCLUDED.public_name,
      avatar_skin = EXCLUDED.avatar_skin,
      updated_at  = now()
  WHERE p.public_name IS DISTINCT FROM EXCLUDED.public_name
     OR p.avatar_skin IS DISTINCT FROM EXCLUDED.avatar_skin;

-- ------------------------------------------------------------
-- 5. 공개 뷰: avatar_skin 을 맨 뒤에 (security_invoker·권한은 00018 과 같음)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_profiles_public
  WITH (security_invoker = true) AS
  SELECT p.user_id     AS id,
         p.public_name AS display_name,
         NULL::text    AS avatar_url,   -- provider 프로필 사진을 내보내지 않음 (아바타는 avatar_skin)
         p.avatar_skin AS avatar_skin
    FROM public.user_public_profiles p;

COMMENT ON VIEW public.user_profiles_public IS
  '다른 사용자에게 보이는 값: 이름(닉네임, 없으면 "모험가NNNN") + 파이뱀 스킨 (P1-18·P3-13). security_invoker 로 user_public_profiles 를 읽음 (B34). 실명·사진 없음';

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
  v_skinned  INTEGER;
  v_mismatch INTEGER;
BEGIN
  IF NOT coalesce((SELECT c.reloptions::text[] && ARRAY['security_invoker=true', 'security_invoker=on', 'security_invoker=1']
                     FROM pg_class c WHERE c.oid = 'public.user_profiles_public'::regclass), false) THEN
    v_bad := v_bad || 'user_profiles_public 이 security_invoker 가 아님'::TEXT;
  END IF;
  IF (SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute
       WHERE attrelid = 'public.user_profiles_public'::regclass AND attnum > 0 AND NOT attisdropped)
     IS DISTINCT FROM 'id,display_name,avatar_url,avatar_skin' THEN
    v_bad := v_bad || '뷰 컬럼이 id,display_name,avatar_url,avatar_skin 이 아님'::TEXT;
  END IF;

  -- 트리거가 avatar_config UPDATE 에도 걸림
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.users'::regclass AND t.tgname = 'trg_users_sync_public_profile'
       AND (SELECT array_agg(a.attname::TEXT ORDER BY a.attname) FROM pg_attribute a
             WHERE a.attrelid = t.tgrelid AND a.attnum = ANY (t.tgattr)) = ARRAY['avatar_config', 'nickname']) THEN
    v_bad := v_bad || '트리거가 UPDATE OF nickname, avatar_config 가 아님'::TEXT;
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_function_privilege(v_role, 'public.public_avatar_skin(jsonb)', 'EXECUTE')
       OR has_function_privilege(v_role, 'public.sync_user_public_profile()', 'EXECUTE') THEN
      v_bad := v_bad || (v_role || ':EXECUTE');
    END IF;
    IF has_table_privilege(v_role, 'public.user_public_profiles', 'INSERT, UPDATE, DELETE, TRUNCATE')
       OR has_table_privilege(v_role, 'public.user_profiles_public', 'INSERT, UPDATE, DELETE, TRUNCATE') THEN
      v_bad := v_bad || (v_role || ':쓰기 권한');
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.user_profiles_public', 'SELECT')
     OR has_table_privilege('anon', 'public.user_public_profiles', 'SELECT') THEN
    v_bad := v_bad || 'anon:SELECT'::TEXT;
  END IF;

  -- 함수 동작 (CRLF 붙여넣기에도 같은 값: 줄바꿈 없는 리터럴)
  IF public.public_avatar_skin('{"skin": "sky"}'::jsonb) IS DISTINCT FROM 'sky'
     OR public.public_avatar_skin('{"skin": "gold"}'::jsonb) IS NOT NULL
     OR public.public_avatar_skin('{"skin": ["sky"]}'::jsonb) IS NOT NULL
     OR public.public_avatar_skin('{}'::jsonb) IS NOT NULL THEN
    v_bad := v_bad || 'public_avatar_skin 결과가 다름'::TEXT;
  END IF;

  SELECT count(*) INTO v_users FROM public.users;
  SELECT count(*) FILTER (WHERE p.avatar_skin IS NOT NULL),
         count(*) FILTER (WHERE p.user_id IS NULL
                             OR p.avatar_skin IS DISTINCT FROM public.public_avatar_skin(u.avatar_config)
                             OR v.avatar_skin IS DISTINCT FROM p.avatar_skin
                             OR v.avatar_url IS NOT NULL)
    INTO v_skinned, v_mismatch
    FROM public.users u
    LEFT JOIN public.user_public_profiles p ON p.user_id = u.id
    LEFT JOIN public.user_profiles_public v ON v.id = u.id;
  IF v_mismatch > 0 THEN
    v_bad := v_bad || (v_mismatch || '행: 공개 스킨이 avatar_config 와 다르거나 사진이 보임');
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00021] 기대와 다름: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00021] user_public_profiles.avatar_skin: %행 중 스킨 있음 %, 뷰 avatar_skin 추가, 트리거 nickname·avatar_config',
    v_users, v_skinned;
END $$;
