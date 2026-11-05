import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchAnswerKeyRow,
  findStepAnswer,
  resolveAnswerKey,
  stripAnswerFields,
} from '../answerKeys';

const HINTS = { level_1: '힌트1', level_2: '힌트2', level_3: '힌트3' };

// ①(00004)만 적용된 DB의 quests 행: 정답이 아직 남아 있음
const LEGACY_QUEST = {
  expected_output: '안녕하세요!',
  prompt_skeleton: {
    topic: 'print',
    starter_code: '# 코드',
    fallback_text: '폴백',
    hints: HINTS,
    solution_code: 'print("안녕하세요!")',
  },
};

const LEGACY_PROJECT = {
  expected_output: '번 만에 맞췄어요',
  prompt_skeleton: {
    topic: '게임',
    hints: HINTS,
    steps: [
      {
        step_number: 1,
        step_goal: '숫자 만들기',
        starter_code: '',
        validation_type: 'code_check',
        expected_output: 'randint',
        hints: HINTS,
        fallback_text: '1단계',
        solution_code: 'import random',
      },
      {
        step_number: 2,
        step_goal: '추측',
        starter_code: '',
        validation_type: 'contains',
        expected_output: '추측',
        hints: HINTS,
        fallback_text: '2단계',
      },
    ],
  },
};

// 00005 이후 quests 행: 정답 없음
const STRIPPED_QUEST = {
  expected_output: '',
  prompt_skeleton: {
    topic: 'print',
    starter_code: '# 코드',
    fallback_text: '폴백',
  },
};

function fakeAdmin(result: { data: unknown; error: unknown }) {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => result,
  };
  return { from: vi.fn(() => q) } as unknown as Parameters<
    typeof fetchAnswerKeyRow
  >[0];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveAnswerKey', () => {
  it('quest_answer_keys 행이 있으면 그 값을 쓴다 (quests 값보다 우선)', () => {
    const key = resolveAnswerKey(
      {
        expected_output: '정답 테이블',
        hints: HINTS,
        solution_code: 'print(1)',
        steps: [],
      },
      LEGACY_QUEST,
    );
    expect(key).toMatchObject({
      expectedOutput: '정답 테이블',
      hints: HINTS,
      solutionCode: 'print(1)',
      source: 'quest_answer_keys',
    });
  });

  it('행이 없으면 quests 행의 정답 필드로 폴백한다 (①만 적용·① 전 DB)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const key = resolveAnswerKey(null, LEGACY_QUEST);
    expect(key).toEqual({
      expectedOutput: '안녕하세요!',
      hints: HINTS,
      solutionCode: 'print("안녕하세요!")',
      steps: [],
      source: 'quests',
    });
  });

  it('프로젝트 단계 정답도 폴백에서 읽는다', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const key = resolveAnswerKey(null, LEGACY_PROJECT)!;
    expect(key.steps).toEqual([
      {
        step_number: 1,
        expected_output: 'randint',
        hints: HINTS,
        solution_code: 'import random',
      },
      { step_number: 2, expected_output: '추측', hints: HINTS },
    ]);
    expect(findStepAnswer(key, 2)?.expected_output).toBe('추측');
    expect(findStepAnswer(key, 3)).toBeUndefined();
  });

  it('어느 쪽에도 정답이 없으면 null (빈 기준으로 채점하지 않게)', () => {
    expect(resolveAnswerKey(null, STRIPPED_QUEST)).toBeNull();
    expect(resolveAnswerKey(null, null)).toBeNull();
    expect(
      resolveAnswerKey(
        { expected_output: '', hints: {}, solution_code: null, steps: [] },
        STRIPPED_QUEST,
      ),
    ).toBeNull();
  });

  it('빠진 힌트 단계는 빈 문자열로 채운다', () => {
    const key = resolveAnswerKey(
      {
        expected_output: 'x',
        hints: { level_1: '하나' },
        solution_code: null,
        steps: [],
      },
      null,
    );
    expect(key?.hints).toEqual({ level_1: '하나', level_2: '', level_3: '' });
  });
});

describe('fetchAnswerKeyRow', () => {
  it('행을 돌려준다', async () => {
    const row = {
      expected_output: 'a',
      hints: {},
      solution_code: null,
      steps: [],
    };
    const admin = fakeAdmin({ data: row, error: null });
    await expect(fetchAnswerKeyRow(admin, 'q1')).resolves.toEqual(row);
    expect(admin.from).toHaveBeenCalledWith('quest_answer_keys');
  });

  it('테이블이 없으면(00004 적용 전) 조용히 null', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const admin = fakeAdmin({
      data: null,
      error: { code: 'PGRST205', message: 'x' },
    });
    await expect(fetchAnswerKeyRow(admin, 'q1')).resolves.toBeNull();
    expect(err).not.toHaveBeenCalled();
  });

  it('그 밖의 오류는 기록하고 null', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const admin = fakeAdmin({
      data: null,
      error: { code: '42501', message: 'denied' },
    });
    await expect(fetchAnswerKeyRow(admin, 'q1')).resolves.toBeNull();
    expect(err).toHaveBeenCalled();
  });
});

describe('stripAnswerFields', () => {
  it('hints·solution_code를 지우고 공개 필드는 남긴다', () => {
    const sk = stripAnswerFields(LEGACY_QUEST.prompt_skeleton);
    expect(sk).toEqual({
      topic: 'print',
      starter_code: '# 코드',
      fallback_text: '폴백',
    });
  });

  it('프로젝트 단계의 expected_output·hints·solution_code를 지운다', () => {
    const sk = stripAnswerFields(LEGACY_PROJECT.prompt_skeleton);
    expect(sk.steps).toEqual([
      {
        step_number: 1,
        step_goal: '숫자 만들기',
        starter_code: '',
        validation_type: 'code_check',
        fallback_text: '1단계',
      },
      {
        step_number: 2,
        step_goal: '추측',
        starter_code: '',
        validation_type: 'contains',
        fallback_text: '2단계',
      },
    ]);
    expect(JSON.stringify(sk)).not.toMatch(/randint|solution_code|hints/);
  });

  it('원본 객체를 바꾸지 않는다', () => {
    const original = structuredClone(LEGACY_PROJECT.prompt_skeleton);
    stripAnswerFields(LEGACY_PROJECT.prompt_skeleton);
    expect(LEGACY_PROJECT.prompt_skeleton).toEqual(original);
  });
});
