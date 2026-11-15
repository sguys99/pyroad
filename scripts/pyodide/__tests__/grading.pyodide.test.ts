// 프로젝트 검증 회귀 (P11-05): 시험 손님(입력·키)·그림 규칙·any 를 진짜 Pyodide 실행 + 앱과 같은 판정으로.
// 콘텐츠 작성 전이라 world3.md 의 위험한 퀘스트 모양을 여기 둔다: 맞는 변형은 모두 통과, 틀린 변형은 모두 떨어져야 함.
// 판정 길은 test:content 와 같음 (빌드의 손님 규칙 붙이기 → 저장 형태 → planRuns → judge).
// 실행: npm run test:pyodide

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withScenarioRules } from '@/lib/content/build';
import type { InputScenario } from '@/lib/content/schema';
import { toStoredRule, type ValidationRule } from '@/lib/quest/validation';
import { analyze, mergedSegments, roundSegments } from '@/lib/turtle/check';
import { judge, planRuns } from '../../content/lib/solutionCheck';
import { NodePyodideRunner } from '../nodeRunner';

let runner: NodePyodideRunner;
beforeAll(async () => {
  runner = await NodePyodideRunner.create({ timeoutMs: 5_000 });
});
afterAll(() => runner?.close());

/** 통과면 null, 아니면 첫 실패 설명 */
async function fails(
  validation: ValidationRule,
  scenarios: InputScenario[] | null,
  code: string,
): Promise<string | null> {
  const rule = toStoredRule(
    withScenarioRules(validation, scenarios ?? undefined),
  );
  for (const p of planRuns(scenarios, { seeds: 2, unseededRuns: 1 })) {
    const r = await runner.run(code, {
      seed: p.seed,
      stdin: p.stdin,
      keys: p.keys,
    });
    const v = judge(rule, r, code, 5_000, p.scenario);
    if (!v.passed) return [p.label, ...v.detail].join('\n');
  }
  return null;
}

interface Case {
  name: string;
  validation: ValidationRule;
  scenarios: InputScenario[] | null;
  good: Record<string, string>;
  bad: Record<string, string>;
}

const contains = (expected: string): ValidationRule => ({
  type: 'contains',
  expected,
});
const code = (expected: string): ValidationRule => ({
  type: 'code_check',
  expected,
});

const CASES: Case[] = [
  {
    name: '3-2 두 갈래 문 (손님 2명이 각자 다른 문)',
    validation: code('if'),
    scenarios: [
      { name: '별똥이', inputs: ['1'], expect: contains('반짝이는 동굴') },
      { name: '콩콩이', inputs: ['2'], expect: contains('시원한 강') },
    ],
    good: {
      'if/else': `door = input("1번 문과 2번 문 중 어디로? ")
if door == "1":
    print("반짝이는 동굴에 들어왔어요!")
else:
    print("시원한 강에 도착했어요!")`,
      'int + elif': `door = int(input())
if door == 1:
    print("반짝이는 동굴")
elif door == 2:
    print("시원한 강")`,
    },
    bad: {
      '한 갈래만 print (답만 출력)': `door = input()
if door:
    print("반짝이는 동굴")`,
      '숫자 1과 글자 "1" (choice-bug)': `door = input()
if door == 1:
    print("반짝이는 동굴")
else:
    print("시원한 강")`,
    },
  },
  {
    name: '3-2 다시 물어볼게요 (입력이 딱 맞게, 끝나지 않으면 EOFError)',
    validation: code('while'),
    scenarios: [
      {
        inputs: ['3', '안녕', '2'],
        expect: {
          type: 'all',
          rules: [contains('다시 골라 줘요'), contains('시원한 강')],
        },
      },
    ],
    good: {
      'while not in': `door = input("문? ")
while door not in ["1", "2"]:
    print("다시 골라 줘요")
    door = input("문? ")
if door == "1":
    print("반짝이는 동굴")
else:
    print("시원한 강")`,
      'while True + break': `while True:
    door = input()
    if door == "1" or door == "2":
        break
    print("다시 골라 줘요")
print("반짝이는 동굴" if door == "1" else "시원한 강")`,
    },
    bad: {
      'break 를 잊음 → 입력이 더 필요해요(EOFError)': `while True:
    door = input()
    if door not in ["1", "2"]:
        print("다시 골라 줘요")
print("시원한 강")`,
      '다시 묻지 않음': `door = input()
if door not in ["1", "2"]:
    print("다시 골라 줘요")
elif door == "2":
    print("시원한 강")`,
    },
  },
  {
    name: '1월드 7-3 숫자 맞추기 (시드 없는 차례 입력, §12-Q75 ⑫)',
    validation: code('while'),
    scenarios: [
      {
        name: '차례 손님',
        inputs: Array.from({ length: 10 }, (_, i) => String(i + 1)),
        expect: contains('정답'),
      },
      {
        name: '거꾸로 손님',
        inputs: Array.from({ length: 10 }, (_, i) => String(10 - i)),
        expect: contains('정답'),
      },
    ],
    good: {
      randint: `import random
secret = random.randint(1, 10)
guess = int(input("1~10 숫자를 맞혀 봐요: "))
while guess != secret:
    if guess < secret:
        print("비밀 숫자가 더 커요!")
    else:
        print("비밀 숫자가 더 작아요!")
    guess = int(input("다시: "))
print("정답!")`,
      'choice(range) — 다르게 뽑아도 통과 (B09)': `import random
secret = random.choice(range(1, 11))
tries = 0
while True:
    tries += 1
    if int(input()) == secret:
        print(f"정답! {tries}번 만에 맞췄어요")
        break`,
    },
    bad: {
      '다시 안 물음 → 끝없는 출력': `import random
secret = random.randint(1, 10)
guess = int(input())
while guess != secret:
    print("커요")
print("정답")`,
      '맞혀도 안 끝남 → EOFError': `import random
secret = random.randint(1, 10)
while True:
    if int(input()) == secret:
        print("정답")`,
    },
  },
  {
    name: '3-6 화살표로 움직이기 (키 손님)',
    validation: code('get_key('),
    scenarios: [
      {
        keys: ['Right', 'Right', 'Right', 'Up'],
        expect: contains('(30.00,10.00)'),
      },
      { keys: Array(30).fill('Right'), expect: contains('(200.00,0.00)') },
    ],
    good: {
      'if/elif + 벽': `import turtle, time
from pyroad import get_key
t = turtle.Turtle()
for frame in range(150):
    key = get_key()
    if key == "Right" and t.xcor() < 200:
        t.forward(10)
    elif key == "Up":
        t.sety(t.ycor() + 10)
    time.sleep(1/30)
print(t.position())`,
      'setx + min': `import turtle, time
from pyroad import get_key
t = turtle.Turtle()
for frame in range(150):
    k = get_key()
    if k == "Right":
        t.setx(min(t.xcor() + 10, 200))
    if k == "Up":
        t.sety(t.ycor() + 10)
    time.sleep(0.03)
print(t.position())`,
    },
    bad: {
      '벽이 없음': `import turtle, time
from pyroad import get_key
t = turtle.Turtle()
for frame in range(150):
    key = get_key()
    if key == "Right":
        t.forward(10)
    elif key == "Up":
        t.sety(t.ycor() + 10)
    time.sleep(1/30)
print(t.position())`,
    },
  },
  {
    name: '3-1 첫 번째 네모 (정사각형 변 100)',
    validation: {
      type: 'all',
      rules: [
        { type: 'shape', shape: 'regular', n: 4, side: 100 },
        code('range(4)'),
      ],
    },
    scenarios: null,
    good: {
      'left 반복': `import turtle
t = turtle.Turtle()
for i in range(4):
    t.forward(100)
    t.left(90)`,
      'right·다른 자리·나눠 그리기': `import turtle
t = turtle.Turtle()
t.penup(); t.goto(-80, 40); t.pendown()
for i in range(4):
    t.forward(50)
    t.forward(50)
    t.right(90)`,
    },
    bad: {
      '변 90': `import turtle
t = turtle.Turtle()
for i in range(4):
    t.forward(90)
    t.left(90)`,
      삼각형: `import turtle
t = turtle.Turtle()
for i in range(4):
    t.forward(100)
    t.left(120)`,
    },
  },
  {
    name: '3-1 반짝 색칠 별 (채움)',
    validation: { type: 'shape', shape: 'regular', n: 5, k: 2, filled: true },
    scenarios: null,
    good: {
      채운별: `import turtle
t = turtle.Turtle()
t.fillcolor("yellow")
t.begin_fill()
for i in range(5):
    t.forward(120)
    t.right(144)
t.end_fill()`,
    },
    bad: {
      '안 채움': `import turtle
t = turtle.Turtle()
for i in range(5):
    t.forward(120)
    t.right(144)`,
    },
  },
  {
    name: '3-1 마을 2단계 (집 두 채: 정사각형 ×2 + 정삼각형 ×2, 펜을 안 들고 이어 그려도)',
    validation: {
      type: 'all',
      rules: [
        { type: 'shape', shape: 'regular', n: 4, count: 2 },
        { type: 'shape', shape: 'regular', n: 3, count: 2 },
      ],
    },
    scenarios: null,
    good: {
      'house 함수': `import turtle
t = turtle.Turtle()
def polygon(n, size):
    for i in range(n):
        t.forward(size)
        t.left(360 / n)
def house(x, y):
    t.penup(); t.goto(x, y); t.pendown()
    polygon(4, 60)
    t.left(90); t.forward(60); t.right(90)
    polygon(3, 60)
    t.left(90); t.back(60); t.right(90)
house(-100, 0)
house(50, 0)`,
    },
    bad: {
      '집 한 채': `import turtle
t = turtle.Turtle()
for i in range(4):
    t.forward(60); t.left(90)
t.left(90); t.forward(60); t.right(90)
for i in range(3):
    t.forward(60); t.left(120)`,
    },
  },
  {
    name: '3-F 자유 작품 2단계 (any: 그림 · input · get_key 중 하나)',
    validation: {
      type: 'any',
      rules: [{ type: 'segments', min: 10 }, code('input('), code('get_key(')],
    },
    scenarios: [{ inputs: ['5'] }],
    good: {
      그림: `import turtle
t = turtle.Turtle()
for i in range(12):
    t.forward(50)
    t.left(150)`,
      대화: `n = int(input("별 몇 개? "))
print("*" * n)`,
    },
    bad: {
      출력만: 'print("나만의 작품")',
    },
  },
];

describe.each(CASES)('$name', ({ validation, scenarios, good, bad }) => {
  it.each(Object.entries(good))('맞는 변형 통과: %s', async (_, src) => {
    expect(await fails(validation, scenarios, src)).toBeNull();
  });
  it.each(Object.entries(bad))('틀린 변형 불합격: %s', async (_, src) => {
    expect(await fails(validation, scenarios, src)).not.toBeNull();
  });
});

describe('match_drawing (정답 그림 선분과 견주기)', () => {
  const SOLUTION = `import turtle
t = turtle.Turtle()
for i in range(4):
    t.forward(100); t.left(90)
t.left(90); t.forward(100); t.right(30); t.forward(100); t.right(120); t.forward(100)`;

  it('정답 코드 선분을 규칙에 넣으면: 다른 순서·다른 자리(평행이동)는 통과, 지붕이 없으면 불합격 + 선분을 알려 줌', async () => {
    const r = await runner.run(SOLUTION);
    const segments = roundSegments(mergedSegments(analyze(r.turtle).segments));
    const rule: ValidationRule = {
      type: 'match_drawing',
      segments,
      translate: true,
    };
    const other = `import turtle
t = turtle.Turtle()
t.penup(); t.goto(-200, 100); t.pendown()
t.goto(-200, 0); t.goto(-100, 0); t.goto(-100, 100); t.goto(-200, 100)
t.goto(-150, 186.6); t.goto(-100, 100)`;
    expect(await fails(rule, null, other)).toBeNull();
    const noRoof = await fails(
      rule,
      null,
      'import turtle\nt = turtle.Turtle()\nfor i in range(4):\n    t.forward(100); t.left(90)',
    );
    expect(noRoof).toContain('정답 그림의 선 2개가 아직 없어요.');
    expect(noRoof).toContain('match_drawing.segments 모양');
  });
});
