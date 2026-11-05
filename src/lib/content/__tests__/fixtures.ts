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
  prompt: {
    ...codeQuest().prompt,
    starter_code: 'import random\n',
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
