-- pyRoad 커리큘럼 시드 데이터
-- 7개 스테이지 + 44개 퀘스트
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
-- 기존 퀘스트 order 사전 업데이트 (unique constraint 충돌 방지)
-- 큰 order부터 업데이트하여 중간 충돌 방지
-- ============================================================

-- Stage 1: NN=03 (3→4)
UPDATE public.quests SET "order" = 4 WHERE id = 'b1000000-0000-0000-0000-000000000003';

-- Stage 2: NN=07 (4→6) 먼저, 그 다음 NN=06 (3→4)
UPDATE public.quests SET "order" = 6 WHERE id = 'b1000000-0000-0000-0000-000000000007';
UPDATE public.quests SET "order" = 4 WHERE id = 'b1000000-0000-0000-0000-000000000006';

-- Stage 3: NN=11 (4→5), NN=10 (3→4), NN=09 (2→3) — 큰 것부터
UPDATE public.quests SET "order" = 5 WHERE id = 'b1000000-0000-0000-0000-000000000011';
UPDATE public.quests SET "order" = 4 WHERE id = 'b1000000-0000-0000-0000-000000000010';
UPDATE public.quests SET "order" = 3 WHERE id = 'b1000000-0000-0000-0000-000000000009';

-- Stage 4: NN=15 (4→6), NN=14 (3→5) — 큰 것부터
UPDATE public.quests SET "order" = 6 WHERE id = 'b1000000-0000-0000-0000-000000000015';
UPDATE public.quests SET "order" = 5 WHERE id = 'b1000000-0000-0000-0000-000000000014';

-- Stage 5: NN=18 (3→4)
UPDATE public.quests SET "order" = 4 WHERE id = 'b1000000-0000-0000-0000-000000000018';

-- Stage 6: NN=21 (3→4)
UPDATE public.quests SET "order" = 4 WHERE id = 'b1000000-0000-0000-0000-000000000021';

-- ============================================================
-- 퀘스트 (44개)
-- UUID 규칙: b1000000-0000-0000-0000-0000000000NN (NN=01~44)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 스테이지 1: 파이썬 마을 입구 (7 퀘스트, 350 XP)
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
      "level_3": "print(\"___\") 여기서 ___에 인사말을 넣어보세요!"
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
      "level_3": "print(\"___\")\nprint(\"___\") 두 줄에 각각 자기소개와 인사를 넣어보세요!"
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

-- 퀘스트 1-3: 따옴표의 비밀 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000023',
  'a1000000-0000-0000-0000-000000000001',
  3,
  '따옴표의 비밀',
  '작은따옴표, 큰따옴표',
  '{
    "topic": "작은따옴표와 큰따옴표의 차이",
    "learning_goals": ["작은따옴표와 큰따옴표 모두 문자열을 만들 수 있다", "문자열 안에 따옴표가 포함될 때 다른 종류의 따옴표로 감싸야 함을 안다"],
    "story_context": "파이썬 마을의 따옴표 가게에 왔어요! 작은따옴표와 큰따옴표, 언제 어떤 걸 써야 할까요?",
    "exercise_description": "print()를 사용하여 I''m happy! 를 출력해보세요. 큰따옴표로 감싸면 안에 작은따옴표를 쓸 수 있어요!",
    "starter_code": "# I''m happy! 를 출력해보세요!\n# 힌트: 큰따옴표로 감싸보세요!\n",
    "expected_output_hint": "I''m happy! 가 출력되어야 해요",
    "fallback_text": "문자열 안에 작은따옴표(  ''  )가 있으면 큰따옴표(\")로 감싸면 돼요! print(\"I''m happy!\") 이렇게요.",
    "hints": {
      "level_1": "글자 안에 작은따옴표가 있으면, 바깥을 큰따옴표로 감싸야 해요!",
      "level_2": "print(\"I''m happy!\") 이렇게 큰따옴표로 감싸보세요!",
      "level_3": "print(\"___\") 큰따옴표 안에 I''m happy!를 넣어보세요!"
    }
  }'::jsonb,
  'output_match',
  'I''m happy!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-4: 주석으로 메모하기 (기존 NN=03, order 3→4)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  4,
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
      "level_3": "# ___\nprint(\"___\") 주석에 메모를, print에 문장을 넣어보세요!"
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

-- 퀘스트 1-5: 특수문자 출력하기 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000024',
  'a1000000-0000-0000-0000-000000000001',
  5,
  '특수문자 출력하기',
  '이스케이프 문자 \\n',
  '{
    "topic": "이스케이프 문자 \\n으로 줄바꿈하기",
    "learning_goals": ["\\n이 줄바꿈을 뜻하는 특수 문자임을 안다", "print() 한 번으로 여러 줄을 출력할 수 있다"],
    "story_context": "파이썬 마을의 마법 편지지! \\n을 쓰면 편지가 두 줄로 나뉘어요.",
    "exercise_description": "print()를 한 번만 사용하여 \"첫째 줄\"과 \"둘째 줄\"을 두 줄로 출력하세요. \\n을 사용해요!",
    "starter_code": "# print()를 한 번만 사용해서 두 줄로 출력해보세요!\n# 힌트: \\n은 줄바꿈이에요!\n",
    "expected_output_hint": "첫째 줄과 둘째 줄이 각각 다른 줄에 출력되어야 해요",
    "fallback_text": "\\n은 줄바꿈을 뜻하는 특수 문자예요! print(\"첫째 줄\\n둘째 줄\") 이렇게 쓰면 두 줄로 나뉘어서 출력돼요.",
    "hints": {
      "level_1": "\\n이라는 특별한 글자를 쓰면 그 자리에서 줄이 바뀌어요!",
      "level_2": "print(\"첫째 줄\\n둘째 줄\") 이렇게 \\n을 중간에 넣어보세요!",
      "level_3": "print(\"___\\n___\") \\n 앞뒤에 각각 문장을 넣어보세요!"
    }
  }'::jsonb,
  'output_match',
  '첫째 줄
둘째 줄',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-6: 숫자도 출력해요 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000025',
  'a1000000-0000-0000-0000-000000000001',
  6,
  '숫자도 출력해요',
  'print()로 숫자 출력',
  '{
    "topic": "print()로 숫자 출력하기",
    "learning_goals": ["print()로 숫자를 출력할 수 있다", "숫자는 따옴표 없이 쓰는 것을 안다"],
    "story_context": "파이썬 마을의 시계탑에 올해 연도를 새겨야 해요! 숫자를 출력해볼까요?",
    "exercise_description": "print()로 숫자 2026을 출력하세요. 따옴표 없이 숫자만 넣어보세요!",
    "starter_code": "# 숫자 2026을 출력해보세요!\n# 힌트: 따옴표 없이 숫자만 넣으면 돼요!\n",
    "expected_output_hint": "2026 이 출력되어야 해요",
    "fallback_text": "print() 안에 따옴표 없이 숫자를 넣으면 숫자가 그대로 출력돼요! print(2026) 이렇게요.",
    "hints": {
      "level_1": "글자는 따옴표가 필요하지만, 숫자는 따옴표 없이 바로 쓸 수 있어요!",
      "level_2": "print(2026) 이렇게 따옴표 없이 숫자만 넣어보세요!",
      "level_3": "print(___) 괄호 안에 올해 연도 숫자를 넣어보세요!"
    }
  }'::jsonb,
  'output_match',
  '2026',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-7: 마을 안내판 만들기 (신규, 챌린지)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000026',
  'a1000000-0000-0000-0000-000000000001',
  7,
  '마을 안내판 만들기',
  'print() 종합',
  '{
    "topic": "print() 종합 활용",
    "learning_goals": ["주석과 print()를 자유롭게 사용할 수 있다", "문자열과 숫자를 print()로 출력할 수 있다", "여러 줄을 출력하여 의미 있는 결과물을 만들 수 있다"],
    "story_context": "파이썬 마을에 새 안내판을 세워야 해요! 주석으로 설명을 달고, print()로 멋진 안내판을 만들어봐요!",
    "exercise_description": "주석 1줄을 쓰고, print()를 3번 사용하여 마을 안내판을 만드세요. 첫 줄: === 파이썬 마을 ===, 둘째 줄: 인구: 2026명, 셋째 줄: 환영합니다!",
    "starter_code": "# 마을 안내판을 만들어보세요!\n# 주석 1줄 + print() 3줄로 완성!\n",
    "expected_output_hint": "=== 파이썬 마을 ===, 인구: 2026명, 환영합니다! 가 각각 한 줄씩 출력되어야 해요",
    "fallback_text": "주석으로 설명을 달고, print()를 3번 사용해서 안내판을 만들어요! 각 줄에 다른 내용을 넣어보세요.",
    "hints": {
      "level_1": "print()를 3번 써서 3줄을 출력해야 해요. 각각 어떤 내용을 넣을까요?",
      "level_2": "print(\"=== 파이썬 마을 ===\")부터 시작해보세요!",
      "level_3": "# 안내판\nprint(\"=== 파이썬 마을 ===\")\nprint(\"인구: ___명\")\nprint(\"___\")"
    },
    "is_challenge": true
  }'::jsonb,
  'output_match',
  '=== 파이썬 마을 ===
인구: 2026명
환영합니다!',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 2: 변수의 숲 (7 퀘스트, 375 XP)
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
      "level_3": "name = \"___\" 따옴표 안에 이름을 넣어보세요!"
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
      "level_3": "number = ___\ngreeting = \"___\" 숫자와 글자를 각각 넣어보세요!"
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

-- 퀘스트 2-3: 상자 이름 바꾸기 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000027',
  'a1000000-0000-0000-0000-000000000002',
  3,
  '상자 이름 바꾸기',
  '변수 재할당',
  '{
    "topic": "변수 재할당 (값 바꾸기)",
    "learning_goals": ["변수에 새로운 값을 다시 넣을 수 있다", "변수의 값은 언제든 바꿀 수 있음을 이해한다"],
    "story_context": "변수의 숲에서 마법 상자의 내용물을 바꿔볼까요? 상자 안의 색깔을 바꿔봐요!",
    "exercise_description": "color 변수에 \"빨강\"을 저장한 후, \"파랑\"으로 바꾸고 print()로 출력하세요",
    "starter_code": "# 색깔을 바꿔보세요!\ncolor = \"빨강\"\n# 아래에서 color를 \"파랑\"으로 바꿔보세요!\n\nprint(color)",
    "expected_output_hint": "파랑 이 출력되어야 해요",
    "fallback_text": "변수는 상자니까 안에 든 걸 바꿀 수 있어요! color = \"파랑\" 이렇게 다시 넣으면 이전 값은 사라지고 새 값이 들어가요.",
    "hints": {
      "level_1": "변수에 새 값을 넣으면 이전 값은 사라져요. = 기호로 새 값을 넣어보세요!",
      "level_2": "color = \"파랑\" 이렇게 다시 값을 넣으면 돼요!",
      "level_3": "color = \"___\" 새로운 색깔을 넣어보세요!"
    }
  }'::jsonb,
  'output_match',
  '파랑',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-4: 나이 계산기 (기존 NN=06, order 3→4)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000006',
  'a1000000-0000-0000-0000-000000000002',
  4,
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
      "level_3": "birth_year = ___ 자기 태어난 해를 숫자로 넣어보세요!"
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

-- 퀘스트 2-5: 글자 합치기 마법 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000028',
  'a1000000-0000-0000-0000-000000000002',
  5,
  '글자 합치기 마법',
  '문자열 연결(+)',
  '{
    "topic": "문자열 연결 연산자 +",
    "learning_goals": ["+ 연산자로 문자열을 합칠 수 있다", "문자열끼리 더하면 이어붙여지는 것을 이해한다"],
    "story_context": "변수의 숲에서 마법 접착제를 발견했어요! 글자와 글자를 이어붙여 새로운 단어를 만들어봐요!",
    "exercise_description": "first = \"파이\", second = \"썬\"을 변수에 저장하고, + 연산자로 합쳐서 출력하세요",
    "starter_code": "# 글자를 합쳐보세요!\nfirst = \"파이\"\nsecond = \"썬\"\nresult = \nprint(result)",
    "expected_output_hint": "파이썬 이 출력되어야 해요",
    "fallback_text": "문자열끼리 + 를 쓰면 이어붙여져요! \"파이\" + \"썬\" = \"파이썬\"이 돼요.",
    "hints": {
      "level_1": "문자열을 합치려면 + 기호를 사용해요! 숫자 더하기와 비슷하죠?",
      "level_2": "result = first + second 이렇게 두 변수를 + 로 합쳐보세요!",
      "level_3": "result = ___ + ___ 두 변수 이름을 넣어보세요!"
    }
  }'::jsonb,
  'output_match',
  '파이썬',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-6: 변신 마법! 형변환 (기존 NN=07, order 4→6)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000007',
  'a1000000-0000-0000-0000-000000000002',
  6,
  '변신 마법! 형변환',
  'str(), int() 형변환',
  '{
    "topic": "자료형 변환 (str -> int, int -> str)",
    "learning_goals": ["int()로 문자열을 숫자로 바꿀 수 있다", "str()로 숫자를 문자열로 바꿀 수 있다", "형변환이 필요한 상황을 이해한다"],
    "story_context": "변신 마법사를 만났어요! 글자를 숫자로, 숫자를 글자로 변신시킬 수 있대요.",
    "exercise_description": "문자열 \"100\"과 \"23\"을 int()로 숫자로 바꿔서 더한 뒤 결과를 출력하세요",
    "starter_code": "# 문자열을 숫자로 바꿔서 더해보세요!\na = \"100\"\nb = \"23\"\nresult = \nprint(result)",
    "expected_output_hint": "123이 출력되어야 해요",
    "fallback_text": "\"100\"은 글자예요. int(\"100\")으로 숫자 100으로 변신시킬 수 있어요! 숫자끼리는 더할 수 있지요.",
    "hints": {
      "level_1": "따옴표가 있으면 글자, 없으면 숫자예요. 글자를 숫자로 바꾸려면?",
      "level_2": "int() 안에 문자열을 넣으면 숫자로 변신해요! int(a) + int(b)를 해보세요!",
      "level_3": "result = ___(a) + ___(b) 글자를 숫자로 바꾸는 함수를 넣어보세요!"
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

-- 퀘스트 2-7: 자기소개 카드 만들기 (신규, 챌린지)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000029',
  'a1000000-0000-0000-0000-000000000002',
  7,
  '자기소개 카드 만들기',
  '변수 종합',
  '{
    "topic": "변수와 문자열 연결 종합 활용",
    "learning_goals": ["여러 변수를 선언하고 값을 저장할 수 있다", "문자열 연결을 사용하여 의미 있는 문장을 만들 수 있다", "변수를 활용하여 자기소개 카드를 완성할 수 있다"],
    "story_context": "변수의 숲을 떠나기 전에, 지금까지 배운 걸 모아서 멋진 자기소개 카드를 만들어봐요!",
    "exercise_description": "name, age, school 변수에 각각 값을 저장하고, 문자열 연결로 자기소개를 3줄로 출력하세요",
    "starter_code": "# 자기소개 카드를 만들어보세요!\nname = \"파이뱀\"\nage = \"10\"\nschool = \"코딩초등학교\"\n\n# 아래에 print()를 3번 써서 자기소개를 출력하세요!\n",
    "expected_output_hint": "이름: 파이뱀, 나이: 10살, 학교: 코딩초등학교 가 각각 한 줄씩 출력되어야 해요",
    "fallback_text": "변수에 저장한 값과 문자열을 + 로 합쳐서 출력해요! print(\"이름: \" + name) 이렇게요.",
    "hints": {
      "level_1": "print()를 3번 써서 이름, 나이, 학교를 각각 출력해야 해요!",
      "level_2": "print(\"이름: \" + name) 이렇게 문자열과 변수를 + 로 합쳐보세요!",
      "level_3": "print(\"이름: \" + ___)\nprint(\"나이: \" + ___ + \"살\")\nprint(\"학교: \" + ___)"
    },
    "is_challenge": true
  }'::jsonb,
  'output_match',
  '이름: 파이뱀
나이: 10살
학교: 코딩초등학교',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 3: 조건의 갈림길 (7 퀘스트, 375 XP)
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
      "level_3": "print(\"___\") 문이 열릴 때 나올 메시지를 넣어보세요!"
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

-- 퀘스트 3-2: 짝수인지 홀수인지? (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000030',
  'a1000000-0000-0000-0000-000000000003',
  2,
  '짝수인지 홀수인지?',
  'if/else, % 나머지 연산',
  '{
    "topic": "if/else와 나머지 연산자 %",
    "learning_goals": ["% 연산자로 나머지를 구할 수 있다", "짝수/홀수를 판별하는 조건을 만들 수 있다"],
    "story_context": "갈림길에서 숫자 요정을 만났어요! 숫자가 짝수인지 홀수인지 알려줘야 길을 안내해줘요.",
    "exercise_description": "number = 7에 대해 짝수인지 홀수인지 판별하여 출력하세요. 짝수면 \"짝수\", 홀수면 \"홀수\"를 출력!",
    "starter_code": "# 짝수인지 홀수인지 판별해보세요!\nnumber = 7\n\nif number % 2 == 0:\n    print(\"짝수\")\nelse:\n    print()",
    "expected_output_hint": "홀수 가 출력되어야 해요",
    "fallback_text": "% 연산자는 나누기의 나머지를 구해요! 7 % 2 = 1 이니까 홀수예요. 짝수는 나머지가 0이에요.",
    "hints": {
      "level_1": "% 2로 2로 나눈 나머지를 구해요. 나머지가 0이면 짝수, 아니면 홀수예요!",
      "level_2": "7 % 2 = 1 이니까 짝수가 아니에요. else에서 뭘 출력해야 할까요?",
      "level_3": "print(\"___\") 짝수가 아닐 때 출력할 단어를 넣어보세요!"
    }
  }'::jsonb,
  'output_match',
  '홀수',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-3: 성적표 만들기 (기존 NN=09, order 2→3)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000009',
  'a1000000-0000-0000-0000-000000000003',
  3,
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
      "level_3": "print(\"등급: ___\") 85점의 등급 알파벳을 넣어보세요!"
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

-- 퀘스트 3-4: 놀이공원 입장 (기존 NN=10, order 3→4)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000010',
  'a1000000-0000-0000-0000-000000000003',
  4,
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
      "level_3": "print(\"___\") 키가 충분할 때 나올 메시지를 넣어보세요!"
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

-- 퀘스트 3-5: 마법사의 조건 (기존 NN=11, order 4→5)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000011',
  'a1000000-0000-0000-0000-000000000003',
  5,
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
      "level_3": "print(\"___\") 두 시험을 모두 통과하면 나올 메시지를 넣어보세요!"
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

-- 퀘스트 3-6: 가위바위보 심판 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000031',
  'a1000000-0000-0000-0000-000000000003',
  6,
  '가위바위보 심판',
  '중첩 if문',
  '{
    "topic": "중첩 if문으로 복잡한 조건 처리하기",
    "learning_goals": ["if 안에 if를 넣어 중첩 조건을 만들 수 있다", "여러 조건을 조합하여 결과를 판단할 수 있다"],
    "story_context": "갈림길의 가위바위보 대회! 심판이 되어 누가 이겼는지 판정해봐요!",
    "exercise_description": "player = \"가위\", computer = \"보\"일 때 가위바위보 결과를 판정하세요. 가위가 보를 이기니까 \"이겼다!\"를 출력!",
    "starter_code": "# 가위바위보 심판이 되어보세요!\nplayer = \"가위\"\ncomputer = \"보\"\n\nif player == computer:\n    print(\"비겼다!\")\nelif player == \"가위\":\n    if computer == \"보\":\n        print()\n    else:\n        print(\"졌다!\")",
    "expected_output_hint": "이겼다! 가 출력되어야 해요",
    "fallback_text": "if 안에 또 if를 쓸 수 있어요! 가위가 보를 이기니까, player가 가위이고 computer가 보이면 이긴 거예요.",
    "hints": {
      "level_1": "가위는 보를 이겨요! player가 가위이고 computer가 보이면 어떤 결과일까요?",
      "level_2": "if 조건이 맞으니까 print() 안에 결과 메시지를 넣으면 돼요!",
      "level_3": "print(\"___\") 이겼을 때 나올 메시지를 넣어보세요!"
    }
  }'::jsonb,
  'output_match',
  '이겼다!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-7: 영화관 할인 시스템 (신규, 챌린지)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000032',
  'a1000000-0000-0000-0000-000000000003',
  7,
  '영화관 할인 시스템',
  '조건문 종합',
  '{
    "topic": "조건문 종합 활용 - 할인 시스템 만들기",
    "learning_goals": ["if/elif/else를 활용하여 실용적인 프로그램을 만들 수 있다", "여러 조건을 조합하여 복잡한 로직을 구현할 수 있다", "변수와 조건문을 함께 사용할 수 있다"],
    "story_context": "갈림길의 영화관에서 할인 시스템을 만들어야 해요! 나이와 요일에 따라 할인율이 달라져요.",
    "exercise_description": "age=10, is_weekend=False일 때, 어린이(13세 미만) 평일 50% 할인을 적용하여 나이, 할인율, 가격을 출력하세요. 원래 가격은 10000원이에요.",
    "starter_code": "# 영화관 할인 시스템을 만들어보세요!\nage = 10\nis_weekend = False\nprice = 10000\n\n# 어린이(13세 미만)이면 할인!\n# if 문으로 나이와 요일에 따라 discount를 정해보세요!\n\n\n# 최종 가격을 계산하세요!\n# final_price = price * (100 - discount) // 100\n\n# 나이, 할인율, 가격을 출력하세요!\n",
    "expected_output_hint": "나이: 10살, 할인율: 50%, 가격: 5000원 이 각각 출력되어야 해요",
    "fallback_text": "if 안에 또 if를 쓸 수 있어요! 먼저 나이로 어린이인지 확인하고, 그 안에서 평일인지 주말인지 확인해요.",
    "hints": {
      "level_1": "먼저 나이를 확인하고, 그 다음 주말인지 평일인지 확인해야 해요!",
      "level_2": "if age < 13: 안에서 is_weekend를 확인해보세요! 평일이면 50% 할인!",
      "level_3": "if age < 13: 안에 if is_weekend == False: 를 넣고, discount = 50 으로 설정해보세요! else일 때는 30이에요."
    },
    "is_challenge": true
  }'::jsonb,
  'output_match',
  '나이: 10살
할인율: 50%
가격: 5000원',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 4: 반복의 동굴 (8 퀘스트, 425 XP)
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
    "starter_code": "# 1부터 5까지 세어보세요!\n# for 반복문과 range()를 사용해보세요!\n\nfor i in range(__, __):\n    print(i)",
    "expected_output_hint": "1, 2, 3, 4, 5가 한 줄씩 출력되어야 해요",
    "fallback_text": "for i in range(1, 6)은 i가 1, 2, 3, 4, 5로 바뀌면서 아래 코드를 반복해요! range(1, 6)은 1부터 5까지예요 (6은 포함 안 돼요).",
    "hints": {
      "level_1": "for는 같은 일을 여러 번 반복해주는 마법이에요! range()에 시작과 끝 숫자를 넣어보세요.",
      "level_2": "range(1, 6)은 1, 2, 3, 4, 5를 만들어줘요. 6은 포함되지 않아요!",
      "level_3": "for i in range(___, ___): 1부터 5까지 나오려면 시작과 끝에 뭘 넣을까요?"
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
    "starter_code": "# 2단 구구단을 출력해보세요!\n# 형식: 2 x 1 = 2\n\nfor i in range(1, 10):\n    print()",
    "expected_output_hint": "2 x 1 = 2 부터 2 x 9 = 18 까지 출력되어야 해요",
    "fallback_text": "for i in range(1, 10)으로 i가 1부터 9까지 바뀌면서 2 * i를 계산해요! print(2, \"x\", i, \"=\", 2*i)로 예쁘게 출력할 수 있어요.",
    "hints": {
      "level_1": "구구단은 같은 숫자에 1, 2, 3, ... 9를 곱하는 거예요! print() 안에 무엇을 넣어야 할까요?",
      "level_2": "print() 안에 2, \"x\", i, \"=\", 2 * i 이렇게 넣어보세요!",
      "level_3": "print(___, \"x\", i, \"=\", ___) 곱하는 숫자와 결과 계산식을 넣어보세요!"
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

-- 퀘스트 4-3: 별 찍기 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000033',
  'a1000000-0000-0000-0000-000000000004',
  3,
  '별 찍기',
  '문자열 반복(*)',
  '{
    "topic": "문자열 반복 연산자 *",
    "learning_goals": ["* 연산자로 문자열을 반복할 수 있다", "print()와 문자열 반복을 조합할 수 있다"],
    "story_context": "동굴 벽에 별을 새겨야 마법 문이 열려요! 별을 5개 찍어볼까요?",
    "exercise_description": "print(\"*\" * 5)를 사용하여 별 5개를 한 줄로 출력하세요",
    "starter_code": "# 별을 5개 찍어보세요!\n# 힌트: 문자열 * 숫자 = 반복!\n\nprint(\"*\" * ___)",
    "expected_output_hint": "***** 가 출력되어야 해요",
    "fallback_text": "문자열에 * 숫자를 하면 그만큼 반복돼요! \"*\" * 5 = \"*****\" 이에요.",
    "hints": {
      "level_1": "문자열에 * 를 쓰면 반복할 수 있어요! \"하\" * 3 = \"하하하\"",
      "level_2": "\"*\" * 5 이렇게 쓰면 별이 5번 반복돼요!",
      "level_3": "print(\"*\" * ___) 빈칸에 숫자 5를 넣어보세요!"
    }
  }'::jsonb,
  'output_match',
  '*****',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-4: 합계 구하기 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000034',
  'a1000000-0000-0000-0000-000000000004',
  4,
  '합계 구하기',
  '누적 변수 + for',
  '{
    "topic": "누적 변수와 for 반복문으로 합계 구하기",
    "learning_goals": ["누적 변수를 사용하여 값을 더해갈 수 있다", "for 반복문과 누적 변수를 조합할 수 있다"],
    "story_context": "동굴 속 보물 더미! 금화를 하나씩 세어서 총 몇 개인지 합계를 구해봐요!",
    "exercise_description": "1부터 10까지 숫자를 모두 더한 합계를 구하여 출력하세요",
    "starter_code": "# 1부터 10까지 합계를 구해보세요!\ntotal = 0\n\nfor i in range(1, 11):\n    total = total + i\n\nprint(total)",
    "expected_output_hint": "55 가 출력되어야 해요 (1+2+3+...+10 = 55)",
    "fallback_text": "total = 0으로 시작해서, 반복할 때마다 total = total + i로 숫자를 더해가요! 1+2+3+...+10 = 55예요.",
    "hints": {
      "level_1": "total이라는 상자에 숫자를 하나씩 더해가면 돼요!",
      "level_2": "total = 0으로 시작하고, total = total + i로 반복할 때마다 더해보세요!",
      "level_3": "코드를 그대로 실행해보세요! total이 어떻게 변하는지 따라가 보세요."
    }
  }'::jsonb,
  'output_match',
  '55',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-5: 보물 찾기 (기존 NN=14, order 3→5)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000014',
  'a1000000-0000-0000-0000-000000000004',
  5,
  '보물 찾기',
  'while, break',
  '{
    "topic": "while 반복문과 break",
    "learning_goals": ["while 반복문의 구조를 이해한다", "break로 반복문을 중간에 멈출 수 있다", "조건이 거짓이 될 때까지 반복하는 것을 안다"],
    "story_context": "동굴 속에서 보물을 찾아 헤매는 모험가! 보물을 찾으면 멈춰야 해요.",
    "exercise_description": "위치를 1부터 하나씩 늘려가며 위치가 5일 때 \"보물 발견!\"을 출력하고 반복을 멈추세요",
    "starter_code": "# 보물을 찾아보세요!\nposition = 1\n\nwhile position <= 10:\n    if position == 5:\n        # 보물을 찾으면 메시지를 출력하고 멈추세요!\n        \n    position = position + 1",
    "expected_output_hint": "보물 발견! 이 출력되어야 해요",
    "fallback_text": "while은 조건이 맞는 동안 계속 반복해요. break를 만나면 반복을 멈춰요! if position == 5: 에서 보물을 찾으면 break로 탈출!",
    "hints": {
      "level_1": "while은 조건이 참인 동안 계속 반복해요. position이 5가 되면 뭘 해야 할까요?",
      "level_2": "print()로 메시지를 출력하고, break로 반복을 멈추면 돼요!",
      "level_3": "print(\"___\")\n        ___ 메시지를 출력하고 반복을 멈추는 명령어를 써보세요!"
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

-- 퀘스트 4-6: 짝수만 골라내기 (기존 NN=15, order 4→6)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000015',
  'a1000000-0000-0000-0000-000000000004',
  6,
  '짝수만 골라내기',
  'for, if, continue',
  '{
    "topic": "continue로 특정 반복 건너뛰기",
    "learning_goals": ["continue가 현재 반복만 건너뛰는 것을 안다", "% (나머지) 연산자를 사용할 수 있다", "for와 if를 조합하여 필터링할 수 있다"],
    "story_context": "동굴의 마법 필터! 짝수만 통과시키고 홀수는 막아요.",
    "exercise_description": "1부터 10까지 반복하면서 짝수만 출력하세요 (홀수는 continue로 건너뛰기)",
    "starter_code": "# 짝수만 출력해보세요!\nfor i in range(1, 11):\n    if i % 2 != 0:\n        # 홀수면 건너뛰세요!\n        \n    print(i)",
    "expected_output_hint": "2, 4, 6, 8, 10이 한 줄씩 출력되어야 해요",
    "fallback_text": "% 는 나머지를 구하는 연산자예요! i % 2 != 0은 홀수라는 뜻이에요. continue를 만나면 아래 코드를 건너뛰고 다음 반복으로 가요.",
    "hints": {
      "level_1": "짝수는 2로 나누어 떨어지는 숫자예요. 홀수는 건너뛰려면 어떤 명령어를 써야 할까요?",
      "level_2": "continue를 쓰면 아래 코드를 건너뛰고 다음 반복으로 가요!",
      "level_3": "___ 홀수를 건너뛰는 명령어 한 단어를 써보세요!"
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

-- 퀘스트 4-7: 카운트다운 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000035',
  'a1000000-0000-0000-0000-000000000004',
  7,
  '카운트다운',
  'while 감소 반복',
  '{
    "topic": "while 반복문으로 감소하며 반복하기",
    "learning_goals": ["while 반복문으로 숫자를 줄여가며 반복할 수 있다", "감소하는 반복 패턴을 이해한다"],
    "story_context": "동굴 탈출 카운트다운! 5초 안에 빠져나가야 해요! 5, 4, 3, 2, 1... 탈출!",
    "exercise_description": "while 반복문으로 5부터 1까지 카운트다운을 출력하세요",
    "starter_code": "# 카운트다운을 만들어보세요!\ncount = 5\n\nwhile count >= 1:\n    print(count)\n    count = count - 1",
    "expected_output_hint": "5, 4, 3, 2, 1이 한 줄씩 출력되어야 해요",
    "fallback_text": "count = 5에서 시작해서, 반복할 때마다 count = count - 1로 1씩 줄여가요. count가 0이 되면 멈춰요!",
    "hints": {
      "level_1": "while count >= 1: 은 count가 1 이상인 동안 반복해요. count를 줄여가야 해요!",
      "level_2": "count = count - 1 으로 반복할 때마다 1씩 줄이면 돼요!",
      "level_3": "코드를 그대로 실행해보세요! count가 어떻게 변하는지 따라가 보세요."
    }
  }'::jsonb,
  'output_match',
  '5
4
3
2
1',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-8: 별 피라미드 만들기 (신규, 챌린지)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000036',
  'a1000000-0000-0000-0000-000000000004',
  8,
  '별 피라미드 만들기',
  '반복 종합',
  '{
    "topic": "for 반복문과 문자열 반복으로 피라미드 만들기",
    "learning_goals": ["for 반복문과 문자열 반복(*)을 조합할 수 있다", "반복 변수를 활용하여 패턴을 만들 수 있다"],
    "story_context": "동굴을 탈출하면 별 피라미드를 쌓아야 해요! 반복의 마법으로 피라미드를 완성해봐요!",
    "exercise_description": "for 반복문과 \"*\" * i 를 사용하여 5줄짜리 별 피라미드를 만드세요",
    "starter_code": "# 별 피라미드를 만들어보세요!\n# 1줄: *\n# 2줄: **\n# ...\n# 5줄: *****\n\nfor i in range(1, 6):\n    print()",
    "expected_output_hint": "* 부터 ***** 까지 피라미드가 출력되어야 해요",
    "fallback_text": "for i in range(1, 6)으로 i가 1, 2, 3, 4, 5가 되면서 \"*\" * i로 별이 1개, 2개, 3개, 4개, 5개 출력돼요!",
    "hints": {
      "level_1": "\"*\" * i 에서 i가 1, 2, 3, 4, 5로 바뀌면 별이 몇 개씩 나올까요?",
      "level_2": "for i in range(1, 6): 으로 i를 1부터 5까지 바꾸면서 print(\"*\" * i)를 써보세요!",
      "level_3": "print() 안에 \"*\" * i 를 넣어보세요! i가 1이면 *, 2이면 ** 가 나와요!"
    },
    "is_challenge": true
  }'::jsonb,
  'output_match',
  '*
**
***
****
*****',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 5: 리스트 호수 (7 퀘스트, 375 XP)
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
    "starter_code": "# 과일 바구니를 만들어보세요!\n# 대괄호 [] 안에 \"사과\", \"바나나\", \"포도\"를 넣어보세요!\n\nfruits = []\nprint(fruits)",
    "expected_output_hint": "사과, 바나나, 포도가 리스트로 출력되어야 해요",
    "fallback_text": "리스트는 여러 값을 한 상자에 담는 거예요! [\"사과\", \"바나나\", \"포도\"] 이렇게 대괄호 안에 쉼표로 구분해서 넣어요.",
    "hints": {
      "level_1": "리스트는 대괄호 [] 안에 값을 넣어 만들어요!",
      "level_2": "각 과일을 따옴표로 감싸고 쉼표로 구분해요! [\"사과\", \"바나나\", ...]",
      "level_3": "fruits = [\"___\", \"___\", \"___\"] 좋아하는 과일 3개를 넣어보세요!"
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
    "starter_code": "# 보물 목록에서 다이아몬드를 꺼내보세요!\ntreasures = [\"금화\", \"은화\", \"다이아몬드\", \"루비\"]\nprint(treasures[__])",
    "expected_output_hint": "다이아몬드 가 출력되어야 해요",
    "fallback_text": "리스트의 번호는 0부터 시작해요! treasures[0]은 금화, treasures[1]은 은화, treasures[2]는 다이아몬드예요.",
    "hints": {
      "level_1": "리스트의 번호(인덱스)는 0부터 시작해요. 다이아몬드는 몇 번째일까요?",
      "level_2": "금화=0, 은화=1, 다이아몬드=2! 대괄호 안에 번호를 넣어보세요.",
      "level_3": "print(treasures[___]) 다이아몬드의 인덱스 번호를 넣어보세요!"
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

-- 퀘스트 5-3: 리스트 순회하기 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000037',
  'a1000000-0000-0000-0000-000000000005',
  3,
  '리스트 순회하기',
  'for + 리스트',
  '{
    "topic": "for 반복문으로 리스트 순회하기",
    "learning_goals": ["for 반복문으로 리스트의 각 항목을 하나씩 꺼낼 수 있다", "리스트 순회의 개념을 이해한다"],
    "story_context": "리스트 호수에서 색깔 물고기를 하나씩 잡아보아요! for 반복문으로 모든 물고기를 순서대로 만나봐요!",
    "exercise_description": "colors = [\"빨강\", \"초록\", \"파랑\"] 리스트를 for 반복문으로 순회하며 각 색깔을 출력하세요",
    "starter_code": "# 색깔을 하나씩 출력해보세요!\ncolors = [\"빨강\", \"초록\", \"파랑\"]\n\nfor color in colors:\n    print(color)",
    "expected_output_hint": "빨강, 초록, 파랑이 한 줄씩 출력되어야 해요",
    "fallback_text": "for color in colors: 라고 쓰면 colors 리스트에서 하나씩 꺼내서 color 변수에 넣어줘요! 첫 번째는 빨강, 두 번째는 초록, 세 번째는 파랑이에요.",
    "hints": {
      "level_1": "for 다음에 변수 이름을 쓰고, in 다음에 리스트를 쓰면 하나씩 꺼내줘요!",
      "level_2": "for color in colors: 이렇게 쓰면 color에 빨강, 초록, 파랑이 차례로 들어와요!",
      "level_3": "코드를 그대로 실행해보세요! 각 색깔이 한 줄씩 출력될 거예요."
    }
  }'::jsonb,
  'output_match',
  '빨강
초록
파랑',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-4: 친구 목록 관리 (기존 NN=18, order 3→4)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000018',
  'a1000000-0000-0000-0000-000000000005',
  4,
  '친구 목록 관리',
  'append(), len()',
  '{
    "topic": "리스트에 추가하기(append)와 길이 구하기(len)",
    "learning_goals": ["append()로 리스트에 새 값을 추가할 수 있다", "len()으로 리스트의 길이를 구할 수 있다"],
    "story_context": "호수 마을에서 새 친구를 만났어요! 친구 목록에 추가하고 몇 명인지 세어봐요.",
    "exercise_description": "friends 리스트에 \"파이뱀\"을 append하고, len()으로 친구 수를 출력하세요",
    "starter_code": "# 친구를 추가하고 몇 명인지 세어보세요!\nfriends = [\"토끼\", \"거북이\", \"다람쥐\"]\n\n# 아래에 \"파이뱀\"을 추가하고, 친구 수를 출력하세요!\n\nprint()",
    "expected_output_hint": "4 가 출력되어야 해요 (3명 + 파이뱀 1명)",
    "fallback_text": "append()는 리스트 끝에 새 값을 추가해요! len()은 리스트에 몇 개가 있는지 세어줘요.",
    "hints": {
      "level_1": "append()로 리스트에 새 친구를 추가할 수 있어요! friends.append()를 써보세요.",
      "level_2": "friends.append(\"파이뱀\")으로 추가하고, len(friends)로 몇 명인지 세어보세요!",
      "level_3": "friends.append(\"___\")\nprint(___(friends)) 추가할 이름과 길이를 구하는 함수를 넣어보세요!"
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

-- 퀘스트 5-5: 리스트 정렬하기 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000038',
  'a1000000-0000-0000-0000-000000000005',
  5,
  '리스트 정렬하기',
  'sort()',
  '{
    "topic": "리스트 정렬하기 sort()",
    "learning_goals": ["sort()로 리스트를 오름차순 정렬할 수 있다", "정렬 후 리스트가 변경되는 것을 이해한다"],
    "story_context": "리스트 호수의 숫자 물고기가 뒤죽박죽이에요! sort()로 깔끔하게 정리해봐요!",
    "exercise_description": "numbers = [3, 1, 4, 1, 5]를 sort()로 정렬한 후 출력하세요",
    "starter_code": "# 숫자를 정렬해보세요!\nnumbers = [3, 1, 4, 1, 5]\n\n# sort()로 정렬하세요!\n\nprint(numbers)",
    "expected_output_hint": "[1, 1, 3, 4, 5] 가 출력되어야 해요",
    "fallback_text": "sort()는 리스트를 작은 수부터 큰 수 순서로 정리해줘요! numbers.sort() 이렇게 쓰면 돼요.",
    "hints": {
      "level_1": "리스트를 정리하는 마법 주문이 있어요! 리스트이름.sort()를 써보세요.",
      "level_2": "numbers.sort() 이렇게 쓰면 작은 수부터 큰 수 순서로 정렬돼요!",
      "level_3": "numbers.___() print 전에 정렬하는 함수를 호출해보세요!"
    }
  }'::jsonb,
  'output_match',
  '[1, 1, 3, 4, 5]',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-6: 리스트 속 검색 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000039',
  'a1000000-0000-0000-0000-000000000005',
  6,
  '리스트 속 검색',
  'in 연산자',
  '{
    "topic": "in 연산자로 리스트에서 값 찾기",
    "learning_goals": ["in 연산자로 리스트에 특정 값이 있는지 확인할 수 있다", "in의 결과가 True/False임을 이해한다"],
    "story_context": "리스트 호수의 과일 바구니에서 바나나를 찾아봐요! in 마법으로 있는지 확인할 수 있어요!",
    "exercise_description": "fruits 리스트에 \"바나나\"가 있는지 in 연산자로 확인하고 결과를 출력하세요",
    "starter_code": "# 바나나가 있는지 찾아보세요!\nfruits = [\"사과\", \"바나나\", \"포도\"]\n\nresult = \"바나나\" in fruits\nprint(result)",
    "expected_output_hint": "True 가 출력되어야 해요",
    "fallback_text": "in 연산자는 리스트에 값이 있는지 확인해요! \"바나나\" in fruits는 바나나가 fruits에 있으면 True, 없으면 False를 돌려줘요.",
    "hints": {
      "level_1": "in은 \"안에 있는지\" 확인하는 마법이에요! 결과는 True 또는 False예요.",
      "level_2": "\"바나나\" in fruits 이렇게 쓰면 바나나가 리스트에 있는지 확인해요!",
      "level_3": "코드를 그대로 실행해보세요! 바나나가 리스트에 있으니까 어떤 결과가 나올까요?"
    }
  }'::jsonb,
  'output_match',
  'True',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-7: 쇼핑 리스트 정리기 (신규, 챌린지)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000040',
  'a1000000-0000-0000-0000-000000000005',
  7,
  '쇼핑 리스트 정리기',
  '리스트 종합',
  '{
    "topic": "리스트 종합 활용 - 쇼핑 리스트 만들기",
    "learning_goals": ["빈 리스트를 만들고 append()로 항목을 추가할 수 있다", "sort()로 리스트를 정렬할 수 있다", "for 반복문으로 리스트를 순회하여 출력할 수 있다", "len()으로 항목 수를 세어 출력할 수 있다"],
    "story_context": "리스트 호수에서 마지막 시험! 쇼핑 리스트를 만들고, 정리하고, 예쁘게 출력해봐요!",
    "exercise_description": "빈 리스트를 만들고, 우유/주스/과자를 append하고, sort()로 정렬한 후, for로 순회 출력하세요",
    "starter_code": "# 쇼핑 리스트를 만들어보세요!\nshopping = []\n\n# 3개 항목을 추가하세요! (append 사용)\n\n\n# 정렬하세요! (sort 사용)\n\n\n# 출력하세요!\nprint(\"--- 쇼핑 목록 ---\")\nfor item in shopping:\n    print(item)\nprint(\"총 \" + str(len(shopping)) + \"개\")",
    "expected_output_hint": "쇼핑 목록이 정렬되어 출력되어야 해요",
    "fallback_text": "빈 리스트 []를 만들고, append()로 항목을 추가하고, sort()로 정렬한 뒤, for로 하나씩 출력해요!",
    "hints": {
      "level_1": "빈 리스트부터 시작해서 하나씩 추가하고, 정렬하고, 출력하는 순서예요!",
      "level_2": "shopping.append()로 추가, shopping.sort()로 정렬, for item in shopping:으로 출력!",
      "level_3": "shopping.append(\"우유\") 처럼 3개를 추가하고, shopping.sort() 로 정렬하세요!"
    },
    "is_challenge": true
  }'::jsonb,
  'output_match',
  '--- 쇼핑 목록 ---
과자
우유
주스
총 3개',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 6: 함수의 탑 (7 퀘스트, 375 XP)
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
    "starter_code": "# 인사하는 함수를 만들어보세요!\ndef greet():\n    # \"안녕! 나는 파이뱀이야!\"를 출력하세요!\n    \n\ngreet()",
    "expected_output_hint": "안녕! 나는 파이뱀이야! 가 출력되어야 해요",
    "fallback_text": "def greet(): 으로 함수를 만들고, 안에 실행할 코드를 쓴 뒤, greet()으로 호출해요! 함수는 코드를 묶어놓은 마법 주문서예요.",
    "hints": {
      "level_1": "함수는 def 이름(): 으로 만들어요. 안에 실행할 코드를 써보세요!",
      "level_2": "def 아래에 들여쓰기를 하고 print()로 메시지를 출력해보세요!",
      "level_3": "print(\"___\") 파이뱀의 인사말을 넣어보세요!"
    }
  }'::jsonb,
  'output_match',
  '안녕! 나는 파이뱀이야!',
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
    "starter_code": "# 두 숫자를 더하는 함수를 만들어보세요!\ndef add(a, b):\n    # 두 숫자를 더한 결과를 return 하세요!\n    \n\nresult = add(7, 8)\nprint(result)",
    "expected_output_hint": "15 가 출력되어야 해요",
    "fallback_text": "매개변수는 함수에 전달하는 값이에요! def add(a, b): 에서 a, b가 매개변수이고, return a + b로 합계를 돌려줘요.",
    "hints": {
      "level_1": "함수 이름 옆 괄호 안의 a, b가 매개변수예요. 이 둘을 더하면?",
      "level_2": "return은 함수가 결과를 돌려주는 거예요. return a + b 이렇게!",
      "level_3": "return ___ + ___ 두 매개변수를 더해서 돌려주세요!"
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

-- 퀘스트 6-3: 기본값이 있는 함수 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000041',
  'a1000000-0000-0000-0000-000000000006',
  3,
  '기본값이 있는 함수',
  '기본 매개변수',
  '{
    "topic": "기본 매개변수 (default parameter)",
    "learning_goals": ["함수의 매개변수에 기본값을 설정할 수 있다", "기본값이 있으면 인자를 생략할 수 있음을 이해한다"],
    "story_context": "함수의 탑에서 인사 마법을 업그레이드! 이름을 안 말해도 기본 인사를 해줘요!",
    "exercise_description": "def greet(name=\"친구\") 함수를 만들고, greet()과 greet(\"파이뱀\")을 각각 호출하세요",
    "starter_code": "# 기본값이 있는 함수를 만들어보세요!\ndef greet(name=\"친구\"):\n    print(\"안녕, \" + name + \"!\")\n\n# 이름 없이 호출\ngreet()\n# 이름을 넣어서 호출\ngreet(\"파이뱀\")",
    "expected_output_hint": "안녕, 친구! 와 안녕, 파이뱀! 이 각각 출력되어야 해요",
    "fallback_text": "매개변수에 = 으로 기본값을 넣으면, 호출할 때 값을 안 넣어도 기본값이 사용돼요! def greet(name=\"친구\"): 에서 greet()은 \"친구\"가, greet(\"파이뱀\")은 \"파이뱀\"이 name에 들어가요.",
    "hints": {
      "level_1": "기본값이 있으면 함수를 호출할 때 값을 안 넣어도 괜찮아요!",
      "level_2": "greet()은 name이 \"친구\"가 되고, greet(\"파이뱀\")은 name이 \"파이뱀\"이 돼요!",
      "level_3": "코드를 그대로 실행해보세요! 두 번 호출한 결과를 비교해보세요."
    }
  }'::jsonb,
  'output_match',
  '안녕, 친구!
안녕, 파이뱀!',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-4: 최댓값 찾기 (기존 NN=21, order 3→4)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000021',
  'a1000000-0000-0000-0000-000000000006',
  4,
  '최댓값 찾기',
  '내장함수 max(), min()',
  '{
    "topic": "파이썬 내장함수 max()와 min()",
    "learning_goals": ["max()로 가장 큰 값을 찾을 수 있다", "min()로 가장 작은 값을 찾을 수 있다", "파이썬에 이미 만들어진 함수가 있다는 것을 안다"],
    "story_context": "탑 꼭대기에서 마법 숫자들 중 가장 큰 숫자를 찾는 시험! 파이썬의 내장함수를 사용해봐요.",
    "exercise_description": "numbers 리스트에서 max()를 사용하여 가장 큰 수를 출력하세요",
    "starter_code": "# 가장 큰 수를 찾아보세요!\nnumbers = [3, 7, 1, 9, 4]\nbiggest = \nprint(biggest)",
    "expected_output_hint": "9 가 출력되어야 해요",
    "fallback_text": "max()는 가장 큰 값을 찾아주는 내장함수예요! max([3, 7, 1, 9, 4])는 9를 돌려줘요. min()은 반대로 가장 작은 값을 찾아줘요.",
    "hints": {
      "level_1": "파이썬에는 이미 만들어진 편리한 함수들이 있어요! 가장 큰 값을 찾는 함수는?",
      "level_2": "max()는 가장 큰 값을 찾아줘요! max(numbers) 이렇게!",
      "level_3": "biggest = ___(numbers) 가장 큰 값을 찾는 함수 이름을 넣어보세요!"
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

-- 퀘스트 6-5: 여러 값 돌려주기 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000042',
  'a1000000-0000-0000-0000-000000000006',
  5,
  '여러 값 돌려주기',
  '다중 return (튜플)',
  '{
    "topic": "함수에서 여러 값 돌려주기 (튜플)",
    "learning_goals": ["함수에서 여러 값을 return할 수 있다", "return된 여러 값을 각각 변수에 받을 수 있다"],
    "story_context": "함수의 탑에서 마법 분석기를 만들어요! 숫자 중 가장 작은 것과 가장 큰 것을 동시에 알려줘요!",
    "exercise_description": "def min_max(a, b, c) 함수를 만들어 가장 작은 값과 가장 큰 값을 return하세요. min_max(1, 9, 5)를 호출하여 결과를 출력!",
    "starter_code": "# 최소값과 최대값을 동시에 돌려주는 함수!\ndef min_max(a, b, c):\n    smallest = min(a, b, c)\n    biggest = max(a, b, c)\n    return smallest, biggest\n\nsmall, big = min_max(1, 9, 5)\nprint(small)\nprint(big)",
    "expected_output_hint": "1과 9가 각각 한 줄씩 출력되어야 해요",
    "fallback_text": "return 뒤에 쉼표로 여러 값을 쓰면 한 번에 돌려줄 수 있어요! small, big = min_max(1, 9, 5) 이렇게 받으면 돼요.",
    "hints": {
      "level_1": "return 뒤에 쉼표로 두 개의 값을 쓸 수 있어요!",
      "level_2": "return smallest, biggest 이렇게 두 값을 동시에 돌려줘요!",
      "level_3": "코드를 그대로 실행해보세요! min()과 max()가 어떤 값을 찾는지 확인해보세요."
    }
  }'::jsonb,
  'output_match',
  '1
9',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-6: 함수 안의 함수 호출 (신규)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000043',
  'a1000000-0000-0000-0000-000000000006',
  6,
  '함수 안의 함수 호출',
  '함수 조합',
  '{
    "topic": "함수 조합 (함수의 결과를 다른 함수에 전달)",
    "learning_goals": ["함수의 return 값을 다른 함수의 인자로 전달할 수 있다", "함수를 조합하여 복잡한 계산을 할 수 있다"],
    "story_context": "함수의 탑에서 마법을 합쳐볼까요? 두 배로 만드는 마법과 하나 더하는 마법을 합치면 어떻게 될까요?",
    "exercise_description": "double(x)은 x를 2배로, add_one(x)은 x에 1을 더하는 함수를 만들고, add_one(double(3))을 호출하세요",
    "starter_code": "# 두 함수를 만들고 합쳐보세요!\ndef double(x):\n    return x * 2\n\ndef add_one(x):\n    return x + 1\n\n# double(3)의 결과에 add_one을 적용!\nresult = add_one(double(3))\nprint(result)",
    "expected_output_hint": "7 이 출력되어야 해요 (3*2=6, 6+1=7)",
    "fallback_text": "double(3)은 6을 돌려주고, add_one(6)은 7을 돌려줘요! 함수의 결과를 다른 함수에 바로 넣을 수 있어요.",
    "hints": {
      "level_1": "double(3)은 3을 2배로 만들어요. 그 결과에 add_one을 하면?",
      "level_2": "double(3) = 6이고, add_one(6) = 7이에요!",
      "level_3": "코드를 그대로 실행해보세요! 안쪽 함수부터 바깥쪽 함수 순서로 실행돼요."
    }
  }'::jsonb,
  'output_match',
  '7',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-7: 성적 분석 프로그램 (신규, 챌린지)
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000044',
  'a1000000-0000-0000-0000-000000000006',
  7,
  '성적 분석 프로그램',
  '함수 종합',
  '{
    "topic": "함수 종합 활용 - 성적 분석 프로그램",
    "learning_goals": ["여러 함수를 만들어 역할을 분담할 수 있다", "함수의 return 값을 다른 함수에서 활용할 수 있다", "함수를 조합하여 실용적인 프로그램을 만들 수 있다"],
    "story_context": "함수의 탑 마지막 시험! 배운 함수 마법을 모두 써서 성적 분석 프로그램을 완성해봐요!",
    "exercise_description": "average 함수(3과목 평균)와 grade 함수(평균으로 등급 판정)를 만들어 성적을 분석하세요. 점수: 80, 90, 85",
    "starter_code": "# 성적 분석 프로그램을 만들어보세요!\ndef average(a, b, c):\n    # 세 과목의 평균을 구해서 return 하세요!\n    \n\ndef grade(avg):\n    # 90 이상 \"A\", 80 이상 \"B\", 70 이상 \"C\", 나머지 \"D\"\n    \n\n# 3과목 점수\navg = average(80, 90, 85)\ng = grade(avg)\n\nprint(\"평균: \" + str(avg))\nprint(\"등급: \" + g)",
    "expected_output_hint": "평균: 85.0 과 등급: B 가 출력되어야 해요",
    "fallback_text": "average 함수로 평균을 구하고, grade 함수로 등급을 판정해요! 두 함수를 조합하면 성적 분석 프로그램이 완성돼요.",
    "hints": {
      "level_1": "average 함수는 3개 숫자의 평균을, grade 함수는 평균에 따른 등급을 돌려줘요!",
      "level_2": "average(80, 90, 85) = 85.0이고, grade(85.0) = \"B\"예요!",
      "level_3": "average는 return (a + b + c) / 3, grade는 if/elif/else로 등급을 return 하세요!"
    },
    "is_challenge": true
  }'::jsonb,
  'output_match',
  '평균: 85.0
등급: B',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ────────────────────────────────────────────────────────────
-- 스테이지 7: 프로젝트 왕국 (1 퀘스트, 200 XP)
-- ────────────────────────────────────────────────────────────

-- 퀘스트 7-1: 숫자 맞추기 게임 (5단계 가이드 빌딩 프로젝트)
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
    "exercise_description": "1~10 사이의 비밀 숫자를 맞추는 게임을 만드세요. 5단계에 걸쳐 하나씩 기능을 추가하며 완성해요!",
    "starter_code": "# 숫자 맞추기 게임을 만들어보세요!\nimport random\n",
    "expected_output_hint": "프로젝트를 5단계로 나누어 완성해요",
    "fallback_text": "드디어 프로젝트 왕국에 도착했어요! 지금까지 배운 변수, 조건문, 반복문을 모두 활용해서 숫자 맞추기 게임을 만들 거예요. 5단계로 나누어 하나씩 만들어볼까요?",
    "hints": {
      "level_1": "이 프로젝트는 5단계로 진행돼요. 각 단계의 안내를 잘 따라가 보세요!",
      "level_2": "random, 변수, 조건문, 반복문을 차례대로 사용할 거예요!",
      "level_3": "각 단계에서 힌트를 활용하면 더 쉽게 진행할 수 있어요!"
    },
    "steps": [
      {
        "step_number": 1,
        "step_goal": "random 모듈로 1~10 사이의 비밀 숫자를 만들고 출력해보기",
        "starter_code": "# 1단계: 비밀 숫자 만들기\nimport random\n\n# 비밀 숫자를 만들어보세요! random 모듈을 사용해볼까요?\n",
        "validation_type": "code_check",
        "expected_output": "random.randint",
        "hints": {
          "level_1": "random 모듈의 randint 함수를 사용하면 원하는 범위의 숫자를 만들 수 있어요!",
          "level_2": "secret = random.randint(1, 10) 이렇게 변수에 저장하고, print()로 확인해보세요!",
          "level_3": "secret = random.___(1, 10)\nprint(secret)\n랜덤 숫자를 만드는 함수 이름을 넣어보세요!"
        },
        "fallback_text": "1단계에서는 random 모듈을 사용해서 비밀 숫자를 만들어요! random.randint(1, 10)을 사용하면 1부터 10 사이의 숫자를 랜덤으로 만들 수 있어요. 변수에 저장하고 print()로 확인해보세요!"
      },
      {
        "step_number": 2,
        "step_goal": "추측 숫자를 변수에 저장하기 (Pyodide에서는 random으로 대체)",
        "starter_code": "",
        "validation_type": "code_check",
        "expected_output": "int(",
        "hints": {
          "level_1": "추측 숫자를 저장할 변수가 필요해요! guess라는 이름은 어떨까요?",
          "level_2": "실제 게임에서는 input()을 쓰지만, 여기서는 int(random.randint(1, 10))으로 자동 추측을 만들어요!",
          "level_3": "guess = ___(random.randint(1, 10))\nprint(\"추측: \" + ___(guess))\n타입을 바꾸는 함수를 넣어보세요!"
        },
        "fallback_text": "2단계에서는 추측 숫자를 만들어요! 실제 게임에서는 input()으로 사용자에게 물어보지만, 여기서는 int(random.randint(1, 10))으로 자동 추측을 만들어볼 거예요."
      },
      {
        "step_number": 3,
        "step_goal": "if/elif/else로 비밀 숫자와 추측을 비교하기",
        "starter_code": "",
        "validation_type": "contains",
        "expected_output": "보다 커요",
        "hints": {
          "level_1": "if, elif, else를 사용해서 세 가지 경우를 나눠보세요: 같을 때, 작을 때, 클 때!",
          "level_2": "if guess == secret: 정답!\nelif guess < secret: 더 커요!\nelse: 더 작아요!\n이런 구조예요!",
          "level_3": "if guess == secret:\n    print(\"___\")\nelif guess < secret:\n    print(\"더 ___!\")\nelse:\n    print(\"더 ___!\")\n정답/커요/작아요 중 알맞은 말을 넣어보세요!"
        },
        "fallback_text": "3단계에서는 조건문으로 비밀 숫자와 추측을 비교해요! if/elif/else를 사용해서 정답인지, 더 큰 숫자를 말해야 하는지, 더 작은 숫자를 말해야 하는지 알려주세요!"
      },
      {
        "step_number": 4,
        "step_goal": "while 반복문으로 정답을 맞출 때까지 반복하기",
        "starter_code": "",
        "validation_type": "code_check",
        "expected_output": "while",
        "hints": {
          "level_1": "while 반복문을 사용하면 조건이 참인 동안 계속 반복할 수 있어요!",
          "level_2": "while guess != secret: 이렇게 쓰면 정답을 맞출 때까지 반복해요! 추측 코드를 while 안에 넣어보세요.",
          "level_3": "while guess ___ secret:\n    guess = ___(random.randint(1, 10))\n같지 않다는 비교 기호와 타입 변환 함수를 넣어보세요!"
        },
        "fallback_text": "4단계에서는 while 반복문으로 게임을 반복해요! while guess != secret: 으로 정답을 맞출 때까지 계속 추측하도록 만들어보세요!"
      },
      {
        "step_number": 5,
        "step_goal": "시도 횟수를 세고 완성 메시지 출력하기",
        "starter_code": "",
        "validation_type": "contains",
        "expected_output": "번 만에 맞췄어요",
        "hints": {
          "level_1": "attempts라는 변수를 만들어서 추측할 때마다 1씩 올려보세요!",
          "level_2": "attempts = 0을 while 앞에 두고, while 안에서 attempts = attempts + 1로 올려요!",
          "level_3": "print(\"정답! \" + ___(attempts) + \"번 만에 맞췄어요!\") 숫자를 글자로 바꾸는 함수를 넣어보세요!"
        },
        "fallback_text": "마지막 5단계! 시도 횟수를 세는 변수 attempts를 추가하고, 정답을 맞추면 \"정답! N번 만에 맞췄어요!\"를 출력하세요. 이걸로 게임이 완성돼요!"
      }
    ]
  }'::jsonb,
  'contains',
  '번 만에 맞췄어요',
  200
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;
