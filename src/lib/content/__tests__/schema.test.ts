import { describe, expect, it } from 'vitest';

import {
  findAnswerKeysInPublic,
  parseQuest,
  parseWith,
  StageSchema,
  ValidationRuleSchema,
  WorldSchema,
} from '../schema';
import { codeQuest, projectQuest } from './fixtures';

/** key 를 뺀 사본 */
const without = <T extends object>(obj: T, key: keyof T) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

const errorsOf = (raw: unknown) => {
  const result = parseQuest(raw);
  return result.ok ? [] : result.errors;
};

describe('QuestSchema', () => {
  it('코드 퀘스트·프로젝트 퀘스트 정상 케이스', () => {
    expect(parseQuest(codeQuest()).ok).toBe(true);
    expect(parseQuest(projectQuest()).ok).toBe(true);
  });

  describe('공개 부분(prompt)에 정답이 섞이면 실패', () => {
    it.each([
      'hints',
      'solution_code',
      'expected_output',
      'is_correct',
      'accepted',
    ])('prompt.%s', (key) => {
      const q = codeQuest();
      const raw = { ...q, prompt: { ...q.prompt, [key]: 'x' } };
      expect(errorsOf(raw)[0]).toBe(
        `prompt.${key}: 정답 필드는 공개 부분(prompt)에 둘 수 없어요. answer 아래로 옮기세요`,
      );
    });

    it('프로젝트 단계의 prompt 에 정답 코드', () => {
      const q = projectQuest();
      q.steps[1].prompt = {
        ...q.steps[1].prompt,
        solution_code: 'print(1)',
      } as unknown as (typeof q.steps)[1]['prompt'];
      expect(errorsOf(q)).toContain(
        'steps[1].prompt.solution_code: 정답 필드는 공개 부분(prompt)에 둘 수 없어요. answer 아래로 옮기세요',
      );
    });

    it('깊이 숨긴 정답 키도 찾음', () => {
      expect(
        findAnswerKeysInPublic({ a: [{ b: { accepted: [1] } }], hints: {} }),
      ).toEqual(['a[0].b.accepted', 'hints']);
    });

    it('모르는 키는 모두 오류 (strict)', () => {
      const q = codeQuest();
      expect(errorsOf({ ...q, prompt: { ...q.prompt, story: 'x' } })).toEqual([
        'prompt: Unrecognized key: "story"',
      ]);
    });
  });

  it('코드 퀘스트는 solution_code 가 필수 (B08 같은 정답 누락을 원본에서 막음)', () => {
    const q = codeQuest();
    const answer = without(q.answer, 'solution_code');
    expect(errorsOf({ ...q, answer })).toEqual([
      'answer.solution_code: Invalid input: expected string, received undefined',
    ]);
  });

  it('프로젝트는 퀘스트 전체 solution_code 없이도 되지만 단계마다 필수', () => {
    const q = projectQuest();
    q.steps[0].answer = without(
      q.steps[0].answer,
      'solution_code',
    ) as (typeof q.steps)[0]['answer'];
    expect(errorsOf(q)).toEqual([
      'steps[0].answer.solution_code: Invalid input: expected string, received undefined',
    ]);
  });

  it('힌트는 3단계 모두 필요', () => {
    const q = codeQuest();
    const raw = {
      ...q,
      answer: { ...q.answer, hints: { level_1: 'a', level_2: 'b' } },
    };
    expect(errorsOf(raw)).toEqual([
      'answer.hints.level_3: Invalid input: expected string, received undefined',
    ]);
  });

  it('단계 번호는 1부터 차례대로', () => {
    const q = projectQuest();
    q.steps[1].step_number = 3;
    expect(errorsOf(q)).toEqual([
      'steps[1].step_number: 단계 번호는 1부터 차례대로 써야 해요 (기대값 2)',
    ]);
  });

  it('id 는 UUID 형식 (기존 b1000000-… 형식 허용)', () => {
    expect(errorsOf({ ...codeQuest(), id: 'quest-1' })[0]).toMatch(
      /^id: UUID 형식/,
    );
  });

  it('quest_type 이 없거나 모르는 값이면 실패 (퀴즈는 P7-01 에서 추가)', () => {
    const noType = without(codeQuest(), 'quest_type');
    expect(errorsOf(noType).length).toBeGreaterThan(0);
    expect(
      errorsOf({ ...codeQuest(), quest_type: 'quiz' }).length,
    ).toBeGreaterThan(0);
  });
});

describe('ValidationRuleSchema', () => {
  const ok = (rule: unknown) => ValidationRuleSchema.safeParse(rule).success;

  it('contains_any · all · code_check whole_word', () => {
    expect(ok({ type: 'contains_any', expected: ['커요', '작아요'] })).toBe(
      true,
    );
    expect(
      ok({
        type: 'all',
        rules: [
          { type: 'code_check', expected: 'guess', whole_word: true },
          { type: 'contains', expected: '추측' },
        ],
      }),
    ).toBe(true);
  });

  it.each([
    ['빈 후보 목록', { type: 'contains_any', expected: [] }],
    ['빈 문자열 후보', { type: 'contains_any', expected: [''] }],
    ['빈 all', { type: 'all', rules: [] }],
    ['all 안의 잘못된 규칙', { type: 'all', rules: [{ type: 'contains' }] }],
    ['빈 기준값', { type: 'output_match', expected: '' }],
    [
      'contains 에 whole_word',
      { type: 'contains', expected: 'x', whole_word: true },
    ],
    ['모르는 유형', { type: 'regex', expected: 'x' }],
  ])('%s → 실패', (_label, rule) => {
    expect(ok(rule)).toBe(false);
  });
});

describe('WorldSchema · StageSchema', () => {
  it('정상', () => {
    expect(
      parseWith(WorldSchema, {
        slug: 'python-island',
        order: 1,
        title: '파이썬 섬',
        theme: 'python_island',
        description: '',
        unlock_rule: { type: 'open' },
      }).ok,
    ).toBe(true);
    expect(
      parseWith(StageSchema, {
        id: 'a1000000-0000-0000-0000-000000000001',
        order: 1,
        title: '파이썬 마을 입구',
        theme_name: 'python_village',
        description: '',
        is_final: false,
      }).ok,
    ).toBe(true);
  });

  it('unlock_rule 은 필수이고 지금은 open 만 (2월드 규칙은 Phase 10)', () => {
    const world = {
      slug: 'python-island',
      order: 1,
      title: '파이썬 섬',
      theme: 'python_island',
      description: '',
    };
    expect(parseWith(WorldSchema, world).ok).toBe(false);
    expect(
      parseWith(WorldSchema, {
        ...world,
        unlock_rule: { type: 'clear_world', world: 'python-island' },
      }).ok,
    ).toBe(false);
  });

  it('slug 는 영문 소문자·숫자·하이픈', () => {
    const result = parseWith(WorldSchema, {
      slug: '파이썬섬',
      order: 1,
      title: '파이썬 섬',
      theme: 'python_island',
      description: '',
    });
    expect(result.ok).toBe(false);
  });
});
