// 테스트용 콘텐츠 원본 (YAML 을 읽은 뒤의 값과 같은 모양)

export const codeQuest = () => ({
  id: 'b1000000-0000-0000-0000-000000000001',
  order: 1,
  title: '첫 번째 인사',
  concept: 'print()',
  xp_reward: 50,
  quest_type: 'code' as const,
  prompt: {
    topic: 'print() 함수로 출력하기',
    learning_goals: ['print() 함수를 사용할 수 있다'],
    story_context: '파이썬 마을에 도착한 모험가',
    exercise_description: '"안녕하세요!"를 출력해보세요',
    starter_code: '# 아래에 코드를 작성해보세요!\n',
    expected_output_hint: '안녕하세요! 가 출력되어야 해요',
    checklist: ['print( )를 써요', '따옴표 안에 인사를 넣어요'],
    example_output: '안녕하세요!',
    fallback_text: 'print("안녕하세요!") 이렇게 쓰면 돼요.',
  },
  answer: {
    validation: { type: 'output_match' as const, expected: '안녕하세요!' },
    hints: {
      level_1: '마법 주문이 있어요',
      level_2: 'print() 안에 따옴표',
      level_3: 'print("___")',
    },
    solution_code: 'print("안녕하세요!")',
  },
});

export const projectQuest = () => ({
  id: 'b1000000-0000-0000-0000-000000000022',
  order: 1,
  title: '숫자 맞추기 게임',
  concept: '종합 프로젝트',
  xp_reward: 200,
  quest_type: 'project' as const,
  // 프로젝트는 해 볼 일·예시 출력을 단계마다 씀 (P7-17)
  prompt: {
    topic: '숫자 맞추기',
    learning_goals: ['배운 것을 모아 게임을 만들 수 있다'],
    story_context: '프로젝트 왕국에 도착한 모험가',
    exercise_description: '5단계로 게임을 완성해요',
    starter_code: 'import random\n',
    expected_output_hint: '프로젝트를 단계로 나누어 완성해요',
    fallback_text: '한 단계씩 해 봐요.',
  },
  answer: {
    validation: { type: 'contains' as const, expected: '번 만에 맞췄어요' },
    hints: { level_1: '5단계', level_2: 'random', level_3: '힌트를 활용' },
  },
  steps: [
    {
      step_number: 1,
      prompt: {
        step_goal: '비밀 숫자 만들기',
        checklist: ['randint 로 비밀 숫자를 만들어요'],
        example_output: '7',
        starter_code: 'import random\n',
        fallback_text: 'random.randint(1, 10)',
      },
      answer: {
        validation: { type: 'code_check' as const, expected: 'random.randint' },
        hints: {
          level_1: 'a',
          level_2: 'b',
          level_3: 'secret = random.___(1, 10)',
        },
        solution_code:
          'import random\nsecret = random.randint(1, 10)\nprint(secret)',
      },
    },
    {
      step_number: 2,
      prompt: {
        step_goal: '비교하기',
        checklist: ['if·elif·else 로 견줘요'],
        example_output: '비밀 숫자가 더 커요!',
        starter_code: '',
        fallback_text: 'if/elif/else',
      },
      answer: {
        validation: {
          type: 'all' as const,
          rules: [
            { type: 'code_check' as const, expected: 'elif' },
            {
              type: 'contains_any' as const,
              expected: ['커요', '작아요', '정답'],
            },
          ],
        },
        hints: { level_1: 'a', level_2: 'b', level_3: 'c' },
        solution_code:
          'SECRET_STEP2_SOLUTION = 1\nif x:\n    pass\nelif y:\n    print("정답")',
      },
    },
  ],
});

// 퀴즈 4종 (P7-01). 실제 퀴즈 콘텐츠는 P7-12
const quizBase = (n: number) => ({
  id: `b1000000-0000-0000-0000-00000000009${n}`,
  order: n + 1,
  title: '퀴즈',
  concept: 'for 반복문',
  xp_reward: 30,
  quest_type: 'quiz' as const,
});
const quizPrompt = {
  topic: '반복문 복습',
  learning_goals: ['반복문을 읽을 수 있다'],
  story_context: '파이뱀이 문제를 냈어요',
  fallback_text: '반복문은 같은 일을 여러 번 해요.',
};

export const multipleChoiceQuiz = () => ({
  ...quizBase(1),
  quiz_kind: 'multiple_choice' as const,
  prompt: {
    ...quizPrompt,
    quiz: {
      question: '이 코드를 돌리면 무엇이 나올까?',
      code: 'for i in range(3):\n    print(i)',
      options: [
        { id: 'opt-k7qz', text: '0 1 2' },
        { id: 'opt-b2mx', text: '1 2 3' },
        { id: 'opt-w9fa', text: '0 1 2 3' },
      ],
    },
  },
  answer: {
    quiz_answer: {
      accepted: ['opt-k7qz'],
      explanation: 'range(3)은 0부터 2까지예요.',
      explanations: { 'opt-b2mx': '0부터 세요.' },
    },
  },
});

export const fillBlankQuiz = () => ({
  ...quizBase(2),
  quiz_kind: 'fill_blank' as const,
  prompt: {
    ...quizPrompt,
    quiz: {
      question: '빈칸을 채워 0부터 2까지 출력해요',
      code: 'for i in {{bk-r2fa}}(3):\n    {{bk-m8ce}}(i)',
      tokens: [
        { id: 'tok-m4xe', text: 'range' },
        { id: 'tok-c3pd', text: 'print' },
        { id: 'tok-z6nh', text: 'input' },
      ],
    },
  },
  answer: {
    quiz_answer: {
      accepted: [{ 'bk-m8ce': 'tok-c3pd', 'bk-r2fa': 'tok-m4xe' }],
      explanation: 'range 로 숫자를 만들고 print 로 보여 줘요.',
    },
  },
});

export const parsonsQuiz = () => ({
  ...quizBase(3),
  quiz_kind: 'parsons' as const,
  prompt: {
    ...quizPrompt,
    quiz: {
      question: '줄을 순서대로 놓아 1부터 3까지 더해요',
      indent: true,
      lines: [
        { id: 'ln-q8wd', code: 'total = 0' },
        { id: 'ln-a3ke', code: 'for i in range(1, 4):' },
        { id: 'ln-m2xa', code: 'total = total + i' },
        { id: 'ln-f5tb', code: 'print(total)' },
      ],
    },
  },
  answer: {
    quiz_answer: {
      accepted: [
        [
          { id: 'ln-q8wd', indent: 0 },
          { id: 'ln-a3ke', indent: 0 },
          { id: 'ln-m2xa', indent: 1 },
          { id: 'ln-f5tb', indent: 0 },
        ],
      ],
      explanation: '먼저 0으로 시작하고, 반복하며 더한 뒤 출력해요.',
    },
  },
});

export const bugHuntQuiz = () => ({
  ...quizBase(4),
  quiz_kind: 'bug_hunt' as const,
  prompt: {
    ...quizPrompt,
    quiz: {
      question: '틀린 줄을 찾아 고쳐요',
      lines: [
        { id: 'ln-x5pc', code: 'for i in range(3)' },
        { id: 'ln-h7jq', code: '    print(i)' },
      ],
      fixes: [
        { id: 'fx-b7nd', code: 'for i in range(3):' },
        { id: 'fx-e4kr', code: 'for i in range[3]' },
      ],
    },
  },
  answer: {
    quiz_answer: {
      accepted: [{ line: 'ln-x5pc', fix: 'fx-b7nd' }],
      explanation: 'for 줄 끝에는 쌍점(:)이 있어야 해요.',
    },
  },
});
