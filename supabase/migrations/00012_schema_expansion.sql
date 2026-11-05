-- ============================================================
-- DB 스키마 1차 확장: worlds · 퀘스트 유형 · 별·시도 · quiz_attempts · 프로필 컬럼 · KST 함수 (Idempotent)   (P1-08)
-- 릴리즈 단계: ① 추가형 (지금 운영 중인 이전 앱이 그대로 동작함)
--
-- 하는 일 (docs/4.upgrade-plan.md §2.1·§2.2·§2.3)
--   0. KST 함수: kst_date(timestamptz) (IMMUTABLE, 인라인용으로 SET search_path 없이 pg_catalog. 명시) · kst_today()
--      has_three_day_streak 가 kst_date 를 쓰게 함 (결과는 같음, supabase/tests/fixtures/reward-rules.json)
--   1. worlds 테이블 + 1월드 python-island 행 (로그인 사용자 읽기 전용, 공개 콘텐츠: stages·quests 와 같은 원칙)
--   2. stages.world_id (기존 7개는 1월드로 백필, NOT NULL), UNIQUE("order") → UNIQUE(world_id, "order")
--   3. quests.quest_type (code/project/quiz/boss, 기존 백필) · quiz_kind (퀴즈만) · is_mobile_friendly,
--      quests.validation_type CHECK 에 contains_any·all 추가 (P1-11: 퀘스트 전체 규칙에도 쓸 수 있게)
--   4. user_progress.stars · best_stars (0~3) · attempts · stars_judged_on (마지막 별 판정일, KST date, §2.3 복습 규칙)
--      서버 값이라 클라이언트가 쓴 값은 버림 (user_progress_protect_earned_xp 트리거를 넓힘. ③ 00011 컬럼 권한에도 없음)
--   5. quiz_attempts 테이블 (퀴즈 제출 기록. 클라이언트 쓰기 불가, 본인 행 SELECT 만)
--   6. users.nickname (2~10자, KS X 1001 완성형 한글 2,350자·영문·숫자, 대소문자 무시 UNIQUE) · grade · avatar_config ·
--      settings (§2.2 기본 형태) · last_login_provider. last_login_at 은 00001 에 이미 있음 (갱신은 B24 00013)
--      클라이언트 UPDATE 권한은 주지 않음 (앱 UI 가 생기는 P3-11·P2-15 마이그레이션에서 GRANT UPDATE (…), ③ 00008 뒤)
--   7. is_stage_unlocked · reset_progress 가 월드 순서를 따름 ((월드 order, 스테이지 order) 순서. 1월드만 있는 지금은 동작 같음)
--   8. 자기 검증
--   Phase 8 객체(coins·coin_ledger·업적·미션)는 만들지 않습니다.
--
-- 이전 앱: 새 컬럼은 모두 기본값이 있고 이전 앱은 읽지 않습니다. stages."order" 는 1월드 안에서 그대로 유일하고,
--   이전 앱이 쓰는 컬럼·함수는 바뀌지 않습니다(is_stage_unlocked·reset_progress 는 새 앱의 RPC 만 씀).
-- 운영 DB 전제: legacy 기본 권한(새 테이블·함수가 만들자마자 anon 에게 열림)이므로 새 객체마다 REVOKE/GRANT 를 명시.
-- 운영 적용 순서 (Phase 1 릴리즈, §12-Q21): ① 이 파일 → ② 앱 배포 → ③ 00005·00008·00009·00011·00013 → 콘텐츠 seed
--   (콘텐츠 seed 는 worlds 를 slug 기준으로 업서트하고 quest_type 을 씀. 이 파일의 백필과 같은 값)
--   적용 후 NOTICE `[00012] worlds 1 (python-island), stages 7 → 월드 지정 7, quests 44 (code 43 · project 1), …` 확인
-- 되돌리기: supabase/rollback/00012_schema_expansion.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 0. KST 날짜 함수 (P1-05 설계, TS 는 src/lib/time/kst.ts)
--    kst_date: SQL 함수 인라인(호출 대신 식으로 펼침)이 되도록 SET search_path 를 두지 않고 모든 이름에 pg_catalog. 를
--      붙입니다(SET 이 있으면 인라인되지 않음). IMMUTABLE 이라 인덱스·생성 컬럼 식에도 쓸 수 있습니다.
--      Supabase Advisors 의 function_search_path_mutable 경고가 이 함수 하나에 남는 것은 의도한 것입니다.
--    kst_today: 출석·미션·복습 날짜 컬럼의 DEFAULT 와 비교에 씀 (STABLE: 트랜잭션 시작 시각 기준)
--    둘 다 비밀은 없지만 앱이 RPC 로 부르지 않으므로 service_role 만 실행 (SECURITY DEFINER RPC 안에서는 소유자 권한)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kst_date(p_at TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT pg_catalog.timezone('Asia/Seoul'::pg_catalog.text, p_at)::pg_catalog.date
$$;

COMMENT ON FUNCTION public.kst_date(TIMESTAMPTZ) IS
  'timestamptz → KST(Asia/Seoul) 날짜 (P1-08). 인라인용으로 SET search_path 없이 pg_catalog. 명시 (Advisors 경고는 의도한 것)';

CREATE OR REPLACE FUNCTION public.kst_today()
RETURNS DATE
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT public.kst_date(pg_catalog.now())
$$;

COMMENT ON FUNCTION public.kst_today() IS
  '오늘 KST 날짜 (P1-08). 출석·미션·복습 날짜 컬럼은 DEFAULT public.kst_today()';

REVOKE ALL ON FUNCTION public.kst_date(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kst_today() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kst_date(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.kst_today() TO service_role;

-- 3일 연속 (00006 과 같은 규칙, 날짜 계산만 kst_date 로). 권한은 CREATE OR REPLACE 가 그대로 유지 (service_role 만)
CREATE OR REPLACE FUNCTION public.has_three_day_streak(p_completed_at TIMESTAMPTZ[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH d AS (
    SELECT day, row_number() OVER (ORDER BY day DESC) AS rn
      FROM (SELECT DISTINCT public.kst_date(t) AS day
              FROM unnest(p_completed_at) AS t
             WHERE t IS NOT NULL) x
  )
  SELECT COALESCE(
           (SELECT count(*) = 3
                   AND max(day) FILTER (WHERE rn = 1) - max(day) FILTER (WHERE rn = 2) = 1
                   AND max(day) FILTER (WHERE rn = 2) - max(day) FILTER (WHERE rn = 3) = 1
              FROM d WHERE rn <= 3),
           false);
$$;

-- ------------------------------------------------------------
-- 1. worlds (§2.1: 월드 > 스테이지 > 퀘스트)
--    콘텐츠 원본은 content/worlds/<slug>/world.yaml. 콘텐츠 seed 가 slug 기준으로 업서트합니다.
--    unlock_rule: 월드 해제 규칙. 지금은 {"type": "open"} 만 (2월드 규칙 §12-Q2 는 Phase 10 에서 정함)
--    권한: stages·quests 와 같이 로그인 사용자만 전체 조회 (anon 은 권한 없음), 쓰기는 service_role(콘텐츠 seed)만
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worlds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order"     INTEGER NOT NULL,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  theme       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unlock_rule JSONB NOT NULL DEFAULT '{"type": "open"}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT worlds_order_key UNIQUE ("order"),
  CONSTRAINT worlds_slug_key UNIQUE (slug),
  CONSTRAINT worlds_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT worlds_unlock_rule_shape CHECK (jsonb_typeof(unlock_rule) = 'object' AND unlock_rule ? 'type')
);

COMMENT ON TABLE public.worlds IS
  '월드 (§2.1). 콘텐츠 seed(content/worlds/<slug>/world.yaml)가 slug 기준으로 업서트. 로그인 사용자 읽기 전용';

ALTER TABLE public.worlds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.worlds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.worlds TO authenticated;
GRANT ALL ON TABLE public.worlds TO service_role;

DROP POLICY IF EXISTS "worlds_select_authenticated" ON public.worlds;
CREATE POLICY "worlds_select_authenticated" ON public.worlds
  FOR SELECT TO authenticated
  USING (true);

-- 1월드. id 를 고정해 두어 stages.world_id 의 기본값(아래 2)·회귀 테스트가 환경마다 같은 값을 씀.
-- 제목 등은 콘텐츠 seed 가 world.yaml 값으로 덮어씀
INSERT INTO public.worlds (id, "order", slug, title, theme, description, unlock_rule)
VALUES ('c1000000-0000-0000-0000-000000000001', 1, 'python-island', '파이썬 섬', 'python_island',
        'print()부터 함수까지, 파이썬 기초를 배우는 첫 번째 섬이에요!', '{"type": "open"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- 2. stages.world_id
--    기본값 = 1월드: 월드를 모르는 예전 INSERT(손으로 쓴 예전 seed, content:compare -- --seed-rev)도 1월드로 들어감.
--    콘텐츠 seed 는 world_id 를 항상 명시합니다. 월드를 지워도 스테이지·진행이 사라지지 않게 ON DELETE 는 기본(NO ACTION)
-- ------------------------------------------------------------
ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS world_id UUID
  DEFAULT 'c1000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.worlds(id);

UPDATE public.stages
   SET world_id = (SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island')
 WHERE world_id IS NULL;

ALTER TABLE public.stages ALTER COLUMN world_id SET NOT NULL;

COMMENT ON COLUMN public.stages.world_id IS
  '월드 (P1-08). "order" 는 월드 안에서 유일 (stages_world_id_order_key). 기본값은 1월드(python-island)';

-- UNIQUE("order") → UNIQUE(world_id, "order"). 00001 의 이름 없는 UNIQUE 는 이름을 찾아서 지움
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.stages'::regclass
       AND c.contype = 'u'
       AND c.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a
                              WHERE a.attrelid = 'public.stages'::regclass AND a.attname = 'order')]::int2[]
  LOOP
    EXECUTE format('ALTER TABLE public.stages DROP CONSTRAINT %I', v_name);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.stages'::regclass AND conname = 'stages_world_id_order_key') THEN
    ALTER TABLE public.stages ADD CONSTRAINT stages_world_id_order_key UNIQUE (world_id, "order");
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. quests: quest_type · quiz_kind · is_mobile_friendly, validation_type CHECK 확장
--    quest_type 기본값 'code': 유형을 모르는 예전 INSERT 용. 콘텐츠 seed 는 항상 명시합니다.
--    quiz_kind 는 퀴즈일 때만 (P7-01). 퀴즈의 validation_type 은 P7-01 에서 정함
-- ------------------------------------------------------------
ALTER TABLE public.quests ADD COLUMN IF NOT EXISTS quest_type TEXT NOT NULL DEFAULT 'code';
ALTER TABLE public.quests ADD COLUMN IF NOT EXISTS quiz_kind TEXT;
ALTER TABLE public.quests ADD COLUMN IF NOT EXISTS is_mobile_friendly BOOLEAN NOT NULL DEFAULT false;

-- 백필: 단계가 있는 퀘스트(7-1)는 project. 다시 실행해도 안전 (code 로 남은 프로젝트만 고침)
UPDATE public.quests
   SET quest_type = 'project'
 WHERE quest_type = 'code'
   AND jsonb_typeof(prompt_skeleton->'steps') = 'array'
   AND jsonb_array_length(prompt_skeleton->'steps') > 0;

ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_quest_type_check;
ALTER TABLE public.quests ADD CONSTRAINT quests_quest_type_check
  CHECK (quest_type IN ('code', 'project', 'quiz', 'boss'));
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_quiz_kind_check;
ALTER TABLE public.quests ADD CONSTRAINT quests_quiz_kind_check
  CHECK (quiz_kind IN ('multiple_choice', 'fill_blank', 'parsons', 'bug_hunt'));
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_quiz_kind_only_for_quiz;
ALTER TABLE public.quests ADD CONSTRAINT quests_quiz_kind_only_for_quiz
  CHECK ((quest_type = 'quiz') = (quiz_kind IS NOT NULL));

-- validation_type: 00001 의 이름 없는 CHECK(quests_validation_type_check)를 바꿈.
-- contains_any·all 은 기준값을 JSON 문자열로 quest_answer_keys.expected_output 에 저장 (src/lib/quest/validation.ts toStoredRule)
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_validation_type_check;
ALTER TABLE public.quests ADD CONSTRAINT quests_validation_type_check
  CHECK (validation_type IN ('output_match', 'contains', 'contains_any', 'code_check', 'all'));

COMMENT ON COLUMN public.quests.quest_type IS '퀘스트 유형 code | project | quiz | boss (P1-08, §2.1)';
COMMENT ON COLUMN public.quests.quiz_kind IS
  '퀴즈 종류 multiple_choice | fill_blank | parsons | bug_hunt. quest_type = quiz 일 때만 (P7-01)';
COMMENT ON COLUMN public.quests.is_mobile_friendly IS '키보드 없이 풀 수 있는 퀘스트 (Phase 7 모바일 문제 유형)';

-- ------------------------------------------------------------
-- 4. user_progress: 별·시도 (서버 값)
--    stars           마지막 판정의 별 0~3 (0 = 아직 판정 없음)
--    best_stars      지금까지 가장 많이 받은 별. 보상은 이 값을 넘을 때만 (P8-05)
--    attempts        채점 시도 수 (코드 퀘스트 제출·퀴즈 제출. 퀴즈 시도 번호의 원본은 quiz_attempts)
--    stars_judged_on 마지막 별 판정일 (KST date). 복습 도전은 public.kst_today() > stars_judged_on 일 때만 (§2.3)
--    완료 RPC 는 아직 이 값을 쓰지 않습니다 (별 규칙·기존 완료 행 백필은 P8-05). 지금 값은 모두 0 / NULL
-- ------------------------------------------------------------
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS stars SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS best_stars SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS stars_judged_on DATE;

ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_stars_range;
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_stars_range
  CHECK (stars BETWEEN 0 AND 3 AND best_stars BETWEEN 0 AND 3 AND best_stars >= stars);
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_attempts_nonneg;
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_attempts_nonneg CHECK (attempts >= 0);

COMMENT ON COLUMN public.user_progress.stars IS '마지막 판정의 별 0~3 (서버 전용, P1-08 · 규칙은 P8-05)';
COMMENT ON COLUMN public.user_progress.best_stars IS '최고 별 0~3 (서버 전용). 새로 얻은 별에만 보상 (P8-05)';
COMMENT ON COLUMN public.user_progress.attempts IS '채점 시도 수 (서버 전용)';
COMMENT ON COLUMN public.user_progress.stars_judged_on IS
  '마지막 별 판정일 KST (서버 전용). 같은 날 다시 풀기는 연습, 다음 날부터 복습 도전 (§2.3)';

-- 클라이언트 쓰기 무시 (00006 의 earned_xp 와 같은 방식).
-- ③ 00011 이후에는 컬럼 권한이 없어 42501 이지만, ①만 적용된 동안(테이블 단위 권한)에도 서버 값이 바뀌지 않게
CREATE OR REPLACE FUNCTION public.user_progress_protect_earned_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.earned_xp       := 0;
      NEW.stars           := 0;
      NEW.best_stars      := 0;
      NEW.attempts        := 0;
      NEW.stars_judged_on := NULL;
    ELSE
      NEW.earned_xp       := OLD.earned_xp;
      NEW.stars           := OLD.stars;
      NEW.best_stars      := OLD.best_stars;
      NEW.attempts        := OLD.attempts;
      NEW.stars_judged_on := OLD.stars_judged_on;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.user_progress_protect_earned_xp() IS
  'anon/authenticated 가 user_progress 의 서버 값(earned_xp·stars·best_stars·attempts·stars_judged_on)에 쓴 값을 버림 (P1-03, P1-08). 컬럼 권한(00011) 뒤에도 이중 방어로 유지';

REVOKE ALL ON FUNCTION public.user_progress_protect_earned_xp() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 5. quiz_attempts: 퀴즈 제출 기록 (§2.2·§2.3, P0-08 초안 grade_quiz_rpc.draft.sql)
--    채점 RPC(submit_quiz_answer, P7-02, service_role 전용)만 씁니다. 진행 행을 FOR UPDATE 로 잠근 뒤 시도 번호를 매김.
--    mode       first(처음 별 판정) | review(다음 날부터의 복습 도전) | practice(같은 날 다시 풀기: 별·보상 없음)
--    attempt_no 같은 판정 회차(그날의 first/review/practice) 안에서 몇 번째 시도인지 (1부터). 별의 기준
--               회차마다 1부터 다시 세므로 (user, quest, attempt_no) 는 유일하지 않습니다. 회차 구분은 P7-02·P8-05 에서
--    answer     제출한 보기 id 등 (정답이 아님). 4KB 이하
--    권한: RLS ON + 본인 행 SELECT 정책. authenticated 는 SELECT 만, anon 은 없음. 쓰기는 service_role 만
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quest_id   UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  mode       TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  answer     JSONB NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_attempts_mode_check CHECK (mode IN ('first', 'review', 'practice')),
  CONSTRAINT quiz_attempts_attempt_no_positive CHECK (attempt_no >= 1),
  CONSTRAINT quiz_attempts_answer_size CHECK (octet_length(answer::text) <= 4096)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quest_created
  ON public.quiz_attempts (user_id, quest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quest_id ON public.quiz_attempts (quest_id);

COMMENT ON TABLE public.quiz_attempts IS
  '퀴즈 제출 기록 (P1-08, §2.3). 채점 RPC(service_role)만 씀. 사용자는 본인 행 조회만';

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.quiz_attempts TO authenticated;
GRANT ALL ON TABLE public.quiz_attempts TO service_role;

DROP POLICY IF EXISTS "quiz_attempts_select_own" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_select_own" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 6. users: 프로필 컬럼 (§2.2 필드 규칙)
--    nickname       공개 닉네임. 온보딩(P3-11)에서 본인이 정한 값만. 트리거·provider 메타데이터로 채우지 않음 (§2.8)
--                   2~10자, 완성형 한글 KS X 1001 2,350자 + 영문 + 숫자만 (§12-Q14. 제목 폰트·공유 카드 서브셋 범위)
--                   대소문자를 무시하고 유일 (P3-11 "중복 확인"을 DB 가 보장, 동시 가입 경합 없음)
--    grade          학년 1~6 (선택, P3-11)
--    avatar_config  캐릭터 꾸미기 {hat, glasses, cape, bg, skin} (P3-11·Phase 9). 2KB 이하 객체
--    settings       { sound: P0-15 기본값, motion: {tier:'auto', reduced:'system'} (P0-16) }. 4KB 이하 객체.
--                   기기마다 다른 측정값은 저장하지 않음(localStorage pyroad.motion.v1)
--    last_login_provider  google | kakao | naver. 로그인 트리거(00013, B24)가 씀. UI 힌트용 (인가 판단에 쓰지 않음)
--    클라이언트 UPDATE 권한은 이 파일에서 주지 않습니다 (B04-19). ③ 00008 이 users 권한을 REVOKE ALL 로 다시 쓰므로
--    GRANT UPDATE (nickname, …) 는 UI 를 만드는 작업(P3-11 닉네임·학년·캐릭터, P2-15 설정)의 마이그레이션에서 추가합니다.
-- ------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS grade SMALLINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT
  '{"sound": {"version": 1, "muted": false, "master": 0.8,
              "sfx": {"enabled": true, "volume": 0.7},
              "bgm": {"enabled": false, "volume": 0.4},
              "voice": {"enabled": true, "volume": 0.9},
              "updatedAt": 0},
    "motion": {"tier": "auto", "reduced": "system"}}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_provider TEXT;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_nickname_length;
ALTER TABLE public.users ADD CONSTRAINT users_nickname_length
  CHECK (char_length(nickname) BETWEEN 2 AND 10);
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_grade_range;
ALTER TABLE public.users ADD CONSTRAINT users_grade_range CHECK (grade BETWEEN 1 AND 6);
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_avatar_config_shape;
ALTER TABLE public.users ADD CONSTRAINT users_avatar_config_shape
  CHECK (jsonb_typeof(avatar_config) = 'object' AND octet_length(avatar_config::text) <= 2048);
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_settings_shape;
ALTER TABLE public.users ADD CONSTRAINT users_settings_shape
  CHECK (jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 4096);
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_last_login_provider_check;
ALTER TABLE public.users ADD CONSTRAINT users_last_login_provider_check
  CHECK (last_login_provider IN ('google', 'kakao', 'naver'));

CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_key
  ON public.users (lower(nickname)) WHERE nickname IS NOT NULL;

-- 닉네임 글자: KS X 1001 완성형 한글 2,350자 (EUC-KR 0xB0A1~0xC8FE) + A-Z a-z 0-9.
-- 유니코드 범위 가-힣(11,172자)은 "똠·햏"처럼 제목 폰트에 없는 글자도 받으므로 2,350자를 그대로 나열합니다.
-- 목록은 PostgreSQL 의 convert_from(<EUC-KR 바이트>, 'EUC_KR')로 만든 것이고, 회귀 테스트 NK-* 가 같은 변환과 비교합니다.
-- 줄바꿈은 CR·LF 모두 지웁니다(B39): Windows 에서 SQL Editor 에 붙여넣으면 줄바꿈이 CRLF 가 되어 LF 만 지우면 CR 48개가 남음.
-- (변환 함수를 CHECK 에 직접 쓰지 않는 이유: 범위 밖 글자에 check_violation 대신 변환 오류(22P05)가 나고,
--  PGlite 등 일부 환경에는 EUC_KR 변환이 없음)
DO $$
DECLARE
  v_hangul TEXT := translate($ksx$
가각간갇갈갉갊감갑값갓갔강갖갗같갚갛개객갠갤갬갭갯갰갱갸갹갼걀걋걍걔걘걜거걱건걷걸걺검겁것겄겅겆겉겊
겋게겐겔겜겝겟겠겡겨격겪견겯결겸겹겻겼경곁계곈곌곕곗고곡곤곧골곪곬곯곰곱곳공곶과곽관괄괆괌괍괏광괘괜
괠괩괬괭괴괵괸괼굄굅굇굉교굔굘굡굣구국군굳굴굵굶굻굼굽굿궁궂궈궉권궐궜궝궤궷귀귁귄귈귐귑귓규균귤그극
근귿글긁금급긋긍긔기긱긴긷길긺김깁깃깅깆깊까깍깎깐깔깖깜깝깟깠깡깥깨깩깬깰깸깹깻깼깽꺄꺅꺌꺼꺽꺾껀껄
껌껍껏껐껑께껙껜껨껫껭껴껸껼꼇꼈꼍꼐꼬꼭꼰꼲꼴꼼꼽꼿꽁꽂꽃꽈꽉꽐꽜꽝꽤꽥꽹꾀꾄꾈꾐꾑꾕꾜꾸꾹꾼꿀꿇꿈
꿉꿋꿍꿎꿔꿜꿨꿩꿰꿱꿴꿸뀀뀁뀄뀌뀐뀔뀜뀝뀨끄끅끈끊끌끎끓끔끕끗끙끝끼끽낀낄낌낍낏낑나낙낚난낟날낡낢남
납낫났낭낮낯낱낳내낵낸낼냄냅냇냈냉냐냑냔냘냠냥너넉넋넌널넒넓넘넙넛넜넝넣네넥넨넬넴넵넷넸넹녀녁년녈념
녑녔녕녘녜녠노녹논놀놂놈놉놋농높놓놔놘놜놨뇌뇐뇔뇜뇝뇟뇨뇩뇬뇰뇹뇻뇽누눅눈눋눌눔눕눗눙눠눴눼뉘뉜뉠뉨
뉩뉴뉵뉼늄늅늉느늑는늘늙늚늠늡늣능늦늪늬늰늴니닉닌닐닒님닙닛닝닢다닥닦단닫달닭닮닯닳담답닷닸당닺닻닿
대댁댄댈댐댑댓댔댕댜더덕덖던덛덜덞덟덤덥덧덩덫덮데덱덴델뎀뎁뎃뎄뎅뎌뎐뎔뎠뎡뎨뎬도독돈돋돌돎돐돔돕돗
동돛돝돠돤돨돼됐되된될됨됩됫됴두둑둔둘둠둡둣둥둬뒀뒈뒝뒤뒨뒬뒵뒷뒹듀듄듈듐듕드득든듣들듦듬듭듯등듸디
딕딘딛딜딤딥딧딨딩딪따딱딴딸땀땁땃땄땅땋때땍땐땔땜땝땟땠땡떠떡떤떨떪떫떰떱떳떴떵떻떼떽뗀뗄뗌뗍뗏뗐뗑
뗘뗬또똑똔똘똥똬똴뙈뙤뙨뚜뚝뚠뚤뚫뚬뚱뛔뛰뛴뛸뜀뜁뜅뜨뜩뜬뜯뜰뜸뜹뜻띄띈띌띔띕띠띤띨띰띱띳띵라락란랄
람랍랏랐랑랒랖랗래랙랜랠램랩랫랬랭랴략랸럇량러럭런럴럼럽럿렀렁렇레렉렌렐렘렙렛렝려력련렬렴렵렷렸령례
롄롑롓로록론롤롬롭롯롱롸롼뢍뢨뢰뢴뢸룀룁룃룅료룐룔룝룟룡루룩룬룰룸룹룻룽뤄뤘뤠뤼뤽륀륄륌륏륑류륙륜률
륨륩륫륭르륵른를름릅릇릉릊릍릎리릭린릴림립릿링마막만많맏말맑맒맘맙맛망맞맡맣매맥맨맬맴맵맷맸맹맺먀먁
먈먕머먹먼멀멂멈멉멋멍멎멓메멕멘멜멤멥멧멨멩며멱면멸몃몄명몇몌모목몫몬몰몲몸몹못몽뫄뫈뫘뫙뫼묀묄묍묏
묑묘묜묠묩묫무묵묶문묻물묽묾뭄뭅뭇뭉뭍뭏뭐뭔뭘뭡뭣뭬뮈뮌뮐뮤뮨뮬뮴뮷므믄믈믐믓미믹민믿밀밂밈밉밋밌밍
및밑바박밖밗반받발밝밞밟밤밥밧방밭배백밴밸뱀뱁뱃뱄뱅뱉뱌뱍뱐뱝버벅번벋벌벎범법벗벙벚베벡벤벧벨벰벱벳
벴벵벼벽변별볍볏볐병볕볘볜보복볶본볼봄봅봇봉봐봔봤봬뵀뵈뵉뵌뵐뵘뵙뵤뵨부북분붇불붉붊붐붑붓붕붙붚붜붤
붰붸뷔뷕뷘뷜뷩뷰뷴뷸븀븃븅브븍븐블븜븝븟비빅빈빌빎빔빕빗빙빚빛빠빡빤빨빪빰빱빳빴빵빻빼빽뺀뺄뺌뺍뺏뺐
뺑뺘뺙뺨뻐뻑뻔뻗뻘뻠뻣뻤뻥뻬뼁뼈뼉뼘뼙뼛뼜뼝뽀뽁뽄뽈뽐뽑뽕뾔뾰뿅뿌뿍뿐뿔뿜뿟뿡쀼쁑쁘쁜쁠쁨쁩삐삑삔삘
삠삡삣삥사삭삯산삳살삵삶삼삽삿샀상샅새색샌샐샘샙샛샜생샤샥샨샬샴샵샷샹섀섄섈섐섕서석섞섟선섣설섦섧섬
섭섯섰성섶세섹센셀셈셉셋셌셍셔셕션셜셤셥셧셨셩셰셴셸솅소속솎손솔솖솜솝솟송솥솨솩솬솰솽쇄쇈쇌쇔쇗쇘쇠
쇤쇨쇰쇱쇳쇼쇽숀숄숌숍숏숑수숙순숟술숨숩숫숭숯숱숲숴쉈쉐쉑쉔쉘쉠쉥쉬쉭쉰쉴쉼쉽쉿슁슈슉슐슘슛슝스슥슨
슬슭슴습슷승시식신싣실싫심십싯싱싶싸싹싻싼쌀쌈쌉쌌쌍쌓쌔쌕쌘쌜쌤쌥쌨쌩썅써썩썬썰썲썸썹썼썽쎄쎈쎌쏀쏘
쏙쏜쏟쏠쏢쏨쏩쏭쏴쏵쏸쐈쐐쐤쐬쐰쐴쐼쐽쑈쑤쑥쑨쑬쑴쑵쑹쒀쒔쒜쒸쒼쓩쓰쓱쓴쓸쓺쓿씀씁씌씐씔씜씨씩씬씰씸
씹씻씽아악안앉않알앍앎앓암압앗았앙앝앞애액앤앨앰앱앳앴앵야약얀얄얇얌얍얏양얕얗얘얜얠얩어억언얹얻얼얽
얾엄업없엇었엉엊엌엎에엑엔엘엠엡엣엥여역엮연열엶엷염엽엾엿였영옅옆옇예옌옐옘옙옛옜오옥온올옭옮옰옳옴
옵옷옹옻와왁완왈왐왑왓왔왕왜왝왠왬왯왱외왹왼욀욈욉욋욍요욕욘욜욤욥욧용우욱운울욹욺움웁웃웅워웍원월웜
웝웠웡웨웩웬웰웸웹웽위윅윈윌윔윕윗윙유육윤율윰윱윳융윷으윽은을읊음읍읏응읒읓읔읕읖읗의읜읠읨읫이익인
일읽읾잃임입잇있잉잊잎자작잔잖잗잘잚잠잡잣잤장잦재잭잰잴잼잽잿쟀쟁쟈쟉쟌쟎쟐쟘쟝쟤쟨쟬저적전절젊점접
젓정젖제젝젠젤젬젭젯젱져젼졀졈졉졌졍졔조족존졸졺좀좁좃종좆좇좋좌좍좔좝좟좡좨좼좽죄죈죌죔죕죗죙죠죡죤
죵주죽준줄줅줆줌줍줏중줘줬줴쥐쥑쥔쥘쥠쥡쥣쥬쥰쥴쥼즈즉즌즐즘즙즛증지직진짇질짊짐집짓징짖짙짚짜짝짠짢
짤짧짬짭짯짰짱째짹짼쨀쨈쨉쨋쨌쨍쨔쨘쨩쩌쩍쩐쩔쩜쩝쩟쩠쩡쩨쩽쪄쪘쪼쪽쫀쫄쫌쫍쫏쫑쫓쫘쫙쫠쫬쫴쬈쬐쬔쬘
쬠쬡쭁쭈쭉쭌쭐쭘쭙쭝쭤쭸쭹쮜쮸쯔쯤쯧쯩찌찍찐찔찜찝찡찢찧차착찬찮찰참찹찻찼창찾채책챈챌챔챕챗챘챙챠챤
챦챨챰챵처척천철첨첩첫첬청체첵첸첼쳄쳅쳇쳉쳐쳔쳤쳬쳰촁초촉촌촐촘촙촛총촤촨촬촹최쵠쵤쵬쵭쵯쵱쵸춈추축
춘출춤춥춧충춰췄췌췐취췬췰췸췹췻췽츄츈츌츔츙츠측츤츨츰츱츳층치칙친칟칠칡침칩칫칭카칵칸칼캄캅캇캉캐캑
캔캘캠캡캣캤캥캬캭컁커컥컨컫컬컴컵컷컸컹케켁켄켈켐켑켓켕켜켠켤켬켭켯켰켱켸코콕콘콜콤콥콧콩콰콱콴콸쾀
쾅쾌쾡쾨쾰쿄쿠쿡쿤쿨쿰쿱쿳쿵쿼퀀퀄퀑퀘퀭퀴퀵퀸퀼큄큅큇큉큐큔큘큠크큭큰클큼큽킁키킥킨킬킴킵킷킹타탁탄
탈탉탐탑탓탔탕태택탠탤탬탭탯탰탱탸턍터턱턴털턺텀텁텃텄텅테텍텐텔템텝텟텡텨텬텼톄톈토톡톤톨톰톱톳통톺
톼퇀퇘퇴퇸툇툉툐투툭툰툴툼툽툿퉁퉈퉜퉤튀튁튄튈튐튑튕튜튠튤튬튱트특튼튿틀틂틈틉틋틔틘틜틤틥티틱틴틸팀
팁팃팅파팍팎판팔팖팜팝팟팠팡팥패팩팬팰팸팹팻팼팽퍄퍅퍼퍽펀펄펌펍펏펐펑페펙펜펠펨펩펫펭펴편펼폄폅폈평
폐폘폡폣포폭폰폴폼폽폿퐁퐈퐝푀푄표푠푤푭푯푸푹푼푿풀풂품풉풋풍풔풩퓌퓐퓔퓜퓟퓨퓬퓰퓸퓻퓽프픈플픔픕픗
피픽핀필핌핍핏핑하학한할핥함합핫항해핵핸핼햄햅햇했행햐향허헉헌헐헒험헙헛헝헤헥헨헬헴헵헷헹혀혁현혈혐
협혓혔형혜혠혤혭호혹혼홀홅홈홉홋홍홑화확환활홧황홰홱홴횃횅회획횐횔횝횟횡효횬횰횹횻후훅훈훌훑훔훗훙훠
훤훨훰훵훼훽휀휄휑휘휙휜휠휨휩휫휭휴휵휸휼흄흇흉흐흑흔흖흗흘흙흠흡흣흥흩희흰흴흼흽힁히힉힌힐힘힙힛힝
$ksx$, E'\r\n', '');
BEGIN
  IF char_length(v_hangul) <> 2350
     OR (SELECT count(DISTINCT c) FROM regexp_split_to_table(v_hangul, '') AS c) <> 2350
     OR v_hangul !~ '^[가-힣]+$' THEN
    RAISE EXCEPTION '[00012] KS X 1001 한글 목록이 2,350자가 아님 (%자)', char_length(v_hangul);
  END IF;
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_nickname_chars;
  EXECUTE format('ALTER TABLE public.users ADD CONSTRAINT users_nickname_chars CHECK (nickname ~ %L)',
                 '^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' || v_hangul || ']+$');
END $$;

COMMENT ON COLUMN public.users.nickname IS
  '공개 닉네임 (P1-08, §12-Q14). 2~10자, KS X 1001 완성형 한글·영문·숫자, 대소문자 무시 유일. 온보딩(P3-11)에서 본인이 정한 값만';
COMMENT ON COLUMN public.users.grade IS '학년 1~6 (선택, P3-11)';
COMMENT ON COLUMN public.users.avatar_config IS '캐릭터 꾸미기 {hat, glasses, cape, bg, skin} (P3-11, Phase 9)';
COMMENT ON COLUMN public.users.settings IS
  '사용자 설정 {sound (P0-15), motion {tier, reduced} (P0-16)}. 클라이언트는 normalize 해서 읽음';
COMMENT ON COLUMN public.users.last_login_provider IS
  '최근 로그인 provider google | kakao | naver (로그인 트리거 00013). UI 힌트용, 인가 판단에 쓰지 않음';

-- ------------------------------------------------------------
-- 7. 월드를 고려한 스테이지 순서 (src/lib/world/stageOrder.ts 와 같은 규칙)
--    스테이지 순서 = (월드 order, 스테이지 order). 바로 앞 스테이지는 같은 월드에서는 order 가 하나 앞인 스테이지이고,
--    월드의 첫 스테이지는 이전 월드의 마지막 스테이지입니다 (§12-Q2 의 "이전 월드 최종 프로젝트 완료"와 같은 결과).
--    실력 확인 퀴즈로 월드를 바로 여는 규칙·worlds.unlock_rule 해석은 Phase 10 에서 이 함수에 더합니다.
--    1월드만 있는 지금은 00006 과 결과가 같습니다. 권한은 CREATE OR REPLACE 가 그대로 유지 (service_role 만)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_stage_unlocked(p_user_id UUID, p_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH cur AS (
    SELECT w."order" AS world_order, s."order" AS stage_order
      FROM public.stages s
      JOIN public.worlds w ON w.id = s.world_id
     WHERE s.id = p_stage_id
  ),
  prev AS (
    SELECT p.id
      FROM cur
      JOIN public.stages p ON true
      JOIN public.worlds pw ON pw.id = p.world_id
     WHERE (pw."order", p."order") < (cur.world_order, cur.stage_order)
     ORDER BY pw."order" DESC, p."order" DESC
     LIMIT 1
  )
  SELECT NOT EXISTS (SELECT 1 FROM prev)
      OR (
        EXISTS (SELECT 1 FROM public.quests q JOIN prev ON q.stage_id = prev.id)
        AND NOT EXISTS (
          SELECT 1
            FROM public.quests q
            JOIN prev ON q.stage_id = prev.id
           WHERE NOT EXISTS (
             SELECT 1 FROM public.user_progress up
              WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed'))
      );
$$;

-- reset_progress (00006): 'stage' 범위의 "그 뒤 스테이지"를 (월드 order, 스테이지 order) 순서로.
-- 그 밖의 동작·반환 형태는 00006 과 같습니다. 권한은 CREATE OR REPLACE 가 그대로 유지 (service_role 만)
CREATE OR REPLACE FUNCTION public.reset_progress(
  p_user_id  UUID,
  p_scope    TEXT,
  p_stage_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_golden_keys    INTEGER;
  v_target_world   INTEGER;
  v_target_order   INTEGER;
  v_reset_stages   JSONB;
  v_removed_quests INTEGER;
  v_removed_badges TEXT[];
  v_total_xp       INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_scope IS NULL OR p_scope NOT IN ('all', 'stage')
     OR (p_scope = 'stage' AND p_stage_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT u.golden_keys INTO v_golden_keys
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  IF p_scope = 'all' THEN
    WITH d AS (DELETE FROM public.user_badges WHERE user_id = p_user_id RETURNING badge_type)
    SELECT COALESCE(array_agg(badge_type ORDER BY badge_type), '{}') INTO v_removed_badges FROM d;
    WITH d AS (DELETE FROM public.user_progress WHERE user_id = p_user_id RETURNING 1)
    SELECT count(*) INTO v_removed_quests FROM d;
    UPDATE public.users
       SET total_xp = 0, current_level = 1, golden_keys = 3
     WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'scope',          'all',
      'reset_stages',   '[]'::jsonb,
      'removed_quests', v_removed_quests,
      'total_xp',       0,
      'level',          1,
      'golden_keys',    3,
      'removed_badges', to_jsonb(v_removed_badges));
  END IF;

  SELECT w."order", s."order" INTO v_target_world, v_target_order
    FROM public.stages s
    JOIN public.worlds w ON w.id = s.world_id
   WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'stage_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 대상 스테이지와 그 뒤 스테이지 (뒤 스테이지는 앞 스테이지를 다시 깨야 열리므로 함께 리셋)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'order', s."order", 'title', s.title)
                            ORDER BY w."order", s."order"), '[]'::jsonb)
    INTO v_reset_stages
    FROM public.stages s
    JOIN public.worlds w ON w.id = s.world_id
   WHERE (w."order", s."order") >= (v_target_world, v_target_order);

  WITH d AS (
    DELETE FROM public.user_progress up
     USING public.quests q, public.stages s, public.worlds w
     WHERE up.user_id = p_user_id
       AND q.id = up.quest_id
       AND s.id = q.stage_id
       AND w.id = s.world_id
       AND (w."order", s."order") >= (v_target_world, v_target_order)
    RETURNING 1
  )
  SELECT count(*) INTO v_removed_quests FROM d;

  -- total_xp 재계산: 남은 진행에서 실제로 받은 XP 의 합 (B12)
  SELECT COALESCE(sum(up.earned_xp), 0)::integer INTO v_total_xp
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.status = 'completed';

  UPDATE public.users
     SET total_xp = v_total_xp, current_level = public.level_for_xp(v_total_xp)
   WHERE id = p_user_id;

  -- stage_clear: 모든 퀘스트를 완료한 스테이지가 남아 있으면 유지
  WITH d AS (
    DELETE FROM public.user_badges b
     WHERE b.user_id = p_user_id
       AND b.badge_type = 'stage_clear'
       AND NOT EXISTS (
         SELECT 1
           FROM public.stages s
          WHERE EXISTS (SELECT 1 FROM public.quests q WHERE q.stage_id = s.id)
            AND NOT EXISTS (
              SELECT 1 FROM public.quests q
               WHERE q.stage_id = s.id
                 AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                                  WHERE up.user_id = p_user_id AND up.quest_id = q.id
                                    AND up.status = 'completed')))
    RETURNING badge_type
  )
  SELECT COALESCE(array_agg(badge_type), '{}') INTO v_removed_badges FROM d;

  RETURN jsonb_build_object(
    'scope',          'stage',
    'reset_stages',   v_reset_stages,
    'removed_quests', v_removed_quests,
    'total_xp',       v_total_xp,
    'level',          public.level_for_xp(v_total_xp),
    'golden_keys',    v_golden_keys,
    'removed_badges', to_jsonb(v_removed_badges));
END;
$$;

-- ------------------------------------------------------------
-- 8. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_worlds     INT;
  v_stages     INT;
  v_assigned   INT;
  v_quests     INT;
  v_code       INT;
  v_project    INT;
  v_mismatch   INT;
  v_exec       TEXT;
  v_bad        TEXT[] := '{}';
  v_role       TEXT;
BEGIN
  SELECT count(*) INTO v_worlds FROM public.worlds;
  SELECT count(*), count(*) FILTER (WHERE world_id IS NOT NULL) INTO v_stages, v_assigned FROM public.stages;
  SELECT count(*), count(*) FILTER (WHERE quest_type = 'code'), count(*) FILTER (WHERE quest_type = 'project')
    INTO v_quests, v_code, v_project FROM public.quests;
  -- 단계가 있는 퀘스트 = project
  SELECT count(*) INTO v_mismatch FROM public.quests
   WHERE (quest_type = 'project')
         <> (jsonb_typeof(prompt_skeleton->'steps') = 'array' AND jsonb_array_length(prompt_skeleton->'steps') > 0);

  IF NOT EXISTS (SELECT 1 FROM public.worlds WHERE slug = 'python-island') THEN
    v_bad := v_bad || '1월드(python-island) 없음'::TEXT;
  END IF;
  IF v_assigned <> v_stages THEN
    v_bad := v_bad || ('월드가 없는 스테이지 ' || (v_stages - v_assigned));
  END IF;
  IF v_mismatch > 0 THEN
    v_bad := v_bad || ('quest_type 과 단계 유무가 다른 퀘스트 ' || v_mismatch);
  END IF;

  -- KST 경계: UTC 15:00 = 다음 날 KST 00:00
  IF public.kst_date('2026-11-03 14:59:59+00') <> DATE '2026-11-03'
     OR public.kst_date('2026-11-03 15:00:00+00') <> DATE '2026-11-04' THEN
    v_bad := v_bad || 'kst_date 경계값'::TEXT;
  END IF;

  -- 새 테이블: anon 은 권한 없음, authenticated 는 SELECT 만
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.worlds', 'INSERT, UPDATE, DELETE, TRUNCATE')
       OR has_table_privilege(v_role, 'public.quiz_attempts', 'INSERT, UPDATE, DELETE, TRUNCATE') THEN
      v_bad := v_bad || (v_role || ': worlds/quiz_attempts 쓰기 권한');
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.worlds', 'SELECT')
     OR has_table_privilege('anon', 'public.quiz_attempts', 'SELECT') THEN
    v_bad := v_bad || 'anon: worlds/quiz_attempts SELECT'::TEXT;
  END IF;

  -- 이 파일의 함수는 anon/authenticated 가 실행할 수 없어야 함
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_exec
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('kst_date', 'kst_today', 'has_three_day_streak', 'is_stage_unlocked', 'reset_progress',
                       'user_progress_protect_earned_xp')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_exec IS NOT NULL THEN
    v_bad := v_bad || ('anon/authenticated 실행 가능 함수: ' || v_exec);
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00012] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00012] worlds % (python-island), stages % → 월드 지정 %, quests % (code % · project %), quiz_attempts·KST 함수 준비, anon/authenticated 실행 가능 함수 0',
    v_worlds, v_stages, v_assigned, v_quests, v_code, v_project;
END $$;
