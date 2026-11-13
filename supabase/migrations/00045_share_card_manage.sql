-- ============================================================
-- 공유 카드 숨기기·다시 공개·지우기 + 닉네임·꾸민 모습이 바뀌면 카드 새로 그리기 (Idempotent)   (P9-11, §12-Q67 ①, P0-10)
-- 릴리즈 단계: ① 추가형 (새 함수 2개·새 트리거 1개. 기존 객체·권한은 그대로 — 이전 앱은 부르지 않음)
--
-- 하는 일
--   1. manage_share_card(user, card_id, action) (service_role, PATCH·DELETE /api/share-cards/{id} 가 getUser() 로 확인한 id 만 넘김):
--        본인 카드만(아니면 share_card_not_found).
--          hide   = is_public false  (공유 페이지·이미지가 바로 404, 앱이 CDN 사본을 태그로 지움)
--          show   = 다시 공개 + 새 90일 (§12-Q67 ①: 만료된 카드도 여기서 다시 열림)
--          delete = 행 삭제
--        반환 {id, kind, version, is_public, expires_at, deleted}
--   2. 공개 프로필(닉네임·스킨·꾸민 모습)이 바뀌면 그 사람의 모든 카드 스냅샷의 nickname·avatar 를 새 값으로 + version + 1
--      (user_public_profiles AFTER UPDATE 트리거. 이미지 주소 ?v= 가 바뀌어 카카오 썸네일·CDN 캐시를 넘김, 앱은 옛 사본을 태그로 지움).
--      스냅샷 값 계산은 create_share_card(00043)와 같음. 바뀐 게 없으면 그대로
--   3. 권한 + 자기 검증
-- 90일 만료 카드는 지울 필요 없음: 이미지 CDN max-age 가 만료까지 남은 초로 잘려 있음(P9-07 shareCardCacheHeaders)
-- 적용 후 NOTICE `[00045] 공유 카드 관리: manage_share_card service_role 전용, 공개 프로필 → 카드 동기화 트리거` 확인
-- 확인: supabase/tests SCM-1(권한), SCM-2(숨기기·다시 공개·지우기·남의 카드), SCM-3(닉네임·꾸민 모습 → version)
-- 되돌리기: supabase/rollback/00045_share_card_manage.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. manage_share_card
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manage_share_card(p_user_id UUID, p_card_id TEXT, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.share_cards%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_card_id IS NULL OR p_card_id !~ '^[A-Za-z0-9_-]{22}$'
     OR p_action IS NULL OR p_action NOT IN ('hide', 'show', 'delete') THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  IF p_action = 'delete' THEN
    DELETE FROM public.share_cards c WHERE c.id = p_card_id AND c.user_id = p_user_id RETURNING * INTO v_row;
  ELSE
    UPDATE public.share_cards c
       SET is_public  = p_action = 'show',
           expires_at = CASE WHEN p_action = 'show' THEN NOW() + INTERVAL '90 days' ELSE c.expires_at END,
           updated_at = NOW()
     WHERE c.id = p_card_id AND c.user_id = p_user_id
    RETURNING * INTO v_row;
  END IF;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'share_card_not_found' USING ERRCODE = 'PT404';
  END IF;

  RETURN jsonb_build_object('id', v_row.id, 'kind', v_row.kind, 'version', v_row.version,
                            'is_public', v_row.is_public AND p_action <> 'delete',
                            'expires_at', v_row.expires_at, 'deleted', p_action = 'delete');
END;
$$;

COMMENT ON FUNCTION public.manage_share_card(UUID, TEXT, TEXT) IS
  '공유 카드 숨기기·다시 공개(새 90일)·지우기 (P9-11). service_role 전용: PATCH·DELETE /api/share-cards/{id}. 본인 카드만';

-- ------------------------------------------------------------
-- 2. 공개 프로필 → 카드 스냅샷 (닉네임·꾸민 모습)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_share_card_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avatar JSONB := jsonb_strip_nulls(NEW.avatar_look || jsonb_build_object('skin', NEW.avatar_skin));
BEGIN
  -- create_share_card(00043)와 같은 값: nickname = 공개 이름, avatar = 공개 꾸민 모습(비었으면 키 없음)
  UPDATE public.share_cards c
     SET snapshot   = (c.snapshot - 'avatar') || jsonb_build_object('nickname', NEW.public_name)
                      || CASE WHEN v_avatar = '{}'::jsonb THEN '{}'::jsonb ELSE jsonb_build_object('avatar', v_avatar) END,
         version    = c.version + 1,
         updated_at = NOW()
   WHERE c.user_id = NEW.user_id
     AND c.snapshot IS DISTINCT FROM (c.snapshot - 'avatar') || jsonb_build_object('nickname', NEW.public_name)
                      || CASE WHEN v_avatar = '{}'::jsonb THEN '{}'::jsonb ELSE jsonb_build_object('avatar', v_avatar) END;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_share_card_profile() IS
  'user_public_profiles 닉네임·스킨·꾸민 모습 UPDATE → 본인 share_cards 스냅샷 + version + 1 (P9-11). 트리거 전용, 실행 권한 없음';

REVOKE ALL ON FUNCTION public.sync_share_card_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_share_card_profile ON public.user_public_profiles;
CREATE TRIGGER sync_share_card_profile
  AFTER UPDATE OF public_name, avatar_skin, avatar_look ON public.user_public_profiles
  FOR EACH ROW
  WHEN (OLD.public_name IS DISTINCT FROM NEW.public_name
        OR OLD.avatar_skin IS DISTINCT FROM NEW.avatar_skin
        OR OLD.avatar_look IS DISTINCT FROM NEW.avatar_look)
  EXECUTE FUNCTION public.sync_share_card_profile();

-- ------------------------------------------------------------
-- 3. 권한 + 자기 검증
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.manage_share_card(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_share_card(UUID, TEXT, TEXT) TO service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.manage_share_card(uuid, text, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.manage_share_card(uuid, text, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.manage_share_card(uuid, text, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.sync_share_card_profile()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.sync_share_card_profile()', 'EXECUTE') THEN
    RAISE EXCEPTION '[00045] 검증 실패: manage_share_card 는 service_role 전용, sync_share_card_profile 은 실행 권한 없음';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_share_card_profile'
                    AND tgrelid = 'public.user_public_profiles'::regclass) THEN
    RAISE EXCEPTION '[00045] 검증 실패: sync_share_card_profile 트리거 없음';
  END IF;
  RAISE NOTICE '[00045] 공유 카드 관리: manage_share_card service_role 전용, 공개 프로필 → 카드 동기화 트리거';
END $$;
