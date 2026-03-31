-- pyRoad 커리큘럼 시드 데이터
-- 7개 스테이지 + 22개 퀘스트
-- Idempotent: ON CONFLICT (id) DO UPDATE 으로 재실행 가능

-- ============================================================
-- 스테이지 (7개)
-- UUID 규칙: a1000000-0000-0000-0000-00000000000N (N=1~7)
-- ============================================================

INSERT INTO public.stages (id, "order", title, theme_name, description, is_final)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 1, '파이썬 마을 입구', 'python_village', 'print()와 주석, 기본 입출력을 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000002', 2, '변수의 숲', 'variable_forest', '변수 선언, 자료형(int, str, float), 형변환을 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000003', 3, '조건의 갈림길', 'condition_crossroad', 'if/elif/else, 비교연산자, 논리연산자를 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000004', 4, '반복의 동굴', 'loop_cave', 'for, while, range(), break/continue를 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000005', 5, '리스트 호수', 'list_lake', '리스트 생성, 인덱싱, 슬라이싱, append, len을 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000006', 6, '함수의 탑', 'function_tower', 'def, 매개변수, return, 내장함수를 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000007', 7, '프로젝트 왕국', 'project_kingdom', '배운 모든 것을 모아 프로젝트를 완성해봐요!', TRUE)
ON CONFLICT (id) DO UPDATE SET
  "order" = EXCLUDED."order",
  title = EXCLUDED.title,
  theme_name = EXCLUDED.theme_name,
  description = EXCLUDED.description,
  is_final = EXCLUDED.is_final;

-- ============================================================
-- 퀘스트 (22개)
-- UUID 규칙: b1000000-0000-0000-0000-0000000000NN (NN=01~22)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 스테이지 1: 파이썬 마을 입구 (3 퀘스트, 150 XP)
-- ────────────────────────────────────────────────────────────

-- 퀘스트 1-1: 첫 번째 인사
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  1,
  '첫 번째 인사',
  'print()',
  '{
    "topic": "print() 함수로 출력하기",
    "learning_goals": ["print() 함수를 사용하여 텍스트를 출력할 수 있다", "따옴표 안에 원하는 텍스트를 넣을 수 있다"],
    "story_context": "파이썬 마을에 도착한 모험가가 마을 사람들에게 첫 인사를 하는 장면",
    "exercise_description": "print() 함수를 사용하여 \"안녕하세요!\"를 출력해보세요",
    "starter_code": "# 아래에 코드를 작성해보세요!\n",
    "expected_output_hint": "안녕하세요! 가 출력되어야 해요",
    "fallback_text": "print()는 화면에 글자를 보여주는 마법 주문이에요! print(\"안녕하세요!\") 이렇게 따옴표 안에 보여주고 싶은 말을 넣으면 돼요.",
    "hints": {
      "level_1": "화면에 글자를 보여주는 마법 주문이 있어요. 어떤 주문일까요?",
      "level_2": "print() 안에 따옴표로 감싼 글자를 넣으면 돼요!",
      "level_3": "print(\"안녕하세요!\") 이렇게 작성해보세요!"
    }
  }'::jsonb,
  'output_match',
  '안녕하세요!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-2: 내 소개를 해볼까?
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000001',
  2,
  '내 소개를 해볼까?',
  'print() 여러 줄',
  '{
    "topic": "print()를 여러 번 사용하여 여러 줄 출력하기",
    "learning_goals": ["print()를 여러 번 사용하여 여러 줄을 출력할 수 있다", "각 print()가 한 줄씩 출력하는 것을 이해한다"],
    "story_context": "마을 입구에서 자기소개를 하는 모험가. 마을 사람들이 이름과 인사를 기다리고 있어요!",
    "exercise_description": "print()를 두 번 사용하여 첫 줄에 \"나는 파이썬 모험가!\", 둘째 줄에 \"반가워!\"를 출력하세요",
    "starter_code": "# 두 줄을 출력해보세요!\n",
    "expected_output_hint": "두 줄이 출력되어야 해요: 나는 파이썬 모험가! 그리고 반가워!",
    "fallback_text": "print()를 두 번 쓰면 두 줄이 나와요! 첫 번째 print()에 첫 번째 문장을, 두 번째 print()에 두 번째 문장을 넣어보세요.",
    "hints": {
      "level_1": "print()를 한 번 쓰면 한 줄이 나와요. 두 줄을 쓰려면?",
      "level_2": "print(\"첫 번째 줄\")을 쓰고, 아래에 print(\"두 번째 줄\")을 써보세요!",
      "level_3": "print(\"나는 파이썬 모험가!\")\nprint(\"반가워!\") 이렇게 써보세요!"
    }
  }'::jsonb,
  'output_match',
  '나는 파이썬 모험가!
반가워!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-3: 주석으로 메모하기
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  3,
  '주석으로 메모하기',
  '주석(#), print()',
  '{
    "topic": "주석(#)의 역할과 사용법",
    "learning_goals": ["#으로 시작하는 줄이 주석임을 안다", "주석은 컴퓨터가 무시하고 사람만 읽는 메모임을 이해한다", "주석과 코드를 구분하여 작성할 수 있다"],
    "story_context": "마을의 게시판에 비밀 메모를 남기는 모험가. 주석으로 쓴 메모는 컴퓨터가 읽지 못해요!",
    "exercise_description": "첫 줄에 주석(#)으로 아무 메모나 남기고, 둘째 줄에 print()로 \"파이썬은 재미있어!\"를 출력하세요",
    "starter_code": "# 여기에 메모를 남겨보세요 (이 줄은 주석이에요!)\n",
    "expected_output_hint": "파이썬은 재미있어! 만 출력되어야 해요 (주석은 출력되지 않아요)",
    "fallback_text": "#으로 시작하는 줄은 주석이에요. 컴퓨터는 이 줄을 무시해요! 주석 아래에 print(\"파이썬은 재미있어!\")를 써보세요.",
    "hints": {
      "level_1": "# 뒤에 쓴 글은 컴퓨터가 무시해요. 진짜 실행되는 코드는 뭘까요?",
      "level_2": "주석 줄 아래에 print()로 문장을 출력해보세요!",
      "level_3": "# 이것은 메모예요\nprint(\"파이썬은 재미있어!\") 이렇게 써보세요!"
    }
  }'::jsonb,
  'output_match',
  '파이썬은 재미있어!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 2: 변수의 숲 (4 퀘스트, 200 XP)
-- ────────────────────────────────────────────────────────────

-- 퀘스트 2-1: 마법 상자에 이름 넣기
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000002',
  1,
  '마법 상자에 이름 넣기',
  '변수 선언',
  '{
    "topic": "변수 선언과 값 저장",
    "learning_goals": ["변수가 값을 담는 상자임을 이해한다", "= 기호로 변수에 값을 저장할 수 있다"],
    "story_context": "변수의 숲에서 마법 상자에 이름표를 붙이는 모험. 상자에 파이뱀의 이름을 넣어봐요!",
    "exercise_description": "name이라는 변수에 \"파이뱀\"을 저장하고 print(name)으로 출력하세요",
    "starter_code": "# 변수에 이름을 넣어보세요!\nname = \nprint(name)",
    "expected_output_hint": "파이뱀 이 출력되어야 해요",
    "fallback_text": "변수는 값을 담는 상자예요! name = \"파이뱀\" 이렇게 상자에 이름표를 붙이고 값을 넣을 수 있어요.",
    "hints": {
      "level_1": "변수는 상자에 이름표를 붙이는 거예요. name이라는 상자에 뭘 넣을까요?",
      "level_2": "= 기호 오른쪽에 따옴표로 감싼 텍스트를 넣으면 돼요!",
      "level_3": "name = \"파이뱀\" 이렇게 따옴표 안에 이름을 넣어보세요!"
    }
  }'::jsonb,
  'contains',
  '파이뱀',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-2: 숫자 상자와 글자 상자
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000002',
  2,
  '숫자 상자와 글자 상자',
  'int, str 자료형',
  '{
    "topic": "정수(int)와 문자열(str) 자료형",
    "learning_goals": ["숫자는 따옴표 없이, 글자는 따옴표로 감싸서 저장하는 것을 안다", "int와 str이 다른 종류의 상자임을 이해한다"],
    "story_context": "숲 속 두 종류의 마법 상자를 발견! 숫자 상자와 글자 상자를 구분해봐요.",
    "exercise_description": "number 변수에 10을, greeting 변수에 \"안녕\"을 저장하고 각각 print()로 출력하세요",
    "starter_code": "# 숫자와 글자를 각각 변수에 넣어보세요!\nnumber = \ngreeting = \nprint(number)\nprint(greeting)",
    "expected_output_hint": "10과 안녕이 한 줄씩 출력되어야 해요",
    "fallback_text": "숫자는 따옴표 없이 number = 10, 글자는 따옴표와 함께 greeting = \"안녕\" 이렇게 넣어요!",
    "hints": {
      "level_1": "숫자는 그냥 쓰고, 글자는 따옴표로 감싸야 해요!",
      "level_2": "number = 10 이렇게 숫자는 따옴표 없이, greeting = \"안녕\" 이렇게 글자는 따옴표와 함께!",
      "level_3": "number = 10\ngreeting = \"안녕\" 이렇게 써보세요!"
    }
  }'::jsonb,
  'output_match',
  '10
안녕',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-3: 나이 계산기
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000006',
  'a1000000-0000-0000-0000-000000000002',
  3,
  '나이 계산기',
  'int 연산',
  '{
    "topic": "정수 변수의 사칙연산",
    "learning_goals": ["변수에 저장된 숫자로 덧셈, 뺄셈 등을 할 수 있다", "연산 결과를 새 변수에 저장할 수 있다"],
    "story_context": "숲 속 나이를 알려주는 마법 거울! 태어난 해를 넣으면 나이를 계산해줘요.",
    "exercise_description": "birth_year 변수에 자기 태어난 해를 넣고, age = 2026 - birth_year로 나이를 계산한 뒤, print(age, \"살\")로 출력하세요",
    "starter_code": "# 나이를 계산해보세요!\nbirth_year = \nage = 2026 - birth_year\nprint(age, \"살\")",
    "expected_output_hint": "숫자와 살 이 출력되어야 해요 (예: 12 살)",
    "fallback_text": "birth_year = 2014 이렇게 태어난 해를 넣으면 age = 2026 - 2014로 나이가 계산돼요!",
    "hints": {
      "level_1": "birth_year에 태어난 해를 숫자로 넣어보세요!",
      "level_2": "birth_year = 2014 처럼 따옴표 없이 숫자만 넣으면 돼요!",
      "level_3": "birth_year = 2014 이렇게 넣어보세요! (자기 태어난 해로 바꿔도 돼요)"
    }
  }'::jsonb,
  'contains',
  '살',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-4: 변신 마법! 형변환
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000007',
  'a1000000-0000-0000-0000-000000000002',
  4,
  '변신 마법! 형변환',
  'str(), int() 형변환',
  '{
    "topic": "자료형 변환 (str -> int, int -> str)",
    "learning_goals": ["int()로 문자열을 숫자로 바꿀 수 있다", "str()로 숫자를 문자열로 바꿀 수 있다", "형변환이 필요한 상황을 이해한다"],
    "story_context": "변신 마법사를 만났어요! 글자를 숫자로, 숫자를 글자로 변신시킬 수 있대요.",
    "exercise_description": "문자열 \"100\"과 \"23\"을 int()로 숫자로 바꿔서 더한 뒤 결과를 출력하세요",
    "starter_code": "# 문자열을 숫자로 바꿔서 더해보세요!\na = \"100\"\nb = \"23\"\nresult = int(a) + int(b)\nprint(result)",
    "expected_output_hint": "123이 출력되어야 해요",
    "fallback_text": "\"100\"은 글자예요. int(\"100\")으로 숫자 100으로 변신시킬 수 있어요! 숫자끼리는 더할 수 있지요.",
    "hints": {
      "level_1": "따옴표가 있으면 글자, 없으면 숫자예요. 글자를 숫자로 바꾸려면?",
      "level_2": "int() 안에 문자열을 넣으면 숫자로 변신해요!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'output_match',
  '123',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 3: 조건의 갈림길 (4 퀘스트, 200 XP)
-- ────────────────────────────────────────────────────────────

-- 퀘스트 3-1: 비밀번호를 맞춰라!
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000008',
  'a1000000-0000-0000-0000-000000000003',
  1,
  '비밀번호를 맞춰라!',
  'if/else',
  '{
    "topic": "if/else 조건문",
    "learning_goals": ["if 문으로 조건을 검사할 수 있다", "else로 조건이 거짓일 때 실행할 코드를 작성할 수 있다", "== 비교 연산자를 사용할 수 있다"],
    "story_context": "갈림길의 비밀 문 앞에 섰어요! 올바른 비밀번호를 입력해야 문이 열려요.",
    "exercise_description": "password 변수에 \"열려라\"를 저장하고, if문으로 password가 \"열려라\"와 같으면 \"통과!\"를 출력하세요",
    "starter_code": "# 비밀번호를 확인하는 코드를 작성해보세요!\npassword = \"열려라\"\n\nif password == \"열려라\":\n    print()",
    "expected_output_hint": "통과! 가 출력되어야 해요",
    "fallback_text": "if는 \"만약 ~라면\"이에요! if password == \"열려라\": 이렇게 조건을 쓰고, 다음 줄에 들여쓰기 후 실행할 코드를 써요.",
    "hints": {
      "level_1": "if 뒤에 조건을 쓰고, 조건이 맞으면 아래 코드가 실행돼요!",
      "level_2": "print() 안에 \"통과!\"를 넣어보세요!",
      "level_3": "print(\"통과!\") 이렇게 써보세요!"
    }
  }'::jsonb,
  'output_match',
  '통과!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-2: 성적표 만들기
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000009',
  'a1000000-0000-0000-0000-000000000003',
  2,
  '성적표 만들기',
  'if/elif/else',
  '{
    "topic": "if/elif/else 다중 조건문",
    "learning_goals": ["elif로 여러 조건을 순서대로 검사할 수 있다", "if/elif/else의 실행 흐름을 이해한다"],
    "story_context": "갈림길의 마법 성적표! 점수에 따라 다른 등급이 나와요.",
    "exercise_description": "score = 85일 때, 90 이상이면 \"등급: A\", 80 이상이면 \"등급: B\", 그 외에는 \"등급: C\"를 출력하세요",
    "starter_code": "# 점수에 따라 등급을 매겨보세요!\nscore = 85\n\nif score >= 90:\n    print(\"등급: A\")\nelif score >= 80:\n    print()\nelse:\n    print(\"등급: C\")",
    "expected_output_hint": "등급: B 가 출력되어야 해요",
    "fallback_text": "elif는 \"그렇지 않고 만약 ~라면\"이에요! 위의 조건이 안 맞으면 다음 elif 조건을 확인해요.",
    "hints": {
      "level_1": "score가 85이면 90 이상인가요? 아니라면 80 이상인가요?",
      "level_2": "85는 90보다 작지만 80보다 크니까 elif 조건에 해당해요!",
      "level_3": "print(\"등급: B\") 이렇게 비어있는 print() 안을 채워보세요!"
    }
  }'::jsonb,
  'contains',
  '등급',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-3: 놀이공원 입장
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000010',
  'a1000000-0000-0000-0000-000000000003',
  3,
  '놀이공원 입장',
  '비교연산자 (>=, <=, >, <)',
  '{
    "topic": "비교연산자로 조건 만들기",
    "learning_goals": [">=, <=, >, < 비교연산자를 사용할 수 있다", "비교 결과가 True/False임을 이해한다"],
    "story_context": "놀이공원에 가려면 키가 120cm 이상이어야 해요! 키를 재볼까요?",
    "exercise_description": "height = 130일 때, height >= 120이면 \"입장 가능!\"을 출력하세요",
    "starter_code": "# 키를 확인하는 코드를 작성해보세요!\nheight = 130\n\nif height >= 120:\n    print()",
    "expected_output_hint": "입장 가능! 이 출력되어야 해요",
    "fallback_text": ">= 는 \"크거나 같다\"는 뜻이에요! height >= 120은 키가 120 이상인지 물어보는 거예요.",
    "hints": {
      "level_1": ">= 기호는 \"크거나 같다\"는 뜻이에요. 130은 120보다 크거나 같나요?",
      "level_2": "조건이 맞으니까 print() 안에 출력할 메시지를 넣으면 돼요!",
      "level_3": "print(\"입장 가능!\") 이렇게 써보세요!"
    }
  }'::jsonb,
  'output_match',
  '입장 가능!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-4: 마법사의 조건
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000011',
  'a1000000-0000-0000-0000-000000000003',
  4,
  '마법사의 조건',
  'and/or/not 논리연산자',
  '{
    "topic": "논리연산자 and, or, not",
    "learning_goals": ["and는 두 조건이 모두 참일 때 참이 되는 것을 안다", "or는 하나만 참이어도 참이 되는 것을 안다", "논리연산자로 복합 조건을 만들 수 있다"],
    "story_context": "마법사가 되려면 두 가지 시험을 모두 통과해야 해요! 마법 점수와 용기 점수가 모두 높아야 해요.",
    "exercise_description": "magic = 80, courage = 70일 때, 둘 다 60 이상이면 \"마법사 합격!\"을 출력하세요",
    "starter_code": "# 마법사 자격을 확인해보세요!\nmagic = 80\ncourage = 70\n\nif magic >= 60 and courage >= 60:\n    print()",
    "expected_output_hint": "마법사 합격! 이 출력되어야 해요",
    "fallback_text": "and는 \"그리고\"예요! magic >= 60 and courage >= 70은 \"마법 점수가 60 이상이고 용기 점수도 60 이상\"이라는 뜻이에요.",
    "hints": {
      "level_1": "and는 두 조건을 모두 만족해야 해요. 80은 60 이상이고, 70도 60 이상인가요?",
      "level_2": "두 조건 모두 맞으니까 print() 안에 합격 메시지를 넣으면 돼요!",
      "level_3": "print(\"마법사 합격!\") 이렇게 써보세요!"
    }
  }'::jsonb,
  'output_match',
  '마법사 합격!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 4: 반복의 동굴 (4 퀘스트, 200 XP)
-- ────────────────────────────────────────────────────────────

-- 퀘스트 4-1: 숫자 세기
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000012',
  'a1000000-0000-0000-0000-000000000004',
  1,
  '숫자 세기',
  'for, range()',
  '{
    "topic": "for 반복문과 range() 함수",
    "learning_goals": ["for 반복문의 구조를 이해한다", "range()로 숫자 범위를 만들 수 있다", "반복문 안의 코드가 여러 번 실행되는 것을 안다"],
    "story_context": "동굴 입구에서 마법 숫자를 세어야 문이 열려요! 1부터 5까지 세어볼까요?",
    "exercise_description": "for 반복문과 range()를 사용하여 1부터 5까지 한 줄에 하나씩 출력하세요",
    "starter_code": "# 1부터 5까지 세어보세요!\nfor i in range(1, 6):\n    print(i)",
    "expected_output_hint": "1, 2, 3, 4, 5가 한 줄씩 출력되어야 해요",
    "fallback_text": "for i in range(1, 6)은 i가 1, 2, 3, 4, 5로 바뀌면서 아래 코드를 반복해요! range(1, 6)은 1부터 5까지예요 (6은 포함 안 돼요).",
    "hints": {
      "level_1": "for는 같은 일을 여러 번 반복해주는 마법이에요!",
      "level_2": "range(1, 6)은 1, 2, 3, 4, 5를 만들어줘요. 6은 포함되지 않아요!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'output_match',
  '1
2
3
4
5',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-2: 구구단 외우기
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000013',
  'a1000000-0000-0000-0000-000000000004',
  2,
  '구구단 외우기',
  'for 반복문 활용',
  '{
    "topic": "for 반복문으로 구구단 출력하기",
    "learning_goals": ["for 반복문을 활용하여 패턴을 출력할 수 있다", "변수를 활용한 계산식을 반복문에서 사용할 수 있다"],
    "story_context": "동굴의 마법사가 구구단 시험을 내요! 2단을 외워볼까요?",
    "exercise_description": "for 반복문으로 2단 구구단(2x1=2부터 2x9=18)을 출력하세요. 형식: 2 x 1 = 2",
    "starter_code": "# 2단 구구단을 출력해보세요!\nfor i in range(1, 10):\n    print(2, \"x\", i, \"=\", 2 * i)",
    "expected_output_hint": "2 x 1 = 2 부터 2 x 9 = 18 까지 출력되어야 해요",
    "fallback_text": "for i in range(1, 10)으로 i가 1부터 9까지 바뀌면서 2 * i를 계산해요! print(2, \"x\", i, \"=\", 2*i)로 예쁘게 출력할 수 있어요.",
    "hints": {
      "level_1": "구구단은 같은 숫자에 1, 2, 3, ... 9를 곱하는 거예요!",
      "level_2": "range(1, 10)으로 1부터 9까지 반복하고, 2 * i로 곱해보세요!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'contains',
  '= 6',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-3: 보물 찾기
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000014',
  'a1000000-0000-0000-0000-000000000004',
  3,
  '보물 찾기',
  'while, break',
  '{
    "topic": "while 반복문과 break",
    "learning_goals": ["while 반복문의 구조를 이해한다", "break로 반복문을 중간에 멈출 수 있다", "조건이 거짓이 될 때까지 반복하는 것을 안다"],
    "story_context": "동굴 속에서 보물을 찾아 헤매는 모험가! 보물을 찾으면 멈춰야 해요.",
    "exercise_description": "위치를 1부터 하나씩 늘려가며 위치가 5일 때 \"보물 발견!\"을 출력하고 반복을 멈추세요",
    "starter_code": "# 보물을 찾아보세요!\nposition = 1\n\nwhile position <= 10:\n    if position == 5:\n        print(\"보물 발견!\")\n        break\n    position = position + 1",
    "expected_output_hint": "보물 발견! 이 출력되어야 해요",
    "fallback_text": "while은 조건이 맞는 동안 계속 반복해요. break를 만나면 반복을 멈춰요! if position == 5: 에서 보물을 찾으면 break로 탈출!",
    "hints": {
      "level_1": "while은 조건이 참인 동안 계속 반복해요. 언제 멈춰야 할까요?",
      "level_2": "position이 5가 되면 break로 반복을 멈추면 돼요!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'contains',
  '보물 발견!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-4: 짝수만 골라내기
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000015',
  'a1000000-0000-0000-0000-000000000004',
  4,
  '짝수만 골라내기',
  'for, if, continue',
  '{
    "topic": "continue로 특정 반복 건너뛰기",
    "learning_goals": ["continue가 현재 반복만 건너뛰는 것을 안다", "% (나머지) 연산자를 사용할 수 있다", "for와 if를 조합하여 필터링할 수 있다"],
    "story_context": "동굴의 마법 필터! 짝수만 통과시키고 홀수는 막아요.",
    "exercise_description": "1부터 10까지 반복하면서 짝수만 출력하세요 (홀수는 continue로 건너뛰기)",
    "starter_code": "# 짝수만 출력해보세요!\nfor i in range(1, 11):\n    if i % 2 != 0:\n        continue\n    print(i)",
    "expected_output_hint": "2, 4, 6, 8, 10이 한 줄씩 출력되어야 해요",
    "fallback_text": "% 는 나머지를 구하는 연산자예요! i % 2 != 0은 홀수라는 뜻이에요. continue를 만나면 아래 코드를 건너뛰고 다음 반복으로 가요.",
    "hints": {
      "level_1": "짝수는 2로 나누어 떨어지는 숫자예요. 나머지가 0!",
      "level_2": "i % 2 != 0이면 홀수니까 continue로 건너뛰면 돼요!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'output_match',
  '2
4
6
8
10',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 5: 리스트 호수 (3 퀘스트, 150 XP)
-- ────────────────────────────────────────────────────────────

-- 퀘스트 5-1: 과일 바구니
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000016',
  'a1000000-0000-0000-0000-000000000005',
  1,
  '과일 바구니',
  '리스트 생성',
  '{
    "topic": "리스트 생성과 출력",
    "learning_goals": ["대괄호 []로 리스트를 만들 수 있다", "리스트에 여러 값을 저장할 수 있다", "리스트 전체를 출력할 수 있다"],
    "story_context": "호수 옆 과일 가게에서 과일 바구니를 만들어요! 좋아하는 과일을 담아봐요.",
    "exercise_description": "fruits라는 리스트에 \"사과\", \"바나나\", \"포도\"를 넣고 출력하세요",
    "starter_code": "# 과일 바구니를 만들어보세요!\nfruits = [\"사과\", \"바나나\", \"포도\"]\nprint(fruits)",
    "expected_output_hint": "사과, 바나나, 포도가 리스트로 출력되어야 해요",
    "fallback_text": "리스트는 여러 값을 한 상자에 담는 거예요! [\"사과\", \"바나나\", \"포도\"] 이렇게 대괄호 안에 쉼표로 구분해서 넣어요.",
    "hints": {
      "level_1": "리스트는 대괄호 [] 안에 값을 넣어 만들어요!",
      "level_2": "각 과일을 따옴표로 감싸고 쉼표로 구분해요!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'contains',
  '사과',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-2: 보물 목록 정리
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000017',
  'a1000000-0000-0000-0000-000000000005',
  2,
  '보물 목록 정리',
  '인덱싱, 슬라이싱',
  '{
    "topic": "리스트 인덱싱과 슬라이싱",
    "learning_goals": ["인덱스 번호로 리스트의 특정 값을 꺼낼 수 있다", "인덱스가 0부터 시작하는 것을 안다", "슬라이싱으로 리스트의 일부를 잘라낼 수 있다"],
    "story_context": "보물 목록에서 원하는 보물을 골라내봐요! 몇 번째 보물을 꺼낼까요?",
    "exercise_description": "treasures 리스트에서 인덱스를 사용하여 \"다이아몬드\"를 출력하세요",
    "starter_code": "# 보물 목록에서 다이아몬드를 꺼내보세요!\ntreasures = [\"금화\", \"은화\", \"다이아몬드\", \"루비\"]\nprint(treasures[2])",
    "expected_output_hint": "다이아몬드 가 출력되어야 해요",
    "fallback_text": "리스트의 번호는 0부터 시작해요! treasures[0]은 금화, treasures[1]은 은화, treasures[2]는 다이아몬드예요.",
    "hints": {
      "level_1": "리스트의 번호(인덱스)는 0부터 시작해요. 다이아몬드는 몇 번째일까요?",
      "level_2": "금화=0, 은화=1, 다이아몬드=2! treasures[2]로 꺼낼 수 있어요.",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'output_match',
  '다이아몬드',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-3: 친구 목록 관리
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000018',
  'a1000000-0000-0000-0000-000000000005',
  3,
  '친구 목록 관리',
  'append(), len()',
  '{
    "topic": "리스트에 추가하기(append)와 길이 구하기(len)",
    "learning_goals": ["append()로 리스트에 새 값을 추가할 수 있다", "len()으로 리스트의 길이를 구할 수 있다"],
    "story_context": "호수 마을에서 새 친구를 만났어요! 친구 목록에 추가하고 몇 명인지 세어봐요.",
    "exercise_description": "friends 리스트에 \"파이뱀\"을 append하고, len()으로 친구 수를 출력하세요",
    "starter_code": "# 친구를 추가하고 몇 명인지 세어보세요!\nfriends = [\"토끼\", \"거북이\", \"다람쥐\"]\nfriends.append(\"파이뱀\")\nprint(len(friends))",
    "expected_output_hint": "4 가 출력되어야 해요 (3명 + 파이뱀 1명)",
    "fallback_text": "append()는 리스트 끝에 새 값을 추가해요! len()은 리스트에 몇 개가 있는지 세어줘요.",
    "hints": {
      "level_1": "append()로 리스트에 새 친구를 추가할 수 있어요!",
      "level_2": "len()은 리스트의 길이(개수)를 알려줘요!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'contains',
  '4',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 6: 함수의 탑 (3 퀘스트, 150 XP)
-- ────────────────────────────────────────────────────────────

-- 퀘스트 6-1: 인사하는 함수
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000019',
  'a1000000-0000-0000-0000-000000000006',
  1,
  '인사하는 함수',
  'def, 함수 호출',
  '{
    "topic": "함수 정의(def)와 호출",
    "learning_goals": ["def 키워드로 함수를 만들 수 있다", "만든 함수를 호출하여 실행할 수 있다", "함수가 코드를 묶어서 재사용하는 것임을 이해한다"],
    "story_context": "탑의 마법사에게 인사 마법을 배워요! 한 번 만들면 여러 번 사용할 수 있어요.",
    "exercise_description": "greet라는 함수를 만들어 \"안녕! 나는 파이뱀이야!\"를 출력하고, 함수를 호출하세요",
    "starter_code": "# 인사하는 함수를 만들어보세요!\ndef greet():\n    print(\"안녕! 나는 파이뱀이야!\")\n\ngreet()",
    "expected_output_hint": "안녕! 나는 파이뱀이야! 가 출력되어야 해요",
    "fallback_text": "def greet(): 으로 함수를 만들고, 안에 실행할 코드를 쓴 뒤, greet()으로 호출해요! 함수는 코드를 묶어놓은 마법 주문서예요.",
    "hints": {
      "level_1": "함수는 def 이름(): 으로 만들어요. 마법 주문서를 만드는 거예요!",
      "level_2": "def 아래에 들여쓰기를 하고 실행할 코드를 써요. 그리고 함수이름()으로 실행!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'code_check',
  'def',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-2: 계산기 함수
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000020',
  'a1000000-0000-0000-0000-000000000006',
  2,
  '계산기 함수',
  '매개변수, return',
  '{
    "topic": "매개변수와 return으로 값 돌려주기",
    "learning_goals": ["함수에 매개변수로 값을 전달할 수 있다", "return으로 함수가 결과를 돌려주는 것을 이해한다"],
    "story_context": "탑의 마법 계산기! 두 숫자를 넣으면 합계를 알려줘요.",
    "exercise_description": "add라는 함수를 만들어 두 숫자를 받아 합계를 return하고, add(7, 8)의 결과를 출력하세요",
    "starter_code": "# 두 숫자를 더하는 함수를 만들어보세요!\ndef add(a, b):\n    return a + b\n\nresult = add(7, 8)\nprint(result)",
    "expected_output_hint": "15 가 출력되어야 해요",
    "fallback_text": "매개변수는 함수에 전달하는 값이에요! def add(a, b): 에서 a, b가 매개변수이고, return a + b로 합계를 돌려줘요.",
    "hints": {
      "level_1": "함수 이름 옆 괄호 안에 받을 값의 이름을 써요!",
      "level_2": "return은 함수가 결과를 돌려주는 거예요. return a + b 이렇게!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'output_match',
  '15',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-3: 최댓값 찾기
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000021',
  'a1000000-0000-0000-0000-000000000006',
  3,
  '최댓값 찾기',
  '내장함수 max(), min()',
  '{
    "topic": "파이썬 내장함수 max()와 min()",
    "learning_goals": ["max()로 가장 큰 값을 찾을 수 있다", "min()로 가장 작은 값을 찾을 수 있다", "파이썬에 이미 만들어진 함수가 있다는 것을 안다"],
    "story_context": "탑 꼭대기에서 마법 숫자들 중 가장 큰 숫자를 찾는 시험! 파이썬의 내장함수를 사용해봐요.",
    "exercise_description": "numbers 리스트에서 max()를 사용하여 가장 큰 수를 출력하세요",
    "starter_code": "# 가장 큰 수를 찾아보세요!\nnumbers = [3, 7, 1, 9, 4]\nbiggest = max(numbers)\nprint(biggest)",
    "expected_output_hint": "9 가 출력되어야 해요",
    "fallback_text": "max()는 가장 큰 값을 찾아주는 내장함수예요! max([3, 7, 1, 9, 4])는 9를 돌려줘요. min()은 반대로 가장 작은 값을 찾아줘요.",
    "hints": {
      "level_1": "파이썬에는 이미 만들어진 편리한 함수들이 있어요!",
      "level_2": "max()는 가장 큰 값, min()은 가장 작은 값을 찾아줘요!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'output_match',
  '9',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 7: 프로젝트 왕국 (1 퀘스트, 200 XP)
-- ────────────────────────────────────────────────────────────

-- 퀘스트 7-1: 숫자 맞추기 게임
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000022',
  'a1000000-0000-0000-0000-000000000007',
  1,
  '숫자 맞추기 게임',
  '종합 프로젝트',
  '{
    "topic": "종합 프로젝트: 숫자 맞추기 게임 만들기",
    "learning_goals": ["배운 모든 개념(변수, 조건, 반복, 함수)을 조합할 수 있다", "프로그램을 단계적으로 설계하고 구현할 수 있다", "완성된 프로그램을 만드는 경험을 쌓는다"],
    "story_context": "프로젝트 왕국의 최종 관문! 배운 모든 것을 모아 숫자 맞추기 게임을 완성하면 코딩 마법사가 돼요!",
    "exercise_description": "1~10 사이의 비밀 숫자를 맞추는 게임을 만드세요. while 반복문으로 맞출 때까지 반복하고, 맞추면 축하 메시지를 출력하세요.",
    "starter_code": "# 숫자 맞추기 게임을 만들어보세요!\nimport random\n\nsecret = random.randint(1, 10)\nguess = 0\nattempts = 0\n\nwhile guess != secret:\n    guess = random.randint(1, 10)  # 실제로는 input()을 쓰지만 자동 실행을 위해 random 사용\n    attempts = attempts + 1\n    if guess == secret:\n        print(\"정답! \" + str(attempts) + \"번 만에 맞췄어요!\")\n    elif guess < secret:\n        print(str(guess) + \"보다 커요!\")\n    else:\n        print(str(guess) + \"보다 작아요!\")",
    "expected_output_hint": "정답! N번 만에 맞췄어요! 가 출력되어야 해요",
    "fallback_text": "이 프로젝트는 변수, 조건문, 반복문, 함수를 모두 활용해요! while로 반복하고, if로 정답을 확인하고, 변수로 시도 횟수를 기록해요.",
    "hints": {
      "level_1": "while은 조건이 참인 동안 계속 반복해요. 언제까지 반복할까요?",
      "level_2": "guess != secret 동안 반복하면 정답을 맞출 때까지 계속할 수 있어요!",
      "level_3": "코드가 이미 완성되어 있어요! 그대로 실행해보세요!"
    }
  }'::jsonb,
  'code_check',
  'while',
  200
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;
