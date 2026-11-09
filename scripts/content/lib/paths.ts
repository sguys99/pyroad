import { resolve } from 'node:path';

// tsx(CJS 변환)와 vitest 모두에서 쓸 수 있도록 import.meta 대신 __dirname 을 쓴다
export const REPO_ROOT = resolve(__dirname, '../../..');

/** 콘텐츠 원본 (content/worlds/<world>/<stage>/<quest>.yaml) */
export const CONTENT_DIR = resolve(REPO_ROOT, 'content');

/**
 * DB seed. P1-12부터 `npm run content:build`가 만드는 **생성물**이고 커밋합니다
 * (`supabase db reset`·RLS 회귀 테스트·운영 SQL Editor 가 그대로 읽음, CI 는 `--check`로 드리프트 검사).
 */
export const SEED_SQL = resolve(REPO_ROOT, 'supabase/seed.sql');

/**
 * 손으로 쓴 마지막 seed.sql 이 있는 커밋 (P1-12 이관 직전, P1-11).
 * `content:compare -- --seed-rev`·`content:extract -- --seed-rev`가 이 커밋의 seed 를 원본으로 읽습니다.
 */
export const LEGACY_SEED_REV = '9b88cea';

/** 빌드 기본 출력. seed 는 커밋하는 생성물, 검증 JSON 은 git 제외 `build/` (정답을 담은 파생물) */
export const DEFAULT_SEED_OUT = SEED_SQL;
export const DEFAULT_JSON_OUT = resolve(REPO_ROOT, 'build/content/quests.json');

/** 월드 목록·지도 모듈 (P5-03). seed 처럼 커밋하는 생성물이고 `--check`가 드리프트 검사 */
export const WORLDS_MODULE = resolve(
  REPO_ROOT,
  'src/lib/world/worlds.generated.ts',
);
