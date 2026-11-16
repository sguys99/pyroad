-- ============================================================
-- 작품 자랑 카드 (Idempotent)   (P11-08, §2.5 공유 카드, §2.6 공개 정보, §12-Q67 ①·Q74 ③, P0-10)
-- 릴리즈 단계: ① 추가형 (share_cards CHECK 넓히기 · 새 함수 2개 · 새 트리거 2개 · share_card_public 조건 추가.
--              권한은 그대로 — 이전 앱은 새 종류를 만들지 않고, 공개 조회 결과도 기존 4종은 같음)
--
-- 하는 일
--   1. share_cards.kind 에 'creation' (작품 카드, ref = creations.id), 스냅샷 키에 'lines'(대화 작품 앞 몇 줄) 추가.
--      작품 카드 스냅샷 = nickname · avatar(공개 꾸민 모습) · world(3) · name(작품 이름) · lines?(대화 앞 4줄, 줄마다 40자).
--      코드·user_id·명령 스트림은 넣지 않는다. 그림은 스냅샷에 넣지 않고 이미지 라우트가 그릴 때 작품 썸네일을 읽음(아래 4)
--   2. create_creation_share_card(user, creation) (service_role, POST /api/share-cards {kind:'creation'}):
--        **갤러리에 전시 중인 내 작품만**(공개 · 숨기지 않음 · published_at). 공개할 때 보호자 동의 게이트·3월드 프로젝트 자격·
--        금칙어·개인정보 지킴이를 이미 통과한 글자만 카드에 오른다(비공개 작품은 개인정보 검사를 거치지 않아 카드도 안 됨).
--        아니면 creation_not_found(남의·없는 작품) / creation_not_shared(전시 중 아님). 다시 만들면 같은 id·새 90일(00043 과 같음)
--   3. 작품이 전시에서 빠지면 카드도 닫힘:
--        creations AFTER UPDATE — 비공개·운영자 숨김(신고 3명 자동 숨김 포함)이 되면 그 작품 카드 is_public = false
--          (다시 전시해도 저절로 열리지 않음: 작가가 "내 자랑 카드"에서 다시 공개), 이름이 바뀌면 스냅샷 name + version + 1
--        creations AFTER DELETE — 그 작품 카드 행 삭제
--        share_cards BEFORE INSERT/UPDATE — 작품 카드를 공개로 바꿀 때 작품이 전시 중이 아니면 creation_not_shared
--          (manage_share_card 'show' 도 이 검사를 받음)
--      앱은 위 변경 뒤 CDN 사본을 태그로 지움(purgeCreationShareCards — P9-11 과 같은 길)
--   4. share_card_public: 작품 카드는 작품이 지금 전시 중일 때만(트리거가 놓쳐도 공개 조회에서 한 번 더)
--      share_card_creation_thumbnail(card) (service_role, 이미지 라우트): 공개·만료 전 카드 + 전시 중 작품의 썸네일 PNG 만
--   5. 권한 + 자기 검증
-- 적용 후 NOTICE `[00056] 작품 자랑 카드: 전시 중인 작품만, 내리기·숨김·삭제 → 카드 닫힘` 확인
-- 확인: supabase/tests SCC-1(권한), SCC-2(만들기 규칙·스냅샷·내리기·숨김·삭제·다시 공개 거절·이름 변경)
-- 되돌리기: supabase/rollback/00056_creation_share_card.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. share_cards CHECK 넓히기
-- ------------------------------------------------------------
ALTER TABLE public.share_cards DROP CONSTRAINT IF EXISTS share_cards_kind_check;
ALTER TABLE public.share_cards ADD CONSTRAINT share_cards_kind_check
  CHECK (kind IN ('levelup', 'stage', 'achievement', 'weekly', 'creation'));

ALTER TABLE public.share_cards DROP CONSTRAINT IF EXISTS share_cards_snapshot_check;
-- 공개 정보만 (§2.6): 새 키는 이 목록과 src/lib/share-card/snapshot.ts 를 함께 고친다
ALTER TABLE public.share_cards ADD CONSTRAINT share_cards_snapshot_check CHECK (
  pg_catalog.jsonb_typeof(snapshot) = 'object'
  AND snapshot ? 'nickname'
  AND snapshot - ARRAY['nickname', 'avatar', 'world', 'level', 'worldName', 'stageNo', 'stageName', 'stars',
                       'maxStars', 'name', 'desc', 'tier', 'icon', 'weekLabel', 'quests', 'xp', 'lines'] = '{}'::jsonb
);

-- 작품 → 카드 찾기 (트리거·퍼지)
CREATE INDEX IF NOT EXISTS share_cards_creation_idx ON public.share_cards (ref) WHERE kind = 'creation';

-- ------------------------------------------------------------
-- 2. create_creation_share_card
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_creation_share_card(p_user_id UUID, p_creation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name   TEXT;
  v_avatar JSONB;
  v_cr     RECORD;
  v_lines  JSONB;
  v_data   JSONB;
  v_row    public.share_cards%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_creation_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 같은 사용자의 만들기를 줄 세움 (00043 과 같음)
  PERFORM 1 FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT p.public_name,
         jsonb_strip_nulls(p.avatar_look || jsonb_build_object('skin', p.avatar_skin))
    INTO v_name, v_avatar
    FROM public.user_public_profiles p WHERE p.user_id = p_user_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT c.id, c.kind, c.title, c.transcript,
         (c.visibility = 'public' AND c.hidden_at IS NULL AND c.published_at IS NOT NULL) AS shown
    INTO v_cr
    FROM public.creations c
   WHERE c.id = p_creation_id AND c.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'creation_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF NOT v_cr.shown THEN
    RAISE EXCEPTION 'creation_not_shared' USING ERRCODE = 'PT409';
  END IF;

  -- 대화 작품: 글자가 있는 앞 4줄, 줄마다 40자 (공개할 때 금칙어·개인정보 검사를 통과한 기록)
  IF v_cr.kind = 'conversation' THEN
    SELECT jsonb_agg(
             jsonb_build_object('text', left(btrim(regexp_replace(r.item->>'text', '[[:cntrl:]]', ' ', 'g')), 40))
             || CASE WHEN r.item->'answer' = 'true'::jsonb THEN jsonb_build_object('answer', true) ELSE '{}'::jsonb END
             ORDER BY r.n)
      INTO v_lines
      FROM (SELECT e.item, e.n
              FROM jsonb_array_elements(v_cr.transcript) WITH ORDINALITY AS e(item, n)
             WHERE pg_catalog.jsonb_typeof(e.item) = 'object'
               AND btrim(regexp_replace(coalesce(e.item->>'text', ''), '[[:cntrl:]]', ' ', 'g')) <> ''
             ORDER BY e.n
             LIMIT 4) r;
  END IF;

  v_data := jsonb_build_object('nickname', v_name, 'world', 3, 'name', v_cr.title)
            || CASE WHEN v_lines IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('lines', v_lines) END
            || CASE WHEN v_avatar = '{}'::jsonb THEN '{}'::jsonb ELSE jsonb_build_object('avatar', v_avatar) END;

  SELECT * INTO v_row FROM public.share_cards c
   WHERE c.user_id = p_user_id AND c.kind = 'creation' AND c.ref = v_cr.id::text FOR UPDATE;
  IF FOUND THEN
    UPDATE public.share_cards c
       SET snapshot = v_data,
           version = c.version + CASE WHEN c.snapshot = v_data THEN 0 ELSE 1 END,
           is_public = true,
           expires_at = NOW() + INTERVAL '90 days',
           updated_at = NOW()
     WHERE c.id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.share_cards (id, user_id, kind, ref, snapshot, expires_at)
    VALUES (translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_'),
            p_user_id, 'creation', v_cr.id::text, v_data, NOW() + INTERVAL '90 days')
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('id', v_row.id, 'kind', v_row.kind, 'version', v_row.version,
                            'expires_at', v_row.expires_at, 'snapshot', v_row.snapshot);
END;
$$;

COMMENT ON FUNCTION public.create_creation_share_card(UUID, UUID) IS
  '작품 자랑 카드 만들기·다시 공개 (P11-08). service_role 전용: POST /api/share-cards {kind:creation}. 갤러리에 전시 중인 내 작품만, 새 90일';

-- ------------------------------------------------------------
-- 3. 작품 ↔ 카드 트리거
-- ------------------------------------------------------------
-- 작품 카드는 작품이 전시 중일 때만 공개로 바꿀 수 있음 (만들기·다시 공개 모두)
CREATE OR REPLACE FUNCTION public.share_cards_creation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.kind = 'creation' AND NEW.is_public AND (TG_OP = 'INSERT' OR NOT OLD.is_public)
     AND NOT EXISTS (SELECT 1 FROM public.creations c
                      WHERE c.id::text = NEW.ref AND c.user_id = NEW.user_id
                        AND c.visibility = 'public' AND c.hidden_at IS NULL AND c.published_at IS NOT NULL) THEN
    RAISE EXCEPTION 'creation_not_shared' USING ERRCODE = 'PT409';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.share_cards_creation_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS share_cards_creation_guard ON public.share_cards;
CREATE TRIGGER share_cards_creation_guard
  BEFORE INSERT OR UPDATE OF is_public ON public.share_cards
  FOR EACH ROW EXECUTE FUNCTION public.share_cards_creation_guard();

-- 작품이 전시에서 빠지면(비공개·숨김) 카드 닫기, 이름이 바뀌면 카드 다시 그리기, 지우면 카드 지우기.
-- 학생 세션(RLS)의 고치기·지우기에서도 돌아야 해서 SECURITY DEFINER (학생은 share_cards 를 못 씀)
CREATE OR REPLACE FUNCTION public.sync_creation_share_cards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.share_cards c WHERE c.kind = 'creation' AND c.ref = OLD.id::text;
    RETURN NULL;
  END IF;

  IF NOT (NEW.visibility = 'public' AND NEW.hidden_at IS NULL AND NEW.published_at IS NOT NULL) THEN
    UPDATE public.share_cards c
       SET is_public = false, updated_at = NOW()
     WHERE c.kind = 'creation' AND c.ref = NEW.id::text AND c.is_public;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    UPDATE public.share_cards c
       SET snapshot = c.snapshot || jsonb_build_object('name', NEW.title),
           version = c.version + 1,
           updated_at = NOW()
     WHERE c.kind = 'creation' AND c.ref = NEW.id::text;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_creation_share_cards() IS
  'creations 내리기·숨김·이름 변경·삭제 → 그 작품 share_cards 닫기·다시 그리기·삭제 (P11-08). 트리거 전용, 실행 권한 없음';

REVOKE ALL ON FUNCTION public.sync_creation_share_cards() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_creation_share_cards ON public.creations;
CREATE TRIGGER sync_creation_share_cards
  AFTER UPDATE OF visibility, hidden_at, published_at, title OR DELETE ON public.creations
  FOR EACH ROW EXECUTE FUNCTION public.sync_creation_share_cards();

-- ------------------------------------------------------------
-- 4. 공개 조회
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.share_card_public(p_id TEXT)
RETURNS TABLE (id TEXT, kind TEXT, snapshot JSONB, version INTEGER, expires_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.kind, c.snapshot, c.version, c.expires_at
    FROM public.share_cards c
   WHERE c.id = p_id AND c.is_public AND c.expires_at > NOW()
     AND (c.kind <> 'creation'
          OR EXISTS (SELECT 1 FROM public.creations cr
                      WHERE cr.id::text = c.ref AND cr.user_id = c.user_id
                        AND cr.visibility = 'public' AND cr.hidden_at IS NULL AND cr.published_at IS NOT NULL));
$$;

COMMENT ON FUNCTION public.share_card_public(TEXT) IS
  '공개 카드 조회 (P9-07, P11-08). service_role 전용: 이미지 라우트·공유 페이지. user_id 없음, 비공개·만료(90일)·전시에서 빠진 작품이면 0행';

CREATE OR REPLACE FUNCTION public.share_card_creation_thumbnail(p_id TEXT)
RETURNS BYTEA
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cr.thumbnail
    FROM public.share_cards c
    JOIN public.creations cr ON cr.id::text = c.ref AND cr.user_id = c.user_id
   WHERE c.id = p_id AND c.kind = 'creation' AND c.is_public AND c.expires_at > NOW()
     AND cr.visibility = 'public' AND cr.hidden_at IS NULL AND cr.published_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.share_card_creation_thumbnail(TEXT) IS
  '작품 카드 그림 (P11-08). service_role 전용: 이미지 라우트. 공개·만료 전 카드 + 전시 중 작품의 썸네일 PNG 만, 아니면 NULL';

-- ------------------------------------------------------------
-- 5. 권한 + 자기 검증
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_creation_share_card(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_card_creation_thumbnail(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_card_public(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_creation_share_card(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.share_card_creation_thumbnail(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.share_card_public(TEXT) TO service_role;

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['public.create_creation_share_card(uuid, uuid)', 'public.share_card_creation_thumbnail(text)',
                              'public.share_card_public(text)'] LOOP
    IF has_function_privilege('anon', v_fn::regprocedure, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn::regprocedure, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION '[00056] 검증 실패: % 실행 권한이 service_role 전용이 아님', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.share_cards_creation_guard()', 'public.sync_creation_share_cards()'] LOOP
    IF has_function_privilege('anon', v_fn::regprocedure, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION '[00056] 검증 실패: 트리거 함수 % 실행 권한', v_fn;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_creation_share_cards' AND tgrelid = 'public.creations'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'share_cards_creation_guard' AND tgrelid = 'public.share_cards'::regclass) THEN
    RAISE EXCEPTION '[00056] 검증 실패: 작품 카드 트리거 없음';
  END IF;
  IF has_table_privilege('authenticated', 'public.share_cards', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.share_cards', 'INSERT') THEN
    RAISE EXCEPTION '[00056] 검증 실패: share_cards 쓰기 권한 (00043 그대로여야 함)';
  END IF;
  RAISE NOTICE '[00056] 작품 자랑 카드: 전시 중인 작품만, 내리기·숨김·삭제 → 카드 닫힘';
END $$;
