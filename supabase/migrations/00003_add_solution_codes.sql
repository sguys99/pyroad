-- 황금키 시스템용: 각 퀘스트의 prompt_skeleton에 solution_code 추가
-- 프로젝트 퀘스트(스테이지 7)는 steps[].solution_code로 단계별 정답 관리

-- ────────────────────────────────────────────────────────────
-- 스테이지 1: 파이썬 마을 입구
-- ────────────────────────────────────────────────────────────

-- 01: 첫 번째 인사
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"안녕하세요!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000001';

-- 02: 내 소개를 해볼까?
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"나는 파이썬 모험가!\")\nprint(\"반가워!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000002';

-- 23: 따옴표의 비밀
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"I''m happy!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000023';

-- 03: 주석으로 메모하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"# 파이썬 메모\nprint(\"파이썬은 재미있어!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000003';

-- 24: 특수문자 출력하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"첫째 줄\\n둘째 줄\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000024';

-- 25: 숫자도 출력해요
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(2026)"')
WHERE id = 'b1000000-0000-0000-0000-000000000025';

-- 26: 마을 안내판 만들기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"# 마을 안내판\nprint(\"=== 파이썬 마을 ===\")\nprint(\"인구: 2026명\")\nprint(\"환영합니다!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000026';

-- ────────────────────────────────────────────────────────────
-- 스테이지 2: 변수의 숲
-- ────────────────────────────────────────────────────────────

-- 04: 마법 상자에 이름 넣기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"name = \"파이뱀\"\nprint(name)"')
WHERE id = 'b1000000-0000-0000-0000-000000000004';

-- 05: 숫자 상자와 글자 상자
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"number = 10\ngreeting = \"안녕\"\nprint(number)\nprint(greeting)"')
WHERE id = 'b1000000-0000-0000-0000-000000000005';

-- 27: 상자 이름 바꾸기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"color = \"빨강\"\ncolor = \"파랑\"\nprint(color)"')
WHERE id = 'b1000000-0000-0000-0000-000000000027';

-- 06: 나이 계산기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"birth_year = 2014\nage = 2026 - birth_year\nprint(str(age) + \"살\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000006';

-- 28: 글자 합치기 마법
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"first = \"파이\"\nsecond = \"썬\"\nresult = first + second\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000028';

-- 07: 변신 마법! 형변환
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"a = \"100\"\nb = \"23\"\nresult = int(a) + int(b)\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000007';

-- 29: 자기소개 카드 만들기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"name = \"파이뱀\"\nage = \"10\"\nschool = \"코딩초등학교\"\nprint(\"이름: \" + name)\nprint(\"나이: \" + age + \"살\")\nprint(\"학교: \" + school)"')
WHERE id = 'b1000000-0000-0000-0000-000000000029';

-- ────────────────────────────────────────────────────────────
-- 스테이지 3: 조건의 갈림길
-- ────────────────────────────────────────────────────────────

-- 08: 비밀번호를 맞춰라!
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"password = \"열려라\"\n\nif password == \"열려라\":\n    print(\"통과!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000008';

-- 30: 짝수인지 홀수인지?
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"number = 7\n\nif number % 2 == 0:\n    print(\"짝수\")\nelse:\n    print(\"홀수\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000030';

-- 09: 성적표 만들기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"score = 85\n\nif score >= 90:\n    print(\"등급: A\")\nelif score >= 80:\n    print(\"등급: B\")\nelse:\n    print(\"등급: C\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000009';

-- 10: 놀이공원 입장
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"height = 130\n\nif height >= 120:\n    print(\"입장 가능!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000010';

-- 11: 마법사의 조건
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"magic = 80\ncourage = 70\n\nif magic >= 60 and courage >= 60:\n    print(\"마법사 합격!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000011';

-- 31: 가위바위보 심판
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"player = \"가위\"\ncomputer = \"보\"\n\nif player == computer:\n    print(\"비겼다!\")\nelif player == \"가위\":\n    if computer == \"보\":\n        print(\"이겼다!\")\n    else:\n        print(\"졌다!\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000031';

-- 32: 영화관 할인 시스템
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"age = 10\nis_weekend = False\nprice = 10000\n\nif age < 13:\n    if is_weekend == False:\n        discount = 50\n    else:\n        discount = 30\nelse:\n    discount = 0\n\nfinal_price = price * (100 - discount) // 100\n\nprint(\"나이: \" + str(age) + \"살\")\nprint(\"할인율: \" + str(discount) + \"%\")\nprint(\"가격: \" + str(final_price) + \"원\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000032';

-- ────────────────────────────────────────────────────────────
-- 스테이지 4: 반복의 동굴
-- ────────────────────────────────────────────────────────────

-- 12: 숫자 세기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"for i in range(1, 6):\n    print(i)"')
WHERE id = 'b1000000-0000-0000-0000-000000000012';

-- 13: 구구단 외우기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"for i in range(1, 10):\n    print(2, \"x\", i, \"=\", 2*i)"')
WHERE id = 'b1000000-0000-0000-0000-000000000013';

-- 33: 별 찍기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"print(\"*\" * 5)"')
WHERE id = 'b1000000-0000-0000-0000-000000000033';

-- 34: 합계 구하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"total = 0\n\nfor i in range(1, 11):\n    total = total + i\n\nprint(total)"')
WHERE id = 'b1000000-0000-0000-0000-000000000034';

-- 14: 보물 찾기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"position = 1\n\nwhile position <= 10:\n    if position == 5:\n        print(\"보물 발견!\")\n        break\n    position = position + 1"')
WHERE id = 'b1000000-0000-0000-0000-000000000014';

-- 15: 짝수만 골라내기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"for i in range(1, 11):\n    if i % 2 != 0:\n        continue\n    print(i)"')
WHERE id = 'b1000000-0000-0000-0000-000000000015';

-- 35: 카운트다운
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"count = 5\n\nwhile count >= 1:\n    print(count)\n    count = count - 1"')
WHERE id = 'b1000000-0000-0000-0000-000000000035';

-- 36: 별 피라미드 만들기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"for i in range(1, 6):\n    print(\"*\" * i)"')
WHERE id = 'b1000000-0000-0000-0000-000000000036';

-- ────────────────────────────────────────────────────────────
-- 스테이지 5: 리스트 호수
-- ────────────────────────────────────────────────────────────

-- 16: 과일 바구니
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"fruits = [\"사과\", \"바나나\", \"포도\"]\nprint(fruits)"')
WHERE id = 'b1000000-0000-0000-0000-000000000016';

-- 17: 보물 목록 정리
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"treasures = [\"금화\", \"은화\", \"다이아몬드\", \"루비\"]\nprint(treasures[2])"')
WHERE id = 'b1000000-0000-0000-0000-000000000017';

-- 37: 리스트 순회하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"colors = [\"빨강\", \"초록\", \"파랑\"]\n\nfor color in colors:\n    print(color)"')
WHERE id = 'b1000000-0000-0000-0000-000000000037';

-- 18: 친구 목록 관리
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"friends = [\"토끼\", \"거북이\", \"다람쥐\"]\nfriends.append(\"파이뱀\")\nprint(len(friends))"')
WHERE id = 'b1000000-0000-0000-0000-000000000018';

-- 38: 리스트 정렬하기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"numbers = [3, 1, 4, 1, 5]\nnumbers.sort()\nprint(numbers)"')
WHERE id = 'b1000000-0000-0000-0000-000000000038';

-- 39: 리스트 속 검색
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"fruits = [\"사과\", \"바나나\", \"포도\"]\nresult = \"바나나\" in fruits\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000039';

-- 40: 쇼핑 리스트 정리기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"shopping = []\nshopping.append(\"우유\")\nshopping.append(\"주스\")\nshopping.append(\"과자\")\nshopping.sort()\nprint(\"--- 쇼핑 목록 ---\")\nfor item in shopping:\n    print(item)\nprint(\"총 \" + str(len(shopping)) + \"개\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000040';

-- ────────────────────────────────────────────────────────────
-- 스테이지 6: 함수의 탑
-- ────────────────────────────────────────────────────────────

-- 19: 인사하는 함수
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def greet():\n    print(\"안녕! 나는 파이뱀이야!\")\n\ngreet()"')
WHERE id = 'b1000000-0000-0000-0000-000000000019';

-- 20: 계산기 함수
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def add(a, b):\n    return a + b\n\nresult = add(7, 8)\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000020';

-- 41: 기본값이 있는 함수
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def greet(name=\"친구\"):\n    print(\"안녕, \" + name + \"!\")\n\ngreet()\ngreet(\"파이뱀\")"')
WHERE id = 'b1000000-0000-0000-0000-000000000041';

-- 21: 최댓값 찾기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"numbers = [3, 7, 1, 9, 4]\nbiggest = max(numbers)\nprint(biggest)"')
WHERE id = 'b1000000-0000-0000-0000-000000000021';

-- 42: 여러 값 돌려주기
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def min_max(a, b, c):\n    smallest = min(a, b, c)\n    biggest = max(a, b, c)\n    return smallest, biggest\n\nsmall, big = min_max(1, 9, 5)\nprint(small)\nprint(big)"')
WHERE id = 'b1000000-0000-0000-0000-000000000042';

-- 43: 함수 안의 함수 호출
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def double(x):\n    return x * 2\n\ndef add_one(x):\n    return x + 1\n\nresult = add_one(double(3))\nprint(result)"')
WHERE id = 'b1000000-0000-0000-0000-000000000043';

-- 44: 성적 분석 프로그램
UPDATE public.quests SET prompt_skeleton = jsonb_set(prompt_skeleton, '{solution_code}', '"def average(a, b, c):\n    return (a + b + c) / 3\n\ndef grade(avg):\n    if avg >= 90:\n        return \"A\"\n    elif avg >= 80:\n        return \"B\"\n    elif avg >= 70:\n        return \"C\"\n    else:\n        return \"D\"\n\navg = average(80, 90, 85)\ng = grade(avg)\n\nprint(\"평균: \" + str(avg))\nprint(\"등급: \" + g)"')
WHERE id = 'b1000000-0000-0000-0000-000000000044';

-- ────────────────────────────────────────────────────────────
-- 스테이지 7: 프로젝트 왕국 (steps[].solution_code)
-- ────────────────────────────────────────────────────────────

-- 22: 숫자 맞추기 게임 (5단계 프로젝트)
-- 각 step에 solution_code 추가
UPDATE public.quests SET prompt_skeleton = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          prompt_skeleton,
          '{steps,0,solution_code}',
          '"import random\n\nsecret = random.randint(1, 10)\nprint(secret)"'
        ),
        '{steps,1,solution_code}',
        '"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\nprint(\"비밀 숫자: \" + str(secret))\nprint(\"추측: \" + str(guess))"'
      ),
      '{steps,2,solution_code}',
      '"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\n\nif guess == secret:\n    print(\"정답!\")\nelif guess < secret:\n    print(\"비밀 숫자가 추측보다 커요!\")\nelse:\n    print(\"비밀 숫자가 추측보다 작아요!\")"'
    ),
    '{steps,3,solution_code}',
    '"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\n\nwhile guess != secret:\n    if guess < secret:\n        print(\"비밀 숫자가 추측보다 커요!\")\n    else:\n        print(\"비밀 숫자가 추측보다 작아요!\")\n    guess = int(random.randint(1, 10))\n\nprint(\"정답!\")"'
  ),
  '{steps,4,solution_code}',
  '"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\nattempts = 0\n\nwhile guess != secret:\n    attempts = attempts + 1\n    if guess < secret:\n        print(\"비밀 숫자가 추측보다 커요!\")\n    else:\n        print(\"비밀 숫자가 추측보다 작아요!\")\n    guess = int(random.randint(1, 10))\n\nattempts = attempts + 1\nprint(\"정답! \" + str(attempts) + \"번 만에 맞췄어요!\")"'
)
WHERE id = 'b1000000-0000-0000-0000-000000000022';
