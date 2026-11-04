import { resolve } from 'node:path';

// tsx(CJS 변환)와 vitest 모두에서 쓸 수 있도록 import.meta 대신 __dirname 을 쓴다
export const REPO_ROOT = resolve(__dirname, '../../..');

/** 콘텐츠 원본 (content/worlds/<world>/<stage>/<quest>.yaml) */
export const CONTENT_DIR = resolve(REPO_ROOT, 'content');

/** 손으로 쓴 seed (P1-12 전환 전까지의 원본) */
export const LEGACY_SEED = resolve(REPO_ROOT, 'supabase/seed.sql');

/**
 * 빌드 기본 출력 위치 (git 제외 `build/`).
 * P1-12에서 44 퀘스트 이관이 끝나면 seed 출력을 `supabase/seed.sql`로 바꾸고 커밋한다
 * (`npm run content:build -- --seed-out supabase/seed.sql`). 검증 JSON은 계속 git 제외.
 */
export const DEFAULT_SEED_OUT = resolve(REPO_ROOT, 'build/content/seed.sql');
export const DEFAULT_JSON_OUT = resolve(REPO_ROOT, 'build/content/quests.json');
