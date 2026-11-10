import { describe, expect, it } from 'vitest';

import {
  findAnswerKeysInPublic,
  parseQuest,
  parseWith,
  StageSchema,
  ValidationRuleSchema,
  WorldSchema,
} from '../schema';
import {
  bugHuntQuiz,
  codeQuest,
  fillBlankQuiz,
  multipleChoiceQuiz,
  parsonsQuiz,
  projectQuest,
} from './fixtures';

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

  it('quest_type 이 없거나 모르는 값이면 실패 (퀴즈는 quiz_kind 가 있어야 함)', () => {
    const noType = without(codeQuest(), 'quest_type');
    expect(errorsOf(noType).length).toBeGreaterThan(0);
    expect(
      errorsOf({ ...codeQuest(), quest_type: 'quiz' }).length,
    ).toBeGreaterThan(0);
  });
});

describe('QuizQuestSchema (P7-01)', () => {
  it.each([
    ['multiple_choice', multipleChoiceQuiz],
    ['fill_blank', fillBlankQuiz],
    ['parsons', parsonsQuiz],
    ['bug_hunt', bugHuntQuiz],
  ])('%s 정상', (_kind, make) => {
    expect(errorsOf(make())).toEqual([]);
  });

  it('parsons 들여쓰기 없이 (줄 id 배열), 바꿔도 되는 줄은 accepted 여럿', () => {
    const q = parsonsQuiz();
    const raw = {
      ...q,
      prompt: { ...q.prompt, quiz: { ...q.prompt.quiz, indent: undefined } },
      answer: {
        quiz_answer: {
          ...q.answer.quiz_answer,
          accepted: [
            ['ln-q8wd', 'ln-a3ke', 'ln-m2xa', 'ln-f5tb'],
            ['ln-a3ke', 'ln-q8wd', 'ln-m2xa', 'ln-f5tb'],
          ],
        },
      },
    };
    delete raw.prompt.quiz.indent;
    expect(errorsOf(raw)).toEqual([]);
  });

  it('공개 부분에 accepted·is_correct 를 두면 실패', () => {
    const q = multipleChoiceQuiz();
    const options = [{ ...q.prompt.quiz.options[0], is_correct: true }];
    const raw = {
      ...q,
      prompt: {
        ...q.prompt,
        quiz: { ...q.prompt.quiz, options, accepted: [] },
      },
    };
    expect(errorsOf(raw).slice(0, 2)).toEqual([
      'prompt.quiz.options[0].is_correct: 정답 필드는 공개 부분(prompt)에 둘 수 없어요. answer 아래로 옮기세요',
      'prompt.quiz.accepted: 정답 필드는 공개 부분(prompt)에 둘 수 없어요. answer 아래로 옮기세요',
    ]);
  });

  it('퀴즈에는 hints·solution_code·validation 이 없음 (strict)', () => {
    const q = multipleChoiceQuiz();
    const raw = { ...q, answer: { ...q.answer, solution_code: 'x' } };
    expect(errorsOf(raw)).toEqual([
      'answer: Unrecognized key: "solution_code"',
    ]);
  });

  describe('1. id 참조', () => {
    it('없는 보기 id', () => {
      const q = multipleChoiceQuiz();
      q.answer.quiz_answer.accepted = ['opt-zz99'];
      expect(errorsOf(q)).toContain(
        "answer.quiz_answer.accepted[0]: 'opt-zz99'는 없는 보기 id 예요",
      );
    });

    it('보기를 모두 정답으로 하면 실패', () => {
      const q = multipleChoiceQuiz();
      q.answer.quiz_answer.accepted = ['opt-k7qz', 'opt-b2mx', 'opt-w9fa'];
      expect(errorsOf(q)).toEqual([
        'answer.quiz_answer.accepted: 틀린 보기가 하나는 있어야 해요',
      ]);
    });

    it('해설 id 도 있어야 함, id 는 퀴즈 안에서 유일', () => {
      const q = multipleChoiceQuiz();
      (q.answer.quiz_answer.explanations as Record<string, string>) = {
        'opt-zz99': 'x',
      };
      q.prompt.quiz.options[2].id = 'opt-k7qz';
      expect(errorsOf(q)).toEqual([
        "prompt.quiz.options[2].id: id 'opt-k7qz'가 이 퀴즈 안에서 겹쳐요",
        "answer.quiz_answer.explanations.opt-zz99: 'opt-zz99'는 없는 보기·줄·수정안 id 예요",
      ]);
    });

    it('fill_blank: 모든 빈칸을 있는 토큰으로', () => {
      const q = fillBlankQuiz();
      q.answer.quiz_answer.accepted = [
        { 'bk-r2fa': 'tok-zz99' } as (typeof q.answer.quiz_answer.accepted)[0],
      ];
      expect(errorsOf(q)).toEqual([
        'answer.quiz_answer.accepted[0]: 모든 빈칸(bk-r2fa, bk-m8ce)을 한 번씩 채워야 해요',
        "answer.quiz_answer.accepted[0].bk-r2fa: 'tok-zz99'는 없는 토큰 id 예요",
      ]);
    });

    it('fill_blank: 빈칸이 없으면 실패', () => {
      const q = fillBlankQuiz();
      q.prompt.quiz.code = 'for i in range(3):';
      expect(errorsOf(q)).toContain(
        'prompt.quiz.code: 빈칸({{bk-r2fa}})이 하나는 있어야 해요',
      );
    });

    it('parsons: 모든 줄을 한 번씩, indent 모양', () => {
      const q = parsonsQuiz();
      const raw = {
        ...q,
        answer: {
          quiz_answer: {
            ...q.answer.quiz_answer,
            accepted: [['ln-q8wd', 'ln-a3ke', 'ln-m2xa']],
          },
        },
      };
      expect(errorsOf(raw)).toEqual([
        'answer.quiz_answer.accepted[0]: indent: true 면 {id, indent} 로 써요',
        'answer.quiz_answer.accepted[0]: 모든 줄을 한 번씩 써야 해요',
      ]);
    });

    it('parsons: indent 면 줄 앞 공백 금지', () => {
      const q = parsonsQuiz();
      q.prompt.quiz.lines[2].code = '    total = total + i';
      expect(errorsOf(q)).toEqual([
        'prompt.quiz.lines[2].code: indent: true 면 줄 앞에 공백을 쓰지 않아요 (들여쓰기는 정답에)',
      ]);
    });

    it('bug_hunt: 줄·수정안 id', () => {
      const q = bugHuntQuiz();
      q.answer.quiz_answer.accepted = [{ line: 'fx-b7nd', fix: 'ln-x5pc' }];
      expect(errorsOf(q)).toEqual([
        "answer.quiz_answer.accepted[0].line: 'fx-b7nd'는 없는 줄 id 예요",
        "answer.quiz_answer.accepted[0].fix: 'ln-x5pc'는 없는 수정안 id 예요",
      ]);
    });

    it('같은 정답 두 번 (키 순서만 달라도)', () => {
      const q = fillBlankQuiz();
      q.answer.quiz_answer.accepted.push({
        'bk-r2fa': 'tok-m4xe',
        'bk-m8ce': 'tok-c3pd',
      });
      expect(errorsOf(q)).toEqual([
        'answer.quiz_answer.accepted[1]: 같은 정답이 두 번 있어요',
      ]);
    });
  });

  describe('2. 차례가 보이는 id', () => {
    it.each(['a', 'opt-a', 'l1', 'ln-0001', 'opt-abcd', 'OPT-K7QZ', 'k7qz'])(
      '%s → 실패',
      (id) => {
        const q = multipleChoiceQuiz();
        q.prompt.quiz.options[1].id = id;
        expect(errorsOf(q)[0]).toMatch(
          /^prompt\.quiz\.options\[1\]\.id: id 는/,
        );
      },
    );

    it('parsons 줄 id 를 정렬한 차례가 정답 차례면 실패', () => {
      const q = parsonsQuiz();
      const ids = ['ln-a1aa', 'ln-b1bb', 'ln-c1cc', 'ln-d1dd'];
      q.prompt.quiz.lines.forEach((l, i) => (l.id = ids[i]));
      q.answer.quiz_answer.accepted[0].forEach((x, i) => (x.id = ids[i]));
      expect(errorsOf(q)).toEqual([
        'answer.quiz_answer.accepted[0]: 줄 id 를 정렬한 차례가 정답 차례와 같아요. 화면에 정답 순서로 나오니 id 를 바꿔요',
      ]);
    });
  });

  describe('3. 공개 문장에 정답 (§12-Q20)', () => {
    it('객관식: fallback_text 에 정답 보기 글자', () => {
      const q = multipleChoiceQuiz();
      q.prompt.fallback_text = '답은 0 1 2 예요';
      expect(errorsOf(q)).toEqual([
        "prompt.fallback_text: 정답 '0 1 2'이 공개 문장에 그대로 있어요. 퀴즈는 공개 필드에 정답을 쓰지 않아요 (§12-Q20)",
      ]);
    });

    it('객관식: 오답 보기도 함께 나오면 정답을 짚은 게 아님 (오탐 방지)', () => {
      const q = multipleChoiceQuiz();
      q.prompt.quiz.question = '0 1 2 일까요, 1 2 3 일까요?';
      expect(errorsOf(q)).toEqual([]);
    });

    it('객관식: 낱말 한가운데·한 글자는 무시 (오탐 방지)', () => {
      const q = multipleChoiceQuiz();
      q.prompt.quiz.options[0].text = '12';
      q.prompt.story_context = '1234 번째 모험';
      expect(errorsOf(q)).toEqual([]);
    });

    it('fill_blank: 문제 문장에 채운 줄', () => {
      const q = fillBlankQuiz();
      q.prompt.quiz.question = 'for i in range(3): 처럼 써 봐요';
      expect(errorsOf(q)).toEqual([
        "prompt.quiz.question: 정답 'for i in range(3):'이 공개 문장에 그대로 있어요. 퀴즈는 공개 필드에 정답을 쓰지 않아요 (§12-Q20)",
      ]);
    });

    it('parsons: 이어지는 두 줄', () => {
      const q = parsonsQuiz();
      q.prompt.fallback_text = 'total = 0\nfor i in range(1, 4): 로 시작해요';
      expect(errorsOf(q)[0]).toMatch(
        /^prompt\.fallback_text: 정답 'total = 0 for i/,
      );
    });

    it('bug_hunt: 학습 목표에 고친 줄', () => {
      const q = bugHuntQuiz();
      q.prompt.learning_goals = ['for i in range(3): 를 쓸 수 있다'];
      expect(errorsOf(q)).toEqual([
        "prompt.learning_goals[0]: 정답 'for i in range(3):'이 공개 문장에 그대로 있어요. 퀴즈는 공개 필드에 정답을 쓰지 않아요 (§12-Q20)",
      ]);
    });
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
