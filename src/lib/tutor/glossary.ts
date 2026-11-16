// 2월드 "코드 바다" 새 용어집 (docs/curriculum/world2.md §11, P10-08) + 3월드 "메이커 시티" (world3.md §15, P11-14).
// 튜터 프롬프트(2월드 이상)와 "개념만 알려 줘요" 저장된 답변이 같은 뜻풀이를 쓴다. 3월드는 3월드 용어를 먼저 찾고 2월드 용어도 씀

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

/** 3월드 "메이커 시티" 용어 (world3.md §15). 이름이 2월드와 같으면(좌표·메서드) 3월드 뜻이 이김 */
export const WORLD3_GLOSSARY: readonly GlossaryTerm[] = [
  {
    term: 'turtle (거북이 그래픽)',
    meaning: '명령을 들으면 움직이며 선을 긋는 거북이예요.',
    example: 't = turtle.Turtle()\nt.forward(100)',
    match: ['turtle', '거북이', 't.forward', '그리기', '그림'],
  },
  {
    term: '각도',
    meaning: '얼마나 도는지예요. 한 바퀴를 다 돌면 360이에요.',
    example: 't.left(360 / 4)  # 네모는 90도씩',
    match: ['각도', '360', 'left(', 'right(', '정다각형'],
  },
  {
    term: '좌표',
    meaning:
      '가로 x, 세로 y로 자리를 말해요. 가운데가 (0, 0), 왼쪽·아래는 빼기예요.',
    example: 't.goto(-100, 50)',
    match: ['좌표', 'goto', '(x, y)', '위치'],
  },
  {
    term: '채우기',
    meaning: 'begin_fill과 end_fill 사이에 그린 모양 안을 색칠해요.',
    example: 't.begin_fill()\n...\nt.end_fill()',
    match: ['채우기', '채운', 'fill', '색칠'],
  },
  {
    term: 'input()',
    meaning: '프로그램이 묻고, 사람이 친 글자를 받아 와요.',
    example: 'name = input("별명은? ")',
    match: ['input', '입력', '묻'],
  },
  {
    term: '입력은 글자',
    meaning: 'input으로 받은 것은 늘 글자라서 숫자로 쓰려면 int()로 바꿔요.',
    example: 'n = int(input("몇 개? "))',
    match: ['int(', '숫자로 바꾸', '글자', '입력은'],
  },
  {
    term: '다시 묻기',
    meaning: '이상한 답이면 while로 맞는 답이 올 때까지 다시 물어요.',
    example: 'while door != "1":\n    door = input("1번? ")',
    match: ['다시 묻', '다시 물', 'while'],
  },
  {
    term: '.strip()',
    meaning: '글자 앞뒤의 빈칸을 지워요.',
    example: '"  고래 ".strip()  # "고래"',
    match: ['.strip', 'strip(', '빈칸'],
  },
  {
    term: '문제 은행',
    meaning: '문제와 답을 모아 둔 리스트예요.',
    example: 'bank = [{"q": "1 + 1?", "a": "2"}]',
    match: ['문제 은행', '퀴즈쇼', '점수'],
  },
  {
    term: '클래스 (설계도)',
    meaning: '같은 모양의 물건을 여러 개 찍어 내는 틀이에요.',
    example: 'class Pet:\n    ...',
    match: ['class', '클래스', '설계도'],
  },
  {
    term: '객체',
    meaning: '설계도로 만든 물건 하나예요. 펫 한 마리처럼요.',
    example: 'kong = Pet("콩이")',
    match: ['객체', '두 마리', '펫'],
  },
  {
    term: 'self',
    meaning: '"나 자신"이에요. 펫이 자기 배고픔을 가리킬 때 써요.',
    example: 'self.hunger = 50',
    match: ['self', '__init__'],
  },
  {
    term: '메서드',
    meaning: '설계도 안의 함수예요. 그 물건이 할 수 있는 행동이에요.',
    example: 'def feed(self):\n    self.hunger -= 30',
    match: ['메서드', 'def feed', '행동'],
  },
  {
    term: '평균',
    meaning: '모두 더해 똑같이 나눈 값이에요.',
    example: 'statistics.mean([3, 5, 4])  # 4',
    match: ['평균', 'mean', 'statistics'],
  },
  {
    term: '가운데 값 (중앙값)',
    meaning: '줄 세웠을 때 한가운데 있는 값이에요.',
    example: 'statistics.median([7, 2, 9])  # 7',
    match: ['중앙값', '가운데 값', 'median'],
  },
  {
    term: '막대그래프',
    meaning: '수를 막대 길이로 보여 주는 그림이에요.',
    example: 'draw_bar(x, votes * 10)',
    match: ['막대', '그래프', '설문'],
  },
  {
    term: '게임 루프 / 프레임',
    meaning:
      '게임 화면을 아주 빨리 여러 번 다시 그리는 반복이에요. 그 한 번이 프레임이에요.',
    example: 'for frame in range(900):\n    ...\n    time.sleep(1 / 30)',
    match: ['게임 루프', '프레임', 'time.sleep', 'sleep', '게임'],
  },
  {
    term: '키 입력 (get_key)',
    meaning: '지금 누른 키를 알아 와요. 아무것도 안 눌렀으면 None이에요.',
    example: 'key = get_key()\nif key == "Right": ...',
    match: ['get_key', '키 입력', '화살표', '키로'],
  },
  {
    term: '충돌',
    meaning: '두 거북이가 닿았는지예요. 거리가 아주 가까우면 닿은 거예요.',
    example: 'if a.distance(b) < 20: ...',
    match: ['충돌', 'distance', '닿았', '잡기'],
  },
  {
    term: '기획',
    meaning: '무엇을 만들지, 어떤 기능부터 할지 정하는 일이에요.',
    example: 'features = ["선 긋기", "별 찍기", "이름 쓰기"]',
    match: ['기획', '나만의 작품', '자유 프로젝트'],
  },
  {
    term: '피드백',
    meaning: '작품을 보고 해 주는 칭찬과 제안이에요.',
    example: '잘한 점 2개 + 한 걸음 더 1개',
    match: ['피드백', '평가', '크레딧'],
  },
];

const W3_TERMS = new Set(WORLD3_GLOSSARY.map((g) => g.term));
/** 3월드 이상: 3월드 용어 먼저, 그다음 이름이 겹치지 않는 2월드 용어 */
const WORLD3_PLUS: readonly GlossaryTerm[] = [
  ...WORLD3_GLOSSARY,
  ...WORLD2_GLOSSARY.filter((g) => !W3_TERMS.has(g.term)),
];

/** 퀘스트 글(주제·목표 등)에 나오는 용어. 2월드는 2월드 용어집, 3월드 이상은 3월드 먼저. 용어집 순서대로 최대 max개 */
export function findGlossaryTerms(
  text: string,
  max = 4,
  worldOrder = 2,
): GlossaryTerm[] {
  const t = text.toLowerCase();
  return (worldOrder >= 3 ? WORLD3_PLUS : WORLD2_GLOSSARY)
    .filter((g) => g.match.some((m) => t.includes(m.toLowerCase())))
    .slice(0, max);
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
  const terms = findGlossaryTerms(questText, 4, worldOrder);
  const glossary = terms.length
    ? `\n- 이번 퀘스트 용어 (이 뜻풀이와 같은 말로 설명하세요):\n${terms
        .map((g) => `  - ${g.term}: ${g.meaning}`)
        .join('\n')}`
    : '';
  if (worldOrder >= 3)
    return `## 학생 수준
- 학생은 ${worldOrder}월드 "메이커 시티"에 있어요. 1월드(print·변수·조건·반복·리스트·함수)와 2월드(문자열·딕셔너리·중첩 반복·모듈·에러와 try/except·알고리즘)는 이미 끝냈어요.
- 지금은 사람이 쓰고 보고 노는 작품을 만드는 단계예요. 필요하면 turtle 좌표(가운데 0, 0)와 각도(한 바퀴 360), input()으로 받은 값은 늘 글자라 int()로 바꾸기, class·self·메서드, 게임 루프와 프레임·get_key()를 짚어도 돼요.
- 상속·lambda·파일 읽기/쓰기·인터넷·소리·마우스 클릭은 아직 배우지 않았어요. 이런 것을 쓰라고 하지 마세요.
- 그래도 초등학생 눈높이의 쉬운 말과 도시 작업실(공방·극장·오락실) 비유를 쓰세요.${glossary}

`;
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
  const terms = findGlossaryTerms(questText, 4, worldOrder);
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
