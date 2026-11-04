// 왕복 비교: 원본 seed 상태 ↔ content/ 빌드 결과 (P1-11 시범, P1-12 전체 이관 검증)
//
// PGlite(메모리 Postgres) 4개를 띄워 비교합니다. 로컬 Supabase 스택·docker 를 쓰지 않습니다.
//   A. 원본    : migrations → 원본 seed (기본 supabase/seed.sql = 커밋한 생성물)
//   B. 생성    : migrations → content 빌드 seed
//   C. 재실행  : migrations → content 빌드 seed → 한 번 더 (멱등)
//   D. 덮어쓰기: migrations → 원본 seed → content 빌드 seed (이미 데이터가 있는 DB 에 업서트 = 운영 적용)
// 비교: content 에 있는 스테이지·퀘스트의 stages·quests·quest_answer_keys 행 (A=B, B=C), D 전체 = A 전체,
//       검증용 JSON (A 에서 만든 것 = 빌드 결과)
//
//   npm run content:compare                          # 커밋한 supabase/seed.sql 기준 (DB 상태로 비교)
//   npm run content:compare -- --seed-rev --expect-diff 1-5,4-7,7-1
//                                                    # 손으로 쓴 예전 seed(LEGACY_SEED_REV) 기준. P1-12 에서 일부러
//                                                    # 고친 퀘스트(B09·B30·B31, 1-5 concept)만 다른지 확인
//   옵션: --expect-diff <키,…>  차이를 보여 주되 실패로 보지 않음
//         --seed <file> · --seed-rev [<rev>] · --content <dir> · --migrations-up-to 00005

import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { buildRows, toCheckFixture, toSeedSql } from '@/lib/content/build';
import { loadContent } from '@/lib/content/load';

import { parseArgs, run } from './lib/args';
import { CONTENT_DIR, REPO_ROOT } from './lib/paths';
import { replay, type ContentSnapshot } from './lib/pglite';
import { readSeedSource } from './lib/seedSource';

type Row = Record<string, unknown>;

run(async () => {
  const args = parseArgs();
  const contentDir = resolve(REPO_ROOT, args.get('content') ?? CONTENT_DIR);
  const migrationsUpTo = args.get('migrations-up-to');
  const expectDiff = new Set(args.list('expect-diff'));

  const tree = loadContent(contentDir);
  const { rows, warnings } = buildRows(tree);
  for (const w of warnings) console.warn(`경고: ${w}`);
  const generated = toSeedSql(rows, { hash: tree.hash });
  const { name: legacyName, sql: legacy } = readSeedSource(args);

  const t0 = performance.now();
  const [a, b, c, d] = await Promise.all([
    replay({ migrationsUpTo, seeds: [{ name: legacyName, sql: legacy }] }),
    replay({
      migrationsUpTo,
      seeds: [{ name: 'content seed', sql: generated }],
    }),
    replay({
      migrationsUpTo,
      seeds: [
        { name: 'content seed', sql: generated },
        { name: 'content seed (재실행)', sql: generated },
      ],
    }),
    replay({
      migrationsUpTo,
      seeds: [
        { name: legacyName, sql: legacy },
        { name: 'content seed', sql: generated },
      ],
    }),
  ]);
  console.log(
    `원본 ${legacyName} · ${a.engine} · 마이그레이션 ${a.migrations.length}개 (${a.migrations.at(-1)}) · ${((performance.now() - t0) / 1000).toFixed(1)}초`,
  );

  const stageIds = new Set(rows.stages.map((s) => s.id));
  const questIds = new Set(rows.quests.map((q) => q.id));
  const keyOf = keyFn(a.snapshot);
  const only = (s: ContentSnapshot): ContentSnapshot => ({
    stages: s.stages.filter((r) => stageIds.has(String(r.id))),
    quests: s.quests.filter((r) => questIds.has(String(r.id))),
    answer_keys: s.answer_keys.filter((r) => questIds.has(String(r.quest_id))),
  });

  // 원본에는 있는데 content 에 아직 없는 것 (P1-12 진행 상황)
  const missing = a.snapshot.quests.filter((q) => !questIds.has(String(q.id)));
  const extra = rows.quests.filter(
    (q) => !a.snapshot.quests.some((o) => o.id === q.id),
  );
  console.log(
    `content: 스테이지 ${rows.stages.length}/${a.snapshot.stages.length}, 퀘스트 ${rows.quests.length}/${a.snapshot.quests.length}` +
      (missing.length
        ? ` (아직 없음: ${missing.map((q) => keyOf(q.id)).join(' ')})`
        : '') +
      (extra.length ? ` · 원본에 없는 새 퀘스트 ${extra.length}개` : ''),
  );

  const checks: [string, Diff[]][] = [
    [
      'A 원본 = B 생성 (content 범위 행)',
      diffSnapshots(only(a.snapshot), only(b.snapshot), keyOf),
    ],
    ['B 생성 = C 재실행 (멱등)', diffSnapshots(b.snapshot, c.snapshot, keyOf)],
    [
      'A 원본 = D 원본 위에 업서트 (전체 행)',
      diffSnapshots(a.snapshot, d.snapshot, keyOf),
    ],
    ['검증용 JSON: 원본 DB = 빌드 결과', diffFixtures(only(a.snapshot), rows)],
  ];

  let failed = 0;
  for (const [label, diffs] of checks) {
    const unexpected = diffs.filter((x) => !expectDiff.has(x.key));
    const expected = diffs.length - unexpected.length;
    const status =
      unexpected.length === 0 ? '일치' : `불일치 ${unexpected.length}건`;
    console.log(
      `${unexpected.length === 0 ? 'PASS' : 'FAIL'} ${label}: ${status}${expected ? ` (예상한 차이 ${expected}건)` : ''}`,
    );
    for (const x of diffs.slice(0, 20)) {
      console.log(
        `     ${expectDiff.has(x.key) ? '(예상)' : '      '} ${x.key} ${x.where}: ${x.detail}`,
      );
    }
    if (diffs.length > 20) console.log(`     … 외 ${diffs.length - 20}건`);
    if (unexpected.length > 0) failed++;
  }
  return failed ? 1 : 0;
});

// ------------------------------------------------------------

interface Diff {
  key: string;
  where: string;
  detail: string;
}

function keyFn(snapshot: ContentSnapshot) {
  const keys = new Map<string, string>();
  for (const q of snapshot.quests)
    keys.set(String(q.id), `${q.stage_order}-${q.order}`);
  for (const s of snapshot.stages) keys.set(String(s.id), `stage ${s.order}`);
  return (id: unknown) => keys.get(String(id)) ?? String(id);
}

function diffSnapshots(
  left: ContentSnapshot,
  right: ContentSnapshot,
  keyOf: (id: unknown) => string,
): Diff[] {
  return [
    ...diffTable('stages', left.stages, right.stages, 'id', keyOf),
    ...diffTable('quests', left.quests, right.quests, 'id', keyOf),
    ...diffTable(
      'quest_answer_keys',
      left.answer_keys,
      right.answer_keys,
      'quest_id',
      keyOf,
    ),
  ];
}

function diffTable(
  table: string,
  left: Row[],
  right: Row[],
  pk: string,
  keyOf: (id: unknown) => string,
): Diff[] {
  const diffs: Diff[] = [];
  const rightById = new Map(right.map((r) => [r[pk], r]));
  for (const l of left) {
    const r = rightById.get(l[pk]);
    rightById.delete(l[pk]);
    if (!r) {
      diffs.push({
        key: keyOf(l[pk]),
        where: table,
        detail: '오른쪽에 행이 없음',
      });
      continue;
    }
    for (const path of diffValues(l, r)) {
      diffs.push({
        key: keyOf(l[pk]),
        where: `${table}.${path}`,
        detail: '값이 다름',
      });
    }
  }
  for (const id of rightById.keys()) {
    diffs.push({ key: keyOf(id), where: table, detail: '왼쪽에 행이 없음' });
  }
  return diffs;
}

/** 값이 다른 경로 목록 (객체는 키 단위로 내려감, 배열·문자열은 통째로 비교) */
function diffValues(left: unknown, right: unknown, path = ''): string[] {
  if (isDeepStrictEqual(left, right)) return [];
  const isObj = (v: unknown): v is Row =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  if (isObj(left) && isObj(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].flatMap((k) =>
      diffValues(left[k], right[k], path ? `${path}.${k}` : k),
    );
  }
  return [path || '(값)'];
}

function diffFixtures(
  original: ContentSnapshot,
  rows: ReturnType<typeof buildRows>['rows'],
): Diff[] {
  const options = { generatedBy: 'compare', source: 'compare' };
  // DB 스냅샷의 스테이지 행에는 order 만 있으면 됨
  const fromDb = toCheckFixture(
    {
      stages: original.stages as { id: string; order: number }[],
      quests: original.quests as never,
      answer_keys: original.answer_keys as never,
    },
    options,
  ).quests;
  const fromContent = toCheckFixture(rows, options).quests;
  const diffs: Diff[] = [];
  const byId = new Map(fromContent.map((q) => [q.id, q]));
  for (const q of fromDb) {
    const built = byId.get(q.id);
    if (!built) {
      diffs.push({
        key: q.key,
        where: 'quests.json',
        detail: '빌드 결과에 없음',
      });
      continue;
    }
    for (const path of diffValues(q, built)) {
      diffs.push({
        key: q.key,
        where: `quests.json ${path}`,
        detail: '값이 다름',
      });
    }
  }
  if (fromContent.length !== fromDb.length) {
    diffs.push({
      key: '-',
      where: 'quests.json',
      detail: `개수 ${fromDb.length} ≠ ${fromContent.length}`,
    });
  }
  return diffs;
}
