-- 황금키 시스템: 막힌 학생이 정답을 보고 자동 통과할 수 있는 기능
-- 스테이지별 3개 지급, 새 스테이지 진입 시 리셋

-- users 테이블에 황금키 잔여 수 추가
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS golden_keys INTEGER NOT NULL DEFAULT 3;

-- user_progress 테이블에 황금키 사용 여부 추가
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS used_golden_key BOOLEAN NOT NULL DEFAULT FALSE;
