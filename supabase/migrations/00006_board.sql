-- 게시판 테이블 + RLS 정책

-- 1. board_posts: 게시글
CREATE TABLE public.board_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. board_comments: 댓글
CREATE TABLE public.board_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. user_profiles_public: 안전한 사용자 정보 뷰 (custom_api_keys 노출 방지)
CREATE VIEW public.user_profiles_public AS
  SELECT id, display_name, avatar_url
  FROM public.users;

-- 인덱스
CREATE INDEX idx_board_posts_user_id ON public.board_posts(user_id);
CREATE INDEX idx_board_posts_created_at ON public.board_posts(created_at DESC);
CREATE INDEX idx_board_comments_post_id ON public.board_comments(post_id);
CREATE INDEX idx_board_comments_user_id ON public.board_comments(user_id);

-- RLS: board_posts
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_posts_select_authenticated" ON public.board_posts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "board_posts_insert_own" ON public.board_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "board_posts_update_own" ON public.board_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "board_posts_delete_own" ON public.board_posts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS: board_comments
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_comments_select_authenticated" ON public.board_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "board_comments_insert_own" ON public.board_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "board_comments_delete_own" ON public.board_comments
  FOR DELETE USING (auth.uid() = user_id);
