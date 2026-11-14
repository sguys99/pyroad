-- ============================================================
-- pyRoad 콘텐츠 seed — 생성물입니다. 직접 고치지 마세요.
-- 고치려면 content/ 의 YAML 을 고친 뒤 npm run content:build 로 다시 만듭니다 (content/README.md).
-- CI 는 npm run content:build -- --check 로 이 파일이 content/ 와 같은지 확인합니다.
-- 콘텐츠 해시: 9a039a9e9a5f63c0
-- 월드 3 · 스테이지 7 · 퀘스트 72 · 정답 행 72 (solution_code 43 + 프로젝트 단계 5)
--
-- - quests 에는 공개 부분만 씁니다 (expected_output = '', prompt_skeleton 에 정답 키 없음 → 00005 CHECK 통과).
-- - 정답·힌트·solution_code 는 quest_answer_keys(service_role 전용)에 따로 씁니다.
-- - 다시 실행해도 결과가 같습니다 (ON CONFLICT DO UPDATE). content/ 에 없는 행은 지우지 않습니다.
-- - DML 만 있습니다. 권한(GRANT/REVOKE)은 마이그레이션이 정합니다.
-- - 문자열·jsonb 값은 모두 한 줄 리터럴입니다 (줄바꿈은 E'…\n…'). SQL Editor 붙여넣기의 CRLF 에 안전 (B39).
--
-- 적용: supabase db reset 이 migrations 다음에 실행합니다. 운영은 SQL Editor 에서 BEGIN; … COMMIT; 으로
--       감싸 실행하고, 00005(③) 뒤에 적용합니다 (docs/release/v0.4-runbook.md "콘텐츠 seed 적용").
--       worlds·stages.world_id·quests.quest_type 을 쓰므로 00012(P1-08) 이후의 스키마가 필요합니다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 순서 충돌 방지
--    월드·스테이지·퀘스트의 order 를 바꿀 때 UNIQUE 제약(worlds."order", stages(world_id, "order"),
--    quests(stage_id, "order"))에 걸리지 않도록, 이번에 쓸 행의 기존 order 를 잠시 음수로 옮깁니다.
--    아래 업서트가 제자리로 돌려놓습니다.
-- ------------------------------------------------------------
UPDATE public.worlds SET "order" = -"order" WHERE "order" > 0 AND slug IN ('python-island', 'code-sea', 'maker-city');
UPDATE public.stages SET "order" = -"order" WHERE "order" > 0 AND id IN ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000007');
UPDATE public.quests SET "order" = -"order" WHERE "order" > 0 AND id IN ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000023', 'b1000000-0000-0000-0000-000000000101', 'b1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000024', 'b1000000-0000-0000-0000-000000000102', 'b1000000-0000-0000-0000-000000000025', 'b1000000-0000-0000-0000-000000000103', 'b1000000-0000-0000-0000-000000000026', 'b1000000-0000-0000-0000-000000000201', 'b1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000027', 'b1000000-0000-0000-0000-000000000104', 'b1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000028', 'b1000000-0000-0000-0000-000000000105', 'b1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000106', 'b1000000-0000-0000-0000-000000000029', 'b1000000-0000-0000-0000-000000000202', 'b1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000107', 'b1000000-0000-0000-0000-000000000030', 'b1000000-0000-0000-0000-000000000108', 'b1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000109', 'b1000000-0000-0000-0000-000000000031', 'b1000000-0000-0000-0000-000000000032', 'b1000000-0000-0000-0000-000000000203', 'b1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000110', 'b1000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000033', 'b1000000-0000-0000-0000-000000000034', 'b1000000-0000-0000-0000-000000000111', 'b1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000035', 'b1000000-0000-0000-0000-000000000112', 'b1000000-0000-0000-0000-000000000036', 'b1000000-0000-0000-0000-000000000204', 'b1000000-0000-0000-0000-000000000016', 'b1000000-0000-0000-0000-000000000017', 'b1000000-0000-0000-0000-000000000113', 'b1000000-0000-0000-0000-000000000037', 'b1000000-0000-0000-0000-000000000018', 'b1000000-0000-0000-0000-000000000114', 'b1000000-0000-0000-0000-000000000038', 'b1000000-0000-0000-0000-000000000115', 'b1000000-0000-0000-0000-000000000039', 'b1000000-0000-0000-0000-000000000040', 'b1000000-0000-0000-0000-000000000205', 'b1000000-0000-0000-0000-000000000019', 'b1000000-0000-0000-0000-000000000116', 'b1000000-0000-0000-0000-000000000020', 'b1000000-0000-0000-0000-000000000117', 'b1000000-0000-0000-0000-000000000041', 'b1000000-0000-0000-0000-000000000118', 'b1000000-0000-0000-0000-000000000021', 'b1000000-0000-0000-0000-000000000042', 'b1000000-0000-0000-0000-000000000043', 'b1000000-0000-0000-0000-000000000119', 'b1000000-0000-0000-0000-000000000044', 'b1000000-0000-0000-0000-000000000206', 'b1000000-0000-0000-0000-000000000120', 'b1000000-0000-0000-0000-000000000121', 'b1000000-0000-0000-0000-000000000022', 'b1000000-0000-0000-0000-000000000207');

-- ------------------------------------------------------------
-- 2. 월드 (slug 기준. id 는 DB 가 정함: 1월드는 00012 가 만든 고정 id)
-- ------------------------------------------------------------
INSERT INTO public.worlds (slug, "order", title, theme, description, unlock_rule)
VALUES
  ('python-island', 1, '파이썬 섬', 'python_island', 'print()부터 함수까지, 파이썬 기초를 배우는 첫 번째 섬이에요!', '{"type":"open"}'::jsonb),
  ('code-sea', 2, '코드 바다', 'code_sea', '문자열·딕셔너리·랜덤으로 더 큰 문제를 풀어요.', '{"type":"previous_world_cleared"}'::jsonb),
  ('maker-city', 3, '메이커 시티', 'maker_city', '거북이 그림, 텍스트 게임으로 나만의 작품을 만들어요.', '{"type":"previous_world_cleared"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  "order" = EXCLUDED."order", title = EXCLUDED.title, theme = EXCLUDED.theme,
  description = EXCLUDED.description, unlock_rule = EXCLUDED.unlock_rule;

-- ------------------------------------------------------------
-- 3. 스테이지 (world_id 는 월드 slug 로 찾음. 월드가 없으면 NOT NULL 위반으로 전체 실패)
-- ------------------------------------------------------------
INSERT INTO public.stages (id, world_id, "order", title, theme_name, description, is_final)
VALUES
  ('a1000000-0000-0000-0000-000000000001', (SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island'), 1, '파이썬 마을 입구', 'python_village', 'print()와 주석, 기본 입출력을 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000002', (SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island'), 2, '변수의 숲', 'variable_forest', '변수 선언, 자료형(int, str, float), 형변환을 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000003', (SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island'), 3, '조건의 갈림길', 'condition_crossroad', 'if/elif/else, 비교연산자, 논리연산자를 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000004', (SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island'), 4, '반복의 동굴', 'loop_cave', 'for, while, range(), break/continue를 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000005', (SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island'), 5, '리스트 호수', 'list_lake', '리스트 생성, 인덱싱, 슬라이싱, append, len을 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000006', (SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island'), 6, '함수의 탑', 'function_tower', 'def, 매개변수, return, 내장함수를 배워봐요!', FALSE),
  ('a1000000-0000-0000-0000-000000000007', (SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island'), 7, '프로젝트 왕국', 'project_kingdom', '배운 모든 것을 모아 프로젝트를 완성해봐요!', TRUE)
ON CONFLICT (id) DO UPDATE SET
  world_id = EXCLUDED.world_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  theme_name = EXCLUDED.theme_name, description = EXCLUDED.description, is_final = EXCLUDED.is_final;

-- ------------------------------------------------------------
-- 4. 퀘스트 (공개 부분)
-- ------------------------------------------------------------

-- 퀘스트 1-1: 첫 번째 인사
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  1,
  '첫 번째 인사',
  'print()',
  'code',
  NULL,
  FALSE,
  '{"topic":"print() 함수로 출력하기","learning_goals":["print() 함수를 사용하여 텍스트를 출력할 수 있다","따옴표 안에 원하는 텍스트를 넣을 수 있다"],"story_context":"파이썬 마을에 도착한 모험가가 마을 사람들에게 첫 인사를 하는 장면","exercise_description":"print() 함수를 사용하여 \"안녕하세요!\"를 출력해보세요","starter_code":"# 아래에 코드를 작성해보세요!\n","expected_output_hint":"안녕하세요! 가 출력되어야 해요","checklist":["print( )를 써요","따옴표 안에 안녕하세요! 를 넣어요","코드를 돌려서 인사가 나오는지 봐요"],"example_output":"안녕하세요!","fallback_text":"print()는 화면에 글자를 보여주는 마법 주문이에요! print(\"안녕하세요!\") 이렇게 따옴표 안에 보여주고 싶은 말을 넣으면 돼요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-2: 내 소개를 해볼까?
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000001',
  2,
  '내 소개를 해볼까?',
  'print() 여러 줄',
  'code',
  NULL,
  FALSE,
  '{"topic":"print()를 여러 번 사용하여 여러 줄 출력하기","learning_goals":["print()를 여러 번 사용하여 여러 줄을 출력할 수 있다","각 print()가 한 줄씩 출력하는 것을 이해한다"],"story_context":"마을 입구에서 자기소개를 하는 모험가. 마을 사람들이 이름과 인사를 기다리고 있어요!","exercise_description":"print()를 두 번 사용하여 첫 줄에 \"나는 파이썬 모험가!\", 둘째 줄에 \"반가워!\"를 출력하세요","starter_code":"# 두 줄을 출력해보세요!\n","expected_output_hint":"두 줄이 출력되어야 해요: 나는 파이썬 모험가! 그리고 반가워!","checklist":["print( )를 두 줄 써요","첫 줄에는 나는 파이썬 모험가! 를 넣어요","둘째 줄에는 반가워! 를 넣어요"],"example_output":"나는 파이썬 모험가!\n반가워!","fallback_text":"print()를 두 번 쓰면 두 줄이 나와요! 첫 번째 print()에 첫 번째 문장을, 두 번째 print()에 두 번째 문장을 넣어보세요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-3: 따옴표의 비밀
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000023',
  'a1000000-0000-0000-0000-000000000001',
  3,
  '따옴표의 비밀',
  '작은따옴표, 큰따옴표',
  'code',
  NULL,
  FALSE,
  '{"topic":"작은따옴표와 큰따옴표의 차이","learning_goals":["작은따옴표와 큰따옴표 모두 문자열을 만들 수 있다","문자열 안에 따옴표가 포함될 때 다른 종류의 따옴표로 감싸야 함을 안다"],"story_context":"파이썬 마을의 따옴표 가게에 왔어요! 작은따옴표와 큰따옴표, 언제 어떤 걸 써야 할까요?","exercise_description":"print()를 사용하여 I''m happy! 를 출력해보세요. 큰따옴표로 감싸면 안에 작은따옴표를 쓸 수 있어요!","starter_code":"# I''m happy! 를 출력해보세요!\n# 힌트: 큰따옴표로 감싸보세요!\n","expected_output_hint":"I''m happy! 가 출력되어야 해요","checklist":["print( ) 안을 큰따옴표 \" \" 로 감싸요","그 안에 I''m happy! 를 그대로 넣어요"],"example_output":"I''m happy!","fallback_text":"문자열 안에 작은따옴표(  ''  )가 있으면 큰따옴표(\")로 감싸면 돼요! print(\"I''m happy!\") 이렇게요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-4: 따옴표 버그 잡기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000101',
  'a1000000-0000-0000-0000-000000000001',
  4,
  '따옴표 버그 잡기',
  '작은따옴표, 큰따옴표',
  'quiz',
  'bug_hunt',
  TRUE,
  '{"topic":"글자 안에 따옴표가 있을 때","learning_goals":["글자 안에 작은따옴표가 있으면 바깥을 다른 따옴표로 감싸야 함을 안다"],"story_context":"따옴표 가게 간판 코드가 고장 났어요! 파이뱀이 쓴 두 줄 중 한 줄에서 오류가 나요.","fallback_text":"따옴표는 여는 것과 닫는 것의 짝이 맞아야 해요. 글자 안에 작은따옴표가 들어 있으면 바깥은 어떤 따옴표로 감싸야 할지 떠올려 봐요.","quiz":{"kind":"bug_hunt","question":"오류가 나는 줄을 찾아 고쳐요","lines":[{"id":"ln-r4tw","code":"print(\"어서 오세요!\")"},{"id":"ln-k8ep","code":"print(''I''m happy!'')"}],"fixes":[{"id":"fx-c7jn","code":"print(I''m happy!)"},{"id":"fx-m2va","code":"print(\"I''m happy!\")"},{"id":"fx-w5dq","code":"print(\"I''m happy!)"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-5: 주석으로 메모하기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  5,
  '주석으로 메모하기',
  '주석(#), print()',
  'code',
  NULL,
  FALSE,
  '{"topic":"주석(#)의 역할과 사용법","learning_goals":["#으로 시작하는 줄이 주석임을 안다","주석은 컴퓨터가 무시하고 사람만 읽는 메모임을 이해한다","주석과 코드를 구분하여 작성할 수 있다"],"story_context":"마을의 게시판에 비밀 메모를 남기는 모험가. 주석으로 쓴 메모는 컴퓨터가 읽지 못해요!","exercise_description":"첫 줄에 주석(#)으로 아무 메모나 남기고, 둘째 줄에 print()로 \"파이썬은 재미있어!\"를 출력하세요","starter_code":"# 여기에 메모를 남겨보세요 (이 줄은 주석이에요!)\n","expected_output_hint":"파이썬은 재미있어! 만 출력되어야 해요 (주석은 출력되지 않아요)","checklist":["첫 줄에 # 으로 메모를 남겨요","둘째 줄에 print( )로 파이썬은 재미있어! 를 보여 줘요","메모는 화면에 안 나오는지 확인해요"],"example_output":"파이썬은 재미있어!","fallback_text":"#으로 시작하는 줄은 주석이에요. 컴퓨터는 이 줄을 무시해요! 주석 아래에 print(\"파이썬은 재미있어!\")를 써보세요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-6: 특수문자 출력하기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000024',
  'a1000000-0000-0000-0000-000000000001',
  6,
  '특수문자 출력하기',
  '이스케이프 문자 \n',
  'code',
  NULL,
  FALSE,
  '{"topic":"이스케이프 문자 \\n으로 줄바꿈하기","learning_goals":["\\n이 줄바꿈을 뜻하는 특수 문자임을 안다","print() 한 번으로 여러 줄을 출력할 수 있다"],"story_context":"파이썬 마을의 마법 편지지! \\n을 쓰면 편지가 두 줄로 나뉘어요.","exercise_description":"print()를 한 번만 사용하여 \"첫째 줄\"과 \"둘째 줄\"을 두 줄로 출력하세요. \\n을 사용해요!","starter_code":"# print()를 한 번만 사용해서 두 줄로 출력해보세요!\n# 힌트: \\n은 줄바꿈이에요!\n","expected_output_hint":"첫째 줄과 둘째 줄이 각각 다른 줄에 출력되어야 해요","checklist":["print( )는 딱 한 번만 써요","첫째 줄과 둘째 줄 사이에 \\n 을 넣어요","두 줄로 나오는지 확인해요"],"example_output":"첫째 줄\n둘째 줄","fallback_text":"\\n은 줄바꿈을 뜻하는 특수 문자예요! print(\"첫째 줄\\n둘째 줄\") 이렇게 쓰면 두 줄로 나뉘어서 출력돼요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-7: 두 줄 편지 빈칸
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000102',
  'a1000000-0000-0000-0000-000000000001',
  7,
  '두 줄 편지 빈칸',
  '이스케이프 문자 \n',
  'quiz',
  'fill_blank',
  TRUE,
  '{"topic":"글자 안에서 줄 바꾸기","learning_goals":["print 한 번으로 글자를 두 줄에 나눠 보여 줄 수 있다"],"story_context":"마법 편지지에 과일 이름을 적어요. 사과와 바나나를 서로 다른 줄에 쓰고 싶어요!","fallback_text":"글자 안에서 줄을 바꾸는 특수문자는 역슬래시(\\)로 시작해요. 앞에서 써 본 마법 편지지를 떠올려 봐요.","quiz":{"kind":"fill_blank","question":"빈칸을 채워 사과와 바나나가 서로 다른 줄에 나오게 해요","code":"print(\"사과{{bk-p3zy}}바나나\")","tokens":[{"id":"tok-n4ha","text":"\\n"},{"id":"tok-s9re","text":"/n"},{"id":"tok-x2lu","text":"n\\"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-8: 숫자도 출력해요
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000025',
  'a1000000-0000-0000-0000-000000000001',
  8,
  '숫자도 출력해요',
  'print()로 숫자 출력',
  'code',
  NULL,
  FALSE,
  '{"topic":"print()로 숫자 출력하기","learning_goals":["print()로 숫자를 출력할 수 있다","숫자는 따옴표 없이 쓰는 것을 안다"],"story_context":"파이썬 마을의 시계탑에 올해 연도를 새겨야 해요! 숫자를 출력해볼까요?","exercise_description":"print()로 숫자 2026을 출력하세요. 따옴표 없이 숫자만 넣어보세요!","starter_code":"# 숫자 2026을 출력해보세요!\n# 힌트: 따옴표 없이 숫자만 넣으면 돼요!\n","expected_output_hint":"2026 이 출력되어야 해요","checklist":["print( ) 안에 2026 을 넣어요","따옴표 없이 숫자만 써요"],"example_output":"2026","fallback_text":"print() 안에 따옴표 없이 숫자를 넣으면 숫자가 그대로 출력돼요! print(2026) 이렇게요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-9: 무엇이 나올까?
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000103',
  'a1000000-0000-0000-0000-000000000001',
  9,
  '무엇이 나올까?',
  'print(), 주석, 숫자 출력',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"주석과 print() 출력 예측하기","learning_goals":["주석(#)은 실행되지 않는다는 것을 안다","print()는 따옴표 안의 글자만 보여 준다는 것을 안다"],"story_context":"시계탑 아래 게시판에 파이뱀이 코드를 붙여 놨어요. 돌리기 전에 무엇이 나올지 맞혀 봐요!","fallback_text":"#으로 시작하는 줄은 메모라서 컴퓨터가 읽지 않아요. 따옴표는 글자를 감싸는 표시일 뿐 화면에는 나오지 않아요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"# print(\"비밀 메모\")\nprint(\"안녕\")\nprint(2026)","options":[{"id":"opt-b7xe","text":"\"안녕\"\n2026"},{"id":"opt-h3ku","text":"안녕\n2026"},{"id":"opt-q2mi","text":"비밀 메모\n안녕\n2026"},{"id":"opt-z5ca","text":"안녕"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-10: 마을 안내판 만들기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000026',
  'a1000000-0000-0000-0000-000000000001',
  10,
  '마을 안내판 만들기',
  'print() 종합',
  'code',
  NULL,
  FALSE,
  '{"topic":"print() 종합 활용","learning_goals":["주석과 print()를 자유롭게 사용할 수 있다","문자열과 숫자를 print()로 출력할 수 있다","여러 줄을 출력하여 의미 있는 결과물을 만들 수 있다"],"story_context":"파이썬 마을에 새 안내판을 세워야 해요! 주석으로 설명을 달고, print()로 멋진 안내판을 만들어봐요!","exercise_description":"주석 1줄을 쓰고, print()를 3번 사용하여 마을 안내판을 만드세요. 첫 줄: === 파이썬 마을 ===, 둘째 줄: 인구: 2026명, 셋째 줄: 환영합니다!","starter_code":"# 마을 안내판을 만들어보세요!\n# 주석 1줄 + print() 3줄로 완성!\n","expected_output_hint":"=== 파이썬 마을 ===, 인구: 2026명, 환영합니다! 가 각각 한 줄씩 출력되어야 해요","checklist":["# 으로 메모를 한 줄 써요","print( )를 세 번 써요","=== 파이썬 마을 ===, 인구: 2026명, 환영합니다! 를 차례로 보여 줘요"],"example_output":"=== 파이썬 마을 ===\n인구: 2026명\n환영합니다!","fallback_text":"주석으로 설명을 달고, print()를 3번 사용해서 안내판을 만들어요! 각 줄에 다른 내용을 넣어보세요.","is_challenge":true}'::jsonb,
  'output_match',
  '',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-11: 출력 대장 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000201',
  'a1000000-0000-0000-0000-000000000001',
  11,
  '출력 대장 버그버그',
  'print() 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"1단계에서 배운 print()·따옴표·주석·줄바꿈 총정리","learning_goals":["print()가 무엇을 어떤 차례로 보여 주는지 읽을 수 있다","따옴표·괄호 짝이 틀린 줄을 찾아 고칠 수 있다","주석과 줄바꿈 글자가 하는 일을 안다"],"story_context":"마을 입구 시계탑에 버그버그가 나타나 안내판 글자를 엉망으로 만들고 있어요! 문제를 맞힐 때마다 파이뱀이 버그버그를 콕 찌를 수 있어요.","fallback_text":"print()는 괄호 안의 글자를 화면에 보여 줘요. 따옴표와 괄호는 여는 것과 닫는 것의 짝이 맞아야 하고, 줄을 쓴 차례대로 한 줄씩 나와요. 샵(#)으로 시작하는 줄은 메모라서 실행되지 않아요.","boss":{"name":"출력 대장 버그버그","look":"village","intro":"히히! 마을 안내판은 내가 접수했다! 내 문제를 네 개 다 풀면 돌려줄게!","on_defeat":"으앗, 졌다! 너 print() 진짜 잘하는구나. 안내판은 돌려줄게, 다음 숲에서 또 보자!","on_victory":"이번엔 내가 이겼지롱! 그래도 거의 다 왔어. 조금 쉬었다가 다시 도전해!","rounds":[{"kind":"multiple_choice","question":"시계탑 종소리 코드야. 돌리면 무엇이 나올까?","code":"print(\"땡!\\n땡!\")\nprint(12)","options":[{"id":"opt-c8nz","text":"땡!\\n땡!\n12"},{"id":"opt-e6tq","text":"12\n땡!\n땡!"},{"id":"opt-r4wk","text":"땡!\n땡!\n12"},{"id":"opt-y2hd","text":"땡!땡!\n12"}]},{"kind":"bug_hunt","question":"오류가 나는 줄을 찾아 고쳐요","lines":[{"id":"ln-a4kd","code":"# 시계탑 안내판"},{"id":"ln-p7ws","code":"print(\"파이뱀 만세!'')"},{"id":"ln-g3vb","code":"print(\"버그버그 물러가라!\")"}],"fixes":[{"id":"fx-j8tc","code":"print(파이뱀 만세!)"},{"id":"fx-n5qe","code":"print\"파이뱀 만세!\""},{"id":"fx-r3hm","code":"print(\"파이뱀 만세!\")"}]},{"kind":"fill_blank","question":"빈칸을 채워 버그버그가 몰래 넣은 줄은 실행되지 않게 해요","code":"{{bk-w2nx}} print(\"버그버그 최고!\")\nprint(\"파이뱀 최고!\")","tokens":[{"id":"tok-h6rb","text":"//"},{"id":"tok-q4ma","text":"#"},{"id":"tok-z3kv","text":"\""}]},{"kind":"parsons","question":"안내판에 \"== 시계탑 소식 ==\", \"버그버그는\", \"물러가고\", \"파이뱀이\", \"돌아왔다!\" 가 한 줄씩 차례로 나오게 줄을 놓아요","lines":[{"id":"ln-b9fe","code":"print(\"돌아왔다!\")"},{"id":"ln-k2wd","code":"print(\"버그버그는\")"},{"id":"ln-m7cq","code":"print(\"== 시계탑 소식 ==\")"},{"id":"ln-u4hs","code":"print(\"물러가고\\n파이뱀이\")"}]}],"review_quests":["b1000000-0000-0000-0000-000000000024","b1000000-0000-0000-0000-000000000023","b1000000-0000-0000-0000-000000000003","b1000000-0000-0000-0000-000000000002"]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-1: 마법 상자에 이름 넣기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000002',
  1,
  '마법 상자에 이름 넣기',
  '변수 선언',
  'code',
  NULL,
  FALSE,
  '{"topic":"변수 선언과 값 저장","learning_goals":["변수가 값을 담는 상자임을 이해한다","= 기호로 변수에 값을 저장할 수 있다"],"story_context":"변수의 숲에서 마법 상자에 이름표를 붙이는 모험. 상자에 파이뱀의 이름을 넣어봐요!","exercise_description":"name이라는 변수에 \"파이뱀\"을 저장하고 print(name)으로 출력하세요","starter_code":"# 변수에 이름을 넣어보세요!\nname = \nprint(name)","expected_output_hint":"파이뱀 이 출력되어야 해요","checklist":["name 상자에 \"파이뱀\"을 넣어요","print(name)으로 상자 안을 보여 줘요"],"example_output":"파이뱀","fallback_text":"변수는 값을 담는 상자예요! name = \"파이뱀\" 이렇게 상자에 이름표를 붙이고 값을 넣을 수 있어요."}'::jsonb,
  'contains',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-2: 숫자 상자와 글자 상자
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000002',
  2,
  '숫자 상자와 글자 상자',
  'int, str 자료형',
  'code',
  NULL,
  FALSE,
  '{"topic":"정수(int)와 문자열(str) 자료형","learning_goals":["숫자는 따옴표 없이, 글자는 따옴표로 감싸서 저장하는 것을 안다","int와 str이 다른 종류의 상자임을 이해한다"],"story_context":"숲 속 두 종류의 마법 상자를 발견! 숫자 상자와 글자 상자를 구분해봐요.","exercise_description":"number 변수에 10을, greeting 변수에 \"안녕\"을 저장하고 각각 print()로 출력하세요","starter_code":"# 숫자와 글자를 각각 변수에 넣어보세요!\nnumber = \ngreeting = \nprint(number)\nprint(greeting)","expected_output_hint":"10과 안녕이 한 줄씩 출력되어야 해요","checklist":["number 상자에 숫자 10을 넣어요","greeting 상자에 \"안녕\"을 넣어요","두 상자를 한 줄씩 보여 줘요"],"example_output":"10\n안녕","fallback_text":"숫자는 따옴표 없이 number = 10, 글자는 따옴표와 함께 greeting = \"안녕\" 이렇게 넣어요!"}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-3: 상자 이름 바꾸기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000027',
  'a1000000-0000-0000-0000-000000000002',
  3,
  '상자 이름 바꾸기',
  '변수 재할당',
  'code',
  NULL,
  FALSE,
  '{"topic":"변수 재할당 (값 바꾸기)","learning_goals":["변수에 새로운 값을 다시 넣을 수 있다","변수의 값은 언제든 바꿀 수 있음을 이해한다"],"story_context":"변수의 숲에서 마법 상자의 내용물을 바꿔볼까요? 상자 안의 색깔을 바꿔봐요!","exercise_description":"color 변수에 \"빨강\"을 저장한 후, \"파랑\"으로 바꾸고 print()로 출력하세요","starter_code":"# 색깔을 바꿔보세요!\ncolor = \"빨강\"\n# 아래에서 color를 \"파랑\"으로 바꿔보세요!\n\nprint(color)","expected_output_hint":"파랑 이 출력되어야 해요","checklist":["color 상자에 \"파랑\"을 다시 넣어요","print(color)로 바뀐 색을 보여 줘요"],"example_output":"파랑","fallback_text":"변수는 상자니까 안에 든 걸 바꿀 수 있어요! color = \"파랑\" 이렇게 다시 넣으면 이전 값은 사라지고 새 값이 들어가요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-4: 상자 속에 남은 것
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000104',
  'a1000000-0000-0000-0000-000000000002',
  4,
  '상자 속에 남은 것',
  '변수 재할당',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"변수에 새 값을 넣으면 어떻게 될까","learning_goals":["변수에 새 값을 넣으면 이전 값은 사라진다는 것을 안다"],"story_context":"변수의 숲 마법 상자에 색깔을 두 번 넣었어요. 상자를 열면 어떤 색이 나올까요?","fallback_text":"마법 상자에는 값이 하나만 들어가요. 새 값을 넣으면 먼저 들어 있던 값은 어떻게 될지 생각해 봐요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"color = \"빨강\"\ncolor = \"파랑\"\nprint(color)","options":[{"id":"opt-a4mf","text":"color"},{"id":"opt-e2rk","text":"빨강"},{"id":"opt-t6dw","text":"파랑"},{"id":"opt-y8sn","text":"빨강파랑"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-5: 나이 계산기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000006',
  'a1000000-0000-0000-0000-000000000002',
  5,
  '나이 계산기',
  'int 연산',
  'code',
  NULL,
  FALSE,
  '{"topic":"정수 변수의 사칙연산","learning_goals":["변수에 저장된 숫자로 덧셈, 뺄셈 등을 할 수 있다","연산 결과를 새 변수에 저장할 수 있다"],"story_context":"숲 속 나이를 알려주는 마법 거울! 태어난 해를 넣으면 나이를 계산해줘요.","exercise_description":"birth_year 변수에 자기 태어난 해를 넣고, age = 2026 - birth_year로 나이를 계산한 뒤, print(age, \"살\")로 출력하세요","starter_code":"# 나이를 계산해보세요!\nbirth_year = \nage = 2026 - birth_year\nprint(age, \"살\")","expected_output_hint":"숫자와 살 이 출력되어야 해요 (예: 12 살)","checklist":["birth_year 에 태어난 해를 숫자로 넣어요","2026 - birth_year 로 나이를 구해요","나이와 살을 함께 보여 줘요"],"example_output":"12 살","fallback_text":"birth_year = 2014 이렇게 태어난 해를 넣으면 age = 2026 - 2014로 나이가 계산돼요!"}'::jsonb,
  'contains',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-6: 글자 합치기 마법
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000028',
  'a1000000-0000-0000-0000-000000000002',
  6,
  '글자 합치기 마법',
  '문자열 연결(+)',
  'code',
  NULL,
  FALSE,
  '{"topic":"문자열 연결 연산자 +","learning_goals":["+ 연산자로 문자열을 합칠 수 있다","문자열끼리 더하면 이어붙여지는 것을 이해한다"],"story_context":"변수의 숲에서 마법 접착제를 발견했어요! 글자와 글자를 이어붙여 새로운 단어를 만들어봐요!","exercise_description":"first = \"파이\", second = \"썬\"을 변수에 저장하고, + 연산자로 합쳐서 출력하세요","starter_code":"# 글자를 합쳐보세요!\nfirst = \"파이\"\nsecond = \"썬\"\nresult = \nprint(result)","expected_output_hint":"파이썬 이 출력되어야 해요","checklist":["result 에 first + second 를 넣어요","print(result)로 합친 글자를 보여 줘요"],"example_output":"파이썬","fallback_text":"문자열끼리 + 를 쓰면 이어붙여져요! \"파이\" + \"썬\" = \"파이썬\"이 돼요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-7: 글자 합치기 순서
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000105',
  'a1000000-0000-0000-0000-000000000002',
  7,
  '글자 합치기 순서',
  '변수, 문자열 연결(+)',
  'quiz',
  'parsons',
  TRUE,
  '{"topic":"변수를 만든 뒤에 쓰는 순서","learning_goals":["변수는 값을 넣은 뒤에 쓸 수 있다는 것을 안다","+ 로 글자를 이어 붙일 수 있다"],"story_context":"마법 접착제로 이름과 장소를 붙여 숲의 안내 문장을 만들어요. 그런데 코드 줄이 뒤죽박죽 섞였어요!","fallback_text":"파이썬은 위에서 아래로 한 줄씩 실행해요. 상자를 쓰려면 그 전에 상자에 값이 들어 있어야 해요.","quiz":{"kind":"parsons","question":"줄을 순서대로 놓아 \"파이뱀이 변수의 숲에 왔어요\"가 나오게 해요","lines":[{"id":"ln-c9hl","code":"msg = name + \"이 \" + place + \"에 왔어요\""},{"id":"ln-j5ux","code":"print(msg)"},{"id":"ln-p7ga","code":"place = \"변수의 숲\""},{"id":"ln-v3qo","code":"name = \"파이뱀\""}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-8: 변신 마법! 형변환
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000007',
  'a1000000-0000-0000-0000-000000000002',
  8,
  '변신 마법! 형변환',
  'str(), int() 형변환',
  'code',
  NULL,
  FALSE,
  '{"topic":"자료형 변환 (str -> int, int -> str)","learning_goals":["int()로 문자열을 숫자로 바꿀 수 있다","str()로 숫자를 문자열로 바꿀 수 있다","형변환이 필요한 상황을 이해한다"],"story_context":"변신 마법사를 만났어요! 글자를 숫자로, 숫자를 글자로 변신시킬 수 있대요.","exercise_description":"문자열 \"100\"과 \"23\"을 int()로 숫자로 바꿔서 더한 뒤 결과를 출력하세요","starter_code":"# 문자열을 숫자로 바꿔서 더해보세요!\na = \"100\"\nb = \"23\"\nresult = \nprint(result)","expected_output_hint":"123이 출력되어야 해요","checklist":["int( )로 a와 b를 숫자로 바꿔요","두 숫자를 더해 result 에 넣어요","result 를 보여 줘요"],"example_output":"123","fallback_text":"\"100\"은 글자예요. int(\"100\")으로 숫자 100으로 변신시킬 수 있어요! 숫자끼리는 더할 수 있지요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-9: 변신 마법 버그 잡기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000106',
  'a1000000-0000-0000-0000-000000000002',
  9,
  '변신 마법 버그 잡기',
  'str() 형변환',
  'quiz',
  'bug_hunt',
  TRUE,
  '{"topic":"글자와 숫자를 이어 붙일 때","learning_goals":["글자와 숫자는 + 로 바로 이어 붙일 수 없다는 것을 안다"],"story_context":"변신 마법사가 나이 소개 문장을 만들다가 오류를 냈어요. 어느 줄이 문제일까요?","fallback_text":"글자와 숫자는 종류가 달라서 + 로 바로 붙일 수 없어요. 숫자를 글자로 바꾸는 변신 마법을 떠올려 봐요.","quiz":{"kind":"bug_hunt","question":"오류가 나는 줄을 찾아 고쳐요","lines":[{"id":"ln-d4yb","code":"age = 10"},{"id":"ln-u8fk","code":"print(\"나는 \" + age + \"살이에요\")"}],"fixes":[{"id":"fx-h2wc","code":"print(\"나는 \" + str(age) + \"살이에요\")"},{"id":"fx-n6ze","code":"print(\"나는 \" + int(age) + \"살이에요\")"},{"id":"fx-q9rt","code":"print(\"나는 + age + 살이에요\")"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-10: 자기소개 카드 만들기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000029',
  'a1000000-0000-0000-0000-000000000002',
  10,
  '자기소개 카드 만들기',
  '변수 종합',
  'code',
  NULL,
  FALSE,
  '{"topic":"변수와 문자열 연결 종합 활용","learning_goals":["여러 변수를 선언하고 값을 저장할 수 있다","문자열 연결을 사용하여 의미 있는 문장을 만들 수 있다","변수를 활용하여 자기소개 카드를 완성할 수 있다"],"story_context":"변수의 숲을 떠나기 전에, 지금까지 배운 걸 모아서 멋진 자기소개 카드를 만들어봐요!","exercise_description":"name, age, school 변수에 각각 값을 저장하고, 문자열 연결로 자기소개를 3줄로 출력하세요","starter_code":"# 자기소개 카드를 만들어보세요!\nname = \"파이뱀\"\nage = \"10\"\nschool = \"코딩초등학교\"\n\n# 아래에 print()를 3번 써서 자기소개를 출력하세요!\n","expected_output_hint":"이름: 파이뱀, 나이: 10살, 학교: 코딩초등학교 가 각각 한 줄씩 출력되어야 해요","checklist":["print( )를 세 번 써요","+ 로 \"이름: \" 과 name 을 이어 붙여요","나이 뒤에는 살, 학교 줄도 같은 방법으로 써요"],"example_output":"이름: 파이뱀\n나이: 10살\n학교: 코딩초등학교","fallback_text":"변수에 저장한 값과 문자열을 + 로 합쳐서 출력해요! print(\"이름: \" + name) 이렇게요.","is_challenge":true}'::jsonb,
  'output_match',
  '',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-11: 상자 바꿔치기 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000202',
  'a1000000-0000-0000-0000-000000000002',
  11,
  '상자 바꿔치기 버그버그',
  '변수·자료형 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"2단계에서 배운 변수·숫자와 글자·글자 합치기·형변환 총정리","learning_goals":["변수 상자에 마지막으로 넣은 값이 무엇인지 따라갈 수 있다","숫자와 글자의 + 가 어떻게 다른지 안다","int()·str()로 숫자와 글자를 바꿀 수 있다"],"story_context":"변수의 숲 마법 상자들 속이 뒤바뀌었어요! 범인은 장난꾸러기 버그버그. 상자 속을 바르게 읽어 내면 파이뱀이 버그버그를 콕 찔러요.","fallback_text":"변수는 값을 담는 이름표 붙은 상자예요. 같은 상자에 다시 넣으면 새 값으로 바뀌어요. 따옴표로 감싼 것은 글자, 따옴표가 없는 수는 숫자예요. 글자끼리 + 하면 이어 붙고, 숫자끼리 + 하면 더해져요.","boss":{"name":"상자 바꿔치기 버그버그","look":"forest","intro":"쉿! 숲속 마법 상자 속을 내가 몰래 바꿔 놨지롱. 네 문제를 다 풀면 제자리로 돌려줄게!","on_defeat":"으앗, 들켰다! 상자 속을 이렇게 잘 읽다니. 상자는 다 돌려놓을게!","on_victory":"헤헤, 상자 속이 헷갈렸지? 상자에 마지막으로 넣은 게 뭔지 떠올리고 다시 와!","rounds":[{"kind":"multiple_choice","question":"버그버그가 숫자에 따옴표를 몰래 붙였어요. 돌리면 무엇이 나올까?","code":"a = \"3\"\nb = \"4\"\nprint(a + b)","options":[{"id":"opt-d8ql","text":"a + b"},{"id":"opt-k5te","text":"34"},{"id":"opt-w2pa","text":"7"},{"id":"opt-x3nu","text":"3 + 4"}]},{"kind":"fill_blank","question":"빈칸을 채워 사과 상자에 2개를 더한 7이 나오게 해요","code":"apple = {{bk-f7ra}}(\"5\")\nprint(apple + 2)","tokens":[{"id":"tok-b8oh","text":"str"},{"id":"tok-m3si","text":"int"},{"id":"tok-v4ye","text":"print"}]},{"kind":"bug_hunt","question":"안녕, 파이뱀 이 나와야 하는데 안녕, name 이 나와요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-h4cz","code":"name = \"파이뱀\""},{"id":"ln-t9ek","code":"print(\"안녕, \" + \"name\")"}],"fixes":[{"id":"fx-e6lw","code":"print(\"안녕, \" + ''name'')"},{"id":"fx-p2dy","code":"print(\"안녕, \" + name)"},{"id":"fx-y5ar","code":"print(\"안녕, \" name)"}]},{"kind":"parsons","question":"도토리 3개를 먼저 두 배로 늘린 다음 1개를 더 넣어서, 7이 나오게 줄을 놓아요","lines":[{"id":"ln-a5wb","code":"print(acorn)"},{"id":"ln-c2mf","code":"acorn = acorn * 2"},{"id":"ln-s8gu","code":"acorn = 3"},{"id":"ln-z6oj","code":"acorn = acorn + 1"}]}],"review_quests":["b1000000-0000-0000-0000-000000000005","b1000000-0000-0000-0000-000000000007","b1000000-0000-0000-0000-000000000028","b1000000-0000-0000-0000-000000000027"]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-1: 비밀번호를 맞춰라!
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000008',
  'a1000000-0000-0000-0000-000000000003',
  1,
  '비밀번호를 맞춰라!',
  'if/else',
  'code',
  NULL,
  FALSE,
  '{"topic":"if/else 조건문","learning_goals":["if 문으로 조건을 검사할 수 있다","else로 조건이 거짓일 때 실행할 코드를 작성할 수 있다","== 비교 연산자를 사용할 수 있다"],"story_context":"갈림길의 비밀 문 앞에 섰어요! 올바른 비밀번호를 입력해야 문이 열려요.","exercise_description":"password 변수에 \"열려라\"를 저장하고, if문으로 password가 \"열려라\"와 같으면 \"통과!\"를 출력하세요","starter_code":"# 비밀번호를 확인하는 코드를 작성해보세요!\npassword = \"열려라\"\n\nif password == \"열려라\":\n    print()","expected_output_hint":"통과! 가 출력되어야 해요","checklist":["if 아래 print( ) 안에 \"통과!\"를 넣어요","if 안의 줄은 네 칸 들여 써요"],"example_output":"통과!","fallback_text":"if는 \"만약 ~라면\"이에요! if password == \"열려라\": 이렇게 조건을 쓰고, 다음 줄에 들여쓰기 후 실행할 코드를 써요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-2: 비밀 문 버그 잡기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000107',
  'a1000000-0000-0000-0000-000000000003',
  2,
  '비밀 문 버그 잡기',
  'if/else, 비교(==)',
  'quiz',
  'bug_hunt',
  TRUE,
  '{"topic":"같은지 비교하는 기호","learning_goals":["값을 넣는 기호와 같은지 비교하는 기호가 다르다는 것을 안다"],"story_context":"갈림길의 비밀 문 코드가 고장 났어요! 비밀번호가 맞는데도 문이 열리지 않고 오류가 나요.","fallback_text":"= 하나는 상자에 값을 넣는 기호예요. if 에서는 두 값이 같은지 물어봐야 해요. 앞에서 비밀번호 퀘스트를 풀 때 쓴 기호를 떠올려 봐요.","quiz":{"kind":"bug_hunt","question":"오류가 나는 줄을 찾아 고쳐요","lines":[{"id":"ln-g5ma","code":"password = \"1234\""},{"id":"ln-x7pe","code":"if password = \"1234\":"},{"id":"ln-b3sk","code":"    print(\"문이 열려요!\")"},{"id":"ln-w8vh","code":"else:"},{"id":"ln-f2ty","code":"    print(\"땡!\")"}],"fixes":[{"id":"fx-a6rq","code":"if password == \"1234\":"},{"id":"fx-l4cn","code":"if password == 1234:"},{"id":"fx-z9um","code":"if password = \"1234\""}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-3: 짝수인지 홀수인지?
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000030',
  'a1000000-0000-0000-0000-000000000003',
  3,
  '짝수인지 홀수인지?',
  'if/else, % 나머지 연산',
  'code',
  NULL,
  FALSE,
  '{"topic":"if/else와 나머지 연산자 %","learning_goals":["% 연산자로 나머지를 구할 수 있다","짝수/홀수를 판별하는 조건을 만들 수 있다"],"story_context":"갈림길에서 숫자 요정을 만났어요! 숫자가 짝수인지 홀수인지 알려줘야 길을 안내해줘요.","exercise_description":"number = 7에 대해 짝수인지 홀수인지 판별하여 출력하세요. 짝수면 \"짝수\", 홀수면 \"홀수\"를 출력!","starter_code":"# 짝수인지 홀수인지 판별해보세요!\nnumber = 7\n\nif number % 2 == 0:\n    print(\"짝수\")\nelse:\n    print()","expected_output_hint":"홀수 가 출력되어야 해요","checklist":["else 아래 print( ) 안에 \"홀수\"를 넣어요","7을 2로 나눈 나머지가 1이라 else 쪽이 돌아가요"],"example_output":"홀수","fallback_text":"% 연산자는 나누기의 나머지를 구해요! 7 % 2 = 1 이니까 홀수예요. 짝수는 나머지가 0이에요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-4: 숫자 요정의 대답
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000108',
  'a1000000-0000-0000-0000-000000000003',
  4,
  '숫자 요정의 대답',
  'if/else, % 나머지 연산',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"나머지로 짝수·홀수 가르기","learning_goals":["% 로 나머지를 구해 짝수와 홀수를 가를 수 있다","if/else 중 한 쪽만 실행된다는 것을 안다"],"story_context":"숫자 요정이 숫자 7을 들고 왔어요. 요정의 코드를 돌리면 어떤 말이 나올까요?","fallback_text":"% 는 나눈 뒤 남는 수를 구해요. 7을 2로 나누면 얼마가 남는지, 그 값이 0과 같은지 생각해 봐요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"n = 7\nif n % 2 == 0:\n    print(\"짝수\")\nelse:\n    print(\"홀수\")","options":[{"id":"opt-c2jw","text":"짝수홀수"},{"id":"opt-k3vy","text":"홀수"},{"id":"opt-m5xo","text":"1"},{"id":"opt-r8bd","text":"짝수"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-5: 성적표 만들기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000009',
  'a1000000-0000-0000-0000-000000000003',
  5,
  '성적표 만들기',
  'if/elif/else',
  'code',
  NULL,
  FALSE,
  '{"topic":"if/elif/else 다중 조건문","learning_goals":["elif로 여러 조건을 순서대로 검사할 수 있다","if/elif/else의 실행 흐름을 이해한다"],"story_context":"갈림길의 마법 성적표! 점수에 따라 다른 등급이 나와요.","exercise_description":"score = 85일 때, 90 이상이면 \"등급: A\", 80 이상이면 \"등급: B\", 그 외에는 \"등급: C\"를 출력하세요","starter_code":"# 점수에 따라 등급을 매겨보세요!\nscore = 85\n\nif score >= 90:\n    print(\"등급: A\")\nelif score >= 80:\n    print()\nelse:\n    print(\"등급: C\")","expected_output_hint":"등급: B 가 출력되어야 해요","checklist":["elif 아래 print( ) 안에 \"등급: B\"를 넣어요","85점이 어느 칸에 들어가는지 생각해 봐요"],"example_output":"등급: B","fallback_text":"elif는 \"그렇지 않고 만약 ~라면\"이에요! 위의 조건이 안 맞으면 다음 elif 조건을 확인해요."}'::jsonb,
  'contains',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-6: 놀이공원 입장
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000010',
  'a1000000-0000-0000-0000-000000000003',
  6,
  '놀이공원 입장',
  '비교연산자 (>=, <=, >, <)',
  'code',
  NULL,
  FALSE,
  '{"topic":"비교연산자로 조건 만들기","learning_goals":[">=, <=, >, < 비교연산자를 사용할 수 있다","비교 결과가 True/False임을 이해한다"],"story_context":"놀이공원에 가려면 키가 120cm 이상이어야 해요! 키를 재볼까요?","exercise_description":"height = 130일 때, height >= 120이면 \"입장 가능!\"을 출력하세요","starter_code":"# 키를 확인하는 코드를 작성해보세요!\nheight = 130\n\nif height >= 120:\n    print()","expected_output_hint":"입장 가능! 이 출력되어야 해요","checklist":["if 아래 print( ) 안에 \"입장 가능!\"을 넣어요","130이 120 이상인지 생각해 봐요"],"example_output":"입장 가능!","fallback_text":">= 는 \"크거나 같다\"는 뜻이에요! height >= 120은 키가 120 이상인지 물어보는 거예요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-7: 마법사의 조건
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000011',
  'a1000000-0000-0000-0000-000000000003',
  7,
  '마법사의 조건',
  'and/or/not 논리연산자',
  'code',
  NULL,
  FALSE,
  '{"topic":"논리연산자 and, or, not","learning_goals":["and는 두 조건이 모두 참일 때 참이 되는 것을 안다","or는 하나만 참이어도 참이 되는 것을 안다","논리연산자로 복합 조건을 만들 수 있다"],"story_context":"마법사가 되려면 두 가지 시험을 모두 통과해야 해요! 마법 점수와 용기 점수가 모두 높아야 해요.","exercise_description":"magic = 80, courage = 70일 때, 둘 다 60 이상이면 \"마법사 합격!\"을 출력하세요","starter_code":"# 마법사 자격을 확인해보세요!\nmagic = 80\ncourage = 70\n\nif magic >= 60 and courage >= 60:\n    print()","expected_output_hint":"마법사 합격! 이 출력되어야 해요","checklist":["and 로 두 조건을 함께 봐요","if 아래 print( ) 안에 \"마법사 합격!\"을 넣어요"],"example_output":"마법사 합격!","fallback_text":"and는 \"그리고\"예요! magic >= 60 and courage >= 70은 \"마법 점수가 60 이상이고 용기 점수도 60 이상\"이라는 뜻이에요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-8: 마법사 시험 빈칸
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000109',
  'a1000000-0000-0000-0000-000000000003',
  8,
  '마법사 시험 빈칸',
  'and/or 논리연산자',
  'quiz',
  'fill_blank',
  TRUE,
  '{"topic":"두 조건을 모두 따지기","learning_goals":["두 조건이 모두 참이어야 할 때 쓰는 논리연산자를 고를 수 있다"],"story_context":"마법사 시험은 마법 점수와 용기 점수가 둘 다 80점 이상이어야 합격이에요. 판정 코드에 빈칸이 생겼어요!","fallback_text":"논리연산자는 세 가지를 배웠어요. \"둘 다\"일 때, \"하나라도\"일 때, \"반대로\"일 때 각각 무엇을 쓰는지 떠올려 봐요.","quiz":{"kind":"fill_blank","question":"빈칸을 채워 두 점수가 모두 80 이상일 때만 합격이 나오게 해요","code":"magic = 90\ncourage = 70\nif magic >= 80 {{bk-t5wq}} courage >= 80:\n    print(\"마법사 합격!\")\nelse:\n    print(\"다시 도전!\")","tokens":[{"id":"tok-e7lu","text":"and"},{"id":"tok-q6ka","text":"not"},{"id":"tok-y3ni","text":"or"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-9: 가위바위보 심판
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000031',
  'a1000000-0000-0000-0000-000000000003',
  9,
  '가위바위보 심판',
  '중첩 if문',
  'code',
  NULL,
  FALSE,
  '{"topic":"중첩 if문으로 복잡한 조건 처리하기","learning_goals":["if 안에 if를 넣어 중첩 조건을 만들 수 있다","여러 조건을 조합하여 결과를 판단할 수 있다"],"story_context":"갈림길의 가위바위보 대회! 심판이 되어 누가 이겼는지 판정해봐요!","exercise_description":"player = \"가위\", computer = \"보\"일 때 가위바위보 결과를 판정하세요. 가위가 보를 이기니까 \"이겼다!\"를 출력!","starter_code":"# 가위바위보 심판이 되어보세요!\nplayer = \"가위\"\ncomputer = \"보\"\n\nif player == computer:\n    print(\"비겼다!\")\nelif player == \"가위\":\n    if computer == \"보\":\n        print()\n    else:\n        print(\"졌다!\")","expected_output_hint":"이겼다! 가 출력되어야 해요","checklist":["안쪽 if 아래 print( ) 안에 \"이겼다!\"를 넣어요","가위와 보일 때 어느 줄이 돌아가는지 따라가 봐요"],"example_output":"이겼다!","fallback_text":"if 안에 또 if를 쓸 수 있어요! 가위가 보를 이기니까, player가 가위이고 computer가 보이면 이긴 거예요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-10: 영화관 할인 시스템
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000032',
  'a1000000-0000-0000-0000-000000000003',
  10,
  '영화관 할인 시스템',
  '조건문 종합',
  'code',
  NULL,
  FALSE,
  '{"topic":"조건문 종합 활용 - 할인 시스템 만들기","learning_goals":["if/elif/else를 활용하여 실용적인 프로그램을 만들 수 있다","여러 조건을 조합하여 복잡한 로직을 구현할 수 있다","변수와 조건문을 함께 사용할 수 있다"],"story_context":"갈림길의 영화관에서 할인 시스템을 만들어야 해요! 나이와 요일에 따라 할인율이 달라져요.","exercise_description":"age=10, is_weekend=False일 때, 어린이(13세 미만) 평일 50% 할인을 적용하여 나이, 할인율, 가격을 출력하세요. 원래 가격은 10000원이에요.","starter_code":"# 영화관 할인 시스템을 만들어보세요!\nage = 10\nis_weekend = False\nprice = 10000\n\n# 어린이(13세 미만)이면 할인!\n# if 문으로 나이와 요일에 따라 discount를 정해보세요!\n\n\n# 최종 가격을 계산하세요!\n# final_price = price * (100 - discount) // 100\n\n# 나이, 할인율, 가격을 출력하세요!\n","expected_output_hint":"나이: 10살, 할인율: 50%, 가격: 5000원 이 각각 출력되어야 해요","checklist":["if 로 13세 미만인지, 평일인지 살펴서 discount 를 정해요","final_price 로 할인된 가격을 구해요","나이·할인율·가격을 한 줄씩 보여 줘요"],"example_output":"나이: 10살\n할인율: 50%\n가격: 5000원","fallback_text":"if 안에 또 if를 쓸 수 있어요! 먼저 나이로 어린이인지 확인하고, 그 안에서 평일인지 주말인지 확인해요.","is_challenge":true}'::jsonb,
  'output_match',
  '',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-11: 갈림길 장난꾼 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000203',
  'a1000000-0000-0000-0000-000000000003',
  11,
  '갈림길 장난꾼 버그버그',
  '조건문 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"3단계에서 배운 if/elif/else·비교·나머지·and/or 총정리","learning_goals":["if/elif/else 가운데 어느 줄이 실행되는지 위에서부터 따질 수 있다","비교 기호와 and/or 를 바르게 쓸 수 있다","나머지(%)로 나누어떨어지는지 판단할 수 있다"],"story_context":"갈림길 표지판이 빙글빙글 돌아가 버렸어요! 장난꾼 버그버그가 표지판을 다 돌려놓았대요. 조건을 바르게 따지면 길이 보여요.","fallback_text":"if 는 조건이 맞을 때만 그 아래 줄을 실행해요. elif 와 else 는 위의 조건이 맞지 않았을 때만 차례로 따져요. and 는 둘 다 맞아야, or 는 하나만 맞아도 참이에요.","boss":{"name":"갈림길 장난꾼 버그버그","look":"crossroad","intro":"이쪽일까~ 저쪽일까~? 표지판은 내가 다 돌려 놨지! 다섯 문제를 맞혀서 길을 찾아봐!","on_defeat":"우와, 조건을 척척 따지네! 표지판은 다시 바르게 세워 둘게. 다음 동굴에서 보자!","on_victory":"길을 잃었구나? 조건을 위에서부터 하나씩 따져 보고 다시 도전해!","rounds":[{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"score = 85\nif score >= 60:\n    print(\"통과\")\nelif score >= 80:\n    print(\"우수\")\nelse:\n    print(\"다시\")","options":[{"id":"opt-g7kx","text":"통과"},{"id":"opt-j2wi","text":"다시"},{"id":"opt-q9fe","text":"통과\n우수"},{"id":"opt-u3bn","text":"우수"}]},{"kind":"bug_hunt","question":"키가 120 이상이면 탈 수 있다고 알려 주려는데 오류가 나요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-n3rd","code":"height = 130"},{"id":"ln-v8ap","code":"if height => 120:"},{"id":"ln-f5ts","code":"    print(\"탈 수 있어요\")"}],"fixes":[{"id":"fx-c9hy","code":"if height =< 120:"},{"id":"fx-k4mw","code":"if height >= 120:"},{"id":"fx-o2xg","code":"if height <= 120:"}]},{"kind":"fill_blank","question":"빈칸을 채워 토요일이나 일요일이면 놀이공원 가는 날이 나오게 해요","code":"day = \"토요일\"\nif day == \"토요일\" {{bk-r6pd}} day == \"일요일\":\n    print(\"놀이공원 가는 날!\")\nelse:\n    print(\"학교 가는 날\")","tokens":[{"id":"tok-e2lj","text":"and"},{"id":"tok-n7vu","text":"not"},{"id":"tok-w5ic","text":"or"}]},{"kind":"parsons","question":"숫자가 3으로도 5로도 나누어떨어지면 박수 두 번, 3으로만 나누어떨어지면 박수 한 번, 아니면 숫자를 말해요. 줄을 놓고 들여쓰기도 맞춰요","lines":[{"id":"ln-a8rn","code":"print(\"박수 한 번\")"},{"id":"ln-b2ez","code":"print(\"박수 두 번\")"},{"id":"ln-c7wf","code":"print(n)"},{"id":"ln-d9qo","code":"if n % 3 == 0 and n % 5 == 0:"},{"id":"ln-m6uk","code":"elif n % 3 == 0:"},{"id":"ln-x4bh","code":"n = 15"},{"id":"ln-y3js","code":"else:"}],"indent":true},{"kind":"multiple_choice","question":"마법 점수 70, 용기 점수 90인 친구의 결과는? 돌리면 무엇이 나올까?","code":"magic = 70\ncourage = 90\nif magic >= 80 and courage >= 80:\n    print(\"대마법사\")\nelif magic >= 80 or courage >= 80:\n    print(\"견습 마법사\")\nelse:\n    print(\"다시 도전\")","options":[{"id":"opt-f4dq","text":"견습 마법사\n다시 도전"},{"id":"opt-h5vc","text":"견습 마법사"},{"id":"opt-l8tz","text":"다시 도전"},{"id":"opt-s2ma","text":"대마법사"}]}],"review_quests":["b1000000-0000-0000-0000-000000000009","b1000000-0000-0000-0000-000000000010","b1000000-0000-0000-0000-000000000011","b1000000-0000-0000-0000-000000000030","b1000000-0000-0000-0000-000000000032"]}}'::jsonb,
  'all',
  '',
  36
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-1: 숫자 세기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000012',
  'a1000000-0000-0000-0000-000000000004',
  1,
  '숫자 세기',
  'for, range()',
  'code',
  NULL,
  FALSE,
  '{"topic":"for 반복문과 range() 함수","learning_goals":["for 반복문의 구조를 이해한다","range()로 숫자 범위를 만들 수 있다","반복문 안의 코드가 여러 번 실행되는 것을 안다"],"story_context":"동굴 입구에서 마법 숫자를 세어야 문이 열려요! 1부터 5까지 세어볼까요?","exercise_description":"for 반복문과 range()를 사용하여 1부터 5까지 한 줄에 하나씩 출력하세요","starter_code":"# 1부터 5까지 세어보세요!\n# for 반복문과 range()를 사용해보세요!\n\nfor i in range(__, __):\n    print(i)","expected_output_hint":"1, 2, 3, 4, 5가 한 줄씩 출력되어야 해요","checklist":["range( ) 빈칸에 시작 숫자와 끝 숫자를 넣어요","끝 숫자는 하나 더 크게 써요","1부터 5까지 한 줄씩 나오는지 봐요"],"example_output":"1\n2\n3\n4\n5","fallback_text":"for i in range(1, 6)은 i가 1, 2, 3, 4, 5로 바뀌면서 아래 코드를 반복해요! range(1, 6)은 1부터 5까지예요 (6은 포함 안 돼요)."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-2: 동굴 문 숫자 세기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000110',
  'a1000000-0000-0000-0000-000000000004',
  2,
  '동굴 문 숫자 세기',
  'for, range()',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"range()가 만드는 숫자","learning_goals":["range(시작, 끝)은 끝 숫자를 넣지 않는다는 것을 안다"],"story_context":"동굴 문 앞에 숫자를 세는 마법 주문이 새겨져 있어요. 주문을 외우면 어떤 숫자가 나올까요?","fallback_text":"range(시작, 끝)은 시작 숫자부터 세지만, 끝 숫자는 넣지 않고 바로 앞에서 멈춰요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"for i in range(1, 4):\n    print(i)","options":[{"id":"opt-f9ob","text":"1\n2\n3\n4"},{"id":"opt-n2hr","text":"0\n1\n2\n3"},{"id":"opt-s7ak","text":"0\n1\n2"},{"id":"opt-w4ze","text":"1\n2\n3"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-3: 구구단 외우기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000013',
  'a1000000-0000-0000-0000-000000000004',
  3,
  '구구단 외우기',
  'for 반복문 활용',
  'code',
  NULL,
  FALSE,
  '{"topic":"for 반복문으로 구구단 출력하기","learning_goals":["for 반복문을 활용하여 패턴을 출력할 수 있다","변수를 활용한 계산식을 반복문에서 사용할 수 있다"],"story_context":"동굴의 마법사가 구구단 시험을 내요! 2단을 외워볼까요?","exercise_description":"for 반복문으로 2단 구구단(2x1=2부터 2x9=18)을 출력하세요. 형식: 2 x 1 = 2","starter_code":"# 2단 구구단을 출력해보세요!\n# 형식: 2 x 1 = 2\n\nfor i in range(1, 10):\n    print()","expected_output_hint":"2 x 1 = 2 부터 2 x 9 = 18 까지 출력되어야 해요","checklist":["print( ) 안에 2, \"x\", i, \"=\", 2*i 를 차례로 넣어요","2 x 1 = 2 부터 2 x 9 = 18 까지 나오는지 봐요"],"example_output":"2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18","fallback_text":"for i in range(1, 10)으로 i가 1부터 9까지 바뀌면서 2 * i를 계산해요! print(2, \"x\", i, \"=\", 2*i)로 예쁘게 출력할 수 있어요."}'::jsonb,
  'contains',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-4: 별 찍기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000033',
  'a1000000-0000-0000-0000-000000000004',
  4,
  '별 찍기',
  '문자열 반복(*)',
  'code',
  NULL,
  FALSE,
  '{"topic":"문자열 반복 연산자 *","learning_goals":["* 연산자로 문자열을 반복할 수 있다","print()와 문자열 반복을 조합할 수 있다"],"story_context":"동굴 벽에 별을 새겨야 마법 문이 열려요! 별을 5개 찍어볼까요?","exercise_description":"print(\"*\" * 5)를 사용하여 별 5개를 한 줄로 출력하세요","starter_code":"# 별을 5개 찍어보세요!\n# 힌트: 문자열 * 숫자 = 반복!\n\nprint(\"*\" * ___)","expected_output_hint":"***** 가 출력되어야 해요","checklist":["\"*\" * 뒤 빈칸에 5를 넣어요","별 다섯 개가 한 줄로 나오는지 봐요"],"example_output":"*****","fallback_text":"문자열에 * 숫자를 하면 그만큼 반복돼요! \"*\" * 5 = \"*****\" 이에요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-5: 합계 구하기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000034',
  'a1000000-0000-0000-0000-000000000004',
  5,
  '합계 구하기',
  '누적 변수 + for',
  'code',
  NULL,
  FALSE,
  '{"topic":"누적 변수와 for 반복문으로 합계 구하기","learning_goals":["누적 변수를 사용하여 값을 더해갈 수 있다","for 반복문과 누적 변수를 조합할 수 있다"],"story_context":"동굴 속 보물 더미! 금화를 하나씩 세어서 총 몇 개인지 합계를 구해봐요!","exercise_description":"1부터 10까지 숫자를 모두 더한 합계를 구하여 출력하세요","starter_code":"# 1부터 10까지 합계를 구해보세요!\ntotal = 0\n\nfor i in range(1, 11):\n    # total에 i를 더해보세요! (힌트: total = total + ?)\n    \n\nprint(total)","expected_output_hint":"55 가 출력되어야 해요 (1+2+3+...+10 = 55)","checklist":["반복 안에서 total = total + i 를 써요","그 줄은 for 안쪽으로 들여 써요","마지막에 total 을 보여 줘요"],"example_output":"55","fallback_text":"total = 0으로 시작해서, 반복할 때마다 total = total + i로 숫자를 더해가요! 1+2+3+...+10 = 55예요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-6: 금화 합계 순서
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000111',
  'a1000000-0000-0000-0000-000000000004',
  6,
  '금화 합계 순서',
  '누적 변수 + for',
  'quiz',
  'parsons',
  TRUE,
  '{"topic":"반복하며 더하기","learning_goals":["합계 변수를 반복 전에 0으로 만들어야 한다는 것을 안다","반복할 줄만 들여쓰기한다"],"story_context":"동굴 속 금화 더미를 1개, 2개, … 5개씩 쌓아 모두 몇 개인지 세려고 해요. 그런데 코드 줄이 섞였어요!","fallback_text":"합계 상자는 반복을 시작하기 전에 준비해요. 반복 안에서 할 일만 들여쓰기하고, 다 더한 뒤에 한 번만 보여 줘요.","quiz":{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 1부터 5까지 더한 값을 한 번만 보여 줘요","lines":[{"id":"ln-a8ve","code":"total = total + i"},{"id":"ln-h6ns","code":"for i in range(1, 6):"},{"id":"ln-m3dp","code":"print(total)"},{"id":"ln-y2bq","code":"total = 0"}],"indent":true}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-7: 보물 찾기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000014',
  'a1000000-0000-0000-0000-000000000004',
  7,
  '보물 찾기',
  'while, break',
  'code',
  NULL,
  FALSE,
  '{"topic":"while 반복문과 break","learning_goals":["while 반복문의 구조를 이해한다","break로 반복문을 중간에 멈출 수 있다","조건이 거짓이 될 때까지 반복하는 것을 안다"],"story_context":"동굴 속에서 보물을 찾아 헤매는 모험가! 보물을 찾으면 멈춰야 해요.","exercise_description":"위치를 1부터 하나씩 늘려가며 위치가 5일 때 \"보물 발견!\"을 출력하고 반복을 멈추세요","starter_code":"# 보물을 찾아보세요!\nposition = 1\n\nwhile position <= 10:\n    if position == 5:\n        # 보물을 찾으면 메시지를 출력하고 멈추세요!\n        \n    position = position + 1","expected_output_hint":"보물 발견! 이 출력되어야 해요","checklist":["if 아래에서 print( )로 \"보물 발견!\"을 보여 줘요","바로 다음 줄에 break 로 반복을 멈춰요"],"example_output":"보물 발견!","fallback_text":"while은 조건이 맞는 동안 계속 반복해요. break를 만나면 반복을 멈춰요! if position == 5: 에서 보물을 찾으면 break로 탈출!"}'::jsonb,
  'contains',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-8: 짝수만 골라내기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000015',
  'a1000000-0000-0000-0000-000000000004',
  8,
  '짝수만 골라내기',
  'for, if, continue',
  'code',
  NULL,
  FALSE,
  '{"topic":"continue로 특정 반복 건너뛰기","learning_goals":["continue가 현재 반복만 건너뛰는 것을 안다","% (나머지) 연산자를 사용할 수 있다","for와 if를 조합하여 필터링할 수 있다"],"story_context":"동굴의 마법 필터! 짝수만 통과시키고 홀수는 막아요.","exercise_description":"1부터 10까지 반복하면서 짝수만 출력하세요 (홀수는 continue로 건너뛰기)","starter_code":"# 짝수만 출력해보세요!\nfor i in range(1, 11):\n    if i % 2 != 0:\n        # 홀수면 건너뛰세요!\n        \n    print(i)","expected_output_hint":"2, 4, 6, 8, 10이 한 줄씩 출력되어야 해요","checklist":["홀수일 때 continue 를 써서 건너뛰어요","짝수만 한 줄씩 나오는지 봐요"],"example_output":"2\n4\n6\n8\n10","fallback_text":"% 는 나머지를 구하는 연산자예요! i % 2 != 0은 홀수라는 뜻이에요. continue를 만나면 아래 코드를 건너뛰고 다음 반복으로 가요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-9: 카운트다운
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000035',
  'a1000000-0000-0000-0000-000000000004',
  9,
  '카운트다운',
  'while 감소 반복',
  'code',
  NULL,
  FALSE,
  '{"topic":"while 반복문으로 감소하며 반복하기","learning_goals":["while 반복문으로 숫자를 줄여가며 반복할 수 있다","감소하는 반복 패턴을 이해한다"],"story_context":"동굴 탈출 카운트다운! 5초 안에 빠져나가야 해요! 5, 4, 3, 2, 1... 탈출!","exercise_description":"while 반복문으로 5부터 1까지 카운트다운을 출력하세요","starter_code":"# 카운트다운을 만들어보세요!\ncount = 5\n\nwhile count >= 1:\n    print(count)\n    # count를 1씩 줄여보세요! ___ 에 알맞은 숫자를 넣어요\n    count = count - ___\n","expected_output_hint":"5, 4, 3, 2, 1이 한 줄씩 출력되어야 해요","checklist":["빈칸 ___ 에 1을 넣어 count 를 하나씩 줄여요","5부터 1까지 한 줄씩 나오는지 봐요"],"example_output":"5\n4\n3\n2\n1","fallback_text":"count = 5에서 시작해서, 반복할 때마다 count = count - 1로 1씩 줄여가요. count가 0이 되면 멈춰요!"}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-10: 끝나지 않는 카운트다운
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000112',
  'a1000000-0000-0000-0000-000000000004',
  10,
  '끝나지 않는 카운트다운',
  'while 반복, 들여쓰기',
  'quiz',
  'bug_hunt',
  TRUE,
  '{"topic":"반복이 끝나지 않을 때","learning_goals":["while 반복 안에서 조건에 쓰는 값이 바뀌어야 반복이 끝난다는 것을 안다"],"story_context":"동굴 탈출 카운트다운을 돌렸더니 3만 끝없이 나와요! 이대로면 동굴을 빠져나갈 수 없어요.","fallback_text":"while 은 조건이 참인 동안 들여쓰기한 줄을 계속 반복해요. 반복 안에서 n이 바뀌고 있는지 살펴봐요.","quiz":{"kind":"bug_hunt","question":"이 코드는 끝나지 않고 3만 계속 나와요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-e5gc","code":"n = 3"},{"id":"ln-p9ri","code":"while n > 0:"},{"id":"ln-t2xm","code":"    print(n)"},{"id":"ln-o6fu","code":"n = n - 1"},{"id":"ln-j3wa","code":"print(\"탈출!\")"}],"fixes":[{"id":"fx-d3hv","code":"    n = n + 1"},{"id":"fx-r6pq","code":"n = n - 2"},{"id":"fx-u7ky","code":"    n = n - 1"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-11: 별 피라미드 만들기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000036',
  'a1000000-0000-0000-0000-000000000004',
  11,
  '별 피라미드 만들기',
  '반복 종합',
  'code',
  NULL,
  FALSE,
  '{"topic":"for 반복문과 문자열 반복으로 피라미드 만들기","learning_goals":["for 반복문과 문자열 반복(*)을 조합할 수 있다","반복 변수를 활용하여 패턴을 만들 수 있다"],"story_context":"동굴을 탈출하면 별 피라미드를 쌓아야 해요! 반복의 마법으로 피라미드를 완성해봐요!","exercise_description":"for 반복문과 \"*\" * i 를 사용하여 5줄짜리 별 피라미드를 만드세요","starter_code":"# 별 피라미드를 만들어보세요!\n# 1줄: *\n# 2줄: **\n# ...\n# 5줄: *****\n\nfor i in range(1, 6):\n    print()","expected_output_hint":"* 부터 ***** 까지 피라미드가 출력되어야 해요","checklist":["print( ) 안에 \"*\" * i 를 넣어요","줄마다 별이 하나씩 늘어나는지 봐요"],"example_output":"*\n**\n***\n****\n*****","fallback_text":"for i in range(1, 6)으로 i가 1, 2, 3, 4, 5가 되면서 \"*\" * i로 별이 1개, 2개, 3개, 4개, 5개 출력돼요!","is_challenge":true}'::jsonb,
  'output_match',
  '',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-12: 메아리 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000204',
  'a1000000-0000-0000-0000-000000000004',
  12,
  '메아리 버그버그',
  '반복문 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"4단계에서 배운 for·range()·while·반복 멈추기와 건너뛰기·글자 곱하기 총정리","learning_goals":["range()가 어디서 시작해 어디 앞에서 멈추는지 안다","반복할 때마다 상자 값이 어떻게 바뀌는지 따라갈 수 있다","반복을 아예 끝내는 말과 이번 차례만 건너뛰는 말을 구별한다"],"story_context":"동굴 깊은 곳에서 \"반복~ 반복~\" 메아리가 끝없이 울려요. 메아리를 멈추지 않으면 동굴 밖으로 나갈 수 없대요!","fallback_text":"for 는 정해진 횟수만큼, while 은 조건이 맞는 동안 반복해요. range(1, 5)는 1부터 시작해 5 바로 앞인 4에서 멈춰요. break 는 반복을 아예 끝내요. 이번 차례만 건너뛰고 다음 차례로 가는 말도 따로 있어요.","boss":{"name":"메아리 버그버그","look":"cave","intro":"반복! 반복! 반복~! 동굴에 내 목소리가 울린다~ 다섯 문제를 다 풀기 전엔 못 나가지롱~","on_defeat":"메아리가… 멈췄다…! 반복을 이렇게 잘 세다니. 동굴 문 열어 줄게~ 열어 줄게~","on_victory":"또 만났네~ 만났네~ 반복이 몇 번 도는지 손가락으로 세어 보고 다시 와~","rounds":[{"kind":"multiple_choice","question":"메아리 주문이에요. 돌리면 무엇이 나올까?","code":"for i in range(3):\n    print(\"메\" + \"아\" * i)","options":[{"id":"opt-b3ky","text":"메아\n메아아\n메아아아"},{"id":"opt-n6dw","text":"메\n메아\n메아아"},{"id":"opt-t8oe","text":"메아\n메아\n메아"},{"id":"opt-z4cr","text":"메아아아"}]},{"kind":"bug_hunt","question":"1부터 5까지 세야 하는데 5가 빠져요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-r7hq","code":"for i in range(1, 5):"},{"id":"ln-e2vs","code":"    print(i)"}],"fixes":[{"id":"fx-h6lc","code":"for i in range(2, 6):"},{"id":"fx-u9ab","code":"for i in range(0, 5):"},{"id":"fx-w3gn","code":"for i in range(1, 6):"}]},{"kind":"fill_blank","question":"빈칸을 채워 4만 건너뛰고 1, 2, 3, 5, 6, 7 이 나오게 해요","code":"for n in range(1, 8):\n    if n == 4:\n        {{bk-j5yt}}\n    print(n)","tokens":[{"id":"tok-c4ga","text":"break"},{"id":"tok-o3fm","text":"stop"},{"id":"tok-p8ux","text":"continue"}]},{"kind":"parsons","question":"while 로 3 + 2 + 1 을 더해서 합계 6을 딱 한 번만 보여 줘요. 줄을 놓고 들여쓰기도 맞춰요","lines":[{"id":"ln-d3yf","code":"print(total)"},{"id":"ln-g4ma","code":"total = total + n"},{"id":"ln-i2pw","code":"n = 3"},{"id":"ln-k7rb","code":"n = n - 1"},{"id":"ln-q8ze","code":"while n > 0:"},{"id":"ln-v5ok","code":"total = 0"}],"indent":true},{"kind":"multiple_choice","question":"동굴 출구 주문이에요. 돌리면 무엇이 나올까?","code":"for n in range(1, 10):\n    if n % 2 == 0:\n        continue\n    if n > 5:\n        break\n    print(n)","options":[{"id":"opt-a9kf","text":"1\n3\n5\n7\n9"},{"id":"opt-m4xu","text":"1\n3\n5"},{"id":"opt-w7se","text":"2\n4"},{"id":"opt-y5bl","text":"1\n3\n5\n7"}]}],"review_quests":["b1000000-0000-0000-0000-000000000033","b1000000-0000-0000-0000-000000000012","b1000000-0000-0000-0000-000000000015","b1000000-0000-0000-0000-000000000035","b1000000-0000-0000-0000-000000000014"]}}'::jsonb,
  'all',
  '',
  36
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-1: 과일 바구니
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000016',
  'a1000000-0000-0000-0000-000000000005',
  1,
  '과일 바구니',
  '리스트 생성',
  'code',
  NULL,
  FALSE,
  '{"topic":"리스트 생성과 출력","learning_goals":["대괄호 []로 리스트를 만들 수 있다","리스트에 여러 값을 저장할 수 있다","리스트 전체를 출력할 수 있다"],"story_context":"호수 옆 과일 가게에서 과일 바구니를 만들어요! 좋아하는 과일을 담아봐요.","exercise_description":"fruits라는 리스트에 \"사과\", \"바나나\", \"포도\"를 넣고 출력하세요","starter_code":"# 과일 바구니를 만들어보세요!\n# 대괄호 [] 안에 \"사과\", \"바나나\", \"포도\"를 넣어보세요!\n\nfruits = []\nprint(fruits)","expected_output_hint":"사과, 바나나, 포도가 리스트로 출력되어야 해요","checklist":["대괄호 [ ] 안에 \"사과\", \"바나나\", \"포도\"를 넣어요","사이사이에 쉼표를 찍어요"],"example_output":"[''사과'', ''바나나'', ''포도'']","fallback_text":"리스트는 여러 값을 한 상자에 담는 거예요! [\"사과\", \"바나나\", \"포도\"] 이렇게 대괄호 안에 쉼표로 구분해서 넣어요."}'::jsonb,
  'contains',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-2: 보물 목록 정리
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000017',
  'a1000000-0000-0000-0000-000000000005',
  2,
  '보물 목록 정리',
  '인덱싱, 슬라이싱',
  'code',
  NULL,
  FALSE,
  '{"topic":"리스트 인덱싱과 슬라이싱","learning_goals":["인덱스 번호로 리스트의 특정 값을 꺼낼 수 있다","인덱스가 0부터 시작하는 것을 안다","슬라이싱으로 리스트의 일부를 잘라낼 수 있다"],"story_context":"보물 목록에서 원하는 보물을 골라내봐요! 몇 번째 보물을 꺼낼까요?","exercise_description":"treasures 리스트에서 인덱스를 사용하여 \"다이아몬드\"를 출력하세요","starter_code":"# 보물 목록에서 다이아몬드를 꺼내보세요!\ntreasures = [\"금화\", \"은화\", \"다이아몬드\", \"루비\"]\nprint(treasures[__])","expected_output_hint":"다이아몬드 가 출력되어야 해요","checklist":["treasures[ ] 빈칸에 다이아몬드의 번호를 넣어요","번호는 0부터 센다는 걸 기억해요"],"example_output":"다이아몬드","fallback_text":"리스트의 번호는 0부터 시작해요! treasures[0]은 금화, treasures[1]은 은화, treasures[2]는 다이아몬드예요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-3: 없는 과일 꺼내기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000113',
  'a1000000-0000-0000-0000-000000000005',
  3,
  '없는 과일 꺼내기',
  '인덱싱',
  'quiz',
  'bug_hunt',
  TRUE,
  '{"topic":"리스트 번호는 0부터","learning_goals":["리스트의 마지막 번호는 개수보다 1 작다는 것을 안다"],"story_context":"호수 옆 과일 가게에서 첫 과일과 마지막 과일을 보여 주려는데 오류가 났어요!","fallback_text":"리스트 번호는 0부터 세요. 과일이 3개면 번호는 몇부터 몇까지일지 세어 봐요.","quiz":{"kind":"bug_hunt","question":"첫 과일과 마지막 과일을 보여 주려는데 오류가 나요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-q4zs","code":"fruits = [\"사과\", \"바나나\", \"포도\"]"},{"id":"ln-b8ju","code":"print(fruits[0])"},{"id":"ln-x3nd","code":"print(fruits[3])"}],"fixes":[{"id":"fx-g2mt","code":"print(fruits[4])"},{"id":"fx-i9wl","code":"print(fruits(3))"},{"id":"fx-k5oy","code":"print(fruits[2])"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-4: 리스트 순회하기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000037',
  'a1000000-0000-0000-0000-000000000005',
  4,
  '리스트 순회하기',
  'for + 리스트',
  'code',
  NULL,
  FALSE,
  '{"topic":"for 반복문으로 리스트 순회하기","learning_goals":["for 반복문으로 리스트의 각 항목을 하나씩 꺼낼 수 있다","리스트 순회의 개념을 이해한다"],"story_context":"리스트 호수에서 색깔 물고기를 하나씩 잡아보아요! for 반복문으로 모든 물고기를 순서대로 만나봐요!","exercise_description":"colors = [\"빨강\", \"초록\", \"파랑\"] 리스트를 for 반복문으로 순회하며 각 색깔을 출력하세요","starter_code":"# 색깔을 하나씩 출력해보세요!\ncolors = [\"빨강\", \"초록\", \"파랑\"]\n\nfor color in colors:\n    # color를 출력해보세요!\n    ","expected_output_hint":"빨강, 초록, 파랑이 한 줄씩 출력되어야 해요","checklist":["for 아래에 print(color)를 써요","그 줄은 네 칸 들여 써요"],"example_output":"빨강\n초록\n파랑","fallback_text":"for color in colors: 라고 쓰면 colors 리스트에서 하나씩 꺼내서 color 변수에 넣어줘요! 첫 번째는 빨강, 두 번째는 초록, 세 번째는 파랑이에요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-5: 친구 목록 관리
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000018',
  'a1000000-0000-0000-0000-000000000005',
  5,
  '친구 목록 관리',
  'append(), len()',
  'code',
  NULL,
  FALSE,
  '{"topic":"리스트에 추가하기(append)와 길이 구하기(len)","learning_goals":["append()로 리스트에 새 값을 추가할 수 있다","len()으로 리스트의 길이를 구할 수 있다"],"story_context":"호수 마을에서 새 친구를 만났어요! 친구 목록에 추가하고 몇 명인지 세어봐요.","exercise_description":"friends 리스트에 \"파이뱀\"을 append하고, len()으로 친구 수를 출력하세요","starter_code":"# 친구를 추가하고 몇 명인지 세어보세요!\nfriends = [\"토끼\", \"거북이\", \"다람쥐\"]\n\n# 아래에 \"파이뱀\"을 추가하고, 친구 수를 출력하세요!\n\nprint()","expected_output_hint":"4 가 출력되어야 해요 (3명 + 파이뱀 1명)","checklist":["friends.append( )로 \"파이뱀\"을 더해요","print( ) 안에 len(friends)를 넣어 친구 수를 보여 줘요"],"example_output":"4","fallback_text":"append()는 리스트 끝에 새 값을 추가해요! len()은 리스트에 몇 개가 있는지 세어줘요."}'::jsonb,
  'contains',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-6: 새 친구 빈칸
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000114',
  'a1000000-0000-0000-0000-000000000005',
  6,
  '새 친구 빈칸',
  'append(), len()',
  'quiz',
  'fill_blank',
  TRUE,
  '{"topic":"리스트에 넣고 세기","learning_goals":["리스트 끝에 값을 더하는 함수를 고를 수 있다","리스트의 길이를 세는 함수를 고를 수 있다"],"story_context":"호수 마을에서 여우를 새 친구로 사귀었어요! 친구 목록에 넣고 친구가 모두 몇인지 세어 봐요.","fallback_text":"리스트 끝에 하나를 더하는 함수와, 리스트에 몇 개가 들었는지 세는 함수를 친구 목록 퀘스트에서 배웠어요.","quiz":{"kind":"fill_blank","question":"빈칸을 채워 여우를 친구 목록에 넣고, 친구가 모두 몇인지 보여 줘요","code":"friends = [\"토끼\", \"곰\"]\nfriends.{{bk-w6fe}}(\"여우\")\nprint({{bk-c4ro}}(friends))","tokens":[{"id":"tok-a3gn","text":"append"},{"id":"tok-d5yi","text":"add"},{"id":"tok-l7vb","text":"len"},{"id":"tok-s2pe","text":"sort"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-7: 리스트 정렬하기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000038',
  'a1000000-0000-0000-0000-000000000005',
  7,
  '리스트 정렬하기',
  'sort()',
  'code',
  NULL,
  FALSE,
  '{"topic":"리스트 정렬하기 sort()","learning_goals":["sort()로 리스트를 오름차순 정렬할 수 있다","정렬 후 리스트가 변경되는 것을 이해한다"],"story_context":"리스트 호수의 숫자 물고기가 뒤죽박죽이에요! sort()로 깔끔하게 정리해봐요!","exercise_description":"numbers = [3, 1, 4, 1, 5]를 sort()로 정렬한 후 출력하세요","starter_code":"# 숫자를 정렬해보세요!\nnumbers = [3, 1, 4, 1, 5]\n\n# sort()로 정렬하세요!\n\nprint(numbers)","expected_output_hint":"[1, 1, 3, 4, 5] 가 출력되어야 해요","checklist":["numbers.sort( )로 작은 수부터 줄 세워요","print(numbers)로 보여 줘요"],"example_output":"[1, 1, 3, 4, 5]","fallback_text":"sort()는 리스트를 작은 수부터 큰 수 순서로 정리해줘요! numbers.sort() 이렇게 쓰면 돼요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-8: 정렬한 물고기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000115',
  'a1000000-0000-0000-0000-000000000005',
  8,
  '정렬한 물고기',
  'sort()',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"sort()한 리스트 보기","learning_goals":["sort()가 리스트를 작은 수부터 늘어놓는다는 것을 안다","print로 리스트를 보여 주면 대괄호까지 나온다는 것을 안다"],"story_context":"리스트 호수의 숫자 물고기가 뒤죽박죽이에요. 정렬 마법을 쓴 뒤 리스트를 보여 주면 어떻게 나올까요?","fallback_text":"sort()는 리스트 안의 순서를 작은 수부터 큰 수로 바꿔요. 리스트를 통째로 print 하면 대괄호와 쉼표까지 그대로 나와요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"nums = [3, 1, 2]\nnums.sort()\nprint(nums)","options":[{"id":"opt-h8mz","text":"[3, 2, 1]"},{"id":"opt-p6jt","text":"[1, 2, 3]"},{"id":"opt-u3cy","text":"[3, 1, 2]"},{"id":"opt-v2bk","text":"1 2 3"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-9: 리스트 속 검색
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000039',
  'a1000000-0000-0000-0000-000000000005',
  9,
  '리스트 속 검색',
  'in 연산자',
  'code',
  NULL,
  FALSE,
  '{"topic":"in 연산자로 리스트에서 값 찾기","learning_goals":["in 연산자로 리스트에 특정 값이 있는지 확인할 수 있다","in의 결과가 True/False임을 이해한다"],"story_context":"리스트 호수의 과일 바구니에서 바나나를 찾아봐요! in 마법으로 있는지 확인할 수 있어요!","exercise_description":"fruits 리스트에 \"바나나\"가 있는지 in 연산자로 확인하고 결과를 출력하세요","starter_code":"# 바나나가 있는지 찾아보세요!\nfruits = [\"사과\", \"바나나\", \"포도\"]\n\n# in 연산자로 \"바나나\"가 fruits에 있는지 확인해서 result에 저장하세요!\nresult = \nprint(result)","expected_output_hint":"True 가 출력되어야 해요","checklist":["result 에 \"바나나\" in fruits 를 넣어요","print(result)로 True 인지 False 인지 봐요"],"example_output":"True","fallback_text":"in 연산자는 리스트에 값이 있는지 확인해요! \"바나나\" in fruits는 바나나가 fruits에 있으면 True, 없으면 False를 돌려줘요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-10: 쇼핑 리스트 정리기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000040',
  'a1000000-0000-0000-0000-000000000005',
  10,
  '쇼핑 리스트 정리기',
  '리스트 종합',
  'code',
  NULL,
  FALSE,
  '{"topic":"리스트 종합 활용 - 쇼핑 리스트 만들기","learning_goals":["빈 리스트를 만들고 append()로 항목을 추가할 수 있다","sort()로 리스트를 정렬할 수 있다","for 반복문으로 리스트를 순회하여 출력할 수 있다","len()으로 항목 수를 세어 출력할 수 있다"],"story_context":"리스트 호수에서 마지막 시험! 쇼핑 리스트를 만들고, 정리하고, 예쁘게 출력해봐요!","exercise_description":"빈 리스트를 만들고, 우유/주스/과자를 append하고, sort()로 정렬한 후, for로 순회 출력하세요","starter_code":"# 쇼핑 리스트를 만들어보세요!\nshopping = []\n\n# 3개 항목을 추가하세요! (append 사용)\n\n\n# 정렬하세요! (sort 사용)\n\n\n# 출력하세요!\nprint(\"--- 쇼핑 목록 ---\")\nfor item in shopping:\n    print(item)\nprint(\"총 \" + str(len(shopping)) + \"개\")","expected_output_hint":"쇼핑 목록이 정렬되어 출력되어야 해요","checklist":["append( )로 우유·주스·과자를 하나씩 더해요","sort( )로 가나다 순서로 줄 세워요","목록과 총 개수가 나오는지 봐요"],"example_output":"--- 쇼핑 목록 ---\n과자\n우유\n주스\n총 3개","fallback_text":"빈 리스트 []를 만들고, append()로 항목을 추가하고, sort()로 정렬한 뒤, for로 하나씩 출력해요!","is_challenge":true}'::jsonb,
  'output_match',
  '',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-11: 뒤죽박죽 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000205',
  'a1000000-0000-0000-0000-000000000005',
  11,
  '뒤죽박죽 버그버그',
  '리스트 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"5단계에서 배운 리스트·번호(인덱스)·append()·len()·sort()·in 총정리","learning_goals":["리스트 번호가 0부터 시작함을 알고 값을 꺼낼 수 있다","append()·len()·sort()가 리스트를 어떻게 바꾸는지 따라갈 수 있다","for 로 리스트를 하나씩 돌며 골라 담을 수 있다"],"story_context":"첨벙! 리스트 호수의 물고기 목록이 뒤죽박죽 섞여 버렸어요. 물을 튀기며 웃는 건 바로 버그버그! 목록을 바르게 읽어 내면 물고기들이 제자리로 돌아와요.","fallback_text":"리스트는 여러 값을 대괄호 안에 차례로 담아요. 번호는 0부터 세요. append()는 맨 뒤에 하나를 더하고, len()은 몇 개인지 세고, sort()는 작은 것부터 줄을 세워요. in 은 리스트 안에 있는지 확인해요.","boss":{"name":"뒤죽박죽 버그버그","look":"lake","intro":"첨벙첨벙! 물고기 목록을 뒤죽박죽 섞어 놨지롱! 여섯 문제를 풀면 다시 줄 세워 줄게!","on_defeat":"으앗, 번호를 딱딱 맞게 세네! 물고기들은 제자리로 돌려놓을게. 탑에서 또 보자!","on_victory":"헤헤, 물고기 순서가 헷갈렸지? 번호를 어디서부터 세는지 떠올리고 다시 와!","rounds":[{"kind":"multiple_choice","question":"물고기 한 마리를 더 넣었어요. 돌리면 무엇이 나올까?","code":"fish = [\"붕어\", \"잉어\", \"메기\"]\nfish.append(\"송어\")\nprint(len(fish))\nprint(fish[1])","options":[{"id":"opt-c5ri","text":"4\n잉어"},{"id":"opt-e3wy","text":"3\n잉어"},{"id":"opt-k8ad","text":"4\n붕어"},{"id":"opt-v2hn","text":"3\n붕어"}]},{"kind":"fill_blank","question":"빈칸을 채워 바구니에 배가 들어 있으면 배가 있어요! 가 나오게 해요","code":"basket = [\"사과\", \"배\", \"감\"]\nif \"배\" {{bk-u7nc}} basket:\n    print(\"배가 있어요!\")","tokens":[{"id":"tok-f9db","text":"=="},{"id":"tok-i6kq","text":"not"},{"id":"tok-r2xo","text":"in"}]},{"kind":"bug_hunt","question":"물고기 색을 한 줄에 하나씩 보여 주려는데 리스트 전체가 세 번 나와요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-w4fs","code":"colors = [\"빨강\", \"파랑\", \"노랑\"]"},{"id":"ln-o8ck","code":"for c in colors:"},{"id":"ln-l3tm","code":"    print(colors)"}],"fixes":[{"id":"fx-b2qu","code":"    print(\"c\")"},{"id":"fx-g5zi","code":"    print(colors[c])"},{"id":"fx-s7ve","code":"    print(c)"}]},{"kind":"parsons","question":"20cm보다 큰 물고기만 새 리스트에 담고, 몇 마리인지 한 번만 보여 줘요. 줄을 놓고 들여쓰기도 맞춰요","lines":[{"id":"ln-a2gx","code":"print(len(big))"},{"id":"ln-e7rn","code":"big.append(f)"},{"id":"ln-h3ow","code":"big = []"},{"id":"ln-p4uj","code":"if f > 20:"},{"id":"ln-t6eb","code":"fish = [12, 30, 8, 25]"},{"id":"ln-z9ak","code":"for f in fish:"}],"indent":true},{"kind":"multiple_choice","question":"물고기 숫자를 줄 세운 뒤 맨 앞과 맨 뒤를 보여 줘요. 돌리면 무엇이 나올까?","code":"nums = [7, 2, 9, 4]\nnums.sort()\nprint(nums[0])\nprint(nums[3])","options":[{"id":"opt-d4nt","text":"9\n2"},{"id":"opt-i8wa","text":"[2, 4, 7, 9]"},{"id":"opt-q3jm","text":"2\n9"},{"id":"opt-x7bf","text":"7\n4"}]},{"kind":"bug_hunt","question":"여우를 친구 목록에 넣고 친구 수 3을 보여 주려는데 오류가 나요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-f6pv","code":"friends = [\"토끼\", \"곰\"]"},{"id":"ln-n2he","code":"friends = friends.append(\"여우\")"},{"id":"ln-u5cs","code":"print(len(friends))"}],"fixes":[{"id":"fx-c6wd","code":"friends + \"여우\""},{"id":"fx-j3ol","code":"friends.append(\"여우\")"},{"id":"fx-r8yk","code":"friends.append(여우)"}]}],"review_quests":["b1000000-0000-0000-0000-000000000017","b1000000-0000-0000-0000-000000000039","b1000000-0000-0000-0000-000000000037","b1000000-0000-0000-0000-000000000018","b1000000-0000-0000-0000-000000000038","b1000000-0000-0000-0000-000000000018"]}}'::jsonb,
  'all',
  '',
  45
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-1: 인사하는 함수
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000019',
  'a1000000-0000-0000-0000-000000000006',
  1,
  '인사하는 함수',
  'def, 함수 호출',
  'code',
  NULL,
  FALSE,
  '{"topic":"함수 정의(def)와 호출","learning_goals":["def 키워드로 함수를 만들 수 있다","만든 함수를 호출하여 실행할 수 있다","함수가 코드를 묶어서 재사용하는 것임을 이해한다"],"story_context":"탑의 마법사에게 인사 마법을 배워요! 한 번 만들면 여러 번 사용할 수 있어요.","exercise_description":"greet라는 함수를 만들어 \"안녕! 나는 파이뱀이야!\"를 출력하고, 함수를 호출하세요","starter_code":"# 인사하는 함수를 만들어보세요!\ndef greet():\n    # \"안녕! 나는 파이뱀이야!\"를 출력하세요!\n    \n\ngreet()","expected_output_hint":"안녕! 나는 파이뱀이야! 가 출력되어야 해요","checklist":["def greet( ) 안에 print( )를 들여 써요","\"안녕! 나는 파이뱀이야!\"를 넣어요","greet( )을 불러서 인사가 나오는지 봐요"],"example_output":"안녕! 나는 파이뱀이야!","fallback_text":"def greet(): 으로 함수를 만들고, 안에 실행할 코드를 쓴 뒤, greet()으로 호출해요! 함수는 코드를 묶어놓은 마법 주문서예요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-2: 인사 함수 순서
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000116',
  'a1000000-0000-0000-0000-000000000006',
  2,
  '인사 함수 순서',
  'def, 함수 호출',
  'quiz',
  'parsons',
  TRUE,
  '{"topic":"함수를 만들고 부르기","learning_goals":["함수 안에 들어갈 줄을 들여쓰기한다","함수를 만든 뒤에 불러야 실행된다는 것을 안다"],"story_context":"함수의 탑 마법사가 인사 마법 주문서를 떨어뜨려서 줄이 섞였어요. 다시 맞춰 볼까요?","fallback_text":"def 줄 아래에서 들여쓰기한 줄들이 함수 안에 들어가요. 함수는 만든 다음, 들여쓰기 없이 이름을 불러야 실행돼요.","quiz":{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, \"안녕!\" 다음에 \"나는 파이뱀이야\"가 나오는 함수를 만들고 불러요","lines":[{"id":"ln-c6kt","code":"hello()"},{"id":"ln-f8qe","code":"print(\"안녕!\")"},{"id":"ln-n5ga","code":"def hello():"},{"id":"ln-r3wy","code":"print(\"나는 파이뱀이야\")"}],"indent":true}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-3: 계산기 함수
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000020',
  'a1000000-0000-0000-0000-000000000006',
  3,
  '계산기 함수',
  '매개변수, return',
  'code',
  NULL,
  FALSE,
  '{"topic":"매개변수와 return으로 값 돌려주기","learning_goals":["함수에 매개변수로 값을 전달할 수 있다","return으로 함수가 결과를 돌려주는 것을 이해한다"],"story_context":"탑의 마법 계산기! 두 숫자를 넣으면 합계를 알려줘요.","exercise_description":"add라는 함수를 만들어 두 숫자를 받아 합계를 return하고, add(7, 8)의 결과를 출력하세요","starter_code":"# 두 숫자를 더하는 함수를 만들어보세요!\ndef add(a, b):\n    # 두 숫자를 더한 결과를 return 하세요!\n    \n\nresult = add(7, 8)\nprint(result)","expected_output_hint":"15 가 출력되어야 해요","checklist":["add 안에서 return a + b 를 써요","add(7, 8)의 결과가 나오는지 봐요"],"example_output":"15","fallback_text":"매개변수는 함수에 전달하는 값이에요! def add(a, b): 에서 a, b가 매개변수이고, return a + b로 합계를 돌려줘요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-4: 돌려주는 함수 고르기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000117',
  'a1000000-0000-0000-0000-000000000006',
  4,
  '돌려주는 함수 고르기',
  '매개변수, return',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"값을 돌려주는 함수","learning_goals":["return 으로 계산한 값을 돌려줄 수 있다","매개변수로 받은 값을 함수 안에서 쓴다"],"story_context":"탑의 마법 계산기를 고치려고 해요. 두 수를 넣으면 더한 값을 돌려줘야 해요.","fallback_text":"함수가 값을 돌려주려면 돌려줄 값을 알려 주는 주문이 필요해요. 그리고 넣어 준 두 수를 받을 자리(매개변수)도 있어야 해요.","quiz":{"kind":"multiple_choice","question":"print(add(2, 3)) 을 돌렸을 때 5가 나오는 함수는 어느 것일까?","options":[{"id":"opt-e3ru","text":"def add(a, b):\n    return \"a + b\""},{"id":"opt-j4xs","text":"def add(a, b):\n    return a + b"},{"id":"opt-o7md","text":"def add(a, b):\n    a + b"},{"id":"opt-y5lf","text":"def add():\n    return a + b"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-5: 기본값이 있는 함수
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000041',
  'a1000000-0000-0000-0000-000000000006',
  5,
  '기본값이 있는 함수',
  '기본 매개변수',
  'code',
  NULL,
  FALSE,
  '{"topic":"기본 매개변수 (default parameter)","learning_goals":["함수의 매개변수에 기본값을 설정할 수 있다","기본값이 있으면 인자를 생략할 수 있음을 이해한다"],"story_context":"함수의 탑에서 인사 마법을 업그레이드! 이름을 안 말해도 기본 인사를 해줘요!","exercise_description":"def greet(name=\"친구\") 함수를 만들고, greet()과 greet(\"파이뱀\")을 각각 호출하세요","starter_code":"# 기본값이 있는 함수를 만들어보세요!\ndef greet(name=\"친구\"):\n    # \"안녕, \" + name + \"!\" 를 출력하세요!\n    \n\n# 이름 없이 한 번, 이름을 넣어서 한 번, 총 두 번 호출해보세요!\n","expected_output_hint":"안녕, 친구! 와 안녕, 파이뱀! 이 각각 출력되어야 해요","checklist":["greet 안에서 \"안녕, \" + name + \"!\"를 보여 줘요","greet( )을 이름 없이 한 번 불러요","greet(\"파이뱀\")으로 한 번 더 불러요"],"example_output":"안녕, 친구!\n안녕, 파이뱀!","fallback_text":"매개변수에 = 으로 기본값을 넣으면, 호출할 때 값을 안 넣어도 기본값이 사용돼요! def greet(name=\"친구\"): 에서 greet()은 \"친구\"가, greet(\"파이뱀\")은 \"파이뱀\"이 name에 들어가요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-6: 기본값 빈칸
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000118',
  'a1000000-0000-0000-0000-000000000006',
  6,
  '기본값 빈칸',
  '기본 매개변수',
  'quiz',
  'fill_blank',
  TRUE,
  '{"topic":"매개변수에 기본값 주기","learning_goals":["매개변수에 기본값을 정하는 기호를 고를 수 있다"],"story_context":"인사 마법을 업그레이드해요. 이름을 말하지 않아도 \"친구\"라고 불러 주게 만들고 싶어요!","fallback_text":"매개변수에 기본값을 정할 때는 상자에 값을 넣을 때와 같은 기호를 써요. 같은지 비교하는 기호와 헷갈리지 마요.","quiz":{"kind":"fill_blank","question":"빈칸을 채워 greet()만 불러도 \"안녕, 친구\"가 나오게 해요","code":"def greet(name{{bk-h9ap}}\"친구\"):\n    print(\"안녕, \" + name)\ngreet()","tokens":[{"id":"tok-b4wn","text":":"},{"id":"tok-k8hs","text":"=="},{"id":"tok-q2vd","text":"="}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-7: 최댓값 찾기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000021',
  'a1000000-0000-0000-0000-000000000006',
  7,
  '최댓값 찾기',
  '내장함수 max(), min()',
  'code',
  NULL,
  FALSE,
  '{"topic":"파이썬 내장함수 max()와 min()","learning_goals":["max()로 가장 큰 값을 찾을 수 있다","min()로 가장 작은 값을 찾을 수 있다","파이썬에 이미 만들어진 함수가 있다는 것을 안다"],"story_context":"탑 꼭대기에서 마법 숫자들 중 가장 큰 숫자를 찾는 시험! 파이썬의 내장함수를 사용해봐요.","exercise_description":"numbers 리스트에서 max()를 사용하여 가장 큰 수를 출력하세요","starter_code":"# 가장 큰 수를 찾아보세요!\nnumbers = [3, 7, 1, 9, 4]\nbiggest = \nprint(biggest)","expected_output_hint":"9 가 출력되어야 해요","checklist":["biggest 에 max(numbers)를 넣어요","가장 큰 수가 나오는지 봐요"],"example_output":"9","fallback_text":"max()는 가장 큰 값을 찾아주는 내장함수예요! max([3, 7, 1, 9, 4])는 9를 돌려줘요. min()은 반대로 가장 작은 값을 찾아줘요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-8: 여러 값 돌려주기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000042',
  'a1000000-0000-0000-0000-000000000006',
  8,
  '여러 값 돌려주기',
  '다중 return (튜플)',
  'code',
  NULL,
  FALSE,
  '{"topic":"함수에서 여러 값 돌려주기 (튜플)","learning_goals":["함수에서 여러 값을 return할 수 있다","return된 여러 값을 각각 변수에 받을 수 있다"],"story_context":"함수의 탑에서 마법 분석기를 만들어요! 숫자 중 가장 작은 것과 가장 큰 것을 동시에 알려줘요!","exercise_description":"def min_max(a, b, c) 함수를 만들어 가장 작은 값과 가장 큰 값을 return하세요. min_max(1, 9, 5)를 호출하여 결과를 출력!","starter_code":"# 최소값과 최대값을 동시에 돌려주는 함수!\ndef min_max(a, b, c):\n    smallest = min(a, b, c)\n    biggest = max(a, b, c)\n    # smallest와 biggest를 동시에 return 하세요! (쉼표로 구분)\n    \n\nsmall, big = min_max(1, 9, 5)\nprint(small)\nprint(big)","expected_output_hint":"1과 9가 각각 한 줄씩 출력되어야 해요","checklist":["return 뒤에 smallest, biggest 를 쉼표로 이어 써요","작은 수와 큰 수가 한 줄씩 나오는지 봐요"],"example_output":"1\n9","fallback_text":"return 뒤에 쉼표로 여러 값을 쓰면 한 번에 돌려줄 수 있어요! small, big = min_max(1, 9, 5) 이렇게 받으면 돼요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-9: 함수 안의 함수 호출
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000043',
  'a1000000-0000-0000-0000-000000000006',
  9,
  '함수 안의 함수 호출',
  '함수 조합',
  'code',
  NULL,
  FALSE,
  '{"topic":"함수 조합 (함수의 결과를 다른 함수에 전달)","learning_goals":["함수의 return 값을 다른 함수의 인자로 전달할 수 있다","함수를 조합하여 복잡한 계산을 할 수 있다"],"story_context":"함수의 탑에서 마법을 합쳐볼까요? 두 배로 만드는 마법과 하나 더하는 마법을 합치면 어떻게 될까요?","exercise_description":"double(x)은 x를 2배로, add_one(x)은 x에 1을 더하는 함수를 만들고, add_one(double(3))을 호출하세요","starter_code":"# 두 함수를 만들고 합쳐보세요!\ndef double(x):\n    return x * 2\n\ndef add_one(x):\n    return x + 1\n\n# double(3)의 결과에 add_one을 적용해서 result에 저장하세요!\nresult = \nprint(result)","expected_output_hint":"7 이 출력되어야 해요 (3*2=6, 6+1=7)","checklist":["double(3)을 add_one( ) 안에 넣어요","그 결과를 result 에 넣고 보여 줘요"],"example_output":"7","fallback_text":"double(3)은 6을 돌려주고, add_one(6)은 7을 돌려줘요! 함수의 결과를 다른 함수에 바로 넣을 수 있어요."}'::jsonb,
  'output_match',
  '',
  50
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-10: 사라진 돌려주기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000119',
  'a1000000-0000-0000-0000-000000000006',
  10,
  '사라진 돌려주기',
  'return, 함수 조합',
  'quiz',
  'bug_hunt',
  TRUE,
  '{"topic":"계산한 값을 돌려주지 않을 때","learning_goals":["함수가 값을 돌려주지 않으면 None 이 된다는 것을 안다"],"story_context":"두 배 마법에 1을 더하는 마법을 합쳤더니 오류가 났어요! 탑의 마법사가 도움을 청해요.","fallback_text":"함수를 부른 자리에 값이 돌아오려면 함수 안에서 값을 돌려줘야 해요. 계산만 하고 끝나면 빈 값(None)이 돌아와요.","quiz":{"kind":"bug_hunt","question":"4를 두 배로 만든 뒤 1을 더해 9가 나와야 하는데 오류가 나요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-s6ob","code":"def double(n):"},{"id":"ln-v2kc","code":"    n * 2"},{"id":"ln-z7he","code":"print(double(4) + 1)"}],"fixes":[{"id":"fx-m6tu","code":"    return n + 2"},{"id":"fx-o3ga","code":"    return n * 2"},{"id":"fx-x8ld","code":"    print(n * 2)"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-11: 성적 분석 프로그램
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000044',
  'a1000000-0000-0000-0000-000000000006',
  11,
  '성적 분석 프로그램',
  '함수 종합',
  'code',
  NULL,
  FALSE,
  '{"topic":"함수 종합 활용 - 성적 분석 프로그램","learning_goals":["여러 함수를 만들어 역할을 분담할 수 있다","함수의 return 값을 다른 함수에서 활용할 수 있다","함수를 조합하여 실용적인 프로그램을 만들 수 있다"],"story_context":"함수의 탑 마지막 시험! 배운 함수 마법을 모두 써서 성적 분석 프로그램을 완성해봐요!","exercise_description":"average 함수(3과목 평균)와 grade 함수(평균으로 등급 판정)를 만들어 성적을 분석하세요. 점수: 80, 90, 85","starter_code":"# 성적 분석 프로그램을 만들어보세요!\ndef average(a, b, c):\n    # 세 과목의 평균을 구해서 return 하세요!\n    \n\ndef grade(avg):\n    # 90 이상 \"A\", 80 이상 \"B\", 70 이상 \"C\", 나머지 \"D\"\n    \n\n# 3과목 점수\navg = average(80, 90, 85)\ng = grade(avg)\n\nprint(\"평균: \" + str(avg))\nprint(\"등급: \" + g)","expected_output_hint":"평균: 85.0 과 등급: B 가 출력되어야 해요","checklist":["average 에서 세 점수를 더해 3으로 나눠 return 해요","grade 에서 if·elif·else 로 등급을 return 해요","평균과 등급이 한 줄씩 나오는지 봐요"],"example_output":"평균: 85.0\n등급: B","fallback_text":"average 함수로 평균을 구하고, grade 함수로 등급을 판정해요! 두 함수를 조합하면 성적 분석 프로그램이 완성돼요.","is_challenge":true}'::jsonb,
  'output_match',
  '',
  75
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-12: 주문 도둑 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000206',
  'a1000000-0000-0000-0000-000000000006',
  12,
  '주문 도둑 버그버그',
  '함수 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"6단계에서 배운 def·매개변수·return·기본값·max()/min()·함수 합치기 총정리","learning_goals":["함수를 만들기만 할 때와 부를 때를 구별한다","매개변수에 무엇이 들어가고 return 이 무엇을 돌려주는지 따라갈 수 있다","함수 안의 return 을 만나면 함수가 바로 끝남을 안다"],"story_context":"함수의 탑 꼭대기, 마법사의 주문서가 사라졌어요! 주문서를 품에 안고 도망치는 건 바로 버그버그. 주문을 바르게 읽어 내면 한 장씩 되찾을 수 있어요.","fallback_text":"def 로 함수를 만들고, 이름 뒤에 괄호를 붙여 불러야 실행돼요. 괄호 안 값은 매개변수 상자에 차례로 들어가요. return 은 값을 돌려주면서 함수를 그 자리에서 끝내요.","boss":{"name":"주문 도둑 버그버그","look":"tower","intro":"마법사의 주문서는 내가 슬쩍 가져왔지! 여섯 문제를 풀면 한 장씩 돌려줄게!","on_defeat":"졌다, 졌어! 함수 주문을 이렇게 잘 쓰다니. 주문서는 마법사님께 돌려드릴게.","on_victory":"주문이 꼬였구나? 함수에 무엇이 들어가고 무엇이 나오는지 따라가 보고 다시 와!","rounds":[{"kind":"multiple_choice","question":"응원 주문을 만들고 불렀어요. 돌리면 무엇이 나올까?","code":"def cheer():\n    print(\"힘내!\")\ncheer()\ncheer()","options":[{"id":"opt-g2we","text":"힘내!"},{"id":"opt-l9ct","text":"힘내!\n힘내!\n힘내!"},{"id":"opt-o4ys","text":"cheer()\ncheer()"},{"id":"opt-u6pk","text":"힘내!\n힘내!"}]},{"kind":"fill_blank","question":"빈칸을 채워 가장 높은 점수와 가장 낮은 점수의 차이가 나오게 해요","code":"scores = [70, 95, 80]\nprint({{bk-m5ta}}(scores) - {{bk-y8eo}}(scores))","tokens":[{"id":"tok-c3vi","text":"max"},{"id":"tok-k2fz","text":"len"},{"id":"tok-w7ub","text":"min"}]},{"kind":"bug_hunt","question":"야호를 두 번 붙여 외치려는데 오류가 나요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-b7ks","code":"def shout(word, times):"},{"id":"ln-q2ln","code":"    print(word * times)"},{"id":"ln-x5dr","code":"shout(\"야호\")"}],"fixes":[{"id":"fx-a4hm","code":"shout(\"야호\", 2)"},{"id":"fx-t8pe","code":"shout(\"야호\" 2)"},{"id":"fx-z3cu","code":"shout(\"야호\", \"2\")"}]},{"kind":"parsons","question":"느낌표를 붙이는 함수와 두 번 외치는 함수를 만들고, 둘을 합쳐 불러요. 줄을 놓고 들여쓰기도 맞춰요","lines":[{"id":"ln-c5kw","code":"def twice(word):"},{"id":"ln-f8xd","code":"return word + \"!\""},{"id":"ln-h9vq","code":"print(twice(bang(\"야호\")))"},{"id":"ln-m2ta","code":"return word * 2"},{"id":"ln-r3nb","code":"def bang(word):"}],"indent":true},{"kind":"multiple_choice","question":"간식 주문에는 기본값이 있어요. 돌리면 무엇이 나올까?","code":"def snack(food=\"쿠키\", count=1):\n    print(food + str(count) + \"개\")\nsnack(\"젤리\", 2)\nsnack()","options":[{"id":"opt-e5mr","text":"젤리2개\n쿠키1개"},{"id":"opt-h3za","text":"젤리2개\n젤리2개"},{"id":"opt-p7lo","text":"젤리2개"},{"id":"opt-s8gd","text":"젤리2개\n쿠키2개"}]},{"kind":"multiple_choice","question":"숫자 크기를 알려 주는 주문이에요. 돌리면 무엇이 나올까?","code":"def size(n):\n    if n > 5:\n        return \"큰 수\"\n    return \"작은 수\"\nprint(size(3) + \", \" + size(8))","options":[{"id":"opt-b6qt","text":"작은 수, 큰 수"},{"id":"opt-n4jx","text":"큰 수, 작은 수"},{"id":"opt-r9mc","text":"작은 수, 작은 수"},{"id":"opt-w2fh","text":"큰 수, 큰 수"}]}],"review_quests":["b1000000-0000-0000-0000-000000000019","b1000000-0000-0000-0000-000000000021","b1000000-0000-0000-0000-000000000020","b1000000-0000-0000-0000-000000000043","b1000000-0000-0000-0000-000000000041","b1000000-0000-0000-0000-000000000044"]}}'::jsonb,
  'all',
  '',
  45
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 7-1: 판정 코드 맞추기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000120',
  'a1000000-0000-0000-0000-000000000007',
  1,
  '판정 코드 맞추기',
  '변수, if/elif/else 복습',
  'quiz',
  'parsons',
  TRUE,
  '{"topic":"숫자 맞추기 게임의 판정","learning_goals":["조건 세 가지를 if/elif/else 로 나눌 수 있다","조건마다 실행할 줄을 들여쓰기한다"],"story_context":"프로젝트 왕국 문지기가 숫자 맞추기 게임의 판정 코드를 섞어 놨어요. 왕국에 들어가기 전에 다시 맞춰 볼까요?","fallback_text":"비교할 값을 먼저 상자에 넣고, if 와 elif 로 큰지 작은지 물어본 뒤, 둘 다 아니면 else 로 가요. 조건마다 실행할 줄은 들여쓰기해요.","quiz":{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 고른 숫자가 비밀 숫자보다 큰지 작은지 알려 줘요","lines":[{"id":"ln-b5ny","code":"elif guess > secret:"},{"id":"ln-e3lq","code":"print(\"더 작은 수예요\")"},{"id":"ln-g8tz","code":"guess = 5"},{"id":"ln-i7vo","code":"print(\"정답!\")"},{"id":"ln-k2dh","code":"if guess < secret:"},{"id":"ln-p6xf","code":"else:"},{"id":"ln-u4mr","code":"secret = 7"},{"id":"ln-w9ac","code":"print(\"더 큰 수예요\")"}],"indent":true}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 7-2: 몇 번 만에 맞혔을까?
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000121',
  'a1000000-0000-0000-0000-000000000007',
  2,
  '몇 번 만에 맞혔을까?',
  'for + 리스트, 누적 변수 복습',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"반복한 횟수 세기","learning_goals":["반복할 때마다 1씩 더해 횟수를 셀 수 있다"],"story_context":"숫자 맞추기 게임에서 친구가 고른 숫자 기록이 남아 있어요. 기록을 세는 코드를 돌리면 무엇이 나올까요?","fallback_text":"for 는 리스트에 든 값마다 한 번씩 반복해요. tries 에는 리스트의 숫자가 아니라 1이 더해진다는 걸 잘 봐요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"tries = 0\nfor guess in [3, 8, 5]:\n    tries = tries + 1\nprint(tries)","options":[{"id":"opt-a9ry","text":"1\n2\n3"},{"id":"opt-f5wi","text":"3"},{"id":"opt-l3ep","text":"16"},{"id":"opt-t8gc","text":"1"}]}}'::jsonb,
  'all',
  '',
  30
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 7-3: 숫자 맞추기 게임
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000022',
  'a1000000-0000-0000-0000-000000000007',
  3,
  '숫자 맞추기 게임',
  '종합 프로젝트',
  'project',
  NULL,
  FALSE,
  '{"topic":"종합 프로젝트: 숫자 맞추기 게임 만들기","learning_goals":["배운 모든 개념(변수, 조건, 반복, 함수)을 조합할 수 있다","프로그램을 단계적으로 설계하고 구현할 수 있다","완성된 프로그램을 만드는 경험을 쌓는다"],"story_context":"프로젝트 왕국의 최종 관문! 배운 모든 것을 모아 숫자 맞추기 게임을 완성하면 코딩 마법사가 돼요!","exercise_description":"1~10 사이의 비밀 숫자를 맞추는 게임을 만드세요. 5단계에 걸쳐 하나씩 기능을 추가하며 완성해요!","starter_code":"# 숫자 맞추기 게임을 만들어보세요!\nimport random\n","expected_output_hint":"프로젝트를 5단계로 나누어 완성해요","fallback_text":"드디어 프로젝트 왕국에 도착했어요! 지금까지 배운 변수, 조건문, 반복문을 모두 활용해서 숫자 맞추기 게임을 만들 거예요. 5단계로 나누어 하나씩 만들어볼까요?","steps":[{"step_number":1,"step_goal":"random 모듈로 1~10 사이의 비밀 숫자를 만들고 출력해보기","checklist":["import random 아래에서 random.randint(1, 10)으로 비밀 숫자를 만들어요","secret 에 넣고 print( )로 보여 줘요"],"example_output":"7","starter_code":"# 1단계: 비밀 숫자 만들기\nimport random\n\n# 비밀 숫자를 만들어보세요! random 모듈을 사용해볼까요?\n","validation_type":"code_check","fallback_text":"1단계에서는 random 모듈을 사용해서 비밀 숫자를 만들어요! random.randint(1, 10)을 사용하면 1부터 10 사이의 숫자를 랜덤으로 만들 수 있어요. 변수에 저장하고 print()로 확인해보세요!"},{"step_number":2,"step_goal":"추측 숫자를 guess 변수에 저장하고 \"추측\"과 함께 출력하기 (Pyodide에서는 random으로 대체)","checklist":["guess 변수에 추측 숫자를 넣어요","print( )로 \"추측\"이라는 말과 함께 보여 줘요"],"example_output":"비밀 숫자: 7\n추측: 3","starter_code":"","validation_type":"all","fallback_text":"2단계에서는 추측 숫자를 만들어요! 실제 게임에서는 input()으로 사용자에게 물어보지만, 여기서는 int(random.randint(1, 10))으로 자동 추측을 만들어볼 거예요. guess 변수에 저장하고, print()로 \"추측\"이라는 말과 함께 보여주세요!"},{"step_number":3,"step_goal":"if/elif/else로 비밀 숫자와 추측을 비교하기","checklist":["if 로 정답인지 먼저 봐요","elif 와 else 로 더 큰지 작은지 알려 줘요","숫자는 매번 바뀌어서 나오는 말도 달라져요"],"example_output":"비밀 숫자가 추측보다 커요!","starter_code":"","validation_type":"all","fallback_text":"3단계에서는 조건문으로 비밀 숫자와 추측을 비교해요! if/elif/else를 사용해서 정답인지, 더 큰 숫자를 말해야 하는지, 더 작은 숫자를 말해야 하는지 알려주세요!"},{"step_number":4,"step_goal":"while 반복문으로 정답을 맞출 때까지 반복하기","checklist":["while guess != secret: 으로 반복을 만들어요","반복 안에서 힌트를 보여 주고 guess 를 새로 정해요","반복이 끝나면 정답! 을 보여 줘요"],"example_output":"비밀 숫자가 추측보다 커요!\n비밀 숫자가 추측보다 작아요!\n정답!","starter_code":"","validation_type":"code_check","fallback_text":"4단계에서는 while 반복문으로 게임을 반복해요! while guess != secret: 으로 정답을 맞출 때까지 계속 추측하도록 만들어보세요!"},{"step_number":5,"step_goal":"시도 횟수를 세고 완성 메시지 출력하기","checklist":["attempts 를 0에서 시작해요","한 번 추측할 때마다 attempts 에 1을 더해요","마지막에 몇 번 만에 맞췄는지 보여 줘요"],"example_output":"비밀 숫자가 추측보다 커요!\n정답! 2번 만에 맞췄어요!","starter_code":"","validation_type":"contains","fallback_text":"마지막 5단계! 시도 횟수를 세는 변수 attempts를 추가하고, 정답을 맞추면 \"정답! N번 만에 맞췄어요!\"를 출력하세요. 이걸로 게임이 완성돼요!"}]}'::jsonb,
  'contains',
  '',
  200
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 7-4: 버그버그 대왕
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b1000000-0000-0000-0000-000000000207',
  'a1000000-0000-0000-0000-000000000007',
  4,
  '버그버그 대왕',
  '1월드 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"파이썬 섬에서 배운 출력·변수·조건·반복·리스트·함수 총정리","learning_goals":["여러 개념이 섞인 코드를 한 줄씩 따라가며 결과를 알아낼 수 있다","숫자 맞추기 게임에서 자주 나는 버그를 찾아 고칠 수 있다","반복·조건·함수를 알맞은 차례와 들여쓰기로 놓을 수 있다"],"story_context":"숫자 맞추기 게임을 완성하자 왕국 성문 위에 커다란 왕관을 쓴 버그버그가 나타났어요! 지금까지 만난 버그버그들의 대장, 버그버그 대왕이래요. 파이썬 섬에서 배운 모든 마법으로 마지막 관문을 넘어 봐요!","fallback_text":"코드는 위에서 아래로 한 줄씩 따라가요. 상자 값이 어떻게 바뀌는지, 조건이 맞는지, 반복이 몇 번 도는지 차례로 적어 보면 길이 보여요. 따옴표로 감싼 숫자는 글자라는 것도 잊지 마요.","boss":{"name":"버그버그 대왕","look":"kingdom","intro":"나는 버그버그 대왕이다! 버그버그들을 다 이긴 용사로구나. 마지막 일곱 문제를 풀어 보아라!","on_defeat":"훌륭하도다! 너야말로 진짜 코딩 마법사로구나. 오늘부터 나도 네 친구가 되겠노라!","on_victory":"허허, 마지막 관문은 쉽지 않지? 지금까지 배운 마법을 하나씩 떠올리고 다시 오너라!","rounds":[{"kind":"multiple_choice","question":"대왕이 레벨 자랑을 해요. 돌리면 무엇이 나올까?","code":"name = \"파이뱀\"\nlevel = 7\nprint(name + \"의 레벨은 \" + str(level))","options":[{"id":"opt-d7ve","text":"파이뱀의 레벨은 7"},{"id":"opt-f2pi","text":"파이뱀의 레벨은 \"7\""},{"id":"opt-k3so","text":"name의 레벨은 level"},{"id":"opt-y9ag","text":"파이뱀의 레벨은 str(level)"}]},{"kind":"fill_blank","question":"빈칸을 채워 비밀 숫자를 맞히면 그 자리에서 게임이 끝나게 해요","code":"secret = 7\nfor guess in [2, 7, 9]:\n    if guess == secret:\n        print(\"정답!\")\n        {{bk-s4qn}}\n    print(guess)","tokens":[{"id":"tok-a5ld","text":"continue"},{"id":"tok-h8cx","text":"break"},{"id":"tok-u2ze","text":"return"}]},{"kind":"bug_hunt","question":"비밀 숫자 7을 골랐는데 땡! 이 나와요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-c8pw","code":"answer = \"7\""},{"id":"ln-j4ri","code":"secret = 7"},{"id":"ln-o6ty","code":"if answer == secret:"},{"id":"ln-g2ub","code":"    print(\"정답!\")"},{"id":"ln-w9mf","code":"else:"},{"id":"ln-e5kh","code":"    print(\"땡!\")"}],"fixes":[{"id":"fx-l7da","code":"if int(answer) == secret:"},{"id":"fx-p8vs","code":"if answer = secret:"},{"id":"fx-x3ng","code":"if str(answer) == secret:"}]},{"kind":"multiple_choice","question":"별 탑을 리스트에 쌓아요. 돌리면 무엇이 나올까?","code":"stars = []\nfor i in range(1, 4):\n    stars.append(\"*\" * i)\nprint(stars)","options":[{"id":"opt-i4wr","text":"*\n**\n***"},{"id":"opt-m8cu","text":"[''*'', ''*'', ''*'']"},{"id":"opt-t5kq","text":"[1, 2, 3]"},{"id":"opt-z6hb","text":"[''*'', ''**'', ''***'']"}]},{"kind":"parsons","question":"가위바위보 기록에서 이긴 횟수를 세어 돌려주는 함수를 만들고 불러요. 줄을 놓고 들여쓰기도 맞춰요","lines":[{"id":"ln-a6tj","code":"return win"},{"id":"ln-b8no","code":"if r == \"승\":"},{"id":"ln-k9gm","code":"print(count_win([\"승\", \"패\", \"승\"]))"},{"id":"ln-l4sx","code":"for r in results:"},{"id":"ln-q7ad","code":"win = 0"},{"id":"ln-v3hk","code":"def count_win(results):"},{"id":"ln-y2fe","code":"win = win + 1"}],"indent":true},{"kind":"bug_hunt","question":"게임 시작! 이 나와야 하는데 아무것도 나오지 않아요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-h5wz","code":"def start():"},{"id":"ln-d2qc","code":"    print(\"게임 시작!\")"},{"id":"ln-s9ev","code":"start"}],"fixes":[{"id":"fx-f7ry","code":"def start()"},{"id":"fx-k6ub","code":"start()"},{"id":"fx-o3ji","code":"print(start)"}]},{"kind":"multiple_choice","question":"대왕의 마지막 문제! 숫자 맞추기 기록을 따라가요. 돌리면 무엇이 나올까?","code":"secret = 5\nfor guess in [8, 3, 5, 1]:\n    if guess > secret:\n        print(\"작게\")\n    elif guess < secret:\n        print(\"크게\")\n    else:\n        print(\"정답!\")\n        break","options":[{"id":"opt-c9ef","text":"작게\n크게\n정답!\n크게"},{"id":"opt-g3sw","text":"정답!"},{"id":"opt-j6dl","text":"크게\n작게\n정답!"},{"id":"opt-p4xm","text":"작게\n크게\n정답!"}]}],"review_quests":["b1000000-0000-0000-0000-000000000022","b1000000-0000-0000-0000-000000000022","b1000000-0000-0000-0000-000000000022","b1000000-0000-0000-0000-000000000121","b1000000-0000-0000-0000-000000000120","b1000000-0000-0000-0000-000000000022","b1000000-0000-0000-0000-000000000120"]}}'::jsonb,
  'all',
  '',
  54
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- ------------------------------------------------------------
-- 5. 정답 (quest_answer_keys, service_role 전용)
-- ------------------------------------------------------------

-- 정답 1-1: 첫 번째 인사
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  '안녕하세요!',
  '{"level_1":"화면에 글자를 보여주는 마법 주문이 있어요. 어떤 주문일까요?","level_2":"print() 안에 따옴표로 감싼 글자를 넣으면 돼요!","level_3":"print(\"___\") 여기서 ___에 인사말을 넣어보세요!"}'::jsonb,
  'print("안녕하세요!")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-2: 내 소개를 해볼까?
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000002',
  E'나는 파이썬 모험가!\n반가워!',
  '{"level_1":"print()를 한 번 쓰면 한 줄이 나와요. 두 줄을 쓰려면?","level_2":"print(\"첫 번째 줄\")을 쓰고, 아래에 print(\"두 번째 줄\")을 써보세요!","level_3":"print(\"___\")\nprint(\"___\") 두 줄에 각각 자기소개와 인사를 넣어보세요!"}'::jsonb,
  E'print("나는 파이썬 모험가!")\nprint("반가워!")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-3: 따옴표의 비밀
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000023',
  'I''m happy!',
  '{"level_1":"글자 안에 작은따옴표가 있으면, 바깥을 큰따옴표로 감싸야 해요!","level_2":"print(\"I''m happy!\") 이렇게 큰따옴표로 감싸보세요!","level_3":"print(\"___\") 큰따옴표 안에 I''m happy!를 넣어보세요!"}'::jsonb,
  'print("I''m happy!")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-4: 따옴표 버그 잡기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000101',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"bug_hunt","accepted":[{"line":"ln-k8ep","fix":"fx-m2va"}],"explanation":"글자 안에 작은따옴표('')가 있으면 바깥을 큰따옴표(\")로 감싸요. 그래야 파이썬이 글자가 어디서 끝나는지 헷갈리지 않아요.","explanations":{"fx-c7jn":"따옴표가 하나도 없으면 파이썬이 글자로 읽지 못해서 오류가 나요.","fx-w5dq":"여는 따옴표만 있고 닫는 따옴표가 없어요. 따옴표는 짝이 맞아야 해요.","ln-r4tw":"이 줄은 따옴표 짝이 잘 맞아요. 다른 줄을 살펴봐요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-5: 주석으로 메모하기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000003',
  '파이썬은 재미있어!',
  '{"level_1":"# 뒤에 쓴 글은 컴퓨터가 무시해요. 진짜 실행되는 코드는 뭘까요?","level_2":"주석 줄 아래에 print()로 문장을 출력해보세요!","level_3":"# ___\nprint(\"___\") 주석에 메모를, print에 문장을 넣어보세요!"}'::jsonb,
  E'# 파이썬 메모\nprint("파이썬은 재미있어!")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-6: 특수문자 출력하기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000024',
  E'첫째 줄\n둘째 줄',
  '{"level_1":"\\n이라는 특별한 글자를 쓰면 그 자리에서 줄이 바뀌어요!","level_2":"print(\"첫째 줄\\n둘째 줄\") 이렇게 \\n을 중간에 넣어보세요!","level_3":"print(\"___\\n___\") \\n 앞뒤에 각각 문장을 넣어보세요!"}'::jsonb,
  'print("첫째 줄\n둘째 줄")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-7: 두 줄 편지 빈칸
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000102',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"fill_blank","accepted":[{"bk-p3zy":"tok-n4ha"}],"explanation":"\\n 은 \"새 줄\"이라는 특수문자예요. print 글자 안에 넣으면 그 자리에서 줄이 바뀌어요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-8: 숫자도 출력해요
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000025',
  '2026',
  '{"level_1":"글자는 따옴표가 필요하지만, 숫자는 따옴표 없이 바로 쓸 수 있어요!","level_2":"print(2026) 이렇게 따옴표 없이 숫자만 넣어보세요!","level_3":"print(___) 괄호 안에 올해 연도 숫자를 넣어보세요!"}'::jsonb,
  'print(2026)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-9: 무엇이 나올까?
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000103',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-h3ku"],"explanation":"첫 줄은 #으로 시작하는 주석이라 실행되지 않아요. 글자 안녕과 숫자 2026이 한 줄씩 나와요.","explanations":{"opt-b7xe":"따옴표는 \"여기부터 여기까지 글자\"라는 표시예요. 화면에는 나오지 않아요.","opt-q2mi":"#으로 시작하는 줄은 메모(주석)라서 컴퓨터가 실행하지 않아요.","opt-z5ca":"숫자도 print()로 보여 줄 수 있어요. 마지막 줄도 실행돼요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-10: 마을 안내판 만들기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000026',
  E'=== 파이썬 마을 ===\n인구: 2026명\n환영합니다!',
  '{"level_1":"print()를 3번 써서 3줄을 출력해야 해요. 각각 어떤 내용을 넣을까요?","level_2":"print(\"=== 파이썬 마을 ===\")부터 시작해보세요!","level_3":"# 안내판\nprint(\"=== 파이썬 마을 ===\")\nprint(\"인구: ___명\")\nprint(\"___\")"}'::jsonb,
  E'# 마을 안내판\nprint("=== 파이썬 마을 ===")\nprint("인구: 2026명")\nprint("환영합니다!")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-11: 출력 대장 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000201',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-r4wk"],"explanation":"글자 안의 역슬래시 n 은 화면에 나오지 않고 그 자리에서 줄을 바꿔요. 그래서 땡! 이 두 줄, 그다음 숫자 12가 나와요.","explanations":{"opt-c8nz":"역슬래시 n 은 글자로 나오지 않아요. 줄을 바꾸라는 표시예요.","opt-e6tq":"컴퓨터는 위에서 아래로, 쓴 차례대로 실행해요.","opt-y2hd":"역슬래시 n 자리에서 줄이 바뀌어요. 땡! 두 개가 한 줄에 붙지 않아요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-p7ws","fix":"fx-r3hm"}],"explanation":"큰따옴표로 연 글자는 큰따옴표로 닫아야 해요. 작은따옴표로 닫으면 짝이 맞지 않아 오류가 나요.","explanations":{"fx-j8tc":"따옴표가 없으면 파이썬이 글자로 읽지 못해서 오류가 나요.","fx-n5qe":"print 다음에는 괄호가 꼭 있어야 해요. 괄호로 글자를 감싸요.","ln-a4kd":"#으로 시작하는 줄은 메모(주석)라서 오류가 나지 않아요. 다른 줄을 살펴봐요.","ln-g3vb":"이 줄은 따옴표와 괄호 짝이 잘 맞아요. 다른 줄을 살펴봐요."}},{"kind":"fill_blank","accepted":[{"bk-w2nx":"tok-q4ma"}],"explanation":"줄 맨 앞에 샵(#)을 붙이면 그 줄은 주석이 돼요. 컴퓨터는 주석을 건너뛰어서 파이뱀 최고! 만 나와요.","explanations":{"tok-h6rb":"빗금 두 개(//)는 파이썬의 주석 표시가 아니라서 오류가 나요.","tok-z3kv":"따옴표 하나만 열면 짝이 안 맞아서 오류가 나요."}},{"kind":"parsons","accepted":[["ln-m7cq","ln-k2wd","ln-u4hs","ln-b9fe"]],"explanation":"컴퓨터는 위에 쓴 줄부터 차례로 실행해요. 역슬래시 n 이 든 줄은 print() 한 번으로 두 줄을 보여 줘요."}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-1: 마법 상자에 이름 넣기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000004',
  '파이뱀',
  '{"level_1":"변수는 상자에 이름표를 붙이는 거예요. name이라는 상자에 뭘 넣을까요?","level_2":"= 기호 오른쪽에 따옴표로 감싼 텍스트를 넣으면 돼요!","level_3":"name = \"___\" 따옴표 안에 이름을 넣어보세요!"}'::jsonb,
  E'name = "파이뱀"\nprint(name)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-2: 숫자 상자와 글자 상자
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000005',
  E'10\n안녕',
  '{"level_1":"숫자는 그냥 쓰고, 글자는 따옴표로 감싸야 해요!","level_2":"number = 10 이렇게 숫자는 따옴표 없이, greeting = \"안녕\" 이렇게 글자는 따옴표와 함께!","level_3":"number = ___\ngreeting = \"___\" 숫자와 글자를 각각 넣어보세요!"}'::jsonb,
  E'number = 10\ngreeting = "안녕"\nprint(number)\nprint(greeting)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-3: 상자 이름 바꾸기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000027',
  '파랑',
  '{"level_1":"변수에 새 값을 넣으면 이전 값은 사라져요. = 기호로 새 값을 넣어보세요!","level_2":"color = \"파랑\" 이렇게 다시 값을 넣으면 돼요!","level_3":"color = \"___\" 새로운 색깔을 넣어보세요!"}'::jsonb,
  E'color = "빨강"\ncolor = "파랑"\nprint(color)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-4: 상자 속에 남은 것
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000104',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-t6dw"],"explanation":"변수에 새 값을 넣으면 예전 값은 지워지고 새 값만 남아요. 그래서 마지막에 넣은 색이 나와요.","explanations":{"opt-a4mf":"print(color)는 상자 이름이 아니라 상자 안의 값을 보여 줘요.","opt-e2rk":"상자에 두 번째로 넣은 값이 있어요. 새 값을 넣으면 먼저 있던 값은 어떻게 될까요?","opt-y8sn":"상자에는 값이 하나만 들어가요. 두 값이 이어 붙지 않아요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-5: 나이 계산기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000006',
  '살',
  '{"level_1":"birth_year에 태어난 해를 숫자로 넣어보세요!","level_2":"birth_year = 2014 처럼 따옴표 없이 숫자만 넣으면 돼요!","level_3":"birth_year = ___ 자기 태어난 해를 숫자로 넣어보세요!"}'::jsonb,
  E'birth_year = 2014\nage = 2026 - birth_year\nprint(str(age) + "살")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-6: 글자 합치기 마법
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000028',
  '파이썬',
  '{"level_1":"문자열을 합치려면 + 기호를 사용해요! 숫자 더하기와 비슷하죠?","level_2":"result = first + second 이렇게 두 변수를 + 로 합쳐보세요!","level_3":"result = ___ + ___ 두 변수 이름을 넣어보세요!"}'::jsonb,
  E'first = "파이"\nsecond = "썬"\nresult = first + second\nprint(result)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-7: 글자 합치기 순서
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000105',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"parsons","accepted":[["ln-v3qo","ln-p7ga","ln-c9hl","ln-j5ux"],["ln-p7ga","ln-v3qo","ln-c9hl","ln-j5ux"]],"explanation":"상자(변수)에 값을 먼저 넣고, 그 상자들을 + 로 이어 붙인 다음, 마지막에 print로 보여 줘요. name과 place는 어느 쪽을 먼저 만들어도 괜찮아요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-8: 변신 마법! 형변환
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000007',
  '123',
  '{"level_1":"따옴표가 있으면 글자, 없으면 숫자예요. 글자를 숫자로 바꾸려면?","level_2":"int() 안에 문자열을 넣으면 숫자로 변신해요! int(a) + int(b)를 해보세요!","level_3":"result = ___(a) + ___(b) 글자를 숫자로 바꾸는 함수를 넣어보세요!"}'::jsonb,
  E'a = "100"\nb = "23"\nresult = int(a) + int(b)\nprint(result)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-9: 변신 마법 버그 잡기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000106',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"bug_hunt","accepted":[{"line":"ln-u8fk","fix":"fx-h2wc"}],"explanation":"str()은 숫자를 글자로 바꾸는 변신 마법이에요. 글자끼리는 + 로 이어 붙일 수 있어서 \"나는 10살이에요\"가 나와요.","explanations":{"fx-n6ze":"int()는 숫자로 바꾸는 마법이라, 여전히 글자와 숫자를 더하게 돼요.","fx-q9rt":"모두 따옴표 안에 넣으면 age가 상자가 아니라 그냥 글자 \"age\"로 나와요.","ln-d4yb":"이 줄은 숫자 10을 상자에 잘 넣었어요. 다른 줄을 살펴봐요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-10: 자기소개 카드 만들기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000029',
  E'이름: 파이뱀\n나이: 10살\n학교: 코딩초등학교',
  '{"level_1":"print()를 3번 써서 이름, 나이, 학교를 각각 출력해야 해요!","level_2":"print(\"이름: \" + name) 이렇게 문자열과 변수를 + 로 합쳐보세요!","level_3":"print(\"이름: \" + ___)\nprint(\"나이: \" + ___ + \"살\")\nprint(\"학교: \" + ___)"}'::jsonb,
  E'name = "파이뱀"\nage = "10"\nschool = "코딩초등학교"\nprint("이름: " + name)\nprint("나이: " + age + "살")\nprint("학교: " + school)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-11: 상자 바꿔치기 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000202',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-k5te"],"explanation":"따옴표로 감싼 \"3\"과 \"4\"는 숫자가 아니라 글자예요. 글자끼리 + 하면 더하지 않고 이어 붙여요.","explanations":{"opt-d8ql":"a 와 b 는 상자 이름이에요. print()는 상자 이름이 아니라 상자 속 값을 보여 줘요.","opt-w2pa":"더해서 7이 되려면 숫자여야 해요. 따옴표가 있으면 글자라서 이어 붙어요.","opt-x3nu":"+ 는 화면에 나오지 않아요. 계산하거나 이어 붙이는 기호예요."}},{"kind":"fill_blank","accepted":[{"bk-f7ra":"tok-m3si"}],"explanation":"int()는 글자 \"5\"를 숫자 5로 바꿔 줘요. 숫자가 되어야 2를 더해 7이 나와요.","explanations":{"tok-b8oh":"str()은 글자로 바꾸는 마법이에요. 글자에 숫자 2를 더하면 오류가 나요.","tok-v4ye":"print()는 화면에 보여 주기만 하고 상자에 숫자를 넣어 주지 않아요. 그래서 2를 더할 수 없어요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-t9ek","fix":"fx-p2dy"}],"explanation":"상자 이름에 따옴표를 붙이면 상자 속이 아니라 name 이라는 글자 그대로가 돼요. 따옴표를 빼야 상자 속 파이뱀이 나와요.","explanations":{"fx-e6lw":"작은따옴표도 따옴표예요. 여전히 name 이라는 글자가 나와요.","fx-y5ar":"글자와 상자를 이어 붙이려면 사이에 + 가 있어야 해요. 없으면 오류가 나요.","ln-h4cz":"이 줄은 name 상자에 파이뱀을 잘 넣었어요. 다른 줄을 살펴봐요."}},{"kind":"parsons","accepted":[["ln-s8gu","ln-c2mf","ln-z6oj","ln-a5wb"]],"explanation":"상자를 먼저 만들고(3), 두 배로 바꾸고(6), 1을 더한 뒤(7) 보여 줘요. 차례를 바꾸면 3에 1을 먼저 더해 8이 돼요."}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-1: 비밀번호를 맞춰라!
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000008',
  '통과!',
  '{"level_1":"if 뒤에 조건을 쓰고, 조건이 맞으면 아래 코드가 실행돼요!","level_2":"print() 안에 \"통과!\"를 넣어보세요!","level_3":"print(\"___\") 문이 열릴 때 나올 메시지를 넣어보세요!"}'::jsonb,
  E'password = "열려라"\n\nif password == "열려라":\n    print("통과!")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-2: 비밀 문 버그 잡기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000107',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"bug_hunt","accepted":[{"line":"ln-x7pe","fix":"fx-a6rq"}],"explanation":"if 에서 두 값이 같은지 물어볼 때는 == 를 써요. = 하나는 상자에 값을 넣는 기호예요.","explanations":{"fx-l4cn":"따옴표가 없으면 숫자 1234예요. 상자에 든 글자 \"1234\"와는 달라서 문이 열리지 않아요.","fx-z9um":"쌍점(:)이 빠졌고, = 하나는 상자에 값을 넣는 기호라 if 에서 쓸 수 없어요.","ln-b3sk":"이 줄은 들여쓰기도 따옴표도 잘 맞아요.","ln-f2ty":"이 줄은 들여쓰기도 따옴표도 잘 맞아요.","ln-g5ma":"이 줄은 상자에 비밀번호를 넣는 줄이라 = 하나가 맞아요.","ln-w8vh":"else 줄은 잘 썼어요. 쌍점(:)도 있어요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-3: 짝수인지 홀수인지?
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000030',
  '홀수',
  '{"level_1":"% 2로 2로 나눈 나머지를 구해요. 나머지가 0이면 짝수, 아니면 홀수예요!","level_2":"7 % 2 = 1 이니까 짝수가 아니에요. else에서 뭘 출력해야 할까요?","level_3":"print(\"___\") 짝수가 아닐 때 출력할 단어를 넣어보세요!"}'::jsonb,
  E'number = 7\n\nif number % 2 == 0:\n    print("짝수")\nelse:\n    print("홀수")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-4: 숫자 요정의 대답
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000108',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-k3vy"],"explanation":"7 % 2 는 1이에요(7을 2로 나누면 1이 남아요). 1은 0과 같지 않으니 else 쪽 줄이 실행돼요.","explanations":{"opt-c2jw":"if 와 else 는 둘 중 한 쪽만 실행돼요.","opt-m5xo":"n % 2 는 if 안에서 비교에만 쓰여요. print 하는 건 따옴표 안의 글자예요.","opt-r8bd":"7을 2로 나누면 나머지가 있어요. 나머지가 0일 때만 이 줄이 실행돼요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-5: 성적표 만들기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000009',
  '등급',
  '{"level_1":"score가 85이면 90 이상인가요? 아니라면 80 이상인가요?","level_2":"85는 90보다 작지만 80보다 크니까 elif 조건에 해당해요!","level_3":"print(\"등급: ___\") 85점의 등급 알파벳을 넣어보세요!"}'::jsonb,
  E'score = 85\n\nif score >= 90:\n    print("등급: A")\nelif score >= 80:\n    print("등급: B")\nelse:\n    print("등급: C")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-6: 놀이공원 입장
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000010',
  '입장 가능!',
  '{"level_1":">= 기호는 \"크거나 같다\"는 뜻이에요. 130은 120보다 크거나 같나요?","level_2":"조건이 맞으니까 print() 안에 출력할 메시지를 넣으면 돼요!","level_3":"print(\"___\") 키가 충분할 때 나올 메시지를 넣어보세요!"}'::jsonb,
  E'height = 130\n\nif height >= 120:\n    print("입장 가능!")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-7: 마법사의 조건
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000011',
  '마법사 합격!',
  '{"level_1":"and는 두 조건을 모두 만족해야 해요. 80은 60 이상이고, 70도 60 이상인가요?","level_2":"두 조건 모두 맞으니까 print() 안에 합격 메시지를 넣으면 돼요!","level_3":"print(\"___\") 두 시험을 모두 통과하면 나올 메시지를 넣어보세요!"}'::jsonb,
  E'magic = 80\ncourage = 70\n\nif magic >= 60 and courage >= 60:\n    print("마법사 합격!")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-8: 마법사 시험 빈칸
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000109',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"fill_blank","accepted":[{"bk-t5wq":"tok-e7lu"}],"explanation":"and 는 양쪽 조건이 모두 참일 때만 참이에요. 용기 점수가 70이라 이 코드는 \"다시 도전!\"을 보여 줘요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-9: 가위바위보 심판
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000031',
  '이겼다!',
  '{"level_1":"가위는 보를 이겨요! player가 가위이고 computer가 보이면 어떤 결과일까요?","level_2":"if 조건이 맞으니까 print() 안에 결과 메시지를 넣으면 돼요!","level_3":"print(\"___\") 이겼을 때 나올 메시지를 넣어보세요!"}'::jsonb,
  E'player = "가위"\ncomputer = "보"\n\nif player == computer:\n    print("비겼다!")\nelif player == "가위":\n    if computer == "보":\n        print("이겼다!")\n    else:\n        print("졌다!")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-10: 영화관 할인 시스템
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000032',
  E'나이: 10살\n할인율: 50%\n가격: 5000원',
  '{"level_1":"먼저 나이를 확인하고, 그 다음 주말인지 평일인지 확인해야 해요!","level_2":"if age < 13: 안에서 is_weekend를 확인해보세요! 평일이면 50% 할인!","level_3":"if age < 13: 안에 if is_weekend == False: 를 넣고, discount = 50 으로 설정해보세요! else일 때는 30이에요."}'::jsonb,
  E'age = 10\nis_weekend = False\nprice = 10000\n\nif age < 13:\n    if is_weekend == False:\n        discount = 50\n    else:\n        discount = 30\nelse:\n    discount = 0\n\nfinal_price = price * (100 - discount) // 100\n\nprint("나이: " + str(age) + "살")\nprint("할인율: " + str(discount) + "%")\nprint("가격: " + str(final_price) + "원")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-11: 갈림길 장난꾼 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000203',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-g7kx"],"explanation":"85는 60 이상이라 첫 조건이 맞아요. if 가 맞으면 아래 elif 와 else 는 보지 않고 넘어가요.","explanations":{"opt-j2wi":"else 는 위의 조건이 모두 틀릴 때만 실행돼요. 85는 60 이상이에요.","opt-q9fe":"if·elif·else 묶음에서는 맞는 것 딱 하나만 실행돼요.","opt-u3bn":"85는 80 이상도 맞지만, 위에 있는 if 가 먼저 맞아서 elif 까지 가지 않아요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-v8ap","fix":"fx-k4mw"}],"explanation":"\"크거나 같다\"는 > 를 먼저, = 를 뒤에 써서 >= 예요. 말하는 차례 그대로 \"크다, 같다\"로 외워요.","explanations":{"fx-c9hy":"= 는 늘 뒤에 와요. =< 처럼 쓰면 오류가 나요.","fx-o2xg":"<= 는 \"작거나 같다\"예요. 130은 120보다 크니까 아무것도 나오지 않아요.","ln-f5ts":"이 줄은 들여쓰기와 따옴표가 잘 맞아요. 다른 줄을 살펴봐요.","ln-n3rd":"이 줄은 height 상자에 130을 잘 넣었어요. 다른 줄을 살펴봐요."}},{"kind":"fill_blank","accepted":[{"bk-r6pd":"tok-w5ic"}],"explanation":"or 는 둘 가운데 하나만 맞아도 참이에요. 오늘은 토요일이라 첫 조건이 맞아서 놀이공원 가는 날이 나와요.","explanations":{"tok-e2lj":"and 는 둘 다 맞아야 해요. 하루가 토요일이면서 일요일일 수는 없어서 학교 가는 날이 나와요.","tok-n7vu":"not 은 조건 하나를 뒤집는 말이라 두 조건 사이에 쓸 수 없어요. 오류가 나요."}},{"kind":"parsons","accepted":[[{"id":"ln-x4bh","indent":0},{"id":"ln-d9qo","indent":0},{"id":"ln-b2ez","indent":1},{"id":"ln-m6uk","indent":0},{"id":"ln-a8rn","indent":1},{"id":"ln-y3js","indent":0},{"id":"ln-c7wf","indent":1}]],"explanation":"더 까다로운 조건(3과 5 모두)을 맨 위에 둬야 해요. 3으로만 따지는 elif 가 위에 있으면 15도 박수 한 번에서 멈춰요."},{"kind":"multiple_choice","accepted":["opt-h5vc"],"explanation":"and 조건은 마법 점수가 80보다 낮아서 틀려요. or 조건은 용기 점수 90이 80 이상이라 하나만 맞아도 참이 되어 견습 마법사가 나와요.","explanations":{"opt-f4dq":"맞는 조건 하나를 실행하면 else 는 건너뛰어요.","opt-l8tz":"or 는 하나만 맞아도 돼요. 용기 점수 90이 80 이상이에요.","opt-s2ma":"and 는 둘 다 맞아야 해요. 마법 점수 70은 80보다 낮아요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-1: 숫자 세기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000012',
  E'1\n2\n3\n4\n5',
  '{"level_1":"for는 같은 일을 여러 번 반복해주는 마법이에요! range()에 시작과 끝 숫자를 넣어보세요.","level_2":"range(1, 6)은 1, 2, 3, 4, 5를 만들어줘요. 6은 포함되지 않아요!","level_3":"for i in range(___, ___): 1부터 5까지 나오려면 시작과 끝에 뭘 넣을까요?"}'::jsonb,
  E'for i in range(1, 6):\n    print(i)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-2: 동굴 문 숫자 세기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000110',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-w4ze"],"explanation":"range(1, 4)는 1부터 시작해서 4 바로 앞인 3까지 숫자를 만들어요. 끝 숫자 4는 들어가지 않아요.","explanations":{"opt-f9ob":"range의 끝 숫자는 들어가지 않아요. 끝 숫자 바로 앞에서 멈춰요.","opt-n2hr":"시작 숫자를 1로 정해 줬어요. 0부터 세는 건 시작 숫자가 없을 때예요.","opt-s7ak":"시작 숫자를 1로 정해 줬으니 0부터 세지 않아요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-3: 구구단 외우기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000013',
  '= 6',
  '{"level_1":"구구단은 같은 숫자에 1, 2, 3, ... 9를 곱하는 거예요! print() 안에 무엇을 넣어야 할까요?","level_2":"print() 안에 2, \"x\", i, \"=\", 2 * i 이렇게 넣어보세요!","level_3":"print(___, \"x\", i, \"=\", ___) 곱하는 숫자와 결과 계산식을 넣어보세요!"}'::jsonb,
  E'for i in range(1, 10):\n    print(2, "x", i, "=", 2*i)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-4: 별 찍기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000033',
  '*****',
  '{"level_1":"문자열에 * 를 쓰면 반복할 수 있어요! \"하\" * 3 = \"하하하\"","level_2":"\"*\" * 5 이렇게 쓰면 별이 5번 반복돼요!","level_3":"print(\"*\" * ___) 빈칸에 숫자 5를 넣어보세요!"}'::jsonb,
  'print("*" * 5)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-5: 합계 구하기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000034',
  '55',
  '{"level_1":"total이라는 상자에 숫자를 하나씩 더해가면 돼요!","level_2":"total = 0으로 시작하고, total = total + i로 반복할 때마다 더해보세요!","level_3":"for 안의 빈 줄에 total = total + i 를 넣어보세요!"}'::jsonb,
  E'total = 0\n\nfor i in range(1, 11):\n    total = total + i\n\nprint(total)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-6: 금화 합계 순서
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000111',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"parsons","accepted":[[{"id":"ln-y2bq","indent":0},{"id":"ln-h6ns","indent":0},{"id":"ln-a8ve","indent":1},{"id":"ln-m3dp","indent":0}]],"explanation":"합계를 0으로 준비하고, 반복 안에서 i를 하나씩 더한 뒤, 반복이 끝나면 들여쓰기 없이 한 번만 보여 줘요. 15가 나와요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-7: 보물 찾기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000014',
  '보물 발견!',
  '{"level_1":"while은 조건이 참인 동안 계속 반복해요. position이 5가 되면 뭘 해야 할까요?","level_2":"print()로 메시지를 출력하고, break로 반복을 멈추면 돼요!","level_3":"print(\"___\")\n        ___ 메시지를 출력하고 반복을 멈추는 명령어를 써보세요!"}'::jsonb,
  E'position = 1\n\nwhile position <= 10:\n    if position == 5:\n        print("보물 발견!")\n        break\n    position = position + 1',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-8: 짝수만 골라내기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000015',
  E'2\n4\n6\n8\n10',
  '{"level_1":"짝수는 2로 나누어 떨어지는 숫자예요. 홀수는 건너뛰려면 어떤 명령어를 써야 할까요?","level_2":"continue를 쓰면 아래 코드를 건너뛰고 다음 반복으로 가요!","level_3":"___ 홀수를 건너뛰는 명령어 한 단어를 써보세요!"}'::jsonb,
  E'for i in range(1, 11):\n    if i % 2 != 0:\n        continue\n    print(i)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-9: 카운트다운
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000035',
  E'5\n4\n3\n2\n1',
  '{"level_1":"while count >= 1: 은 count가 1 이상인 동안 반복해요. count를 줄여가야 해요!","level_2":"count = count - 1 으로 반복할 때마다 1씩 줄이면 돼요!","level_3":"count = count - ___ 의 ___ 에 1을 넣어보세요! 그러면 5, 4, 3, 2, 1 하고 멈춰요."}'::jsonb,
  E'count = 5\n\nwhile count >= 1:\n    print(count)\n    count = count - 1',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-10: 끝나지 않는 카운트다운
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000112',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"bug_hunt","accepted":[{"line":"ln-o6fu","fix":"fx-u7ky"}],"explanation":"n = n - 1 이 들여쓰기 안으로 들어가야 반복할 때마다 n이 1씩 줄어요. n이 0이 되면 반복이 끝나고 3, 2, 1, 탈출! 이 나와요.","explanations":{"fx-d3hv":"n이 점점 커지면 n > 0 이 언제나 참이라 반복이 끝나지 않아요.","fx-r6pq":"들여쓰기가 없으면 반복 밖에 있는 줄이에요. 반복 안에서는 n이 그대로예요.","ln-e5gc":"이 줄은 3부터 시작하게 잘 준비했어요.","ln-j3wa":"이 줄은 반복이 끝난 뒤에 한 번 나오는 줄이라 괜찮아요.","ln-p9ri":"이 줄은 \"n이 0보다 클 동안\"이라는 뜻으로 잘 썼어요.","ln-t2xm":"이 줄은 반복 안에서 n을 보여 주는 줄이라 괜찮아요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-11: 별 피라미드 만들기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000036',
  E'*\n**\n***\n****\n*****',
  '{"level_1":"\"*\" * i 에서 i가 1, 2, 3, 4, 5로 바뀌면 별이 몇 개씩 나올까요?","level_2":"for i in range(1, 6): 으로 i를 1부터 5까지 바꾸면서 print(\"*\" * i)를 써보세요!","level_3":"print() 안에 \"*\" * i 를 넣어보세요! i가 1이면 *, 2이면 ** 가 나와요!"}'::jsonb,
  E'for i in range(1, 6):\n    print("*" * i)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-12: 메아리 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000204',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-n6dw"],"explanation":"range(3)은 0, 1, 2 예요. \"아\"를 0번, 1번, 2번 곱하니까 메, 메아, 메아아 가 한 줄씩 나와요.","explanations":{"opt-b3ky":"range(3)은 1이 아니라 0부터 시작해요. 처음엔 \"아\"가 0번 붙어요.","opt-t8oe":"i 는 반복할 때마다 0, 1, 2 로 바뀌어요. 붙는 \"아\"의 개수도 달라져요.","opt-z4cr":"print()가 반복 안에 있어서 반복할 때마다 한 줄씩 나와요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-r7hq","fix":"fx-w3gn"}],"explanation":"range()의 끝 숫자는 들어가지 않아요. 5까지 세려면 끝을 하나 더 큰 6으로 써요.","explanations":{"fx-h6lc":"끝은 맞췄지만 2부터 시작해서 1이 빠져요.","fx-u9ab":"0부터 시작하면 0, 1, 2, 3, 4 가 나와요. 여전히 5가 없어요.","ln-e2vs":"이 줄은 들여쓰기가 맞고 i 를 잘 보여 줘요. 반복 범위를 정하는 줄을 살펴봐요."}},{"kind":"fill_blank","accepted":[{"bk-j5yt":"tok-p8ux"}],"explanation":"continue 는 이번 차례만 건너뛰고 다음 숫자로 넘어가요. 4일 때 print 를 건너뛰어서 4만 빠져요.","explanations":{"tok-c4ga":"break 는 반복을 아예 끝내요. 1, 2, 3 까지만 나와요.","tok-o3fm":"파이썬에는 stop 이라는 명령이 없어서 오류가 나요."}},{"kind":"parsons","accepted":[[{"id":"ln-v5ok","indent":0},{"id":"ln-i2pw","indent":0},{"id":"ln-q8ze","indent":0},{"id":"ln-g4ma","indent":1},{"id":"ln-k7rb","indent":1},{"id":"ln-d3yf","indent":0}],[{"id":"ln-i2pw","indent":0},{"id":"ln-v5ok","indent":0},{"id":"ln-q8ze","indent":0},{"id":"ln-g4ma","indent":1},{"id":"ln-k7rb","indent":1},{"id":"ln-d3yf","indent":0}]],"explanation":"두 상자를 먼저 만들고, 반복 안에서 n 을 더한 다음 1 줄여요. 합계는 반복이 끝난 뒤 한 번만 보여 줘야 해서 print 는 들여쓰지 않아요."},{"kind":"multiple_choice","accepted":["opt-m4xu"],"explanation":"짝수는 continue 로 건너뛰고, 홀수 1, 3, 5 를 보여 줘요. 7이 되면 5보다 커서 break 로 반복이 끝나요.","explanations":{"opt-a9kf":"7은 5보다 커서 break 를 만나요. break 뒤로는 반복하지 않아요.","opt-w7se":"continue 는 짝수일 때 print 를 건너뛰게 해요. 짝수는 나오지 않아요.","opt-y5bl":"7일 때는 print 보다 break 를 먼저 만나서 7은 나오지 않아요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-1: 과일 바구니
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000016',
  '사과',
  '{"level_1":"리스트는 대괄호 [] 안에 값을 넣어 만들어요!","level_2":"각 과일을 따옴표로 감싸고 쉼표로 구분해요! [\"사과\", \"바나나\", ...]","level_3":"fruits = [\"___\", \"___\", \"___\"] 좋아하는 과일 3개를 넣어보세요!"}'::jsonb,
  E'fruits = ["사과", "바나나", "포도"]\nprint(fruits)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-2: 보물 목록 정리
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000017',
  '다이아몬드',
  '{"level_1":"리스트의 번호(인덱스)는 0부터 시작해요. 다이아몬드는 몇 번째일까요?","level_2":"금화=0, 은화=1, 다이아몬드=2! 대괄호 안에 번호를 넣어보세요.","level_3":"print(treasures[___]) 다이아몬드의 인덱스 번호를 넣어보세요!"}'::jsonb,
  E'treasures = ["금화", "은화", "다이아몬드", "루비"]\nprint(treasures[2])',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-3: 없는 과일 꺼내기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000113',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"bug_hunt","accepted":[{"line":"ln-x3nd","fix":"fx-k5oy"}],"explanation":"리스트 번호는 0부터라서 과일 3개의 번호는 0, 1, 2예요. 마지막 과일 포도는 2번이에요.","explanations":{"fx-g2mt":"과일은 3개뿐이라 이 번호에는 과일이 없어요.","fx-i9wl":"리스트에서 꺼낼 때는 둥근 괄호가 아니라 대괄호 [ ] 를 써요.","ln-b8ju":"번호 0은 첫 번째 과일이라 맞아요.","ln-q4zs":"이 줄은 과일 3개를 리스트에 잘 담았어요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-4: 리스트 순회하기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000037',
  E'빨강\n초록\n파랑',
  '{"level_1":"for 다음에 변수 이름을 쓰고, in 다음에 리스트를 쓰면 하나씩 꺼내줘요!","level_2":"for color in colors: 이렇게 쓰면 color에 빨강, 초록, 파랑이 차례로 들어와요!","level_3":"for 안 빈 줄에 print(color) 를 넣어보세요!"}'::jsonb,
  E'colors = ["빨강", "초록", "파랑"]\n\nfor color in colors:\n    print(color)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-5: 친구 목록 관리
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000018',
  '4',
  '{"level_1":"append()로 리스트에 새 친구를 추가할 수 있어요! friends.append()를 써보세요.","level_2":"friends.append(\"파이뱀\")으로 추가하고, len(friends)로 몇 명인지 세어보세요!","level_3":"friends.append(\"___\")\nprint(___(friends)) 추가할 이름과 길이를 구하는 함수를 넣어보세요!"}'::jsonb,
  E'friends = ["토끼", "거북이", "다람쥐"]\nfriends.append("파이뱀")\nprint(len(friends))',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-6: 새 친구 빈칸
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000114',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"fill_blank","accepted":[{"bk-w6fe":"tok-a3gn","bk-c4ro":"tok-l7vb"}],"explanation":"append()는 리스트 끝에 값을 하나 더하고, len()은 리스트에 든 개수를 세요. 친구가 3이 나와요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-7: 리스트 정렬하기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000038',
  '[1, 1, 3, 4, 5]',
  '{"level_1":"리스트를 정리하는 마법 주문이 있어요! 리스트이름.sort()를 써보세요.","level_2":"numbers.sort() 이렇게 쓰면 작은 수부터 큰 수 순서로 정렬돼요!","level_3":"numbers.___() print 전에 정렬하는 함수를 호출해보세요!"}'::jsonb,
  E'numbers = [3, 1, 4, 1, 5]\nnumbers.sort()\nprint(numbers)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-8: 정렬한 물고기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000115',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-p6jt"],"explanation":"sort()는 리스트를 작은 수부터 큰 수로 정리해요. 리스트를 print 하면 대괄호와 쉼표도 함께 나와요.","explanations":{"opt-h8mz":"sort()는 기본으로 작은 수부터 늘어놓아요.","opt-u3cy":"둘째 줄의 sort()가 리스트 순서를 바꿔 놓았어요.","opt-v2bk":"리스트를 통째로 print 하면 대괄호와 쉼표까지 그대로 나와요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-9: 리스트 속 검색
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000039',
  'True',
  '{"level_1":"in은 \"안에 있는지\" 확인하는 마법이에요! 결과는 True 또는 False예요.","level_2":"\"바나나\" in fruits 이렇게 쓰면 바나나가 리스트에 있는지 확인해요!","level_3":"result = \"바나나\" in fruits 처럼 in 표현을 result에 넣어보세요!"}'::jsonb,
  E'fruits = ["사과", "바나나", "포도"]\nresult = "바나나" in fruits\nprint(result)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-10: 쇼핑 리스트 정리기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000040',
  E'--- 쇼핑 목록 ---\n과자\n우유\n주스\n총 3개',
  '{"level_1":"빈 리스트부터 시작해서 하나씩 추가하고, 정렬하고, 출력하는 순서예요!","level_2":"shopping.append()로 추가, shopping.sort()로 정렬, for item in shopping:으로 출력!","level_3":"shopping.append(\"우유\") 처럼 3개를 추가하고, shopping.sort() 로 정렬하세요!"}'::jsonb,
  E'shopping = []\nshopping.append("우유")\nshopping.append("주스")\nshopping.append("과자")\nshopping.sort()\nprint("--- 쇼핑 목록 ---")\nfor item in shopping:\n    print(item)\nprint("총 " + str(len(shopping)) + "개")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-11: 뒤죽박죽 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000205',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-c5ri"],"explanation":"append()로 송어가 맨 뒤에 들어가 모두 4마리예요. 번호는 0부터 세니까 1번은 두 번째인 잉어예요.","explanations":{"opt-e3wy":"append()는 리스트에 바로 하나를 더해요. 송어까지 세면 4마리예요.","opt-k8ad":"번호는 0부터 세요. 붕어가 0번, 잉어가 1번이에요.","opt-v2hn":"append()로 송어가 들어가서 4마리가 돼요. 그리고 번호 1은 두 번째 물고기예요."}},{"kind":"fill_blank","accepted":[{"bk-u7nc":"tok-r2xo"}],"explanation":"in 은 왼쪽 값이 오른쪽 리스트 안에 있는지 확인해요. 배가 있으니까 참이 되어 글자가 나와요.","explanations":{"tok-f9db":"== 는 \"배\" 한 개와 리스트 전체가 똑같은지 비교해요. 리스트는 \"배\"와 같지 않아서 아무것도 나오지 않아요.","tok-i6kq":"not 혼자서는 두 값 사이에 쓸 수 없어서 오류가 나요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-l3tm","fix":"fx-s7ve"}],"explanation":"for c in colors 는 색을 하나씩 c 에 담아 줘요. 그래서 반복 안에서는 c 를 보여 줘야 한 줄에 색 하나씩 나와요.","explanations":{"fx-b2qu":"따옴표로 감싸면 c 라는 글자 그대로가 세 번 나와요.","fx-g5zi":"c 에는 번호가 아니라 색 글자가 들어 있어요. 글자로는 번호처럼 꺼낼 수 없어 오류가 나요.","ln-o8ck":"이 줄은 색을 하나씩 꺼내는 반복이라 맞아요. 그 아래 줄을 살펴봐요.","ln-w4fs":"이 줄은 리스트를 잘 만들었어요. 반복 안에서 무엇을 보여 주는지 살펴봐요."}},{"kind":"parsons","accepted":[[{"id":"ln-t6eb","indent":0},{"id":"ln-h3ow","indent":0},{"id":"ln-z9ak","indent":0},{"id":"ln-p4uj","indent":1},{"id":"ln-e7rn","indent":2},{"id":"ln-a2gx","indent":0}],[{"id":"ln-h3ow","indent":0},{"id":"ln-t6eb","indent":0},{"id":"ln-z9ak","indent":0},{"id":"ln-p4uj","indent":1},{"id":"ln-e7rn","indent":2},{"id":"ln-a2gx","indent":0}]],"explanation":"빈 리스트를 먼저 만들고, 물고기를 하나씩 보며 20보다 크면 담아요. 다 담은 뒤에 len()으로 세어야 해서 print 는 반복 밖에 둬요."},{"kind":"multiple_choice","accepted":["opt-q3jm"],"explanation":"sort()로 [2, 4, 7, 9] 가 돼요. 0번은 가장 작은 2, 3번은 가장 큰 9예요.","explanations":{"opt-d4nt":"sort()는 작은 것부터 큰 것 차례로 줄을 세워요.","opt-i8wa":"print()에 리스트 전체가 아니라 0번, 3번 하나씩을 넣었어요.","opt-x7bf":"sort()는 리스트를 바로 바꿔요. 줄 세운 뒤의 0번과 3번을 봐야 해요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-n2he","fix":"fx-j3ol"}],"explanation":"append()는 리스트를 바로 바꾸고 아무것도 돌려주지 않아요. 그래서 friends = 를 붙이면 리스트가 사라져요. append()만 써요.","explanations":{"fx-c6wd":"리스트와 글자는 + 로 붙일 수 없어서 오류가 나요. 넣을 때는 append()를 써요.","fx-r8yk":"여우에 따옴표가 없으면 글자가 아니라 상자 이름으로 읽어서 오류가 나요.","ln-f6pv":"이 줄은 리스트를 잘 만들었어요. 여우를 넣는 줄을 살펴봐요.","ln-u5cs":"len()으로 세는 건 맞아요. 그 전에 friends 가 리스트가 아니게 된 게 문제예요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-1: 인사하는 함수
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000019',
  '안녕! 나는 파이뱀이야!',
  '{"level_1":"함수는 def 이름(): 으로 만들어요. 안에 실행할 코드를 써보세요!","level_2":"def 아래에 들여쓰기를 하고 print()로 메시지를 출력해보세요!","level_3":"print(\"___\") 파이뱀의 인사말을 넣어보세요!"}'::jsonb,
  E'def greet():\n    print("안녕! 나는 파이뱀이야!")\n\ngreet()',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-2: 인사 함수 순서
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000116',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"parsons","accepted":[[{"id":"ln-n5ga","indent":0},{"id":"ln-f8qe","indent":1},{"id":"ln-r3wy","indent":1},{"id":"ln-c6kt","indent":0}]],"explanation":"def 로 함수를 만들고 함수 안의 두 줄을 들여쓰기해요. 마지막에 들여쓰기 없이 hello()를 불러야 인사가 나와요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-3: 계산기 함수
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000020',
  '15',
  '{"level_1":"함수 이름 옆 괄호 안의 a, b가 매개변수예요. 이 둘을 더하면?","level_2":"return은 함수가 결과를 돌려주는 거예요. return a + b 이렇게!","level_3":"return ___ + ___ 두 매개변수를 더해서 돌려주세요!"}'::jsonb,
  E'def add(a, b):\n    return a + b\n\nresult = add(7, 8)\nprint(result)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-4: 돌려주는 함수 고르기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000117',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-j4xs"],"explanation":"매개변수 a, b 로 두 수를 받고 return 으로 더한 값을 돌려줘요. 그래서 add(2, 3)은 5가 돼요.","explanations":{"opt-e3ru":"따옴표 안의 a + b 는 계산이 아니라 그냥 글자예요.","opt-o7md":"계산은 했지만 돌려주지 않아서 add(2, 3)의 값이 비어 있어요(None).","opt-y5lf":"괄호가 비어 있어서 넣어 준 2와 3을 받을 자리가 없어요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-5: 기본값이 있는 함수
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000041',
  E'안녕, 친구!\n안녕, 파이뱀!',
  '{"level_1":"기본값이 있으면 함수를 호출할 때 값을 안 넣어도 괜찮아요!","level_2":"greet()은 name이 \"친구\"가 되고, greet(\"파이뱀\")은 name이 \"파이뱀\"이 돼요!","level_3":"함수 안에 print(\"안녕, \" + name + \"!\") 를 쓰고, 아래에 greet() 와 greet(\"파이뱀\") 두 줄을 넣어보세요!"}'::jsonb,
  E'def greet(name="친구"):\n    print("안녕, " + name + "!")\n\ngreet()\ngreet("파이뱀")',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-6: 기본값 빈칸
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000118',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"fill_blank","accepted":[{"bk-h9ap":"tok-q2vd"}],"explanation":"매개변수 뒤에 = 와 값을 쓰면 기본값이 돼요. 값을 넣지 않고 부르면 기본값 \"친구\"가 name에 들어가요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-7: 최댓값 찾기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000021',
  '9',
  '{"level_1":"파이썬에는 이미 만들어진 편리한 함수들이 있어요! 가장 큰 값을 찾는 함수는?","level_2":"max()는 가장 큰 값을 찾아줘요! max(numbers) 이렇게!","level_3":"biggest = ___(numbers) 가장 큰 값을 찾는 함수 이름을 넣어보세요!"}'::jsonb,
  E'numbers = [3, 7, 1, 9, 4]\nbiggest = max(numbers)\nprint(biggest)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-8: 여러 값 돌려주기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000042',
  E'1\n9',
  '{"level_1":"return 뒤에 쉼표로 두 개의 값을 쓸 수 있어요!","level_2":"return smallest, biggest 이렇게 두 값을 동시에 돌려줘요!","level_3":"함수 안 빈 줄에 return smallest, biggest 를 넣어보세요!"}'::jsonb,
  E'def min_max(a, b, c):\n    smallest = min(a, b, c)\n    biggest = max(a, b, c)\n    return smallest, biggest\n\nsmall, big = min_max(1, 9, 5)\nprint(small)\nprint(big)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-9: 함수 안의 함수 호출
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000043',
  '7',
  '{"level_1":"double(3)은 3을 2배로 만들어요. 그 결과에 add_one을 하면?","level_2":"double(3) = 6이고, add_one(6) = 7이에요!","level_3":"result = add_one(double(3)) 처럼 함수 안에 함수를 넣어보세요!"}'::jsonb,
  E'def double(x):\n    return x * 2\n\ndef add_one(x):\n    return x + 1\n\nresult = add_one(double(3))\nprint(result)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-10: 사라진 돌려주기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000119',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"bug_hunt","accepted":[{"line":"ln-v2kc","fix":"fx-o3ga"}],"explanation":"return 으로 n * 2 를 돌려줘야 double(4)가 8이 되고, 1을 더해 9가 나와요.","explanations":{"fx-m6tu":"두 배가 아니라 2를 더하게 돼요. 9가 아니라 7이 나와요.","fx-x8ld":"print는 화면에 보여 주기만 하고 값을 돌려주지 않아요. 그래서 double(4)가 여전히 None 이에요.","ln-s6ob":"이 줄은 매개변수 n 을 받는 함수를 잘 만들었어요.","ln-z7he":"이 줄은 함수가 값을 잘 돌려주면 문제없어요. 함수 안을 살펴봐요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-11: 성적 분석 프로그램
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000044',
  E'평균: 85.0\n등급: B',
  '{"level_1":"average 함수는 3개 숫자의 평균을, grade 함수는 평균에 따른 등급을 돌려줘요!","level_2":"average(80, 90, 85) = 85.0이고, grade(85.0) = \"B\"예요!","level_3":"average는 return (a + b + c) / 3, grade는 if/elif/else로 등급을 return 하세요!"}'::jsonb,
  E'def average(a, b, c):\n    return (a + b + c) / 3\n\ndef grade(avg):\n    if avg >= 90:\n        return "A"\n    elif avg >= 80:\n        return "B"\n    elif avg >= 70:\n        return "C"\n    else:\n        return "D"\n\navg = average(80, 90, 85)\ng = grade(avg)\n\nprint("평균: " + str(avg))\nprint("등급: " + g)',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-12: 주문 도둑 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000206',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-u6pk"],"explanation":"def 는 주문을 만들어 두기만 해요. cheer()로 두 번 불렀으니 힘내! 가 두 번 나와요.","explanations":{"opt-g2we":"함수는 부를 때마다 다시 실행돼요. 두 번 불렀어요.","opt-l9ct":"def 로 만들 때는 실행되지 않아요. 부를 때만 실행돼요.","opt-o4ys":"cheer()는 함수를 부르는 코드예요. 화면에는 함수 안의 print()가 보여 주는 글자가 나와요."}},{"kind":"fill_blank","accepted":[{"bk-m5ta":"tok-c3vi","bk-y8eo":"tok-w7ub"}],"explanation":"max()는 가장 큰 값 95, min()은 가장 작은 값 70을 돌려줘요. 95 - 70 = 25 예요.","explanations":{"tok-k2fz":"len()은 점수가 몇 개인지(3) 세는 함수예요. 가장 높거나 낮은 점수가 아니에요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-x5dr","fix":"fx-a4hm"}],"explanation":"매개변수가 word 와 times 두 개라서 부를 때도 값 두 개를 넣어야 해요. 값 사이는 쉼표로 나눠요.","explanations":{"fx-t8pe":"값 두 개 사이에는 쉼표가 있어야 해요. 없으면 오류가 나요.","fx-z3cu":"따옴표를 붙인 \"2\"는 숫자가 아니라 글자예요. 글자에 글자를 곱할 수는 없어서 오류가 나요.","ln-b7ks":"함수를 만드는 줄은 맞아요. 함수를 부르는 줄을 살펴봐요.","ln-q2ln":"글자에 숫자를 곱하면 그만큼 반복돼요. 이 줄은 맞아요."}},{"kind":"parsons","accepted":[[{"id":"ln-r3nb","indent":0},{"id":"ln-f8xd","indent":1},{"id":"ln-c5kw","indent":0},{"id":"ln-m2ta","indent":1},{"id":"ln-h9vq","indent":0}],[{"id":"ln-c5kw","indent":0},{"id":"ln-m2ta","indent":1},{"id":"ln-r3nb","indent":0},{"id":"ln-f8xd","indent":1},{"id":"ln-h9vq","indent":0}]],"explanation":"함수는 부르기 전에 먼저 만들어 둬야 해요. 각 함수의 return 은 들여 쓰고, 두 함수를 합쳐 부르는 줄은 맨 마지막에 둬요."},{"kind":"multiple_choice","accepted":["opt-e5mr"],"explanation":"처음엔 젤리와 2를 넣었고, 두 번째는 아무것도 넣지 않아서 기본값 쿠키와 1을 써요.","explanations":{"opt-h3za":"함수는 부를 때마다 새로 시작해요. 값을 안 넣으면 기본값을 써요.","opt-p7lo":"기본값이 있으면 값을 넣지 않고 불러도 오류 없이 실행돼요.","opt-s8gd":"앞에서 넣은 2는 그 한 번에만 써요. 다시 부를 때 값을 안 넣으면 기본값 1이 돼요."}},{"kind":"multiple_choice","accepted":["opt-b6qt"],"explanation":"3은 5보다 크지 않아서 작은 수, 8은 5보다 커서 큰 수를 돌려줘요. return 을 만나면 함수가 바로 끝나서 아래 return 은 실행되지 않아요.","explanations":{"opt-n4jx":"앞의 size(3)이 먼저 이어 붙어요. 3은 5보다 작아요.","opt-r9mc":"8은 5보다 커서 첫 번째 return 에서 큰 수를 돌려주고 끝나요.","opt-w2fh":"3은 5보다 크지 않아서 if 아래로 들어가지 않아요. 그래서 아래 return 이 작은 수를 돌려줘요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 7-1: 판정 코드 맞추기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000120',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"parsons","accepted":[[{"id":"ln-u4mr","indent":0},{"id":"ln-g8tz","indent":0},{"id":"ln-k2dh","indent":0},{"id":"ln-w9ac","indent":1},{"id":"ln-b5ny","indent":0},{"id":"ln-e3lq","indent":1},{"id":"ln-p6xf","indent":0},{"id":"ln-i7vo","indent":1}],[{"id":"ln-g8tz","indent":0},{"id":"ln-u4mr","indent":0},{"id":"ln-k2dh","indent":0},{"id":"ln-w9ac","indent":1},{"id":"ln-b5ny","indent":0},{"id":"ln-e3lq","indent":1},{"id":"ln-p6xf","indent":0},{"id":"ln-i7vo","indent":1}]],"explanation":"비밀 숫자와 고른 숫자를 먼저 상자에 넣고, if 와 elif 로 작은지 큰지 물어본 뒤, 둘 다 아니면 else 로 정답을 알려 줘요. 5는 7보다 작아서 \"더 큰 수예요\"가 나와요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 7-2: 몇 번 만에 맞혔을까?
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000121',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-f5wi"],"explanation":"리스트에 숫자가 3개라 반복이 3번 돌고, 그때마다 tries 에 1을 더해요. 마지막에 한 번만 보여 줘요.","explanations":{"opt-a9ry":"print(tries)는 들여쓰기가 없어서 반복이 끝난 뒤 한 번만 실행돼요.","opt-l3ep":"tries 에는 guess 가 아니라 1을 더해요. 리스트의 숫자를 모두 더한 게 아니에요.","opt-t8gc":"반복은 리스트에 든 값마다 한 번씩, 여러 번 돌아요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 7-3: 숫자 맞추기 게임
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000022',
  '번 만에 맞췄어요',
  '{"level_1":"이 프로젝트는 5단계로 진행돼요. 각 단계의 안내를 잘 따라가 보세요!","level_2":"random, 변수, 조건문, 반복문을 차례대로 사용할 거예요!","level_3":"각 단계에서 힌트를 활용하면 더 쉽게 진행할 수 있어요!"}'::jsonb,
  NULL,
  '[{"step_number":1,"expected_output":"random.randint","hints":{"level_1":"random 모듈의 randint 함수를 사용하면 원하는 범위의 숫자를 만들 수 있어요!","level_2":"secret = random.randint(1, 10) 이렇게 변수에 저장하고, print()로 확인해보세요!","level_3":"secret = random.___(1, 10)\nprint(secret)\n랜덤 숫자를 만드는 함수 이름을 넣어보세요!"},"solution_code":"import random\n\nsecret = random.randint(1, 10)\nprint(secret)"},{"step_number":2,"expected_output":"[{\"type\":\"code_check\",\"expected\":\"guess\"},{\"type\":\"contains\",\"expected\":\"추측\"}]","hints":{"level_1":"추측 숫자를 저장할 변수가 필요해요! guess라는 이름은 어떨까요?","level_2":"실제 게임에서는 input()을 쓰지만, 여기서는 int(random.randint(1, 10))으로 자동 추측을 만들어요!","level_3":"guess = ___(random.randint(1, 10))\nprint(\"추측: \" + ___(guess))\n타입을 바꾸는 함수를 넣어보세요!"},"solution_code":"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\nprint(\"비밀 숫자: \" + str(secret))\nprint(\"추측: \" + str(guess))"},{"step_number":3,"expected_output":"[{\"type\":\"code_check\",\"expected\":\"elif\"},{\"type\":\"contains_any\",\"expected\":[\"커요\",\"작아요\",\"정답\"]}]","hints":{"level_1":"if, elif, else를 사용해서 세 가지 경우를 나눠보세요: 같을 때, 작을 때, 클 때!","level_2":"if guess == secret: 정답!\nelif guess < secret: 더 커요!\nelse: 더 작아요!\n이런 구조예요!","level_3":"if guess == secret:\n    print(\"___!\")\nelif guess < secret:\n    print(\"비밀 숫자가 더 ___!\")\nelse:\n    print(\"비밀 숫자가 더 ___!\")\n___에 정답, 커요, 작아요 중 알맞은 말을 넣어보세요! 숫자는 매번 바뀌니까 어느 말이 나와도 괜찮아요."},"solution_code":"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\n\nif guess == secret:\n    print(\"정답!\")\nelif guess < secret:\n    print(\"비밀 숫자가 추측보다 커요!\")\nelse:\n    print(\"비밀 숫자가 추측보다 작아요!\")"},{"step_number":4,"expected_output":"while","hints":{"level_1":"while 반복문을 사용하면 조건이 참인 동안 계속 반복할 수 있어요!","level_2":"while guess != secret: 이렇게 쓰면 정답을 맞출 때까지 반복해요! 추측 코드를 while 안에 넣어보세요.","level_3":"while guess ___ secret:\n    guess = ___(random.randint(1, 10))\n같지 않다는 비교 기호와 타입 변환 함수를 넣어보세요!"},"solution_code":"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\n\nwhile guess != secret:\n    if guess < secret:\n        print(\"비밀 숫자가 추측보다 커요!\")\n    else:\n        print(\"비밀 숫자가 추측보다 작아요!\")\n    guess = int(random.randint(1, 10))\n\nprint(\"정답!\")"},{"step_number":5,"expected_output":"번 만에 맞췄어요","hints":{"level_1":"attempts라는 변수를 만들어서 추측할 때마다 1씩 올려보세요!","level_2":"attempts = 0을 while 앞에 두고, while 안에서 attempts = attempts + 1로 올려요!","level_3":"print(\"정답! \" + ___(attempts) + \"번 만에 맞췄어요!\") 숫자를 글자로 바꾸는 함수를 넣어보세요!"},"solution_code":"import random\n\nsecret = random.randint(1, 10)\nguess = int(random.randint(1, 10))\nattempts = 0\n\nwhile guess != secret:\n    attempts = attempts + 1\n    if guess < secret:\n        print(\"비밀 숫자가 추측보다 커요!\")\n    else:\n        print(\"비밀 숫자가 추측보다 작아요!\")\n    guess = int(random.randint(1, 10))\n\nattempts = attempts + 1\nprint(\"정답! \" + str(attempts) + \"번 만에 맞췄어요!\")"}]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 7-4: 버그버그 대왕
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b1000000-0000-0000-0000-000000000207',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-d7ve"],"explanation":"name 상자 속 파이뱀과, str()로 글자가 된 7이 이어 붙어요. 따옴표와 str()은 화면에 나오지 않아요.","explanations":{"opt-f2pi":"str()로 글자가 되어도 따옴표는 화면에 나오지 않아요.","opt-k3so":"따옴표 없는 name 과 level 은 상자 이름이라 상자 속 값이 나와요.","opt-y9ag":"str(level)은 계산되어 글자 7이 돼요. 코드 글자 그대로 나오지 않아요."}},{"kind":"fill_blank","accepted":[{"bk-s4qn":"tok-h8cx"}],"explanation":"break 는 반복을 그 자리에서 끝내요. 7을 맞히면 정답! 을 보여 주고 게임이 끝나서 9는 나오지 않아요.","explanations":{"tok-a5ld":"continue 는 이번 차례만 건너뛰고 다음 숫자로 가요. 맞힌 뒤에도 9를 또 봐요.","tok-u2ze":"return 은 함수 안에서만 쓸 수 있어요. 함수 밖에서 쓰면 오류가 나요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-o6ty","fix":"fx-l7da"}],"explanation":"따옴표 속 \"7\"은 글자, secret 의 7은 숫자라서 서로 같지 않아요. int()로 글자를 숫자로 바꿔서 비교해야 해요. 게임에서 input()으로 받은 값도 글자라서 똑같은 버그가 자주 나요.","explanations":{"fx-p8vs":"같은지 비교할 때는 = 를 두 개 써요. 하나만 쓰면 오류가 나요.","fx-x3ng":"str()은 글자로 바꿔요. 글자 \"7\"과 숫자 7은 여전히 달라요.","ln-c8pw":"게임에서는 고른 숫자가 이렇게 글자로 들어와요. 이 줄은 그대로 두고, 비교하는 줄에서 숫자로 바꿔요.","ln-e5kh":"이 줄은 틀렸을 때 할 일이라 맞아요. 왜 틀렸다고 판단하는지 살펴봐요.","ln-g2ub":"이 줄은 정답일 때 할 일이라 맞아요. 조건을 따지는 줄을 살펴봐요.","ln-j4ri":"비밀 숫자는 숫자 7로 잘 넣었어요. 다른 줄을 살펴봐요.","ln-w9mf":"else 줄은 맞아요. 조건을 따지는 줄을 살펴봐요."}},{"kind":"multiple_choice","accepted":["opt-z6hb"],"explanation":"반복하며 별 1개, 2개, 3개짜리 글자를 리스트에 담아요. 마지막에 리스트를 통째로 보여 주면 대괄호와 따옴표까지 함께 나와요.","explanations":{"opt-i4wr":"print()는 반복이 끝난 뒤 한 번만, 리스트 전체를 보여 줘요. 그래서 대괄호 안에 함께 나와요.","opt-m8cu":"\"*\" * i 는 i 만큼 별을 반복해요. 반복할 때마다 i 가 1, 2, 3 으로 커져요.","opt-t5kq":"리스트에 담은 것은 숫자 i 가 아니라 별 글자예요."}},{"kind":"parsons","accepted":[[{"id":"ln-v3hk","indent":0},{"id":"ln-q7ad","indent":1},{"id":"ln-l4sx","indent":1},{"id":"ln-b8no","indent":2},{"id":"ln-y2fe","indent":3},{"id":"ln-a6tj","indent":1},{"id":"ln-k9gm","indent":0}]],"explanation":"함수 안에서 0부터 세기 시작하고, 기록을 하나씩 보며 승이면 1을 더해요. return 은 반복이 다 끝난 뒤에 와야 해서 for 와 같은 깊이로 들여 써요."},{"kind":"bug_hunt","accepted":[{"line":"ln-s9ev","fix":"fx-k6ub"}],"explanation":"함수 이름 뒤에 괄호를 붙여야 함수를 불러요. 괄호가 없으면 이름만 말하고 실행하지 않아요.","explanations":{"fx-f7ry":"def 는 함수를 만들 때 쓰는 말이에요. 부를 때는 쓰지 않아요.","fx-o3ji":"괄호가 없어서 여전히 함수를 부르지 않아요. 함수 자체의 정보가 나와요.","ln-d2qc":"함수 안에서 보여 줄 글자는 맞아요. 함수가 불렸는지 살펴봐요.","ln-h5wz":"함수를 만드는 줄은 맞아요. 함수를 부르는 줄을 살펴봐요."}},{"kind":"multiple_choice","accepted":["opt-p4xm"],"explanation":"8은 5보다 커서 작게, 3은 작아서 크게, 5는 같아서 정답! 을 보여 주고 break 로 끝나요. 그래서 1은 보지 않아요.","explanations":{"opt-c9ef":"정답! 다음에 break 가 있어서 반복이 끝나요. 1은 따지지 않아요.","opt-g3sw":"맞히기 전의 8과 3도 하나씩 따져서 글자를 보여 줘요.","opt-j6dl":"고른 수가 비밀 숫자보다 크면 더 작게 고르라고 알려 줘요. 8은 5보다 커요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();
