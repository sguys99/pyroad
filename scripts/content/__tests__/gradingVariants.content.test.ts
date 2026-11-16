// 맞는 답을 다르게 쓴 코드도 채점을 통과하는지 실제 Pyodide 로 확인한다 (P10-09, `npm run test:content`)
//
// ① 모든 코드 퀘스트·프로젝트 단계의 정답을 기계적으로 바꾼 모양 (뜻은 같음)
//    탭 들여쓰기 · 2칸 들여쓰기 · 기호 옆 띄어쓰기 없앰(`book["x"]="y"`, `x%26`) · 빈 줄 추가 · 작은따옴표
// ② 아이들이 실제로 쓸 만한 다른 정답 (아래 HANDWRITTEN, 퀘스트 키 → 코드 또는 정답 고쳐 쓰기)
// ③ 틀린 코드는 떨어짐 (아래 WRONG — 규칙이 너무 넓어 통과하던 것, P10-10 플레이테스트 L1~L4)
// 각 모양을 시드 0(입력 시나리오마다)으로 실행해 정답과 같은 규칙(프로젝트 마지막 단계는 퀘스트 전체 규칙도)으로 채점한다.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXECUTION_TIMEOUT_MS } from '@/lib/pyodide/constants';
import { blankCommentsAndStrings } from '@/lib/quest/validation';

import { NodePyodideRunner } from '../../pyodide/nodeRunner';
import { CONTENT_DIR } from '../lib/paths';
import {
  judge,
  loadUnits,
  planRuns,
  ruleSummary,
  type CheckUnit,
} from '../lib/solutionCheck';

const IDENT = /[\p{L}\p{N}_]/u;
const isIdent = (c: string | undefined) => !!c && IDENT.test(c);

/** 위치마다 코드인지(문자열·주석 내용이 아닌지). 공백도 구분하려고 잠시 다른 글자로 바꿔 지워 본다 */
function codeMask(code: string): boolean[] {
  const marked = code.replace(/ /g, '\u0001');
  const blanked = blankCommentsAndStrings(marked);
  return Array.from(
    { length: code.length },
    (_, i) => blanked[i] === marked[i],
  );
}

/** 문자열 밖 줄의 처음 4칸 묶음을 `unit` 으로 */
function reindent(code: string, unit: string): string {
  const mask = codeMask(code);
  return code.replace(/^(?: {4})+/gm, (run, at: number) =>
    mask[at] ? unit.repeat(run.length / 4) : run,
  );
}

/** 문자열 밖에서 기호 옆 띄어쓰기를 지움 (들여쓰기·낱말 사이는 둠) */
function squeeze(code: string): string {
  const mask = codeMask(code);
  return code.replace(/ +/g, (run, at: number) => {
    const before = code[at - 1];
    if (!mask[at] || before === undefined || before === '\n') return run;
    return isIdent(before) && isIdent(code[at + run.length]) ? run : '';
  });
}

/** 문자열 밖 줄마다 앞에 빈 줄 */
function spaced(code: string): string {
  const mask = codeMask(code);
  return code.replace(/^(?=[^\n])/gm, (_, at: number) =>
    mask[at] ? '\n' : '',
  );
}

const VARIANTS: [string, (code: string) => string | null][] = [
  ['탭 들여쓰기', (c) => reindent(c, '\t')],
  ['2칸 들여쓰기', (c) => reindent(c, '  ')],
  ['기호 옆 띄어쓰기 없음', squeeze],
  ['빈 줄 추가', spaced],
  // 작은따옴표가 이미 있으면 바꾸면 뜻이 달라질 수 있어 건너뜀
  ['작은따옴표', (c) => (/['\\]/.test(c) ? null : c.replace(/"/g, "'"))],
];

/** 정답 코드에서 [찾을 글자, 바꿀 글자]를 차례로 바꾼 코드 */
type Edit = [from: string, to: string][];

function applyEdit(solution: string, edit: Edit): string {
  return edit.reduce((code, [from, to]) => {
    if (!code.includes(from)) throw new Error(`정답 코드에 없음: ${from}`);
    return code.replace(from, to);
  }, solution);
}

/** 다른 정답 (퀘스트 키 → 코드 또는 정답 고쳐 쓰기). 규칙이 지나치게 좁으면 여기서 걸린다 */
/** 손님이 없는 퀘스트(3-F 자유 작품)의 이야기형 정답: 아이가 직접 칠 입력을 함께 */
type WithInputs = { code: string; stdin: string[] };

const HANDWRITTEN: Record<string, (string | Edit | WithInputs)[]> = {
  // U4: 1부터 세는 버그를 0으로 바꾸거나, 번호 없이 돌거나, 쉼표로 출력해도 맞는 고침
  'code-sea/5-8': [
    [['range(len(scores))', 'range(0, len(scores))']],
    [
      ['for i in range(len(scores)):', 'for s in scores:'],
      ['total + scores[i]', 'total + s'],
    ],
    [['print(f"평균: {avg}")', 'print("평균:", avg)']],
  ],
  // U5·U6: 다른 번호·글자 그대로
  'code-sea/5-10': [[['{basket[-1]}', '{basket[2]}']]],
  'code-sea/1-2': [[['{len(word)}', "{len('OCEAN')}"]]],
  // 프로젝트 빈칸의 다른 모양
  'code-sea/7-2#4': [[['left = left + record', 'left += record']]],
  'code-sea/7-2#5': [[['money > big_money', 'money >= big_money']]],
  'code-sea/7-4#3': [
    [['if check(word, answer):', 'if check(word, answer) == True:']],
  ],
  'code-sea/3-7': [
    'grid = [\n    [".", ".", ".", "."],\n    [".", "#", "X", "."],\n    ["#", ".", ".", "."],\n]\n\nfor r in range(0, len(grid)):\n    for c in range(0, len(grid[r])):\n        if grid[r][c] == "X":\n            print(f"보물은 {r}줄 {c}칸")\n',
  ],
  'code-sea/2-2': [
    "book = {'제목': '바다 탐험', '쪽수': 120}\nbook['빌린 사람']='하늘'\nbook['쪽수']=130\nprint(book)\nprint(f'이름표 수: {len(book)}')\n",
  ],
  'code-sea/1-10': [
    'abc = "abcdefghijklmnopqrstuvwxyz"\nword = "python"\nsecret = ""\nfor ch in word:\n    secret += abc[(abc.index(ch)+3)%26]\nprint(f"암호: {secret}")\n',
  ],
  'code-sea/5-1': [
    '# 버그버그 진료 기록\npatient = "버그버그"\ntemperature = 38\nfever=temperature-37\nprint(f"환자: {patient}")\nprint(f"체온: {temperature}도")\nprint(f"열이 {fever}도 높아요")\n',
  ],
  'code-sea/3-1': [
    'for r in range(3):\n\trow = ""\n\tfor c in range(4):\n\t\trow += "#"\n\tprint(row)\n',
  ],
  // 3월드 (P11-12 플레이테스트): 그림은 돌리거나 옮기거나 다른 방향으로 그려도, 입력은 다른 반복 모양이어도 통과
  'maker-city/1-1': [
    [
      ['range(4)', 'range(0, 4)'],
      ['t.left(90)', 't.right(90)'],
    ],
    // 돌리고 옮긴 네모 + 시작 코드 두 줄을 남긴 채 반복 (첫 변을 두 번 그림)
    [
      [
        't = turtle.Turtle()\n',
        't = turtle.Turtle()\nt.penup()\nt.goto(-70, 30)\nt.pendown()\nt.left(45)\nt.forward(100)\nt.left(90)\n',
      ],
    ],
    'from turtle import *\nfor i in range(4):\n    forward(100)\n    left(90)\ndone()\n',
  ],
  'maker-city/1-3': [[['t.left(360 / n)', 't.right(360 / n)']]],
  'maker-city/1-4': [
    [
      ['t.right(144)', 't.left(144)'],
      ['t.begin_fill()', 't.left(30)\nt.begin_fill()'],
    ],
  ],
  'maker-city/1-6': [[['i % 3', 'i % len(colors)']]],
  'maker-city/1-7#2': [
    [
      [
        '    t.penup()\n    t.goto(x, y + 80)\n    t.pendown()\n',
        '    t.left(90)\n    t.forward(80)\n    t.right(90)\n',
      ],
      ['house(-100, -100)', 'house(60, -100)'],
    ],
  ],
  'maker-city/1-7#3': [
    [
      [
        '    t.back(60)\n',
        '    t.penup()\n    t.goto(200, 180)\n    t.pendown()\n',
      ],
    ],
    [['t.back(60)', 't.backward(60)']],
  ],
  'maker-city/1-7#4': [
    [
      [
        'for i in range(5):\n    flower(-250 + i * 120, -200, colors[i])',
        'x = -250\nfor c in colors:\n    flower(x, -200, c)\n    x = x + 120',
      ],
    ],
  ],
  'maker-city/2-2': [
    'candy = input("사탕이 몇 개 있어요? ")\nprint(f"요술 항아리에서 나온 사탕 {int(candy) * 2}개!")\n',
  ],
  'maker-city/2-5': [
    [['while door != "1" and door != "2":', 'while door not in ["1", "2"]:']],
    'while True:\n    door = input("1번 문과 2번 문 중 어디로 갈까요? ")\n    if door == "1" or door == "2":\n        break\n    print("다시 골라 줘요!")\n\nif door == "1":\n    print("반짝이는 동굴에 들어왔어요!")\nelse:\n    print("시원한 강에 도착했어요!")\n',
  ],
  'maker-city/2-7#3': [
    [
      [
        'tries = 1\nanswer = input("정답은? ")\nwhile answer != "거북이":\n    print("땡! 다시 생각해 봐요.")\n    tries = tries + 1\n    answer = input("정답은? ")',
        'tries = 0\nwhile True:\n    answer = input("정답은? ")\n    tries += 1\n    if answer == "거북이":\n        break\n    print("땡! 다시 생각해 봐요.")',
      ],
    ],
  ],
  'maker-city/2-7#5': [
    [['elif "열쇠" in bag:', 'elif gift == "2" and "열쇠" in bag:']],
  ],
  'maker-city/3-1': [
    'answer = input("바다에서 가장 큰 동물은? ")\nif answer.strip() == "고래":\n    print("딩동댕!")\nelse:\n    print("땡!")\n',
  ],
  'maker-city/3-3': [
    "bank = [\n    {'q': '바다에서 가장 큰 동물은?', 'a': '고래'},\n    {'q': '무지개는 몇 가지 색일까요?', 'a': '7'},\n    {'q': '다리가 8개인 바다 동물은?', 'a': '문어'},\n]\nscore = 0\nfor i in range(len(bank)):\n    answer = input(bank[i]['q']).strip()\n    if answer == bank[i]['a']:\n        score += 1\nprint(f'맞힌 문제: {score}점')\n",
  ],
  'maker-city/3-4': [
    [['except ValueError:', 'except:']],
    'text = input("7 + 5 = ? ")\ntry:\n    answer = int(text)\nexcept ValueError:\n    print("숫자로 답해 줘요!")\nelse:\n    if answer == 12:\n        print("딩동댕!")\n    else:\n        print("땡!")\n',
  ],
  'maker-city/3-6#4': [
    [['random.shuffle(bank)', 'bank = random.sample(bank, len(bank))']],
  ],
  // ── 3-4 다른 정답 (P11-13) ──
  // f-string 막대 · max 앞뒤 바꾸기 · print 쉼표 · 반복으로 놀기 · if 로 100 에서 멈추기 · tick 을 먼저 · range(5)
  'maker-city/4-1': [
    [
      [
        '"배고픔: " + "#" * (pet["배고픔"] // 10)',
        `f"배고픔: {'#' * (pet['배고픔'] // 10)}"`,
      ],
    ],
  ],
  'maker-city/4-2': [
    [['max(0, pet["배고픔"] - 30)', 'max(pet["배고픔"] - 30, 0)']],
  ],
  'maker-city/4-4': [
    [['print(f"배고픔: {kong.hunger}")', 'print("배고픔:", kong.hunger)']],
  ],
  'maker-city/4-5': [
    [
      [
        'byul.play()\nbyul.play()\nbyul.play()',
        'for i in range(3):\n    byul.play()',
      ],
    ],
  ],
  'maker-city/4-7#2': [
    [
      [
        'self.mood = min(100, self.mood + 20)',
        'self.mood = self.mood + 20\n        if self.mood > 100:\n            self.mood = 100',
      ],
    ],
  ],
  'maker-city/4-7#4': [
    [
      ['    pet.tick()\n    pet.status()', '    pet.status()'],
      [
        'choice = input("1 밥, 2 놀기, 3 잠, 0 끝: ")\n',
        'choice = input("1 밥, 2 놀기, 3 잠, 0 끝: ")\n    pet.tick()\n',
      ],
    ],
  ],
  'maker-city/4-7#5': [
    [
      ['range(1, 6)', 'range(5)'],
      ['{day}일째', '{day + 1}일째'],
      ['{day}일이 지났어요', '{day + 1}일이 지났어요'],
    ],
  ],
  // ── 3-5 다른 정답 (P11-13) ──
  // 세기는 if/in 으로, 출력은 + 로 이어도 · statistics 는 from 으로 · 막대는 다른 자리·방향 · 색은 리스트와 번호로
  'maker-city/5-1': [
    [
      [
        '    count[fruit] = count.get(fruit, 0) + 1',
        '    if fruit in count:\n        count[fruit] += 1\n    else:\n        count[fruit] = 1',
      ],
      ['print(f"{fruit}: {n}표")', 'print(fruit + ": " + str(n) + "표")'],
    ],
  ],
  'maker-city/5-2': [
    'from statistics import mean, median\n\njumps = [35, 42, 28, 50, 42, 31, 46]\n\ntotal = 0\nfor j in jumps:\n    total = total + j\nmy_avg = round(total / 7, 1)\nprint("직접 구한 평균:", my_avg)\nstat_avg = round(mean(jumps), 1)\nprint("statistics 평균:", stat_avg)\nprint("같아요?", my_avg == stat_avg)\nprint("가운데 값:", median(jumps))\n',
  ],
  'maker-city/5-4': [
    [
      ['draw_bar(-100, 140', 'draw_bar(60, 140'],
      ['draw_bar(0, 100', 'draw_bar(-150, 100'],
    ],
    [
      ['t.left(90)', 't.right(90)'],
      ['t.left(90)', 't.right(90)'],
    ],
  ],
  'maker-city/5-6#1': [
    [
      [
        '    count[fruit] = count.get(fruit, 0) + 1',
        '    if fruit in count:\n        count[fruit] = count[fruit] + 1\n    else:\n        count[fruit] = 1',
      ],
    ],
  ],
  'maker-city/5-6#2': [
    [
      [
        'print(f"평균 {total / len(count)}표")',
        'import statistics\nprint(f"평균 {statistics.mean(count.values())}표")',
      ],
    ],
    [['if n > best_n:', 'if n >= best_n:']],
  ],
  'maker-city/5-6#3': [
    [
      [
        'for fruit, n in count.items():\n    draw_bar(x, n * 20, "orange", fruit)',
        'for fruit in count:\n    draw_bar(x, count[fruit] * 20, "orange", fruit)',
      ],
    ],
  ],
  'maker-city/5-6#4': [
    [
      [
        'colors = {"딸기": "red", "사과": "green", "포도": "purple", "귤": "orange"}',
        'colors = ["red", "green", "purple", "orange"]\ni = 0',
      ],
      ['colors[fruit]', 'colors[i]'],
      ['    x = x + 100', '    x = x + 100\n    i = i + 1'],
    ],
  ],
  'maker-city/5-6#5': [
    [['print("탐정 보고서: " + report)', 'print("탐정 보고서:", report)']],
  ],
  // ── 3-6 다른 정답 (P11-13) ──
  // 3-6: 잠은 from time import sleep, 움직임은 setx·xcor·따로 if·min/max 벽, 충돌은 if/else·position()
  'maker-city/6-1': [
    'from time import sleep\nprint(3)\nsleep(1)\nprint(2)\nsleep(1)\nprint(1)\nsleep(1)\nprint("출발!")\n',
  ],
  'maker-city/6-2': [
    'import time, turtle\nfrom pyroad import get_key\nt = turtle.Turtle()\nfor frame in range(0, 150):\n    key = get_key()\n    if key == "Right":\n        t.setx(t.xcor() + 10)\n    if key == "Left":\n        t.setx(t.xcor() - 10)\n    if key == "Up":\n        t.sety(t.ycor() + 10)\n    if key == "Down":\n        t.sety(t.ycor() - 10)\n    time.sleep(1/30)\nprint(t.position())\n',
  ],
  'maker-city/6-4': [
    [
      [
        'if x > 200:\n        x = 200\n    if x < -200:\n        x = -200',
        'x = min(x, 200)\n    x = max(x, -200)',
      ],
    ],
    [
      ['if key == "Right":', 'if key == "Right" and x < 200:'],
      ['elif key == "Left":', 'elif key == "Left" and x > -200:'],
      ['if x > 200:\n        x = 200\n    if x < -200:\n        x = -200', ''],
    ],
  ],
  'maker-city/6-5': [
    [
      [
        'return a.distance(b) < 20',
        'if a.distance(b.position()) < 20:\n        return True\n    else:\n        return False',
      ],
    ],
    [['return a.distance(b) < 20', 'return b.distance(a) < 20']],
  ],
  'maker-city/6-7#2': [
    [
      ['for frame in range(900):', 'for frame in range(0, 900):'],
      [
        'if x > 200:\n        x = 200\n    if x < -200:\n        x = -200',
        'x = max(-200, min(200, x))',
      ],
      ['screen.update()', 'turtle.update()'],
    ],
  ],
  'maker-city/6-7#3': [
    [
      ['star.goto(star.xcor(), star.ycor() - 5)', 'star.sety(star.ycor() - 5)'],
      [
        '        star.goto(random.randint(-200, 200), 200)',
        '        star.goto(random.choice(range(-200, 201)), 200)',
      ],
    ],
  ],
  'maker-city/6-7#4': [
    [
      ['score = score + 1', 'score += 1'],
      [
        'return a.distance(b) < 20',
        'if a.distance(b) < 20:\n        return True\n    return False',
      ],
    ],
  ],
  'maker-city/6-7#5': [
    [
      [
        'pen = turtle.Turtle()\npen.hideturtle()\npen.color("white")\npen.write(',
        'player.write(',
      ],
    ],
  ],
  // ── 3-F 나만의 작품 (P11-14): 그림이 아닌 작품도 통과 — 이야기형(입력), 게임형(키), 펫형(class) ──
  'maker-city/7-2#1': [
    [
      ['"반짝반짝 별자리"', '"용감한 고양이 모험"'],
      ['"그림"', '"이야기"'],
    ],
  ],
  'maker-city/7-2#2': [
    {
      code: '# 고양이 모험\ntitle = "고양이 모험"\nkind = "이야기"\nfeatures = ["길 고르기", "친구 만나기", "엔딩"]\nprint("작품:", title)\nprint("종류:", kind)\nprint("만들 기능")\nfor f in features:\n    print("-", f)\n\nway = input("왼쪽 길과 오른쪽 길 중 어디로 갈까? ")\nprint(way, "길로 출발!")\n',
      stdin: ['왼쪽'],
    },
    'title = "별 피하기"\nkind = "게임"\nfeatures = ["좌우로 움직이기", "별 떨어지기", "점수"]\nprint("작품:", title)\nprint("종류:", kind)\nprint("만들 기능")\nprint(features)\n\nimport time\nimport turtle\nfrom pyroad import get_key\n\np = turtle.Turtle()\np.penup()\nx = 0\nfor frame in range(90):\n    key = get_key()\n    if key == "Right":\n        x += 10\n    p.goto(x, -150)\n    time.sleep(1 / 30)\n',
  ],
  'maker-city/7-2#3': [
    {
      code: 'title = "펫 키우기"\nkind = "펫"\nfeatures = ["이름 짓기", "밥 주기", "기분 보기"]\nprint("작품:", title)\nprint("종류:", kind)\nprint("만들 기능")\nprint(features)\n\nclass Pet:\n    def __init__(self, name):\n        self.name = name\n        self.hunger = 50\n\n    def feed(self):\n        self.hunger = max(0, self.hunger - 30)\n\nmy_pet = Pet(input("펫 이름은? "))\nmy_pet.feed()\nif my_pet.hunger < 30:\n    print(my_pet.name, "배불러요!")\n',
      stdin: ['몽이'],
    },
  ],
  'maker-city/7-2#4': [
    [['def credits():', 'def credits(name="별빛 메이커"):']],
  ],
};

/** 틀린 코드 (정답 고쳐 쓰기). 출력은 맞거나 비슷해도 떨어져야 함 */
const WRONG: Record<string, Edit[]> = {
  // L1: 한 번 굴린 눈을 100번 셈
  'code-sea/4-2': [[['n = random.randint(1, 6)', 'n = dice']]],
  // L2: 한 번도 안 돌고 "0번 만에 뽑았어요"
  'code-sea/4-8': [
    [['while prize != "황금 열쇠":', 'while prize == "황금 열쇠":']],
  ],
  // L3: 130 이상이 아니라 초과 (키 130인 친구가 빠짐)
  'code-sea/6-4': [[['if h >= 130:', 'if h > 130:']]],
  // L4: 규칙 글자가 시작 코드에 이미 있어 빈칸을 안 채워도 통과하던 단계
  'code-sea/7-2#4': [
    [
      ['left = left + record["금액"]', 'pass'],
      ['return left', 'return 1700'],
    ],
  ],
  'code-sea/7-2#5': [[['if money > big_money:', 'if name == "선물":']]],
  'code-sea/7-4#3': [
    [['if check(word, answer):\n        score = score + 1', 'score = 3']],
  ],
  // 3월드 (P11-12 플레이테스트): 그림이 비슷하거나 시험 손님 하나만 맞는 답
  'maker-city/1-1': [
    [
      [
        'for i in range(4):\n    t.forward(100)\n    t.left(90)',
        't.forward(100)\nt.left(90)\n'.repeat(4),
      ],
    ],
    [['forward(100)', 'forward(50)']],
    [['range(4)', 'range(3)']],
  ],
  'maker-city/1-3': [[['360 / n', '90']], [['range(n)', 'range(4)']]],
  'maker-city/1-4': [
    [['t.end_fill()', '']],
    [
      [
        't.begin_fill()\nfor i in range(5):',
        'for i in range(5):\n    t.begin_fill()',
      ],
    ],
    [['right(144)', 'right(72)']],
  ],
  'maker-city/1-6': [[['colors[i % 3]', '"red"']], [['range(12)', 'range(6)']]],
  'maker-city/1-7#2': [
    [['house(-100, -100)', 'house(-250, -100)']],
    [['    polygon(3, 80)\n', '']],
  ],
  'maker-city/1-7#4': [
    [
      [
        '    for i in range(6):\n        t.circle(15)\n        t.left(60)',
        '    for i in range(5):\n        t.circle(15)\n        t.left(72)',
      ],
    ],
  ],
  'maker-city/2-1': [[['{nickname}', '별똥']]],
  'maker-city/2-2': [[['int(input', 'float(input']]],
  'maker-city/2-4': [[['door == "1"', 'door == 1']]],
  'maker-city/2-5': [
    [['while door != "1" and door != "2":', 'if door != "1" and door != "2":']],
    [['door != "1" and door != "2"', 'door != "1" or door != "2"']],
  ],
  'maker-city/2-7#3': [[['    tries = tries + 1\n', '']]],
  'maker-city/2-7#4': [[['if "열쇠" in bag:', 'if bag == "열쇠":']]],
  'maker-city/2-7#5': [[['elif "열쇠" in bag:', 'elif gift == "2":']]],
  'maker-city/3-1': [[['answer = answer.strip()', 'x = "a".strip()']]],
  'maker-city/3-3': [
    [['input(card["q"] + " ").strip()', 'input(card["q"] + " ")']],
  ],
  'maker-city/3-4': [
    [
      [
        'try:\n    answer = int(text)\n    if answer == 12:\n        print("딩동댕!")\n    else:\n        print("땡!")\nexcept ValueError:\n    print("숫자로 답해 줘요!")',
        'try:\n    answer = int(text)\nexcept ValueError:\n    print("숫자로 답해 줘요!")\nif answer == 12:\n    print("딩동댕!")\nelse:\n    print("땡!")',
      ],
    ],
  ],
  'maker-city/3-6#3': [
    [['            break\n', '']],
    [
      [
        '            print("게임 오버!")\n            break',
        '            print("게임 오버!")\n        break',
      ],
    ],
  ],
  'maker-city/3-6#5': [[['        wrong.append(card["q"])\n', '']]],
  // ── 3-4 틀린 답 (P11-13) ──
  // 막대 글자 고정 · 0/100 에서 안 멈춤 · 글자 그대로 출력 · 다른 펫과 놀기 · 이름 고정 · pass 그대로 · break 없음 · 숫자 0 과 견줌 · tick 안 부름 · 기분 안 줄음 · 기준 틀림
  'maker-city/4-1': [
    [
      ['(pet["배고픔"] // 10)', '6'],
      ['(pet["기분"] // 10)', '4'],
    ],
  ],
  'maker-city/4-2': [[['max(0, pet["배고픔"] - 30)', 'pet["배고픔"] - 30']]],
  'maker-city/4-4': [[['{kong.hunger}', '50']]],
  'maker-city/4-5': [
    [['min(100, self.mood + 20)', 'self.mood + 20']],
    [['byul.play()', 'kong.play()']],
  ],
  'maker-city/4-7#1': [[['{self.name}의 상태', '콩이의 상태']]],
  'maker-city/4-7#2': [
    [
      [
        'self.mood = min(100, self.mood + 20)\n        self.hunger = min(100, self.hunger + 10)\n        print(f"{self.name}: 신나요!")',
        'pass',
      ],
    ],
    [['max(0, self.hunger - 30)', 'self.hunger - 30']],
  ],
  'maker-city/4-7#3': [
    [['\n        break', '']],
    [['choice == "0"', 'choice == 0']],
  ],
  'maker-city/4-7#4': [
    [['    pet.tick()\n', '']],
    [['self.mood = max(0, self.mood - 5)', 'self.mood = self.mood']],
  ],
  'maker-city/4-7#5': [[['elif pet.mood >= 40:', 'elif pet.mood >= 20:']]],
  // ── 3-5 틀린 답 (P11-13) ──
  // 늘 1로 덮어쓰는 세기 · 가운데 값을 손으로 · 반올림 없음 · 채우지 않은 막대 · 같은 자리 막대 · 펼쳐 쓴 막대 · 한 가지 색
  'maker-city/5-1': [
    [['count[fruit] = count.get(fruit, 0) + 1', 'count[fruit] = 1']],
  ],
  'maker-city/5-2': [
    [['{statistics.median(jumps)}', '42']],
    [['round(statistics.mean(jumps), 1)', 'statistics.mean(jumps)']],
    [['/ len(jumps)', '/ 6']],
  ],
  'maker-city/5-4': [
    [['    t.end_fill()\n', '']],
    [['draw_bar(0, 100, "green", "사과")', '']],
    [
      [
        'draw_bar(0, 100, "green", "사과")',
        'draw_bar(-100, 140, "green", "사과")',
      ],
    ],
    [['t.write(label', 't.write("과일"']],
  ],
  'maker-city/5-6#2': [
    [['total / len(count)', 'total / 20']],
    [['if n > best_n:', 'if n < best_n:']],
  ],
  'maker-city/5-6#3': [
    [
      [
        'for fruit, n in count.items():\n    draw_bar(x, n * 20, "orange", fruit)\n    # (4단계) 여기서 막대 위에 표 수를 써요\n    x = x + 100',
        'draw_bar(-200, 140, "orange", "딸기")\ndraw_bar(-100, 100, "orange", "사과")\ndraw_bar(0, 80, "orange", "포도")\ndraw_bar(100, 80, "orange", "귤")',
      ],
    ],
    [['    x = x + 100\n', '']],
  ],
  'maker-city/5-6#4': [
    [['colors[fruit]', '"orange"']],
    [['t.write(f"{n}표"', 't.write("표"']],
  ],
  'maker-city/5-6#5': [
    [['t.write(report, font=("Arial", 16, "normal"))', '']],
    [['turtle.title("과일 사건 보고서")\n', '']],
  ],
  // ── 3-6 틀린 답 (P11-13) ──
  // 3-6: 반복 안의 출발, 아래 키 빠짐, 잠 없음(키가 안 들어옴), 벽 하나·한 칸 모자란 벽, 거리 부등호 반대, 점수 안 셈
  'maker-city/6-1': [[['print("출발!")', '    print("출발!")']]],
  'maker-city/6-2': [
    [['    elif key == "Down":\n        y = y - 10\n', '']],
    [['time.sleep(1 / 30)', 'pass']],
  ],
  'maker-city/6-4': [
    [['    if x < -200:\n        x = -200\n', '']],
    [['if x > 200:\n        x = 200', 'if x > 190:\n        x = 190']],
  ],
  'maker-city/6-5': [[['< 20', '> 20']], [['< 20', '< 100']]],
  'maker-city/6-7#2': [
    [['    if x < -200:\n        x = -200\n', '']],
    [['    time.sleep(1 / 30)\n', '']],
  ],
  'maker-city/6-7#3': [
    [
      ['star.goto(random.randint(-200, 200), 200)', 'star.goto(0, 200)'],
      ['star.goto(random.randint(-200, 200), 200)', 'star.goto(0, 200)'],
    ],
  ],
  'maker-city/6-7#4': [[['< 20', '> 20']], [['score = score + 1', 'pass']]],
  'maker-city/6-7#5': [
    [
      [
        'pen.write(f"게임 끝! 점수: {score}", align="center", font=("Arial", 24, "bold"))\n',
        '',
      ],
    ],
    [['print(f"게임 끝! 점수: {score}")', 'print(f"점수: {score}")']],
  ],
  // 3-F: 선이 모자란 그림 · 조건 없는 함수 · 함수 없이 크레딧
  'maker-city/7-2#2': [
    [
      [
        'points = [(-220, 40), (-170, 110), (-110, 70), (-60, 140), (0, 90), (50, 150), (100, 80), (150, 130), (190, 60), (230, 120), (250, 30)]',
        'points = [(-220, 40), (-170, 110), (-110, 70), (-60, 140)]',
      ],
    ],
  ],
  'maker-city/7-2#3': [
    [
      [
        '    if p[1] > 100:\n        star(p[0], p[1], 20)   # 높이 있는 별은 크게\n    else:\n        star(p[0], p[1], 10)',
        '    star(p[0], p[1], 10)',
      ],
    ],
  ],
  'maker-city/7-2#4': [
    [
      [
        'def credits():\n    print("만든 사람: 별빛 메이커")\n    print("도와준 친구: 파이뱀")\n\ncredits()',
        'print("만든 사람: 별빛 메이커")\nprint("도와준 친구: 파이뱀")',
      ],
    ],
  ],
};

const { units } = loadUnits(CONTENT_DIR);
const byKey = new Map(units.map((u) => [u.key, u]));
let runner: NodePyodideRunner;

beforeAll(async () => {
  runner = await NodePyodideRunner.create({ timeoutMs: EXECUTION_TIMEOUT_MS });
}, 180_000);
afterAll(() => runner?.close());

/** 불합격 이유 (통과면 null) */
async function failure(
  unit: CheckUnit,
  code: string,
  stdin?: string[],
): Promise<string | null> {
  for (const p of planRuns(unit.scenarios, { seeds: 1, unseededRuns: 0 })) {
    const r = await runner.run(code, {
      seed: p.seed,
      stdin: p.stdin ?? stdin,
      keys: p.keys,
    });
    for (const rule of [unit.rule, unit.questRule]) {
      if (!rule) continue;
      const v = judge(rule, r, code, EXECUTION_TIMEOUT_MS, p.scenario);
      if (!v.passed)
        return [
          `${p.label} · 규칙 ${ruleSummary(rule)}`,
          ...v.detail,
          '--- 코드',
          code,
        ].join('\n');
    }
  }
  return null;
}

it('다른 정답·틀린 코드가 가리키는 퀘스트가 있음', () => {
  const keys = [...Object.keys(HANDWRITTEN), ...Object.keys(WRONG)];
  expect(keys.filter((k) => !byKey.get(k)?.solution)).toEqual([]);
});

describe('정답을 다르게 써도 통과', () => {
  for (const unit of units.filter((u) => u.solution))
    it(`${unit.key} ${unit.title}`, async () => {
      const codes = [
        ...VARIANTS.map(
          ([name, f]) => [name, f(unit.solution!), undefined] as const,
        ),
        ...(HANDWRITTEN[unit.key] ?? []).map(
          (c, i) =>
            [
              `다른 정답 ${i + 1}`,
              typeof c === 'string'
                ? c
                : Array.isArray(c)
                  ? applyEdit(unit.solution!, c)
                  : c.code,
              Array.isArray(c) || typeof c === 'string' ? undefined : c.stdin,
            ] as const,
        ),
      ];
      for (const [name, code, stdin] of codes) {
        if (code === null || code === unit.solution) continue;
        const why = await failure(unit, code, stdin);
        expect(why, `${unit.where} — ${name}\n${why}`).toBeNull();
      }
    });
});

describe('틀린 코드는 떨어짐', () => {
  for (const [key, edits] of Object.entries(WRONG))
    it(key, async () => {
      const unit = byKey.get(key)!;
      for (const edit of edits) {
        const code = applyEdit(unit.solution!, edit);
        expect(
          await failure(unit, code),
          `${unit.where} — 통과하면 안 되는 코드\n${code}`,
        ).not.toBeNull();
      }
    });
});
