-- ============================================================
-- pyRoad v0.1.0 통합 스키마
-- 7개 테이블 + 1개 뷰 + 8개 인덱스 + RLS 정책 + 트리거
-- ============================================================

-- ============================================================
-- Section 1: 테이블 (7개)
-- ============================================================

-- 1. users: 사용자 프로필 (Supabase Auth와 연동)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  preferred_provider TEXT DEFAULT 'anthropic',
  custom_api_keys JSONB DEFAULT '{}'
);

-- 2. stages: 커리큘럼 스테이지 정의
CREATE TABLE public.stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order" INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  theme_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. quests: 퀘스트 정의 (커리큘럼 뼈대)
CREATE TABLE public.quests (
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
CREATE TABLE public.user_progress (
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
  UNIQUE (user_id, quest_id)
);

-- 5. user_badges: 획득한 뱃지
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('first_code', 'hint_master', 'stage_clear', 'project_builder', 'streak_3')),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_type)
);

-- 6. board_posts: 게시글
CREATE TABLE public.board_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. board_comments: 댓글
CREATE TABLE public.board_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Section 2: 뷰
-- ============================================================

-- user_profiles_public: 안전한 사용자 정보 뷰 (custom_api_keys 노출 방지)
CREATE VIEW public.user_profiles_public AS
  SELECT id, display_name, avatar_url
  FROM public.users;

-- ============================================================
-- Section 3: 인덱스 (8개)
-- ============================================================

CREATE INDEX idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX idx_user_progress_quest_id ON public.user_progress(quest_id);
CREATE INDEX idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX idx_quests_stage_id ON public.quests(stage_id);
CREATE INDEX idx_board_posts_user_id ON public.board_posts(user_id);
CREATE INDEX idx_board_posts_created_at ON public.board_posts(created_at DESC);
CREATE INDEX idx_board_comments_post_id ON public.board_comments(post_id);
CREATE INDEX idx_board_comments_user_id ON public.board_comments(user_id);

-- ============================================================
-- Section 4: RLS 정책
-- ============================================================

-- users: 본인 데이터만 읽기/수정
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- stages: 모든 인증 사용자 읽기 가능
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stages_select_authenticated" ON public.stages
  FOR SELECT USING (auth.role() = 'authenticated');

-- quests: 모든 인증 사용자 읽기 가능
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quests_select_authenticated" ON public.quests
  FOR SELECT USING (auth.role() = 'authenticated');

-- user_progress: 본인 데이터만 읽기/쓰기
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_select_own" ON public.user_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "progress_insert_own" ON public.user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progress_update_own" ON public.user_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- user_badges: 본인 데이터만 읽기/쓰기
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges_select_own" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "badges_insert_own" ON public.user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- board_posts: 인증 사용자 읽기, 본인만 수정/삭제
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_posts_select_authenticated" ON public.board_posts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "board_posts_insert_own" ON public.board_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "board_posts_update_own" ON public.board_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "board_posts_delete_own" ON public.board_posts
  FOR DELETE USING (auth.uid() = user_id);

-- board_comments: 인증 사용자 읽기, 본인만 작성/삭제
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_comments_select_authenticated" ON public.board_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "board_comments_insert_own" ON public.board_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "board_comments_delete_own" ON public.board_comments
  FOR DELETE USING (auth.uid() = user_id);

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
