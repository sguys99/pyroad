// seed.sql → content/ YAML 추출 (P1-11 시범, P1-12 전체 이관에 씀. 이관이 끝난 지금은 기록·점검용)
//
// 저장소의 migrations + seed 를 PGlite(메모리 Postgres)에서 실행한 상태(정답은 quest_answer_keys)를 읽어
// 퀘스트마다 YAML 파일을 씁니다. 정규식으로 SQL 을 해석하지 않습니다.
// P1-12 부터 supabase/seed.sql 은 content/ 생성물이므로, 손으로 쓴 예전 seed 에서 다시 추출하려면 --seed-rev.
//
//   npm run content:extract -- --stage 1          # 스테이지 1만 (여러 개: --stage 1,2,3)
//   npm run content:extract -- --all --seed-rev   # 예전 seed(LEGACY_SEED_REV)의 모든 스테이지 (P1-12)
//   옵션: --force (이미 있는 파일이 달라도 덮어씀) · --out <dir> (기본 content/)
//         --seed <file> (기본 supabase/seed.sql) · --seed-rev [<rev>] · --migrations-up-to 00005
//
// 추출한 뒤에는 `npm run content:compare` 로 왕복(추출 → 빌드 → 적용 → 비교)이 같은지 확인합니다.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { questFromRows, stageFromRow } from '@/lib/content/fromRows';
import type { World } from '@/lib/content/schema';
import { questToYaml, stageToYaml, worldToYaml } from '@/lib/content/yaml';

import { parseArgs, run } from './lib/args';
import { CONTENT_DIR, REPO_ROOT } from './lib/paths';
import { replay } from './lib/pglite';
import { readSeedSource } from './lib/seedSource';
import slugs from './quest-slugs.json';

/** 1월드 (§2.1·§5 "파이썬 섬"). P1-08 의 worlds 행과 slug 로 맞춥니다 */
const PYTHON_ISLAND: World = {
  slug: 'python-island',
  order: 1,
  title: '파이썬 섬',
  theme: 'python_island',
  description: 'print()부터 함수까지, 파이썬 기초를 배우는 첫 번째 섬이에요!',
};

const pad = (n: number) => String(n).padStart(2, '0');
const slugMap = slugs as Record<string, string>;

run(async () => {
  const args = parseArgs();
  const outDir = resolve(REPO_ROOT, args.get('out') ?? CONTENT_DIR);
  const seed = readSeedSource(args);
  const force = args.has('force');
  const all = args.has('all');
  const wanted = new Set(args.list('stage').map(Number));
  if (!all && wanted.size === 0) {
    throw new Error(
      '추출할 스테이지를 고르세요: --stage 1 (또는 --stage 1,2 / --all)',
    );
  }

  const { snapshot, migrations } = await replay({
    migrationsUpTo: args.get('migrations-up-to'),
    seeds: [seed],
  });
  console.log(`원본: ${migrations.length}개 마이그레이션 + ${seed.name}`);

  const answers = new Map(snapshot.answer_keys.map((k) => [k.quest_id, k]));
  const stages = snapshot.stages.filter(
    (s) => all || wanted.has(Number(s.order)),
  );
  if (stages.length === 0) throw new Error('고른 스테이지가 seed 에 없어요');

  const worldDir = join(outDir, 'worlds', PYTHON_ISLAND.slug);
  const written: string[] = [];
  const unchanged: string[] = [];
  const write = (file: string, text: string) => {
    if (existsSync(file)) {
      if (readFileSync(file, 'utf8') === text) return void unchanged.push(file);
      if (!force) {
        throw new Error(
          `${relative(REPO_ROOT, file)} 이 이미 있고 내용이 달라요. 덮어쓰려면 --force`,
        );
      }
    }
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
    written.push(file);
  };

  write(join(worldDir, 'world.yaml'), worldToYaml(PYTHON_ISLAND));

  for (const row of stages) {
    const stage = stageFromRow(row);
    const stageDir = join(
      worldDir,
      `${pad(stage.order)}-${stage.theme_name.replace(/_/g, '-')}`,
    );
    write(join(stageDir, 'stage.yaml'), stageToYaml(stage));

    const quests = snapshot.quests.filter((q) => q.stage_id === stage.id);
    for (const row of quests) {
      const quest = questFromRows(row, answers.get(String(row.id)));
      const slug = slugMap[quest.id] ?? `quest-${quest.id.slice(-4)}`;
      const heading = `퀘스트 ${stage.order}-${quest.order}: ${quest.title}`;
      write(
        join(stageDir, `${pad(quest.order)}-${slug}.yaml`),
        questToYaml(quest, heading),
      );
    }
    console.log(
      `스테이지 ${stage.order} ${stage.title}: 퀘스트 ${quests.length}개`,
    );
  }

  console.log(
    `쓴 파일 ${written.length}개, 그대로 ${unchanged.length}개 (${relative(REPO_ROOT, worldDir)})`,
  );
  console.log('다음: npm run content:compare');
});
