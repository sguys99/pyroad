// content/ → (a) seed SQL, (b) 검증용 JSON (P1-11, §2.4)
//
//   npm run content:build                      # supabase/seed.sql (커밋하는 생성물), build/content/quests.json (git 제외)
//   npm run content:build -- --check           # 쓰지 않고, supabase/seed.sql 이 content/ 와 다르면 종료 코드 1 (CI 드리프트 검사)
//   옵션: --seed-out <file> · --json-out <file> · --content <dir>
//
// --check 는 커밋하는 seed 만 봅니다. 검증 JSON 은 git 에 없어서(CI 의 새 checkout 에는 파일이 없음)
// 비교하지 않습니다. P1-13 test:content 는 같은 함수(toCheckFixture)로 메모리에서 만들어 씁니다.

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
  const { rows, meta, warnings } = buildRows(tree);
  const seed = toSeedSql(rows, { hash: tree.hash });
  const fixture = toCheckFixture(rows, {
    generatedBy: 'npm run content:build',
    source: `content/ (${tree.hash})`,
    meta,
  });
  const json = JSON.stringify(fixture, null, 2) + '\n';

  for (const w of warnings) console.warn(`경고: ${w}`);
  const { counts } = fixture.meta;
  console.log(
    `콘텐츠 ${tree.files.length}개 파일 (해시 ${tree.hash}): 스테이지 ${rows.stages.length}, 퀘스트 ${counts.quests}, ` +
      `solution_code ${counts.with_solution}, 프로젝트 단계 ${counts.project_steps_with_solution}/${counts.project_steps}`,
  );

  if (check) {
    const name = relative(REPO_ROOT, seedOut);
    const current = existsSync(seedOut) ? readFileSync(seedOut, 'utf8') : null;
    if (current === seed) {
      console.log(`같음: ${name}`);
      return;
    }
    console.log(
      `다름: ${name}${current === null ? ' (파일 없음)' : firstDiff(current, seed)}`,
    );
    console.error(
      '생성물이 content/ 와 달라요. content/ 를 고쳤다면 npm run content:build 를 실행해 다시 만들고 함께 커밋하세요 ' +
        '(seed.sql 을 직접 고쳤다면 그 내용을 content/ 로 옮기세요)',
    );
    return 1;
  }

  for (const [file, text] of [
    [seedOut, seed],
    [jsonOut, json],
  ] as const) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    console.log(`썼어요: ${relative(REPO_ROOT, file)}`);
  }
});

/** 처음 다른 줄 번호 (CI 로그에서 어디가 어긋났는지 바로 보이게) */
function firstDiff(current: string, expected: string): string {
  const a = current.split('\n');
  const b = expected.split('\n');
  const line = a.findIndex((text, i) => text !== b[i]);
  const at = line === -1 ? Math.min(a.length, b.length) + 1 : line + 1;
  return ` (${at}번째 줄부터)`;
}
