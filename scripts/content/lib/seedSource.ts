// 비교·추출의 "원본" seed 를 읽는다: 파일(--seed, 기본 supabase/seed.sql) 또는 git 커밋(--seed-rev)
//
// P1-12 에서 supabase/seed.sql 이 content/ 생성물로 바뀌었으므로, 손으로 쓴 예전 seed 와 비교하려면
// `--seed-rev`(값 없이 쓰면 LEGACY_SEED_REV)로 git 에서 읽습니다.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import type { parseArgs } from './args';
import { LEGACY_SEED_REV, REPO_ROOT, SEED_SQL } from './paths';

export interface SeedSource {
  name: string;
  sql: string;
}

export function readSeedSource(args: ReturnType<typeof parseArgs>): SeedSource {
  if (args.has('seed-rev')) {
    if (args.has('seed'))
      throw new Error('--seed 와 --seed-rev 는 함께 쓸 수 없어요');
    const rev = args.get('seed-rev') ?? LEGACY_SEED_REV;
    const spec = `${rev}:supabase/seed.sql`;
    try {
      const sql = execFileSync('git', ['show', spec], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { name: spec, sql };
    } catch {
      throw new Error(
        `git 에서 ${spec} 를 읽지 못했어요 (얕은 clone 이면 git fetch --unshallow)`,
      );
    }
  }
  const file = resolve(REPO_ROOT, args.get('seed') ?? SEED_SQL);
  return { name: relative(REPO_ROOT, file), sql: readFileSync(file, 'utf8') };
}
