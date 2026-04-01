-- Multi-LLM provider 지원을 위한 사용자 설정 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_provider text DEFAULT 'anthropic';
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_api_keys jsonb DEFAULT '{}';
