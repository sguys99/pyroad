// 정답 자동 검증(P1-13)의 Pyodide 없는 부분: 단위 펼치기, 실행 계획, 판정 설명, 메시지
// (실제 실행은 solutions.content.test.ts, `npm run test:content`)

import { describe, expect, it } from 'vitest';

import type { CheckFixture } from '@/lib/content/build';
import { toStoredRule } from '@/lib/quest/validation';

import {
  appendStarter,
  filterUnits,
  judge,
  labels,
  lineDiff,
  planRuns,
  questRuleProblem,
  solutionProblem,
  starterPassesProblem,
  starterTimeoutProblem,
  toUnits,
  type RunRecord,
  type UnitReport,
} from '../lib/solutionCheck';

const B09_RULE = toStoredRule({
  type: 'all',
  rules: [
    { type: 'code_check', expected: 'elif' },
    { type: 'contains_any', expected: ['커요', '작아요', '정답'] },
  ],
});

const fixture: CheckFixture = {
  meta: {
    generated_by: 'test',
    source: 'test',
    counts: {
      quests: 2,
      with_solution: 1,
      project_steps: 3,
      project_steps_with_solution: 2,
    },
  },
  quests: [
    {
      id: 'q-code',
      key: '4-7',
      world: 'python-island',
      stage_order: 4,
      order: 7,
      title: '카운트다운',
      quest_type: 'code',
      validation_type: 'output_match',
      expected_output: '5\n4',
      starter_code: 'count = 5\n',
      solution_code: 'print(5)\nprint(4)',
      steps: null,
      scenarios: [{ inputs: ['3'] }],
    },
    {
      id: 'q-project',
      key: '7-1',
      world: 'python-island',
      stage_order: 7,
      order: 1,
      title: '숫자 맞추기 게임',
      quest_type: 'project',
      validation_type: 'contains',
      expected_output: '번 만에 맞췄어요',
      starter_code: 'import random\n',
      solution_code: null,
      steps: [
        {
          step_number: 1,
          validation_type: 'code_check',
          expected_output: 'random.randint',
          starter_code: 'import random\n',
          solution_code: 'import random\nsecret = random.randint(1, 10)',
        },
        {
          step_number: 2,
          validation_type: 'all',
          expected_output: B09_RULE.expected_output,
          starter_code: '',
          solution_code: null,
        },
        {
          step_number: 3,
          validation_type: 'contains',
          expected_output: '번 만에 맞췄어요',
          starter_code: 'attempts = 0',
          solution_code: 'print("1번 만에 맞췄어요")',
        },
      ],
    },
  ],
};

const units = toUnits(fixture, (id) => `content/${id}.yaml`);

describe('toUnits', () => {
  it('코드 퀘스트 1단위, 프로젝트는 단계마다 1단위', () => {
    expect(units.map((u) => u.key)).toEqual(['4-7', '7-1#1', '7-1#2', '7-1#3']);
    expect(units[0]).toMatchObject({
      title: '카운트다운',
      where: 'content/q-code.yaml answer',
      rule: { validation_type: 'output_match', expected_output: '5\n4' },
      initialCode: 'count = 5\n',
      scenarios: [{ inputs: ['3'] }],
    });
  });

  it('k단계 시작 코드 = k-1단계 정답 + 시작 코드 (정답이 없으면 그 단계 시작 코드를 이어 씀)', () => {
    expect(units[1].initialCode).toBe('import random\n');
    // 2단계 starter 가 비어 있으면 1단계 정답 그대로 (useQuestSession 의 appendStarter)
    expect(units[2].initialCode).toBe(
      fixture.quests[1].steps![0].solution_code,
    );
    expect(units[3].initialCode).toBe(
      appendStarter(units[2].initialCode, 'attempts = 0'),
    );
  });

  it('퀘스트 전체 규칙은 마지막 단계에만', () => {
    expect(units.map((u) => u.questRule?.expected_output)).toEqual([
      undefined,
      undefined,
      undefined,
      '번 만에 맞췄어요',
    ]);
    expect(units[3]).toMatchObject({
      title: '숫자 맞추기 게임 3/3단계',
      where: 'content/q-project.yaml steps[2].answer',
      questRuleWhere: 'content/q-project.yaml answer.validation',
    });
  });

  it('TEST_CONTENT_ONLY 는 퀘스트 키·단위 키·퀘스트 id 로 고름', () => {
    expect(filterUnits(units, []).length).toBe(4);
    expect(filterUnits(units, ['7-1']).length).toBe(3);
    expect(filterUnits(units, ['7-1#2', 'q-code']).map((u) => u.key)).toEqual([
      '4-7',
      '7-1#2',
    ]);
  });
});

describe('planRuns', () => {
  const randomSeed = () => 1234;

  it('시나리오가 없으면 시드 0~N-1 + 무시드 M회 (무시드도 뽑은 시드를 명시)', () => {
    const plan = planRuns(null, { seeds: 3, unseededRuns: 2, randomSeed });
    expect(plan.map((p) => [p.label, p.seed, p.stdin])).toEqual([
      ['시드 0', 0, undefined],
      ['시드 1', 1, undefined],
      ['시드 2', 2, undefined],
      ['무시드(시드 1234)', 1234, undefined],
      ['무시드(시드 1234)', 1234, undefined],
    ]);
  });

  it('입력 시나리오마다 같은 계획, 시드를 정한 시나리오는 그 시드로 한 번만', () => {
    const plan = planRuns(
      [{ inputs: ['3', '5'] }, { inputs: ['abc', '82'], seed: 42 }],
      { seeds: 2, unseededRuns: 1, randomSeed },
    );
    expect(plan).toEqual([
      { label: '시나리오 1 · 시드 0', seed: 0, stdin: ['3', '5'] },
      { label: '시나리오 1 · 시드 1', seed: 1, stdin: ['3', '5'] },
      {
        label: '시나리오 1 · 무시드(시드 1234)',
        seed: 1234,
        stdin: ['3', '5'],
      },
      { label: '시나리오 2 · 시드 42', seed: 42, stdin: ['abc', '82'] },
    ]);
  });

  it('기본 무시드 시드는 실행마다 다름', () => {
    const seeds = planRuns(null, { seeds: 0, unseededRuns: 5 }).map(
      (p) => p.seed,
    );
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });
});

const ok = (stdout: string) => ({
  success: true,
  outcome: 'ok' as const,
  stdout,
  stderr: '',
  isTimeout: false,
});

describe('judge (앱과 같은 순서: 실행 성공 → validateResult)', () => {
  it('저장 형태의 all 규칙(JSON 문자열)을 그대로 판정', () => {
    const code = 'if a:\n    pass\nelif b:\n    print("정답")';
    expect(judge(B09_RULE, ok('정답!'), code)).toEqual({
      passed: true,
      detail: [],
    });
  });

  it('하위 규칙마다 통과·실패를 보여 주고, 실패한 쪽에 맞는 자료를 붙임', () => {
    const v = judge(B09_RULE, ok('7\n'), 'if a:\n    pass\n# elif');
    expect(v.passed).toBe(false);
    expect(v.detail).toEqual([
      '[실패] all: 아래 규칙을 모두 통과해야 해요',
      '  [실패] code_check: 코드에 "elif"가 있어야 해요 (주석·문자열 안은 세지 않음)',
      '  [실패] contains_any: 출력에 "커요", "작아요", "정답" 중 하나가 들어 있어야 해요',
      '실제 출력:',
      '  | 7',
      '검사한 코드:',
      '  | if a:',
      '  |     pass',
      '  | # elif',
    ]);
  });

  it('output_match 는 기대/실제 줄 단위 차이', () => {
    const v = judge(
      { validation_type: 'output_match', expected_output: '5\n4\n3' },
      ok('5\n3\n'),
      '',
    );
    expect(v.detail).toEqual([
      '[실패] output_match: 출력 전체가 기대 출력과 같아야 해요 (앞뒤 공백·줄바꿈만 무시)',
      '    --- 기대  +++ 실제',
      '      5',
      '    - 4',
      '      3',
    ]);
  });

  it('예외·시간 초과는 규칙과 상관없이 실패', () => {
    const rule = { validation_type: 'contains' as const, expected_output: 'a' };
    const error = judge(
      rule,
      {
        success: false,
        outcome: 'error',
        stdout: 'a\n',
        stderr: 'Traceback (most recent call last):\nNameError: name x',
        isTimeout: false,
      },
      '',
    );
    expect(error.passed).toBe(false);
    expect(error.detail[0]).toBe('실행 오류: NameError: name x');
    const timeout = judge(
      rule,
      { ...ok('a\n'), success: false, outcome: 'timeout', isTimeout: true },
      '',
    );
    expect(timeout.detail[0]).toBe(
      '시간 초과: 5초 안에 끝나지 않았어요 (무한 루프?)',
    );
  });

  it('기준값이 비면 채점 API 처럼 불합격', () => {
    const v = judge(
      { validation_type: 'contains', expected_output: '' },
      ok(''),
      '',
    );
    expect(v.passed).toBe(false);
  });
});

describe('lineDiff · labels', () => {
  it('바뀐 줄은 - 기대, + 실제 순서이고 앞뒤 공백은 따옴표로', () => {
    expect(lineDiff('안녕하세요?', '안녕하세요!')).toEqual([
      '--- 기대  +++ 실제',
      '- 안녕하세요?',
      '+ 안녕하세요!',
    ]);
    expect(lineDiff('a b', 'a b ')).toEqual([
      '--- 기대  +++ 실제',
      '- a b',
      '+ "a b "',
    ]);
  });

  it('연속한 시드는 범위로 묶음', () => {
    const names = ['시드 0', '시드 1', '시드 2', '시드 4', '시드 5', '시드 8'];
    expect(
      labels([...names, '무시드(시드 99)'].map((label) => ({ label }))),
    ).toBe('시드 0~2, 4, 5, 8, 무시드(시드 99)');
    expect(
      labels(
        [
          '시나리오 1 · 시드 0',
          '시나리오 1 · 시드 1',
          '시나리오 2 · 시드 42',
        ].map((label) => ({ label })),
      ),
    ).toBe('시나리오 1 · 시드 0, 1, 시나리오 2 · 시드 42');
  });
});

describe('작성자용 실패 메시지', () => {
  const run = (over: Partial<RunRecord>): RunRecord => ({
    label: '시드 0',
    seed: 0,
    passed: true,
    detail: [],
    stdout: '',
    isTimeout: false,
    isOutputLimit: false,
    ms: 1,
    ...over,
  });
  const report = (over: Partial<UnitReport>): UnitReport => ({
    unit: units[3],
    solution: [],
    starter: [],
    planned: 2,
    ms: 1,
    ...over,
  });

  it('문제가 없으면 null', () => {
    const r = report({
      solution: [run({ questRule: { passed: true, detail: [] } })],
      starter: [run({ passed: false })],
    });
    expect(solutionProblem(r)).toBeNull();
    expect(starterPassesProblem(r)).toBeNull();
    expect(starterTimeoutProblem(r)).toBeNull();
    expect(questRuleProblem(r)).toBeNull();
  });

  it('② 위치·실패 시드·규칙·자세한 이유·재현 명령', () => {
    const message = solutionProblem(
      report({
        solution: [
          run({ passed: false, detail: ['[실패] 이유'] }),
          run({ label: '시드 1', seed: 1 }),
        ],
      }),
    );
    expect(message).toContain(
      '[7-1#3] 숫자 맞추기 게임 3/3단계 — content/q-project.yaml steps[2].answer (퀘스트 id q-project)',
    );
    expect(message).toContain('2회 중 1회 실패 (시드 0)');
    expect(message).toContain('규칙: contains "번 만에 맞췄어요"');
    expect(message).toContain('--- 시드 0 ---\n[실패] 이유');
    expect(message).toContain('contains_any·all 같은 넓은 규칙');
    expect(message).toContain('TEST_CONTENT_ONLY=7-1 npm run test:content');
  });

  it('④ 시간 초과와 출력 상한(print 가 든 무한 루프) 모두 무한 루프로 알림', () => {
    expect(
      starterTimeoutProblem(report({ starter: [run({ isTimeout: true })] })),
    ).toContain('시간 안에 끝나지 않아요');
    expect(
      starterTimeoutProblem(
        report({ starter: [run({ isOutputLimit: true })] }),
      ),
    ).toContain('출력 상한에서 멈춰요');
  });

  it('⑤ 퀘스트 전체 규칙 위치를 짚음', () => {
    const message = questRuleProblem(
      report({
        solution: [run({ questRule: { passed: false, detail: ['x'] } })],
      }),
    );
    expect(message).toContain('content/q-project.yaml answer.validation');
  });
});
