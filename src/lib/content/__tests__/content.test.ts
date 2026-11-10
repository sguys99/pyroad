// 저장소의 content/ 원본 검사 + 생성 seed 를 메모리 Postgres(PGlite)에 실제로 적용해 보는 테스트.
// 로컬 Supabase 스택·docker 를 쓰지 않습니다. 손으로 쓴 예전 seed 와의 왕복 비교는
// `npm run content:compare -- --seed-rev --expect-diff 1-5,4-7,7-1` (P1-12).

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { validateRule } from '@/lib/quest/validation';

import {
  CONTENT_DIR,
  SEED_SQL,
  WORLDS_MODULE,
} from '../../../../scripts/content/lib/paths';
import {
  replay,
  type ContentSnapshot,
} from '../../../../scripts/content/lib/pglite';
import {
  buildRows,
  toSeedSql,
  toWorldsModule,
  type ContentRows,
} from '../build';
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
    // 월드 2·3 은 world.yaml 만 있는 "준비 중" 표지 (Q48)
    expect(rows.worlds.map((w) => w.slug)).toEqual([
      'python-island',
      'code-sea',
      'maker-city',
    ]);
  });

  it('모든 퀘스트·단계에 정답 코드가 있음', () => {
    // 퀴즈는 정답 코드 대신 quiz_answer (P7-01)
    for (const k of rows.answer_keys.filter((k) => k.quiz_answer === null)) {
      const isProject = k.steps.length > 0;
      if (!isProject) expect(k.solution_code, k.quest_id).toBeTruthy();
      for (const s of k.steps)
        expect(s.solution_code, `${k.quest_id}#${s.step_number}`).toBeTruthy();
    }
  });
});

describe('커밋한 supabase/seed.sql', () => {
  it('content/ 생성물과 같음 (다르면 npm run content:build 로 다시 만들어 함께 커밋)', () => {
    expect(readFileSync(SEED_SQL, 'utf8')).toBe(
      toSeedSql(rows, { hash: tree.hash }),
    );
  });
});

describe('커밋한 src/lib/world/worlds.generated.ts', () => {
  it('content/ 생성물과 같음 (다르면 npm run content:build 로 다시 만들어 함께 커밋)', () => {
    expect(readFileSync(WORLDS_MODULE, 'utf8')).toBe(toWorldsModule(tree));
  });
});

describe('생성 seed 를 migrations 위에 적용 (PGlite)', () => {
  let once: ContentSnapshot;
  let twice: ContentSnapshot;
  let crlf: ContentSnapshot;

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
        crlf: true,
        seeds: [{ name: 'content seed (CRLF)', sql: seed }],
      }),
    ]);
    once = a.snapshot;
    twice = b.snapshot;
    crlf = c.snapshot;
  }, 120_000);

  it('DB 상태 = 빌드한 행 (SQL 이스케이프·jsonb 변환에 손실 없음)', () => {
    // 1월드는 00012 가 고정 id 로 만들고 seed 가 slug 기준으로 덮어씀 (P1-08)
    expect(once.worlds).toEqual(rows.worlds);
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

  it('B39: 마이그레이션·seed 를 CRLF 로 바꿔 실행해도 같고 \\r 이 없음 (Windows SQL Editor 붙여넣기)', () => {
    expect(crlf).toEqual(once);
    const withCr: string[] = [];
    const walk = (v: unknown, path: string): void => {
      if (typeof v === 'string') {
        if (v.includes('\r')) withCr.push(path);
      } else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
      }
    };
    walk(crlf, 'db');
    expect(withCr).toEqual([]);
  });

  it('새 DB 에도 모든 퀘스트의 정답이 있고 quests 에는 정답이 없음 (B07·B08)', () => {
    expect(once.quests).toHaveLength(rows.quests.length);
    expect(once.answer_keys).toHaveLength(rows.quests.length);
    expect(once.quests.filter((q) => q.expected_output !== '')).toEqual([]);
    for (const k of once.answer_keys.filter((k) => k.quiz_answer == null)) {
      const steps = k.steps as { solution_code: string }[];
      expect(k.expected_output, String(k.quest_id)).toBeTruthy();
      if (steps.length === 0) expect(k.solution_code).toBeTruthy();
      for (const s of steps) expect(s.solution_code).toBeTruthy();
    }
  });
});

// 실제 실행(Pyodide) 검증은 P1-13. 여기서는 출력 예시로 규칙만 확인한다
describe('콘텐츠 버그 회귀 (P1-12)', () => {
  const NUMBER_GAME = 'b1000000-0000-0000-0000-000000000022'; // 7-1
  const step = (n: number) => {
    const quest = tree.worlds
      .flatMap((w) => w.stages)
      .flatMap((s) => s.quests)
      .find((q) => q.quest.id === NUMBER_GAME)!.quest;
    if (quest.quest_type !== 'project') throw new Error('7-1 은 프로젝트');
    return quest.steps[n - 1].answer;
  };

  it('B30: 7-1 2단계는 1단계 코드 그대로면 불합격, 추측을 저장·출력하면 통과', () => {
    const { validation, solution_code } = step(2);
    const step1 = step(1).solution_code;
    expect(
      validateRule(validation, { stdout: '7\n', studentCode: step1 }),
    ).toBe(false);
    expect(
      validateRule(validation, {
        stdout: '비밀 숫자: 7\n추측: 3\n',
        studentCode: solution_code,
      }),
    ).toBe(true);
  });

  it('B09: 7-1 3단계는 무작위로 어느 갈래가 나와도 통과 (힌트 level_3 문구 포함)', () => {
    const { validation, solution_code } = step(3);
    for (const stdout of [
      '정답!',
      '비밀 숫자가 추측보다 커요!',
      '비밀 숫자가 추측보다 작아요!',
      '비밀 숫자가 더 커요!',
      '비밀 숫자가 더 작아요!',
    ]) {
      expect(
        validateRule(validation, { stdout, studentCode: solution_code }),
        stdout,
      ).toBe(true);
    }
    // elif 없이 출력만 흉내 내면 불합격
    expect(
      validateRule(validation, {
        stdout: '정답!',
        studentCode: 'print("정답!")',
      }),
    ).toBe(false);
  });
});
