-- ============================================================
-- 공유 카드 (Idempotent)   (P9-07, §2.5 공유 카드, §2.6 공개 정보, §12-Q67, P0-10)
-- 릴리즈 단계: ① 추가형 (새 테이블 1개·새 함수 2개, 기존 객체는 건드리지 않음 — 이전 앱은 부르지 않음)
--
-- 하는 일
--   1. share_cards: 자랑하기 카드 1장 = 1행. 카드는 이 행의 snapshot 만으로 그린다(쿼리 문자열 글자는 그리지 않음).
--        id       = 128비트 난수 base64url 22자 (추측 불가, 공개 링크의 열쇠)
--        kind     = levelup | stage | achievement | weekly,  ref = 레벨 · 스테이지 id · 업적 id · 주 월요일 (사용자·종류·ref 당 1행)
--        snapshot = 공개 정보만: nickname(공개 이름) · avatar(공개 꾸민 모습 = user_public_profiles 의 스킨·모자·안경·망토·배경·테두리 id,
--                   펫 없음) · 성과 숫자·이름. 실명·이메일·학교·학년·시각·요일별 활동 없음 (CHECK 로 키 목록 고정)
--        version  = 그림이 바뀌면 +1 (이미지 주소 ?v= 로 CDN·카카오 썸네일 캐시를 넘김, P9-08·P9-11)
--        is_public · expires_at = §12-Q67 ① 공개 90일 뒤 자동 비공개(만료 = 404). 다시 만들면(다시 공개) 새 90일
--      본인 행 읽기만, 쓰기는 create_share_card 만 (클라이언트 쓰기 경로 없음)
--   2. create_share_card(user, kind, ref) (service_role, POST /api/share-cards 가 getUser() 로 확인한 id 만 넘김):
--        성과 숫자는 클라이언트 값을 받지 않고 실제 기록으로 계산해 스냅샷.
--          levelup     users.current_level (ref = 그 레벨), 무대 = 깬 퀘스트가 있는 가장 뒤 월드
--          stage       ref = 스테이지 id. 코드 퀘스트를 다 끝낸 스테이지만(complete_quest 의 클리어 판정, 아니면 stage_not_cleared).
--                      별 0~3 = 그 스테이지 모든 퀘스트(퀴즈 포함) best_stars 합 ÷ 만점 × 3 내림 (모든 별을 모으면 3)
--          achievement ref = 업적 id. 얻은 업적만(achievement_not_earned). 이름·설명·티어 + 메달 그림(분류에서)
--          weekly      ref 없음 → 이번 주(KST 월요일). §12-Q67 ② 합계만: 이번 주 처음 끝낸 퀘스트 수·그 XP·그 별(황금키 완료 제외).
--                      0개면 nothing_this_week
--        같은 (사용자, 종류, ref) 가 있으면 그 행을 고쳐 씀: 스냅샷이 바뀌면 version + 1, 다시 공개 + 새 90일
--   3. share_card_public(id) (service_role, 이미지 라우트·P9-08 공유 페이지): 공개 중이고 만료 전인 카드의 kind·snapshot·version·
--        expires_at 만 (user_id 없음). 없거나 비공개·만료면 0행
--   4. 권한 + 자기 검증
-- 적용 후 NOTICE `[00043] 공유 카드: share_cards 본인 읽기만, create_share_card·share_card_public service_role 전용` 확인
-- 확인: supabase/tests SC-1~1c(권한), SC-2(만들기 규칙·스냅샷·공개 조회·만료)
-- 되돌리기: supabase/rollback/00043_share_cards.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. share_cards
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.share_cards (
  id          TEXT PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{22}$'),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('levelup', 'stage', 'achievement', 'weekly')),
  ref         TEXT NOT NULL,
  snapshot    JSONB NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_public   BOOLEAN NOT NULL DEFAULT true,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT share_cards_user_kind_ref_key UNIQUE (user_id, kind, ref),
  -- 공개 정보만 (§2.6): 스냅샷 최상위 키를 고정. 새 키는 이 목록과 src/lib/share-card/snapshot.ts 를 함께 고친다
  CONSTRAINT share_cards_snapshot_check CHECK (
    pg_catalog.jsonb_typeof(snapshot) = 'object'
    AND snapshot ? 'nickname'
    AND snapshot - ARRAY['nickname', 'avatar', 'world', 'level', 'worldName', 'stageNo', 'stageName', 'stars',
                         'maxStars', 'name', 'desc', 'tier', 'icon', 'weekLabel', 'quests', 'xp'] = '{}'::jsonb
  )
);

CREATE INDEX IF NOT EXISTS share_cards_user_idx ON public.share_cards (user_id, created_at DESC);

COMMENT ON TABLE public.share_cards IS
  '자랑하기 카드 (P9-07). snapshot(공개 정보만)으로 그림. 공개 90일 뒤 자동 비공개(expires_at, §12-Q67). 본인 읽기만, 쓰기는 create_share_card';

ALTER TABLE public.share_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.share_cards FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.share_cards TO authenticated, service_role;

DROP POLICY IF EXISTS "share_cards_select_own" ON public.share_cards;
CREATE POLICY "share_cards_select_own" ON public.share_cards
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 2. create_share_card
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_share_card(p_user_id UUID, p_kind TEXT, p_ref TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_level  INTEGER;
  v_name   TEXT;
  v_avatar JSONB;
  v_world  INTEGER;
  v_ref    TEXT;
  v_data   JSONB;
  v_stage  RECORD;
  v_ach    RECORD;
  v_total  INTEGER;
  v_done   INTEGER;
  v_earned INTEGER;
  v_max    INTEGER;
  v_week   DATE := public.kst_week_start(public.kst_today());
  v_row    public.share_cards%ROWTYPE;
  v_id     TEXT;
BEGIN
  IF p_user_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('levelup', 'stage', 'achievement', 'weekly')
     OR (p_kind IN ('stage', 'achievement') AND (p_ref IS NULL OR length(p_ref) > 64)) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 같은 사용자의 만들기를 줄 세움 (같은 ref 동시 요청이 UNIQUE 에 부딪히지 않게)
  SELECT u.current_level INTO v_level FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 공개 이름·공개 꾸민 모습 (게시판과 같은 값: 펫·에디터 테마 없음, P9-05)
  SELECT p.public_name,
         jsonb_strip_nulls(p.avatar_look || jsonb_build_object('skin', p.avatar_skin))
    INTO v_name, v_avatar
    FROM public.user_public_profiles p WHERE p.user_id = p_user_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 무대 틴트: 깬 퀘스트가 있는 가장 뒤 월드 (1~3)
  SELECT least(greatest(coalesce(max(w."order"), 1), 1), 3) INTO v_world
    FROM public.user_progress up
    JOIN public.quests q ON q.id = up.quest_id
    JOIN public.stages s ON s.id = q.stage_id
    JOIN public.worlds w ON w.id = s.world_id
   WHERE up.user_id = p_user_id AND up.status = 'completed';

  IF p_kind = 'levelup' THEN
    v_ref := v_level::text;
    v_data := jsonb_build_object('level', v_level, 'world', v_world);

  ELSIF p_kind = 'stage' THEN
    IF p_ref !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'stage_not_found' USING ERRCODE = 'PT404';
    END IF;
    SELECT s.id, s."order" AS stage_no, s.title, w."order" AS world_no, w.title AS world_title
      INTO v_stage
      FROM public.stages s JOIN public.worlds w ON w.id = s.world_id
     WHERE s.id = p_ref::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'stage_not_found' USING ERRCODE = 'PT404';
    END IF;
    -- 클리어 = 코드 퀘스트를 다 끝냄 (complete_quest 와 같은 판정, 퀴즈는 보너스)
    SELECT count(*) FILTER (WHERE q.quest_type <> 'quiz'),
           count(*) FILTER (WHERE q.quest_type <> 'quiz' AND up.status = 'completed'),
           coalesce(sum(up.best_stars), 0), count(*) * 3
      INTO v_total, v_done, v_earned, v_max
      FROM public.quests q
      LEFT JOIN public.user_progress up ON up.quest_id = q.id AND up.user_id = p_user_id
     WHERE q.stage_id = v_stage.id;
    IF v_total = 0 OR v_done < v_total THEN
      RAISE EXCEPTION 'stage_not_cleared' USING ERRCODE = 'PT409';
    END IF;
    v_ref := v_stage.id::text;
    v_data := jsonb_build_object(
      'world', least(greatest(v_stage.world_no, 1), 3), 'worldName', v_stage.world_title,
      'stageNo', v_stage.stage_no, 'stageName', v_stage.title,
      'stars', least(3, (v_earned * 3) / greatest(v_max, 1)), 'maxStars', 3);

  ELSIF p_kind = 'achievement' THEN
    SELECT a.id, a.name, a.description, a.tier, a.category, a.metric, a.icon INTO v_ach
      FROM public.user_achievements ua JOIN public.achievements a ON a.id = ua.achievement_id
     WHERE ua.user_id = p_user_id AND ua.achievement_id = p_ref;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'achievement_not_earned' USING ERRCODE = 'PT409';
    END IF;
    v_ref := v_ach.id;
    v_data := jsonb_build_object(
      'world', v_world, 'name', v_ach.name, 'desc', v_ach.description, 'tier', v_ach.tier,
      -- 카드 메달 그림 (src/lib/share-card/types.ts BadgeIcon). 에러 업적은 버그버그가 손님으로 나옴
      'icon', CASE
                WHEN v_ach.metric = 'errors' THEN 'bug'
                WHEN v_ach.icon = 'Crown' THEN 'crown'
                ELSE CASE v_ach.category
                       WHEN 'learn' THEN 'code' WHEN 'star' THEN 'star' WHEN 'quiz' THEN 'bulb'
                       WHEN 'habit' THEN 'flame' WHEN 'growth' THEN 'crown' ELSE 'book' END
              END);

  ELSE  -- weekly: 이번 주(KST 월요일부터) 처음 끝낸 퀘스트의 합계만 (§12-Q67 ②, 요일별 없음)
    SELECT count(*), coalesce(sum(up.earned_xp), 0), coalesce(sum(up.best_stars), 0)
      INTO v_done, v_earned, v_max
      FROM public.user_progress up
     WHERE up.user_id = p_user_id AND up.status = 'completed' AND NOT up.used_golden_key
       AND up.completed_at IS NOT NULL AND public.kst_date(up.completed_at) >= v_week;
    IF v_done = 0 THEN
      RAISE EXCEPTION 'nothing_this_week' USING ERRCODE = 'PT409';
    END IF;
    v_ref := v_week::text;
    v_data := jsonb_build_object(
      'world', v_world,
      'weekLabel', extract(month FROM v_week)::integer || '월 '
                   || (ARRAY['첫째', '둘째', '셋째', '넷째', '다섯째'])[(extract(day FROM v_week)::integer - 1) / 7 + 1] || ' 주',
      'quests', v_done, 'xp', v_earned, 'stars', v_max);
  END IF;

  v_data := v_data || jsonb_build_object('nickname', v_name)
            || CASE WHEN v_avatar = '{}'::jsonb THEN '{}'::jsonb ELSE jsonb_build_object('avatar', v_avatar) END;

  SELECT * INTO v_row FROM public.share_cards c
   WHERE c.user_id = p_user_id AND c.kind = p_kind AND c.ref = v_ref FOR UPDATE;
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
    v_id := translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_');
    INSERT INTO public.share_cards (id, user_id, kind, ref, snapshot, expires_at)
    VALUES (v_id, p_user_id, p_kind, v_ref, v_data, NOW() + INTERVAL '90 days')
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('id', v_row.id, 'kind', v_row.kind, 'version', v_row.version,
                            'expires_at', v_row.expires_at, 'snapshot', v_row.snapshot);
END;
$$;

COMMENT ON FUNCTION public.create_share_card(UUID, TEXT, TEXT) IS
  '공유 카드 만들기·다시 공개 (P9-07). service_role 전용: POST /api/share-cards. 성과 숫자는 실제 기록에서 계산, 공개 정보만 스냅샷, 새 90일';

-- ------------------------------------------------------------
-- 3. share_card_public
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
   WHERE c.id = p_id AND c.is_public AND c.expires_at > NOW();
$$;

COMMENT ON FUNCTION public.share_card_public(TEXT) IS
  '공개 카드 조회 (P9-07). service_role 전용: 이미지 라우트·공유 페이지(P9-08). user_id 없음, 비공개·만료(90일)면 0행';

-- ------------------------------------------------------------
-- 4. 권한 + 자기 검증
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_share_card(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_card_public(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_share_card(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.share_card_public(TEXT) TO service_role;

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['public.create_share_card(uuid, text, text)', 'public.share_card_public(text)'] LOOP
    IF has_function_privilege('anon', v_fn::regprocedure, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn::regprocedure, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION '[00043] 검증 실패: % 실행 권한이 service_role 전용이 아님', v_fn;
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.share_cards', 'SELECT')
     OR has_table_privilege('authenticated', 'public.share_cards', 'INSERT')
     OR has_table_privilege('authenticated', 'public.share_cards', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.share_cards', 'DELETE')
     OR has_table_privilege('service_role', 'public.share_cards', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.share_cards', 'SELECT') THEN
    RAISE EXCEPTION '[00043] 검증 실패: share_cards 권한 (본인 읽기만, 쓰기는 create_share_card)';
  END IF;
  IF length(translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_')) <> 22 THEN
    RAISE EXCEPTION '[00043] 검증 실패: 카드 id 가 22자가 아님 (pgcrypto)';
  END IF;
  RAISE NOTICE '[00043] 공유 카드: share_cards 본인 읽기만, create_share_card·share_card_public service_role 전용';
END $$;
