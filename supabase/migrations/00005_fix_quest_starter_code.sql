-- 퀘스트 정답 노출 문제 수정: 4~6단계 starter_code를 불완전하게 변경
-- 학생이 핵심 코드를 직접 작성하도록 유도

-- 2-4 변신 마법! 형변환: result 빈칸
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 문자열을 숫자로 바꿔서 더해보세요!\na = \"100\"\nb = \"23\"\nresult = \nprint(result)"'
  ),
  '{hints}',
  '{"level_1": "따옴표가 있으면 글자, 없으면 숫자예요. 글자를 숫자로 바꾸려면?", "level_2": "int() 안에 문자열을 넣으면 숫자로 변신해요! int(a) + int(b)를 해보세요!", "level_3": "result = int(a) + int(b) 이렇게 써보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000007';

-- 4-1 숫자 세기: range 빈칸
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 1부터 5까지 세어보세요!\n# for 반복문과 range()를 사용해보세요!\n\nfor i in range(__, __):\n    print(i)"'
  ),
  '{hints}',
  '{"level_1": "for는 같은 일을 여러 번 반복해주는 마법이에요! range()에 시작과 끝 숫자를 넣어보세요.", "level_2": "range(1, 6)은 1, 2, 3, 4, 5를 만들어줘요. 6은 포함되지 않아요!", "level_3": "for i in range(1, 6): 이렇게 빈칸을 채워보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000012';

-- 4-2 구구단 외우기: print() 빈칸
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 2단 구구단을 출력해보세요!\n# 형식: 2 x 1 = 2\n\nfor i in range(1, 10):\n    print()"'
  ),
  '{hints}',
  '{"level_1": "구구단은 같은 숫자에 1, 2, 3, ... 9를 곱하는 거예요! print() 안에 무엇을 넣어야 할까요?", "level_2": "print() 안에 2, \"x\", i, \"=\", 2 * i 이렇게 넣어보세요!", "level_3": "print(2, \"x\", i, \"=\", 2 * i) 이렇게 써보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000013';

-- 4-3 보물 찾기: print/break 빈칸
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 보물을 찾아보세요!\nposition = 1\n\nwhile position <= 10:\n    if position == 5:\n        # 보물을 찾으면 메시지를 출력하고 멈추세요!\n        \n    position = position + 1"'
  ),
  '{hints}',
  '{"level_1": "while은 조건이 참인 동안 계속 반복해요. position이 5가 되면 뭘 해야 할까요?", "level_2": "print()로 메시지를 출력하고, break로 반복을 멈추면 돼요!", "level_3": "print(\"보물 발견!\")\n        break 이렇게 두 줄을 채워보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000014';

-- 4-4 짝수만 골라내기: continue 빈칸
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 짝수만 출력해보세요!\nfor i in range(1, 11):\n    if i % 2 != 0:\n        # 홀수면 건너뛰세요!\n        \n    print(i)"'
  ),
  '{hints}',
  '{"level_1": "짝수는 2로 나누어 떨어지는 숫자예요. 홀수는 건너뛰려면 어떤 명령어를 써야 할까요?", "level_2": "continue를 쓰면 아래 코드를 건너뛰고 다음 반복으로 가요!", "level_3": "continue 이렇게 한 줄만 써보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000015';

-- 5-1 과일 바구니: 빈 리스트
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 과일 바구니를 만들어보세요!\n# 대괄호 [] 안에 \"사과\", \"바나나\", \"포도\"를 넣어보세요!\n\nfruits = []\nprint(fruits)"'
  ),
  '{hints}',
  '{"level_1": "리스트는 대괄호 [] 안에 값을 넣어 만들어요!", "level_2": "각 과일을 따옴표로 감싸고 쉼표로 구분해요! [\"사과\", \"바나나\", ...]", "level_3": "fruits = [\"사과\", \"바나나\", \"포도\"] 이렇게 써보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000016';

-- 5-2 보물 목록 정리: 인덱스 빈칸
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 보물 목록에서 다이아몬드를 꺼내보세요!\ntreasures = [\"금화\", \"은화\", \"다이아몬드\", \"루비\"]\nprint(treasures[__])"'
  ),
  '{hints}',
  '{"level_1": "리스트의 번호(인덱스)는 0부터 시작해요. 다이아몬드는 몇 번째일까요?", "level_2": "금화=0, 은화=1, 다이아몬드=2! 대괄호 안에 번호를 넣어보세요.", "level_3": "print(treasures[2]) 이렇게 빈칸에 2를 넣어보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000017';

-- 5-3 친구 목록 관리: append/len 빈칸
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 친구를 추가하고 몇 명인지 세어보세요!\nfriends = [\"토끼\", \"거북이\", \"다람쥐\"]\n\n# 아래에 \"파이뱀\"을 추가하고, 친구 수를 출력하세요!\n\nprint()"'
  ),
  '{hints}',
  '{"level_1": "append()로 리스트에 새 친구를 추가할 수 있어요! friends.append()를 써보세요.", "level_2": "friends.append(\"파이뱀\")으로 추가하고, len(friends)로 몇 명인지 세어보세요!", "level_3": "friends.append(\"파이뱀\")\nprint(len(friends)) 이렇게 써보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000018';

-- 6-1 인사하는 함수: print 빈칸 + validation_type 변경
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 인사하는 함수를 만들어보세요!\ndef greet():\n    # \"안녕! 나는 파이뱀이야!\"를 출력하세요!\n    \n\ngreet()"'
  ),
  '{hints}',
  '{"level_1": "함수는 def 이름(): 으로 만들어요. 안에 실행할 코드를 써보세요!", "level_2": "def 아래에 들여쓰기를 하고 print()로 메시지를 출력해보세요!", "level_3": "print(\"안녕! 나는 파이뱀이야!\") 이렇게 빈 줄을 채워보세요!"}'::jsonb
),
validation_type = 'output_match',
expected_output = '안녕! 나는 파이뱀이야!'
WHERE id = 'b1000000-0000-0000-0000-000000000019';

-- 6-2 계산기 함수: return 빈칸
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 두 숫자를 더하는 함수를 만들어보세요!\ndef add(a, b):\n    # 두 숫자를 더한 결과를 return 하세요!\n    \n\nresult = add(7, 8)\nprint(result)"'
  ),
  '{hints}',
  '{"level_1": "함수 이름 옆 괄호 안의 a, b가 매개변수예요. 이 둘을 더하면?", "level_2": "return은 함수가 결과를 돌려주는 거예요. return a + b 이렇게!", "level_3": "return a + b 이렇게 빈 줄을 채워보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000020';

-- 6-3 최댓값 찾기: max() 빈칸
UPDATE public.quests
SET prompt_skeleton = jsonb_set(
  jsonb_set(prompt_skeleton,
    '{starter_code}',
    '"# 가장 큰 수를 찾아보세요!\nnumbers = [3, 7, 1, 9, 4]\nbiggest = \nprint(biggest)"'
  ),
  '{hints}',
  '{"level_1": "파이썬에는 이미 만들어진 편리한 함수들이 있어요! 가장 큰 값을 찾는 함수는?", "level_2": "max()는 가장 큰 값을 찾아줘요! max(numbers) 이렇게!", "level_3": "biggest = max(numbers) 이렇게 써보세요!"}'::jsonb
)
WHERE id = 'b1000000-0000-0000-0000-000000000021';
