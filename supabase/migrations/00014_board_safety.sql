-- ============================================================
-- 게시판 최소 안전장치: 길이·빈 값 CHECK, 신고·자동 숨김, 작성자 표시에서 실명 제거 (Idempotent)   (P1-18, B19)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱이 그대로 동작)
--
-- 배경
--   B19: 제목 100자·내용 2,000자·댓글 500자·빈 값 제한이 API(src/app/api/board/**)에만 있어서
--        로그인 사용자가 브라우저에서 POST /rest/v1/board_posts 로 직접 넣으면 우회됩니다.
--   X1:  user_profiles_public.display_name 이 기존 Google 사용자의 실명입니다. B03(00002)은 비로그인 조회만 막았으므로
--        로그인한 아이는 게시판 작성자 표시와 GET /rest/v1/user_profiles_public?select=* 로 다른 아이의 실명을 볼 수 있습니다.
--   X11: 금칙어 필터(src/lib/moderation, 서버)·신고가 없습니다.
--
-- 하는 일
--   1. board_posts·board_comments 길이·빈 값 CHECK
--        board_posts_title_check    제목: 공백만 있으면 안 됨, 100자 이하
--        board_posts_content_check  내용: 공백만 있으면 안 됨, 2,000자 이하
--        board_comments_content_check 댓글: 공백만 있으면 안 됨, 500자 이하
--      글자 수는 char_length(코드 포인트). API 도 같은 기준(src/lib/board/limits.ts)입니다.
--      이전 앱 API 는 JS .length(UTF-16 단위, 코드 포인트 수 이상)로 같은 한도와 trim 을 검사하므로 이전 앱이 저장하는 글은 모두 통과합니다.
--      운영에 이미 위반 행이 있으면(REST 직접 INSERT 로 우회한 글) 그 제약만 NOT VALID 로 추가하고(새 INSERT·UPDATE 만 검사) NOTICE 로
--      알립니다 → 런북 "00014 확인"의 쿼리로 행을 정리한 뒤 VALIDATE CONSTRAINT.
--   2. 숨김: is_hidden·hidden_at 컬럼 (신고가 쌓이면 자동 숨김, 관리자가 SQL 로 해제)
--      - 보호 트리거 board_protect_moderation: anon·authenticated 가 쓴 is_hidden·hidden_at 은 버림
--        (③ 00015 전까지는 클라이언트에 INSERT·UPDATE 권한이 남아 있으므로)
--      - SELECT 정책: 숨긴 글·댓글은 작성자 본인만 봄. 댓글은 글이 보일 때만 보임(글의 RLS 를 따름)
--        → 숨긴 글의 댓글·댓글 수도 다른 사람에게 보이지 않음. 지금 숨긴 행이 없으므로 이전 앱의 조회 결과는 같음
--        ⚠️ 운영 순서상 뒤에 적용되는 ③ 00011 이 이 정책을 USING (true) 로 다시 쓰므로 ③ 00015 가 같은 정의로 다시 만듦
--   3. 신고: board_reports (service_role 전용, RLS ON + 정책 없음) + report_board_content (service_role 전용)
--      - 한 사람이 같은 글·댓글을 한 번만 신고 (UNIQUE), 본인 글은 신고 불가
--      - 서로 다른 신고자 3명 이상이면 자동 숨김. 대상 행을 FOR UPDATE 로 잠가 동시에 들어온 신고도 정확히 셈
--      - 신고 사유: abuse(욕설) · personal_info(개인정보) · bullying(괴롭힘) · other(기타). 자유 입력은 받지 않음(개인정보가 들어올 수 있음)
--   4. user_profiles_public: display_name = coalesce(nickname, "모험가NNNN"), avatar_url = NULL
--      - 자리표시자는 00013 placeholder_display_name 과 같은 식(user id 해시)을 뷰 안에 그대로 씀.
--        함수를 부르면 뷰를 읽는 authenticated 에게 EXECUTE 가 필요하고(00013 이 회수함), 운영 순서상 이 파일(①)이
--        00013(③)보다 먼저 적용되어 함수가 아직 없으므로 식을 복사하고 회귀 VIEW-3 이 같은지 대조
--      - 컬럼 이름·타입은 그대로라 이전 앱도 그대로 동작합니다(작성자가 "모험가NNNN" 으로 보임). 실명·프로필 사진은 더 이상 뷰로 나가지 않음
--      - users.display_name 값 자체는 바꾸지 않음(본인 화면용. 교체는 P3-12·P3-13). 뷰 구조(security_invoker)도 P3-13
--   5. 자기 검증: 제약·트리거·정책·권한이 기대와 다르면 예외 → 전체 롤백
--
-- 클라이언트의 board INSERT·UPDATE·DELETE 권한 회수는 ③ 00015 (새 앱은 금칙어 필터를 거쳐 서버(service_role)로만 씀).
-- 확인: supabase/tests B19-1~6, BH-1~4, BR-1~6, VIEW-3, APP-13·14
-- 되돌리기: supabase/rollback/00014_board_safety.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00014] CHECK 3개 (모두 VALID), 신고·숨김 준비, user_profiles_public 실명 0` 확인
--   (위반 행이 있으면 그 앞에 `⚠️ 이미 한도를 넘거나 빈 행이 있음: …` NOTICE 와 `NOT VALID: <제약>` 이 나옴)
-- ============================================================

-- ------------------------------------------------------------
-- 1. 길이·빈 값 CHECK (B19)
--    '[^[:space:]]' : 공백이 아닌 글자가 하나 이상 (빈 문자열·공백만 있는 값 거부)
--    위반 행이 있으면 NOT VALID 로 추가. 다시 실행하면 다시 검사함
-- ------------------------------------------------------------
DO $$
DECLARE
  v_title   INTEGER;
  v_content INTEGER;
  v_comment INTEGER;
BEGIN
  SELECT count(*) FILTER (WHERE NOT (title ~ '[^[:space:]]' AND char_length(title) <= 100)),
         count(*) FILTER (WHERE NOT (content ~ '[^[:space:]]' AND char_length(content) <= 2000))
    INTO v_title, v_content
    FROM public.board_posts;
  SELECT count(*) FILTER (WHERE NOT (content ~ '[^[:space:]]' AND char_length(content) <= 500))
    INTO v_comment
    FROM public.board_comments;

  ALTER TABLE public.board_posts DROP CONSTRAINT IF EXISTS board_posts_title_check;
  ALTER TABLE public.board_posts DROP CONSTRAINT IF EXISTS board_posts_content_check;
  ALTER TABLE public.board_comments DROP CONSTRAINT IF EXISTS board_comments_content_check;

  EXECUTE 'ALTER TABLE public.board_posts ADD CONSTRAINT board_posts_title_check'
       || ' CHECK (title ~ ''[^[:space:]]'' AND char_length(title) <= 100)'
       || CASE WHEN v_title > 0 THEN ' NOT VALID' ELSE '' END;
  EXECUTE 'ALTER TABLE public.board_posts ADD CONSTRAINT board_posts_content_check'
       || ' CHECK (content ~ ''[^[:space:]]'' AND char_length(content) <= 2000)'
       || CASE WHEN v_content > 0 THEN ' NOT VALID' ELSE '' END;
  EXECUTE 'ALTER TABLE public.board_comments ADD CONSTRAINT board_comments_content_check'
       || ' CHECK (content ~ ''[^[:space:]]'' AND char_length(content) <= 500)'
       || CASE WHEN v_comment > 0 THEN ' NOT VALID' ELSE '' END;

  IF v_title + v_content + v_comment > 0 THEN
    RAISE NOTICE '[00014] ⚠️ 이미 한도를 넘거나 빈 행이 있음: 제목 % · 내용 % · 댓글 % → 해당 CHECK 는 NOT VALID (새 쓰기만 검사). 런북 "00014 확인"으로 정리 후 VALIDATE',
      v_title, v_content, v_comment;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. 숨김 컬럼 + 보호 트리거
-- ------------------------------------------------------------
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE public.board_comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.board_comments ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

COMMENT ON COLUMN public.board_posts.is_hidden IS
  '신고 누적(report_board_content)으로 숨김. 작성자만 봄. 해제·삭제는 관리자 SQL (런북 "게시판 신고 처리", P1-18)';
COMMENT ON COLUMN public.board_comments.is_hidden IS
  '신고 누적(report_board_content)으로 숨김. 작성자만 봄. 해제·삭제는 관리자 SQL (런북 "게시판 신고 처리", P1-18)';

-- SECURITY INVOKER: current_user 가 요청한 역할 그대로 (service_role·postgres 는 바꿀 수 있음)
CREATE OR REPLACE FUNCTION public.board_protect_moderation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_hidden := false;
      NEW.hidden_at := NULL;
    ELSE
      NEW.is_hidden := OLD.is_hidden;
      NEW.hidden_at := OLD.hidden_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.board_protect_moderation() IS
  'anon/authenticated 가 board_posts·board_comments 의 is_hidden·hidden_at 에 쓴 값을 버림 (P1-18). ③ 00015 이후에도 이중 방어로 유지';

REVOKE ALL ON FUNCTION public.board_protect_moderation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_board_posts_protect_moderation ON public.board_posts;
CREATE TRIGGER trg_board_posts_protect_moderation
  BEFORE INSERT OR UPDATE ON public.board_posts
  FOR EACH ROW EXECUTE FUNCTION public.board_protect_moderation();

DROP TRIGGER IF EXISTS trg_board_comments_protect_moderation ON public.board_comments;
CREATE TRIGGER trg_board_comments_protect_moderation
  BEFORE INSERT OR UPDATE ON public.board_comments
  FOR EACH ROW EXECUTE FUNCTION public.board_protect_moderation();

-- SELECT 정책 (00011 의 USING (true) → 숨긴 행은 작성자만)
DROP POLICY IF EXISTS "board_posts_select_authenticated" ON public.board_posts;
CREATE POLICY "board_posts_select_authenticated" ON public.board_posts
  FOR SELECT TO authenticated
  USING (NOT is_hidden OR (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "board_comments_select_authenticated" ON public.board_comments;
CREATE POLICY "board_comments_select_authenticated" ON public.board_comments
  FOR SELECT TO authenticated
  USING (
    (NOT is_hidden OR (select auth.uid()) = user_id)
    AND EXISTS (SELECT 1 FROM public.board_posts p WHERE p.id = post_id)   -- 글의 SELECT 정책을 따름
  );

-- ------------------------------------------------------------
-- 3. 신고
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.board_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type    TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id      UUID NOT NULL,
  -- 신고 당시 작성자 (같은 사람이 반복해서 신고되는지 보는 용도). 대상이 지워져도 신고 기록은 남김
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason         TEXT NOT NULL CHECK (reason IN ('abuse', 'personal_info', 'bullying', 'other')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT board_reports_reporter_target_key UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_board_reports_target ON public.board_reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_board_reports_created_at ON public.board_reports (created_at DESC);

COMMENT ON TABLE public.board_reports IS
  '게시판 신고 (P1-18). service_role 전용: /api/board/reports 가 report_board_content 로만 씀. 클라이언트 조회 불가';

ALTER TABLE public.board_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.board_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.board_reports TO service_role;

-- 신고 저장 + 자동 숨김. API Route 가 getUser() 로 확인한 사용자 id 만 넘김 (service_role 전용)
-- 반환: {"result": "reported" | "already" | "own" | "not_found", "hidden": bool}
CREATE OR REPLACE FUNCTION public.report_board_content(
  p_reporter_id UUID,
  p_target_type TEXT,
  p_target_id   UUID,
  p_reason      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  c_hide_threshold CONSTANT INTEGER := 3;   -- 서로 다른 신고자 수. 바꾸면 src/lib/board/limits.ts 의 REPORT_HIDE_THRESHOLD 도
  v_author   UUID;
  v_hidden   BOOLEAN;
  v_inserted INTEGER;
  v_count    INTEGER;
BEGIN
  -- 대상 행을 잠가 같은 대상의 신고를 한 줄로 세움 (3번째 신고가 동시에 와도 숨김을 놓치지 않음)
  IF p_target_type = 'post' THEN
    SELECT user_id, is_hidden INTO v_author, v_hidden
      FROM public.board_posts WHERE id = p_target_id FOR UPDATE;
  ELSIF p_target_type = 'comment' THEN
    SELECT user_id, is_hidden INTO v_author, v_hidden
      FROM public.board_comments WHERE id = p_target_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'report_board_content: 알 수 없는 target_type %', p_target_type USING ERRCODE = '22023';
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found', 'hidden', false);
  END IF;
  IF v_author = p_reporter_id THEN
    RETURN jsonb_build_object('result', 'own', 'hidden', v_hidden);
  END IF;

  INSERT INTO public.board_reports (reporter_id, target_type, target_id, target_user_id, reason)
  VALUES (p_reporter_id, p_target_type, p_target_id, v_author, p_reason)
  ON CONFLICT ON CONSTRAINT board_reports_reporter_target_key DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF NOT v_hidden THEN
    SELECT count(*) INTO v_count
      FROM public.board_reports
     WHERE target_type = p_target_type AND target_id = p_target_id;
    IF v_count >= c_hide_threshold THEN
      IF p_target_type = 'post' THEN
        UPDATE public.board_posts SET is_hidden = true, hidden_at = now() WHERE id = p_target_id;
      ELSE
        UPDATE public.board_comments SET is_hidden = true, hidden_at = now() WHERE id = p_target_id;
      END IF;
      v_hidden := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'result', CASE WHEN v_inserted = 1 THEN 'reported' ELSE 'already' END,
    'hidden', v_hidden
  );
END;
$$;

COMMENT ON FUNCTION public.report_board_content(UUID, TEXT, UUID, TEXT) IS
  '게시판 신고 저장, 서로 다른 신고자 3명 이상이면 is_hidden (P1-18). service_role 전용 (/api/board/reports)';

REVOKE ALL ON FUNCTION public.report_board_content(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_board_content(UUID, TEXT, UUID, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 4. user_profiles_public: 실명·프로필 사진 대신 닉네임 → 자리표시자 (X1, P1-18)
--    CREATE OR REPLACE VIEW 는 기존 권한을 유지하지만 원칙대로 다시 적음 (00002·00003 과 같은 권한)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_profiles_public AS
  SELECT id,
         coalesce(
           nickname,
           -- = public.placeholder_display_name(id) (00013). 바꾸면 두 곳을 함께 (회귀 VIEW-3 이 대조)
           '모험가' || lpad((abs(pg_catalog.hashtextextended(id::text, 0)) % 10000)::text, 4, '0')
         ) AS display_name,
         NULL::text AS avatar_url   -- provider 프로필 사진을 내보내지 않음 (캐릭터 아바타는 P3-13)
  FROM public.users;

COMMENT ON VIEW public.user_profiles_public IS
  '다른 사용자에게 보이는 이름: 닉네임, 없으면 "모험가NNNN" (P1-18). 실명·사진 없음. security_invoker 교체는 P3-13';

REVOKE ALL ON public.user_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_profiles_public TO authenticated;
GRANT ALL ON public.user_profiles_public TO service_role;

-- ------------------------------------------------------------
-- 5. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad      TEXT[] := '{}';
  v_role     TEXT;
  v_invalid  TEXT;
  v_realname INTEGER;
BEGIN
  IF (SELECT count(*) FROM pg_constraint
       WHERE conname IN ('board_posts_title_check', 'board_posts_content_check', 'board_comments_content_check')
         AND contype = 'c') <> 3 THEN
    v_bad := v_bad || 'CHECK 3개'::TEXT;
  END IF;
  IF (SELECT count(*) FROM pg_trigger
       WHERE tgname IN ('trg_board_posts_protect_moderation', 'trg_board_comments_protect_moderation')) <> 2 THEN
    v_bad := v_bad || '보호 트리거 2개'::TEXT;
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.board_reports', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') THEN
      v_bad := v_bad || (v_role || ':board_reports');
    END IF;
    IF has_function_privilege(v_role, 'public.report_board_content(uuid, text, uuid, text)', 'EXECUTE')
       OR has_function_privilege(v_role, 'public.board_protect_moderation()', 'EXECUTE') THEN
      v_bad := v_bad || (v_role || ':EXECUTE');
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.user_profiles_public', 'SELECT') THEN
    v_bad := v_bad || 'anon:user_profiles_public'::TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'board_reports') THEN
    v_bad := v_bad || 'board_reports 정책'::TEXT;
  END IF;

  -- 뷰 이름이 닉네임·자리표시자가 아닌 행 (= 실명이 나갈 수 있는 행).
  -- 운영 순서상 ③ 00013(placeholder_display_name)보다 먼저 적용되므로 함수 대신 같은 식으로 비교 (함수와의 대조는 회귀 VIEW-3)
  SELECT count(*) INTO v_realname
    FROM public.user_profiles_public v JOIN public.users u ON u.id = v.id
   WHERE v.display_name IS DISTINCT FROM coalesce(
           u.nickname,
           '모험가' || lpad((abs(pg_catalog.hashtextextended(u.id::text, 0)) % 10000)::text, 4, '0'))
      OR v.display_name !~ '^모험가[0-9]{4}$' AND u.nickname IS NULL
      OR v.avatar_url IS NOT NULL;
  IF v_realname > 0 THEN
    v_bad := v_bad || (v_realname || '행: 뷰 이름이 닉네임·자리표시자와 다름');
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00014] 기대와 다름: %', array_to_string(v_bad, ', ');
  END IF;

  SELECT coalesce(string_agg(conname, ', ' ORDER BY conname), '') INTO v_invalid
    FROM pg_constraint
   WHERE conname IN ('board_posts_title_check', 'board_posts_content_check', 'board_comments_content_check')
     AND NOT convalidated;
  RAISE NOTICE '[00014] CHECK 3개 (%), 신고·숨김 준비, user_profiles_public 실명 0',
    CASE WHEN v_invalid = '' THEN '모두 VALID' ELSE 'NOT VALID: ' || v_invalid END;
END $$;
