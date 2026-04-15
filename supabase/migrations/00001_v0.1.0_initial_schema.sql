-- ============================================================
-- pyRoad 통합 스키마 (Idempotent)
-- 8개 테이블 + 1개 뷰 + 9개 인덱스 + RLS 정책 + 트리거
-- + 황금키 시스템 + solution_code 데이터
--
-- Supabase SQL Editor에서 재실행 가능:
--   기존 오브젝트가 있으면 무시, 없으면 생성
-- ============================================================

-- ============================================================
-- Section 1: 테이블 (8개)
-- ============================================================

-- 1. users: 사용자 프로필 (Supabase Auth와 연동)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  preferred_provider TEXT DEFAULT 'anthropic',
  custom_api_keys JSONB DEFAULT '{}',
  golden_keys INTEGER NOT NULL DEFAULT 3
);

-- 2. stages: 커리큘럼 스테이지 정의
CREATE TABLE IF NOT EXISTS public.stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order" INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  theme_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. quests: 퀘스트 정의 (커리큘럼 뼈대)
CREATE TABLE IF NOT EXISTS public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  title TEXT NOT NULL,
  concept TEXT NOT NULL,
  prompt_skeleton JSONB NOT NULL DEFAULT '{}',
  validation_type TEXT NOT NULL CHECK (validation_type IN ('output_match', 'contains', 'code_check')),
  expected_output TEXT NOT NULL DEFAULT '',
  xp_reward INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stage_id, "order")
);

-- 4. user_progress: 학생별 퀘스트 진행 상태
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  hints_used INTEGER NOT NULL DEFAULT 0,
  code_submitted TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_step INTEGER DEFAULT NULL,
  step_submissions JSONB DEFAULT NULL,
  used_golden_key BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, quest_id)
);

-- 5. user_badges: 획득한 뱃지
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('first_code', 'hint_master', 'stage_clear', 'project_builder', 'streak_3')),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_type)
);

-- 6. board_posts: 게시글
CREATE TABLE IF NOT EXISTS public.board_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. board_comments: 댓글
CREATE TABLE IF NOT EXISTS public.board_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. notices: 공지사항
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Section 1-B: 기존 테이블에 누락 컬럼 추가 (이미 테이블이 존재하는 경우)
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS golden_keys INTEGER NOT NULL DEFAULT 3;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS used_golden_key BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- Section 2: 뷰
-- ============================================================

-- user_profiles_public: 안전한 사용자 정보 뷰 (custom_api_keys 노출 방지)
CREATE OR REPLACE VIEW public.user_profiles_public AS
  SELECT id, display_name, avatar_url
  FROM public.users;

-- ============================================================
-- Section 3: 인덱스 (9개)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_quest_id ON public.user_progress(quest_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_quests_stage_id ON public.quests(stage_id);
CREATE INDEX IF NOT EXISTS idx_board_posts_user_id ON public.board_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_board_posts_created_at ON public.board_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_comments_post_id ON public.board_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_user_id ON public.board_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);

-- ============================================================
-- Section 4: RLS 정책 (중복 실행 시 무시)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- users: 본인 데이터만 읽기/수정
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_select_own' AND tablename = 'users') THEN
    CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_update_own' AND tablename = 'users') THEN
    CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_insert_own' AND tablename = 'users') THEN
    CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;

  -- stages: 모든 인증 사용자 읽기 가능
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'stages_select_authenticated' AND tablename = 'stages') THEN
    CREATE POLICY "stages_select_authenticated" ON public.stages FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  -- quests: 모든 인증 사용자 읽기 가능
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quests_select_authenticated' AND tablename = 'quests') THEN
    CREATE POLICY "quests_select_authenticated" ON public.quests FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  -- user_progress: 본인 데이터만 읽기/쓰기
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'progress_select_own' AND tablename = 'user_progress') THEN
    CREATE POLICY "progress_select_own" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'progress_insert_own' AND tablename = 'user_progress') THEN
    CREATE POLICY "progress_insert_own" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'progress_update_own' AND tablename = 'user_progress') THEN
    CREATE POLICY "progress_update_own" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'progress_delete_own' AND tablename = 'user_progress') THEN
    CREATE POLICY "progress_delete_own" ON public.user_progress FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- user_badges: 본인 데이터만 읽기/쓰기
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'badges_select_own' AND tablename = 'user_badges') THEN
    CREATE POLICY "badges_select_own" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'badges_insert_own' AND tablename = 'user_badges') THEN
    CREATE POLICY "badges_insert_own" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'badges_delete_own' AND tablename = 'user_badges') THEN
    CREATE POLICY "badges_delete_own" ON public.user_badges FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- board_posts: 인증 사용자 읽기, 본인만 수정/삭제
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'board_posts_select_authenticated' AND tablename = 'board_posts') THEN
    CREATE POLICY "board_posts_select_authenticated" ON public.board_posts FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'board_posts_insert_own' AND tablename = 'board_posts') THEN
    CREATE POLICY "board_posts_insert_own" ON public.board_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'board_posts_update_own' AND tablename = 'board_posts') THEN
    CREATE POLICY "board_posts_update_own" ON public.board_posts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'board_posts_delete_own' AND tablename = 'board_posts') THEN
    CREATE POLICY "board_posts_delete_own" ON public.board_posts FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- board_comments: 인증 사용자 읽기, 본인만 작성/삭제
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'board_comments_select_authenticated' AND tablename = 'board_comments') THEN
    CREATE POLICY "board_comments_select_authenticated" ON public.board_comments FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'board_comments_insert_own' AND tablename = 'board_comments') THEN
    CREATE POLICY "board_comments_insert_own" ON public.board_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'board_comments_delete_own' AND tablename = 'board_comments') THEN
    CREATE POLICY "board_comments_delete_own" ON public.board_comments FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- notices: 누구나 읽기 가능, 본인만 쓰기 (관리자 검증은 API 레벨에서 수행)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notices_select_public' AND tablename = 'notices') THEN
    CREATE POLICY "notices_select_public" ON public.notices FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notices_insert_authenticated' AND tablename = 'notices') THEN
    CREATE POLICY "notices_insert_authenticated" ON public.notices FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notices_update_own' AND tablename = 'notices') THEN
    CREATE POLICY "notices_update_own" ON public.notices FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notices_delete_own' AND tablename = 'notices') THEN
    CREATE POLICY "notices_delete_own" ON public.notices FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- Section 5: 트리거 (auth.users → public.users 자동 동기화)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Section 6: 퀘스트 solution_code 데이터
-- 황금키 시스템용: 각 퀘스트의 prompt_skeleton에 solution_code 추가
-- 프로젝트 퀘스트(스테이지 7)는 steps[].solution_code로 단계별 정답 관리
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 스테이지 1: 파이썬 마을 입구
-- ────────────────────────────────────────────────────────────

-- 01: 첫 번째 인사
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"안녕하세요!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000001';

-- 02: 내 소개를 해볼까?
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"나는 파이썬 모험가!\")\nprint(\"반가워!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000002';

-- 23: 따옴표의 비밀
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"I''m happy!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000023';

-- 03: 주석으로 메모하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"# 파이썬 메모\nprint(\"파이썬은 재미있어!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000003';

-- 24: 특수문자 출력하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"첫째 줄\\n둘째 줄\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000024';

-- 25: 숫자도 출력해요
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(2026)"')
WHERE id = 'b1000000-0000-0000-0000-000000000025';

-- 26: 마을 안내판 만들기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"# 마을 안내판\nprint(\"=== 파이썬 마을 ===\")\nprint(\"인구: 2026명\")\nprint(\"환영합니다!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000026';

-- ────────────────────────────────────────────────────────────
-- 스테이지 2: 변수의 숲
-- ────────────────────────────────────────────────────────────

-- 04: 마법 상자에 이름 넣기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"name = \"파이뱀\"\nprint(name)"')
WHERE id = 'b1000000-0000-0000-0000-000000000004';

-- 05: 숫자 상자와 글자 상자
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"number = 10\ngreeting = \"안녕\"\nprint(number)\nprint(greeting)"')
WHERE id = 'b1000000-0000-0000-0000-000000000005';

-- 27: 상자 이름 바꾸기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"color = \"빨강\"\ncolor = \"파랑\"\nprint(color)"')
WHERE id = 'b1000000-0000-0000-0000-000000000027';

-- 06: 나이 계산기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"birth_year = 2014\nage = 2026 - birth_year\nprint(str(age) + \"살\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000006';

-- 28: 글자 합치기 마법
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"first = \"파이\"\nsecond = \"썬\"\nresult = first + second\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000028';

-- 07: 변신 마법! 형변환
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"a = \"100\"\nb = \"23\"\nresult = int(a) + int(b)\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000007';

-- 29: 자기소개 카드 만들기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"name = \"파이뱀\"\nage = \"10\"\nschool = \"코딩초등학교\"\nprint(\"이름: \" + name)\nprint(\"나이: \" + age + \"살\")\nprint(\"학교: \" + school)"')
WHERE id = 'b1000000-0000-0000-0000-000000000029';

-- ────────────────────────────────────────────────────────────
-- 스테이지 3: 조건의 갈림길
-- ────────────────────────────────────────────────────────────

-- 08: 비밀번호를 맞춰라!
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"password = \"열려라\"\n\nif password == \"열려라\":\n    print(\"통과!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000008';

-- 30: 짝수인지 홀수인지?
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"number = 7\n\nif number % 2 == 0:\n    print(\"짝수\")\nelse:\n    print(\"홀수\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000030';

-- 09: 성적표 만들기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"score = 85\n\nif score >= 90:\n    print(\"등급: A\")\nelif score >= 80:\n    print(\"등급: B\")\nelse:\n    print(\"등급: C\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000009';

-- 10: 놀이공원 입장
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"height = 130\n\nif height >= 120:\n    print(\"입장 가능!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000010';

-- 11: 마법사의 조건
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"magic = 80\ncourage = 70\n\nif magic >= 60 and courage >= 60:\n    print(\"마법사 합격!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000011';

-- 31: 가위바위보 심판
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"player = \"가위\"\ncomputer = \"보\"\n\nif player == computer:\n    print(\"비겼다!\")\nelif player == \"가위\":\n    if computer == \"보\":\n        print(\"이겼다!\")\n    else:\n        print(\"졌다!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000031';

-- 32: 영화관 할인 시스템
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"age = 10\nis_weekend = False\nprice = 10000\n\nif age < 13:\n    if is_weekend == False:\n        discount = 50\n    else:\n        discount = 30\nelse:\n    discount = 0\n\nfinal_price = price * (100 - discount) // 100\n\nprint(\"나이: \" + str(age) + \"살\")\nprint(\"할인율: \" + str(discount) + \"%\")\nprint(\"가격: \" + str(final_price) + \"원\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000032';
UPDATE public.quests SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton, '{starter_code}', '"# 영화관 할인 시스템을 만들어보세요!\nage = 10\nis_weekend = False\nprice = 10000\n\n# 어린이(13세 미만)이면 할인!\n# if 문으로 나이와 요일에 따라 discount를 정해보세요!\n\n\n# 최종 가격을 계산하세요!\n# final_price = price * (100 - discount) // 100\n\n# 나이, 할인율, 가격을 출력하세요!\n"'),
  '{hints,level_3}', '"if age < 13: 안에 if is_weekend == False: 를 넣고, discount = 50 으로 설정해보세요! else일 때는 30이에요."')
WHERE id = 'b1000000-0000-0000-0000-000000000032';

-- ────────────────────────────────────────────────────────────
-- 스테이지 4: 반복의 동굴
-- ────────────────────────────────────────────────────────────

-- 12: 숫자 세기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"for i in range(1, 6):\n    print(i)"')
WHERE id = 'b1000000-0000-0000-0000-000000000012';

-- 13: 구구단 외우기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"for i in range(1, 10):\n    print(2, \"x\", i, \"=\", 2*i)"')
WHERE id = 'b1000000-0000-0000-0000-000000000013';

-- 33: 별 찍기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"*\" * 5)"')
WHERE id = 'b1000000-0000-0000-0000-000000000033';

-- 34: 합계 구하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"total = 0\n\nfor i in range(1, 11):\n    total = total + i\n\nprint(total)"')
WHERE id = 'b1000000-0000-0000-0000-000000000034';

-- 14: 보물 찾기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"position = 1\n\nwhile position <= 10:\n    if position == 5:\n        print(\"보물 발견!\")\n        break\n    position = position + 1"')
WHERE id = 'b1000000-0000-0000-0000-000000000014';

-- 15: 짝수만 골라내기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"for i in range(1, 11):\n    if i % 2 != 0:\n        continue\n    print(i)"')
WHERE id = 'b1000000-0000-0000-0000-000000000015';

-- 35: 카운트다운
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"count = 5\n\nwhile count >= 1:\n    print(count)\n    count = count - 1"')
WHERE id = 'b1000000-0000-0000-0000-000000000035';

-- 36: 별 피라미드 만들기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"for i in range(1, 6):\n    print(\"*\" * i)"')
WHERE id = 'b1000000-0000-0000-0000-000000000036';
UPDATE public.quests SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton, '{starter_code}', '"# 별 피라미드를 만들어보세요!\n# 1줄: *\n# 2줄: **\n# ...\n# 5줄: *****\n\nfor i in range(1, 6):\n    print()"'),
  '{hints,level_3}', '"print() 안에 \"*\" * i 를 넣어보세요! i가 1이면 *, 2이면 ** 가 나와요!"')
WHERE id = 'b1000000-0000-0000-0000-000000000036';

-- ────────────────────────────────────────────────────────────
-- 스테이지 5: 리스트 호수
-- ────────────────────────────────────────────────────────────

-- 16: 과일 바구니
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"fruits = [\"사과\", \"바나나\", \"포도\"]\nprint(fruits)"')
WHERE id = 'b1000000-0000-0000-0000-000000000016';

-- 17: 보물 목록 정리
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"treasures = [\"금화\", \"은화\", \"다이아몬드\", \"루비\"]\nprint(treasures[2])"')
WHERE id = 'b1000000-0000-0000-0000-000000000017';

-- 37: 리스트 순회하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"colors = [\"빨강\", \"초록\", \"파랑\"]\n\nfor color in colors:\n    print(color)"')
WHERE id = 'b1000000-0000-0000-0000-000000000037';

-- 18: 친구 목록 관리
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"friends = [\"토끼\", \"거북이\", \"다람쥐\"]\nfriends.append(\"파이뱀\")\nprint(len(friends))"')
WHERE id = 'b1000000-0000-0000-0000-000000000018';

-- 38: 리스트 정렬하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"numbers = [3, 1, 4, 1, 5]\nnumbers.sort()\nprint(numbers)"')
WHERE id = 'b1000000-0000-0000-0000-000000000038';

-- 39: 리스트 속 검색
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"fruits = [\"사과\", \"바나나\", \"포도\"]\nresult = \"바나나\" in fruits\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000039';

-- 40: 쇼핑 리스트 정리기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"shopping = []\nshopping.append(\"우유\")\nshopping.append(\"주스\")\nshopping.append(\"과자\")\nshopping.sort()\nprint(\"--- 쇼핑 목록 ---\")\nfor item in shopping:\n    print(item)\nprint(\"총 \" + str(len(shopping)) + \"개\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000040';
UPDATE public.quests SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton, '{starter_code}', '"# 쇼핑 리스트를 만들어보세요!\nshopping = []\n\n# 3개 항목을 추가하세요! (append 사용)\n\n\n# 정렬하세요! (sort 사용)\n\n\n# 출력하세요!\nprint(\"--- 쇼핑 목록 ---\")\nfor item in shopping:\n    print(item)\nprint(\"총 \" + str(len(shopping)) + \"개\")"'),
  '{hints,level_3}', '"shopping.append(\"우유\") 처럼 3개를 추가하고, shopping.sort() 로 정렬하세요!"')
WHERE id = 'b1000000-0000-0000-0000-000000000040';

-- ────────────────────────────────────────────────────────────
-- 스테이지 6: 함수의 탑
-- ────────────────────────────────────────────────────────────

-- 19: 인사하는 함수
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def greet():\n    print(\"안녕! 나는 파이뱀이야!\")\n\ngreet()"')
WHERE id = 'b1000000-0000-0000-0000-000000000019';

-- 20: 계산기 함수
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def add(a, b):\n    return a + b\n\nresult = add(7, 8)\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000020';

-- 41: 기본값이 있는 함수
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def greet(name=\"친구\"):\n    print(\"안녕, \" + name + \"!\")\n\ngreet()\ngreet(\"파이뱀\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000041';

-- 21: 최댓값 찾기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"numbers = [3, 7, 1, 9, 4]\nbiggest = max(numbers)\nprint(biggest)"')
WHERE id = 'b1000000-0000-0000-0000-000000000021';

-- 42: 여러 값 돌려주기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def min_max(a, b, c):\n    smallest = min(a, b, c)\n    biggest = max(a, b, c)\n    return smallest, biggest\n\nsmall, big = min_max(1, 9, 5)\nprint(small)\nprint(big)"')
WHERE id = 'b1000000-0000-0000-0000-000000000042';

-- 43: 함수 안의 함수 호출
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def double(x):\n    return x * 2\n\ndef add_one(x):\n    return x + 1\n\nresult = add_one(double(3))\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000043';

-- 44: 성적 분석 프로그램
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def average(a, b, c):\n    return (a + b + c) / 3\n\ndef grade(avg):\n    if avg >= 90:\n        return \"A\"\n    elif avg >= 80:\n        return \"B\"\n    elif avg >= 70:\n        return \"C\"\n    else:\n        return \"D\"\n\navg = average(80, 90, 85)\ng = grade(avg)\n\nprint(\"평균: \" + str(avg))\nprint(\"등급: \" + g)"')
WHERE id = 'b1000000-0000-0000-0000-000000000044';
UPDATE public.quests SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton, '{starter_code}', '"# 성적 분석 프로그램을 만들어보세요!\ndef average(a, b, c):\n    # 세 과목의 평균을 구해서 return 하세요!\n    \n\ndef grade(avg):\n    # 90 이상 \"A\", 80 이상 \"B\", 70 이상 \"C\", 나머지 \"D\"\n    \n\n# 3과목 점수\navg = average(80, 90, 85)\ng = grade(avg)\n\nprint(\"평균: \" + str(avg))\nprint(\"등급: \" + g)"'),
  '{hints,level_3}', '"average는 return (a + b + c) / 3, grade는 if/elif/else로 등급을 return 하세요!"')
WHERE id = 'b1000000-0000-0000-0000-000000000044';

-- ────────────────────────────────────────────────────────────
-- 스테이지 7: 프로젝트 왕국 (steps[].solution_code)
-- ────────────────────────────────────────────────────────────

-- 22: 숫자 맞추기 게임 (5단계 프로젝트)
UPDATE public.quests SET prompt_skeleton = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          prompt_skeleton,
          '{steps,0,solution_code}',
          '"import random\n\nsecret = random.randint(1, 10)\nprint(secret)"'
        ),
        '{steps,1,solution_code}',
        '"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\nprint(\"비밀 숫자: \" + str(secret))\nprint(\"추측: \" + str(guess))"'
      ),
      '{steps,2,solution_code}',
      '"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\n\nif guess == secret:\n    print(\"정답!\")\nelif guess < secret:\n    print(\"비밀 숫자가 추측보다 커요!\")\nelse:\n    print(\"비밀 숫자가 추측보다 작아요!\")"'
    ),
    '{steps,3,solution_code}',
    '"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\n\nwhile guess != secret:\n    if guess < secret:\n        print(\"비밀 숫자가 추측보다 커요!\")\n    else:\n        print(\"비밀 숫자가 추측보다 작아요!\")\n    guess = int(random.randint(1, 10))\n\nprint(\"정답!\")"'
  ),
  '{steps,4,solution_code}',
  '"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\nattempts = 0\n\nwhile guess != secret:\n    attempts = attempts + 1\n    if guess < secret:\n        print(\"비밀 숫자가 추측보다 커요!\")\n    else:\n        print(\"비밀 숫자가 추측보다 작아요!\")\n    guess = int(random.randint(1, 10))\n\nattempts = attempts + 1\nprint(\"정답! \" + str(attempts) + \"번 만에 맞췄어요!\")"'
)
WHERE id = 'b1000000-0000-0000-0000-000000000022';

-- ============================================================
-- Section 7: user_progress status 강등 방지 트리거
-- ============================================================
-- auto-save가 completed 퀘스트를 in_progress로 덮어쓰는 버그 방지
-- 에러를 발생시키지 않고, status와 completed_at을 조용히 보존

CREATE OR REPLACE FUNCTION prevent_status_downgrade()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    NEW.status := 'completed';
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_status_downgrade ON public.user_progress;
CREATE TRIGGER trg_prevent_status_downgrade
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW
  EXECUTE FUNCTION prevent_status_downgrade();
