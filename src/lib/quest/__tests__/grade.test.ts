// 서버 재채점 (P11-05): 시험 손님마다 클라이언트가 보낸 출력·그림을 정답 테이블 규칙으로 다시 판정
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { gradeSubmission } from '../grade';
import { parseGradePayload, MAX_GRADE_COMMANDS } from '../gradeRuns';
import type { Database } from '@/lib/types/database';

const RULE = JSON.stringify([
  { type: 'code_check', expected: 'input(' },
  { type: 'scenario', index: 0, rule: { type: 'contains', expected: '6개' } },
  { type: 'scenario', index: 1, rule: { type: 'contains', expected: '20개' } },
]);
const SQUARE_RULE = JSON.stringify([
  { type: 'shape', shape: 'regular', n: 4, side: 100 },
]);
const SQUARE = [
  [
    'n',
    0,
    {
      x: 0,
      y: 0,
      h: 0,
      d: 1,
      pc: 'red',
      fc: 'black',
      w: 1,
      sp: 3,
      v: 1,
      sh: 'classic',
      sz: [1, 1, 1],
    },
  ],
  ['m', 0, 100, 0],
  ['m', 0, 100, 100],
  ['m', 0, 0, 100],
  ['m', 0, 0, 0],
];

function admin(expected: string, skeleton: unknown) {
  const rows: Record<string, unknown> = {
    quests: {
      validation_type: 'all',
      expected_output: '',
      prompt_skeleton: skeleton,
    },
    quest_answer_keys: {
      expected_output: expected,
      hints: {},
      solution_code: 'x',
      steps: [],
    },
  };
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: rows[table], error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

const GUESTS = {
  topic: 't',
  scenarios: [{ inputs: ['3'] }, { inputs: ['10'] }],
};
const code = 'n = int(input())\nprint(f"{n * 2}개")';

describe('gradeSubmission · 시험 손님', () => {
  it('손님마다 자기 규칙으로: 모두 맞으면 통과, 손님별 결과를 돌려줌', async () => {
    const r = await gradeSubmission(admin(RULE, GUESTS), 'q', {
      stdout: '',
      studentCode: code,
      runs: [{ stdout: '6개\n' }, { stdout: '20개\n' }],
    });
    expect(r).toEqual({
      status: 'graded',
      passed: true,
      scenarios: [true, true],
    });
  });

  it('한 손님이 다르면 불합격 (두 번째 손님의 출력이 첫 손님 기준과 같아도)', async () => {
    const r = await gradeSubmission(admin(RULE, GUESTS), 'q', {
      stdout: '',
      studentCode: code,
      runs: [{ stdout: '6개\n' }, { stdout: '6개\n' }],
    });
    expect(r).toMatchObject({ passed: false, scenarios: [true, false] });
  });

  it('손님 수가 모자라거나(한 번만 실행해 보냄) runs 없이 stdout만 오면 불합격', async () => {
    for (const sub of [
      { stdout: '6개', runs: [{ stdout: '6개' }] },
      { stdout: '6개 20개' },
    ])
      expect(
        await gradeSubmission(admin(RULE, GUESTS), 'q', {
          ...sub,
          studentCode: code,
        }),
      ).toMatchObject({ status: 'graded', passed: false });
  });

  it('그림 규칙: 보낸 명령을 다시 판정하고, 떨어지면 아이용 이유', async () => {
    const sk = { topic: 't' };
    expect(
      await gradeSubmission(admin(SQUARE_RULE, sk), 'q', {
        stdout: '',
        studentCode: '',
        turtle: SQUARE,
      }),
    ).toEqual({ status: 'graded', passed: true });
    const r = await gradeSubmission(admin(SQUARE_RULE, sk), 'q', {
      stdout: '',
      studentCode: '',
      turtle: SQUARE.slice(0, 4),
    });
    expect(r).toMatchObject({ passed: false });
    expect(r.status === 'graded' && r.reasons?.[0]).toBe(
      '정사각형을 아직 찾지 못했어요.',
    );
  });

  it('프로젝트 단계의 손님은 그 단계 공개 칸에서 센다', async () => {
    const sk = {
      topic: 't',
      steps: [
        {
          step_number: 1,
          validation_type: 'all',
          scenarios: [{ inputs: ['3'] }],
        },
      ],
    };
    const key = admin('x', sk);
    // 단계 정답 행
    (key as unknown as { from: unknown }).from = (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              table === 'quests'
                ? {
                    validation_type: 'all',
                    expected_output: '',
                    prompt_skeleton: sk,
                  }
                : {
                    expected_output: 'x',
                    hints: {},
                    solution_code: null,
                    steps: [
                      {
                        step_number: 1,
                        expected_output: RULE,
                        hints: {},
                        solution_code: 'x',
                      },
                    ],
                  },
            error: null,
          }),
        }),
      }),
    });
    expect(
      await gradeSubmission(key, 'q', {
        stdout: '',
        studentCode: code,
        step: 1,
        runs: [{ stdout: '6개' }],
      }),
    ).toEqual({ status: 'graded', passed: true, scenarios: [true] });
  });
});

describe('parseGradePayload (요청 본문 확인)', () => {
  it('모양이 틀리면 invalid', () => {
    expect(parseGradePayload({ runs: 'x' })).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(parseGradePayload({ runs: [{ stdout: 1 }] })).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(parseGradePayload({ turtle: [1, 2] })).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(parseGradePayload({ runs: Array(9).fill({ stdout: '' }) })).toEqual({
      ok: false,
      error: 'invalid',
    });
  });
  it('합이 상한을 넘으면 too_large', () => {
    expect(parseGradePayload({ stdout: 'x'.repeat(100_001) })).toEqual({
      ok: false,
      error: 'too_large',
    });
    expect(
      parseGradePayload({
        runs: [
          { stdout: '', turtle: Array(MAX_GRADE_COMMANDS + 1).fill(['u']) },
        ],
      }),
    ).toEqual({ ok: false, error: 'too_large' });
  });
  it('정상 본문은 그대로', () => {
    expect(
      parseGradePayload({
        stdout: 'a',
        runs: [{ stdout: 'b', turtle: [['u']] }],
      }),
    ).toEqual({
      ok: true,
      payload: { stdout: 'a', runs: [{ stdout: 'b', turtle: [['u']] }] },
    });
  });
});
