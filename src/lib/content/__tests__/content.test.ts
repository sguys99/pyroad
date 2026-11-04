// 저장소의 content/ 원본 검사 + 생성 seed 를 메모리 Postgres(PGlite)에 실제로 적용해 보는 테스트.
// 로컬 Supabase 스택·docker 를 쓰지 않습니다. 원본 seed.sql 과의 전체 왕복 비교는 `npm run content:compare`.

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  CONTENT_DIR,
  LEGACY_SEED,
} from '../../../../scripts/content/lib/paths';
import {
  replay,
  type ContentSnapshot,
} from '../../../../scripts/content/lib/pglite';
import { buildRows, toSeedSql, type ContentRows } from '../build';
import { loadContent, type ContentTree } from '../load';

let tree: ContentTree;
let rows: ContentRows;

beforeAll(() => {
  tree = loadContent(CONTENT_DIR);
  rows = buildRows(tree).rows;
});

describe('content/ 원본', () => {
  it('스키마·이름·중복 검사를 통과하고 경고가 없음', () => {
    expect(buildRows(tree).warnings).toEqual([]);
    expect(tree.worlds.map((w) => w.world.slug)).toEqual(['python-island']);
  });

  it('모든 퀘스트·단계에 정답 코드가 있음', () => {
    for (const k of rows.answer_keys) {
      const isProject = k.steps.length > 0;
      if (!isProject) expect(k.solution_code, k.quest_id).toBeTruthy();
      for (const s of k.steps)
        expect(s.solution_code, `${k.quest_id}#${s.step_number}`).toBeTruthy();
    }
  });
});

describe('생성 seed 를 migrations 위에 적용 (PGlite)', () => {
  let once: ContentSnapshot;
  let twice: ContentSnapshot;
  let original: ContentSnapshot;

  beforeAll(async () => {
    const seed = toSeedSql(rows, { hash: tree.hash });
    const [a, b, c] = await Promise.all([
      replay({ seeds: [{ name: 'content seed', sql: seed }] }),
      replay({
        seeds: [
          { name: 'content seed', sql: seed },
          { name: 'content seed (재실행)', sql: seed },
        ],
      }),
      replay({
        seeds: [{ name: 'seed.sql', sql: readFileSync(LEGACY_SEED, 'utf8') }],
      }),
    ]);
    once = a.snapshot;
    twice = b.snapshot;
    original = c.snapshot;
  }, 120_000);

  it('DB 상태 = 빌드한 행 (SQL 이스케이프·jsonb 변환에 손실 없음)', () => {
    expect(once.stages).toEqual(rows.stages);
    // 스냅샷의 stage_order 는 비교용으로 붙인 값이라 행에는 없음
    expect(
      once.quests.map((q) =>
        Object.fromEntries(
          Object.entries(q).filter(([k]) => k !== 'stage_order'),
        ),
      ),
    ).toEqual(rows.quests);
    const byId = (a: object, b: object) =>
      String((a as { quest_id: string }).quest_id).localeCompare(
        String((b as { quest_id: string }).quest_id),
      );
    expect([...once.answer_keys].sort(byId)).toEqual(
      [...rows.answer_keys].sort(byId),
    );
  });

  it('다시 실행해도 같음 (멱등)', () => {
    expect(twice).toEqual(once);
  });

  it('content 에 있는 범위는 원본 seed.sql 결과와 같음 (P1-12 이관 중 회귀 방지)', () => {
    const ids = new Set(rows.quests.map((q) => q.id));
    const stageIds = new Set(rows.stages.map((s) => s.id));
    expect(original.stages.filter((s) => stageIds.has(String(s.id)))).toEqual(
      once.stages,
    );
    expect(original.quests.filter((q) => ids.has(String(q.id)))).toEqual(
      once.quests,
    );
    expect(
      original.answer_keys.filter((k) => ids.has(String(k.quest_id))),
    ).toEqual(once.answer_keys);
  });
});
