// 2월드 "코드 바다" 새 용어집 (docs/curriculum/world2.md §11, P10-08).
// 튜터 프롬프트(2월드 이상)와 "개념만 알려 줘요" 저장된 답변이 같은 뜻풀이를 쓴다.

export interface GlossaryTerm {
  term: string;
  /** 아이 눈높이 뜻 (한 문장) */
  meaning: string;
  /** 한 줄 예시 코드 */
  example: string;
  /** 퀘스트 주제·목표 글에서 찾을 낱말 (소문자로 비교) */
  match: string[];
}

export const WORLD2_GLOSSARY: readonly GlossaryTerm[] = [
  {
    term: 'f-string',
    meaning:
      '따옴표 앞에 f를 붙이면 { } 안에 변수를 바로 넣을 수 있는 글자예요.',
    example: 'print(f"{name}님 안녕!")',
    match: ['f-string', 'f문자열', 'f 문자열'],
  },
  {
    term: '인덱스',
    meaning: '글자나 리스트의 자리 번호예요. 0부터 세고, -1은 맨 끝이에요.',
    example: 'word[0]  # 첫 글자, word[-1]  # 끝 글자',
    match: ['인덱스', '자리 번호', '음수'],
  },
  {
    term: '슬라이싱',
    meaning: '[시작:끝]으로 잘라 내기예요. 끝 번호 자리는 안 들어가요.',
    example: '"python"[0:2]  # "py"',
    match: ['슬라이싱', '자르기', '잘라'],
  },
  {
    term: '메서드',
    meaning: '값 뒤에 점(.)을 찍고 부르는 그 값 전용 함수예요.',
    example: '"hi".upper()  # "HI"',
    match: ['메서드', '.upper', '.lower', '.replace', '.count', '.find'],
  },
  {
    term: 'split / join',
    meaning:
      '글자를 기준 글자로 쪼개 리스트로 / 리스트를 글자로 이어 붙이기예요.',
    example: '"a b".split()  # ["a", "b"]',
    match: ['split', 'join', '쪼개'],
  },
  {
    term: '% 돌아가기',
    meaning: '나머지(%)를 쓰면 끝까지 갔을 때 처음으로 돌아올 수 있어요.',
    example: '(25 + 1) % 26  # 0',
    match: ['암호', '나머지', '돌아가'],
  },
  {
    term: '딕셔너리',
    meaning: '이름표(키)가 붙은 상자 모음이에요. {키: 값}으로 써요.',
    example: 'pet = {"이름": "콩이", "나이": 3}',
    match: ['딕셔너리', 'dict', '사전'],
  },
  {
    term: '키 / 값',
    meaning: '키는 상자의 이름표, 값은 상자 안 내용이에요.',
    example: 'pet["이름"]  # "콩이"',
    match: ['키와 값', '키/값', '이름표'],
  },
  {
    term: '.get',
    meaning: '이름표가 없어도 멈추지 않고 대신 값을 주는 꺼내기예요.',
    example: 'pet.get("색", "몰라요")',
    match: ['.get', 'get('],
  },
  {
    term: '.items()',
    meaning: '이름표와 내용을 한 쌍씩 꺼내며 돌아요.',
    example: 'for k, v in pet.items(): print(k, v)',
    match: ['.items', 'items('],
  },
  {
    term: '중첩 반복',
    meaning:
      '반복 안에 또 반복이에요. 바깥이 한 번 돌 때 안쪽은 끝까지 다 돌아요.',
    example: 'for i in range(2):\n    for j in range(3): ...',
    match: ['중첩', '반복 안에', '구구단', '격자'],
  },
  {
    term: '2차원 리스트',
    meaning: '리스트 안에 리스트예요. grid[줄][칸]으로 꺼내요.',
    example: 'grid = [[1, 2], [3, 4]]; grid[1][0]  # 3',
    match: ['2차원', '이차원', 'grid'],
  },
  {
    term: '좌표',
    meaning: '몇째 줄 몇째 칸인지 알려 주는 두 번호예요.',
    example: 'grid[2][3]  # 2번 줄 3번 칸',
    match: ['좌표'],
  },
  {
    term: '모듈 / import',
    meaning:
      '모듈은 누가 만들어 둔 도구 상자, import는 그 상자를 가져오기예요.',
    example: 'import math\nprint(math.sqrt(16))',
    match: ['모듈', 'import', 'math'],
  },
  {
    term: '난수 (랜덤)',
    meaning: '미리 알 수 없게 고른 수예요.',
    example: 'random.randint(1, 6)  # 주사위',
    match: ['난수', '랜덤', 'random', '무작위'],
  },
  {
    term: '시뮬레이션',
    meaning: '많이 해 보는 것을 컴퓨터로 대신 해 보기예요.',
    example: 'for _ in range(100): flips.append(random.randint(0, 1))',
    match: ['시뮬레이션'],
  },
  {
    term: '에러 메시지 (트레이스백)',
    meaning:
      '파이썬이 멈추며 남기는 쪽지예요. 맨 아래 줄이 에러 이름, line이 줄 번호예요.',
    example: "NameError: name 'scor' is not defined",
    match: ['에러', '오류', '트레이스백', 'traceback'],
  },
  {
    term: '에러 이름 7종',
    meaning:
      'SyntaxError 문법 · NameError 없는 이름 · TypeError 섞을 수 없는 종류 · IndexError 없는 번호 · KeyError 없는 이름표 · ValueError 바꿀 수 없는 값 · ZeroDivisionError 0으로 나누기예요.',
    example: '[1, 2][5]  # IndexError',
    match: ['에러 이름', 'error'],
  },
  {
    term: 'try / except',
    meaning: '일단 해 보고, 에러가 나면 멈추지 말고 except 쪽으로 가요.',
    example: 'try:\n    n = int("a")\nexcept ValueError:\n    n = 0',
    match: ['try', 'except', '예외'],
  },
  {
    term: '디버깅',
    meaning: '버그를 찾아 고치는 일이에요. print로 중간 값을 들여다봐요.',
    example: 'print("지금 total:", total)',
    match: ['디버깅', '디버그'],
  },
  {
    term: '알고리즘',
    meaning: '문제를 푸는 순서를 차근차근 적은 것이에요.',
    example: '1) 하나씩 본다 2) 더 크면 바꾼다 3) 끝까지 간다',
    match: ['알고리즘'],
  },
  {
    term: '최댓값 찾기',
    meaning: '첫 값을 대장으로 두고, 더 큰 값이 오면 대장을 바꿔요.',
    example: 'if n > best: best = n',
    match: ['최댓값', '최솟값', '가장 큰', '가장 작은'],
  },
  {
    term: '검색',
    meaning: '차례로 열어 보며 찾거나, 반씩 줄여 가며 찾아요.',
    example: 'for i, x in enumerate(nums):\n    if x == 7: print(i)',
    match: ['검색', '탐색'],
  },
  {
    term: '정렬',
    meaning: '작은 것부터(또는 큰 것부터) 줄 세우기예요.',
    example: 'if a[0] > a[1]: a[0], a[1] = a[1], a[0]',
    match: ['정렬', 'sort'],
  },
];

/** 퀘스트 글(주제·목표 등)에 나오는 2월드 용어. 용어집 순서대로 최대 max개 */
export function findGlossaryTerms(text: string, max = 4): GlossaryTerm[] {
  const t = text.toLowerCase();
  return WORLD2_GLOSSARY.filter((g) =>
    g.match.some((m) => t.includes(m.toLowerCase())),
  ).slice(0, max);
}

/**
 * 월드 수준 안내 (프롬프트의 "## 지시" 앞에 끼움). 1월드(또는 모름)는 빈 문자열이라 프롬프트가 예전과 똑같다.
 * worldOrder 는 서버가 퀘스트 → 스테이지 → 월드에서 읽은 값만 넘긴다 (클라이언트 값 금지).
 */
export function buildLevelSection(
  worldOrder: number | undefined,
  questText: string,
): string {
  if (!worldOrder || worldOrder < 2) return '';
  const terms = findGlossaryTerms(questText);
  const glossary = terms.length
    ? `\n- 이번 퀘스트 용어 (이 뜻풀이와 같은 말로 설명하세요):\n${terms
        .map((g) => `  - ${g.term}: ${g.meaning}`)
        .join('\n')}`
    : '';
  return `## 학생 수준
- 학생은 ${worldOrder}월드에 있어요. 1월드(print·변수·조건·반복·리스트·함수)는 이미 끝냈어요.
- 기초는 다시 길게 풀지 말고 한 걸음 더 깊게 설명하세요: 인덱스 범위(0부터, 끝 번호 제외), 딕셔너리의 키와 값, 바깥·안쪽 반복이 도는 순서, 에러 이름과 try/except, import로 가져온 모듈을 필요하면 짚어도 돼요.
- 그래도 초등학생 눈높이의 쉬운 말과 바다 여행 비유를 쓰세요.${glossary}

`;
}

/** "개념만 알려 줘요" 저장된 답변에 붙일 용어 풀이 (2월드 이상만) */
export function glossaryFallbackLines(
  worldOrder: number | undefined,
  questText: string,
): string[] {
  if (!worldOrder || worldOrder < 2) return [];
  const terms = findGlossaryTerms(questText);
  if (!terms.length) return [];
  return [
    '',
    '알아 두면 좋은 말:',
    ...terms.map(
      (g) => `- **${g.term}**: ${g.meaning} 예: \`${firstLine(g.example)}\``,
    ),
  ];
}

function firstLine(s: string): string {
  return s.split('\n')[0];
}
