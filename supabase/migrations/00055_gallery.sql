-- ============================================================
-- 작품 갤러리: 스티커 반응 · 신고 · 갤러리 보기 (Idempotent)   (P11-07, §3 F13, §2.6, §12-Q13·Q74 ③④·Q75 ⑧⑨)
-- 릴리즈 단계: ① 추가형 (새 테이블 2개·뷰 1개·함수 1개. 00054 creations 의 권한·정책은 건드리지 않음 — 이전 앱은 부르지 않음)
--
-- 하는 일
--   1. creation_reactions: 정해진 스티커 5종(wow 우와 · love 좋아 · fun 재밌어 · smart 똑똑해 · cheer 최고야)만, 한 사람이 한 작품에
--        스티커마다 한 번(PK). 자유 글은 없음(F13). 쓰기·읽기 모두 service_role(/api/gallery — 보호자 동의 게이트·요청 한도 뒤)만
--   2. creation_reports: 신고(게시판 00014 와 같은 사유 4가지), 한 사람이 한 작품에 한 번. service_role 만
--   3. report_creation(): 신고 저장 + 자동 숨김(서로 다른 신고자 3명 → creations.hidden_at). service_role 만 실행
--   4. gallery_creations 뷰 (security_invoker): 공개 + 숨기지 않은 작품만, 작가는 공개 프로필(닉네임·파이뱀 모습)만,
--        코드는 작가가 "코드 보기"를 켠 작품만, 스티커 수 합계. service_role 만 읽음
--
-- 왜 학생 세션(authenticated)이 직접 읽지 않나
--   - Q74 ③ "공개 작품은 로그인한 학생만"은 API·페이지(getUser() 확인 뒤 service_role)가 지킨다.
--   - creations 에 "남의 공개 행 읽기" 정책을 더하면 그 행의 code·user_id 열까지 열린다(SELECT 열 권한은 회수하지 않는 규칙).
--     코드는 작가가 켠 작품만 보여야 하므로(Q75 ⑨) 공개 조회는 열을 고르고 거르는 이 뷰 하나로만 하고, 뷰는 서버만 읽는다.
--   - 보는 것은 보호자 동의 전(제한 모드)에도 된다(게시판 읽기와 같음). 스티커 누르기는 남에게 보이는 쓰기라 동의 게이트(API),
--     신고는 제한 모드에서도 받는다(00014 과 같음)
--
-- 적용 후 NOTICE `[00055] 갤러리: 스티커 5종·신고(3명 자동 숨김)·gallery_creations 뷰는 service_role 만` 확인
-- 확인: supabase/tests GAL-1(학생·anon 이 반응·신고·뷰·함수에 못 닿음), GAL-2(뷰는 공개·안 숨긴 작품만, 코드는 켠 것만, 스티커 합계),
--       GAL-3(신고 중복·본인·3명 자동 숨김)
-- 되돌리기: supabase/rollback/00055_gallery.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 스티커 반응
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creation_reactions (
  creation_id UUID NOT NULL REFERENCES public.creations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- 바꾸면 src/lib/gallery/stickers.ts 의 STICKERS 도
  sticker     TEXT NOT NULL CHECK (sticker IN ('wow', 'love', 'fun', 'smart', 'cheer')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (creation_id, user_id, sticker)
);
-- 탈퇴(users CASCADE) 때 지울 행 찾기
CREATE INDEX IF NOT EXISTS creation_reactions_user_idx ON public.creation_reactions (user_id);

COMMENT ON TABLE public.creation_reactions IS
  '갤러리 스티커 반응 (P11-07). 정해진 스티커만, 사람·작품·스티커마다 1개. service_role 전용(/api/gallery)';

ALTER TABLE public.creation_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.creation_reactions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.creation_reactions TO service_role;

-- ------------------------------------------------------------
-- 2. 신고
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creation_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- 작품이 지워져도 신고 기록은 남김 (같은 학생이 반복해서 신고되는지 보는 용도, 00014 와 같음)
  creation_id    UUID NOT NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason         TEXT NOT NULL CHECK (reason IN ('abuse', 'personal_info', 'bullying', 'other')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT creation_reports_reporter_creation_key UNIQUE (reporter_id, creation_id)
);
CREATE INDEX IF NOT EXISTS creation_reports_creation_idx ON public.creation_reports (creation_id);
CREATE INDEX IF NOT EXISTS creation_reports_created_at_idx ON public.creation_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS creation_reports_target_user_idx ON public.creation_reports (target_user_id);

COMMENT ON TABLE public.creation_reports IS
  '갤러리 작품 신고 (P11-07). service_role 전용: /api/gallery 가 report_creation 으로만 씀. 클라이언트 조회 불가';

ALTER TABLE public.creation_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.creation_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.creation_reports TO service_role;

-- 신고 저장 + 자동 숨김. API 가 getUser() 로 확인한 id 만 넘김 (service_role 전용, SECURITY INVOKER)
-- 반환: {"result": "reported" | "already" | "own" | "not_found", "hidden": bool}
CREATE OR REPLACE FUNCTION public.report_creation(
  p_reporter_id UUID,
  p_creation_id UUID,
  p_reason      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  c_hide_threshold CONSTANT INTEGER := 3;   -- 서로 다른 신고자 수. 바꾸면 src/lib/gallery/stickers.ts 의 GALLERY_REPORT_HIDE_THRESHOLD 도
  v_author   UUID;
  v_inserted INTEGER;
  v_count    INTEGER;
BEGIN
  -- 작품 행을 잠가 같은 작품의 신고를 한 줄로 세움 (3번째 신고가 동시에 와도 숨김을 놓치지 않음)
  SELECT user_id INTO v_author
    FROM public.creations
   WHERE id = p_creation_id AND visibility = 'public' AND hidden_at IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found', 'hidden', false);
  END IF;
  IF v_author = p_reporter_id THEN
    RETURN jsonb_build_object('result', 'own', 'hidden', false);
  END IF;

  INSERT INTO public.creation_reports (reporter_id, creation_id, target_user_id, reason)
  VALUES (p_reporter_id, p_creation_id, v_author, p_reason)
  ON CONFLICT ON CONSTRAINT creation_reports_reporter_creation_key DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 운영자가 다시 보이게 한(hidden_at 을 지운) 뒤에는 그 뒤에 들어온 신고만 센다
  SELECT count(*) INTO v_count
    FROM public.creation_reports r
   WHERE r.creation_id = p_creation_id
     AND r.created_at > coalesce((SELECT c.published_at FROM public.creations c WHERE c.id = p_creation_id), '-infinity');
  IF v_count >= c_hide_threshold THEN
    UPDATE public.creations SET hidden_at = now() WHERE id = p_creation_id;
  END IF;

  RETURN jsonb_build_object(
    'result', CASE WHEN v_inserted = 1 THEN 'reported' ELSE 'already' END,
    'hidden', v_count >= c_hide_threshold
  );
END;
$$;

COMMENT ON FUNCTION public.report_creation(UUID, UUID, TEXT) IS
  '갤러리 작품 신고 저장, 공개한 뒤 서로 다른 신고자 3명이면 hidden_at (P11-07). service_role 전용 (/api/gallery)';

REVOKE ALL ON FUNCTION public.report_creation(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_creation(UUID, UUID, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 3. 갤러리 보기 (서버 전용 뷰)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.gallery_creations
  WITH (security_invoker = true) AS
  SELECT c.id,
         c.user_id      AS author_id,   -- "내 작품인가"만 서버가 보고 화면에는 내보내지 않음
         c.kind,
         c.title,
         c.quest_id,
         c.show_code,
         CASE WHEN c.show_code THEN c.code END AS code,
         c.transcript,
         c.commands_gz,
         c.thumbnail,
         c.published_at,
         p.public_name  AS author_name,
         p.avatar_skin,
         p.avatar_look,
         coalesce((
           SELECT pg_catalog.jsonb_object_agg(s.sticker, s.n)
             FROM (SELECT r.sticker, count(*) AS n
                     FROM public.creation_reactions r
                    WHERE r.creation_id = c.id
                    GROUP BY r.sticker) s
         ), '{}'::jsonb) AS stickers
    FROM public.creations c
    LEFT JOIN public.user_public_profiles p ON p.user_id = c.user_id
   WHERE c.visibility = 'public' AND c.hidden_at IS NULL AND c.published_at IS NOT NULL;

COMMENT ON VIEW public.gallery_creations IS
  '갤러리 (P11-07): 공개·안 숨긴 작품 + 작가 공개 프로필(닉네임·파이뱀) + 스티커 합계. 코드는 show_code 인 것만. service_role 전용(로그인 확인은 API·페이지)';

REVOKE ALL ON public.gallery_creations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.gallery_creations TO service_role;

-- 갤러리 최신순
CREATE INDEX IF NOT EXISTS creations_gallery_idx ON public.creations (published_at DESC)
  WHERE visibility = 'public' AND hidden_at IS NULL;

-- ------------------------------------------------------------
-- 4. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(r, 'public.creation_reactions', 'SELECT')
       OR has_table_privilege(r, 'public.creation_reactions', 'INSERT')
       OR has_table_privilege(r, 'public.creation_reports', 'SELECT')
       OR has_table_privilege(r, 'public.creation_reports', 'INSERT')
       OR has_table_privilege(r, 'public.gallery_creations', 'SELECT')
       OR has_function_privilege(r, 'public.report_creation(uuid, uuid, text)', 'EXECUTE') THEN
      RAISE EXCEPTION '[00055] 검증 실패: % 가 갤러리 반응·신고·뷰·함수에 닿음', r;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role', 'public.gallery_creations', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.creation_reactions', 'INSERT')
     OR NOT has_function_privilege('service_role', 'public.report_creation(uuid, uuid, text)', 'EXECUTE')
     -- 00054 그대로: 학생은 숨김·공개 열을 못 씀
     OR has_column_privilege('authenticated', 'public.creations', 'hidden_at', 'UPDATE') THEN
    RAISE EXCEPTION '[00055] 검증 실패: service_role 권한 또는 creations 숨김 열';
  END IF;
  RAISE NOTICE '[00055] 갤러리: 스티커 5종·신고(3명 자동 숨김)·gallery_creations 뷰는 service_role 만';
END $$;
