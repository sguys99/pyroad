-- 프로젝트 퀘스트(멀티스텝) 지원을 위한 컬럼 추가
-- 일반 퀘스트(스테이지 1~6)에서는 NULL 유지

ALTER TABLE public.user_progress
  ADD COLUMN current_step INTEGER DEFAULT NULL,
  ADD COLUMN step_submissions JSONB DEFAULT NULL;
