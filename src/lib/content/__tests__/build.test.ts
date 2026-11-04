import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
  assertNoAnswersInPublicRows,
  buildRows,
  splitQuest,
  toCheckFixture,
  toSeedSql,
} from '../build';
import { questFromRows } from '../fromRows';
import type { ContentTree } from '../load';
import { findAnswerKeysInPublic, parseQuest, type Quest } from '../schema';
import { questToYaml } from '../yaml';
import { codeQuest, projectQuest } from './fixtures';

const STAGE_1 = {
  id: 'a1000000-0000-0000-0000-000000000001',
  order: 1,
  title: '파이썬 마을 입구',
  theme_name: 'python_village',
  description: "print()와 주석을 배워봐요! I'm",
  is_final: false,
};
const STAGE_7 = {
  ...STAGE_1,
  id: 'a1000000-0000-0000-0000-000000000007',
  order: 7,
  title: '프로젝트 왕국',
  theme_name: 'project_kingdom',
  is_final: true,
};

const parsed = (raw: unknown): Quest => {
  const result = parseQuest(raw);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.value;
};

function tree(...stages: [typeof STAGE_1, Quest[]][]): ContentTree {
  return {
    hash: 'test',
    files: [],
    worlds: [
      {
        file: 'world.yaml',
        world: {
          slug: 'python-island',
          order: 1,
          title: '파이썬 섬',
          theme: 'python_island',
          description: '',
          unlock_rule: { type: 'open' },
        },
        stages: stages.map(([stage, quests]) => ({
          file: 'stage.yaml',
          stage,
          quests: quests.map((quest) => ({
            file: `${quest.order}.yaml`,
            quest,
          })),
        })),
      },
    ],
  };
}

// 공개 행(quests)에 나오면 안 되는 정답 문자열 (fixtures.ts 의 projectQuest)
const SECRETS = [
  'SECRET_STEP2_SOLUTION',
  'secret = random.___(1, 10)',
  '작아요',
  'random.randint(1, 10)\\nprint',
];

describe('buildRows: 공개/정답 분리', () => {
  const content = tree(
    [STAGE_1, [parsed(codeQuest())]],
    [STAGE_7, [parsed(projectQuest())]],
  );
  const { rows, warnings } = buildRows(content);
  const [codeRow, projectRow] = rows.quests;
  const [codeKey, projectKey] = rows.answer_keys;

  it('quests 행에는 정답 키가 없고 expected_output 은 빈 문자열', () => {
    for (const q of rows.quests) {
      expect(q.expected_output).toBe('');
      expect(findAnswerKeysInPublic(q.prompt_skeleton)).toEqual([]);
    }
    expect(Object.keys(codeRow.prompt_skeleton)).toEqual([
      'topic',
      'learning_goals',
      'story_context',
      'exercise_description',
      'starter_code',
      'expected_output_hint',
      'fallback_text',
    ]);
  });

  it('정답 문자열은 quests 행에 없고 quest_answer_keys 행에만 있음', () => {
    const publicText = JSON.stringify(rows.quests);
    const answerText = JSON.stringify(rows.answer_keys);
    for (const secret of SECRETS) {
      expect(publicText).not.toContain(secret);
      expect(answerText).toContain(secret);
    }
  });

  it('검증 유형은 공개, 기준값은 정답 행 (단계별도 같음)', () => {
    expect(codeRow.validation_type).toBe('output_match');
    expect(codeKey).toEqual({
      quest_id: codeRow.id,
      expected_output: '안녕하세요!',
      hints: codeQuest().answer.hints,
      solution_code: 'print("안녕하세요!")',
      steps: [],
      quiz_answer: null,
    });
    expect(projectRow.prompt_skeleton.steps).toEqual([
      {
        step_number: 1,
        step_goal: '비밀 숫자 만들기',
        starter_code: 'import random\n',
        validation_type: 'code_check',
        fallback_text: 'random.randint(1, 10)',
      },
      {
        step_number: 2,
        step_goal: '비교하기',
        starter_code: '',
        validation_type: 'all',
        fallback_text: 'if/elif/else',
      },
    ]);
    expect(projectKey.solution_code).toBeNull();
    expect(projectKey.steps.map((s) => s.expected_output)).toEqual([
      'random.randint',
      '[{"type":"code_check","expected":"elif"},{"type":"contains_any","expected":["커요","작아요","정답"]}]',
    ]);
  });

  it('프로젝트 단계의 새 규칙은 경고 없음 (jsonb 라 CHECK 제약이 없음)', () => {
    expect(warnings).toEqual([]);
  });

  it('퀘스트 전체 규칙에 all·contains_any 를 써도 경고 없음 (00012 가 quests.validation_type CHECK 를 넓힘)', () => {
    const q = codeQuest();
    const withRule = (validation: unknown) =>
      parsed({ ...q, answer: { ...q.answer, validation } });
    const { rows: built, warnings: w } = buildRows(
      tree([
        STAGE_1,
        [
          withRule({
            type: 'all',
            rules: [{ type: 'contains', expected: '안녕' }],
          }),
        ],
      ]),
    );
    expect(w).toEqual([]);
    expect(built.quests[0].validation_type).toBe('all');
    expect(
      buildRows(
        tree([
          STAGE_1,
          [withRule({ type: 'contains_any', expected: ['가', '나'] })],
        ]),
      ).warnings,
    ).toEqual([]);
  });

  it('월드·퀘스트 유형 행 (P1-08)', () => {
    expect(rows.worlds).toEqual([
      {
        slug: 'python-island',
        order: 1,
        title: '파이썬 섬',
        theme: 'python_island',
        description: '',
        unlock_rule: { type: 'open' },
      },
    ]);
    expect(rows.stages.map((s) => s.world)).toEqual([
      'python-island',
      'python-island',
    ]);
    expect(
      rows.quests.map((q) => [q.quest_type, q.quiz_kind, q.is_mobile_friendly]),
    ).toEqual([
      ['code', null, false],
      ['project', null, false],
    ]);
  });

  it('공개 행에 정답이 섞이면 예외 (00005 CHECK 와 같은 검사)', () => {
    const leaked = {
      ...codeRow,
      prompt_skeleton: { ...codeRow.prompt_skeleton, hints: {} },
    };
    expect(() => assertNoAnswersInPublicRows([leaked])).toThrow(
      /prompt_skeleton\.hints/,
    );
    expect(() =>
      assertNoAnswersInPublicRows([{ ...codeRow, expected_output: 'x' as '' }]),
    ).toThrow(/expected_output/);
  });
});

describe('toSeedSql', () => {
  const { rows } = buildRows(
    tree([STAGE_1, [parsed(codeQuest())]], [STAGE_7, [parsed(projectQuest())]]),
  );
  const sql = toSeedSql(rows, { hash: 'abc123' });
  const statements = sql.split(/;\n/);
  const questInserts = statements.filter((s) =>
    s.includes('INSERT INTO public.quests '),
  );
  const keyInserts = statements.filter((s) =>
    s.includes('INSERT INTO public.quest_answer_keys'),
  );

  it('quests INSERT 에는 정답이 없고, 정답은 quest_answer_keys INSERT 에만', () => {
    expect(questInserts).toHaveLength(2);
    expect(keyInserts).toHaveLength(2);
    for (const secret of SECRETS) {
      expect(questInserts.join('')).not.toContain(secret);
      expect(keyInserts.join('')).toContain(secret);
    }
  });

  it('멱등 업서트이고 DML 만 있음 (권한·스키마를 바꾸지 않음)', () => {
    expect(sql.match(/ON CONFLICT \(slug\) DO UPDATE/g)).toHaveLength(1);
    expect(sql.match(/ON CONFLICT \(id\) DO UPDATE/g)).toHaveLength(3);
    expect(sql.match(/ON CONFLICT \(quest_id\) DO UPDATE/g)).toHaveLength(2);
    const code = sql.replace(/^--.*$/gm, '');
    expect(code).not.toMatch(
      /\b(GRANT|REVOKE|CREATE|ALTER|DROP|DELETE|TRUNCATE)\b/i,
    );
  });

  it('작은따옴표는 두 번 써서 이스케이프', () => {
    expect(sql).toContain("'print()와 주석을 배워봐요! I''m'");
  });

  it('머리에 콘텐츠 해시와 개수', () => {
    expect(sql).toContain('콘텐츠 해시: abc123');
    expect(sql).toContain(
      '월드 1 · 스테이지 2 · 퀘스트 2 · 정답 행 2 (solution_code 1 + 프로젝트 단계 2)',
    );
  });

  it('스테이지는 월드 slug 로 world_id 를 찾고, 퀘스트는 유형을 씀 (P1-08)', () => {
    expect(sql).toContain(
      "(SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island')",
    );
    expect(questInserts[1]).toContain("'project',\n  NULL,\n  FALSE,");
  });

  it('같은 입력이면 같은 출력 (생성물 드리프트 검사용)', () => {
    expect(toSeedSql(rows, { hash: 'abc123' })).toBe(sql);
  });
});

describe('toCheckFixture (P0-09 fixture 형태, P1-13 이 읽음)', () => {
  const { rows } = buildRows(
    tree([STAGE_1, [parsed(codeQuest())]], [STAGE_7, [parsed(projectQuest())]]),
  );
  const fixture = toCheckFixture(rows, { generatedBy: 'test', source: 'test' });

  it('퀘스트·단계별로 판정에 필요한 값', () => {
    expect(fixture.meta.counts).toEqual({
      quests: 2,
      with_solution: 1,
      project_steps: 2,
      project_steps_with_solution: 2,
    });
    expect(fixture.quests[0]).toEqual({
      id: 'b1000000-0000-0000-0000-000000000001',
      key: '1-1',
      world: 'python-island',
      stage_order: 1,
      order: 1,
      title: '첫 번째 인사',
      quest_type: 'code',
      validation_type: 'output_match',
      expected_output: '안녕하세요!',
      starter_code: '# 아래에 코드를 작성해보세요!\n',
      solution_code: 'print("안녕하세요!")',
      steps: null,
    });
    expect(fixture.quests[1].key).toBe('7-1');
    expect(fixture.quests[1].steps?.[1]).toEqual({
      step_number: 2,
      validation_type: 'all',
      expected_output: rows.answer_keys[1].steps[1].expected_output,
      starter_code: '',
      solution_code: projectQuest().steps[1].answer.solution_code,
    });
  });
});

describe('왕복: 원본 → 행 → 원본, 원본 → YAML → 원본', () => {
  const quests = [
    parsed(codeQuest()),
    parsed(projectQuest()),
    parsed({
      ...codeQuest(),
      answer: {
        ...codeQuest().answer,
        validation: { type: 'code_check', expected: 'int(', whole_word: true },
      },
    }),
  ];

  it.each(quests.map((q) => [q.quest_type, q] as const))(
    '%s 퀘스트 행 왕복',
    (_t, quest) => {
      const { questRow, answerRow } = splitQuest(quest, STAGE_1.id);
      // DB 를 거친 것처럼 JSON 으로 한 번 바꿈
      const viaDb = JSON.parse(JSON.stringify({ questRow, answerRow }));
      expect(questFromRows(viaDb.questRow, viaDb.answerRow)).toEqual(quest);
    },
  );

  it.each(quests.map((q) => [q.quest_type, q] as const))(
    '%s 퀘스트 YAML 왕복',
    (_t, quest) => {
      const text = questToYaml(quest, '퀘스트 1-1: 테스트');
      expect(text).toContain('# 공개: 학생 화면으로 그대로 내려갑니다');
      expect(parsed(parseYaml(text))).toEqual(quest);
    },
  );
});
