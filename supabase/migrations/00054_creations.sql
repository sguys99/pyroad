-- ============================================================
-- 작품 (Idempotent)   (P11-06, §2.2 creations, §2.6 공개 정보, §12-Q74 ③④·Q75 ⑧⑨, world3.md §7, P0-06)
-- 릴리즈 단계: ① 추가형 (새 테이블 1개·트리거 함수 1개, 기존 객체는 건드리지 않음 — 이전 앱은 부르지 않음)
--
-- 하는 일
--   1. creations: 작품 1개 = 1행. 저장은 기본 비공개(visibility = 'private'), 다른 학생이 보는 길은 아직 없음(갤러리 P11-07)
--        kind        = drawing(turtle 그림 — 명령 스트림 commands_gz 필수) | conversation(대화 기록 transcript 필수, 그림 없음, Q74 ④)
--        quest_id    = 어느 퀘스트에서 만들었나 (NULL 가능, 퀘스트가 지워지면 NULL). 공개(출품)는 3월드 프로젝트를 끝낸 작품만(Q75 ⑧, API 가 확인)
--        title       = 1~20자 한 줄 (금칙어는 API, 닉네임과 같은 규칙 — world3.md §7 ④)
--        code        = 학생 코드 (20,000바이트 상한). 갤러리 "코드 보기"는 show_code 를 켠 작품만 (Q75 ⑨, 기본 false)
--        commands_gz = turtle 명령 JSON 의 gzip (서버가 다시 압축해 넣음, 100KB 상한 + gzip 머리 1f8b 를 CHECK 로)
--        transcript  = 작가 본인이 실행한 대화 [{text, answer?}] (400줄·32KB 상한, Q74 ④)
--        thumbnail   = 400×400 PNG (Storage 대신 이 행 안에: 로컬·CI 스택이 Storage 를 켜지 않아도 같은 RLS 로 지켜짐. 200KB 상한 + PNG 머리 CHECK)
--        hidden_at   = 운영자 숨김 (P11-07, service_role 만 씀) · published_at = 처음/다시 공개한 시각
--   2. 권한: 본인 행만 읽기·지우기·비공개 저장(INSERT 열 제한)·고치기(제목·코드 보기·비공개로 — 고친 행은 늘 비공개).
--        공개(visibility = 'public')로 바꾸는 길은 service_role(/api/creations/{id}, 보호자 동의·출품 자격·금칙어·개인정보 검사 뒤)만.
--        anon 은 아무것도 못 함
--   3. creations_guard 트리거: 사용자당 60개 상한(INSERT, PT409 creations_limit) · updated_at 갱신(UPDATE)
--   4. 권한 + 자기 검증
-- 적용 후 NOTICE `[00054] 작품: creations 본인 행만(공개 전환은 service_role), 사용자당 60개` 확인
-- 확인: supabase/tests CRE-1(남의 행·anon·공개로 쓰기·숨김 열 막힘), CRE-2(본인 비공개 저장·고치기·지우기, 크기 CHECK, 60개 상한)
-- 되돌리기: supabase/rollback/00054_creations.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. creations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quest_id     UUID REFERENCES public.quests(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('drawing', 'conversation')),
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 20 AND title = btrim(title) AND title !~ '[[:cntrl:]]'),
  code         TEXT NOT NULL DEFAULT '' CHECK (octet_length(code) <= 20000),
  commands_gz  BYTEA CHECK (commands_gz IS NULL OR (octet_length(commands_gz) BETWEEN 20 AND 102400
                                                    AND substring(commands_gz FROM 1 FOR 2) = '\x1f8b'::bytea)),
  transcript   JSONB CHECK (transcript IS NULL OR (pg_catalog.jsonb_typeof(transcript) = 'array'
                                                   AND pg_catalog.jsonb_array_length(transcript) BETWEEN 1 AND 400
                                                   AND octet_length(transcript::text) <= 32768)),
  thumbnail    BYTEA CHECK (thumbnail IS NULL OR (octet_length(thumbnail) BETWEEN 67 AND 204800
                                                  AND substring(thumbnail FROM 1 FOR 8) = '\x89504e470d0a1a0a'::bytea)),
  visibility   TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  show_code    BOOLEAN NOT NULL DEFAULT false,
  hidden_at    TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creations_kind_payload_check CHECK (
    (kind = 'drawing' AND commands_gz IS NOT NULL)
    OR (kind = 'conversation' AND transcript IS NOT NULL AND commands_gz IS NULL AND thumbnail IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS creations_user_idx ON public.creations (user_id, created_at DESC);
-- 퀘스트가 지워질 때 SET NULL · 갤러리(P11-07) 퀘스트별 모아 보기
CREATE INDEX IF NOT EXISTS creations_quest_idx ON public.creations (quest_id);

COMMENT ON TABLE public.creations IS
  '3월드 작품 (P11-06). 그림 = turtle 명령 gzip + 썸네일 PNG, 대화 = 작가가 실행한 기록. 기본 비공개, 공개 전환은 service_role(API 검사 뒤)만';

-- ------------------------------------------------------------
-- 2. 권한·RLS
-- ------------------------------------------------------------
ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.creations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.creations TO authenticated;
GRANT INSERT (user_id, quest_id, kind, title, code, commands_gz, transcript, thumbnail, show_code) ON TABLE public.creations TO authenticated;
GRANT UPDATE (title, show_code, visibility) ON TABLE public.creations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.creations TO service_role;

DROP POLICY IF EXISTS "creations_select_own" ON public.creations;
CREATE POLICY "creations_select_own" ON public.creations
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "creations_insert_own" ON public.creations;
CREATE POLICY "creations_insert_own" ON public.creations
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND visibility = 'private' AND hidden_at IS NULL AND published_at IS NULL);

-- 본인이 고친 행은 늘 비공개 (공개 중인 작품의 제목을 바꾸려면 비공개로 바꾸거나, API 가 검사 뒤 service_role 로)
DROP POLICY IF EXISTS "creations_update_own" ON public.creations;
CREATE POLICY "creations_update_own" ON public.creations
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id AND visibility = 'private');

DROP POLICY IF EXISTS "creations_delete_own" ON public.creations;
CREATE POLICY "creations_delete_own" ON public.creations
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 3. creations_guard: 사용자당 60개 · updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creations_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- shortcut: 동시에 여러 개를 저장하면 몇 개 넘칠 수 있음 (API 요청 한도가 막음). 정확히 막아야 하면 사용자 행 잠금으로
    IF (SELECT count(*) FROM public.creations c WHERE c.user_id = NEW.user_id) >= 60 THEN
      RAISE EXCEPTION 'creations_limit' USING ERRCODE = 'PT409';
    END IF;
  ELSE
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.creations_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS creations_guard ON public.creations;
CREATE TRIGGER creations_guard
  BEFORE INSERT OR UPDATE ON public.creations
  FOR EACH ROW EXECUTE FUNCTION public.creations_guard();

-- ------------------------------------------------------------
-- 4. 자기 검증
-- ------------------------------------------------------------
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.creations', 'SELECT')
     OR has_table_privilege('anon', 'public.creations', 'INSERT')
     OR has_column_privilege('authenticated', 'public.creations', 'hidden_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.creations', 'user_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.creations', 'visibility', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.creations', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.creations', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.creations', 'UPDATE') THEN
    RAISE EXCEPTION '[00054] 검증 실패: creations 권한 (본인 행만, 공개·숨김 열은 service_role)';
  END IF;
  IF has_function_privilege('authenticated', 'public.creations_guard()', 'EXECUTE') THEN
    RAISE EXCEPTION '[00054] 검증 실패: creations_guard 실행 권한';
  END IF;
  RAISE NOTICE '[00054] 작품: creations 본인 행만(공개 전환은 service_role), 사용자당 60개';
END $$;
