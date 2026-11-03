// 테스트 프로그램. demo: 화면 드롭다운용 / cases: 방식별 의미 보존 매트릭스 (inputs → expect 포함 여부)

export const DEMO = {
  guess: `import random

def ask_number(prompt):
    while True:
        text = input(prompt)
        try:
            return int(text)
        except ValueError:
            print("숫자로 입력해 주세요!")

def play():
    secret = random.randint(1, 100)
    tries = 0
    while True:
        guess = ask_number("1부터 100 사이 숫자: ")
        tries += 1
        if guess < secret:
            print("더 큰 수예요!")
        elif guess > secret:
            print("더 작은 수예요!")
        else:
            print(f"정답! {tries}번 만에 맞혔어요.")
            return tries

play()
`,
  adventure: `def choose(question, options):
    print(question)
    for i, opt in enumerate(options, 1):
        print(f"  {i}. {opt}")
    while True:
        answer = input("번호를 고르세요: ")
        if answer.isdigit() and 1 <= int(answer) <= len(options):
            return int(answer)
        print("목록에 있는 번호를 입력해 주세요.")

def cave(hero):
    pick = choose(f"{hero}는 어두운 동굴에 들어왔어요.", ["횃불을 켠다", "그냥 걷는다"])
    if pick == 1:
        print("벽에 보물 지도가 그려져 있어요!")
        return "보물"
    print("발을 헛디뎌 넘어졌어요...")
    return "넘어짐"

def forest(hero):
    pick = choose(f"{hero}는 숲에서 여우를 만났어요.", ["말을 건다", "도망간다"])
    return "친구" if pick == 1 else "도망"

hero = input("용사의 이름은? ")
road = choose("갈림길이에요.", ["동굴", "숲"])
ending = cave(hero) if road == 1 else forest(hero)
print(f"엔딩: {ending}")
`,
  pet: `class Pet:
    def __init__(self):
        self.name = input("펫 이름을 지어 주세요: ")
        self.hunger = 5
        self.mood = 5

    def status(self):
        print(f"{self.name} | 배고픔 {self.hunger} | 기분 {self.mood}")

    def act(self):
        cmd = input("무엇을 할까요? (밥/놀기/끝): ")
        if cmd == "밥":
            self.hunger = max(0, self.hunger - 3)
        elif cmd == "놀기":
            self.mood = min(10, self.mood + 2)
            self.hunger += 1
        elif cmd == "끝":
            return False
        else:
            print("모르는 명령이에요.")
        return True

pet = Pet()
while pet.act():
    pet.status()
print(f"{pet.name}와(과) 놀아 줘서 고마워요!")
`,
  age: `print("나이 계산기")
name = input("이름: ")
age = int(input("나이: "))
print(f"{name}님은 내년에 {age + 1}살!")
`,
  echo: `while True:
    s = input()
    if s == "끝":
        break
    print(s)
`,
  busy: `n = 0
while True:
    n += 1
`,
  sleepy: `import time
for i in range(1000):
    print(i)
    time.sleep(0.2)
`,
  sleepcheck: `import time
t = time.time()
time.sleep(0.5)
print("slept", round(time.time() - t, 2))
`,
};

// [id, 설명, code, inputs, expect(출력에 포함되어야 할 문자열)]
export const CASES = [
  ['loop', 'while 루프 + 함수 안 input + try/except', DEMO.guess.replace('random.randint(1, 100)', '37'), ['abc', '50', '30', '37'], '정답! 3번 만에'],
  ['chain', '함수 → 함수 → input (중첩 호출)', `def c(): return input("c? ")\ndef b(): return c() + "!"\ndef a(): return b() * 2\nprint(a())\n`, ['x'], 'x!x!'],
  ['method', '클래스 메서드 안 input', `class Q:\n    def ask(self, p):\n        return input(p)\nq = Q()\nprint(q.ask("? ").upper())\n`, ['hi'], 'HI'],
  ['init', '__init__ 안 input (가상 펫 패턴)', `class Pet:\n    def __init__(self):\n        self.name = input("이름? ")\np = Pet()\nprint("이름:", p.name)\n`, ['코코'], '이름: 코코'],
  ['alias', 'ask = input 별칭', `ask = input\nprint("답:", ask("? "))\n`, ['ok'], '답: ok'],
  ['lambda', 'lambda / sorted(key=...) 안 input', `names = ["b", "a"]\nprint(sorted(names, key=lambda n: input(n + "? ")))\n`, ['2', '1'], "['a', 'b']"],
  ['generator', '제너레이터 안 input', `def answers():\n    while True:\n        yield input("> ")\nfor a in answers():\n    if a == "끝":\n        break\n    print("받음", a)\n`, ['x', '끝'], '받음 x'],
  ['comprehension', '최상위 리스트 컴프리헨션 안 input', `nums = [int(input("수? ")) for _ in range(2)]\nprint(sum(nums))\n`, ['1', '2'], '3'],
  ['recursion', '재귀 함수 안 input', `def count(n):\n    if n == 0:\n        return 0\n    return int(input(f"{n}? ")) + count(n - 1)\nprint(count(2))\n`, ['3', '4'], '7'],
  ['callback', 'input을 인자로 넘김 repeat(input, 2)', `def repeat(f, n):\n    return [f() for _ in range(n)]\nprint(repeat(input, 2))\n`, ['a', 'b'], "['a', 'b']"],
  ['map', 'map(input, prompts)', `print(list(map(input, ["a? ", "b? "])))\n`, ['1', '2'], "['1', '2']"],
  ['collision', '메서드 이름 get → dict.get까지 await됨', `class Box:\n    def get(self):\n        return input("? ")\nd = {"k": 1}\nprint(d.get("k"), Box().get())\n`, ['v'], '1 v'],
  ['stdin', 'sys.stdin.readline()', `import sys\nline = sys.stdin.readline().strip()\nprint("읽음", line)\n`, ['zz'], '읽음 zz'],
  ['errorline', 'int(input()) ValueError 줄 번호', DEMO.age, ['파이', '열살'], 'line 3'],
];
