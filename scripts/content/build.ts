// content/ → (a) seed SQL, (b) 검증용 JSON (P1-11, §2.4)
//
//   npm run content:build                      # build/content/seed.sql, build/content/quests.json (git 제외)
//   npm run content:build -- --check           # 쓰지 않고, 이미 있는 출력과 다르면 종료 코드 1 (CI 드리프트 검사)
//   옵션: --seed-out <file> · --json-out <file> · --content <dir>
//
// 출력 위치: P1-11 에서는 1개 스테이지만 이관했으므로 seed 를 build/ 에 둡니다(supabase/seed.sql 은 아직 손으로 쓴 원본).
// P1-12 에서 전체 이관이 끝나면 `--seed-out supabase/seed.sql` 을 기본값으로 바꾸고 생성물을 커밋합니다(paths.ts).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { buildRows, toCheckFixture, toSeedSql } from '@/lib/content/build';
import { loadContent } from '@/lib/content/load';

import { parseArgs, run } from './lib/args';
import {
  CONTENT_DIR,
  DEFAULT_JSON_OUT,
  DEFAULT_SEED_OUT,
  REPO_ROOT,
} from './lib/paths';

run(async () => {
  const args = parseArgs();
  const contentDir = resolve(REPO_ROOT, args.get('content') ?? CONTENT_DIR);
  const seedOut = resolve(REPO_ROOT, args.get('seed-out') ?? DEFAULT_SEED_OUT);
  const jsonOut = resolve(REPO_ROOT, args.get('json-out') ?? DEFAULT_JSON_OUT);
  const check = args.has('check');

  const tree = loadContent(contentDir);
  const { rows, warnings } = buildRows(tree);
  const seed = toSeedSql(rows, { hash: tree.hash });
  const fixture = toCheckFixture(rows, {
    generatedBy: 'npm run content:build',
    source: `content/ (${tree.hash})`,
  });
  const json = JSON.stringify(fixture, null, 2) + '\n';

  for (const w of warnings) console.warn(`경고: ${w}`);
  const { counts } = fixture.meta;
  console.log(
    `콘텐츠 ${tree.files.length}개 파일 (해시 ${tree.hash}): 스테이지 ${rows.stages.length}, 퀘스트 ${counts.quests}, ` +
      `solution_code ${counts.with_solution}, 프로젝트 단계 ${counts.project_steps_with_solution}/${counts.project_steps}`,
  );

  let stale = 0;
  for (const [file, text] of [
    [seedOut, seed],
    [jsonOut, json],
  ] as const) {
    const name = relative(REPO_ROOT, file);
    if (check) {
      const same = existsSync(file) && readFileSync(file, 'utf8') === text;
      if (!same) stale++;
      console.log(`${same ? '같음' : '다름'}: ${name}`);
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
      console.log(`썼어요: ${name}`);
    }
  }
  if (stale > 0) {
    console.error(
      '생성물이 content/ 와 달라요. npm run content:build 를 실행해 다시 만드세요',
    );
    return 1;
  }
});
