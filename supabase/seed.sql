-- ============================================================
-- pyRoad 콘텐츠 seed — 생성물입니다. 직접 고치지 마세요.
-- 고치려면 content/ 의 YAML 을 고친 뒤 npm run content:build 로 다시 만듭니다 (content/README.md).
-- CI 는 npm run content:build -- --check 로 이 파일이 content/ 와 같은지 확인합니다.
-- 콘텐츠 해시: a19aa81022649dd5
-- 월드 3 · 스테이지 14 · 퀘스트 136 · 정답 행 136 (solution_code 81 + 프로젝트 단계 15)
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
UPDATE public.stages SET "order" = -"order" WHERE "order" > 0 AND id IN ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000007');
UPDATE public.quests SET "order" = -"order" WHERE "order" > 0 AND id IN ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000023', 'b1000000-0000-0000-0000-000000000101', 'b1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000024', 'b1000000-0000-0000-0000-000000000102', 'b1000000-0000-0000-0000-000000000025', 'b1000000-0000-0000-0000-000000000103', 'b1000000-0000-0000-0000-000000000026', 'b1000000-0000-0000-0000-000000000201', 'b1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000027', 'b1000000-0000-0000-0000-000000000104', 'b1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000028', 'b1000000-0000-0000-0000-000000000105', 'b1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000106', 'b1000000-0000-0000-0000-000000000029', 'b1000000-0000-0000-0000-000000000202', 'b1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000107', 'b1000000-0000-0000-0000-000000000030', 'b1000000-0000-0000-0000-000000000108', 'b1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000109', 'b1000000-0000-0000-0000-000000000031', 'b1000000-0000-0000-0000-000000000032', 'b1000000-0000-0000-0000-000000000203', 'b1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000110', 'b1000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000033', 'b1000000-0000-0000-0000-000000000034', 'b1000000-0000-0000-0000-000000000111', 'b1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000035', 'b1000000-0000-0000-0000-000000000112', 'b1000000-0000-0000-0000-000000000036', 'b1000000-0000-0000-0000-000000000204', 'b1000000-0000-0000-0000-000000000016', 'b1000000-0000-0000-0000-000000000017', 'b1000000-0000-0000-0000-000000000113', 'b1000000-0000-0000-0000-000000000037', 'b1000000-0000-0000-0000-000000000018', 'b1000000-0000-0000-0000-000000000114', 'b1000000-0000-0000-0000-000000000038', 'b1000000-0000-0000-0000-000000000115', 'b1000000-0000-0000-0000-000000000039', 'b1000000-0000-0000-0000-000000000040', 'b1000000-0000-0000-0000-000000000205', 'b1000000-0000-0000-0000-000000000019', 'b1000000-0000-0000-0000-000000000116', 'b1000000-0000-0000-0000-000000000020', 'b1000000-0000-0000-0000-000000000117', 'b1000000-0000-0000-0000-000000000041', 'b1000000-0000-0000-0000-000000000118', 'b1000000-0000-0000-0000-000000000021', 'b1000000-0000-0000-0000-000000000042', 'b1000000-0000-0000-0000-000000000043', 'b1000000-0000-0000-0000-000000000119', 'b1000000-0000-0000-0000-000000000044', 'b1000000-0000-0000-0000-000000000206', 'b1000000-0000-0000-0000-000000000120', 'b1000000-0000-0000-0000-000000000121', 'b1000000-0000-0000-0000-000000000022', 'b1000000-0000-0000-0000-000000000207', 'b2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000006', 'b2000000-0000-0000-0000-000000000007', 'b2000000-0000-0000-0000-000000000008', 'b2000000-0000-0000-0000-000000000009', 'b2000000-0000-0000-0000-000000000010', 'b2000000-0000-0000-0000-000000000201', 'b2000000-0000-0000-0000-000000000011', 'b2000000-0000-0000-0000-000000000012', 'b2000000-0000-0000-0000-000000000013', 'b2000000-0000-0000-0000-000000000014', 'b2000000-0000-0000-0000-000000000015', 'b2000000-0000-0000-0000-000000000016', 'b2000000-0000-0000-0000-000000000017', 'b2000000-0000-0000-0000-000000000018', 'b2000000-0000-0000-0000-000000000202', 'b2000000-0000-0000-0000-000000000019', 'b2000000-0000-0000-0000-000000000020', 'b2000000-0000-0000-0000-000000000021', 'b2000000-0000-0000-0000-000000000022', 'b2000000-0000-0000-0000-000000000023', 'b2000000-0000-0000-0000-000000000024', 'b2000000-0000-0000-0000-000000000025', 'b2000000-0000-0000-0000-000000000026', 'b2000000-0000-0000-0000-000000000027', 'b2000000-0000-0000-0000-000000000203', 'b2000000-0000-0000-0000-000000000028', 'b2000000-0000-0000-0000-000000000029', 'b2000000-0000-0000-0000-000000000030', 'b2000000-0000-0000-0000-000000000031', 'b2000000-0000-0000-0000-000000000032', 'b2000000-0000-0000-0000-000000000033', 'b2000000-0000-0000-0000-000000000034', 'b2000000-0000-0000-0000-000000000035', 'b2000000-0000-0000-0000-000000000204', 'b2000000-0000-0000-0000-000000000036', 'b2000000-0000-0000-0000-000000000037', 'b2000000-0000-0000-0000-000000000038', 'b2000000-0000-0000-0000-000000000039', 'b2000000-0000-0000-0000-000000000040', 'b2000000-0000-0000-0000-000000000041', 'b2000000-0000-0000-0000-000000000042', 'b2000000-0000-0000-0000-000000000043', 'b2000000-0000-0000-0000-000000000044', 'b2000000-0000-0000-0000-000000000045', 'b2000000-0000-0000-0000-000000000205', 'b2000000-0000-0000-0000-000000000046', 'b2000000-0000-0000-0000-000000000047', 'b2000000-0000-0000-0000-000000000048', 'b2000000-0000-0000-0000-000000000049', 'b2000000-0000-0000-0000-000000000050', 'b2000000-0000-0000-0000-000000000051', 'b2000000-0000-0000-0000-000000000052', 'b2000000-0000-0000-0000-000000000053', 'b2000000-0000-0000-0000-000000000206', 'b2000000-0000-0000-0000-000000000054', 'b2000000-0000-0000-0000-000000000055', 'b2000000-0000-0000-0000-000000000056', 'b2000000-0000-0000-0000-000000000057', 'b2000000-0000-0000-0000-000000000207');

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
  ('a1000000-0000-0000-0000-000000000007', (SELECT w.id FROM public.worlds w WHERE w.slug = 'python-island'), 7, '프로젝트 왕국', 'project_kingdom', '배운 모든 것을 모아 프로젝트를 완성해봐요!', TRUE),
  ('a2000000-0000-0000-0000-000000000001', (SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, '산호 문자열 공방', 'string_workshop', '글자를 자르고, 바꾸고, 붙여서 산호 간판을 고쳐요!', FALSE),
  ('a2000000-0000-0000-0000-000000000002', (SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, '등대 딕셔너리 도서관', 'dict_library', '이름표(키)와 내용(값)을 짝지어 등대 도서관을 정리해요!', FALSE),
  ('a2000000-0000-0000-0000-000000000003', (SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 3, '소용돌이 반복 미로', 'nested_maze', '반복 안에 반복을 넣어 숨은 보물 지도를 찾아요!', FALSE),
  ('a2000000-0000-0000-0000-000000000004', (SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 4, '해적선 랜덤 놀이공원', 'random_park', '주사위와 뽑기 기계로 랜덤과 수학 도구를 써 봐요!', FALSE),
  ('a2000000-0000-0000-0000-000000000005', (SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 5, '버그 병원선', 'bug_hospital', '에러 메시지를 읽고 아픈 코드를 고쳐 줘요!', FALSE),
  ('a2000000-0000-0000-0000-000000000006', (SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 6, '해저 알고리즘 산맥', 'algorithm_ridge', '합, 최댓값, 찾기, 줄 세우기를 직접 만들어 봐요!', FALSE),
  ('a2000000-0000-0000-0000-000000000007', (SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 7, '응용 프로젝트 항구', 'project_harbor', '배운 주문을 모아 쓸모 있는 프로그램을 완성해요!', TRUE)
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
  '{"topic":"print() 함수로 출력하기","learning_goals":["print() 함수를 사용하여 텍스트를 출력할 수 있다","따옴표 안에 원하는 텍스트를 넣을 수 있다"],"story_context":"파이썬 마을에 도착한 모험가가 마을 사람들에게 첫 인사를 하는 장면","exercise_description":"print() 함수를 사용하여 \"안녕하세요!\"를 출력해보세요","starter_code":"# 아래에 코드를 작성해보세요!\n","expected_output_hint":"안녕하세요! 가 출력되어야 해요","checklist":["print( )를 써요","따옴표 안에 안녕하세요! 를 넣어요","코드를 돌려서 인사가 나오는지 봐요"],"example_output":"안녕하세요!","example_exact":true,"fallback_text":"print()는 화면에 글자를 보여주는 마법 주문이에요! print(\"안녕하세요!\") 이렇게 따옴표 안에 보여주고 싶은 말을 넣으면 돼요."}'::jsonb,
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
  '{"topic":"print()를 여러 번 사용하여 여러 줄 출력하기","learning_goals":["print()를 여러 번 사용하여 여러 줄을 출력할 수 있다","각 print()가 한 줄씩 출력하는 것을 이해한다"],"story_context":"마을 입구에서 자기소개를 하는 모험가. 마을 사람들이 이름과 인사를 기다리고 있어요!","exercise_description":"print()를 두 번 사용하여 첫 줄에 \"나는 파이썬 모험가!\", 둘째 줄에 \"반가워!\"를 출력하세요","starter_code":"# 두 줄을 출력해보세요!\n","expected_output_hint":"두 줄이 출력되어야 해요: 나는 파이썬 모험가! 그리고 반가워!","checklist":["print( )를 두 줄 써요","첫 줄에는 나는 파이썬 모험가! 를 넣어요","둘째 줄에는 반가워! 를 넣어요"],"example_output":"나는 파이썬 모험가!\n반가워!","example_exact":true,"fallback_text":"print()를 두 번 쓰면 두 줄이 나와요! 첫 번째 print()에 첫 번째 문장을, 두 번째 print()에 두 번째 문장을 넣어보세요."}'::jsonb,
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
  '{"topic":"작은따옴표와 큰따옴표의 차이","learning_goals":["작은따옴표와 큰따옴표 모두 문자열을 만들 수 있다","문자열 안에 따옴표가 포함될 때 다른 종류의 따옴표로 감싸야 함을 안다"],"story_context":"파이썬 마을의 따옴표 가게에 왔어요! 작은따옴표와 큰따옴표, 언제 어떤 걸 써야 할까요?","exercise_description":"print()를 사용하여 I''m happy! 를 출력해보세요. 큰따옴표로 감싸면 안에 작은따옴표를 쓸 수 있어요!","starter_code":"# I''m happy! 를 출력해보세요!\n# 힌트: 큰따옴표로 감싸보세요!\n","expected_output_hint":"I''m happy! 가 출력되어야 해요","checklist":["print( ) 안을 큰따옴표 \" \" 로 감싸요","그 안에 I''m happy! 를 그대로 넣어요"],"example_output":"I''m happy!","example_exact":true,"fallback_text":"문자열 안에 작은따옴표(  ''  )가 있으면 큰따옴표(\")로 감싸면 돼요! print(\"I''m happy!\") 이렇게요."}'::jsonb,
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
  '{"topic":"주석(#)의 역할과 사용법","learning_goals":["#으로 시작하는 줄이 주석임을 안다","주석은 컴퓨터가 무시하고 사람만 읽는 메모임을 이해한다","주석과 코드를 구분하여 작성할 수 있다"],"story_context":"마을의 게시판에 비밀 메모를 남기는 모험가. 주석으로 쓴 메모는 컴퓨터가 읽지 못해요!","exercise_description":"첫 줄에 주석(#)으로 아무 메모나 남기고, 둘째 줄에 print()로 \"파이썬은 재미있어!\"를 출력하세요","starter_code":"# 여기에 메모를 남겨보세요 (이 줄은 주석이에요!)\n","expected_output_hint":"파이썬은 재미있어! 만 출력되어야 해요 (주석은 출력되지 않아요)","checklist":["첫 줄에 # 으로 메모를 남겨요","둘째 줄에 print( )로 파이썬은 재미있어! 를 보여 줘요","메모는 화면에 안 나오는지 확인해요"],"example_output":"파이썬은 재미있어!","example_exact":true,"fallback_text":"#으로 시작하는 줄은 주석이에요. 컴퓨터는 이 줄을 무시해요! 주석 아래에 print(\"파이썬은 재미있어!\")를 써보세요."}'::jsonb,
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
  '{"topic":"이스케이프 문자 \\n으로 줄바꿈하기","learning_goals":["\\n이 줄바꿈을 뜻하는 특수 문자임을 안다","print() 한 번으로 여러 줄을 출력할 수 있다"],"story_context":"파이썬 마을의 마법 편지지! \\n을 쓰면 편지가 두 줄로 나뉘어요.","exercise_description":"print()를 한 번만 사용하여 \"첫째 줄\"과 \"둘째 줄\"을 두 줄로 출력하세요. \\n을 사용해요!","starter_code":"# print()를 한 번만 사용해서 두 줄로 출력해보세요!\n# 힌트: \\n은 줄바꿈이에요!\n","expected_output_hint":"첫째 줄과 둘째 줄이 각각 다른 줄에 출력되어야 해요","checklist":["print( )는 딱 한 번만 써요","첫째 줄과 둘째 줄 사이에 \\n 을 넣어요","두 줄로 나오는지 확인해요"],"example_output":"첫째 줄\n둘째 줄","example_exact":true,"fallback_text":"\\n은 줄바꿈을 뜻하는 특수 문자예요! print(\"첫째 줄\\n둘째 줄\") 이렇게 쓰면 두 줄로 나뉘어서 출력돼요."}'::jsonb,
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
  '{"topic":"print()로 숫자 출력하기","learning_goals":["print()로 숫자를 출력할 수 있다","숫자는 따옴표 없이 쓰는 것을 안다"],"story_context":"파이썬 마을의 시계탑에 올해 연도를 새겨야 해요! 숫자를 출력해볼까요?","exercise_description":"print()로 숫자 2026을 출력하세요. 따옴표 없이 숫자만 넣어보세요!","starter_code":"# 숫자 2026을 출력해보세요!\n# 힌트: 따옴표 없이 숫자만 넣으면 돼요!\n","expected_output_hint":"2026 이 출력되어야 해요","checklist":["print( ) 안에 2026 을 넣어요","따옴표 없이 숫자만 써요"],"example_output":"2026","example_exact":true,"fallback_text":"print() 안에 따옴표 없이 숫자를 넣으면 숫자가 그대로 출력돼요! print(2026) 이렇게요."}'::jsonb,
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
  '{"topic":"print() 종합 활용","learning_goals":["주석과 print()를 자유롭게 사용할 수 있다","문자열과 숫자를 print()로 출력할 수 있다","여러 줄을 출력하여 의미 있는 결과물을 만들 수 있다"],"story_context":"파이썬 마을에 새 안내판을 세워야 해요! 주석으로 설명을 달고, print()로 멋진 안내판을 만들어봐요!","exercise_description":"주석 1줄을 쓰고, print()를 3번 사용하여 마을 안내판을 만드세요. 첫 줄: === 파이썬 마을 ===, 둘째 줄: 인구: 2026명, 셋째 줄: 환영합니다!","starter_code":"# 마을 안내판을 만들어보세요!\n# 주석 1줄 + print() 3줄로 완성!\n","expected_output_hint":"=== 파이썬 마을 ===, 인구: 2026명, 환영합니다! 가 각각 한 줄씩 출력되어야 해요","checklist":["# 으로 메모를 한 줄 써요","print( )를 세 번 써요","=== 파이썬 마을 ===, 인구: 2026명, 환영합니다! 를 차례로 보여 줘요"],"example_output":"=== 파이썬 마을 ===\n인구: 2026명\n환영합니다!","example_exact":true,"fallback_text":"주석으로 설명을 달고, print()를 3번 사용해서 안내판을 만들어요! 각 줄에 다른 내용을 넣어보세요.","is_challenge":true}'::jsonb,
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
  '{"topic":"정수(int)와 문자열(str) 자료형","learning_goals":["숫자는 따옴표 없이, 글자는 따옴표로 감싸서 저장하는 것을 안다","int와 str이 다른 종류의 상자임을 이해한다"],"story_context":"숲 속 두 종류의 마법 상자를 발견! 숫자 상자와 글자 상자를 구분해봐요.","exercise_description":"number 변수에 10을, greeting 변수에 \"안녕\"을 저장하고 각각 print()로 출력하세요","starter_code":"# 숫자와 글자를 각각 변수에 넣어보세요!\nnumber = \ngreeting = \nprint(number)\nprint(greeting)","expected_output_hint":"10과 안녕이 한 줄씩 출력되어야 해요","checklist":["number 상자에 숫자 10을 넣어요","greeting 상자에 \"안녕\"을 넣어요","두 상자를 한 줄씩 보여 줘요"],"example_output":"10\n안녕","example_exact":true,"fallback_text":"숫자는 따옴표 없이 number = 10, 글자는 따옴표와 함께 greeting = \"안녕\" 이렇게 넣어요!"}'::jsonb,
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
  '{"topic":"변수 재할당 (값 바꾸기)","learning_goals":["변수에 새로운 값을 다시 넣을 수 있다","변수의 값은 언제든 바꿀 수 있음을 이해한다"],"story_context":"변수의 숲에서 마법 상자의 내용물을 바꿔볼까요? 상자 안의 색깔을 바꿔봐요!","exercise_description":"color 변수에 \"빨강\"을 저장한 후, \"파랑\"으로 바꾸고 print()로 출력하세요","starter_code":"# 색깔을 바꿔보세요!\ncolor = \"빨강\"\n# 아래에서 color를 \"파랑\"으로 바꿔보세요!\n\nprint(color)","expected_output_hint":"파랑 이 출력되어야 해요","checklist":["color 상자에 \"파랑\"을 다시 넣어요","print(color)로 바뀐 색을 보여 줘요"],"example_output":"파랑","example_exact":true,"fallback_text":"변수는 상자니까 안에 든 걸 바꿀 수 있어요! color = \"파랑\" 이렇게 다시 넣으면 이전 값은 사라지고 새 값이 들어가요."}'::jsonb,
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
  '{"topic":"문자열 연결 연산자 +","learning_goals":["+ 연산자로 문자열을 합칠 수 있다","문자열끼리 더하면 이어붙여지는 것을 이해한다"],"story_context":"변수의 숲에서 마법 접착제를 발견했어요! 글자와 글자를 이어붙여 새로운 단어를 만들어봐요!","exercise_description":"first = \"파이\", second = \"썬\"을 변수에 저장하고, + 연산자로 합쳐서 출력하세요","starter_code":"# 글자를 합쳐보세요!\nfirst = \"파이\"\nsecond = \"썬\"\nresult = \nprint(result)","expected_output_hint":"파이썬 이 출력되어야 해요","checklist":["result 에 first + second 를 넣어요","print(result)로 합친 글자를 보여 줘요"],"example_output":"파이썬","example_exact":true,"fallback_text":"문자열끼리 + 를 쓰면 이어붙여져요! \"파이\" + \"썬\" = \"파이썬\"이 돼요."}'::jsonb,
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
  '{"topic":"자료형 변환 (str -> int, int -> str)","learning_goals":["int()로 문자열을 숫자로 바꿀 수 있다","str()로 숫자를 문자열로 바꿀 수 있다","형변환이 필요한 상황을 이해한다"],"story_context":"변신 마법사를 만났어요! 글자를 숫자로, 숫자를 글자로 변신시킬 수 있대요.","exercise_description":"문자열 \"100\"과 \"23\"을 int()로 숫자로 바꿔서 더한 뒤 결과를 출력하세요","starter_code":"# 문자열을 숫자로 바꿔서 더해보세요!\na = \"100\"\nb = \"23\"\nresult = \nprint(result)","expected_output_hint":"123이 출력되어야 해요","checklist":["int( )로 a와 b를 숫자로 바꿔요","두 숫자를 더해 result 에 넣어요","result 를 보여 줘요"],"example_output":"123","example_exact":true,"fallback_text":"\"100\"은 글자예요. int(\"100\")으로 숫자 100으로 변신시킬 수 있어요! 숫자끼리는 더할 수 있지요."}'::jsonb,
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
  '{"topic":"변수와 문자열 연결 종합 활용","learning_goals":["여러 변수를 선언하고 값을 저장할 수 있다","문자열 연결을 사용하여 의미 있는 문장을 만들 수 있다","변수를 활용하여 자기소개 카드를 완성할 수 있다"],"story_context":"변수의 숲을 떠나기 전에, 지금까지 배운 걸 모아서 멋진 자기소개 카드를 만들어봐요!","exercise_description":"name, age, school 변수에 각각 값을 저장하고, 문자열 연결로 자기소개를 3줄로 출력하세요","starter_code":"# 자기소개 카드를 만들어보세요!\nname = \"파이뱀\"\nage = \"10\"\nschool = \"코딩초등학교\"\n\n# 아래에 print()를 3번 써서 자기소개를 출력하세요!\n","expected_output_hint":"이름: 파이뱀, 나이: 10살, 학교: 코딩초등학교 가 각각 한 줄씩 출력되어야 해요","checklist":["print( )를 세 번 써요","+ 로 \"이름: \" 과 name 을 이어 붙여요","나이 뒤에는 살, 학교 줄도 같은 방법으로 써요"],"example_output":"이름: 파이뱀\n나이: 10살\n학교: 코딩초등학교","example_exact":true,"fallback_text":"변수에 저장한 값과 문자열을 + 로 합쳐서 출력해요! print(\"이름: \" + name) 이렇게요.","is_challenge":true}'::jsonb,
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
  '{"topic":"if/else 조건문","learning_goals":["if 문으로 조건을 검사할 수 있다","else로 조건이 거짓일 때 실행할 코드를 작성할 수 있다","== 비교 연산자를 사용할 수 있다"],"story_context":"갈림길의 비밀 문 앞에 섰어요! 올바른 비밀번호를 입력해야 문이 열려요.","exercise_description":"password 변수에 \"열려라\"를 저장하고, if문으로 password가 \"열려라\"와 같으면 \"통과!\"를 출력하세요","starter_code":"# 비밀번호를 확인하는 코드를 작성해보세요!\npassword = \"열려라\"\n\nif password == \"열려라\":\n    print()","expected_output_hint":"통과! 가 출력되어야 해요","checklist":["if 아래 print( ) 안에 \"통과!\"를 넣어요","if 안의 줄은 네 칸 들여 써요"],"example_output":"통과!","example_exact":true,"fallback_text":"if는 \"만약 ~라면\"이에요! if password == \"열려라\": 이렇게 조건을 쓰고, 다음 줄에 들여쓰기 후 실행할 코드를 써요."}'::jsonb,
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
  '{"topic":"if/else와 나머지 연산자 %","learning_goals":["% 연산자로 나머지를 구할 수 있다","짝수/홀수를 판별하는 조건을 만들 수 있다"],"story_context":"갈림길에서 숫자 요정을 만났어요! 숫자가 짝수인지 홀수인지 알려줘야 길을 안내해줘요.","exercise_description":"number = 7에 대해 짝수인지 홀수인지 판별하여 출력하세요. 짝수면 \"짝수\", 홀수면 \"홀수\"를 출력!","starter_code":"# 짝수인지 홀수인지 판별해보세요!\nnumber = 7\n\nif number % 2 == 0:\n    print(\"짝수\")\nelse:\n    print()","expected_output_hint":"홀수 가 출력되어야 해요","checklist":["else 아래 print( ) 안에 \"홀수\"를 넣어요","7을 2로 나눈 나머지가 1이라 else 쪽이 돌아가요"],"example_output":"홀수","example_exact":true,"fallback_text":"% 연산자는 나누기의 나머지를 구해요! 7 % 2 = 1 이니까 홀수예요. 짝수는 나머지가 0이에요."}'::jsonb,
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
  '{"topic":"비교연산자로 조건 만들기","learning_goals":[">=, <=, >, < 비교연산자를 사용할 수 있다","비교 결과가 True/False임을 이해한다"],"story_context":"놀이공원에 가려면 키가 120cm 이상이어야 해요! 키를 재볼까요?","exercise_description":"height = 130일 때, height >= 120이면 \"입장 가능!\"을 출력하세요","starter_code":"# 키를 확인하는 코드를 작성해보세요!\nheight = 130\n\nif height >= 120:\n    print()","expected_output_hint":"입장 가능! 이 출력되어야 해요","checklist":["if 아래 print( ) 안에 \"입장 가능!\"을 넣어요","130이 120 이상인지 생각해 봐요"],"example_output":"입장 가능!","example_exact":true,"fallback_text":">= 는 \"크거나 같다\"는 뜻이에요! height >= 120은 키가 120 이상인지 물어보는 거예요."}'::jsonb,
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
  '{"topic":"논리연산자 and, or, not","learning_goals":["and는 두 조건이 모두 참일 때 참이 되는 것을 안다","or는 하나만 참이어도 참이 되는 것을 안다","논리연산자로 복합 조건을 만들 수 있다"],"story_context":"마법사가 되려면 두 가지 시험을 모두 통과해야 해요! 마법 점수와 용기 점수가 모두 높아야 해요.","exercise_description":"magic = 80, courage = 70일 때, 둘 다 60 이상이면 \"마법사 합격!\"을 출력하세요","starter_code":"# 마법사 자격을 확인해보세요!\nmagic = 80\ncourage = 70\n\nif magic >= 60 and courage >= 60:\n    print()","expected_output_hint":"마법사 합격! 이 출력되어야 해요","checklist":["and 로 두 조건을 함께 봐요","if 아래 print( ) 안에 \"마법사 합격!\"을 넣어요"],"example_output":"마법사 합격!","example_exact":true,"fallback_text":"and는 \"그리고\"예요! magic >= 60 and courage >= 70은 \"마법 점수가 60 이상이고 용기 점수도 60 이상\"이라는 뜻이에요."}'::jsonb,
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
  '{"topic":"중첩 if문으로 복잡한 조건 처리하기","learning_goals":["if 안에 if를 넣어 중첩 조건을 만들 수 있다","여러 조건을 조합하여 결과를 판단할 수 있다"],"story_context":"갈림길의 가위바위보 대회! 심판이 되어 누가 이겼는지 판정해봐요!","exercise_description":"player = \"가위\", computer = \"보\"일 때 가위바위보 결과를 판정하세요. 가위가 보를 이기니까 \"이겼다!\"를 출력!","starter_code":"# 가위바위보 심판이 되어보세요!\nplayer = \"가위\"\ncomputer = \"보\"\n\nif player == computer:\n    print(\"비겼다!\")\nelif player == \"가위\":\n    if computer == \"보\":\n        print()\n    else:\n        print(\"졌다!\")","expected_output_hint":"이겼다! 가 출력되어야 해요","checklist":["안쪽 if 아래 print( ) 안에 \"이겼다!\"를 넣어요","가위와 보일 때 어느 줄이 돌아가는지 따라가 봐요"],"example_output":"이겼다!","example_exact":true,"fallback_text":"if 안에 또 if를 쓸 수 있어요! 가위가 보를 이기니까, player가 가위이고 computer가 보이면 이긴 거예요."}'::jsonb,
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
  '{"topic":"조건문 종합 활용 - 할인 시스템 만들기","learning_goals":["if/elif/else를 활용하여 실용적인 프로그램을 만들 수 있다","여러 조건을 조합하여 복잡한 로직을 구현할 수 있다","변수와 조건문을 함께 사용할 수 있다"],"story_context":"갈림길의 영화관에서 할인 시스템을 만들어야 해요! 나이와 요일에 따라 할인율이 달라져요.","exercise_description":"age=10, is_weekend=False일 때, 어린이(13세 미만) 평일 50% 할인을 적용하여 나이, 할인율, 가격을 출력하세요. 원래 가격은 10000원이에요.","starter_code":"# 영화관 할인 시스템을 만들어보세요!\nage = 10\nis_weekend = False\nprice = 10000\n\n# 어린이(13세 미만)이면 할인!\n# if 문으로 나이와 요일에 따라 discount를 정해보세요!\n\n\n# 최종 가격을 계산하세요!\n# final_price = price * (100 - discount) // 100\n\n# 나이, 할인율, 가격을 출력하세요!\n","expected_output_hint":"나이: 10살, 할인율: 50%, 가격: 5000원 이 각각 출력되어야 해요","checklist":["if 로 13세 미만인지, 평일인지 살펴서 discount 를 정해요","final_price 로 할인된 가격을 구해요","나이·할인율·가격을 한 줄씩 보여 줘요"],"example_output":"나이: 10살\n할인율: 50%\n가격: 5000원","example_exact":true,"fallback_text":"if 안에 또 if를 쓸 수 있어요! 먼저 나이로 어린이인지 확인하고, 그 안에서 평일인지 주말인지 확인해요.","is_challenge":true}'::jsonb,
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
  '{"topic":"for 반복문과 range() 함수","learning_goals":["for 반복문의 구조를 이해한다","range()로 숫자 범위를 만들 수 있다","반복문 안의 코드가 여러 번 실행되는 것을 안다"],"story_context":"동굴 입구에서 마법 숫자를 세어야 문이 열려요! 1부터 5까지 세어볼까요?","exercise_description":"for 반복문과 range()를 사용하여 1부터 5까지 한 줄에 하나씩 출력하세요","starter_code":"# 1부터 5까지 세어보세요!\n# for 반복문과 range()를 사용해보세요!\n\nfor i in range(__, __):\n    print(i)","expected_output_hint":"1, 2, 3, 4, 5가 한 줄씩 출력되어야 해요","checklist":["range( ) 빈칸에 시작 숫자와 끝 숫자를 넣어요","끝 숫자는 하나 더 크게 써요","1부터 5까지 한 줄씩 나오는지 봐요"],"example_output":"1\n2\n3\n4\n5","example_exact":true,"fallback_text":"for i in range(1, 6)은 i가 1, 2, 3, 4, 5로 바뀌면서 아래 코드를 반복해요! range(1, 6)은 1부터 5까지예요 (6은 포함 안 돼요)."}'::jsonb,
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
  '{"topic":"문자열 반복 연산자 *","learning_goals":["* 연산자로 문자열을 반복할 수 있다","print()와 문자열 반복을 조합할 수 있다"],"story_context":"동굴 벽에 별을 새겨야 마법 문이 열려요! 별을 5개 찍어볼까요?","exercise_description":"print(\"*\" * 5)를 사용하여 별 5개를 한 줄로 출력하세요","starter_code":"# 별을 5개 찍어보세요!\n# 힌트: 문자열 * 숫자 = 반복!\n\nprint(\"*\" * ___)","expected_output_hint":"***** 가 출력되어야 해요","checklist":["\"*\" * 뒤 빈칸에 5를 넣어요","별 다섯 개가 한 줄로 나오는지 봐요"],"example_output":"*****","example_exact":true,"fallback_text":"문자열에 * 숫자를 하면 그만큼 반복돼요! \"*\" * 5 = \"*****\" 이에요."}'::jsonb,
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
  '{"topic":"누적 변수와 for 반복문으로 합계 구하기","learning_goals":["누적 변수를 사용하여 값을 더해갈 수 있다","for 반복문과 누적 변수를 조합할 수 있다"],"story_context":"동굴 속 보물 더미! 금화를 하나씩 세어서 총 몇 개인지 합계를 구해봐요!","exercise_description":"1부터 10까지 숫자를 모두 더한 합계를 구하여 출력하세요","starter_code":"# 1부터 10까지 합계를 구해보세요!\ntotal = 0\n\nfor i in range(1, 11):\n    # total에 i를 더해보세요! (힌트: total = total + ?)\n    \n\nprint(total)","expected_output_hint":"55 가 출력되어야 해요 (1+2+3+...+10 = 55)","checklist":["반복 안에서 total = total + i 를 써요","그 줄은 for 안쪽으로 들여 써요","마지막에 total 을 보여 줘요"],"example_output":"55","example_exact":true,"fallback_text":"total = 0으로 시작해서, 반복할 때마다 total = total + i로 숫자를 더해가요! 1+2+3+...+10 = 55예요."}'::jsonb,
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
  '{"topic":"continue로 특정 반복 건너뛰기","learning_goals":["continue가 현재 반복만 건너뛰는 것을 안다","% (나머지) 연산자를 사용할 수 있다","for와 if를 조합하여 필터링할 수 있다"],"story_context":"동굴의 마법 필터! 짝수만 통과시키고 홀수는 막아요.","exercise_description":"1부터 10까지 반복하면서 짝수만 출력하세요 (홀수는 continue로 건너뛰기)","starter_code":"# 짝수만 출력해보세요!\nfor i in range(1, 11):\n    if i % 2 != 0:\n        # 홀수면 건너뛰세요!\n        \n    print(i)","expected_output_hint":"2, 4, 6, 8, 10이 한 줄씩 출력되어야 해요","checklist":["홀수일 때 continue 를 써서 건너뛰어요","짝수만 한 줄씩 나오는지 봐요"],"example_output":"2\n4\n6\n8\n10","example_exact":true,"fallback_text":"% 는 나머지를 구하는 연산자예요! i % 2 != 0은 홀수라는 뜻이에요. continue를 만나면 아래 코드를 건너뛰고 다음 반복으로 가요."}'::jsonb,
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
  '{"topic":"while 반복문으로 감소하며 반복하기","learning_goals":["while 반복문으로 숫자를 줄여가며 반복할 수 있다","감소하는 반복 패턴을 이해한다"],"story_context":"동굴 탈출 카운트다운! 5초 안에 빠져나가야 해요! 5, 4, 3, 2, 1... 탈출!","exercise_description":"while 반복문으로 5부터 1까지 카운트다운을 출력하세요","starter_code":"# 카운트다운을 만들어보세요!\ncount = 5\n\nwhile count >= 1:\n    print(count)\n    # count를 1씩 줄여보세요! ___ 에 알맞은 숫자를 넣어요\n    count = count - ___\n","expected_output_hint":"5, 4, 3, 2, 1이 한 줄씩 출력되어야 해요","checklist":["빈칸 ___ 에 1을 넣어 count 를 하나씩 줄여요","5부터 1까지 한 줄씩 나오는지 봐요"],"example_output":"5\n4\n3\n2\n1","example_exact":true,"fallback_text":"count = 5에서 시작해서, 반복할 때마다 count = count - 1로 1씩 줄여가요. count가 0이 되면 멈춰요!"}'::jsonb,
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
  '{"topic":"for 반복문과 문자열 반복으로 피라미드 만들기","learning_goals":["for 반복문과 문자열 반복(*)을 조합할 수 있다","반복 변수를 활용하여 패턴을 만들 수 있다"],"story_context":"동굴을 탈출하면 별 피라미드를 쌓아야 해요! 반복의 마법으로 피라미드를 완성해봐요!","exercise_description":"for 반복문과 \"*\" * i 를 사용하여 5줄짜리 별 피라미드를 만드세요","starter_code":"# 별 피라미드를 만들어보세요!\n# 1줄: *\n# 2줄: **\n# ...\n# 5줄: *****\n\nfor i in range(1, 6):\n    print()","expected_output_hint":"* 부터 ***** 까지 피라미드가 출력되어야 해요","checklist":["print( ) 안에 \"*\" * i 를 넣어요","줄마다 별이 하나씩 늘어나는지 봐요"],"example_output":"*\n**\n***\n****\n*****","example_exact":true,"fallback_text":"for i in range(1, 6)으로 i가 1, 2, 3, 4, 5가 되면서 \"*\" * i로 별이 1개, 2개, 3개, 4개, 5개 출력돼요!","is_challenge":true}'::jsonb,
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
  '{"topic":"리스트 인덱싱과 슬라이싱","learning_goals":["인덱스 번호로 리스트의 특정 값을 꺼낼 수 있다","인덱스가 0부터 시작하는 것을 안다","슬라이싱으로 리스트의 일부를 잘라낼 수 있다"],"story_context":"보물 목록에서 원하는 보물을 골라내봐요! 몇 번째 보물을 꺼낼까요?","exercise_description":"treasures 리스트에서 인덱스를 사용하여 \"다이아몬드\"를 출력하세요","starter_code":"# 보물 목록에서 다이아몬드를 꺼내보세요!\ntreasures = [\"금화\", \"은화\", \"다이아몬드\", \"루비\"]\nprint(treasures[__])","expected_output_hint":"다이아몬드 가 출력되어야 해요","checklist":["treasures[ ] 빈칸에 다이아몬드의 번호를 넣어요","번호는 0부터 센다는 걸 기억해요"],"example_output":"다이아몬드","example_exact":true,"fallback_text":"리스트의 번호는 0부터 시작해요! treasures[0]은 금화, treasures[1]은 은화, treasures[2]는 다이아몬드예요."}'::jsonb,
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
  '{"topic":"for 반복문으로 리스트 순회하기","learning_goals":["for 반복문으로 리스트의 각 항목을 하나씩 꺼낼 수 있다","리스트 순회의 개념을 이해한다"],"story_context":"리스트 호수에서 색깔 물고기를 하나씩 잡아보아요! for 반복문으로 모든 물고기를 순서대로 만나봐요!","exercise_description":"colors = [\"빨강\", \"초록\", \"파랑\"] 리스트를 for 반복문으로 순회하며 각 색깔을 출력하세요","starter_code":"# 색깔을 하나씩 출력해보세요!\ncolors = [\"빨강\", \"초록\", \"파랑\"]\n\nfor color in colors:\n    # color를 출력해보세요!\n    ","expected_output_hint":"빨강, 초록, 파랑이 한 줄씩 출력되어야 해요","checklist":["for 아래에 print(color)를 써요","그 줄은 네 칸 들여 써요"],"example_output":"빨강\n초록\n파랑","example_exact":true,"fallback_text":"for color in colors: 라고 쓰면 colors 리스트에서 하나씩 꺼내서 color 변수에 넣어줘요! 첫 번째는 빨강, 두 번째는 초록, 세 번째는 파랑이에요."}'::jsonb,
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
  '{"topic":"리스트 정렬하기 sort()","learning_goals":["sort()로 리스트를 오름차순 정렬할 수 있다","정렬 후 리스트가 변경되는 것을 이해한다"],"story_context":"리스트 호수의 숫자 물고기가 뒤죽박죽이에요! sort()로 깔끔하게 정리해봐요!","exercise_description":"numbers = [3, 1, 4, 1, 5]를 sort()로 정렬한 후 출력하세요","starter_code":"# 숫자를 정렬해보세요!\nnumbers = [3, 1, 4, 1, 5]\n\n# sort()로 정렬하세요!\n\nprint(numbers)","expected_output_hint":"[1, 1, 3, 4, 5] 가 출력되어야 해요","checklist":["numbers.sort( )로 작은 수부터 줄 세워요","print(numbers)로 보여 줘요"],"example_output":"[1, 1, 3, 4, 5]","example_exact":true,"fallback_text":"sort()는 리스트를 작은 수부터 큰 수 순서로 정리해줘요! numbers.sort() 이렇게 쓰면 돼요."}'::jsonb,
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
  '{"topic":"in 연산자로 리스트에서 값 찾기","learning_goals":["in 연산자로 리스트에 특정 값이 있는지 확인할 수 있다","in의 결과가 True/False임을 이해한다"],"story_context":"리스트 호수의 과일 바구니에서 바나나를 찾아봐요! in 마법으로 있는지 확인할 수 있어요!","exercise_description":"fruits 리스트에 \"바나나\"가 있는지 in 연산자로 확인하고 결과를 출력하세요","starter_code":"# 바나나가 있는지 찾아보세요!\nfruits = [\"사과\", \"바나나\", \"포도\"]\n\n# in 연산자로 \"바나나\"가 fruits에 있는지 확인해서 result에 저장하세요!\nresult = \nprint(result)","expected_output_hint":"True 가 출력되어야 해요","checklist":["result 에 \"바나나\" in fruits 를 넣어요","print(result)로 True 인지 False 인지 봐요"],"example_output":"True","example_exact":true,"fallback_text":"in 연산자는 리스트에 값이 있는지 확인해요! \"바나나\" in fruits는 바나나가 fruits에 있으면 True, 없으면 False를 돌려줘요."}'::jsonb,
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
  '{"topic":"리스트 종합 활용 - 쇼핑 리스트 만들기","learning_goals":["빈 리스트를 만들고 append()로 항목을 추가할 수 있다","sort()로 리스트를 정렬할 수 있다","for 반복문으로 리스트를 순회하여 출력할 수 있다","len()으로 항목 수를 세어 출력할 수 있다"],"story_context":"리스트 호수에서 마지막 시험! 쇼핑 리스트를 만들고, 정리하고, 예쁘게 출력해봐요!","exercise_description":"빈 리스트를 만들고, 우유/주스/과자를 append하고, sort()로 정렬한 후, for로 순회 출력하세요","starter_code":"# 쇼핑 리스트를 만들어보세요!\nshopping = []\n\n# 3개 항목을 추가하세요! (append 사용)\n\n\n# 정렬하세요! (sort 사용)\n\n\n# 출력하세요!\nprint(\"--- 쇼핑 목록 ---\")\nfor item in shopping:\n    print(item)\nprint(\"총 \" + str(len(shopping)) + \"개\")","expected_output_hint":"쇼핑 목록이 정렬되어 출력되어야 해요","checklist":["append( )로 우유·주스·과자를 하나씩 더해요","sort( )로 가나다 순서로 줄 세워요","목록과 총 개수가 나오는지 봐요"],"example_output":"--- 쇼핑 목록 ---\n과자\n우유\n주스\n총 3개","example_exact":true,"fallback_text":"빈 리스트 []를 만들고, append()로 항목을 추가하고, sort()로 정렬한 뒤, for로 하나씩 출력해요!","is_challenge":true}'::jsonb,
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
  '{"topic":"함수 정의(def)와 호출","learning_goals":["def 키워드로 함수를 만들 수 있다","만든 함수를 호출하여 실행할 수 있다","함수가 코드를 묶어서 재사용하는 것임을 이해한다"],"story_context":"탑의 마법사에게 인사 마법을 배워요! 한 번 만들면 여러 번 사용할 수 있어요.","exercise_description":"greet라는 함수를 만들어 \"안녕! 나는 파이뱀이야!\"를 출력하고, 함수를 호출하세요","starter_code":"# 인사하는 함수를 만들어보세요!\ndef greet():\n    # \"안녕! 나는 파이뱀이야!\"를 출력하세요!\n    \n\ngreet()","expected_output_hint":"안녕! 나는 파이뱀이야! 가 출력되어야 해요","checklist":["def greet( ) 안에 print( )를 들여 써요","\"안녕! 나는 파이뱀이야!\"를 넣어요","greet( )을 불러서 인사가 나오는지 봐요"],"example_output":"안녕! 나는 파이뱀이야!","example_exact":true,"fallback_text":"def greet(): 으로 함수를 만들고, 안에 실행할 코드를 쓴 뒤, greet()으로 호출해요! 함수는 코드를 묶어놓은 마법 주문서예요."}'::jsonb,
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
  '{"topic":"매개변수와 return으로 값 돌려주기","learning_goals":["함수에 매개변수로 값을 전달할 수 있다","return으로 함수가 결과를 돌려주는 것을 이해한다"],"story_context":"탑의 마법 계산기! 두 숫자를 넣으면 합계를 알려줘요.","exercise_description":"add라는 함수를 만들어 두 숫자를 받아 합계를 return하고, add(7, 8)의 결과를 출력하세요","starter_code":"# 두 숫자를 더하는 함수를 만들어보세요!\ndef add(a, b):\n    # 두 숫자를 더한 결과를 return 하세요!\n    \n\nresult = add(7, 8)\nprint(result)","expected_output_hint":"15 가 출력되어야 해요","checklist":["add 안에서 return a + b 를 써요","add(7, 8)의 결과가 나오는지 봐요"],"example_output":"15","example_exact":true,"fallback_text":"매개변수는 함수에 전달하는 값이에요! def add(a, b): 에서 a, b가 매개변수이고, return a + b로 합계를 돌려줘요."}'::jsonb,
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
  '{"topic":"기본 매개변수 (default parameter)","learning_goals":["함수의 매개변수에 기본값을 설정할 수 있다","기본값이 있으면 인자를 생략할 수 있음을 이해한다"],"story_context":"함수의 탑에서 인사 마법을 업그레이드! 이름을 안 말해도 기본 인사를 해줘요!","exercise_description":"def greet(name=\"친구\") 함수를 만들고, greet()과 greet(\"파이뱀\")을 각각 호출하세요","starter_code":"# 기본값이 있는 함수를 만들어보세요!\ndef greet(name=\"친구\"):\n    # \"안녕, \" + name + \"!\" 를 출력하세요!\n    \n\n# 이름 없이 한 번, 이름을 넣어서 한 번, 총 두 번 호출해보세요!\n","expected_output_hint":"안녕, 친구! 와 안녕, 파이뱀! 이 각각 출력되어야 해요","checklist":["greet 안에서 \"안녕, \" + name + \"!\"를 보여 줘요","greet( )을 이름 없이 한 번 불러요","greet(\"파이뱀\")으로 한 번 더 불러요"],"example_output":"안녕, 친구!\n안녕, 파이뱀!","example_exact":true,"fallback_text":"매개변수에 = 으로 기본값을 넣으면, 호출할 때 값을 안 넣어도 기본값이 사용돼요! def greet(name=\"친구\"): 에서 greet()은 \"친구\"가, greet(\"파이뱀\")은 \"파이뱀\"이 name에 들어가요."}'::jsonb,
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
  '{"topic":"파이썬 내장함수 max()와 min()","learning_goals":["max()로 가장 큰 값을 찾을 수 있다","min()로 가장 작은 값을 찾을 수 있다","파이썬에 이미 만들어진 함수가 있다는 것을 안다"],"story_context":"탑 꼭대기에서 마법 숫자들 중 가장 큰 숫자를 찾는 시험! 파이썬의 내장함수를 사용해봐요.","exercise_description":"numbers 리스트에서 max()를 사용하여 가장 큰 수를 출력하세요","starter_code":"# 가장 큰 수를 찾아보세요!\nnumbers = [3, 7, 1, 9, 4]\nbiggest = \nprint(biggest)","expected_output_hint":"9 가 출력되어야 해요","checklist":["biggest 에 max(numbers)를 넣어요","가장 큰 수가 나오는지 봐요"],"example_output":"9","example_exact":true,"fallback_text":"max()는 가장 큰 값을 찾아주는 내장함수예요! max([3, 7, 1, 9, 4])는 9를 돌려줘요. min()은 반대로 가장 작은 값을 찾아줘요."}'::jsonb,
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
  '{"topic":"함수에서 여러 값 돌려주기 (튜플)","learning_goals":["함수에서 여러 값을 return할 수 있다","return된 여러 값을 각각 변수에 받을 수 있다"],"story_context":"함수의 탑에서 마법 분석기를 만들어요! 숫자 중 가장 작은 것과 가장 큰 것을 동시에 알려줘요!","exercise_description":"def min_max(a, b, c) 함수를 만들어 가장 작은 값과 가장 큰 값을 return하세요. min_max(1, 9, 5)를 호출하여 결과를 출력!","starter_code":"# 최소값과 최대값을 동시에 돌려주는 함수!\ndef min_max(a, b, c):\n    smallest = min(a, b, c)\n    biggest = max(a, b, c)\n    # smallest와 biggest를 동시에 return 하세요! (쉼표로 구분)\n    \n\nsmall, big = min_max(1, 9, 5)\nprint(small)\nprint(big)","expected_output_hint":"1과 9가 각각 한 줄씩 출력되어야 해요","checklist":["return 뒤에 smallest, biggest 를 쉼표로 이어 써요","작은 수와 큰 수가 한 줄씩 나오는지 봐요"],"example_output":"1\n9","example_exact":true,"fallback_text":"return 뒤에 쉼표로 여러 값을 쓰면 한 번에 돌려줄 수 있어요! small, big = min_max(1, 9, 5) 이렇게 받으면 돼요."}'::jsonb,
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
  '{"topic":"함수 조합 (함수의 결과를 다른 함수에 전달)","learning_goals":["함수의 return 값을 다른 함수의 인자로 전달할 수 있다","함수를 조합하여 복잡한 계산을 할 수 있다"],"story_context":"함수의 탑에서 마법을 합쳐볼까요? 두 배로 만드는 마법과 하나 더하는 마법을 합치면 어떻게 될까요?","exercise_description":"double(x)은 x를 2배로, add_one(x)은 x에 1을 더하는 함수를 만들고, add_one(double(3))을 호출하세요","starter_code":"# 두 함수를 만들고 합쳐보세요!\ndef double(x):\n    return x * 2\n\ndef add_one(x):\n    return x + 1\n\n# double(3)의 결과에 add_one을 적용해서 result에 저장하세요!\nresult = \nprint(result)","expected_output_hint":"7 이 출력되어야 해요 (3*2=6, 6+1=7)","checklist":["double(3)을 add_one( ) 안에 넣어요","그 결과를 result 에 넣고 보여 줘요"],"example_output":"7","example_exact":true,"fallback_text":"double(3)은 6을 돌려주고, add_one(6)은 7을 돌려줘요! 함수의 결과를 다른 함수에 바로 넣을 수 있어요."}'::jsonb,
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
  '{"topic":"함수 종합 활용 - 성적 분석 프로그램","learning_goals":["여러 함수를 만들어 역할을 분담할 수 있다","함수의 return 값을 다른 함수에서 활용할 수 있다","함수를 조합하여 실용적인 프로그램을 만들 수 있다"],"story_context":"함수의 탑 마지막 시험! 배운 함수 마법을 모두 써서 성적 분석 프로그램을 완성해봐요!","exercise_description":"average 함수(3과목 평균)와 grade 함수(평균으로 등급 판정)를 만들어 성적을 분석하세요. 점수: 80, 90, 85","starter_code":"# 성적 분석 프로그램을 만들어보세요!\ndef average(a, b, c):\n    # 세 과목의 평균을 구해서 return 하세요!\n    \n\ndef grade(avg):\n    # 90 이상 \"A\", 80 이상 \"B\", 70 이상 \"C\", 나머지 \"D\"\n    \n\n# 3과목 점수\navg = average(80, 90, 85)\ng = grade(avg)\n\nprint(\"평균: \" + str(avg))\nprint(\"등급: \" + g)","expected_output_hint":"평균: 85.0 과 등급: B 가 출력되어야 해요","checklist":["average 에서 세 점수를 더해 3으로 나눠 return 해요","grade 에서 if·elif·else 로 등급을 return 해요","평균과 등급이 한 줄씩 나오는지 봐요"],"example_output":"평균: 85.0\n등급: B","example_exact":true,"fallback_text":"average 함수로 평균을 구하고, grade 함수로 등급을 판정해요! 두 함수를 조합하면 성적 분석 프로그램이 완성돼요.","is_challenge":true}'::jsonb,
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

-- 퀘스트 1-1: 반짝 이름표
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  1,
  '반짝 이름표',
  'f-string',
  'code',
  NULL,
  FALSE,
  '{"topic":"f-string으로 글자 안에 변수 넣기","learning_goals":["따옴표 앞에 f를 붙여 f-string을 만들 수 있다","{ } 안에 변수 이름을 넣어 값을 글자 속에 끼워 넣을 수 있다"],"story_context":"코드 바다의 첫 섬, 산호 문자열 공방에 도착했어요! 공방 문에 걸 반짝 이름표를 만들어 볼까요? 파이뱀이 새 주문 f-string을 알려 줄 거예요.","exercise_description":"name과 age 변수를 f-string에 넣어 \"이름: 바다\"와 \"바다는 10살\" 두 줄을 출력하세요","starter_code":"# 반짝 이름표를 만들어요!\nname = \"바다\"\nage = 10\n\n# 따옴표 앞에 f 를 붙이면 { } 안에 변수를 넣을 수 있어요\nprint(f\"이름: {name}\")\n\n# 아래 줄도 f-string 으로 바꿔서 \"바다는 10살\"이 나오게 해요\nprint(\"___는 ___살\")\n","expected_output_hint":"이름: 바다 와 바다는 10살 두 줄이 나와야 해요","checklist":["둘째 print 의 따옴표 앞에 f 를 붙여요","___ 자리에 {name} 과 {age} 를 넣어요","바다는 10살 이 나오는지 봐요"],"example_output":"이름: 바다\n바다는 10살","example_exact":true,"fallback_text":"f-string은 따옴표 앞에 f를 붙인 글자예요. f\"{name}는 {age}살\"처럼 쓰면 { } 자리에 변수 값이 쏙 들어가요. 숫자 age도 str() 없이 바로 넣을 수 있어요!"}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-2: 글자 상자 꺼내기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000001',
  2,
  '글자 상자 꺼내기',
  '인덱스, 음수 인덱스, len()',
  'code',
  NULL,
  FALSE,
  '{"topic":"글자 번호(인덱스)로 글자 꺼내기","learning_goals":["글자의 자리 번호가 0부터 시작한다는 것을 안다","[-1]로 맨 끝 글자를 꺼낼 수 있다","len()으로 글자 수를 세고, for로 한 글자씩 꺼낼 수 있다"],"story_context":"공방 선반에 OCEAN 글자 상자가 놓여 있어요. 글자마다 자리 번호가 붙어 있대요. 상자에서 글자를 하나씩 꺼내 볼까요?","exercise_description":"word = \"OCEAN\" 에서 첫 글자, 마지막 글자([-1]), 글자 수를 출력하고, for로 한 글자씩 한 줄에 하나씩 출력하세요","starter_code":"word = \"OCEAN\"\n\n# 글자 번호는 0부터 세요. 맨 끝 글자는 -1 번이에요\nprint(f\"첫 글자: {word[0]}\")\nprint(f\"마지막 글자: {word[___]}\")\nprint(f\"글자 수: {___}\")\n\n# for 로 한 글자씩 꺼내 한 줄에 하나씩 보여 줘요\nfor letter in word:\n    print(___)\n","expected_output_hint":"첫 글자: O, 마지막 글자: N, 글자 수: 5 다음에 O C E A N 이 한 줄에 하나씩 나와야 해요","checklist":["마지막 글자 번호에 -1 을 넣어요","글자 수는 len(word) 로 세요","for 안에서 letter 를 보여 줘요"],"example_output":"첫 글자: O\n마지막 글자: N\n글자 수: 5\nO\nC\nE\nA\nN","example_exact":true,"fallback_text":"글자도 리스트처럼 자리 번호가 있어요. word[0]은 첫 글자, word[-1]은 맨 끝 글자예요. len(word)는 글자 수를 세고, for letter in word: 는 글자를 하나씩 꺼내 줘요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-3: 조개 도장 세기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000003',
  'a2000000-0000-0000-0000-000000000001',
  3,
  '조개 도장 세기',
  '글자 돌며 세기',
  'code',
  NULL,
  FALSE,
  '{"topic":"for로 글자를 돌며 if로 세기","learning_goals":["for로 글자를 하나씩 돌 수 있다","if로 원하는 글자를 만날 때마다 수를 늘릴 수 있다"],"story_context":"버그버그가 간판 banana boat 곳곳에 조개 도장을 찍어 놨어요. a 글자마다 도장이 하나씩 있대요. 도장이 모두 몇 개인지 세어 봐요!","exercise_description":"text = \"banana boat\" 를 for로 한 글자씩 돌며, 글자가 \"a\" 일 때마다 count를 1씩 늘려 \"a는 4번\"을 출력하세요","starter_code":"text = \"banana boat\"\ncount = 0\n\nfor letter in text:\n    # letter 가 \"a\" 이면 count 를 1 늘려요\n    ___\n\nprint(f\"a는 {count}번\")\n","expected_output_hint":"a는 4번 이 나와야 해요","checklist":["for 안에 if letter == \"a\": 를 써요","if 안에서 count = count + 1 로 하나 늘려요","a는 4번 이 나오는지 봐요"],"example_output":"a는 4번","example_exact":true,"fallback_text":"세기는 상자 count 를 0으로 두고, 원하는 글자를 만날 때마다 1씩 더하는 거예요. for letter in text: 안에 if letter == \"a\": 를 넣고 그 안에서 count = count + 1 을 해요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-4: 글자 리본 자르기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000004',
  'a2000000-0000-0000-0000-000000000001',
  4,
  '글자 리본 자르기',
  '슬라이싱',
  'code',
  NULL,
  FALSE,
  '{"topic":"[시작:끝]으로 글자 잘라 내기","learning_goals":["[시작:끝]으로 글자의 한 부분을 잘라 낼 수 있다","끝 번호 글자는 잘라 낸 조각에 들어가지 않는다는 것을 안다"],"story_context":"공방에 starfish 글자 리본이 길게 걸려 있어요. 가위로 싹둑 잘라서 star 리본과 fish 리본 두 개로 나눠 볼까요?","exercise_description":"word = \"starfish\" 를 [시작:끝]으로 잘라 star 와 fish 를 한 줄씩 출력하세요","starter_code":"word = \"starfish\"\n\n# [시작:끝] 으로 잘라요. 끝 번호 글자는 들어가지 않아요\n# s  t  a  r  f  i  s  h\n# 0  1  2  3  4  5  6  7\nfront = word[0:___]\nback = word[___:]\n\nprint(front)\nprint(back)\n","expected_output_hint":"star 와 fish 가 한 줄씩 나와야 해요","checklist":["front 는 0번부터 4번 앞까지 잘라요","back 은 4번부터 끝까지 잘라요","star 와 fish 가 나오는지 봐요"],"example_output":"star\nfish","example_exact":true,"fallback_text":"word[0:4]는 0번부터 4번 바로 앞(3번)까지 잘라요. 그래서 s t a r 네 글자예요. 끝 번호를 비우면 word[4:]처럼 끝까지 잘라요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-5: 리본 조각 맞히기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000005',
  'a2000000-0000-0000-0000-000000000001',
  5,
  '리본 조각 맞히기',
  '슬라이싱',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"슬라이싱 결과 맞히기","learning_goals":["슬라이싱의 시작 번호는 들어가고 끝 번호는 빠진다는 것을 안다"],"story_context":"버그버그가 리본을 몰래 잘라 갔어요! 남은 코드를 보고 잘라 간 조각이 어떤 글자인지 맞혀 봐요.","fallback_text":"글자 번호는 0부터 세요. [시작:끝]으로 자르면 시작 번호 글자는 들어가고, 끝 번호 글자는 빠져요. 번호를 글자 아래에 하나씩 적어 보세요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"word = \"dolphin\"\nprint(word[1:4])","options":[{"id":"opt-b9tn","text":"dol"},{"id":"opt-m7cs","text":"olph"},{"id":"opt-r4ka","text":"olp"},{"id":"opt-x2pe","text":"dolp"}]}}'::jsonb,
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

-- 퀘스트 1-6: 크게! 작게! 바꿔!
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000006',
  'a2000000-0000-0000-0000-000000000001',
  6,
  '크게! 작게! 바꿔!',
  'upper(), replace()',
  'code',
  NULL,
  FALSE,
  '{"topic":"글자 메서드 upper()와 replace()","learning_goals":["값 뒤에 점(.)을 찍고 메서드를 부를 수 있다","upper()로 영어를 대문자로 바꿀 수 있다","replace()로 낱말을 다른 낱말로 바꿀 수 있다"],"story_context":"공방 간판에 \"i love the lake\"라고 쓰여 있어요. 여긴 호수가 아니라 바다인데! 간판을 크게 외치고, lake 를 sea 로 고쳐 줘요.","exercise_description":"spell = \"i love the lake\" 를 upper()로 대문자로 한 줄, replace()로 lake 를 sea 로 바꿔 한 줄 출력하세요","starter_code":"spell = \"i love the lake\"\n\n# 메서드는 값 뒤에 점(.)을 찍고 불러요\nprint(spell.___())\nprint(spell.replace(\"___\", \"___\"))\n","expected_output_hint":"I LOVE THE LAKE 와 i love the sea 가 한 줄씩 나와야 해요","checklist":["첫째 줄 빈칸에 upper 를 넣어요","replace(\"바꿀 낱말\", \"새 낱말\")에 lake 와 sea 를 넣어요","두 줄이 나오는지 봐요"],"example_output":"I LOVE THE LAKE\ni love the sea","example_exact":true,"fallback_text":"메서드는 값 뒤에 점(.)을 찍고 부르는 그 값 전용 함수예요. spell.upper()는 모두 대문자로, spell.replace(\"lake\", \"sea\")는 lake 를 sea 로 바꾼 새 글자를 돌려줘요. lower()는 반대로 소문자로 바꿔요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-7: 공방 도구 빈칸
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000007',
  'a2000000-0000-0000-0000-000000000001',
  7,
  '공방 도구 빈칸',
  '글자 메서드',
  'quiz',
  'fill_blank',
  TRUE,
  '{"topic":"글자 메서드 고르기","learning_goals":["글자를 대문자로 바꾸는 메서드, 낱말을 바꾸는 메서드, 글자를 쪼개는 메서드를 고를 수 있다"],"story_context":"공방 벽에 글자 도구가 걸려 있어요. 알맞은 도구를 골라 인사말을 크게 외치고, 낱말을 바꾸고, 쪼개 봐요.","fallback_text":"도구마다 하는 일이 달라요. 크게 만드는 도구, 낱말을 바꾸는 도구, 기준 글자로 잘라 리스트를 만드는 도구를 떠올려 보세요.","quiz":{"kind":"fill_blank","question":"빈칸을 채워 인사말을 크게 외치고, hi 를 bye 로 바꾸고, 띄어쓰기마다 쪼개요","code":"spell = \"hi sea\"\nprint(spell.{{bk-u4wa}}())\nprint(spell.{{bk-r8ne}}(\"hi\", \"bye\"))\nprint(spell.{{bk-s2ko}}(\" \"))","tokens":[{"id":"tok-c8ze","text":"replace"},{"id":"tok-h1mu","text":"join"},{"id":"tok-k3vy","text":"split"},{"id":"tok-p5qa","text":"upper"},{"id":"tok-w7gi","text":"lower"}]}}'::jsonb,
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

-- 퀘스트 1-8: 조개 목걸이 꿰기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000008',
  'a2000000-0000-0000-0000-000000000001',
  8,
  '조개 목걸이 꿰기',
  'split(), join()',
  'code',
  NULL,
  FALSE,
  '{"topic":"split()으로 쪼개고 join()으로 잇기","learning_goals":["split()으로 글자를 기준 글자마다 쪼개 리스트를 만들 수 있다","join()으로 리스트를 하나의 글자로 이어 붙일 수 있다"],"story_context":"바닷가에서 주운 구슬 이름이 \"진주,소라,조개\"로 한 줄에 붙어 있어요. 하나씩 떼어 세어 보고, 예쁜 목걸이로 다시 꿰어 볼까요?","exercise_description":"shells = \"진주,소라,조개\" 를 split(\",\")로 쪼개 구슬 수를 출력하고, \" - \".join()으로 이어 목걸이를 출력하세요","starter_code":"shells = \"진주,소라,조개\"\n\n# 쉼표(,)를 기준으로 쪼개면 리스트가 돼요\nbeads = shells.split(___)\nprint(f\"구슬 {len(beads)}개\")\n\n# \" - \" 로 구슬을 이어 목걸이를 꿰어요\nnecklace = ___\nprint(necklace)\n","expected_output_hint":"구슬 3개 와 진주 - 소라 - 조개 가 한 줄씩 나와야 해요","checklist":["split( ) 안에 쉼표 \",\" 를 넣어요","necklace 에 \" - \".join(beads) 를 넣어요","구슬 사이에 - 가 들어갔는지 봐요"],"example_output":"구슬 3개\n진주 - 소라 - 조개","example_exact":true,"fallback_text":"shells.split(\",\")은 쉼표마다 잘라 [\"진주\", \"소라\", \"조개\"] 리스트를 만들어요. \" - \".join(리스트)는 반대로 리스트 사이사이에 \" - \"를 끼워 하나의 글자로 이어요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-9: 이름표가 이상해
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000009',
  'a2000000-0000-0000-0000-000000000001',
  9,
  '이름표가 이상해',
  'f-string',
  'quiz',
  'bug_hunt',
  TRUE,
  '{"topic":"f-string 버그 찾기","learning_goals":["f를 빠뜨리면 중괄호가 글자 그대로 나온다는 것을 안다"],"story_context":"버그버그가 이름표 주문에서 글자 하나를 훔쳐 갔어요! 이름표에 바다는 10살 대신 이상한 글자가 나와요.","fallback_text":"중괄호 안에 변수 이름을 넣어 값을 끼우려면 따옴표 앞에 꼭 붙여야 하는 글자가 있어요. 반짝 이름표 퀘스트를 떠올려 보세요.","quiz":{"kind":"bug_hunt","question":"바다는 10살 이 나와야 하는데 중괄호가 그대로 나와요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-d3wq","code":"name = \"바다\""},{"id":"ln-t8ox","code":"age = 10"},{"id":"ln-g5mj","code":"print(\"{name}는 {age}살\")"}],"fixes":[{"id":"fx-a6vk","code":"print(\"f{name}는 {age}살\")"},{"id":"fx-e4hs","code":"print(\"name는 age살\")"},{"id":"fx-n2ry","code":"print(f\"{name}는 {age}살\")"},{"id":"fx-q9ul","code":"print(name + \"는 \" + age + \"살\")"}]}}'::jsonb,
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

-- 퀘스트 1-10: 비밀 암호 만들기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000010',
  'a2000000-0000-0000-0000-000000000001',
  10,
  '비밀 암호 만들기',
  'index(), % 돌아가기',
  'code',
  NULL,
  FALSE,
  '{"topic":"글자를 세 칸씩 밀어 암호 만들기","learning_goals":["index()로 글자의 자리 번호를 찾을 수 있다","% 26으로 z 다음에 다시 a로 돌아오게 할 수 있다","반복하며 새 글자를 한 글자씩 붙여 만들 수 있다"],"story_context":"공방 주인이 버그버그 몰래 비밀 쪽지를 보내고 싶대요. 알파벳을 세 칸씩 밀면 아무도 못 읽는 암호가 돼요! python 을 암호로 바꿔 볼까요?","exercise_description":"word = \"python\" 의 글자마다 abc.index()로 번호를 찾고, 3칸 민 번호를 % 26으로 돌려 새 글자를 붙여 \"암호: sbwkrq\"를 출력하세요","starter_code":"abc = \"abcdefghijklmnopqrstuvwxyz\"\nword = \"python\"\nsecret = \"\"\n\nfor ch in word:\n    num = abc.index(ch)    # 이 글자가 abc 에서 몇 번인지 찾아요\n    # 3칸 밀어요. z 를 넘어가면 % 26 으로 a 쪽으로 돌아와요\n    new_num = ___\n    secret = secret + abc[new_num]\n\nprint(f\"암호: {secret}\")\n","expected_output_hint":"암호: sbwkrq 가 나와야 해요","checklist":["new_num 에 num 보다 3 큰 수를 넣어요","% 26 으로 z 다음은 a 로 돌아오게 해요","y 가 b 로 바뀌었는지 봐요"],"example_output":"암호: sbwkrq","example_exact":true,"fallback_text":"p는 15번이라 3칸 밀면 18번 s가 돼요. 그런데 y는 24번이라 3칸 밀면 27번, abc에 없는 번호예요! (24 + 3) % 26 은 1이라서 b로 돌아와요. 시계가 12 다음에 1로 돌아오는 것과 같아요.","is_challenge":true}'::jsonb,
  'all',
  '',
  120
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 1-11: 글자 뒤섞기 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000201',
  'a2000000-0000-0000-0000-000000000001',
  11,
  '글자 뒤섞기 버그버그',
  '문자열 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"글자 번호, 자르기, 바꾸기 메서드, f-string, 암호 총정리","learning_goals":["글자 번호와 자르기로 원하는 글자를 꺼낼 수 있다","replace, upper 같은 메서드를 알맞게 고를 수 있다","끝 글자에서 처음으로 돌아오는 암호의 버그를 고칠 수 있다"],"story_context":"산호 공방의 간판을 거의 다 고쳤을 때, 망치를 든 버그버그가 공방 지붕에서 폴짝 뛰어내렸어요! 글자를 몽땅 뒤섞는 게 제일 좋대요. 공방에서 배운 글자 주문으로 버그버그를 이겨 봐요!","fallback_text":"글자 번호는 0부터 세고, -1은 맨 끝 글자예요. 자르기 [시작:끝]에서 끝 번호 글자는 들어가지 않아요. 메서드는 글자 뒤에 점을 찍고 불러요. 암호에서 끝까지 가면 나머지(%)로 처음으로 돌아와요.","boss":{"name":"글자 뒤섞기 버그버그","look":"workshop","intro":"히히, 나는 글자 뒤섞기 버그버그! 간판 글자를 다 뒤섞어 놨지롱. 다섯 문제를 풀면 돌려줄게!","on_defeat":"으앗, 글자가 다 제자리로 돌아갔어! 너 글자 다루는 솜씨가 진짜 좋구나. 다음 섬 등대 도서관에는 이름표가 잔뜩 있대!","on_victory":"헤헤, 글자가 아직 뒤죽박죽이야. 글자 번호는 0부터 센다는 걸 떠올리고 다시 와!","rounds":[{"kind":"multiple_choice","question":"버그버그가 간판에서 글자 두 개를 떼어 갔어요. 돌리면 무엇이 나올까?","code":"word = \"CORAL\"\nprint(word[0] + word[-1])","options":[{"id":"opt-c4lq","text":"CL"},{"id":"opt-k6wn","text":"C L"},{"id":"opt-r8az","text":"CA"},{"id":"opt-y2om","text":"OL"}]},{"kind":"multiple_choice","question":"글자 리본을 잘라요. 돌리면 무엇이 나올까?","code":"word = \"seahorse\"\nprint(word[3:8])","options":[{"id":"opt-d9fi","text":"ahorse"},{"id":"opt-h5rs","text":"horse"},{"id":"opt-m3pk","text":"hors"},{"id":"opt-u7ea","text":"ahors"}]},{"kind":"fill_blank","question":"빈칸을 채워 bug 를 fish 로 바꾸고, 간판을 큰 글자로 보여 줘요","code":"sign = \"bug shop\"\nsign = sign.{{bk-t3wa}}(\"bug\", \"fish\")\nprint(sign.{{bk-g7nc}}())","tokens":[{"id":"tok-e6ku","text":"upper"},{"id":"tok-p2vx","text":"replace"},{"id":"tok-q8hy","text":"split"},{"id":"tok-z4mr","text":"lower"}]},{"kind":"bug_hunt","question":"z 를 한 칸 밀면 맨 앞으로 돌아와 a 가 나와야 하는데, 코드가 멈춰요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-f6sb","code":"abc = \"abcdefghijklmnopqrstuvwxyz\""},{"id":"ln-n2jx","code":"ch = \"z\""},{"id":"ln-v9dq","code":"n = abc.index(ch)"},{"id":"ln-k4ze","code":"print(abc[n + 1])"}],"fixes":[{"id":"fx-b8te","code":"print(abc[n + 1 % 26])"},{"id":"fx-j3oc","code":"print(abc[n - 1])"},{"id":"fx-s7yl","code":"print(abc[(n + 1) % 25])"},{"id":"fx-w5ma","code":"print(abc[(n + 1) % 26])"}]},{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 조개 목걸이를 쪼개 하나씩 이름표를 달아요","lines":[{"id":"ln-d4oy","code":"print(f\"{name}의 {s}\")"},{"id":"ln-h2cw","code":"shells = \"진주,소라\""},{"id":"ln-u5gr","code":"name = \"파이뱀\""},{"id":"ln-x8ma","code":"for s in shells.split(\",\"):"}],"indent":true}],"review_quests":["b2000000-0000-0000-0000-000000000002","b2000000-0000-0000-0000-000000000004","b2000000-0000-0000-0000-000000000006","b2000000-0000-0000-0000-000000000010","b2000000-0000-0000-0000-000000000008"]}}'::jsonb,
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

-- 퀘스트 2-1: 책 이름표 붙이기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000011',
  'a2000000-0000-0000-0000-000000000002',
  1,
  '책 이름표 붙이기',
  '딕셔너리 만들기, 키로 꺼내기',
  'code',
  NULL,
  FALSE,
  '{"topic":"딕셔너리 만들고 키로 값 꺼내기","learning_goals":["{키: 값} 모양으로 딕셔너리를 만들 수 있다","딕셔너리[키]로 값을 꺼낼 수 있다"],"story_context":"등대 도서관에 왔어요! 버그버그가 책 이름표를 몽땅 떼어 갔대요. 파이뱀이 말해요. \"딕셔너리는 이름표 붙은 조개 상자야!\" 첫 책에 이름표를 붙여 줘요.","exercise_description":"book 딕셔너리에 \"제목\"은 \"바다 탐험\", \"쪽수\"는 120을 넣고, 키로 꺼내 제목과 쪽수를 출력하세요","starter_code":"# 책 이름표를 붙여요: { \"이름표\": 내용, \"이름표\": 내용 }\nbook = {\"제목\": \"바다 탐험\", \"쪽수\": ___}\n\n# 딕셔너리[이름표] 로 내용을 꺼내요\ntitle = book[\"제목\"]\npages = ___\n\nprint(f\"제목: {title}\")\nprint(f\"쪽수: {pages}쪽\")\n","expected_output_hint":"제목: 바다 탐험 과 쪽수: 120쪽 이 한 줄씩 나와야 해요","checklist":["\"쪽수\" 이름표에 120 을 넣어요","pages 에 book[\"쪽수\"] 를 넣어요","두 줄이 나오는지 봐요"],"example_output":"제목: 바다 탐험\n쪽수: 120쪽","example_exact":true,"fallback_text":"딕셔너리는 {키: 값} 짝을 쉼표로 이어 담아요. 리스트는 번호로 꺼내지만, 딕셔너리는 book[\"제목\"]처럼 이름표(키)로 꺼내요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-2: 책 빌리기 기록장
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000012',
  'a2000000-0000-0000-0000-000000000002',
  2,
  '책 빌리기 기록장',
  '딕셔너리 값 추가·수정, len()',
  'code',
  NULL,
  FALSE,
  '{"topic":"딕셔너리에 이름표 더하고 내용 고치기","learning_goals":["딕셔너리[새 키] = 값 으로 이름표를 더할 수 있다","딕셔너리[있는 키] = 값 으로 내용을 고칠 수 있다","len()으로 이름표 수를 셀 수 있다"],"story_context":"하늘이가 바다 탐험 책을 빌려 간대요. 기록장에 빌린 사람을 적어 줘요. 그런데 쪽수도 잘못 적혀 있네요! 버그버그의 장난인가 봐요.","exercise_description":"book 에 \"빌린 사람\" 이름표를 새로 붙여 \"하늘\"을 넣고, \"쪽수\"를 130으로 고친 뒤 book 과 이름표 수를 출력하세요","starter_code":"book = {\"제목\": \"바다 탐험\", \"쪽수\": 120}\n\n# 1) \"빌린 사람\" 이름표를 새로 붙여 \"하늘\"을 넣어요\n\n# 2) \"쪽수\"를 130 으로 고쳐요\n\nprint(book)\nprint(f\"이름표 수: {len(book)}\")\n","expected_output_hint":"book 안에 빌린 사람 하늘과 쪽수 130이 보이고, 이름표 수: 3 이 나와야 해요","checklist":["book[\"빌린 사람\"] = \"하늘\" 을 써요","book[\"쪽수\"] = 130 으로 고쳐요","이름표 수가 3 인지 봐요"],"example_output":"{''제목'': ''바다 탐험'', ''쪽수'': 130, ''빌린 사람'': ''하늘''}\n이름표 수: 3","example_exact":true,"fallback_text":"없는 이름표에 book[\"빌린 사람\"] = \"하늘\" 하고 넣으면 새 이름표가 붙어요. 있는 이름표에 넣으면 내용이 바뀌어요. 이름표는 한 상자에 하나뿐이라서, 같은 이름표가 둘이 되지 않아요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-3: 이름표 덮어쓰기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000013',
  'a2000000-0000-0000-0000-000000000002',
  3,
  '이름표 덮어쓰기',
  '딕셔너리 값 수정',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"같은 이름표에 두 번 넣기","learning_goals":["같은 키에 다시 넣으면 값이 바뀐다는 것을 안다"],"story_context":"조개 상자에 조개 수를 적었는데, 버그버그가 몰래 다시 적었어요. 상자를 열어 보면 어떻게 되어 있을까요?","fallback_text":"딕셔너리에서 이름표는 하나뿐이에요. 이미 있는 이름표에 다시 넣으면 새 이름표가 생기지 않고 내용이 바뀌어요. 없는 이름표에 넣으면 맨 뒤에 새로 붙어요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"box = {\"조개\": 1}\nbox[\"조개\"] = 5\nbox[\"소라\"] = 2\nprint(box)","options":[{"id":"opt-c6nb","text":"{''조개'': 6, ''소라'': 2}"},{"id":"opt-f3hu","text":"{''조개'': 5, ''소라'': 2}"},{"id":"opt-l2wv","text":"{''조개'': 1, ''조개'': 5, ''소라'': 2}"},{"id":"opt-y8dq","text":"{''조개'': 1, ''소라'': 2}"}]}}'::jsonb,
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

-- 퀘스트 2-4: 없는 책을 찾으면?
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000014',
  'a2000000-0000-0000-0000-000000000002',
  4,
  '없는 책을 찾으면?',
  'in, get()',
  'code',
  NULL,
  FALSE,
  '{"topic":"없는 키를 안전하게 다루기","learning_goals":["in으로 딕셔너리에 키가 있는지 확인할 수 있다",".get(키, 대신 값)으로 없는 키도 멈추지 않고 꺼낼 수 있다"],"story_context":"책장에 책이 몇 권 있는지 적어 둔 딕셔너리가 있어요. 그런데 없는 책 문어 요리를 찾자 프로그램이 멈춰 버렸어요! 멈추지 않게 고쳐 볼까요?","exercise_description":"in으로 \"고래 일기\"가 있는지 확인해 \"고래 일기 있어요\"를 출력하고, 마지막 줄의 shelf[\"문어 요리\"]를 .get(\"문어 요리\", \"없어요\")로 바꿔 출력하세요","starter_code":"shelf = {\"바다 탐험\": 3, \"고래 일기\": 1}\n\n# 1) \"고래 일기\" 이름표가 shelf 에 있는지 in 으로 확인해요\nif ___:\n    print(\"고래 일기 있어요\")\n\nprint(shelf[\"바다 탐험\"])\n\n# 2) 없는 이름표를 꺼내면 에러가 나요! .get(이름표, \"없어요\") 로 바꿔요\nprint(shelf[\"문어 요리\"])\n","expected_output_hint":"고래 일기 있어요, 3, 없어요 가 한 줄씩 나와야 해요","checklist":["if 빈칸에 \"고래 일기\" in shelf 를 넣어요","마지막 줄을 shelf.get(\"문어 요리\", \"없어요\") 로 바꿔요","멈추지 않고 세 줄이 나오는지 봐요"],"example_output":"고래 일기 있어요\n3\n없어요","example_exact":true,"fallback_text":"\"고래 일기\" in shelf 는 이름표가 있으면 True, 없으면 False 예요. shelf[\"문어 요리\"]처럼 없는 이름표를 꺼내면 KeyError 로 멈추지만, shelf.get(\"문어 요리\", \"없어요\")는 멈추지 않고 \"없어요\"를 돌려줘요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-5: 책장 한 바퀴
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000015',
  'a2000000-0000-0000-0000-000000000002',
  5,
  '책장 한 바퀴',
  'items()',
  'code',
  NULL,
  FALSE,
  '{"topic":"items()로 딕셔너리 모두 돌기","learning_goals":["for 키, 값 in 딕셔너리.items(): 로 이름표와 내용을 한 쌍씩 꺼낼 수 있다","돌면서 값을 더해 합계를 낼 수 있다"],"story_context":"등대 도서관 책장을 한 바퀴 돌며 칸마다 책이 몇 권인지 세어 봐요. 다 돌고 나면 모두 몇 권인지도 알려 줘요!","exercise_description":"for name, count in shelf.items(): 로 \"동화: 4권\"처럼 한 줄씩 출력하고, 권수를 모두 더해 \"모두 11권\"을 출력하세요","starter_code":"shelf = {\"동화\": 4, \"과학\": 2, \"만화\": 5}\ntotal = 0\n\n# .items() 는 이름표와 내용을 한 쌍씩 꺼내 줘요\nfor name, count in shelf.___():\n    print(f\"{name}: {count}권\")\n    # total 에 count 를 더해요\n    ___\n\nprint(f\"모두 {total}권\")\n","expected_output_hint":"동화: 4권, 과학: 2권, 만화: 5권, 모두 11권 이 한 줄씩 나와야 해요","checklist":["shelf 뒤 빈칸에 items 를 넣어요","for 안에서 total = total + count 로 더해요","모두 11권 이 나오는지 봐요"],"example_output":"동화: 4권\n과학: 2권\n만화: 5권\n모두 11권","example_exact":true,"fallback_text":"shelf.items() 는 (\"동화\", 4), (\"과학\", 2) 처럼 이름표와 내용을 한 쌍씩 꺼내요. for name, count in shelf.items(): 라고 쓰면 name 에 이름표, count 에 내용이 들어가요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-6: 책장 돌기 빈칸
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000016',
  'a2000000-0000-0000-0000-000000000002',
  6,
  '책장 돌기 빈칸',
  'items(), len()',
  'quiz',
  'fill_blank',
  TRUE,
  '{"topic":"딕셔너리 돌기와 세기","learning_goals":["이름표와 내용을 한 쌍씩 꺼내는 메서드를 고를 수 있다","딕셔너리의 이름표 수를 세는 함수를 고를 수 있다"],"story_context":"책장을 한 바퀴 돌며 칸마다 권수를 보여 주고, 칸이 모두 몇 개인지 세려고 해요. 그런데 주문 두 군데가 지워졌어요!","fallback_text":"이름표와 내용을 한 쌍씩 꺼내야 name 과 count 두 변수에 나눠 담을 수 있어요. 개수를 세는 함수는 리스트에서도 썼어요.","quiz":{"kind":"fill_blank","question":"빈칸을 채워 책장을 한 바퀴 돌며 보여 주고, 이름표가 몇 개인지 세어요","code":"shelf = {\"동화\": 4, \"과학\": 2}\nfor name, count in shelf.{{bk-i6tz}}():\n    print(f\"{name}: {count}권\")\nprint({{bk-n3ry}}(shelf))","tokens":[{"id":"tok-e5pw","text":"items"},{"id":"tok-g4sx","text":"sum"},{"id":"tok-o2ka","text":"keys"},{"id":"tok-u9mc","text":"len"},{"id":"tok-z7fj","text":"values"}]}}'::jsonb,
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

-- 퀘스트 2-7: 반장 투표 세기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000017',
  'a2000000-0000-0000-0000-000000000002',
  7,
  '반장 투표 세기',
  '딕셔너리로 개수 세기',
  'code',
  NULL,
  FALSE,
  '{"topic":"딕셔너리로 개수 세기","learning_goals":["처음 나온 이름은 1로, 이미 있는 이름은 1씩 늘려 셀 수 있다","센 결과를 items()로 돌며 보여 줄 수 있다"],"story_context":"바다 학교에서 반장을 뽑았어요! 투표 쪽지를 하나씩 열어 후보마다 몇 표인지 세어 봐요. 별똥이가 결과를 기다리고 있어요.","exercise_description":"votes 리스트를 돌며 후보마다 표 수를 count 딕셔너리에 세고, \"고래: 3표\"처럼 한 줄씩 출력하세요","starter_code":"votes = [\"고래\", \"상어\", \"고래\", \"문어\", \"고래\", \"상어\"]\ncount = {}\n\nfor name in votes:\n    if name in count:\n        # 이미 이름표가 있으면 표를 1 늘려요\n        count[name] = ___\n    else:\n        # 처음 나온 이름이면 1표로 시작해요\n        ___\n\nfor name, n in count.items():\n    print(f\"{name}: {n}표\")\n","expected_output_hint":"고래: 3표, 상어: 2표, 문어: 1표 가 한 줄씩 나와야 해요","checklist":["이미 있으면 count[name] 에 1을 더해요","처음이면 count[name] = 1 로 이름표를 붙여요","고래가 3표인지 봐요"],"example_output":"고래: 3표\n상어: 2표\n문어: 1표","example_exact":true,"fallback_text":"빈 딕셔너리 count = {} 에서 시작해요. 이름이 처음 나오면 count[name] = 1 로 이름표를 붙이고, 이미 있으면 count[name] = count[name] + 1 로 한 표 늘려요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-8: 단어장 만들기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000018',
  'a2000000-0000-0000-0000-000000000002',
  8,
  '단어장 만들기',
  'split() + 딕셔너리 세기',
  'code',
  NULL,
  FALSE,
  '{"topic":"문장을 쪼개 단어 수 세기","learning_goals":["split()으로 문장을 단어 리스트로 쪼갤 수 있다","딕셔너리로 단어마다 나온 횟수를 셀 수 있다","if로 조건에 맞는 단어만 골라 보여 줄 수 있다"],"story_context":"등대지기가 쓴 일기에 자꾸 나오는 단어가 있대요. 단어장을 만들어 어떤 단어가 많이 나왔는지 찾아봐요!","exercise_description":"sentence 를 split()으로 단어로 쪼개 단어마다 개수를 count 딕셔너리에 세고, 2번 넘게 나온 단어만 \"the: 3번\"처럼 출력하세요","starter_code":"sentence = \"the sea is blue and the sky is blue and the sun is hot\"\nwords = sentence.___()\ncount = {}\n\n# 1) words 를 돌며 단어마다 개수를 세요 (반장 투표 세기처럼!)\n\n# 2) 2번 넘게 나온 단어만 보여 줘요\nfor word, n in count.items():\n    if ___:\n        print(f\"{word}: {n}번\")\n","expected_output_hint":"2번 넘게 나온 the: 3번 과 is: 3번 이 나와야 해요","checklist":["split() 으로 문장을 단어로 쪼개요","반장 투표처럼 단어마다 개수를 세요","if n > 2: 로 2번 넘게 나온 단어만 골라요"],"example_output":"the: 3번\nis: 3번","example_exact":true,"fallback_text":"split()은 괄호를 비우면 띄어쓰기마다 잘라요. 반장 투표 세기와 똑같이 count 딕셔너리로 단어를 세고, 마지막에 n > 2 인 단어만 보여 주면 돼요. 2번 나온 blue 와 and 는 빠져야 해요.","is_challenge":true}'::jsonb,
  'all',
  '',
  120
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 2-9: 이름표 도둑 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000202',
  'a2000000-0000-0000-0000-000000000002',
  9,
  '이름표 도둑 버그버그',
  '딕셔너리 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"딕셔너리 키와 값, get, items, 개수 세기 총정리","learning_goals":["딕셔너리에 값을 더하고 고친 뒤 결과를 알아낼 수 있다","없는 이름표를 꺼낼 때 멈추지 않는 방법을 고를 수 있다","딕셔너리로 개수를 세고 모두 더하는 코드를 만들 수 있다"],"story_context":"등대 도서관을 다 정리하고 나오려는데, 책장 꼭대기에서 이름표를 한 아름 안은 버그버그가 나타났어요! 떼어 간 이름표를 돌려받으려면 버그버그의 문제를 풀어야 해요.","fallback_text":"딕셔너리는 이름표(키)가 붙은 상자예요. 같은 이름표에 다시 넣으면 내용이 바뀌고, 새 이름표에 넣으면 상자가 하나 늘어요. 없는 이름표를 꺼내면 멈추지만, get 은 대신 줄 값을 정할 수 있어요. items 는 이름표와 내용을 한 쌍씩 꺼내요.","boss":{"name":"이름표 도둑 버그버그","look":"library","intro":"쉿! 여긴 도서관이야. 나는 이름표 도둑 버그버그! 이름표를 돌려받고 싶으면 다섯 문제를 풀어 봐!","on_defeat":"이런, 이름표가 다 제자리에 붙었네! 책장이 반짝반짝해졌어. 다음 섬 소용돌이 미로는 길이 겹겹이래, 조심해!","on_victory":"후후, 이름표는 아직 내 주머니에 있어. 이름표와 내용을 다시 짝지어 보고 또 와!","rounds":[{"kind":"multiple_choice","question":"책 이름표를 고치고 하나 더 붙였어요. 돌리면 무엇이 나올까?","code":"book = {\"제목\": \"바다 동화\", \"쪽수\": 30}\nbook[\"쪽수\"] = 32\nbook[\"빌린 사람\"] = \"별똥이\"\nprint(len(book), book[\"쪽수\"])","options":[{"id":"opt-g2ke","text":"2 32"},{"id":"opt-n5wd","text":"3 32"},{"id":"opt-p4ti","text":"4 32"},{"id":"opt-v8qa","text":"3 30"}]},{"kind":"multiple_choice","question":"없는 책을 찾아도 멈추지 않게 했어요. 돌리면 무엇이 나올까?","code":"shelf = {\"동화\": 4, \"과학\": 2}\nprint(shelf.get(\"만화\", 0) + shelf.get(\"동화\", 0))","options":[{"id":"opt-c6xo","text":"0"},{"id":"opt-f9lm","text":"6"},{"id":"opt-r3ub","text":"4"},{"id":"opt-w2hj","text":"40"}]},{"kind":"fill_blank","question":"빈칸을 채워 별과 달이 각각 몇 표인지 세어요","code":"votes = [\"별\", \"달\", \"별\"]\ncount = {}\nfor v in votes:\n    if v {{bk-m4ra}} count:\n        count[v] = count[v] + 1\n    else:\n        count[v] = {{bk-y7ce}}\nprint(count)","tokens":[{"id":"tok-b3wq","text":"not in"},{"id":"tok-h8nv","text":"1"},{"id":"tok-k5dz","text":"in"},{"id":"tok-s2fo","text":"0"}]},{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 책장의 책을 모두 더해 보여 줘요","lines":[{"id":"ln-a5xs","code":"total = total + count"},{"id":"ln-e3vk","code":"total = 0"},{"id":"ln-j2dh","code":"print(total)"},{"id":"ln-q9bm","code":"for name, count in shelf.items():"},{"id":"ln-t6pa","code":"shelf = {\"동화\": 4, \"만화\": 5}"}],"indent":true},{"kind":"bug_hunt","question":"버그버그가 작가 이름표를 떼어 가서 코드가 멈춰요. 없으면 몰라요 가 나오게 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-w7fc","code":"book = {\"제목\": \"등대 이야기\", \"쪽수\": 20}"},{"id":"ln-l3oy","code":"print(book[\"제목\"])"},{"id":"ln-g8ue","code":"print(book[\"작가\"])"}],"fixes":[{"id":"fx-d2nq","code":"print(book.get(\"작가\", \"몰라요\"))"},{"id":"fx-m4ip","code":"print(book(\"작가\"))"},{"id":"fx-r6jt","code":"print(book[작가])"},{"id":"fx-x9az","code":"print(book.get[\"작가\"])"}]}],"review_quests":["b2000000-0000-0000-0000-000000000012","b2000000-0000-0000-0000-000000000014","b2000000-0000-0000-0000-000000000017","b2000000-0000-0000-0000-000000000015","b2000000-0000-0000-0000-000000000014"]}}'::jsonb,
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

-- 퀘스트 3-1: 바닥 타일 깔기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000019',
  'a2000000-0000-0000-0000-000000000003',
  1,
  '바닥 타일 깔기',
  '중첩 반복',
  'code',
  NULL,
  FALSE,
  '{"topic":"반복 안에 반복 넣기","learning_goals":["반복 안에 또 반복을 넣을 수 있다","바깥 반복이 한 번 돌 때 안쪽 반복은 끝까지 다 돈다는 것을 안다","안쪽 반복에서 글자를 모아 한 줄을 만들 수 있다"],"story_context":"소용돌이 미로 입구의 바닥 타일이 다 벗겨졌어요! 줄마다 타일 4장씩, 모두 3줄을 깔아야 해요. 반복 안에 반복을 넣으면 금방 깔 수 있대요.","exercise_description":"바깥 반복은 3줄, 안쪽 반복은 row 에 \"#\"을 4번 붙여 3줄 × 4칸 타일을 출력하세요","starter_code":"for r in range(3):\n    row = \"\"\n    # 안쪽 반복으로 row 에 \"#\" 을 4번 붙여요\n    ___\n    print(row)\n","expected_output_hint":"#### 가 3줄 나와야 해요","checklist":["___ 자리에 for c in range(4): 를 써요","안쪽 반복 안에서 row = row + \"#\" 으로 붙여요","#### 가 3줄인지 봐요"],"example_output":"####\n####\n####","example_exact":true,"fallback_text":"바깥 for 가 한 줄을 맡고, 안쪽 for 가 그 줄의 칸을 맡아요. 안쪽에서 row = row + \"#\" 로 칸을 하나씩 붙이고, 안쪽이 다 끝나면 print(row) 로 한 줄을 보여 줘요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-2: 구구단 표
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000020',
  'a2000000-0000-0000-0000-000000000003',
  2,
  '구구단 표',
  '중첩 반복 + f-string',
  'code',
  NULL,
  FALSE,
  '{"topic":"중첩 반복으로 구구단 표 만들기","learning_goals":["바깥 반복 변수와 안쪽 반복 변수를 함께 쓸 수 있다","f-string으로 계산 결과를 글자에 넣을 수 있다"],"story_context":"미로 벽에 구구단 표가 반쯤 지워져 있어요. 2단부터 4단까지, 1부터 3까지 곱한 표를 다시 그려 줘요.","exercise_description":"안쪽 반복으로 b 가 1~3 일 때 row 에 칸을 붙여 \"2단: 2x1=2 2x2=4 2x3=6\"처럼 한 단씩 출력하세요","starter_code":"for a in range(2, 5):\n    row = f\"{a}단:\"\n    # 여기에 안쪽 반복을 넣어요\n    # b 가 1, 2, 3 일 때 row 에 f\" {a}x{b}={a * b}\" 를 붙여요\n\n    print(row)\n","expected_output_hint":"2단: 2x1=2 2x2=4 2x3=6 처럼 2단부터 4단까지 3줄이 나와야 해요","checklist":["for b in range(1, 4): 를 들여써서 넣어요","row = row + f\" {a}x{b}={a * b}\" 로 칸을 붙여요","칸 앞에 띄어쓰기 한 칸, 줄 끝에는 띄어쓰기가 없어요"],"example_output":"2단: 2x1=2 2x2=4 2x3=6\n3단: 3x1=3 3x2=6 3x3=9\n4단: 4x1=4 4x2=8 4x3=12","example_exact":true,"fallback_text":"바깥 a 가 2일 때 안쪽 b 가 1, 2, 3 을 다 돌고, 그다음 a 가 3이 돼요. 칸 글자 앞에 띄어쓰기를 붙이면 \"2단:\" 뒤에 칸이 예쁘게 이어지고 줄 끝에 빈칸이 남지 않아요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-3: 몇 번 울릴까?
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000021',
  'a2000000-0000-0000-0000-000000000003',
  3,
  '몇 번 울릴까?',
  '중첩 반복 횟수',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"중첩 반복이 도는 횟수","learning_goals":["바깥 반복 한 번마다 안쪽 반복이 끝까지 돈다는 것을 안다"],"story_context":"미로 안에 종이 걸려 있어요. 반복 안의 반복이 돌 때마다 종이 한 번씩 울려요. 종은 모두 몇 번 울릴까요?","fallback_text":"바깥 반복이 한 번 돌 때마다 안쪽 반복은 처음부터 끝까지 다 돌아요. 바깥이 돈 횟수와 안쪽이 돈 횟수를 함께 생각해 보세요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"ring = 0\nfor i in range(3):\n    for j in range(2):\n        ring = ring + 1\nprint(ring)","options":[{"id":"opt-h7ve","text":"2"},{"id":"opt-k8ab","text":"5"},{"id":"opt-q3zu","text":"3"},{"id":"opt-w5jd","text":"6"}]}}'::jsonb,
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

-- 퀘스트 3-4: 보물 지도 칸 꺼내기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000022',
  'a2000000-0000-0000-0000-000000000003',
  4,
  '보물 지도 칸 꺼내기',
  '2차원 리스트',
  'code',
  NULL,
  FALSE,
  '{"topic":"2차원 리스트에서 grid[줄][칸]으로 꺼내기","learning_goals":["리스트 안에 리스트를 넣어 격자를 만들 수 있다","grid[줄][칸]으로 한 칸을 꺼낼 수 있다","len()으로 줄 수와 칸 수를 셀 수 있다"],"story_context":"버그버그가 숨긴 보물 지도를 찾았어요! 지도는 리스트 안에 리스트가 들어 있는 모양이에요. X 표시가 있는 칸을 꺼내 볼까요?","exercise_description":"grid[1][2] 로 보물 칸을 꺼내 \"보물 칸: X\"를 출력하고, 줄 수 len(grid)와 칸 수 len(grid[0])도 출력하세요","starter_code":"grid = [\n    [\".\", \"#\", \".\", \".\"],\n    [\".\", \".\", \"X\", \".\"],\n    [\"#\", \".\", \".\", \".\"],\n]\n\n# grid[줄][칸] — 줄 번호도 칸 번호도 0부터 세요\nprint(f\"보물 칸: {grid[___][___]}\")\nprint(f\"줄 수: {len(grid)}\")\nprint(f\"칸 수: {len(___)}\")\n","expected_output_hint":"보물 칸: X, 줄 수: 3, 칸 수: 4 가 한 줄씩 나와야 해요","checklist":["X 는 1번 줄의 2번 칸이에요. grid[1][2] 로 꺼내요","칸 수는 첫 줄 grid[0] 의 길이예요","세 줄이 나오는지 봐요"],"example_output":"보물 칸: X\n줄 수: 3\n칸 수: 4","example_exact":true,"fallback_text":"grid[1]은 둘째 줄 리스트 [\".\", \".\", \"X\", \".\"] 예요. 거기서 다시 [2]를 하면 셋째 칸 \"X\"가 나와요. 그래서 grid[1][2]처럼 줄 번호 다음에 칸 번호를 써요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-5: 지도 그리기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000023',
  'a2000000-0000-0000-0000-000000000003',
  5,
  '지도 그리기',
  '2차원 리스트 + 중첩 반복',
  'code',
  NULL,
  FALSE,
  '{"topic":"2차원 리스트를 중첩 반복으로 그리기","learning_goals":["바깥 반복으로 줄을, 안쪽 반복으로 칸을 꺼낼 수 있다","칸을 이어 붙여 한 줄씩 지도를 그릴 수 있다"],"story_context":"보물 지도를 손에 넣었지만 리스트 모양이라 알아보기 어려워요. 칸을 이어 붙여 진짜 지도처럼 그려 볼까요?","exercise_description":"바깥 for 로 grid 의 줄을, 안쪽 for 로 줄의 칸을 꺼내 line 에 이어 붙이고, 한 줄씩 지도를 출력하세요","starter_code":"grid = [\n    [\".\", \".\", \"#\", \".\"],\n    [\"#\", \".\", \".\", \"X\"],\n    [\".\", \"#\", \".\", \".\"],\n]\n\nfor row in grid:\n    line = \"\"\n    # 안쪽 반복으로 row 의 칸을 하나씩 line 에 붙여요\n\n    print(line)\n","expected_output_hint":"..#. / #..X / .#.. 세 줄이 나와야 해요","checklist":["for cell in row: 를 들여써서 넣어요","안쪽에서 line = line + cell 로 칸을 붙여요","지도가 세 줄로 나오는지 봐요"],"example_output":"..#.\n#..X\n.#..","example_exact":true,"fallback_text":"for row in grid: 는 줄 리스트를 하나씩 꺼내요. 그 안에서 for cell in row: 로 칸을 하나씩 꺼내 line 에 붙이면 한 줄이 완성돼요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-6: 지도 그리기 순서
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000024',
  'a2000000-0000-0000-0000-000000000003',
  6,
  '지도 그리기 순서',
  '중첩 반복 들여쓰기',
  'quiz',
  'parsons',
  TRUE,
  '{"topic":"중첩 반복 줄 순서와 들여쓰기","learning_goals":["줄 글자를 준비하는 곳, 칸을 붙이는 곳, 한 줄을 보여 주는 곳의 들여쓰기를 고를 수 있다"],"story_context":"버그버그가 지도 그리기 주문의 줄을 뒤섞어 놨어요! 줄 순서와 들여쓰기를 맞춰 지도를 다시 그려요.","fallback_text":"지도 리스트를 먼저 만들어요. 줄마다 빈 글자를 새로 준비하고, 칸은 안쪽 반복에서 붙이고, 한 줄이 다 모이면 바깥 반복 안에서 보여 줘요.","quiz":{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 지도를 한 줄씩 보여 줘요","lines":[{"id":"ln-b2xs","code":"line = \"\""},{"id":"ln-f3ow","code":"line = line + cell"},{"id":"ln-m8yh","code":"print(line)"},{"id":"ln-p9ra","code":"for row in grid:"},{"id":"ln-v4ce","code":"grid = [[\"#\", \".\"], [\".\", \"#\"]]"},{"id":"ln-z6kt","code":"for cell in row:"}],"indent":true}}'::jsonb,
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

-- 퀘스트 3-7: X 표시를 찾아라
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000025',
  'a2000000-0000-0000-0000-000000000003',
  7,
  'X 표시를 찾아라',
  '좌표 찾기, range(len())',
  'code',
  NULL,
  FALSE,
  '{"topic":"줄 번호와 칸 번호로 격자 돌기","learning_goals":["range(len(grid))로 줄 번호를 돌 수 있다","줄 번호와 칸 번호(좌표)로 원하는 칸을 찾을 수 있다"],"story_context":"새 지도에서 X 표시가 어디 있는지 파이뱀이 궁금해해요. 칸을 하나씩 열어 보다가 X 를 만나면 몇째 줄 몇째 칸인지 알려 줘요!","exercise_description":"for r in range(len(grid)): 와 for c in range(len(grid[r])): 로 모든 칸을 돌다가 칸이 \"X\" 이면 \"보물은 1줄 2칸\"처럼 출력하세요 (번호는 0부터)","starter_code":"grid = [\n    [\".\", \".\", \".\", \".\"],\n    [\".\", \"#\", \"X\", \".\"],\n    [\"#\", \".\", \".\", \".\"],\n]\n\n# 줄 번호 r 와 칸 번호 c 로 모든 칸을 돌아요 (0부터)\nfor r in range(___):\n    for c in range(___):\n        # grid[r][c] 가 \"X\" 이면 f\"보물은 {r}줄 {c}칸\" 을 보여 줘요\n        ___\n","expected_output_hint":"보물은 1줄 2칸 이 나와야 해요","checklist":["바깥 빈칸은 len(grid), 안쪽 빈칸은 len(grid[r]) 예요","if grid[r][c] == \"X\": 로 물어봐요","보물은 1줄 2칸 이 나오는지 봐요"],"example_output":"보물은 1줄 2칸","example_exact":true,"fallback_text":"range(len(grid))는 줄 번호 0, 1, 2 를 차례로 줘요. 그 안에서 range(len(grid[r]))로 칸 번호를 돌면, grid[r][c]로 모든 칸을 하나씩 볼 수 있어요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-8: 찌그러진 다이아몬드
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000026',
  'a2000000-0000-0000-0000-000000000003',
  8,
  '찌그러진 다이아몬드',
  '안쪽 반복 range',
  'quiz',
  'bug_hunt',
  TRUE,
  '{"topic":"안쪽 반복 횟수 버그 찾기","learning_goals":["range의 끝 숫자는 들어가지 않는다는 것을 안쪽 반복에서도 쓸 수 있다"],"story_context":"다이아몬드 윗부분을 그리려는데 별이 하나씩 모자라 찌그러졌어요! 버그버그가 숫자를 슬쩍 바꿨나 봐요.","fallback_text":"줄마다 별이 1개, 3개, 5개 나와야 해요. range(시작, 끝)은 끝 숫자 바로 앞까지 돌아요. 안쪽 반복이 몇 번 도는지 줄마다 세어 보세요.","quiz":{"kind":"bug_hunt","question":"별이 1개, 3개, 5개인 삼각형이 나와야 하는데 별이 모자라요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-a7kd","code":"for i in range(1, 4):"},{"id":"ln-s3pm","code":"    row = \" \" * (3 - i)"},{"id":"ln-w9tx","code":"    for j in range(1, 2 * i - 1):"},{"id":"ln-c5ge","code":"        row = row + \"*\""},{"id":"ln-y2nf","code":"    print(row)"}],"fixes":[{"id":"fx-d1vc","code":"    for j in range(2 * i, 1):"},{"id":"fx-h6rb","code":"    for j in range(1, 2 * i):"},{"id":"fx-o4zm","code":"    for j in range(1, 2 * i + 1):"},{"id":"fx-t8wq","code":"    for j in range(1, i):"}]}}'::jsonb,
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

-- 퀘스트 3-9: 다이아몬드 무늬
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000027',
  'a2000000-0000-0000-0000-000000000003',
  9,
  '다이아몬드 무늬',
  '반복으로 무늬 만들기',
  'code',
  NULL,
  FALSE,
  '{"topic":"공백과 별로 다이아몬드 무늬 만들기","learning_goals":["줄 번호에 따라 공백 수와 별 수가 바뀌는 규칙을 찾을 수 있다","반복을 두 번 써서 늘어나는 무늬와 줄어드는 무늬를 만들 수 있다"],"story_context":"미로 맨 끝 문에 다이아몬드 자물쇠가 있어요! 별로 다이아몬드 무늬를 그리면 문이 열리고 별똥이가 보물을 떨어뜨려 준대요.","exercise_description":"공백과 별로 5줄 다이아몬드(위 3줄은 별 1, 3, 5개, 아래 2줄은 별 3, 1개)를 반복문으로 출력하세요","starter_code":"# 다이아몬드 무늬를 만들어요 (위 3줄, 아래 2줄)\n#   *\n#  ***\n# *****\n#  ***\n#   *\n\n# 위쪽 3줄: 줄마다 앞 공백은 하나씩 줄고, 별은 2개씩 늘어요\n# 빈칸에 식을 넣을 때는 괄호 ( ) 안에 넣어야 먼저 계산돼요\nfor i in range(1, 4):\n    print(\" \" * (___) + \"*\" * (___))\n\n# 아래쪽 2줄: 이번엔 반대로! 반복을 하나 더 써요\n","expected_output_hint":"별이 1, 3, 5, 3, 1개인 다이아몬드 5줄이 나와야 해요","checklist":["위쪽 공백은 (3 - i) 칸, 별은 (2 * i - 1) 개예요. 식은 괄호로 묶어요","아래쪽은 i 가 2, 1 이 되는 반복을 하나 더 써요","별 줄 끝에 띄어쓰기를 붙이지 않아요"],"example_output":"  *\n ***\n*****\n ***\n  *","example_exact":true,"fallback_text":"i 가 1, 2, 3 일 때 공백은 2, 1, 0 칸(3 - i), 별은 1, 3, 5 개(2 * i - 1)예요. 아래쪽은 같은 식에 i 를 2, 1 로 넣으면 돼요. for i in [2, 1]: 처럼 리스트를 돌아도 돼요.","is_challenge":true}'::jsonb,
  'all',
  '',
  120
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 3-10: 소용돌이 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000203',
  'a2000000-0000-0000-0000-000000000003',
  10,
  '소용돌이 버그버그',
  '중첩 반복 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"중첩 반복 횟수, 2차원 리스트 번호, 격자 그리기 총정리","learning_goals":["반복 안의 반복이 몇 번, 어떤 모양으로 도는지 따라갈 수 있다","grid[줄][칸] 번호로 2차원 리스트의 값을 꺼낼 수 있다","격자를 그리고 세는 코드를 알맞은 차례와 들여쓰기로 놓을 수 있다"],"story_context":"미로 한가운데에서 물이 빙글빙글 돌기 시작했어요! 소용돌이 속에서 버그버그가 팽이처럼 돌며 나타났어요. 줄과 칸을 차근차근 따라가서 소용돌이를 멈춰 봐요!","fallback_text":"바깥 반복이 한 번 돌 때마다 안쪽 반복은 처음부터 끝까지 다 돌아요. 2차원 리스트는 grid[줄][칸]으로 꺼내고, 줄과 칸 번호는 모두 0부터 세요. 한 줄을 다 모은 다음에 보여 줘요.","boss":{"name":"소용돌이 버그버그","look":"maze","intro":"빙글빙글~ 나는 소용돌이 버그버그! 줄과 칸을 뱅뱅 꼬아 놨지. 여섯 문제를 풀면 길을 열어 줄게!","on_defeat":"어지러워라, 소용돌이가 멈췄어! 줄과 칸을 하나도 안 놓치다니 대단해. 다음 섬 놀이공원에는 무엇이 나올지 모르는 기구가 많대!","on_victory":"빙글빙글, 아직 길을 잃었구나! 바깥 반복 한 번에 안쪽 반복이 다 돈다는 걸 떠올리고 다시 와!","rounds":[{"kind":"multiple_choice","question":"소용돌이 계단을 쌓아요. 돌리면 무엇이 나올까?","code":"for i in range(3):\n    line = \"\"\n    for j in range(i + 1):\n        line = line + \"#\"\n    print(line)","options":[{"id":"opt-c5nf","text":"##\n###\n####"},{"id":"opt-k2hy","text":"#\n##\n###"},{"id":"opt-u3dm","text":"######"},{"id":"opt-w8ra","text":"###\n###\n###"}]},{"kind":"multiple_choice","question":"보물 지도에서 칸 하나와 크기를 꺼내요. 돌리면 무엇이 나올까?","code":"grid = [[\".\", \"#\", \".\"],\n        [\"#\", \"X\", \".\"]]\nprint(grid[1][1], len(grid), len(grid[0]))","options":[{"id":"opt-a6pv","text":"# 3 2"},{"id":"opt-f7je","text":"X 2 3"},{"id":"opt-q4bs","text":". 2 3"},{"id":"opt-z9wc","text":"X 3 2"}]},{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 3줄 4칸 바닥 타일을 깔아요","lines":[{"id":"ln-b5ma","code":"row = row + \"#\""},{"id":"ln-e2qt","code":"print(row)"},{"id":"ln-h3xe","code":"row = \"\""},{"id":"ln-p8sw","code":"for j in range(4):"},{"id":"ln-r7kb","code":"for i in range(3):"}],"indent":true},{"kind":"multiple_choice","question":"소용돌이 속 보물을 찾아요. 돌리면 무엇이 나올까?","code":"grid = [[\".\", \".\"], [\".\", \"X\"]]\nfor r in range(len(grid)):\n    for c in range(len(grid[r])):\n        if grid[r][c] == \"X\":\n            print(f\"보물은 {r}줄 {c}칸\")","options":[{"id":"opt-b2xk","text":"보물은 2줄 2칸"},{"id":"opt-h9cd","text":"보물은 1줄 0칸"},{"id":"opt-m6tg","text":"보물은 1줄 1칸"},{"id":"opt-y5ol","text":"보물은 0줄 0칸"}]},{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 지도에 X 가 모두 몇 개인지 세어요","lines":[{"id":"ln-a4ze","code":"count = count + 1"},{"id":"ln-c3wr","code":"for row in grid:"},{"id":"ln-g9na","code":"count = 0"},{"id":"ln-k8pb","code":"if cell == \"X\":"},{"id":"ln-o7lh","code":"print(count)"},{"id":"ln-s4fu","code":"grid = [[\"X\", \".\"], [\"X\", \"X\"]]"},{"id":"ln-x6dj","code":"for cell in row:"}],"indent":true},{"kind":"bug_hunt","question":"별 피라미드 꼭대기에 별이 하나여야 하는데 두 개예요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-d5vy","code":"for i in range(1, 4):"},{"id":"ln-t2mo","code":"    line = \" \" * (3 - i) + \"*\" * (2 * i)"},{"id":"ln-n8gk","code":"    print(line)"}],"fixes":[{"id":"fx-e7lx","code":"    line = \" \" * (3 - i) + \"*\" * (2 * i + 1)"},{"id":"fx-j9sa","code":"    line = \" \" * (4 - i) + \"*\" * (2 * i)"},{"id":"fx-q3wb","code":"    line = \" \" * (3 - i) + \"*\" * (2 * i - 1)"},{"id":"fx-v4hc","code":"    line = \" \" * (3 - i) + \"*\" * i"}]}],"review_quests":["b2000000-0000-0000-0000-000000000019","b2000000-0000-0000-0000-000000000022","b2000000-0000-0000-0000-000000000019","b2000000-0000-0000-0000-000000000025","b2000000-0000-0000-0000-000000000025","b2000000-0000-0000-0000-000000000027"]}}'::jsonb,
  'all',
  '',
  60
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-1: 수학 도구 상자
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000028',
  'a2000000-0000-0000-0000-000000000004',
  1,
  '수학 도구 상자',
  'import, math',
  'code',
  NULL,
  FALSE,
  '{"topic":"모듈을 불러와 수학 도구 쓰기","learning_goals":["import로 다른 사람이 만들어 둔 도구 상자(모듈)를 가져올 수 있다","math.sqrt, math.pi, math.ceil, math.floor를 쓸 수 있다","round(값, 2)로 소수 둘째 자리까지 반올림할 수 있다"],"story_context":"해적선 놀이공원에 도착했어요! 기구를 고치는 해적 기술자가 수학 도구 상자를 빌려준대요. 상자 이름은 math 예요. import math 라고 부르면 상자가 열리고, 그 안의 도구를 math.도구이름 으로 꺼내 써요.","exercise_description":"import math 로 도구 상자를 가져와 math.sqrt(49), round(math.pi, 2), math.ceil(7 / 2) 를 차례로 출력하세요","starter_code":"# 1) 수학 도구 상자 math 를 가져와요\n___\n\n# 예시: 7 / 2 = 3.5 를 내림하면 3\nprint(math.floor(7 / 2))\n\n# 2) 49의 제곱근 (같은 수를 두 번 곱해 49가 되는 수)\nprint(___)\n\n# 3) 원주율 math.pi (동그라미 둘레가 지름의 약 3.14배라는 수) 를 소수 둘째 자리까지 반올림\nprint(___)\n\n# 4) 7 / 2 = 3.5 를 올림 (소수점 아래가 있으면 다음 정수로 올려요)\nprint(___)\n","expected_output_hint":"3, 7.0, 3.14, 4 가 한 줄씩 나와야 해요","checklist":["맨 위 빈칸에 import math 를 써요","math.sqrt(49), round(math.pi, 2), math.ceil(7 / 2) 를 print( ) 안에 넣어요","4줄이 나오는지 봐요"],"example_output":"3\n7.0\n3.14\n4","example_exact":true,"fallback_text":"import math 를 쓰면 수학 도구 상자가 열려요. math.sqrt(49)는 제곱근이라 7.0 이 나오고, round(math.pi, 2)는 3.14159… 를 둘째 자리까지 반올림해 3.14 예요. math.ceil 은 올림, math.floor 는 내림이에요. 이 도구들은 몇 번을 돌려도 늘 같은 답을 줘요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-2: 정직한 주사위 검사
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000029',
  'a2000000-0000-0000-0000-000000000004',
  2,
  '정직한 주사위 검사',
  'random.randint',
  'code',
  NULL,
  FALSE,
  '{"topic":"random.randint로 주사위 굴리기","learning_goals":["random.randint(1, 6)으로 1부터 6까지 중 하나를 무작위로 뽑을 수 있다","randint는 양 끝 숫자 1과 6도 나온다는 것을 안다","많이 굴려 보고 결과가 맞는지 프로그램으로 검사할 수 있다"],"story_context":"놀이공원의 주사위 기구에 버그버그가 장난을 쳤다는 소문이 있어요! 정직한 주사위라면 몇 번을 굴려도 1부터 6까지만 나와야 해요. 100번 굴려서 검사해 봐요.","exercise_description":"random.randint(1, 6)으로 주사위를 한 번 굴려 보여 주고, 100번 더 굴리며 1~6 안에 든 횟수를 ok 에 세어 \"정직한 주사위: 100\" 처럼 출력하세요","starter_code":"import random\n\n# 1) 1부터 6까지 중 하나를 무작위로 뽑아요\ndice = random.___(1, 6)\nprint(f\"한 번 굴린 눈: {dice}\")\n\n# 2) 100번 굴려서 1~6 안에 든 횟수를 세요\nok = 0\nfor i in range(100):\n    n = ___\n    if n >= 1 and n <= 6:\n        ok = ok + 1\nprint(f\"정직한 주사위: {ok}\")\n","expected_output_hint":"한 번 굴린 눈은 매번 달라요. 마지막 줄 정직한 주사위: 100 은 늘 같아야 해요","checklist":["random.___ 빈칸에 randint 를 써요","반복 안에서도 n = random.randint(1, 6) 으로 굴려요","정직한 주사위: 100 이 나오는지 봐요"],"example_output":"한 번 굴린 눈: 4\n정직한 주사위: 100","fallback_text":"random.randint(1, 6)은 1, 2, 3, 4, 5, 6 중 하나를 무작위로 골라요. range와 달리 끝 숫자 6도 나와요. 굴릴 때마다 눈이 달라서, 눈 대신 \"1~6 안에 든 횟수\"를 세면 언제나 같은 결과로 검사할 수 있어요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-3: 주사위가 못 내는 수
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000030',
  'a2000000-0000-0000-0000-000000000004',
  3,
  '주사위가 못 내는 수',
  'random.randint 범위',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"randint가 고르는 수의 범위","learning_goals":["random.randint(a, b)는 a와 b도 포함해 고른다는 것을 안다"],"story_context":"버그버그가 주사위 기구 앞에서 내기를 걸어요. \"이 주사위가 절대 못 내는 수를 맞히면 네가 이겨!\"","fallback_text":"randint는 range와 달라요. 괄호 안 두 숫자 사이의 정수를 고르는데, 시작 숫자와 끝 숫자도 나올 수 있어요.","quiz":{"kind":"multiple_choice","question":"dice = random.randint(1, 6) 으로 주사위를 굴려요. dice 에 절대 들어갈 수 없는 수는 무엇일까?","options":[{"id":"opt-3ync","text":"6"},{"id":"opt-e6e9","text":"1"},{"id":"opt-fd7b","text":"3"},{"id":"opt-r3y0","text":"0"}]}}'::jsonb,
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

-- 퀘스트 4-4: 오늘의 간식 추천기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000031',
  'a2000000-0000-0000-0000-000000000004',
  4,
  '오늘의 간식 추천기',
  'random.choice',
  'code',
  NULL,
  FALSE,
  '{"topic":"random.choice로 리스트에서 하나 고르기","learning_goals":["random.choice(리스트)로 리스트 안에서 하나를 무작위로 고를 수 있다"],"story_context":"놀이공원 매점 앞에서 별똥이가 고민해요. \"뭘 먹을지 못 고르겠어!\" 간식 목록에서 하나를 무작위로 골라 주는 추천 기계를 만들어 줘요.","exercise_description":"random.choice(snacks)로 간식 하나를 골라 pick 에 담고 \"오늘의 간식: 솜사탕\" 처럼 출력하세요","starter_code":"import random\n\nsnacks = [\"붕어빵\", \"떡볶이\", \"솜사탕\", \"핫도그\"]\n\n# 간식 목록에서 하나를 무작위로 골라요\npick = ___\nprint(f\"오늘의 간식: {pick}\")\n","expected_output_hint":"오늘의 간식: 뒤에 네 간식 중 하나가 나와요. 돌릴 때마다 바뀔 수 있어요","checklist":["빈칸에 random.choice(snacks) 를 써요","여러 번 돌려서 간식이 바뀌는지 봐요"],"example_output":"오늘의 간식: 솜사탕","fallback_text":"random.choice(리스트)는 리스트 안의 값 하나를 무작위로 골라 줘요. randint가 숫자를 고른다면, choice는 리스트에서 골라요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-5: 놀이기구 줄 섞기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000032',
  'a2000000-0000-0000-0000-000000000004',
  5,
  '놀이기구 줄 섞기',
  'random.shuffle, sort()',
  'code',
  NULL,
  FALSE,
  '{"topic":"random.shuffle로 리스트 섞기","learning_goals":["random.shuffle(리스트)로 리스트 순서를 무작위로 섞을 수 있다","shuffle은 새 리스트를 주지 않고 원래 리스트를 바꾼다는 것을 안다","섞인 리스트를 sort()로 다시 세울 수 있다"],"story_context":"회전 그네 앞에 바다 친구들이 줄을 섰어요. 버그버그가 \"누가 먼저 탈지 섞자!\" 하고 줄을 마구 섞었어요. 섞어 보고, 다시 가나다 순서로 세워 줘요.","exercise_description":"random.shuffle(line)으로 줄을 섞어 출력한 다음, line.sort()로 가나다 순서로 다시 세워 출력하세요","starter_code":"import random\n\nline = [\"해마\", \"고래\", \"상어\", \"거북\", \"문어\"]\n\n# 1) 줄을 무작위로 섞고 보여 줘요\n___\nprint(line)\n\n# 2) 가나다 순서로 다시 세우고 보여 줘요\n___\nprint(line)\n","expected_output_hint":"첫 줄은 매번 달라요. 둘째 줄은 늘 [''거북'', ''고래'', ''문어'', ''상어'', ''해마''] 예요","checklist":["첫 빈칸에 random.shuffle(line) 을 써요","둘째 빈칸에 line.sort() 를 써요","둘째 줄이 가나다 순서인지 봐요"],"example_output":"[''상어'', ''거북'', ''해마'', ''문어'', ''고래'']\n[''거북'', ''고래'', ''문어'', ''상어'', ''해마'']","fallback_text":"random.shuffle(line)은 line 자체를 섞어요. 그래서 line = random.shuffle(line) 처럼 다시 담으면 안 되고, 한 줄로 그냥 불러요. 섞은 다음 line.sort() 를 부르면 가나다 순서로 돌아와요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-6: 수학 도구 빈칸
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000033',
  'a2000000-0000-0000-0000-000000000004',
  6,
  '수학 도구 빈칸',
  'import, math.sqrt, round',
  'quiz',
  'fill_blank',
  TRUE,
  '{"topic":"모듈 가져오기와 수학 도구","learning_goals":["모듈을 가져오는 주문을 고를 수 있다","제곱근 도구와 반올림 함수를 고를 수 있다"],"story_context":"해적 기술자의 수학 도구 상자 설명서가 물에 젖어 글자가 지워졌어요! 빠진 낱말을 채워 16의 제곱근과 반올림한 원주율을 보여 줘요.","fallback_text":"도구 상자를 쓰려면 먼저 가져와야 해요. 상자 안 도구는 상자 이름 뒤에 점을 찍고 꺼내고, 반올림은 상자 없이 바로 쓰는 함수예요.","quiz":{"kind":"fill_blank","question":"빈칸을 채워 4.0 과 3.14 가 한 줄씩 나오게 해요","code":"{{bk-07mx}} math\nprint(math.{{bk-41kp}}(16))\nprint({{bk-32s9}}(3.14159, 2))","tokens":[{"id":"tok-8ojx","text":"round"},{"id":"tok-da8w","text":"ceil"},{"id":"tok-e24t","text":"sqrt"},{"id":"tok-e98z","text":"floor"},{"id":"tok-jd4n","text":"import"}]}}'::jsonb,
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

-- 퀘스트 4-7: 주사위 600번 굴리기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000034',
  'a2000000-0000-0000-0000-000000000004',
  7,
  '주사위 600번 굴리기',
  '시뮬레이션 + 딕셔너리 세기',
  'code',
  NULL,
  FALSE,
  '{"topic":"많이 굴려 보고 통계 내기","learning_goals":["반복으로 주사위를 아주 많이 굴려 볼 수 있다 (시뮬레이션)","딕셔너리로 눈마다 나온 횟수를 셀 수 있다","횟수를 모두 더해 굴린 횟수와 같은지 검사할 수 있다"],"story_context":"정직한 주사위인 건 알았어요. 그런데 6만 자꾸 나오는 건 아닐까요? 손으로 600번 굴리면 팔이 아프니까 컴퓨터에게 대신 굴려 달라고 해요. 이런 걸 시뮬레이션이라고 해요.","exercise_description":"for 로 600번 굴려 나온 눈 n 의 횟수를 counts[n] 에 1씩 더하고, 눈마다 횟수를 보여 준 뒤 횟수 합을 \"모두 600번\" 처럼 출력하세요","starter_code":"import random\n\ncounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}\n\nfor i in range(600):\n    # 1) 주사위를 굴려요\n    n = ___\n    # 2) 나온 눈 n 의 횟수를 1 늘려요\n    ___\n\ntotal = 0\nfor eye, count in counts.items():\n    print(f\"{eye}: {count}번\")\n    total = total + count\nprint(f\"모두 {total}번\")\n","expected_output_hint":"눈마다 횟수는 매번 달라요. 마지막 줄 모두 600번 은 늘 같아야 해요","checklist":["n = random.randint(1, 6) 으로 굴려요","counts[n] = counts[n] + 1 로 횟수를 늘려요","모두 600번 이 나오는지 봐요"],"example_output":"1: 97번\n2: 104번\n3: 99번\n4: 101번\n5: 95번\n6: 104번\n모두 600번","fallback_text":"counts 는 눈(이름표)마다 나온 횟수(값)를 담는 딕셔너리예요. 반장 투표를 셀 때처럼 counts[n] = counts[n] + 1 로 하나씩 늘려요. 600번을 굴렸으니 횟수를 모두 더하면 언제나 600이에요. 눈마다 횟수는 100 근처로 비슷하게 나와요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-8: 황금 열쇠 뽑기 기계
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000035',
  'a2000000-0000-0000-0000-000000000004',
  8,
  '황금 열쇠 뽑기 기계',
  'while + random.choice',
  'code',
  NULL,
  FALSE,
  '{"topic":"원하는 것이 나올 때까지 반복하기","learning_goals":["while로 원하는 결과가 나올 때까지 무작위 뽑기를 되풀이할 수 있다","반복할 때마다 횟수를 세어 몇 번 만에 끝났는지 알 수 있다"],"story_context":"놀이공원 마지막 기구는 뽑기 기계예요! 황금 열쇠를 뽑으면 해적선 보물 창고 문이 열린대요. 황금 열쇠가 나올 때까지 계속 뽑아 봐요.","exercise_description":"while 로 황금 열쇠가 나올 때까지 random.choice(prizes)로 뽑고, 끝나면 \"3번 만에 뽑았어요!\" 처럼 몇 번 만에 뽑았는지 출력하세요","starter_code":"import random\n\nprizes = [\"사탕\", \"풍선\", \"스티커\", \"모자\", \"황금 열쇠\"]\ntries = 0\nprize = \"\"\n\n# 황금 열쇠가 아닌 동안 계속 뽑아요\nwhile ___:\n    # 상품 하나를 무작위로 뽑아요\n    prize = ___\n    tries = tries + 1\n    print(f\"{tries}번째: {prize}\")\n\nprint(f\"{tries}번 만에 뽑았어요!\")\n","expected_output_hint":"뽑은 상품과 횟수는 매번 달라요. 마지막 줄은 ○번 만에 뽑았어요! 모양이에요","checklist":["while 빈칸에 prize != \"황금 열쇠\" 를 써요. 황금 열쇠 가운데 띄어쓰기까지 리스트와 똑같이 써요","prize = random.choice(prizes) 로 뽑아요","마지막에 황금 열쇠가 나오고 몇 번 만에 뽑았는지 나오는지 봐요"],"example_output":"1번째: 풍선\n2번째: 사탕\n3번째: 황금 열쇠\n3번 만에 뽑았어요!","fallback_text":"while 은 조건이 참인 동안 반복해요. prize != \"황금 열쇠\" 는 \"아직 황금 열쇠가 아니야\"라는 뜻이에요. 반복 안에서 prize 를 새로 뽑지 않으면 조건이 영원히 참이라 끝나지 않으니 꼭 뽑아야 해요.","is_challenge":true}'::jsonb,
  'all',
  '',
  120
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 4-9: 회전목마 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000204',
  'a2000000-0000-0000-0000-000000000004',
  9,
  '회전목마 버그버그',
  '모듈·랜덤·수학 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"import, math 도구, randint 범위, choice 와 shuffle 총정리","learning_goals":["math 도구로 계산한 결과를 알아낼 수 있다","randint 가 낼 수 있는 수와 shuffle 이 하는 일을 설명할 수 있다","올림이 필요한 계산에서 알맞은 math 도구를 고를 수 있다"],"story_context":"놀이공원 한가운데 회전목마가 혼자서 빙빙 돌기 시작했어요! 해적 모자를 쓴 버그버그가 목마에 올라타 있네요. 주사위와 수학 도구에 숨은 장난을 찾아 회전목마를 멈춰 봐요!","fallback_text":"import 로 도구 상자를 가져와야 math 나 random 을 쓸 수 있어요. math.sqrt 는 제곱근, math.ceil 은 올림, math.floor 는 내림이에요. 이 도구들은 결과가 늘 같아요. randint 는 앞 수와 뒤 수를 모두 포함하고, shuffle 은 리스트 순서를 섞어요.","boss":{"name":"회전목마 버그버그","look":"pirate","intro":"요호호! 나는 회전목마 버그버그! 주사위에 장난 좀 쳤지. 여섯 문제를 맞히면 목마를 멈춰 줄게!","on_defeat":"으아, 목마가 멈췄다! 랜덤도 수학도 척척이구나. 다음 섬은 버그 병원선인데... 사실 나 배가 좀 아파.","on_victory":"요호호, 목마는 계속 돈다! 도구 상자마다 무슨 도구가 있는지 다시 살펴보고 와!","rounds":[{"kind":"multiple_choice","question":"수학 도구 상자를 열었어요. 돌리면 무엇이 나올까?","code":"import math\nprint(math.sqrt(16) + math.ceil(2.1))","options":[{"id":"opt-e3pw","text":"7"},{"id":"opt-l9ck","text":"6.0"},{"id":"opt-s7gd","text":"7.0"},{"id":"opt-x4uy","text":"6"}]},{"kind":"multiple_choice","question":"주사위 놀이에서 random.randint(1, 6) 을 써요. 이 주문이 낼 수 있는 수를 모두 모은 것은 무엇일까?","options":[{"id":"opt-b5ni","text":"1, 2, 3, 4, 5, 6"},{"id":"opt-g2rm","text":"0, 1, 2, 3, 4, 5"},{"id":"opt-u8fa","text":"1, 2, 3, 4, 5"},{"id":"opt-w6tz","text":"2, 3, 4, 5"}]},{"kind":"multiple_choice","question":"friends = [\"파이뱀\", \"별똥이\", \"버그버그\"] 에 random.shuffle(friends) 를 하면 friends 는 어떻게 될까?","options":[{"id":"opt-c2ya","text":"친구 한 명이 줄에서 빠져요"},{"id":"opt-h3kq","text":"세 친구가 모두 그대로 있고, 서는 순서만 바뀔 수 있어요"},{"id":"opt-n7ew","text":"세 친구 중 한 명만 골라서 알려 줘요"},{"id":"opt-r9ob","text":"언제나 가나다 순서로 줄을 서요"}]},{"kind":"fill_blank","question":"빈칸을 채워 반지름이 3인 둥근 회전판의 넓이를 소수 첫째 자리까지 보여 줘요","code":"{{bk-f4tn}} math\nr = 3\nprint(round(math.{{bk-k8ws}} * r * r, 1))","tokens":[{"id":"tok-a6mq","text":"import"},{"id":"tok-e9rj","text":"random"},{"id":"tok-p3hv","text":"pi"},{"id":"tok-z5dc","text":"sqrt"}]},{"kind":"fill_blank","question":"주사위를 굴린 기록이에요. 빈칸을 채워 3이 몇 번 나왔는지와 모두 몇 번 굴렸는지 보여 줘요","code":"rolls = [3, 6, 3, 1]\ncount = {}\nfor r in rolls:\n    count[r] = count.{{bk-c2xh}}(r, 0) + 1\nprint(count[3], {{bk-v7md}}(rolls))","tokens":[{"id":"tok-m8ke","text":"len"},{"id":"tok-o6wa","text":"items"},{"id":"tok-t2ps","text":"max"},{"id":"tok-u4bn","text":"get"}]},{"kind":"bug_hunt","question":"보트 하나에 두 명씩 타요. 친구 7명이 모두 타려면 보트가 4척 있어야 하는데 3척이 나와요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-y3gq","code":"import math"},{"id":"ln-l8re","code":"kids = 7"},{"id":"ln-c6vn","code":"boats = math.floor(kids / 2)"},{"id":"ln-w2tx","code":"print(f\"보트 {boats}척이 필요해요\")"}],"fixes":[{"id":"fx-h5ad","code":"boats = math.ceil(kids / 2)"},{"id":"fx-n9qu","code":"boats = kids // 2"},{"id":"fx-p4mf","code":"boats = kids / 2"},{"id":"fx-z7ki","code":"boats = math.sqrt(kids)"}]}],"review_quests":["b2000000-0000-0000-0000-000000000028","b2000000-0000-0000-0000-000000000029","b2000000-0000-0000-0000-000000000032","b2000000-0000-0000-0000-000000000028","b2000000-0000-0000-0000-000000000034","b2000000-0000-0000-0000-000000000028"]}}'::jsonb,
  'all',
  '',
  60
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-1: 진료 기록 읽기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000036',
  'a2000000-0000-0000-0000-000000000005',
  1,
  '진료 기록 읽기',
  '에러 메시지 읽기, NameError',
  'code',
  NULL,
  FALSE,
  '{"topic":"에러 메시지에서 에러 이름과 줄 번호 찾기","learning_goals":["에러 메시지의 마지막 줄에서 에러 이름을 찾을 수 있다","에러 메시지의 line 숫자를 보고 몇째 줄이 아픈지 찾을 수 있다","NameError는 없는 이름(오타)을 썼을 때 난다는 것을 안다"],"story_context":"바다 위 병원선에 버그버그가 실려 왔어요! 코드를 너무 많이 먹어서 배탈이 났대요. 의사 가운을 입은 모험가가 진료 기록을 열었더니 코드가 멈추고 빨간 쪽지가 나왔어요. 이 쪽지가 바로 에러 메시지예요.","exercise_description":"코드를 실행해 에러 메시지를 읽어 보세요. 마지막 줄의 에러 이름과 line 숫자를 보고, 그 줄의 변수 이름 오타를 고쳐 세 줄이 모두 나오게 하세요","starter_code":"# 버그버그 진료 기록\npatient = \"버그버그\"\ntemperature = 38\nfever = temprature - 37\nprint(f\"환자: {patient}\")\nprint(f\"체온: {temperature}도\")\nprint(f\"열이 {fever}도 높아요\")\n","expected_output_hint":"환자: 버그버그, 체온: 38도, 열이 1도 높아요 가 한 줄씩 나와야 해요","checklist":["먼저 그대로 실행해서 에러 메시지를 읽어요","line 뒤의 숫자가 가리키는 줄을 찾아요","그 줄의 이름 오타를 위에서 만든 변수 이름과 똑같이 고쳐요"],"example_output":"환자: 버그버그\n체온: 38도\n열이 1도 높아요","example_exact":true,"fallback_text":"에러 메시지는 아래에서부터 읽어요. 맨 아래 줄 NameError 는 \"그런 이름은 없어요\"라는 뜻이고, 그 위의 line 4 는 4번째 줄이 아프다는 뜻이에요. 4번째 줄의 temprature 를 3번째 줄에서 만든 temperature 와 똑같이 고쳐요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-2: 문법 응급실
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000037',
  'a2000000-0000-0000-0000-000000000005',
  2,
  '문법 응급실',
  'SyntaxError',
  'code',
  NULL,
  FALSE,
  '{"topic":"문법 에러 고치기","learning_goals":["SyntaxError는 파이썬 맞춤법(문법)이 틀렸을 때 난다는 것을 안다","빠진 쌍점(:)과 짝이 안 맞는 괄호를 찾아 고칠 수 있다","에러를 하나 고치면 다음 에러가 나올 수 있다는 것을 안다"],"story_context":"응급실에 약 먹는 시간표 코드가 실려 왔어요. 그런데 코드를 돌리기도 전에 SyntaxError 쪽지가 나와요! 버그버그가 맞춤법 두 군데를 망가뜨렸대요.","exercise_description":"시간표 코드의 문법 에러 두 곳(빠진 쌍점, 닫히지 않은 괄호)을 고쳐 아침·점심·저녁 약과 \"다 먹었어요!\"가 나오게 하세요","starter_code":"# 버그버그 약 먹는 시간표\ntimes = [\"아침\", \"점심\", \"저녁\"]\nfor t in times\n    print(f\"{t}: 약 한 알\"\nprint(\"다 먹었어요!\")\n","expected_output_hint":"아침: 약 한 알, 점심: 약 한 알, 저녁: 약 한 알, 다 먹었어요! 가 한 줄씩 나와야 해요","checklist":["실행해서 에러 메시지의 line 숫자를 봐요","for 줄 끝에 빠진 기호를 붙여요","한 번 더 실행해서 다음 에러를 찾아 괄호 짝을 맞춰요"],"example_output":"아침: 약 한 알\n점심: 약 한 알\n저녁: 약 한 알\n다 먹었어요!","example_exact":true,"fallback_text":"SyntaxError 는 파이썬 맞춤법이 틀렸다는 뜻이라 한 줄도 실행되지 않아요. expected '':'' 는 쌍점이 있어야 한다는 말이고, was never closed 는 열린 괄호가 닫히지 않았다는 말이에요. 하나를 고치고 다시 실행하면 다음 에러가 보여요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-3: 어떤 에러일까?
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000038',
  'a2000000-0000-0000-0000-000000000005',
  3,
  '어떤 에러일까?',
  '에러 이름',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"코드를 보고 에러 이름 맞히기","learning_goals":["리스트에 없는 번호를 꺼낼 때 나는 에러 이름을 고를 수 있다"],"story_context":"버그버그가 조개 목록 코드를 들고 왔어요. \"이거 돌리면 배가 아파! 무슨 병인지 진단해 줘!\"","fallback_text":"리스트 번호는 0부터 세요. 조개가 2개면 쓸 수 있는 번호가 몇 번까지인지 세어 보고, 에러 이름이 무슨 뜻인지 떠올려 보세요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 어떤 에러가 날까?","code":"shells = [\"소라\", \"가리비\"]\nprint(shells[2])","options":[{"id":"opt-7tqv","text":"TypeError"},{"id":"opt-87aa","text":"NameError"},{"id":"opt-e9ix","text":"IndexError"},{"id":"opt-i3vw","text":"KeyError"}]}}'::jsonb,
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

-- 퀘스트 5-4: 없는 이름표 처방
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000039',
  'a2000000-0000-0000-0000-000000000005',
  4,
  '없는 이름표 처방',
  'KeyError, get()',
  'code',
  NULL,
  FALSE,
  '{"topic":"KeyError 읽고 고치기","learning_goals":["KeyError는 딕셔너리에 없는 이름표를 꺼낼 때 난다는 것을 안다",".get(이름표, 0)으로 없는 이름표도 멈추지 않고 꺼낼 수 있다"],"story_context":"병원선 약 상자에는 감기약과 밴드만 있어요. 간호사 별똥이가 장부에 적힌 약을 하나씩 세는데, 연고에서 갑자기 코드가 멈췄어요! 쪽지에는 KeyError 라고 적혀 있어요.","exercise_description":"장부 book 의 약 이름을 하나씩 medicine 에서 꺼내다 \"연고\"에서 KeyError 가 나요. medicine[name] 을 medicine.get(name, 0) 으로 고쳐 \"연고: 0개\"까지 모두 출력하세요","starter_code":"medicine = {\"감기약\": 3, \"밴드\": 5}\nbook = [\"감기약\", \"밴드\", \"연고\"]\n\nfor name in book:\n    print(f\"{name}: {medicine[name]}개\")\n","expected_output_hint":"감기약: 3개, 밴드: 5개, 연고: 0개 가 한 줄씩 나와야 해요","checklist":["실행해서 KeyError 뒤에 나온 이름표를 봐요","medicine[name] 을 medicine.get(name, 0) 으로 바꿔요","연고: 0개 까지 세 줄이 나오는지 봐요"],"example_output":"감기약: 3개\n밴드: 5개\n연고: 0개","example_exact":true,"fallback_text":"KeyError 는 딕셔너리에 그런 이름표가 없다는 뜻이에요. 쪽지 끝에 없는 이름표 연고가 적혀 있어요. 등대 도서관에서 배운 .get(이름표, 대신 값)은 이름표가 없으면 멈추지 않고 대신 값을 돌려줘요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-5: 숫자 변신 안전띠
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000040',
  'a2000000-0000-0000-0000-000000000005',
  5,
  '숫자 변신 안전띠',
  'try / except ValueError',
  'code',
  NULL,
  FALSE,
  '{"topic":"try와 except로 멈추지 않게 하기","learning_goals":["try 아래 코드를 해 보고, 에러가 나면 except 아래로 간다는 것을 안다","int()로 바꿀 수 없는 글자에서 나는 ValueError를 잡을 수 있다"],"story_context":"환자 카드에 적힌 약 개수를 int()로 숫자로 바꿔 더하려는데, 버그버그가 카드 하나에 abc 라고 낙서를 했어요! 그 카드에서 ValueError 가 나며 멈춰 버려요. 안전띠를 매 주면 넘어져도 멈추지 않아요.","exercise_description":"for 안의 세 줄을 try: 아래로 넣고, except ValueError: 아래에서 \"abc: 숫자가 아니에요\" 처럼 출력하세요. 숫자 카드만 더해 마지막에 \"합계: 8\"이 나와야 해요","starter_code":"cards = [\"3\", \"abc\", \"5\"]\ntotal = 0\n\nfor card in cards:\n    # 아래 세 줄을 try: 안에 넣고, except ValueError: 를 더해요\n    number = int(card)\n    total = total + number\n    print(f\"{card} 더했어요\")\n\nprint(f\"합계: {total}\")\n","expected_output_hint":"3 더했어요, abc: 숫자가 아니에요, 5 더했어요, 합계: 8 이 한 줄씩 나와야 해요","checklist":["for 안에 try: 를 쓰고 세 줄을 한 칸 더 들여써요","try 와 같은 줄 높이에 except ValueError: 를 써요","except 아래에서 print(f\"{card}: 숫자가 아니에요\") 를 써요"],"example_output":"3 더했어요\nabc: 숫자가 아니에요\n5 더했어요\n합계: 8","example_exact":true,"fallback_text":"try: 아래는 \"일단 해 봐!\", except ValueError: 아래는 \"바꿀 수 없는 값이면 멈추지 말고 이쪽으로!\"예요. abc 카드에서 int() 가 실패하면 그 아래 두 줄은 건너뛰고 except 쪽 print 를 해요. 그다음 카드 5 는 다시 try 부터 해요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-6: 사탕 나누기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000041',
  'a2000000-0000-0000-0000-000000000005',
  6,
  '사탕 나누기',
  'try / except ZeroDivisionError',
  'code',
  NULL,
  FALSE,
  '{"topic":"특정 에러만 잡기","learning_goals":["0으로 나누면 ZeroDivisionError가 난다는 것을 안다","except 뒤에 에러 이름을 써서 그 에러만 잡을 수 있다"],"story_context":"다 나은 환자들에게 사탕 12개를 나눠 주기로 했어요. 방마다 친구 수로 나누는데, 빈 방에서 코드가 멈췄어요! 0명에게는 나눌 수가 없거든요.","exercise_description":"방마다 candy // f 로 나누다 f 가 0이면 ZeroDivisionError 가 나요. try 와 except ZeroDivisionError: 로 잡아 \"나눌 친구가 없어요\"를 출력하세요","starter_code":"candy = 12\nfriends = [3, 0, 2]\n\nfor f in friends:\n    # // 는 나눈 몫이에요 (12 // 3 은 4)\n    # 0으로 나누면 멈춰요! try 와 except ZeroDivisionError: 로 감싸요\n    print(f\"{f}명이면 한 명에 {candy // f}개\")\n","expected_output_hint":"3명이면 한 명에 4개, 나눌 친구가 없어요, 2명이면 한 명에 6개 가 한 줄씩 나와야 해요","checklist":["print 줄을 try: 안에 넣어요","except ZeroDivisionError: 아래에서 나눌 친구가 없어요 를 출력해요","세 줄이 모두 나오는지 봐요"],"example_output":"3명이면 한 명에 4개\n나눌 친구가 없어요\n2명이면 한 명에 6개","example_exact":true,"fallback_text":"ZeroDivisionError 는 0으로 나누려 했다는 뜻이에요. except 뒤에 ZeroDivisionError 처럼 에러 이름을 쓰면 그 에러만 잡아요. 다른 에러는 그대로 보여 줘서 다른 버그를 숨기지 않아요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-7: 안전띠 순서
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000042',
  'a2000000-0000-0000-0000-000000000005',
  7,
  '안전띠 순서',
  'try / except 들여쓰기',
  'quiz',
  'parsons',
  TRUE,
  '{"topic":"try와 except 블록의 순서와 들여쓰기","learning_goals":["try 아래에 해 볼 코드를, except 아래에 에러가 났을 때 할 코드를 놓을 수 있다"],"story_context":"버그버그가 안전띠 주문을 조각조각 잘라 놨어요! 줄을 다시 맞춰서, 숫자로 못 바꾸는 글자를 만나도 멈추지 않게 해 줘요.","fallback_text":"먼저 해 볼 일을 감싸는 줄이 오고, 그 아래 한 칸 들여써서 해 볼 일을 차례로 놓아요. 에러가 났을 때 갈 곳은 맨 처음 줄과 같은 높이에 놓고, 할 일은 다시 한 칸 들여써요.","quiz":{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 숫자로 못 바꾸면 안내 글이 나오게 해요","lines":[{"id":"ln-1y66","code":"except ValueError:"},{"id":"ln-c5ix","code":"n = int(\"다섯\")"},{"id":"ln-ddj9","code":"print(\"숫자로 바꿀 수 없어요\")"},{"id":"ln-np9f","code":"print(n + 1)"},{"id":"ln-s4xi","code":"try:"}],"indent":true}}'::jsonb,
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

-- 퀘스트 5-8: 조용한 버그 탐정
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000043',
  'a2000000-0000-0000-0000-000000000005',
  8,
  '조용한 버그 탐정',
  'print 디버깅',
  'code',
  NULL,
  FALSE,
  '{"topic":"에러 없이 틀린 답 찾기","learning_goals":["에러가 없어도 답이 틀릴 수 있다는 것을 안다 (조용한 버그)","print로 반복 중간의 값을 들여다보며 버그를 찾을 수 있다"],"story_context":"버그버그 건강 점수 80, 90, 70의 평균을 냈더니 53.3 이 나왔어요. 에러 쪽지도 없는데 답이 이상해요! 이런 버그는 조용히 숨어 있어서, 탐정처럼 print 돋보기로 중간 값을 들여다봐야 찾을 수 있어요.","exercise_description":"반복 안에 print(i, scores[i]) 를 넣어 어떤 점수가 더해지는지 들여다보고, range 를 range(len(scores)) 로 고쳐 \"평균: 80.0\"만 나오게 하세요","starter_code":"scores = [80, 90, 70]\ntotal = 0\n\nfor i in range(1, len(scores)):\n    # 돋보기: 여기에 print(i, scores[i]) 를 넣어 들여다봐요\n    total = total + scores[i]\n\navg = round(total / len(scores), 1)\nprint(f\"평균: {avg}\")\n","expected_output_hint":"평균: 80.0 한 줄만 나와야 해요","checklist":["print(i, scores[i]) 로 몇 번 점수부터 더해지는지 봐요","빠진 점수가 더해지게 range(len(scores)) 로 고쳐요","돋보기 print 를 지우고 평균: 80.0 만 나오는지 봐요"],"example_output":"평균: 80.0","example_exact":true,"fallback_text":"print(i, scores[i]) 를 넣어 보면 1 90, 2 70 만 나와요. 0번 점수 80 이 빠졌어요! range(1, …)는 1부터 세니까 0부터 세는 range(len(scores)) 로 바꿔요. 버그를 찾은 뒤에는 돋보기 print 를 지워요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-9: 하나 모자라요
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000044',
  'a2000000-0000-0000-0000-000000000005',
  9,
  '하나 모자라요',
  'range 끝 숫자',
  'quiz',
  'bug_hunt',
  TRUE,
  '{"topic":"마지막 값을 빼먹는 버그 찾기","learning_goals":["range의 끝 숫자는 들어가지 않아 마지막 값이 빠지는 버그를 찾을 수 있다"],"story_context":"버그버그는 1일부터 7일까지 날마다 약을 한 알씩 먹어야 해요. 그런데 약 기록 코드가 하루를 빼먹어요! 에러 쪽지 없이 조용히 틀리는 버그예요.","fallback_text":"range(시작, 끝)은 끝 숫자 바로 앞에서 멈춰요. 7일째까지 돌려면 끝 숫자가 얼마여야 할지 생각해 보세요.","quiz":{"kind":"bug_hunt","question":"7일 동안 7알 이 나와야 하는데 하루가 모자라요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-wb05","code":"pills = 0"},{"id":"ln-k2qn","code":"for day in range(1, 7):"},{"id":"ln-g8rs","code":"    pills = pills + 1"},{"id":"ln-u3hm","code":"print(f\"{day}일 동안 {pills}알\")"}],"fixes":[{"id":"fx-145j","code":"for day in range(0, 7):"},{"id":"fx-gw9k","code":"for day in range(1, 6):"},{"id":"fx-n9wb","code":"for day in range(1, 8):"},{"id":"fx-z5zg","code":"for day in range(2, 8):"}]}}'::jsonb,
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

-- 퀘스트 5-10: 고장 난 계산기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000045',
  'a2000000-0000-0000-0000-000000000005',
  10,
  '고장 난 계산기',
  '에러 세 가지 고치기',
  'code',
  NULL,
  FALSE,
  '{"topic":"여러 에러를 하나씩 읽고 고치기","learning_goals":["에러 메시지를 보고 KeyError, TypeError, IndexError를 구분할 수 있다","에러를 하나 고치고 다시 실행해 다음 에러를 찾을 수 있다","에러마다 알맞은 고치는 방법을 고를 수 있다"],"story_context":"다 나은 버그버그가 병원선 매점에서 퇴원 선물을 사려는데, 매점 계산기가 고장 났어요! 버그가 세 마리나 숨어 있대요. 하나를 고치면 다음 버그가 나타나요. 의사 선생님, 마지막 진료를 부탁해요!","exercise_description":"계산기의 버그 세 개를 고치세요. 가격표에 없는 물건은 price.get(item, 0) 으로 0원, 글자 \"2\"인 배달비는 int(delivery) 로 숫자로, 없는 번호 basket[3] 은 맨 끝 번호 basket[-1] 로 바꿔요","starter_code":"# 병원선 매점 계산기\nprice = {\"사과\": 3, \"우유\": 4, \"빵\": 5}\nbasket = [\"사과\", \"우유\", \"바나나\"]\ndelivery = \"2\"\n\ntotal = 0\nfor item in basket:\n    total = total + price[item]\nprint(f\"합계: {total}원\")\n\ntotal = total + delivery\nprint(f\"배달비 더해서: {total}원\")\n\nprint(f\"마지막 물건: {basket[3]}\")\n","expected_output_hint":"합계: 7원, 배달비 더해서: 9원, 마지막 물건: 바나나 가 한 줄씩 나와야 해요","checklist":["첫 에러(KeyError): price[item] 을 price.get(item, 0) 으로 바꿔요","둘째 에러(TypeError): delivery 를 int(delivery) 로 바꿔 더해요","셋째 에러(IndexError): basket[3] 을 basket[-1] 로 바꿔요"],"example_output":"합계: 7원\n배달비 더해서: 9원\n마지막 물건: 바나나","example_exact":true,"fallback_text":"에러는 한 번에 하나씩 나와요. KeyError 는 없는 이름표, TypeError 는 숫자와 글자처럼 섞을 수 없는 것을 더할 때, IndexError 는 없는 번호예요. 하나 고치고 다시 실행해서 다음 쪽지를 읽어요. 바나나는 가격표에 없어서 0원으로 쳐요.","is_challenge":true}'::jsonb,
  'all',
  '',
  120
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 5-11: 배탈 난 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000205',
  'a2000000-0000-0000-0000-000000000005',
  11,
  '배탈 난 버그버그',
  '에러와 디버깅 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"에러 이름, 에러가 난 줄 찾기, try 와 except 흐름 총정리","learning_goals":["짧은 코드를 보고 어떤 에러가 날지 고를 수 있다","에러가 나는 줄이나 답이 틀리게 나오는 줄을 찾아 고칠 수 있다","try 와 except 를 알맞은 차례와 들여쓰기로 놓을 수 있다"],"story_context":"병원선 침대에 환자복을 입은 버그버그가 누워 있어요. 코드를 너무 많이 먹어서 배탈이 났대요! 의사 가운을 입은 모험가가 진료 기록을 읽고 하나씩 고쳐 주면, 다 나은 버그버그가 마지막 시험을 낸대요.","fallback_text":"에러 쪽지의 맨 아래 줄에 에러 이름이 있어요. 종류가 다른 값을 섞었는지, 없는 이름이나 번호나 이름표를 찾았는지, 0으로 나눴는지 하나씩 따져 보면 어떤 에러인지 알 수 있어요. except 뒤에는 잡고 싶은 에러 이름을 써요. 에러가 없는데 답이 틀리면 print 로 중간 값을 들여다봐요.","boss":{"name":"배탈 난 버그버그","look":"hospital","intro":"아이고 배야... 코드를 너무 많이 먹었어. 의사 선생님, 여섯 군데만 고쳐 주면 다 나을 것 같아!","on_defeat":"와, 배가 하나도 안 아파! 에러 쪽지를 척척 읽는 진짜 코드 의사구나. 다음 섬 해저 산맥에는 지킴이 친구가 기다린대!","on_victory":"아야야, 아직 배가 꾸르륵해. 에러 쪽지의 맨 아래 줄을 다시 읽어 보고 또 와 줘!","rounds":[{"kind":"multiple_choice","question":"버그버그 진료 기록 1번: 이 코드를 돌리면 어떤 에러가 날까?","code":"candy = \"사탕\"\nprint(candy + 3)","options":[{"id":"opt-d3qe","text":"SyntaxError"},{"id":"opt-k9ab","text":"NameError"},{"id":"opt-t4hw","text":"TypeError"},{"id":"opt-y7mn","text":"IndexError"}]},{"kind":"multiple_choice","question":"진료 기록 2번: 이 코드를 돌리면 어떤 에러가 날까?","code":"box = {\"감기약\": 3}\nprint(box[\"연고\"])","options":[{"id":"opt-c8ur","text":"KeyError"},{"id":"opt-g6zi","text":"ZeroDivisionError"},{"id":"opt-m2ft","text":"IndexError"},{"id":"opt-w5lo","text":"ValueError"}]},{"kind":"bug_hunt","question":"진료 기록에 NameError 가 적혀 있어요. 감기약 3개 가 나오게 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-q5wa","code":"medicine = \"감기약\""},{"id":"ln-h8de","code":"count = 3"},{"id":"ln-x2pn","code":"print(f\"{medicin} {count}개\")"}],"fixes":[{"id":"fx-b6ks","code":"print(f\"{medicine} {count}개\")"},{"id":"fx-g9ma","code":"print(f\"{medicine} {count}\")"},{"id":"fx-o4tr","code":"print(f\"{medicin} {Count}개\")"},{"id":"fx-u3yc","code":"print(\"{medicine} {count}개\")"}]},{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 친구가 0명이어도 멈추지 않고 사탕을 나눠요","lines":[{"id":"ln-a4wd","code":"print(candies // friends)"},{"id":"ln-e9sk","code":"try:"},{"id":"ln-j2gc","code":"print(\"나눌 친구가 없어요\")"},{"id":"ln-n7ox","code":"except ZeroDivisionError:"},{"id":"ln-r6bq","code":"for friends in [2, 0]:"},{"id":"ln-v3mz","code":"candies = 10"}],"indent":true},{"kind":"bug_hunt","question":"except 를 써 두었는데도 abc 에서 멈춰요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-p7yt","code":"items = [\"3\", \"abc\"]"},{"id":"ln-f2hc","code":"for x in items:"},{"id":"ln-s8vn","code":"    try:"},{"id":"ln-k5qa","code":"        print(int(x) + 1)"},{"id":"ln-z3re","code":"    except TypeError:"},{"id":"ln-m6lu","code":"        print(\"숫자가 아니에요\")"}],"fixes":[{"id":"fx-c4wn","code":"    except ValueError:"},{"id":"fx-t8dj","code":"    except KeyError:"},{"id":"fx-y2bo","code":"    except NameError:"}]},{"kind":"bug_hunt","question":"에러는 안 나는데 평균이 90 이 아니라 63 이 나와요. 조용한 버그가 숨은 줄을 찾아 고쳐요","lines":[{"id":"ln-b9xe","code":"scores = [80, 90, 100]"},{"id":"ln-g4kp","code":"total = 0"},{"id":"ln-w7sm","code":"for i in range(1, len(scores)):"},{"id":"ln-d5yf","code":"    total = total + scores[i]"},{"id":"ln-r2na","code":"print(total // len(scores))"}],"fixes":[{"id":"fx-a9uv","code":"for i in range(0, len(scores) - 1):"},{"id":"fx-e6qh","code":"for i in range(len(scores)):"},{"id":"fx-s3mk","code":"for i in range(1, len(scores) + 1):"}]}],"review_quests":["b2000000-0000-0000-0000-000000000045","b2000000-0000-0000-0000-000000000039","b2000000-0000-0000-0000-000000000036","b2000000-0000-0000-0000-000000000041","b2000000-0000-0000-0000-000000000040","b2000000-0000-0000-0000-000000000043"]}}'::jsonb,
  'all',
  '',
  66
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-1: 진주 합계와 평균
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000046',
  'a2000000-0000-0000-0000-000000000006',
  1,
  '진주 합계와 평균',
  '합계·평균 직접 구하기',
  'code',
  NULL,
  FALSE,
  '{"topic":"sum() 없이 합계와 평균 구하기","learning_goals":["for로 하나씩 더해 합계를 직접 구할 수 있다","합계를 개수로 나누고 round(값, 1)로 평균을 구할 수 있다","내가 만든 결과가 sum()과 같은지 ==로 확인할 수 있다"],"story_context":"바다 밑 산맥 입구에 버그버그가 \"내장 함수 금지 구역\" 팻말을 세워 놨어요! 내장 함수는 sum, max, sort 처럼 파이썬에 처음부터 들어 있는 함수예요. 이걸 못 쓴대요. 첫 봉우리에서는 진주 다섯 알의 무게를 직접 더해 합계와 평균을 구해야 해요.","exercise_description":"sum() 없이 for 로 진주 무게를 더해 \"합계: 53\"과 \"평균: 10.6\"을 출력하세요. 마지막 줄은 sum() 과 같은지 확인해요","starter_code":"pearls = [12, 7, 15, 9, 10]\ntotal = 0\n\n# 1) sum() 없이 for 로 하나씩 더해요\n___\n\nprint(f\"합계: {total}\")\n\n# 2) 평균 = 합계 ÷ 개수, 소수 첫째 자리까지\navg = ___\nprint(f\"평균: {avg}\")\n\n# 3) 내가 구한 합계가 sum() 과 같은지 확인해요\nprint(total == sum(pearls))\n","expected_output_hint":"합계: 53, 평균: 10.6, True 가 한 줄씩 나와야 해요","checklist":["for p in pearls: 아래에서 total = total + p 로 더해요","avg = round(total / len(pearls), 1) 로 평균을 구해요","마지막 줄에 True 가 나오는지 봐요"],"example_output":"합계: 53\n평균: 10.6\nTrue","example_exact":true,"fallback_text":"합계는 빈 바구니 total = 0 에서 시작해 진주를 하나씩 넣는 것과 같아요. 평균은 합계를 개수 len(pearls) 로 나눈 값이고, round(값, 1)로 소수 첫째 자리까지만 보여 줘요. 마지막 줄이 True 면 내가 만든 방법이 sum() 과 똑같다는 뜻이에요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-2: 가장 큰 물고기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000047',
  'a2000000-0000-0000-0000-000000000006',
  2,
  '가장 큰 물고기',
  '최댓값 직접 찾기',
  'code',
  NULL,
  FALSE,
  '{"topic":"max() 없이 가장 큰 값 찾기","learning_goals":["첫 값을 대장으로 정하고, 더 큰 값을 만나면 대장을 바꿔 최댓값을 찾을 수 있다","이런 차근차근한 순서를 알고리즘이라고 부른다는 것을 안다"],"story_context":"두 번째 봉우리에서 물고기 대회가 열렸어요! 가장 큰 물고기가 금메달이에요. max() 는 금지니까, 물고기를 한 마리씩 보며 \"지금까지 가장 큰 물고기\"인 대장을 기억해 둬요.","exercise_description":"best 를 첫 물고기 fish[0] 으로 정하고, for 로 돌며 f 가 best 보다 크면 best 를 f 로 바꿔 \"가장 큰 물고기: 77cm\"를 출력하세요","starter_code":"fish = [34, 52, 18, 77, 45]\n\n# max() 없이 찾아요! 첫 물고기를 대장으로 정해요\nbest = fish[0]\n\nfor f in fish:\n    # 대장보다 큰 물고기를 만나면 대장을 바꿔요\n    ___\n\nprint(f\"가장 큰 물고기: {best}cm\")\n","expected_output_hint":"가장 큰 물고기: 77cm 가 나와야 해요","checklist":["if f > best: 로 대장과 비교해요","if 안에서 best = f 로 대장을 바꿔요"],"example_output":"가장 큰 물고기: 77cm","example_exact":true,"fallback_text":"대장 찾기 알고리즘: ① 첫 물고기를 대장으로 정해요. ② 다음 물고기가 대장보다 크면 그 물고기가 새 대장이에요. ③ 끝까지 보면 남은 대장이 가장 커요. 34 → 52 → 77 순서로 대장이 바뀌어요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-3: 대장이 몇 번 바뀔까?
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000048',
  'a2000000-0000-0000-0000-000000000006',
  3,
  '대장이 몇 번 바뀔까?',
  '최댓값 추적',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"최댓값 찾기를 손으로 따라가기","learning_goals":["대장보다 큰 값을 만날 때만 대장이 바뀐다는 것을 따라갈 수 있다"],"story_context":"버그버그가 대장 찾기 코드에 확성기를 달았어요. 대장이 바뀔 때마다 새 대장을 외친대요. 무엇을 외칠지 맞혀 봐요!","fallback_text":"숫자를 하나씩 보며 지금 대장과 비교해 보세요. 대장보다 클 때만 대장이 바뀌고 외쳐요. 대장과 같거나 작으면 조용해요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"best = 3\nfor n in [3, 8, 5, 9, 2]:\n    if n > best:\n        best = n\n        print(best)","options":[{"id":"opt-02jo","text":"3\n8\n9"},{"id":"opt-5in5","text":"8\n5\n9"},{"id":"opt-8vqv","text":"8\n9"},{"id":"opt-ev9f","text":"9"}]}}'::jsonb,
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

-- 퀘스트 6-4: 키 큰 친구 세기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000049',
  'a2000000-0000-0000-0000-000000000006',
  4,
  '키 큰 친구 세기',
  '조건에 맞는 것 골라내기',
  'code',
  NULL,
  FALSE,
  '{"topic":"조건에 맞는 값만 새 리스트에 담기","learning_goals":["if로 조건에 맞는 값만 골라 새 리스트에 append할 수 있다","len()으로 골라낸 개수를 셀 수 있다"],"story_context":"세 번째 봉우리에는 해저 케이블카가 있어요. 그런데 키가 130cm 이상인 친구만 탈 수 있대요! 친구들 키를 하나씩 보고 탈 수 있는 친구만 골라 줘요.","exercise_description":"heights 를 돌며 키 h 가 130 이상이면 tall 에 append 하고, tall 리스트와 \"130cm 이상: 4명\"을 출력하세요","starter_code":"heights = [128, 135, 141, 126, 130, 133, 129]\ntall = []\n\nfor h in heights:\n    # 130 이상이면 tall 에 담아요\n    ___\n\nprint(tall)\nprint(f\"130cm 이상: {len(tall)}명\")\n","expected_output_hint":"[135, 141, 130, 133] 과 130cm 이상: 4명 이 나와야 해요","checklist":["if h >= 130: 으로 물어봐요","if 안에서 tall.append(h) 로 담아요","두 줄이 나오는지 봐요"],"example_output":"[135, 141, 130, 133]\n130cm 이상: 4명","example_exact":true,"fallback_text":"빈 리스트 tall = [] 를 바구니로 두고, 조건 h >= 130 에 맞는 키만 tall.append(h) 로 담아요. 130 \"이상\"은 130도 들어가니까 > 가 아니라 >= 예요. 다 담은 뒤 len(tall)로 세면 몇 명인지 알 수 있어요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-5: 조개 속 진주 찾기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000050',
  'a2000000-0000-0000-0000-000000000006',
  5,
  '조개 속 진주 찾기',
  '차례로 찾기(검색) + break',
  'code',
  NULL,
  FALSE,
  '{"topic":"차례로 열어 보며 찾기","learning_goals":["앞에서부터 하나씩 열어 보며 찾는 검색 순서를 코드로 쓸 수 있다","찾으면 break로 반복을 바로 멈출 수 있다","찾았는지를 True/False 표시로 기억해 두었다가 결과를 알려 줄 수 있다"],"story_context":"네 번째 봉우리 바닥에 조개가 줄지어 있어요. 이 중 어딘가에 진주가 숨어 있대요! 조개를 하나씩 열어 보다가 진주를 찾으면 더 열지 말고 멈춰요. 조개를 너무 많이 열면 조개가 화를 내거든요.","exercise_description":"조개를 하나씩 열며 opened 를 세다가 \"진주\"를 찾으면 found 를 True 로 바꾸고 break 로 멈춰요. 그러면 아래 코드가 \"3번째 조개에서 찾았어요\"를 출력해요","starter_code":"beach = [\"모래\", \"미역\", \"진주\", \"돌멩이\", \"진주\"]\nopened = 0\nfound = False\n\nfor shell in beach:\n    opened = opened + 1\n    print(f\"{opened}번째 조개를 열어요\")\n    if shell == \"진주\":\n        # 찾았다고 표시하고, 더 열지 않고 멈춰요\n        ___\n\nif found:\n    print(f\"{opened}번째 조개에서 찾았어요\")\nelse:\n    print(\"없어요\")\n","expected_output_hint":"조개를 3번째까지만 열고 3번째 조개에서 찾았어요 가 나와야 해요","checklist":["found = True 로 찾았다고 표시해요","바로 다음 줄에 break 를 써서 멈춰요","조개를 3번째까지만 여는지 봐요"],"example_output":"1번째 조개를 열어요\n2번째 조개를 열어요\n3번째 조개를 열어요\n3번째 조개에서 찾았어요","example_exact":true,"fallback_text":"차례로 찾기 알고리즘: 앞에서부터 하나씩 열어 보고, 찾으면 그 자리에서 멈춰요. break 는 반복을 바로 끝내는 주문이에요. break 가 없으면 5번째 진주까지 열어 버려서 \"5번째\"가 나와요. 진주가 하나도 없으면 found 가 False 그대로라 \"없어요\"가 나와요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-6: 대장 찾기 빈칸
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000051',
  'a2000000-0000-0000-0000-000000000006',
  6,
  '대장 찾기 빈칸',
  '최댓값 찾기',
  'quiz',
  'fill_blank',
  TRUE,
  '{"topic":"최댓값 찾기 코드 완성하기","learning_goals":["대장과 비교하는 기호와 대장을 바꾸는 값을 고를 수 있다"],"story_context":"버그버그가 대장 찾기 주문 두 군데를 지워 놨어요! 빈칸을 채워 가장 큰 수 9를 찾아 줘요.","fallback_text":"지금 보는 수가 대장보다 커야 대장이 바뀌어요. 대장이 바뀔 때는 지금 보는 수가 새 대장이 돼요.","quiz":{"kind":"fill_blank","question":"빈칸을 채워 가장 큰 수 9가 나오게 해요","code":"nums = [4, 9, 6]\nbest = nums[0]\nfor n in nums:\n    if n {{bk-s4dq}} best:\n        best = {{bk-7mzc}}\nprint(best)","tokens":[{"id":"tok-c8pe","text":">"},{"id":"tok-h5ug","text":"n"},{"id":"tok-o4tb","text":"best"},{"id":"tok-q2wl","text":"<"},{"id":"tok-y3fk","text":"0"}]}}'::jsonb,
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

-- 퀘스트 6-7: 업다운 마법
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000052',
  'a2000000-0000-0000-0000-000000000006',
  7,
  '업다운 마법',
  '반씩 줄여 찾기',
  'code',
  NULL,
  FALSE,
  '{"topic":"가운데를 골라 반씩 줄여 찾기","learning_goals":["범위의 가운데 수 (low + high) // 2 를 골라 추측할 수 있다","업이면 low를, 다운이면 high를 바꿔 찾을 범위를 반으로 줄일 수 있다","반씩 줄여 찾으면 차례로 찾기보다 훨씬 빨리 찾는다는 것을 안다"],"story_context":"다섯 번째 봉우리 문지기가 1부터 100 사이의 비밀 수를 생각했대요. 파이썬 섬에서 했던 숫자 맞추기 게임 기억나요? 이번엔 컴퓨터가 가장 똑똑하게 맞히는 업다운 마법을 써 봐요. 언제나 남은 범위의 한가운데를 부르는 거예요!","exercise_description":"업이면 low 를, 다운이면 high 를 바꿔 찾을 범위를 반씩 줄이세요. 추측을 한 줄씩 보여 주고 마지막에 \"7번 만에 찾았어요\"가 나와야 해요","starter_code":"secret = 77\nlow = 1\nhigh = 100\ntries = 0\nguess = 0\n\nwhile guess != secret:\n    # // 2 는 반으로 나눈 몫이에요 (소수점은 버려요)\n    guess = (low + high) // 2\n    tries = tries + 1\n    if guess < secret:\n        print(f\"{guess}: 업!\")\n        # 비밀 수는 guess 보다 커요. 범위의 아래쪽 끝을 올려요\n        low = ___\n    elif guess > secret:\n        print(f\"{guess}: 다운!\")\n        # 비밀 수는 guess 보다 작아요. 범위의 위쪽 끝을 내려요\n        high = ___\n    else:\n        print(f\"{guess}: 정답!\")\n\nprint(f\"{tries}번 만에 찾았어요\")\n","expected_output_hint":"50: 업! 부터 77: 정답! 까지 7줄과 7번 만에 찾았어요 가 나와야 해요","checklist":["업이면 low = guess + 1 이에요","다운이면 high = guess - 1 이에요","7번 만에 찾았는지 봐요"],"example_output":"50: 업!\n75: 업!\n88: 다운!\n81: 다운!\n78: 다운!\n76: 업!\n77: 정답!\n7번 만에 찾았어요","example_exact":true,"fallback_text":"업다운 마법: 1~100의 가운데 50을 불러요. \"업!\"이면 비밀 수는 51~100 안에 있으니 low 를 guess + 1 로 올려요. \"다운!\"이면 high 를 guess - 1 로 내려요. 부를 때마다 남은 범위가 반으로 줄어서, 1부터 차례로 부르면 77번 걸릴 것을 7번 만에 찾아요. guess 는 이미 아니라고 확인했으니 범위에서 빼요. + 1, - 1 을 빠뜨리면 88 대신 87 처럼 숫자가 어긋나요."}'::jsonb,
  'all',
  '',
  85
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-8: 키 순서대로 줄 서기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000053',
  'a2000000-0000-0000-0000-000000000006',
  8,
  '키 순서대로 줄 서기',
  '정렬 직접 만들기',
  'code',
  NULL,
  FALSE,
  '{"topic":"가장 작은 것을 차례로 뽑아 줄 세우기","learning_goals":["남은 것 중 가장 작은 값을 min()으로 찾을 수 있다","리스트.remove(값)으로 그 값을 리스트에서 뺄 수 있다","가장 작은 것을 하나씩 뽑아 새 줄 뒤에 세우는 방법으로 정렬을 만들 수 있다"],"story_context":"드디어 산맥 꼭대기예요! 친구 다섯 명이 사진을 찍으려고 키 순서대로 줄을 서야 해요. sort() 는 금지 구역이라 못 써요. 남은 친구 중 가장 작은 친구를 불러 새 줄 맨 뒤에 세우는 걸 되풀이하면 줄이 완성돼요.","exercise_description":"남은 줄에서 가장 작은 키를 찾아 빼고, 새 줄 맨 뒤에 세우는 일을 5번 되풀이해 키 순서대로 줄을 세우세요","starter_code":"line = [132, 125, 140, 128, 136]\ncheck = sorted(line)\nnew_line = []\n\n# 친구 수(5명)만큼 반복해요\nfor i in range(5):\n    # 1) 남은 친구 중 가장 작은 키를 찾아요\n    shortest = ___\n    # 2) 그 친구를 원래 줄에서 빼요\n    ___\n    # 3) 새 줄 맨 뒤에 세워요\n    ___\n    print(new_line)\n\nprint(new_line == check)\n","expected_output_hint":"새 줄이 [125] 부터 한 명씩 늘어 [125, 128, 132, 136, 140] 이 되고, 마지막에 True 가 나와야 해요","checklist":["shortest = min(line) 으로 가장 작은 키를 찾아요","line.remove(shortest) 로 원래 줄에서 빼요","new_line.append(shortest) 로 새 줄에 세우고, 마지막에 True 가 나오는지 봐요"],"example_output":"[125]\n[125, 128]\n[125, 128, 132]\n[125, 128, 132, 136]\n[125, 128, 132, 136, 140]\nTrue","example_exact":true,"fallback_text":"줄 세우기 알고리즘: ① 남은 친구 중 가장 작은 친구를 찾아요(min). ② 그 친구를 원래 줄에서 빼요. 리스트.remove(값)은 리스트에서 그 값을 찾아 빼 주는 메서드예요. ③ 새 줄 맨 뒤에 세워요(append). 다섯 번 되풀이하면 작은 키부터 줄이 서요. sorted(line)은 정렬한 새 리스트를 돌려줘서 확인용으로 써요.","is_challenge":true}'::jsonb,
  'all',
  '',
  120
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 6-9: 산맥 지킴이 버그버그
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000206',
  'a2000000-0000-0000-0000-000000000006',
  9,
  '산맥 지킴이 버그버그',
  '기초 알고리즘 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"합과 평균, 최댓값 찾기, 검색 횟수, 반씩 줄여 찾기, 줄 세우기 총정리","learning_goals":["합, 평균, 가장 큰 값을 직접 구하는 코드를 따라갈 수 있다","차례로 찾기와 반씩 줄여 찾기가 어떻게 움직이는지 설명할 수 있다","가장 작은 것을 차례로 뽑아 줄 세우는 코드를 알맞은 차례로 놓을 수 있다"],"story_context":"해저 산맥의 가장 높은 봉우리에 오르자, 커다란 돌 갑옷을 입은 버그버그가 길을 막았어요! 산맥 지킴이래요. 내장 함수 없이 직접 생각하는 힘을 보여 주면 길을 비켜 준대요.","fallback_text":"알고리즘은 문제를 푸는 순서예요. 합은 0에서 시작해 하나씩 더하고, 가장 큰 값은 첫 값을 대장으로 두고 더 큰 값이 나오면 바꿔요. 찾으면 break 로 멈추고, 반씩 줄여 찾을 때는 가운데를 먼저 봐요. 줄 세우기는 남은 것 중 가장 작은 것을 하나씩 데려와요.","boss":{"name":"산맥 지킴이 버그버그","look":"ridge","intro":"쿵! 나는 산맥 지킴이 버그버그다. 여기서부터는 내장 함수 금지 구역! 일곱 문제를 풀어야 지나갈 수 있지.","on_defeat":"쿵... 졌다! 머리로 차근차근 생각하는 힘이 정말 대단해. 이제 마지막 항구로 가 봐. 거기엔 엄청 큰 선장 모자를 쓴 녀석이 있대!","on_victory":"쿵쿵, 아직 산을 넘기엔 이르다! 종이에 값을 한 줄씩 적어 가며 따라가 보고 다시 오너라.","rounds":[{"kind":"multiple_choice","question":"진주 세 알의 무게를 더하고 평균을 내요. 돌리면 무엇이 나올까?","code":"pearls = [3, 5, 4]\ntotal = 0\nfor p in pearls:\n    total = total + p\nprint(total, round(total / len(pearls), 1))","options":[{"id":"opt-f8ky","text":"12 3.0"},{"id":"opt-j6sw","text":"12 4.0"},{"id":"opt-q2dn","text":"12 4"},{"id":"opt-v5mb","text":"4.0 12"}]},{"kind":"multiple_choice","question":"물고기 대장이 바뀔 때마다 알려 줘요. 돌리면 무엇이 나올까?","code":"fish = [4, 9, 2, 11, 7]\nleader = fish[0]\nfor f in fish:\n    if f > leader:\n        leader = f\n        print(leader)","options":[{"id":"opt-c7ua","text":"4\n9\n11"},{"id":"opt-n4gt","text":"11"},{"id":"opt-r3hx","text":"9\n11"},{"id":"opt-w9ep","text":"9\n11\n7"}]},{"kind":"fill_blank","question":"빈칸을 채워 키가 130 이상인 친구만 새 리스트에 담고 몇 명인지 보여 줘요","code":"heights = [128, 135, 131, 140]\ntall = []\nfor h in heights:\n    if h {{bk-p6rd}} 130:\n        tall.{{bk-x3vf}}(h)\nprint(len(tall))","tokens":[{"id":"tok-b8lo","text":"<"},{"id":"tok-g5wq","text":">="},{"id":"tok-k2ez","text":"remove"},{"id":"tok-s4ny","text":"append"}]},{"kind":"multiple_choice","question":"조개를 하나씩 열어 진주를 찾아요. 돌리면 무엇이 나올까?","code":"shells = [\"모래\", \"돌\", \"진주\", \"돌\"]\nopened = 0\nfor s in shells:\n    opened = opened + 1\n    if s == \"진주\":\n        break\nprint(f\"{opened}번 열었어요\")","options":[{"id":"opt-e5qm","text":"4번 열었어요"},{"id":"opt-h2zc","text":"2번 열었어요"},{"id":"opt-t6ja","text":"1번 열었어요"},{"id":"opt-y8bk","text":"3번 열었어요"}]},{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 진주가 몇 번째 조개에 있는지 찾으면 바로 멈춰요","lines":[{"id":"ln-b4re","code":"if shells[i] == \"진주\":"},{"id":"ln-f9dt","code":"break"},{"id":"ln-m3vc","code":"shells = [\"돌\", \"진주\", \"모래\"]"},{"id":"ln-w6py","code":"print(f\"{i + 1}번째 조개에서 찾았어요\")"},{"id":"ln-z8ka","code":"for i in range(len(shells)):"}],"indent":true},{"kind":"fill_blank","question":"업다운 마법으로 비밀 수 70 을 찾아요. 빈칸을 채워 가운데 수를 고르고, 업이면 아래쪽 끝을 올려요","code":"secret = 70\nlow = 1\nhigh = 100\nguess = (low + high) {{bk-h7nu}} 2\nif guess < secret:\n    low = guess {{bk-d4sa}} 1\nprint(guess, low, high)","tokens":[{"id":"tok-a3mf","text":"/"},{"id":"tok-e2tg","text":"-"},{"id":"tok-r9cx","text":"//"},{"id":"tok-w7jb","text":"+"}]},{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 가장 작은 키를 하나씩 데려와 새 줄에 세워요","lines":[{"id":"ln-a8fp","code":"line.remove(small)"},{"id":"ln-c2qn","code":"new_line = []"},{"id":"ln-e6lz","code":"print(new_line)"},{"id":"ln-g3yx","code":"small = min(line)"},{"id":"ln-k9wd","code":"while len(line) > 0:"},{"id":"ln-s5ob","code":"new_line.append(small)"},{"id":"ln-u7hs","code":"line = [5, 3, 8]"}],"indent":true}],"review_quests":["b2000000-0000-0000-0000-000000000046","b2000000-0000-0000-0000-000000000047","b2000000-0000-0000-0000-000000000049","b2000000-0000-0000-0000-000000000050","b2000000-0000-0000-0000-000000000050","b2000000-0000-0000-0000-000000000052","b2000000-0000-0000-0000-000000000053"]}}'::jsonb,
  'all',
  '',
  72
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 7-1: 기록 함수 순서
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000054',
  'a2000000-0000-0000-0000-000000000007',
  1,
  '기록 함수 순서',
  '함수 + 딕셔너리 + 리스트',
  'quiz',
  'parsons',
  TRUE,
  '{"topic":"딕셔너리를 만들어 리스트에 더하는 함수","learning_goals":["함수 안에서 딕셔너리를 만들고 리스트에 더하는 차례와 들여쓰기를 고를 수 있다"],"story_context":"항구에 내리자마자 바람이 휙 불어서 기록 함수 주문 쪽지가 뒤죽박죽 섞였어요! 줄 순서와 들여쓰기를 맞춰 쪽지를 다시 붙여 줘요.","fallback_text":"빈 리스트는 함수를 부르기 전에만 있으면 돼요. 함수 안에서는 기록 딕셔너리를 먼저 만들고, 그다음에 리스트에 더해요. 함수를 만든 뒤에 불러야 하고, 기록 수는 맨 마지막에 보여 줘요.","quiz":{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, 기록 하나를 더한 뒤 기록 수를 보여 줘요","lines":[{"id":"ln-a2vq","code":"records.append(record)"},{"id":"ln-c8zt","code":"def add_record(name, money):"},{"id":"ln-e4ys","code":"print(len(records))"},{"id":"ln-m7pe","code":"add_record(\"간식\", -1500)"},{"id":"ln-r5hb","code":"record = {\"내용\": name, \"금액\": money}"},{"id":"ln-w3kd","code":"records = []"}],"indent":true}}'::jsonb,
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

-- 퀘스트 7-2: 용돈 기입장
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000055',
  'a2000000-0000-0000-0000-000000000007',
  2,
  '용돈 기입장',
  '딕셔너리 + 리스트 + 함수 종합',
  'project',
  NULL,
  FALSE,
  '{"topic":"응용 프로젝트: 용돈 기입장 만들기","learning_goals":["딕셔너리, 리스트, 함수, f-string을 한 프로그램에서 함께 쓸 수 있다","큰 프로그램을 작은 단계로 나눠 하나씩 만들 수 있다","합계와 가장 큰 값을 직접 계산해 보고서를 만들 수 있다"],"story_context":"응용 프로젝트 항구에 도착했어요! 배를 타고 오는 동안 용돈을 어디에 썼는지 하나도 기억나지 않아요. 파이뱀과 함께 들어온 돈과 나간 돈을 적는 기입장 프로그램을 만들어, 이번 달 보고서를 완성해 봐요.","exercise_description":"용돈 기록을 딕셔너리로 적고, 리스트에 모으고, 함수로 더하고 계산해서 이번 달 보고서를 만드세요. 5단계로 하나씩 기능을 더해요!","starter_code":"# 용돈 기입장을 만들어 봐요!\n","expected_output_hint":"프로젝트를 5단계로 나누어 완성해요","fallback_text":"용돈 기입장은 기록 하나를 이름표가 붙은 딕셔너리로 적는 데서 시작해요. 기록을 리스트에 모으고, 함수로 새 기록을 더하고, 반복하며 금액을 더하면 남은 돈을 알 수 있어요. 한 단계씩 차근차근 가 봐요!","steps":[{"step_number":1,"step_goal":"기록 하나를 딕셔너리로 만들고, 내용과 금액을 꺼내 f-string으로 보여 주기","checklist":["record[\"내용\"] 처럼 이름표로 값을 꺼내요","f-string으로 \"용돈: 5000원\" 모양을 만들어요"],"example_output":"용돈: 5000원","example_exact":true,"starter_code":"# 1단계: 기록 하나를 딕셔너리로 만들어요\nrecord = {\"내용\": \"용돈\", \"금액\": 5000}\n\n# record 에서 내용과 금액을 꺼내요\nname = record[___]\nmoney = record[___]\nprint(f\"{name}: {money}원\")\n","validation_type":"all","fallback_text":"딕셔너리는 이름표(키)가 붙은 상자예요. record[\"내용\"] 이라고 쓰면 \"내용\" 이름표가 붙은 상자에서 값을 꺼내요. 꺼낸 값을 f-string의 중괄호 안에 넣어 한 줄로 보여 주세요."},{"step_number":2,"step_goal":"기록 여러 개를 리스트에 담고, for 로 한 줄씩 보여 주기","checklist":["for record in records: 로 기록을 하나씩 꺼내요","1단계처럼 내용과 금액을 꺼내 한 줄로 보여 줘요","[기입장] 아래에 기록 세 줄이 나오는지 봐요"],"example_output":"용돈: 5000원\n[기입장]\n용돈: 5000원\n간식: -1500원\n저금: -2000원","starter_code":"\n# 2단계: 기록 여러 개를 리스트에 담아요\nrecords = [\n    {\"내용\": \"용돈\", \"금액\": 5000},\n    {\"내용\": \"간식\", \"금액\": -1500},\n    {\"내용\": \"저금\", \"금액\": -2000},\n]\n\nprint(\"[기입장]\")\nfor record in records:\n    # 기록 하나를 1단계처럼 한 줄로 보여 줘요\n    ___\n","validation_type":"all","fallback_text":"리스트 안에 딕셔너리를 여러 개 넣을 수 있어요. for 로 리스트를 돌면 record 에 기록이 하나씩 들어와요. 반복 안에서 1단계와 똑같이 내용과 금액을 꺼내 보여 주면 돼요. 쓴 돈은 빼기(-)로 적었어요."},{"step_number":3,"step_goal":"add_record(내용, 금액) 함수로 새 기록을 리스트에 더하기","checklist":["함수 안에서 새 기록 딕셔너리를 만들어요","records.append( )로 리스트에 더해요","기록 5개 가 나오는지 봐요"],"example_output":"용돈: 5000원\n[기입장]\n용돈: 5000원\n간식: -1500원\n저금: -2000원\n기록 5개","starter_code":"\n# 3단계: 기록을 더하는 함수를 만들어요\ndef add_record(name, money):\n    # 새 기록 딕셔너리를 records 에 더해요\n    ___\n\nadd_record(\"간식\", -800)\nadd_record(\"심부름\", 1000)\nprint(f\"기록 {len(records)}개\")\n","validation_type":"all","fallback_text":"함수를 만들어 두면 같은 일을 이름 하나로 여러 번 할 수 있어요. add_record 안에서 {\"내용\": name, \"금액\": money} 로 새 기록을 만들고, 리스트 끝에 더하는 append 로 records 에 넣어요."},{"step_number":4,"step_goal":"total() 함수로 남은 돈을 돌려받고, 들어온 돈과 나간 돈의 합계도 보여 주기","checklist":["total() 안에서 금액을 left 에 하나씩 더해요","쓴 돈은 빼기로 적혀 있어서, 나간 돈은 빼서 더해요","들어온 돈, 나간 돈, 남은 돈 세 줄을 봐요"],"example_output":"용돈: 5000원\n[기입장]\n용돈: 5000원\n간식: -1500원\n저금: -2000원\n기록 5개\n들어온 돈: 6000원\n나간 돈: 4300원\n남은 돈: 1700원","starter_code":"\n# 4단계: 남은 돈을 계산하는 함수를 만들어요\ndef total():\n    left = 0\n    for record in records:\n        # 금액을 left 에 더해요\n        ___\n    return left\n\nincome = 0\nspend = 0\nfor record in records:\n    if record[\"금액\"] > 0:\n        income = income + record[\"금액\"]\n    else:\n        # 빼기로 적힌 금액을 빼면 나간 돈이 커져요\n        # 예: 0 - (-1500) 은 0 + 1500 이라 1500 이 돼요\n        spend = spend - ___\n\nprint(f\"들어온 돈: {income}원\")\nprint(f\"나간 돈: {spend}원\")\nprint(f\"남은 돈: {total()}원\")\n","validation_type":"all","fallback_text":"남은 돈은 모든 금액을 차례로 더하면 나와요. 들어온 돈은 더하기, 쓴 돈은 빼기로 적었으니 그냥 모두 더하면 돼요. 함수는 return 으로 계산한 값을 돌려줘요. 나간 돈은 빼기로 적힌 금액을 한 번 더 빼서 더하기 수로 만들어요."},{"step_number":5,"step_goal":"내용별로 쓴 돈을 딕셔너리에 모으고, 가장 많이 쓴 곳을 찾아 이번 달 보고서 만들기","checklist":["쓴 돈을 내용별로 spent 딕셔너리에 모아요","더 큰 금액이 나오면 big_name 과 big_money 를 바꿔요","보고서 마지막 줄에 가장 많이 쓴 곳이 나오는지 봐요"],"example_output":"용돈: 5000원\n[기입장]\n용돈: 5000원\n간식: -1500원\n저금: -2000원\n기록 5개\n들어온 돈: 6000원\n나간 돈: 4300원\n남은 돈: 1700원\n[이번 달 보고서]\n간식: 2300원\n저금: 2000원\n선물: 2500원\n가장 많이 쓴 곳: 선물","starter_code":"\n# 5단계: 이번 달 보고서를 만들어요\nadd_record(\"선물\", -2500)\n\nspent = {}\nfor record in records:\n    if record[\"금액\"] < 0:\n        name = record[\"내용\"]\n        # not in 은 \"안에 없으면\"이에요. 처음 보는 내용이면 0 에서 시작해요\n        if name not in spent:\n            spent[name] = 0\n        spent[name] = spent[name] - record[\"금액\"]\n\nprint(\"[이번 달 보고서]\")\nbig_name = \"\"\nbig_money = 0\nfor name, money in spent.items():\n    print(f\"{name}: {money}원\")\n    # 지금까지 가장 큰 금액보다 크면 대장을 바꿔요\n    if ___:\n        big_name = name\n        big_money = money\nprint(f\"가장 많이 쓴 곳: {big_name}\")\n","validation_type":"all","fallback_text":"내용별 합계는 등대 도서관에서 투표를 세던 방법과 같아요. 처음 보는 내용이면 0으로 시작하고 금액을 더해요. 가장 큰 값은 산맥에서 배운 대로, 지금까지의 대장보다 큰 값이 나오면 대장을 바꾸면 찾을 수 있어요."}]}'::jsonb,
  'all',
  '',
  300
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 7-3: 기록장 읽기
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000056',
  'a2000000-0000-0000-0000-000000000007',
  3,
  '기록장 읽기',
  '리스트 속 딕셔너리',
  'quiz',
  'multiple_choice',
  TRUE,
  '{"topic":"리스트 번호와 딕셔너리 이름표로 값 꺼내기","learning_goals":["리스트 속 딕셔너리에서 번호와 이름표를 차례로 써서 값을 꺼낼 수 있다"],"story_context":"별똥이가 용돈 기입장을 몰래 읽어 보려고 해요. 리스트 번호와 이름표를 차례로 따라가면 어떤 값이 나올까요?","fallback_text":"먼저 대괄호 안의 번호로 리스트에서 기록 하나를 꺼내요. 리스트 번호는 0부터 세요. 그다음 이름표로 그 기록 딕셔너리에서 값을 꺼내요. print 에 쉼표로 두 값을 주면 사이에 빈칸 하나가 들어가요.","quiz":{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"records = [{\"내용\": \"용돈\", \"금액\": 5000},\n           {\"내용\": \"간식\", \"금액\": -1500}]\nprint(records[1][\"내용\"], records[0][\"금액\"])","options":[{"id":"opt-b6ur","text":"간식 -1500"},{"id":"opt-h4nw","text":"간식 5000"},{"id":"opt-t9cb","text":"용돈 -1500"},{"id":"opt-x2gf","text":"용돈 5000"}]}}'::jsonb,
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

-- 퀘스트 7-4: 단어 퀴즈 프로그램
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000057',
  'a2000000-0000-0000-0000-000000000007',
  4,
  '단어 퀴즈 프로그램',
  '딕셔너리 + 함수 + random 종합',
  'project',
  NULL,
  FALSE,
  '{"topic":"응용 프로젝트: 영어 단어 퀴즈 만들기","learning_goals":["딕셔너리와 함수로 채점하는 프로그램을 만들 수 있다","random.shuffle로 문제 순서를 섞어도 점수는 같다는 것을 확인할 수 있다","틀린 단어를 리스트에 모아 오답 노트를 만들 수 있다"],"story_context":"항구의 선원 학교에서 영어 단어 시험을 본대요! 별똥이가 친구들 답안지를 한 장 주워 왔어요. 파이뱀과 함께 단어장을 만들고, 답안지를 채점하고, 틀린 단어를 모은 오답 노트까지 만드는 퀴즈 프로그램을 완성해 봐요.","exercise_description":"영어 단어와 뜻을 담은 단어장 딕셔너리를 만들고, 답을 채점하는 함수, 문제 순서 섞기, 오답 노트까지 5단계로 하나씩 더해 단어 퀴즈 프로그램을 완성하세요.","starter_code":"# 단어 퀴즈 프로그램을 만들어 봐요!\n","expected_output_hint":"프로젝트를 5단계로 나누어 완성해요","fallback_text":"단어 퀴즈는 영어 단어를 이름표, 우리말 뜻을 내용으로 하는 딕셔너리에서 시작해요. 답이 맞는지 알려 주는 함수를 만들고, 반복하며 맞힌 개수를 세요. 순서를 섞어도 맞힌 개수는 그대로라는 것도 확인해 봐요!","steps":[{"step_number":1,"step_goal":"영어 단어 5개와 뜻을 담은 단어장 딕셔너리를 만들고 .items()로 모두 보여 주기","checklist":["words 뒤 빈칸에 이름표와 내용을 함께 꺼내는 메서드를 넣어요","단어 = 뜻 모양으로 다섯 줄이 나오는지 봐요"],"example_output":"apple = 사과\nsea = 바다\nstar = 별\nfish = 물고기\nship = 배","example_exact":true,"starter_code":"# 1단계: 단어장을 만들어요\nwords = {\"apple\": \"사과\", \"sea\": \"바다\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"배\"}\n\nfor eng, kor in words.___():\n    print(f\"{eng} = {kor}\")\n","validation_type":"all","fallback_text":"딕셔너리를 돌 때 이름표와 내용을 한 쌍씩 꺼내려면 등대 도서관에서 배운 메서드를 써요. eng 에는 영어 단어, kor 에는 우리말 뜻이 들어가요."},{"step_number":2,"step_goal":"check(단어, 답) 함수를 만들어 답이 맞으면 True, 틀리면 False 돌려주기","checklist":["단어장에서 꺼낸 뜻과 답이 같은지 == 로 비교해요","True 와 False 가 한 줄씩 나오는지 봐요"],"example_output":"apple = 사과\nsea = 바다\nstar = 별\nfish = 물고기\nship = 배\nTrue\nFalse","starter_code":"\n# 2단계: 답이 맞는지 알려 주는 함수\ndef check(word, answer):\n    # 단어장의 뜻과 답이 같으면 True, 다르면 False 를 돌려줘요\n    return ___\n\nprint(check(\"sea\", \"바다\"))\nprint(check(\"star\", \"달\"))\n","validation_type":"all","fallback_text":"words[word] 로 단어장에서 그 단어의 뜻을 꺼낼 수 있어요. 두 값이 같은지 == 로 비교하면 그 결과가 바로 True 나 False 예요. 그 결과를 return 으로 돌려주면 돼요."},{"step_number":3,"step_goal":"친구가 적은 답안지 딕셔너리를 check 로 채점해 맞힌 개수 보여 주기","checklist":["for 로 답안지의 단어와 답을 한 쌍씩 꺼내요","check 가 True 면 score 에 1을 더해요","맞힌 개수: 3/5 가 나오는지 봐요"],"example_output":"apple = 사과\nsea = 바다\nstar = 별\nfish = 물고기\nship = 배\nTrue\nFalse\n맞힌 개수: 3/5","starter_code":"\n# 3단계: 친구가 적은 답안지를 채점해요\nanswers = {\"apple\": \"사과\", \"sea\": \"산\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"새\"}\n\nscore = 0\nfor word, answer in answers.items():\n    # check 로 맞으면 score 에 1을 더해요\n    ___\n\nprint(f\"맞힌 개수: {score}/{len(words)}\")\n","validation_type":"all","fallback_text":"답안지도 딕셔너리라서 .items() 로 단어와 답을 한 쌍씩 꺼낼 수 있어요. 2단계에서 만든 check 함수가 True 를 돌려주면 맞은 거예요. if 로 확인하고 score 에 1을 더해요."},{"step_number":4,"step_goal":"문제 순서를 random.shuffle로 섞어서 다시 내고, 섞어도 맞힌 개수가 같은지 확인하기","checklist":["random.shuffle( )로 quiz 리스트를 섞어요","문제 순서는 돌릴 때마다 달라져요","다시 풀어도 맞힌 개수: 3/5 가 나오는지 봐요"],"example_output":"apple = 사과\nsea = 바다\nstar = 별\nfish = 물고기\nship = 배\nTrue\nFalse\n맞힌 개수: 3/5\nstar → 별\nship → 새\napple → 사과\nfish → 물고기\nsea → 산\n다시 풀어도 맞힌 개수: 3/5","starter_code":"\n# 4단계: 문제 순서를 섞어서 다시 내요\nimport random\n\nquiz = [\"apple\", \"sea\", \"star\", \"fish\", \"ship\"]\n# quiz 리스트의 순서를 섞어요\n___\n\nscore = 0\nfor word in quiz:\n    answer = answers[word]\n    print(f\"{word} → {answer}\")\n    if check(word, answer):\n        score = score + 1\nprint(f\"다시 풀어도 맞힌 개수: {score}/{len(quiz)}\")\n","validation_type":"all","fallback_text":"random 도구 상자의 shuffle 은 리스트 순서를 마구 섞어요. 해적선 놀이공원에서 놀이기구 줄을 섞었던 것처럼요. 순서는 돌릴 때마다 달라지지만 점수는 단어와 답을 짝지어 매기니까 늘 같아요."},{"step_number":5,"step_goal":"틀린 단어를 오답 노트 리스트에 모으고, .upper()로 제목을 크게 꾸며 보여 주기","checklist":["틀린 단어를 wrong 리스트에 append 로 더해요","\"wrong note\" 를 .upper( )로 큰 글자 제목으로 바꿔요","틀린 단어: 2개 가 나오는지 봐요"],"example_output":"apple = 사과\nsea = 바다\nstar = 별\nfish = 물고기\nship = 배\nTrue\nFalse\n맞힌 개수: 3/5\nstar → 별\nship → 새\napple → 사과\nfish → 물고기\nsea → 산\n다시 풀어도 맞힌 개수: 3/5\nWRONG NOTE\n- ship: 배\n- sea: 바다\n틀린 단어: 2개","starter_code":"\n# 5단계: 틀린 단어를 오답 노트에 모아요\nwrong = []\nfor word in quiz:\n    if answers[word] != words[word]:\n        # 틀린 단어를 wrong 에 더해요\n        ___\n\nprint(\"wrong note\".___())\nfor word in wrong:\n    print(f\"- {word}: {words[word]}\")\nprint(f\"틀린 단어: {len(wrong)}개\")\n","validation_type":"all","fallback_text":"리스트 끝에 하나씩 더할 때는 append 를 써요. 글자를 모두 큰 글자로 바꾸는 메서드는 산호 문자열 공방에서 배웠어요. 틀린 단어 순서는 섞인 순서를 따라가서 돌릴 때마다 달라질 수 있어요."}]}'::jsonb,
  'all',
  '',
  300
)
ON CONFLICT (id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,
  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,
  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,
  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,
  xp_reward = EXCLUDED.xp_reward;

-- 퀘스트 7-5: 버그버그 선장
INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,
                           prompt_skeleton, validation_type, expected_output, xp_reward)
VALUES (
  'b2000000-0000-0000-0000-000000000207',
  'a2000000-0000-0000-0000-000000000007',
  5,
  '버그버그 선장',
  '2월드 총정리',
  'boss',
  NULL,
  TRUE,
  '{"topic":"코드 바다에서 배운 문자열, 딕셔너리, 중첩 반복, math, 에러, 알고리즘 총정리","learning_goals":["여러 섬에서 배운 주문이 섞인 코드를 한 줄씩 따라갈 수 있다","에러가 나는 줄을 찾아 멈추지 않게 고칠 수 있다","리스트 속 딕셔너리를 다루는 코드의 버그를 고칠 수 있다"],"story_context":"두 프로그램을 완성하자 항구에 커다란 해적선이 들어왔어요! 뱃머리에 선장 모자를 쓴 버그버그가 서 있네요. 지금까지 만난 버그버그들의 대장, 버그버그 선장이래요. 코드 바다에서 배운 모든 주문으로 마지막 시험을 통과하면 별똥이가 코드 선장 모자를 씌워 준대요!","fallback_text":"코드는 위에서 아래로 한 줄씩 따라가요. 글자와 리스트 번호는 0부터 세고, 딕셔너리는 이름표로 꺼내요. 반복 안의 반복은 바깥 한 번에 안쪽이 다 돌아요. 에러가 나면 맨 아래 줄의 에러 이름부터 읽어요. 섬마다 배운 것을 하나씩 떠올려 봐요.","boss":{"name":"버그버그 선장","look":"captain","intro":"으하하! 나는 코드 바다의 주인, 버그버그 선장이다! 섬마다 내 부하들을 이겼다고? 마지막 일곱 문제를 풀어 보거라!","on_defeat":"으으, 내가 졌다! 너야말로 진짜 코드 선장이로구나. 이 선장 모자는 이제 네 거야. 다음 바다에서도 같이 모험하자!","on_victory":"으하하, 아직 내 배를 넘기엔 이르다! 섬마다 배운 주문을 다시 떠올리고 돌아오너라. 기다리고 있으마!","rounds":[{"kind":"multiple_choice","question":"산호 문자열 공방에서 배운 주문이에요. 선장의 깃발 글자를 쪼개요. 돌리면 무엇이 나올까?","code":"flag = \"pirate,ship\"\nparts = flag.split(\",\")\nprint(parts[1].upper() + \"!\")","options":[{"id":"opt-d3wv","text":"ship!"},{"id":"opt-k7nj","text":"PIRATE,SHIP!"},{"id":"opt-m8ta","text":"PIRATE!"},{"id":"opt-z5qe","text":"SHIP!"}]},{"kind":"fill_blank","question":"등대 딕셔너리 도서관에서 배운 주문이에요. 빈칸을 채워 잡은 물고기를 종류별로 세고 모두 보여 줘요","code":"fish = [\"고등어\", \"참치\", \"고등어\"]\ncount = {}\nfor f in fish:\n    count[f] = count.{{bk-q6wd}}(f, 0) + 1\nfor name, n in count.{{bk-j2ns}}():\n    print(f\"{name}: {n}마리\")","tokens":[{"id":"tok-c3mz","text":"append"},{"id":"tok-f4ab","text":"items"},{"id":"tok-u9kh","text":"keys"},{"id":"tok-x8rc","text":"get"}]},{"kind":"multiple_choice","question":"소용돌이 반복 미로에서 배운 주문이에요. 선장의 보물 지도를 그려요. 돌리면 무엇이 나올까?","code":"grid = [[\"#\", \".\"], [\".\", \"#\"], [\"#\", \"#\"]]\nfor row in grid:\n    line = \"\"\n    for cell in row:\n        line = line + cell\n    print(line)","options":[{"id":"opt-a9le","text":"#..###"},{"id":"opt-h4ub","text":"##\n.#\n#."},{"id":"opt-p2xg","text":"#.\n.#\n##"},{"id":"opt-w6co","text":"#.#\n.##"}]},{"kind":"multiple_choice","question":"해적선 랜덤 놀이공원에서 배운 주문이에요. 선장이 금화 7개를 둘로 나눠요. 돌리면 무엇이 나올까?","code":"import math\nprint(math.floor(7 / 2), math.ceil(7 / 2))","options":[{"id":"opt-b2qm","text":"3 3"},{"id":"opt-e8kd","text":"4 3"},{"id":"opt-n6wr","text":"3.5 3.5"},{"id":"opt-s3fy","text":"3 4"}]},{"kind":"bug_hunt","question":"버그 병원선에서 배운 주문이에요. 선원 명단에 버그버그가 없어서 코드가 멈춰요. 없으면 0이 나오게 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-t3ka","code":"crew = {\"파이뱀\": 3, \"별똥이\": 2}"},{"id":"ln-y7mc","code":"for name in [\"파이뱀\", \"버그버그\"]:"},{"id":"ln-g5wb","code":"    print(name, crew[name])"}],"fixes":[{"id":"fx-c9yz","code":"    print(name, crew[0])"},{"id":"fx-l6qs","code":"    print(name, crew(name))"},{"id":"fx-r8dn","code":"    print(name, crew.get(name, 0))"},{"id":"fx-v2hp","code":"    print(name, crew.get[name])"}]},{"kind":"parsons","question":"해저 알고리즘 산맥에서 배운 주문이에요. 줄을 순서대로 놓고 들여쓰기도 맞춰, 가장 큰 보물을 직접 찾아요","lines":[{"id":"ln-b7je","code":"best = treasure[0]"},{"id":"ln-d6ry","code":"best = t"},{"id":"ln-h9sa","code":"if t > best:"},{"id":"ln-k2mf","code":"print(f\"가장 큰 보물: {best}\")"},{"id":"ln-n4xw","code":"treasure = [30, 80, 50]"},{"id":"ln-w3go","code":"for t in treasure:"}],"indent":true},{"kind":"bug_hunt","question":"선장의 마지막 문제! 용돈 기입장의 금액을 모두 더해야 하는데 TypeError 가 나요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-s8pv","code":"records = [{\"내용\": \"간식\", \"금액\": 1500}, {\"내용\": \"선물\", \"금액\": 3000}]"},{"id":"ln-e4tk","code":"total = 0"},{"id":"ln-m2zd","code":"for r in records:"},{"id":"ln-q9ha","code":"    total = total + r"},{"id":"ln-x5bc","code":"print(f\"모두 {total}원\")"}],"fixes":[{"id":"fx-a4kx","code":"    total = r[\"금액\"]"},{"id":"fx-h3ce","code":"    total = total + records[\"금액\"]"},{"id":"fx-o7wm","code":"    total = total + r[\"금액\"]"},{"id":"fx-z6ug","code":"    total = total + r[\"내용\"]"}]}],"review_quests":["b2000000-0000-0000-0000-000000000008","b2000000-0000-0000-0000-000000000017","b2000000-0000-0000-0000-000000000023","b2000000-0000-0000-0000-000000000028","b2000000-0000-0000-0000-000000000039","b2000000-0000-0000-0000-000000000047","b2000000-0000-0000-0000-000000000055"]}}'::jsonb,
  'all',
  '',
  78
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

-- 정답 1-1: 반짝 이름표
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000001',
  '[{"type":"output_match","expected":"이름: 바다\n바다는 10살"},{"type":"code_check","expected":"{name}"},{"type":"code_check","expected":"{age}"}]',
  '{"level_1":"첫째 print 줄을 잘 봐요. 따옴표 앞에 무엇이 붙어 있나요?","level_2":"f를 붙인 따옴표 안에서는 { } 안에 변수 이름을 쓰면 그 값이 나와요. {name}, {age}처럼요!","level_3":"print(f\"{___}는 {___}살\") 의 빈칸에 name 과 age 를 넣어 보세요!"}'::jsonb,
  E'name = "바다"\nage = 10\n\nprint(f"이름: {name}")\nprint(f"{name}는 {age}살")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-2: 글자 상자 꺼내기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000002',
  '[{"type":"output_match","expected":"첫 글자: O\n마지막 글자: N\n글자 수: 5\nO\nC\nE\nA\nN"},{"type":"code_check","expected":"[-1]"},{"type":"code_check","expected":"len("}]',
  '{"level_1":"리스트 호수에서 리스트 번호를 0부터 셌던 것 기억나요? 글자도 똑같아요!","level_2":"뒤에서부터 셀 때는 음수 번호를 써요. 맨 끝은 -1 이에요. 글자 수는 len() 으로 세요.","level_3":"word[-1], len(word), print(letter) 를 빈칸에 차례로 넣어 보세요!"}'::jsonb,
  E'word = "OCEAN"\n\nprint(f"첫 글자: {word[0]}")\nprint(f"마지막 글자: {word[-1]}")\nprint(f"글자 수: {len(word)}")\n\nfor letter in word:\n    print(letter)\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-3: 조개 도장 세기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000003',
  '[{"type":"output_match","expected":"a는 4번"},{"type":"code_check","expected":"for","whole_word":true},{"type":"code_check","expected":"if","whole_word":true}]',
  '{"level_1":"글자를 하나씩 볼 때마다 \"이 글자가 a인가?\" 하고 물어봐야 해요. 물어보는 주문은 무엇이었죠?","level_2":"if letter == \"a\": 로 묻고, 맞으면 count = count + 1 로 하나 늘려요. if 아래 줄은 한 번 더 들여써요!","level_3":"___ 자리를 이렇게 바꿔 보세요!\nif letter == \"a\":\n    count = count + 1"}'::jsonb,
  E'text = "banana boat"\ncount = 0\n\nfor letter in text:\n    if letter == "a":\n        count = count + 1\n\nprint(f"a는 {count}번")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-4: 글자 리본 자르기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000004',
  '[{"type":"output_match","expected":"star\nfish"},{"type":"code_check","expected":":4]"}]',
  '{"level_1":"starfish 아래 번호표를 봐요. f 는 몇 번에 있나요?","level_2":"[시작:끝]에서 끝 번호 글자는 들어가지 않아요. star 가 0~3번이니 끝 번호는 하나 더 큰 수예요!","level_3":"front = word[0:4], back = word[4:] 처럼 빈칸에 4를 넣어 보세요!"}'::jsonb,
  E'word = "starfish"\n\nfront = word[0:4]\nback = word[4:]\n\nprint(front)\nprint(back)\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-5: 리본 조각 맞히기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000005',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-r4ka"],"explanation":"d가 0번, o가 1번이에요. [1:4]는 1번부터 4번 바로 앞(3번)까지라서 o, l, p 세 글자가 나와요.","explanations":{"opt-b9tn":"1번부터 시작하니 0번 글자 d 는 빠져요.","opt-m7cs":"끝 번호 4번 글자 h 는 들어가지 않아요.","opt-x2pe":"번호는 0부터 세요. 1번은 둘째 글자 o 예요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-6: 크게! 작게! 바꿔!
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000006',
  '[{"type":"output_match","expected":"I LOVE THE LAKE\ni love the sea"},{"type":"code_check","expected":".upper("},{"type":"code_check","expected":".replace("}]',
  '{"level_1":"대문자는 영어로 upper case 예요. 크게 외치는 메서드 이름이 떠오르나요?","level_2":"spell.upper() 는 대문자로 바꿔요. replace 는 (\"바꿀 낱말\", \"새 낱말\") 순서로 넣어요.","level_3":"print(spell.upper()) 와 print(spell.replace(\"lake\", \"sea\")) 를 써 보세요!"}'::jsonb,
  E'spell = "i love the lake"\n\nprint(spell.upper())\nprint(spell.replace("lake", "sea"))\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-7: 공방 도구 빈칸
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000007',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"fill_blank","accepted":[{"bk-u4wa":"tok-p5qa","bk-r8ne":"tok-c8ze","bk-s2ko":"tok-k3vy"}],"explanation":"upper()는 대문자로, replace(\"hi\", \"bye\")는 낱말을 바꿔요. split(\" \")는 띄어쓰기마다 잘라 [''hi'', ''sea''] 리스트를 만들어요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-8: 조개 목걸이 꿰기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000008',
  '[{"type":"output_match","expected":"구슬 3개\n진주 - 소라 - 조개"},{"type":"code_check","expected":".split("},{"type":"code_check","expected":".join("}]',
  '{"level_1":"쪼갤 때 기준이 되는 글자는 구슬 사이에 있는 글자예요. 무엇일까요?","level_2":"join 은 사이에 넣을 글자 뒤에 점을 찍고 불러요. \" - \".join(beads) 처럼요!","level_3":"beads = shells.split(\",\") 와 necklace = \" - \".join(beads) 를 써 보세요!"}'::jsonb,
  E'shells = "진주,소라,조개"\n\nbeads = shells.split(",")\nprint(f"구슬 {len(beads)}개")\n\nnecklace = " - ".join(beads)\nprint(necklace)\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-9: 이름표가 이상해
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000009',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"bug_hunt","accepted":[{"line":"ln-g5mj","fix":"fx-n2ry"}],"explanation":"f-string은 따옴표 바깥, 따옴표 바로 앞에 f를 붙여요. 그래야 중괄호 자리에 name과 age 값이 들어가요.","explanations":{"fx-a6vk":"f가 따옴표 안에 들어가면 그냥 글자 f로 나와요.","fx-e4hs":"따옴표 안의 name, age는 변수가 아니라 그냥 글자예요.","fx-q9ul":"숫자 age는 str()로 바꾸지 않으면 글자와 + 로 이을 수 없어요.","ln-d3wq":"이 줄은 이름을 잘 담았어요.","ln-t8ox":"이 줄은 나이를 잘 담았어요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-10: 비밀 암호 만들기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000010',
  '[{"type":"output_match","expected":"암호: sbwkrq"},{"type":"code_check","expected":"% 26"}]',
  '{"level_1":"3칸 미는 건 번호에 3을 더하는 거예요. 그런데 y나 z에 3을 더하면 어떻게 될까요?","level_2":"abc 는 26글자라 번호는 0~25 예요. 나머지 % 26 을 쓰면 26은 0, 27은 1로 돌아와요.","level_3":"new_num = (num + 3) % 26 을 써 보세요!"}'::jsonb,
  E'abc = "abcdefghijklmnopqrstuvwxyz"\nword = "python"\nsecret = ""\n\nfor ch in word:\n    num = abc.index(ch)\n    new_num = (num + 3) % 26\n    secret = secret + abc[new_num]\n\nprint(f"암호: {secret}")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 1-11: 글자 뒤섞기 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000201',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-c4lq"],"explanation":"0번은 맨 앞 글자 C, -1번은 맨 끝 글자 L이에요. + 는 글자를 빈칸 없이 바로 이어 붙여요.","explanations":{"opt-k6wn":"+ 로 이으면 사이에 빈칸이 생기지 않아요.","opt-r8az":"-1번은 맨 끝 글자예요. 끝에서 두 번째 글자가 아니에요.","opt-y2om":"글자 번호는 0부터 세요. 0번이 맨 앞 글자예요."}},{"kind":"multiple_choice","accepted":["opt-h5rs"],"explanation":"3번 글자 h부터 잘라요. 끝 번호 8은 들어가지 않아서 7번 글자 e까지 나와요.","explanations":{"opt-d9fi":"시작 번호 3번 글자 h부터 잘라요. 그 앞의 a는 빠져요.","opt-m3pk":"끝 번호 8은 빠지지만 7번 글자 e는 들어가요.","opt-u7ea":"글자 번호는 0부터 세요. 3번은 네 번째 글자 h예요."}},{"kind":"fill_blank","accepted":[{"bk-t3wa":"tok-p2vx","bk-g7nc":"tok-e6ku"}],"explanation":"replace 는 앞 글자를 뒤 글자로 바꿔요. upper 는 모든 글자를 큰 글자로 바꿔서 FISH SHOP 이 나와요.","explanations":{"tok-q8hy":"split 은 글자를 쪼개 리스트로 만들어요.","tok-z4mr":"lower 는 작은 글자로 바꿔요. 간판은 큰 글자여야 해요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-k4ze","fix":"fx-w5ma"}],"explanation":"z 는 25번이라 한 칸 밀면 26번인데, 26번 글자는 없어서 멈춰요. 26으로 나눈 나머지를 쓰면 26이 0이 되어 맨 앞 a 로 돌아와요.","explanations":{"fx-b8te":"괄호가 없으면 1 % 26 을 먼저 계산해서 여전히 26번을 찾아요.","fx-j3oc":"1을 빼면 알파벳 거꾸로 한 칸 가서 y 가 나와요. 다음 글자 쪽으로 밀어야 해요.","fx-s7yl":"알파벳은 26글자라서 26으로 나눠야 해요. 25로 나누면 b 가 나와요.","ln-f6sb":"알파벳 26글자를 잘 적었어요.","ln-n2jx":"밀어 볼 글자 z 를 잘 담았어요.","ln-v9dq":"index 로 z 의 번호를 잘 찾았어요."}},{"kind":"parsons","accepted":[[{"id":"ln-u5gr","indent":0},{"id":"ln-h2cw","indent":0},{"id":"ln-x8ma","indent":0},{"id":"ln-d4oy","indent":1}],[{"id":"ln-h2cw","indent":0},{"id":"ln-u5gr","indent":0},{"id":"ln-x8ma","indent":0},{"id":"ln-d4oy","indent":1}]],"explanation":"변수 두 개를 먼저 담고(어느 쪽이 먼저여도 괜찮아요), split 으로 쉼표마다 쪼갠 조각을 하나씩 돌며 f-string 으로 이름표를 달아요. 파이뱀의 진주, 파이뱀의 소라 가 나와요."}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-1: 책 이름표 붙이기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000011',
  '[{"type":"output_match","expected":"제목: 바다 탐험\n쪽수: 120쪽"},{"type":"code_check","expected":"book["}]',
  '{"level_1":"title 줄을 잘 봐요. 제목은 어떤 이름표로 꺼냈나요?","level_2":"쪽수도 같은 방법으로 꺼내요. 대괄호 안에 이름표 \"쪽수\"를 넣어요!","level_3":"\"쪽수\": 120 으로 넣고, pages = book[\"쪽수\"] 를 써 보세요!"}'::jsonb,
  E'book = {"제목": "바다 탐험", "쪽수": 120}\n\ntitle = book["제목"]\npages = book["쪽수"]\n\nprint(f"제목: {title}")\nprint(f"쪽수: {pages}쪽")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-2: 책 빌리기 기록장
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000012',
  '[{"type":"output_match","expected":"{''제목'': ''바다 탐험'', ''쪽수'': 130, ''빌린 사람'': ''하늘''}\n이름표 수: 3"},{"type":"code_check","expected":"] ="}]',
  '{"level_1":"변수에 값을 넣을 때처럼 = 를 써요. 그런데 왼쪽에 변수 대신 무엇을 쓸까요?","level_2":"book[\"이름표\"] = 내용 처럼 쓰면 넣기도, 고치기도 돼요!","level_3":"book[\"빌린 사람\"] = \"하늘\" 과 book[\"쪽수\"] = 130 두 줄을 빈 곳에 써 보세요!"}'::jsonb,
  E'book = {"제목": "바다 탐험", "쪽수": 120}\n\nbook["빌린 사람"] = "하늘"\n\nbook["쪽수"] = 130\n\nprint(book)\nprint(f"이름표 수: {len(book)}")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-3: 이름표 덮어쓰기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000013',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-f3hu"],"explanation":"조개 이름표에 5를 다시 넣으면 1이 5로 바뀌어요. 소라는 없던 이름표라 뒤에 새로 붙어요.","explanations":{"opt-c6nb":"= 는 더하지 않고 새 값으로 바꿔요.","opt-l2wv":"한 딕셔너리에 같은 이름표는 하나뿐이에요.","opt-y8dq":"둘째 줄에서 조개 이름표의 내용을 바꿨어요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-4: 없는 책을 찾으면?
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000014',
  '[{"type":"output_match","expected":"고래 일기 있어요\n3\n없어요"},{"type":"code_check","expected":".get("},{"type":"code_check","expected":"in shelf"}]',
  '{"level_1":"리스트 호수에서 \"이 값이 리스트 안에 있나?\" 물을 때 쓴 낱말이 있었어요. 딕셔너리에도 똑같이 써요!","level_2":"if \"고래 일기\" in shelf: 로 물어봐요. 없는 이름표는 shelf.get(이름표, 대신 값) 으로 꺼내요.","level_3":"if \"고래 일기\" in shelf: 를 쓰고, 마지막 줄을 print(shelf.get(\"문어 요리\", \"없어요\")) 로 바꿔 보세요!"}'::jsonb,
  E'shelf = {"바다 탐험": 3, "고래 일기": 1}\n\nif "고래 일기" in shelf:\n    print("고래 일기 있어요")\n\nprint(shelf["바다 탐험"])\n\nprint(shelf.get("문어 요리", "없어요"))\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-5: 책장 한 바퀴
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000015',
  '[{"type":"output_match","expected":"동화: 4권\n과학: 2권\n만화: 5권\n모두 11권"},{"type":"code_check","expected":".items("}]',
  '{"level_1":"이름표와 내용을 한 쌍씩 꺼내는 메서드 이름은 영어로 \"물건들\"이라는 뜻이에요.","level_2":"빈칸은 items 예요. 합계는 동굴에서 금화를 더했던 것처럼 total = total + count 로 해요!","level_3":"for name, count in shelf.items(): 로 바꾸고, 빈칸 ___ 에 total = total + count 를 써 보세요!"}'::jsonb,
  E'shelf = {"동화": 4, "과학": 2, "만화": 5}\ntotal = 0\n\nfor name, count in shelf.items():\n    print(f"{name}: {count}권")\n    total = total + count\n\nprint(f"모두 {total}권")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-6: 책장 돌기 빈칸
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000016',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"fill_blank","accepted":[{"bk-i6tz":"tok-e5pw","bk-n3ry":"tok-u9mc"}],"explanation":"items()는 이름표와 내용을 한 쌍씩 꺼내 name 과 count 에 나눠 담아요. len()은 이름표 수를 세서 2가 나와요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-7: 반장 투표 세기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000017',
  '[{"type":"output_match","expected":"고래: 3표\n상어: 2표\n문어: 1표"},{"type":"code_check","expected":"for","whole_word":true},{"type":"code_check","expected":"count[name]"}]',
  '{"level_1":"표를 하나 늘리는 건 지금 표 수에 1을 더하는 거예요. 지금 표 수는 어디에 있나요?","level_2":"지금 표 수는 count[name] 에 있어요. 처음 나온 이름은 아직 이름표가 없으니 1을 넣어 붙여요.","level_3":"첫 빈칸은 count[name] + 1, 둘째 빈칸 ___ 은 count[name] = 1 이에요!"}'::jsonb,
  E'votes = ["고래", "상어", "고래", "문어", "고래", "상어"]\ncount = {}\n\nfor name in votes:\n    if name in count:\n        count[name] = count[name] + 1\n    else:\n        count[name] = 1\n\nfor name, n in count.items():\n    print(f"{name}: {n}표")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-8: 단어장 만들기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000018',
  '[{"type":"output_match","expected":"the: 3번\nis: 3번"},{"type":"code_check","expected":".split("},{"type":"code_check","expected":"for","whole_word":true}]',
  '{"level_1":"먼저 문장을 단어 리스트로 쪼개야 해요. 조개 목걸이에서 쓴 메서드 기억나요?","level_2":"for w in words: 로 돌며 반장 투표처럼 if w in count: 이면 1 늘리고, 아니면 1로 시작해요. \"2번 넘게\"는 n > 2 예요.","level_3":"words = sentence.split() 으로 쪼개고, 1) 자리에 이렇게 써 보세요! 마지막 빈칸은 n > 2 예요.\nfor w in words:\n    if w in count:\n        count[w] = count[w] + 1\n    else:\n        count[w] = 1"}'::jsonb,
  E'sentence = "the sea is blue and the sky is blue and the sun is hot"\nwords = sentence.split()\ncount = {}\n\nfor w in words:\n    if w in count:\n        count[w] = count[w] + 1\n    else:\n        count[w] = 1\n\nfor word, n in count.items():\n    if n > 2:\n        print(f"{word}: {n}번")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 2-9: 이름표 도둑 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000202',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-n5wd"],"explanation":"쪽수 이름표는 이미 있어서 내용만 32로 바뀌어요. 빌린 사람은 새 이름표라 하나 늘어서 이름표는 모두 3개예요.","explanations":{"opt-g2ke":"빌린 사람은 새 이름표라서 딕셔너리가 하나 커져요.","opt-p4ti":"쪽수는 이미 있던 이름표라 늘지 않아요. 새로 생긴 건 하나뿐이에요.","opt-v8qa":"같은 이름표에 다시 넣으면 내용이 새 값으로 바뀌어요."}},{"kind":"multiple_choice","accepted":["opt-r3ub"],"explanation":"만화 이름표는 없어서 get 이 대신 0을 줘요. 동화는 4권이 있어서 0 + 4 로 4가 나와요.","explanations":{"opt-c6xo":"동화 이름표는 있어서 get 이 진짜 내용 4를 줘요.","opt-f9lm":"과학 2권은 더하지 않았어요. 만화와 동화만 꺼냈어요.","opt-w2hj":"숫자끼리 + 하면 이어 붙이지 않고 더해요."}},{"kind":"fill_blank","accepted":[{"bk-m4ra":"tok-k5dz","bk-y7ce":"tok-h8nv"}],"explanation":"이미 이름표가 있으면 1을 더하고, 처음 보는 이름표면 첫 표로 1을 넣어요. 별 2표, 달 1표가 나와요.","explanations":{"tok-b3wq":"이름표가 없을 때 1을 더하려고 하면 꺼낼 내용이 없어서 멈춰요.","tok-s2fo":"처음 나온 표도 한 표예요. 0으로 시작하면 한 표씩 모자라요."}},{"kind":"parsons","accepted":[[{"id":"ln-t6pa","indent":0},{"id":"ln-e3vk","indent":0},{"id":"ln-q9bm","indent":0},{"id":"ln-a5xs","indent":1},{"id":"ln-j2dh","indent":0}],[{"id":"ln-e3vk","indent":0},{"id":"ln-t6pa","indent":0},{"id":"ln-q9bm","indent":0},{"id":"ln-a5xs","indent":1},{"id":"ln-j2dh","indent":0}]],"explanation":"책장과 0에서 시작하는 합계를 먼저 준비하고(어느 쪽이 먼저여도 괜찮아요), items 로 한 쌍씩 돌며 권수를 더해요. 다 돈 뒤에 한 번만 보여 주면 9가 나와요."},{"kind":"bug_hunt","accepted":[{"line":"ln-g8ue","fix":"fx-d2nq"}],"explanation":"작가 이름표가 없어서 대괄호로 꺼내면 멈춰요. get 은 이름표가 없을 때 대신 줄 값을 정할 수 있어서, 몰라요 가 나와요.","explanations":{"fx-m4ip":"딕셔너리는 함수처럼 괄호로 부를 수 없어요.","fx-r6jt":"따옴표가 없으면 작가 라는 변수를 찾다가 멈춰요.","fx-x9az":"get 은 괄호로 불러요. 대괄호를 쓰면 멈춰요.","ln-l3oy":"제목 이름표는 있어서 잘 꺼내요.","ln-w7fc":"책 딕셔너리는 잘 만들었어요. 다만 작가 이름표가 없어요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-1: 바닥 타일 깔기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000019',
  '[{"type":"output_match","expected":"####\n####\n####"},{"type":"code_check","expected":"    for"}]',
  '{"level_1":"한 줄에 타일이 4장이에요. 4번 반복하는 주문은 무엇이었죠?","level_2":"for c in range(4): 를 쓰고, 그 아래 한 번 더 들여써서 row = row + \"#\" 을 넣어요.","level_3":"___ 자리를 이렇게 바꿔 보세요!\nfor c in range(4):\n    row = row + \"#\""}'::jsonb,
  E'for r in range(3):\n    row = ""\n    for c in range(4):\n        row = row + "#"\n    print(row)\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-2: 구구단 표
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000020',
  '[{"type":"output_match","expected":"2단: 2x1=2 2x2=4 2x3=6\n3단: 3x1=3 3x2=6 3x3=9\n4단: 4x1=4 4x2=8 4x3=12"},{"type":"code_check","expected":"    for"}]',
  '{"level_1":"바닥 타일 깔기처럼 안쪽 반복에서 row 에 한 칸씩 붙여요. 이번엔 무엇을 붙일까요?","level_2":"b 가 1부터 3까지 되려면 range(1, 4) 예요. 칸 글자는 f\" {a}x{b}={a * b}\" 예요.","level_3":"print(row) 위에 이렇게 써 보세요!\nfor b in range(1, 4):\n    row = row + f\" {a}x{b}={a * b}\""}'::jsonb,
  E'for a in range(2, 5):\n    row = f"{a}단:"\n    for b in range(1, 4):\n        row = row + f" {a}x{b}={a * b}"\n    print(row)\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-3: 몇 번 울릴까?
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000021',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-w5jd"],"explanation":"바깥 반복이 3번 돌고, 한 번 돌 때마다 안쪽 반복이 2번씩 돌아요. 그래서 2 + 2 + 2 로 6번 울려요.","explanations":{"opt-h7ve":"안쪽 반복 한 바퀴만 센 수예요.","opt-k8ab":"3과 2를 더한 수예요. 안쪽 반복은 바깥이 돌 때마다 다시 처음부터 돌아요.","opt-q3zu":"바깥 반복만 센 수예요. 안쪽 반복도 매번 돌아요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-4: 보물 지도 칸 꺼내기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000022',
  '[{"type":"output_match","expected":"보물 칸: X\n줄 수: 3\n칸 수: 4"},{"type":"code_check","expected":"]["}]',
  '{"level_1":"번호는 0부터 세요. X 는 몇 번 줄에 있나요? 그 줄에서 몇 번 칸에 있나요?","level_2":"줄 번호는 1, 칸 번호는 2 예요. 칸 수는 한 줄 리스트의 길이라서 len(grid[0]) 이에요.","level_3":"grid[1][2] 와 len(grid[0]) 을 빈칸에 넣어 보세요!"}'::jsonb,
  E'grid = [\n    [".", "#", ".", "."],\n    [".", ".", "X", "."],\n    ["#", ".", ".", "."],\n]\n\nprint(f"보물 칸: {grid[1][2]}")\nprint(f"줄 수: {len(grid)}")\nprint(f"칸 수: {len(grid[0])}")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-5: 지도 그리기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000023',
  '[{"type":"output_match","expected":"..#.\n#..X\n.#.."},{"type":"code_check","expected":"    for"}]',
  '{"level_1":"row 는 한 줄 리스트예요. 리스트 안의 칸을 하나씩 꺼내려면 무엇을 쓸까요?","level_2":"for cell in row: 로 칸을 꺼내고, line = line + cell 로 붙여요. 바닥 타일 깔기와 비슷해요!","level_3":"print(line) 위에 이렇게 써 보세요!\nfor cell in row:\n    line = line + cell"}'::jsonb,
  E'grid = [\n    [".", ".", "#", "."],\n    ["#", ".", ".", "X"],\n    [".", "#", ".", "."],\n]\n\nfor row in grid:\n    line = ""\n    for cell in row:\n        line = line + cell\n    print(line)\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-6: 지도 그리기 순서
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000024',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"parsons","accepted":[[{"id":"ln-v4ce","indent":0},{"id":"ln-p9ra","indent":0},{"id":"ln-b2xs","indent":1},{"id":"ln-z6kt","indent":1},{"id":"ln-f3ow","indent":2},{"id":"ln-m8yh","indent":1}]],"explanation":"줄마다 빈 글자를 준비하고(한 칸 들여쓰기), 안쪽 반복에서 칸을 붙인 뒤(두 칸), 안쪽이 끝나면 한 칸 들여쓰기로 한 줄을 보여 줘요. \"#.\" 과 \".#\" 두 줄이 나와요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-7: X 표시를 찾아라
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000025',
  '[{"type":"output_match","expected":"보물은 1줄 2칸"},{"type":"code_check","expected":"len(grid"}]',
  '{"level_1":"칸 자체가 아니라 번호가 필요해요. 번호를 차례로 만드는 주문 range 안에 무엇을 넣을까요?","level_2":"줄 수는 len(grid), r 번 줄의 칸 수는 len(grid[r]) 예요. 칸이 X 인지는 if grid[r][c] == \"X\": 로 물어요.","level_3":"빈칸에 len(grid) 와 len(grid[r]) 를 넣고, 마지막 ___ 을 이렇게 바꿔 보세요!\nif grid[r][c] == \"X\":\n    print(f\"보물은 {r}줄 {c}칸\")"}'::jsonb,
  E'grid = [\n    [".", ".", ".", "."],\n    [".", "#", "X", "."],\n    ["#", ".", ".", "."],\n]\n\nfor r in range(len(grid)):\n    for c in range(len(grid[r])):\n        if grid[r][c] == "X":\n            print(f"보물은 {r}줄 {c}칸")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-8: 찌그러진 다이아몬드
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000026',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"bug_hunt","accepted":[{"line":"ln-w9tx","fix":"fx-h6rb"}],"explanation":"range(1, 2 * i)는 1부터 2 * i 바로 앞까지라서 1번, 3번, 5번 돌아요. 원래 줄은 끝을 하나 더 줄여서 별이 0개, 2개, 4개만 나왔어요.","explanations":{"fx-d1vc":"시작이 끝보다 크면 range는 한 번도 돌지 않아요.","fx-o4zm":"이러면 별이 2개, 4개, 6개로 하나씩 많아져요.","fx-t8wq":"이러면 별이 0개, 1개, 2개만 나와요.","ln-a7kd":"바깥 반복은 1, 2, 3 세 줄을 잘 돌아요.","ln-c5ge":"별을 한 개씩 붙이는 줄은 맞아요.","ln-s3pm":"앞 공백은 2칸, 1칸, 0칸으로 잘 줄어요.","ln-y2nf":"안쪽 반복이 끝난 뒤 한 줄을 보여 주는 자리가 맞아요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-9: 다이아몬드 무늬
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000027',
  '[{"type":"output_match","expected":"  *\n ***\n*****\n ***\n  *"},{"type":"code_check","expected":"for","whole_word":true}]',
  '{"level_1":"줄 번호 i 가 1, 2, 3 일 때 공백과 별이 몇 개인지 표로 적어 보세요. 어떤 규칙이 보이나요?","level_2":"공백은 3 - i, 별은 2 * i - 1 이에요. 아래쪽은 i 를 2, 1 로 거꾸로 돌리면 같은 식을 쓸 수 있어요.","level_3":"위쪽 빈칸은 (3 - i) 와 (2 * i - 1) 이에요. 아래쪽은 이렇게 써 보세요!\nfor i in [2, 1]:\n    print(\" \" * (3 - i) + \"*\" * (2 * i - 1))"}'::jsonb,
  E'for i in range(1, 4):\n    print(" " * (3 - i) + "*" * (2 * i - 1))\n\nfor i in [2, 1]:\n    print(" " * (3 - i) + "*" * (2 * i - 1))\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 3-10: 소용돌이 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000203',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-k2hy"],"explanation":"바깥 반복의 i 가 0, 1, 2 로 바뀌고, 안쪽은 i + 1 번 돌아요. 그래서 1개, 2개, 3개짜리 줄이 차례로 나와요.","explanations":{"opt-c5nf":"i 는 0부터 시작해서 첫 줄은 0 + 1 로 한 칸이에요.","opt-u3dm":"줄마다 바깥 반복 안에서 print 를 해서 세 줄로 나와요.","opt-w8ra":"안쪽 반복 횟수가 i 에 따라 달라져요. 매번 3번 도는 게 아니에요."}},{"kind":"multiple_choice","accepted":["opt-f7je"],"explanation":"grid[1] 은 두 번째 줄이고, 그 줄의 1번은 두 번째 칸 X 예요. 줄은 2개, 첫 줄의 칸은 3개예요.","explanations":{"opt-a6pv":"줄 수와 칸 수가 바뀌었어요. 1번 줄 1번 칸도 다시 세어 봐요.","opt-q4bs":"번호는 0부터 세요. 1번 줄 1번 칸은 맨 앞 칸이 아니에요.","opt-z9wc":"len(grid) 는 줄 수, len(grid[0]) 은 한 줄의 칸 수예요."}},{"kind":"parsons","accepted":[[{"id":"ln-r7kb","indent":0},{"id":"ln-h3xe","indent":1},{"id":"ln-p8sw","indent":1},{"id":"ln-b5ma","indent":2},{"id":"ln-e2qt","indent":1}]],"explanation":"줄마다 빈 글자로 새로 시작하고, 안쪽 반복에서 타일 4개를 붙여요. 안쪽이 끝나면 바깥 반복 안에서 한 줄을 보여 줘서"},{"kind":"multiple_choice","accepted":["opt-m6tg"],"explanation":"X 는 두 번째 줄의 두 번째 칸에 있어요. 번호는 0부터 세서 둘 다 1이에요.","explanations":{"opt-b2xk":"range(len(grid)) 는 0부터 세요. 두 번째 줄은 1번이에요.","opt-h9cd":"1번 줄의 0번 칸은 점이에요. X 는 그 옆 칸에 있어요.","opt-y5ol":"0줄 0칸은 맨 앞 칸이에요. 거기에는 점이 있어요."}},{"kind":"parsons","accepted":[[{"id":"ln-s4fu","indent":0},{"id":"ln-g9na","indent":0},{"id":"ln-c3wr","indent":0},{"id":"ln-x6dj","indent":1},{"id":"ln-k8pb","indent":2},{"id":"ln-a4ze","indent":3},{"id":"ln-o7lh","indent":0}],[{"id":"ln-g9na","indent":0},{"id":"ln-s4fu","indent":0},{"id":"ln-c3wr","indent":0},{"id":"ln-x6dj","indent":1},{"id":"ln-k8pb","indent":2},{"id":"ln-a4ze","indent":3},{"id":"ln-o7lh","indent":0}]],"explanation":"지도와 0에서 시작하는 수를 먼저 준비해요(어느 쪽이 먼저여도 괜찮아요). 줄마다, 칸마다 돌며 X 를 만나면 하나씩 더하고, 다 돈 뒤에 한 번만 보여 줘서 3이 나와요."},{"kind":"bug_hunt","accepted":[{"line":"ln-t2mo","fix":"fx-q3wb"}],"explanation":"피라미드는 별이 1개, 3개, 5개로 늘어나요. 2 * i 에서 1을 빼면 i 가 1, 2, 3 일 때 1, 3, 5 가 돼요.","explanations":{"fx-e7lx":"1을 더하면 3개, 5개, 7개가 되어 꼭대기가 별 셋이에요.","fx-j9sa":"앞 빈칸만 늘어나고 별은 여전히 2개, 4개, 6개예요.","fx-v4hc":"별이 1개, 2개, 3개라 가운데가 맞지 않는 삼각형이 돼요.","ln-d5vy":"세 줄을 그리는 반복은 맞아요.","ln-n8gk":"만든 줄을 보여 주는 것은 맞아요. 줄을 만드는 곳을 살펴봐요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-1: 수학 도구 상자
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000028',
  '[{"type":"output_match","expected":"3\n7.0\n3.14\n4"},{"type":"code_check","expected":"import math"},{"type":"code_check","expected":"math.sqrt("},{"type":"code_check","expected":"math.ceil("}]',
  '{"level_1":"도구 상자를 가져오는 주문은 import 예요. 상자 이름은 math 예요.","level_2":"도구는 math.sqrt(49), math.ceil(7 / 2) 처럼 상자 이름 뒤에 점을 찍고 꺼내요. 반올림은 round(값, 2) 예요.","level_3":"빈칸을 차례로 이렇게 채워 보세요!\nimport math\nprint(math.sqrt(49))\nprint(round(math.pi, 2))\nprint(math.ceil(7 / 2))"}'::jsonb,
  E'import math\n\nprint(math.floor(7 / 2))\n\nprint(math.sqrt(49))\n\nprint(round(math.pi, 2))\n\nprint(math.ceil(7 / 2))\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-2: 정직한 주사위 검사
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000029',
  '[{"type":"code_check","expected":"randint"},{"type":"code_check","expected":"n = random.randint("},{"type":"contains","expected":"정직한 주사위: 100"}]',
  '{"level_1":"random 상자에서 두 숫자 사이의 정수를 뽑는 도구는 rand 로 시작해요. 1월드 숫자 맞추기 게임에서 썼어요!","level_2":"random.randint(1, 6) 이 주사위 한 번이에요. 반복 안의 n 에도 똑같이 넣어요.","level_3":"두 빈칸을 이렇게 채워 보세요!\ndice = random.randint(1, 6)\nn = random.randint(1, 6)"}'::jsonb,
  E'import random\n\ndice = random.randint(1, 6)\nprint(f"한 번 굴린 눈: {dice}")\n\nok = 0\nfor i in range(100):\n    n = random.randint(1, 6)\n    if n >= 1 and n <= 6:\n        ok = ok + 1\nprint(f"정직한 주사위: {ok}")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-3: 주사위가 못 내는 수
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000030',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-r3y0"],"explanation":"random.randint(1, 6)은 1부터 6까지, 1과 6도 포함해 골라요. 그래서 0은 절대 나오지 않아요.","explanations":{"opt-3ync":"range와 달리 randint는 끝 숫자 6도 나와요.","opt-e6e9":"시작 숫자 1도 나올 수 있어요.","opt-fd7b":"3은 1과 6 사이라서 나올 수 있어요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-4: 오늘의 간식 추천기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000031',
  '[{"type":"code_check","expected":"random.choice"},{"type":"contains_any","expected":["오늘의 간식: 붕어빵","오늘의 간식: 떡볶이","오늘의 간식: 솜사탕","오늘의 간식: 핫도그"]}]',
  '{"level_1":"random 상자에는 리스트에서 하나를 \"골라 주는\" 도구가 있어요. 고르다는 영어로 choose, 고르기는 choice 예요!","level_2":"random.choice( ) 괄호 안에 간식 리스트 이름을 넣어요.","level_3":"pick = random.choice(snacks) 로 바꿔 보세요!"}'::jsonb,
  E'import random\n\nsnacks = ["붕어빵", "떡볶이", "솜사탕", "핫도그"]\n\npick = random.choice(snacks)\nprint(f"오늘의 간식: {pick}")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-5: 놀이기구 줄 섞기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000032',
  '[{"type":"code_check","expected":"shuffle"},{"type":"code_check","expected":".sort()"},{"type":"contains","expected":"[''거북'', ''고래'', ''문어'', ''상어'', ''해마'']"}]',
  '{"level_1":"random 상자에서 카드를 섞듯 리스트를 섞는 도구는 shuffle 이에요.","level_2":"random.shuffle(line) 은 결과를 따로 돌려주지 않고 line 을 바로 섞어요. 정렬은 1월드에서 배운 sort() 예요.","level_3":"두 빈칸을 이렇게 채워 보세요!\nrandom.shuffle(line)\nline.sort()"}'::jsonb,
  E'import random\n\nline = ["해마", "고래", "상어", "거북", "문어"]\n\nrandom.shuffle(line)\nprint(line)\n\nline.sort()\nprint(line)\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-6: 수학 도구 빈칸
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000033',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"fill_blank","accepted":[{"bk-07mx":"tok-jd4n","bk-41kp":"tok-e24t","bk-32s9":"tok-8ojx"}],"explanation":"import math 로 도구 상자를 가져오고, math.sqrt(16)은 4.0 이에요. round(3.14159, 2)는 소수 둘째 자리까지 반올림해 3.14 예요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-7: 주사위 600번 굴리기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000034',
  '[{"type":"code_check","expected":"randint"},{"type":"contains","expected":"모두 600번"}]',
  '{"level_1":"주사위 한 번은 정직한 주사위 검사에서 쓴 random.randint(1, 6) 이에요.","level_2":"나온 눈 n 의 칸을 1 늘리려면 counts[n] = counts[n] + 1 이에요. 반장 투표 세기와 같아요!","level_3":"두 빈칸을 이렇게 채워 보세요!\nn = random.randint(1, 6)\ncounts[n] = counts[n] + 1"}'::jsonb,
  E'import random\n\ncounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}\n\nfor i in range(600):\n    n = random.randint(1, 6)\n    counts[n] = counts[n] + 1\n\ntotal = 0\nfor eye, count in counts.items():\n    print(f"{eye}: {count}번")\n    total = total + count\nprint(f"모두 {total}번")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-8: 황금 열쇠 뽑기 기계
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000035',
  '[{"type":"code_check","expected":"while"},{"type":"code_check","expected":"random.choice"},{"type":"contains","expected":"번 만에 뽑았어요"},{"type":"contains","expected":"번째: 황금 열쇠"}]',
  '{"level_1":"황금 열쇠가 \"아닌\" 동안 반복해요. 같지 않다는 비교 기호는 != 예요.","level_2":"while prize != \"황금 열쇠\": 로 쓰고, 반복 안에서 간식 추천기처럼 random.choice 로 뽑아요.","level_3":"두 빈칸을 이렇게 채워 보세요!\nwhile prize != \"황금 열쇠\":\n    prize = random.choice(prizes)"}'::jsonb,
  E'import random\n\nprizes = ["사탕", "풍선", "스티커", "모자", "황금 열쇠"]\ntries = 0\nprize = ""\n\nwhile prize != "황금 열쇠":\n    prize = random.choice(prizes)\n    tries = tries + 1\n    print(f"{tries}번째: {prize}")\n\nprint(f"{tries}번 만에 뽑았어요!")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 4-9: 회전목마 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000204',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-s7gd"],"explanation":"math.sqrt(16) 은 소수점이 붙은 4.0 이고, math.ceil(2.1) 은 올림해서 3이에요. 소수점 수와 더하면 결과에도 소수점이 붙어요.","explanations":{"opt-e3pw":"sqrt 는 늘 소수점이 붙은 수를 돌려줘요. 그래서 더한 값에도 .0 이 붙어요.","opt-l9ck":"ceil 은 올림이라 2.1 이 3이 돼요. 2가 아니에요.","opt-x4uy":"ceil 은 올림이고, sqrt 결과에는 소수점이 붙어요."}},{"kind":"multiple_choice","accepted":["opt-b5ni"],"explanation":"randint 는 range 와 달리 앞 수와 뒤 수를 모두 포함해요. 그래서 1부터 6까지 모두 나올 수 있어요.","explanations":{"opt-g2rm":"randint(1, 6) 은 1부터 시작해요. 0은 나오지 않아요.","opt-u8fa":"range 는 끝 수가 빠지지만, randint 는 끝 수 6도 나와요.","opt-w6tz":"앞 수 1과 뒤 수 6도 나올 수 있어요."}},{"kind":"multiple_choice","accepted":["opt-h3kq"],"explanation":"shuffle 은 리스트 안의 순서를 섞기만 해요. 아무도 빠지거나 새로 들어오지 않아요. 우연히 원래 순서와 같을 때도 있어요.","explanations":{"opt-c2ya":"shuffle 은 아무것도 빼지 않아요. 빼는 것은 remove 같은 메서드예요.","opt-n7ew":"하나만 골라 주는 것은 random.choice 예요.","opt-r9ob":"가나다 순서로 세우는 것은 sort 예요. shuffle 은 마구 섞어요."}},{"kind":"fill_blank","accepted":[{"bk-f4tn":"tok-a6mq","bk-k8ws":"tok-p3hv"}],"explanation":"import 로 math 도구 상자를 가져오고, 원의 넓이는 원주율 pi 에 반지름을 두 번 곱해요. round 로 소수 첫째 자리까지 줄이면 28.3 이에요.","explanations":{"tok-e9rj":"random 은 다른 도구 상자 이름이에요. math 안에는 random 이 없어요.","tok-z5dc":"sqrt 는 제곱근을 구하는 함수예요. 원주율 값이 아니에요."}},{"kind":"fill_blank","accepted":[{"bk-c2xh":"tok-u4bn","bk-v7md":"tok-m8ke"}],"explanation":"get 은 처음 나온 눈이면 0을 줘서 1부터 셀 수 있어요. len 은 기록의 개수라서 모두 4번 굴렸어요. 3은 2번 나왔어요.","explanations":{"tok-o6wa":"items 는 이름표와 내용을 한 쌍씩 꺼낼 때 써요.","tok-t2ps":"max 는 가장 큰 눈을 알려 줘요. 굴린 횟수가 아니에요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-c6vn","fix":"fx-h5ad"}],"explanation":"7 나누기 2는 3.5라서 남는 한 명도 탈 보트가 하나 더 있어야 해요. floor 는 내림이라 3이 되고, ceil 은 올림이라 4가 돼요.","explanations":{"fx-n9qu":"// 는 몫만 구해서 내림과 같아요. 여전히 3척이에요.","fx-p4mf":"3.5척이 나와요. 보트는 반 척만 빌릴 수 없어요.","fx-z7ki":"sqrt 는 제곱근이에요. 나누기와 상관없어요.","ln-l8re":"친구 수 7은 맞아요.","ln-w2tx":"보여 주는 줄은 맞아요. 보트 수를 계산하는 줄을 살펴봐요.","ln-y3gq":"math 도구 상자를 가져오는 줄은 맞아요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-1: 진료 기록 읽기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000036',
  '[{"type":"output_match","expected":"환자: 버그버그\n체온: 38도\n열이 1도 높아요"},{"type":"code_check","expected":"fever = temperature"}]',
  '{"level_1":"에러 메시지 맨 아래 줄을 보세요. 어떤 이름이 없다고 하나요?","level_2":"line 4 는 4번째 줄이에요. 그 줄의 이름과 3번째 줄에서 만든 이름을 한 글자씩 비교해 보세요.","level_3":"4번째 줄을 fever = temperature - 37 로 고쳐 보세요!"}'::jsonb,
  E'# 버그버그 진료 기록\npatient = "버그버그"\ntemperature = 38\nfever = temperature - 37\nprint(f"환자: {patient}")\nprint(f"체온: {temperature}도")\nprint(f"열이 {fever}도 높아요")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-2: 문법 응급실
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000037',
  '[{"type":"output_match","expected":"아침: 약 한 알\n점심: 약 한 알\n저녁: 약 한 알\n다 먹었어요!"},{"type":"code_check","expected":"in times:"}]',
  '{"level_1":"for 나 if 줄 끝에는 늘 붙는 기호가 있었어요. 무엇이었죠?","level_2":"for t in times 끝에 쌍점(:)을 붙여요. 그다음 print( 의 여는 괄호에 맞는 닫는 괄호가 있는지 세어 봐요. 닫는 괄호는 따옴표 바깥, 줄 맨 끝에 붙여요.","level_3":"두 줄을 이렇게 고쳐 보세요!\nfor t in times:\n    print(f\"{t}: 약 한 알\")"}'::jsonb,
  E'# 버그버그 약 먹는 시간표\ntimes = ["아침", "점심", "저녁"]\nfor t in times:\n    print(f"{t}: 약 한 알")\nprint("다 먹었어요!")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-3: 어떤 에러일까?
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000038',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-e9ix"],"explanation":"조개가 2개라 번호는 0과 1뿐이에요. 없는 번호 2를 꺼내서 IndexError 가 나요.","explanations":{"opt-7tqv":"TypeError 는 글자와 숫자처럼 섞을 수 없는 것을 섞을 때 나요.","opt-87aa":"NameError 는 없는 이름을 쓸 때 나요. shells 는 첫 줄에서 만들었어요.","opt-i3vw":"KeyError 는 딕셔너리에 없는 이름표를 꺼낼 때 나요. shells 는 리스트예요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-4: 없는 이름표 처방
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000039',
  '[{"type":"output_match","expected":"감기약: 3개\n밴드: 5개\n연고: 0개"},{"type":"code_check","expected":".get("}]',
  '{"level_1":"등대 딕셔너리 도서관에서 없는 책을 찾을 때 어떤 꺼내기를 썼는지 떠올려 보세요.","level_2":"medicine.get(이름표, 대신 값) 은 이름표가 없으면 대신 값을 줘요. 약이 없으면 0개예요.","level_3":"print 줄을 print(f\"{name}: {medicine.get(name, 0)}개\") 로 고쳐 보세요!"}'::jsonb,
  E'medicine = {"감기약": 3, "밴드": 5}\nbook = ["감기약", "밴드", "연고"]\n\nfor name in book:\n    print(f"{name}: {medicine.get(name, 0)}개")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-5: 숫자 변신 안전띠
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000040',
  '[{"type":"output_match","expected":"3 더했어요\nabc: 숫자가 아니에요\n5 더했어요\n합계: 8"},{"type":"code_check","expected":"except"}]',
  '{"level_1":"에러가 날 수도 있는 줄을 감싸는 안전띠는 try 와 except 두 낱말이에요.","level_2":"try: 아래에 세 줄을 들여써 넣고, 같은 높이에 except ValueError: 를 써서 그 아래에 안내 글을 출력해요.","level_3":"for 안을 이렇게 바꿔 보세요!\n    try:\n        number = int(card)\n        total = total + number\n        print(f\"{card} 더했어요\")\n    except ValueError:\n        print(f\"{card}: 숫자가 아니에요\")"}'::jsonb,
  E'cards = ["3", "abc", "5"]\ntotal = 0\n\nfor card in cards:\n    try:\n        number = int(card)\n        total = total + number\n        print(f"{card} 더했어요")\n    except ValueError:\n        print(f"{card}: 숫자가 아니에요")\n\nprint(f"합계: {total}")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-6: 사탕 나누기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000041',
  '[{"type":"output_match","expected":"3명이면 한 명에 4개\n나눌 친구가 없어요\n2명이면 한 명에 6개"},{"type":"code_check","expected":"except ZeroDivisionError"}]',
  '{"level_1":"숫자 변신 안전띠처럼 try 와 except 로 감싸요. 이번에 잡을 에러 이름은 쪽지 맨 아래 줄에 있어요.","level_2":"try: 아래에 print 줄을 넣고, except ZeroDivisionError: 아래에 print(\"나눌 친구가 없어요\") 를 써요.","level_3":"for 안을 이렇게 바꿔 보세요!\n    try:\n        print(f\"{f}명이면 한 명에 {candy // f}개\")\n    except ZeroDivisionError:\n        print(\"나눌 친구가 없어요\")"}'::jsonb,
  E'candy = 12\nfriends = [3, 0, 2]\n\nfor f in friends:\n    try:\n        print(f"{f}명이면 한 명에 {candy // f}개")\n    except ZeroDivisionError:\n        print("나눌 친구가 없어요")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-7: 안전띠 순서
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000042',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"parsons","accepted":[[{"id":"ln-s4xi","indent":0},{"id":"ln-c5ix","indent":1},{"id":"ln-np9f","indent":1},{"id":"ln-1y66","indent":0},{"id":"ln-ddj9","indent":1}]],"explanation":"try 아래에서 \"다섯\"을 int()로 바꿔 보다가 ValueError 가 나면, 남은 줄은 건너뛰고 except ValueError 아래로 가서 \"숫자로 바꿀 수 없어요\"를 보여 줘요. try 와 except 는 같은 높이, 그 안의 줄은 한 칸 들여써요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-8: 조용한 버그 탐정
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000043',
  '[{"type":"output_match","expected":"평균: 80.0"},{"type":"code_check","expected":"for","whole_word":true}]',
  '{"level_1":"반복 안에 print(i, scores[i]) 를 넣어 실행해 보세요. 점수 세 개가 다 나오나요?","level_2":"리스트 번호는 0부터예요. range(1, len(scores)) 는 몇 번부터 시작하나요?","level_3":"for 줄을 for i in range(len(scores)): 로 고치고, 돋보기 print 를 지워 보세요!"}'::jsonb,
  E'scores = [80, 90, 70]\ntotal = 0\n\nfor i in range(len(scores)):\n    total = total + scores[i]\n\navg = round(total / len(scores), 1)\nprint(f"평균: {avg}")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-9: 하나 모자라요
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000044',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"bug_hunt","accepted":[{"line":"ln-k2qn","fix":"fx-n9wb"}],"explanation":"range(1, 8)은 1부터 8 바로 앞인 7까지 돌아서 7일 동안 7알이 돼요. 원래 줄은 6일째에서 멈춰 하루가 모자랐어요.","explanations":{"fx-145j":"7번 돌지만 0일부터 6일까지라서 마지막 날이 6일이 돼요.","fx-gw9k":"이러면 5일째에서 멈춰 이틀이 모자라요.","fx-z5zg":"2일부터 시작해서 첫날이 빠져요.","ln-g8rs":"하루에 한 알씩 더하는 줄은 맞아요.","ln-u3hm":"결과를 보여 주는 줄은 맞아요. 문제는 반복이 며칠 도는지예요.","ln-wb05":"약 개수를 0부터 세기 시작하는 건 맞아요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-10: 고장 난 계산기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000045',
  '[{"type":"output_match","expected":"합계: 7원\n배달비 더해서: 9원\n마지막 물건: 바나나"},{"type":"code_check","expected":"price.get("},{"type":"code_check","expected":"int(delivery)"},{"type":"code_check","expected":"basket["}]',
  '{"level_1":"실행할 때마다 에러 쪽지 맨 아래 줄을 읽어요. 에러 이름이 어디가 아픈지 알려 줘요.","level_2":"없는 이름표는 .get(이름표, 0), 글자 숫자는 int( ), 맨 끝 물건은 번호 -1 이에요.","level_3":"세 줄을 이렇게 고쳐 보세요!\n    total = total + price.get(item, 0)\ntotal = total + int(delivery)\nprint(f\"마지막 물건: {basket[-1]}\")"}'::jsonb,
  E'# 병원선 매점 계산기\nprice = {"사과": 3, "우유": 4, "빵": 5}\nbasket = ["사과", "우유", "바나나"]\ndelivery = "2"\n\ntotal = 0\nfor item in basket:\n    total = total + price.get(item, 0)\nprint(f"합계: {total}원")\n\ntotal = total + int(delivery)\nprint(f"배달비 더해서: {total}원")\n\nprint(f"마지막 물건: {basket[-1]}")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 5-11: 배탈 난 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000205',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-t4hw"],"explanation":"candy 에 든 글자 \"사탕\" 과 숫자 3은 종류가 달라서 + 로 이을 수 없어요. 섞을 수 없는 종류를 섞으면 TypeError 가 나요. str(3) 으로 글자로 바꾸면 고칠 수 있어요.","explanations":{"opt-d3qe":"괄호와 따옴표는 짝이 잘 맞아요. 문법은 틀리지 않았어요.","opt-k9ab":"NameError 는 없는 이름을 쓸 때 나요. candy 는 첫 줄에서 만들었어요.","opt-y7mn":"IndexError 는 없는 번호를 꺼낼 때 나요. 여기서는 번호를 꺼내지 않아요."}},{"kind":"multiple_choice","accepted":["opt-c8ur"],"explanation":"약 상자 딕셔너리에 연고 이름표가 없어요. 없는 이름표를 대괄호로 꺼내면 KeyError 가 나요. get 을 쓰면 멈추지 않아요.","explanations":{"opt-g6zi":"0으로 나누는 곳이 없어요.","opt-m2ft":"IndexError 는 리스트에서 없는 번호를 꺼낼 때 나요. 딕셔너리는 이름표로 꺼내요.","opt-w5lo":"ValueError 는 int(\"abc\") 처럼 바꿀 수 없는 값을 바꿀 때 나요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-x2pn","fix":"fx-b6ks"}],"explanation":"상자 이름은 medicine 인데 마지막 줄에서 e 를 빠뜨렸어요. 이름이 한 글자만 달라도 파이썬은 없는 이름이라고 NameError 를 내요.","explanations":{"fx-g9ma":"이름은 고쳤지만 개 가 빠졌어요.","fx-o4tr":"medicin 은 그대로 틀렸고, Count 처럼 큰 글자로 바꾸면 또 다른 이름이 돼요.","fx-u3yc":"따옴표 앞에 f 가 없으면 중괄호가 그대로 나와요.","ln-h8de":"이 줄은 count 상자를 잘 만들었어요.","ln-q5wa":"이 줄은 medicine 상자를 잘 만들었어요."}},{"kind":"parsons","accepted":[[{"id":"ln-v3mz","indent":0},{"id":"ln-r6bq","indent":0},{"id":"ln-e9sk","indent":1},{"id":"ln-a4wd","indent":2},{"id":"ln-n7ox","indent":1},{"id":"ln-j2gc","indent":2}]],"explanation":"try 안에서 나눠 보고, 0으로 나누는 에러가 나면 except 쪽으로 가요. try 와 except 는 같은 깊이, 할 일은 한 칸 더 들여 써요. 5 다음에 나눌 친구가 없어요 가 나와요."},{"kind":"bug_hunt","accepted":[{"line":"ln-z3re","fix":"fx-c4wn"}],"explanation":"int(\"abc\") 처럼 숫자로 바꿀 수 없는 글자를 바꾸면 ValueError 가 나요. except 뒤에 그 에러 이름을 써야 잡아서 숫자가 아니에요 를 보여 줘요.","explanations":{"fx-t8dj":"KeyError 는 없는 이름표일 때 나요. 여기서 나는 에러가 아니에요.","fx-y2bo":"NameError 는 없는 이름일 때 나요. 여기서 나는 에러가 아니에요.","ln-f2hc":"하나씩 도는 반복은 맞아요.","ln-k5qa":"이 줄에서 에러가 나는 건 맞지만, 고칠 곳은 에러를 잡는 줄이에요.","ln-m6lu":"잡았을 때 보여 줄 말은 맞아요.","ln-p7yt":"글자 두 개가 든 리스트는 맞아요. abc 는 일부러 넣은 거예요.","ln-s8vn":"try 로 해 보는 것은 맞아요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-w7sm","fix":"fx-e6qh"}],"explanation":"range(1, …) 는 1번부터 세서 0번 점수 80을 빠뜨려요. range(len(scores)) 로 0번부터 돌면 세 점수를 모두 더해 평균 90이 나와요.","explanations":{"fx-a9uv":"0번부터 세지만 끝이 하나 모자라서 100을 빠뜨려요.","fx-s3mk":"끝을 하나 늘리면 없는 3번 점수를 꺼내다 IndexError 가 나요.","ln-b9xe":"점수 리스트는 맞아요.","ln-d5yf":"점수를 더하는 줄은 맞아요. 몇 번째 점수부터 더하는지 살펴봐요.","ln-g4kp":"합계를 0에서 시작하는 것은 맞아요.","ln-r2na":"개수로 나누는 것은 맞아요. 합계가 모자라요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-1: 진주 합계와 평균
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000046',
  '[{"type":"output_match","expected":"합계: 53\n평균: 10.6\nTrue"},{"type":"code_check","expected":"for","whole_word":true}]',
  '{"level_1":"1월드 합계 구하기처럼 0에서 시작해 반복하며 하나씩 더해요.","level_2":"for p in pearls: 아래에 total = total + p 를 들여써요. 평균은 round(total / len(pearls), 1) 이에요.","level_3":"빈칸을 이렇게 채워 보세요!\nfor p in pearls:\n    total = total + p\navg = round(total / len(pearls), 1)"}'::jsonb,
  E'pearls = [12, 7, 15, 9, 10]\ntotal = 0\n\nfor p in pearls:\n    total = total + p\n\nprint(f"합계: {total}")\n\navg = round(total / len(pearls), 1)\nprint(f"평균: {avg}")\n\nprint(total == sum(pearls))\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-2: 가장 큰 물고기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000047',
  '[{"type":"output_match","expected":"가장 큰 물고기: 77cm"},{"type":"code_check","expected":"if","whole_word":true},{"type":"code_check","expected":">"}]',
  '{"level_1":"물고기 f 가 대장 best 보다 큰지 물어봐요. 크다는 비교 기호는 무엇이죠?","level_2":"if f > best: 로 묻고, 맞으면 그 아래 들여써서 best = f 로 대장을 바꿔요.","level_3":"빈칸을 이렇게 바꿔 보세요!\n    if f > best:\n        best = f"}'::jsonb,
  E'fish = [34, 52, 18, 77, 45]\n\nbest = fish[0]\n\nfor f in fish:\n    if f > best:\n        best = f\n\nprint(f"가장 큰 물고기: {best}cm")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-3: 대장이 몇 번 바뀔까?
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000048',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-8vqv"],"explanation":"대장 3에서 시작해요. 3은 같아서 그대로, 8은 더 커서 대장이 되고 8을 외쳐요. 5는 작아서 그대로, 9는 더 커서 9를 외쳐요. 2는 작아요. 그래서 8과 9가 나와요.","explanations":{"opt-02jo":"3은 대장 3과 같아서 크지 않아요. 같을 때는 외치지 않아요.","opt-5in5":"5는 대장 8보다 작아서 대장이 바뀌지 않아요.","opt-ev9f":"print 가 반복 안에 있어서 대장이 바뀔 때마다 외쳐요. 마지막 대장만 나오는 게 아니에요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-4: 키 큰 친구 세기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000049',
  '[{"type":"output_match","expected":"[135, 141, 130, 133]\n130cm 이상: 4명"},{"type":"code_check","expected":"append("}]',
  '{"level_1":"키 h 가 130 이상인지 if 로 물어봐요. \"이상\"은 같은 것도 들어가요.","level_2":"if h >= 130: 아래에 들여써서 tall.append(h) 를 써요.","level_3":"빈칸을 이렇게 바꿔 보세요!\n    if h >= 130:\n        tall.append(h)"}'::jsonb,
  E'heights = [128, 135, 141, 126, 130, 133, 129]\ntall = []\n\nfor h in heights:\n    if h >= 130:\n        tall.append(h)\n\nprint(tall)\nprint(f"130cm 이상: {len(tall)}명")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-5: 조개 속 진주 찾기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000050',
  '[{"type":"output_match","expected":"1번째 조개를 열어요\n2번째 조개를 열어요\n3번째 조개를 열어요\n3번째 조개에서 찾았어요"},{"type":"code_check","expected":"break","whole_word":true}]',
  '{"level_1":"찾았다는 표시 found 를 바꾸고, 반복을 바로 끝내는 주문을 써요. 1월드에서 반복을 멈출 때 쓴 낱말이에요.","level_2":"if 안에 found = True 를 쓰고, 그 아래 줄에 break 를 써요.","level_3":"빈칸을 이렇게 바꿔 보세요!\n        found = True\n        break"}'::jsonb,
  E'beach = ["모래", "미역", "진주", "돌멩이", "진주"]\nopened = 0\nfound = False\n\nfor shell in beach:\n    opened = opened + 1\n    print(f"{opened}번째 조개를 열어요")\n    if shell == "진주":\n        found = True\n        break\n\nif found:\n    print(f"{opened}번째 조개에서 찾았어요")\nelse:\n    print("없어요")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-6: 대장 찾기 빈칸
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000051',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"fill_blank","accepted":[{"bk-s4dq":"tok-c8pe","bk-7mzc":"tok-h5ug"}],"explanation":"n 이 대장 best 보다 크면(>) 대장을 n 으로 바꿔요. 4 → 9 로 대장이 바뀌고 6은 9보다 작아서 그대로라 9가 나와요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-7: 업다운 마법
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000052',
  '[{"type":"output_match","expected":"50: 업!\n75: 업!\n88: 다운!\n81: 다운!\n78: 다운!\n76: 업!\n77: 정답!\n7번 만에 찾았어요"},{"type":"code_check","expected":"while"},{"type":"code_check","expected":"// 2"}]',
  '{"level_1":"\"업!\"이면 비밀 수가 guess 보다 커요. 그럼 guess 와 그보다 작은 수는 더 볼 필요가 없겠죠?","level_2":"업이면 아래쪽 끝 low 를 guess 바로 다음 수로, 다운이면 위쪽 끝 high 를 guess 바로 앞 수로 바꿔요.","level_3":"두 빈칸을 이렇게 채워 보세요!\nlow = guess + 1\nhigh = guess - 1"}'::jsonb,
  E'secret = 77\nlow = 1\nhigh = 100\ntries = 0\nguess = 0\n\nwhile guess != secret:\n    guess = (low + high) // 2\n    tries = tries + 1\n    if guess < secret:\n        print(f"{guess}: 업!")\n        low = guess + 1\n    elif guess > secret:\n        print(f"{guess}: 다운!")\n        high = guess - 1\n    else:\n        print(f"{guess}: 정답!")\n\nprint(f"{tries}번 만에 찾았어요")\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-8: 키 순서대로 줄 서기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000053',
  '[{"type":"output_match","expected":"[125]\n[125, 128]\n[125, 128, 132]\n[125, 128, 132, 136]\n[125, 128, 132, 136, 140]\nTrue"},{"type":"code_check","expected":".remove("},{"type":"code_check","expected":"min(","whole_word":true}]',
  '{"level_1":"남은 친구 중 가장 작은 키는 1월드에서 배운 min( ) 으로 찾아요. 찾은 친구는 원래 줄에서 빼야 다음에 또 뽑히지 않아요.","level_2":"빼는 메서드는 line.remove(값), 새 줄 뒤에 세우는 메서드는 new_line.append(값) 이에요.","level_3":"세 빈칸을 이렇게 채워 보세요!\n    shortest = min(line)\n    line.remove(shortest)\n    new_line.append(shortest)"}'::jsonb,
  E'line = [132, 125, 140, 128, 136]\ncheck = sorted(line)\nnew_line = []\n\nfor i in range(5):\n    shortest = min(line)\n    line.remove(shortest)\n    new_line.append(shortest)\n    print(new_line)\n\nprint(new_line == check)\n',
  '[]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 6-9: 산맥 지킴이 버그버그
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000206',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-j6sw"],"explanation":"3 + 5 + 4 로 합계는 12예요. 12를 진주 개수 3으로 나누면 4.0 인데, / 로 나누면 언제나 소수점이 붙어요.","explanations":{"opt-f8ky":"진주는 3개라서 3으로 나눠요. 12 ÷ 3 은 4예요.","opt-q2dn":"/ 로 나눈 결과에는 소수점이 붙어요. round 를 해도 4.0 으로 남아요.","opt-v5mb":"print 는 쓴 차례대로 보여 줘요. 합계가 먼저예요."}},{"kind":"multiple_choice","accepted":["opt-r3hx"],"explanation":"대장은 4로 시작해요. 9가 더 커서 바뀌고, 2는 작아서 그대로, 11이 더 커서 또 바뀌고, 7은 작아서 그대로예요. 바뀔 때만 보여 줘서 두 줄이 나와요.","explanations":{"opt-c7ua":"처음 대장 4는 바뀐 게 아니라서 보여 주지 않아요.","opt-n4gt":"print 가 if 안에 있어서 바뀔 때마다 보여 줘요. 마지막에 한 번만이 아니에요.","opt-w9ep":"7은 대장 11보다 작아서 바뀌지 않아요."}},{"kind":"fill_blank","accepted":[{"bk-p6rd":"tok-g5wq","bk-x3vf":"tok-s4ny"}],"explanation":">= 는 \"크거나 같다\"예요. 130 이상인 135, 131, 140 을 append 로 새 리스트 끝에 담으면 3명이에요.","explanations":{"tok-b8lo":"< 를 쓰면 130 보다 작은 친구만 골라요.","tok-k2ez":"remove 는 리스트에서 빼는 메서드예요. 빈 리스트에서 빼려고 하면 멈춰요."}},{"kind":"multiple_choice","accepted":["opt-y8bk"],"explanation":"모래, 돌, 진주 순서로 열어요. 진주를 연 그 순간에도 1을 더한 다음 break 로 멈춰서 3번이에요. 마지막 돌은 열지 않아요.","explanations":{"opt-e5qm":"진주를 찾으면 break 로 멈춰서 마지막 조개는 열지 않아요.","opt-h2zc":"진주를 연 것도 한 번이에요. 1을 더한 다음에 멈춰요.","opt-t6ja":"진주는 세 번째 조개에 있어요."}},{"kind":"parsons","accepted":[[{"id":"ln-m3vc","indent":0},{"id":"ln-z8ka","indent":0},{"id":"ln-b4re","indent":1},{"id":"ln-w6py","indent":2},{"id":"ln-f9dt","indent":2}]],"explanation":"번호로 하나씩 열어 보다가 진주를 만나면, 먼저 몇 번째인지 보여 주고 break 로 멈춰요. 번호는 0부터라 1을 더해 2번째 조개라고 알려 줘요."},{"kind":"fill_blank","accepted":[{"bk-h7nu":"tok-r9cx","bk-d4sa":"tok-w7jb"}],"explanation":"// 는 나눈 몫만 남겨서 가운데 수가 50이 돼요. 50은 70보다 작아서 업! 이제 50은 아니니까 51부터 다시 찾아요.","explanations":{"tok-a3mf":"/ 로 나누면 50.5 처럼 소수점이 생겨요. 수 맞히기에는 몫만 남기는 // 를 써요.","tok-e2tg":"비밀 수가 더 크니까 아래쪽 끝을 올려야 해요. 빼면 오히려 내려가요."}},{"kind":"parsons","accepted":[[{"id":"ln-u7hs","indent":0},{"id":"ln-c2qn","indent":0},{"id":"ln-k9wd","indent":0},{"id":"ln-g3yx","indent":1},{"id":"ln-a8fp","indent":1},{"id":"ln-s5ob","indent":1},{"id":"ln-e6lz","indent":0}],[{"id":"ln-c2qn","indent":0},{"id":"ln-u7hs","indent":0},{"id":"ln-k9wd","indent":0},{"id":"ln-g3yx","indent":1},{"id":"ln-a8fp","indent":1},{"id":"ln-s5ob","indent":1},{"id":"ln-e6lz","indent":0}],[{"id":"ln-u7hs","indent":0},{"id":"ln-c2qn","indent":0},{"id":"ln-k9wd","indent":0},{"id":"ln-g3yx","indent":1},{"id":"ln-s5ob","indent":1},{"id":"ln-a8fp","indent":1},{"id":"ln-e6lz","indent":0}],[{"id":"ln-c2qn","indent":0},{"id":"ln-u7hs","indent":0},{"id":"ln-k9wd","indent":0},{"id":"ln-g3yx","indent":1},{"id":"ln-s5ob","indent":1},{"id":"ln-a8fp","indent":1},{"id":"ln-e6lz","indent":0}]],"explanation":"남은 줄이 빌 때까지, 가장 작은 키를 찾고 그 친구를 원래 줄에서 빼서 새 줄 끝에 세워요. 빼기와 세우기는 어느 쪽이 먼저여도 괜찮아요. [3, 5, 8] 이 나와요."}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 7-1: 기록 함수 순서
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000054',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"parsons","accepted":[[{"id":"ln-w3kd","indent":0},{"id":"ln-c8zt","indent":0},{"id":"ln-r5hb","indent":1},{"id":"ln-a2vq","indent":1},{"id":"ln-m7pe","indent":0},{"id":"ln-e4ys","indent":0}],[{"id":"ln-c8zt","indent":0},{"id":"ln-r5hb","indent":1},{"id":"ln-a2vq","indent":1},{"id":"ln-w3kd","indent":0},{"id":"ln-m7pe","indent":0},{"id":"ln-e4ys","indent":0}]],"explanation":"함수 안의 두 줄은 한 칸 들여 써요. 기록 딕셔너리를 먼저 만들어야 리스트에 더할 수 있어요. 빈 리스트는 함수를 부르기 전이면 맨 앞이든 함수 다음이든 괜찮아요. 기록이 하나 들어가서 1이 나와요."}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 7-2: 용돈 기입장
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000055',
  '[{"type":"contains","expected":"가장 많이 쓴 곳: 선물"},{"type":"code_check","expected":"def add_record"}]',
  '{"level_1":"이 프로젝트는 5단계로 나뉘어 있어요. 단계마다 안내와 해 볼 일을 따라가 보세요!","level_2":"딕셔너리로 기록 하나, 리스트로 기록 여러 개, 함수로 더하기와 합계를 만들어요.","level_3":"막히면 단계마다 있는 힌트를 열어 보세요. 빈칸 ___ 을 채우면 돼요!"}'::jsonb,
  NULL,
  '[{"step_number":1,"expected_output":"[{\"type\":\"output_match\",\"expected\":\"용돈: 5000원\"},{\"type\":\"code_check\",\"expected\":\"record[\"}]","hints":{"level_1":"등대 도서관에서 책 이름표로 값을 꺼냈던 것을 떠올려 보세요!","level_2":"빈칸에는 이름표 글자가 들어가요. 따옴표를 꼭 붙여요.","level_3":"name = record[\"___\"]\nmoney = record[\"___\"]\n빈칸에 딕셔너리의 이름표 두 개를 차례로 넣어 보세요!"},"solution_code":"# 1단계: 기록 하나를 딕셔너리로 만들어요\nrecord = {\"내용\": \"용돈\", \"금액\": 5000}\n\n# record 에서 내용과 금액을 꺼내요\nname = record[\"내용\"]\nmoney = record[\"금액\"]\nprint(f\"{name}: {money}원\")"},{"step_number":2,"expected_output":"[{\"type\":\"contains\",\"expected\":\"[기입장]\\n용돈: 5000원\\n간식: -1500원\\n저금: -2000원\"},{\"type\":\"code_check\",\"expected\":\"in records\"}]","hints":{"level_1":"반복 안의 빈칸에 1단계에서 쓴 세 줄을 다시 써 보세요.","level_2":"반복 안에서도 name, money 를 꺼내고 print 로 보여 줘요. 줄 앞에 빈칸 네 개를 꼭 넣어요.","level_3":"for record in records:\n    name = record[\"내용\"]\n    money = record[\"___\"]\n    print(f\"{name}: {money}원\")\n빈칸에 금액 이름표를 넣어 보세요!"},"solution_code":"# 1단계: 기록 하나를 딕셔너리로 만들어요\nrecord = {\"내용\": \"용돈\", \"금액\": 5000}\n\n# record 에서 내용과 금액을 꺼내요\nname = record[\"내용\"]\nmoney = record[\"금액\"]\nprint(f\"{name}: {money}원\")\n\n# 2단계: 기록 여러 개를 리스트에 담아요\nrecords = [\n    {\"내용\": \"용돈\", \"금액\": 5000},\n    {\"내용\": \"간식\", \"금액\": -1500},\n    {\"내용\": \"저금\", \"금액\": -2000},\n]\n\nprint(\"[기입장]\")\nfor record in records:\n    name = record[\"내용\"]\n    money = record[\"금액\"]\n    print(f\"{name}: {money}원\")"},{"step_number":3,"expected_output":"[{\"type\":\"contains\",\"expected\":\"기록 5개\"},{\"type\":\"code_check\",\"expected\":\".append(\"}]","hints":{"level_1":"리스트 끝에 하나를 더하는 메서드를 떠올려 보세요. 리스트 호수에서 배웠어요!","level_2":"records.append( ) 괄호 안에 {\"내용\": name, \"금액\": money} 딕셔너리를 넣어요.","level_3":"def add_record(name, money):\n    records.___({\"내용\": name, \"금액\": money})\n빈칸에 리스트에 더하는 메서드 이름을 넣어 보세요!"},"solution_code":"# 1단계: 기록 하나를 딕셔너리로 만들어요\nrecord = {\"내용\": \"용돈\", \"금액\": 5000}\n\n# record 에서 내용과 금액을 꺼내요\nname = record[\"내용\"]\nmoney = record[\"금액\"]\nprint(f\"{name}: {money}원\")\n\n# 2단계: 기록 여러 개를 리스트에 담아요\nrecords = [\n    {\"내용\": \"용돈\", \"금액\": 5000},\n    {\"내용\": \"간식\", \"금액\": -1500},\n    {\"내용\": \"저금\", \"금액\": -2000},\n]\n\nprint(\"[기입장]\")\nfor record in records:\n    name = record[\"내용\"]\n    money = record[\"금액\"]\n    print(f\"{name}: {money}원\")\n\n# 3단계: 기록을 더하는 함수를 만들어요\ndef add_record(name, money):\n    records.append({\"내용\": name, \"금액\": money})\n\nadd_record(\"간식\", -800)\nadd_record(\"심부름\", 1000)\nprint(f\"기록 {len(records)}개\")"},{"step_number":4,"expected_output":"[{\"type\":\"contains\",\"expected\":\"들어온 돈: 6000원\\n나간 돈: 4300원\\n남은 돈: 1700원\"},{\"type\":\"code_check\",\"expected\":\"left +\"}]","hints":{"level_1":"해저 알고리즘 산맥에서 진주 무게를 하나씩 더했던 방법과 같아요!","level_2":"total() 안의 빈칸은 left = left + record[\"금액\"] 이에요. 아래 빈칸에는 지금 보고 있는 기록의 금액을 넣어요.","level_3":"left = left + record[\"___\"]\nspend = spend - record[\"___\"]\n빈칸 두 곳에 같은 이름표를 넣어 보세요!"},"solution_code":"# 1단계: 기록 하나를 딕셔너리로 만들어요\nrecord = {\"내용\": \"용돈\", \"금액\": 5000}\n\n# record 에서 내용과 금액을 꺼내요\nname = record[\"내용\"]\nmoney = record[\"금액\"]\nprint(f\"{name}: {money}원\")\n\n# 2단계: 기록 여러 개를 리스트에 담아요\nrecords = [\n    {\"내용\": \"용돈\", \"금액\": 5000},\n    {\"내용\": \"간식\", \"금액\": -1500},\n    {\"내용\": \"저금\", \"금액\": -2000},\n]\n\nprint(\"[기입장]\")\nfor record in records:\n    name = record[\"내용\"]\n    money = record[\"금액\"]\n    print(f\"{name}: {money}원\")\n\n# 3단계: 기록을 더하는 함수를 만들어요\ndef add_record(name, money):\n    records.append({\"내용\": name, \"금액\": money})\n\nadd_record(\"간식\", -800)\nadd_record(\"심부름\", 1000)\nprint(f\"기록 {len(records)}개\")\n\n# 4단계: 남은 돈을 계산하는 함수를 만들어요\ndef total():\n    left = 0\n    for record in records:\n        left = left + record[\"금액\"]\n    return left\n\nincome = 0\nspend = 0\nfor record in records:\n    if record[\"금액\"] > 0:\n        income = income + record[\"금액\"]\n    else:\n        spend = spend - record[\"금액\"]\n\nprint(f\"들어온 돈: {income}원\")\nprint(f\"나간 돈: {spend}원\")\nprint(f\"남은 돈: {total()}원\")"},{"step_number":5,"expected_output":"[{\"type\":\"contains\",\"expected\":\"[이번 달 보고서]\\n간식: 2300원\\n저금: 2000원\\n선물: 2500원\\n가장 많이 쓴 곳: 선물\"},{\"type\":\"code_check\",\"expected\":\"money >\",\"whole_word\":true}]","hints":{"level_1":"지금 보고 있는 money 가 지금까지의 대장 big_money 보다 큰지 비교해 보세요.","level_2":"if 뒤에 money > big_money 처럼 두 값을 비교하는 조건을 써요.","level_3":"if money ___ big_money:\n빈칸에 \"더 크다\"를 뜻하는 기호를 넣어 보세요!"},"solution_code":"# 1단계: 기록 하나를 딕셔너리로 만들어요\nrecord = {\"내용\": \"용돈\", \"금액\": 5000}\n\n# record 에서 내용과 금액을 꺼내요\nname = record[\"내용\"]\nmoney = record[\"금액\"]\nprint(f\"{name}: {money}원\")\n\n# 2단계: 기록 여러 개를 리스트에 담아요\nrecords = [\n    {\"내용\": \"용돈\", \"금액\": 5000},\n    {\"내용\": \"간식\", \"금액\": -1500},\n    {\"내용\": \"저금\", \"금액\": -2000},\n]\n\nprint(\"[기입장]\")\nfor record in records:\n    name = record[\"내용\"]\n    money = record[\"금액\"]\n    print(f\"{name}: {money}원\")\n\n# 3단계: 기록을 더하는 함수를 만들어요\ndef add_record(name, money):\n    records.append({\"내용\": name, \"금액\": money})\n\nadd_record(\"간식\", -800)\nadd_record(\"심부름\", 1000)\nprint(f\"기록 {len(records)}개\")\n\n# 4단계: 남은 돈을 계산하는 함수를 만들어요\ndef total():\n    left = 0\n    for record in records:\n        left = left + record[\"금액\"]\n    return left\n\nincome = 0\nspend = 0\nfor record in records:\n    if record[\"금액\"] > 0:\n        income = income + record[\"금액\"]\n    else:\n        spend = spend - record[\"금액\"]\n\nprint(f\"들어온 돈: {income}원\")\nprint(f\"나간 돈: {spend}원\")\nprint(f\"남은 돈: {total()}원\")\n\n# 5단계: 이번 달 보고서를 만들어요\nadd_record(\"선물\", -2500)\n\nspent = {}\nfor record in records:\n    if record[\"금액\"] < 0:\n        name = record[\"내용\"]\n        if name not in spent:\n            spent[name] = 0\n        spent[name] = spent[name] - record[\"금액\"]\n\nprint(\"[이번 달 보고서]\")\nbig_name = \"\"\nbig_money = 0\nfor name, money in spent.items():\n    print(f\"{name}: {money}원\")\n    if money > big_money:\n        big_name = name\n        big_money = money\nprint(f\"가장 많이 쓴 곳: {big_name}\")"}]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 7-3: 기록장 읽기
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000056',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"multiple_choice","accepted":["opt-h4nw"],"explanation":"records[1] 은 두 번째 기록(간식)이라 내용은 간식이에요. records[0] 은 첫 번째 기록(용돈)이라 금액은 5000이에요.","explanations":{"opt-b6ur":"금액은 0번 기록에서 꺼내요. 0번은 첫 번째 기록이에요.","opt-t9cb":"리스트 번호는 0부터 세요. 1번은 두 번째 기록이에요.","opt-x2gf":"내용은 1번 기록에서 꺼내요. 1번은 두 번째 기록이에요."}}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 7-4: 단어 퀴즈 프로그램
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000057',
  '[{"type":"contains","expected":"맞힌 개수: 3/5"},{"type":"contains","expected":"틀린 단어: 2개"},{"type":"code_check","expected":"random.shuffle"}]',
  '{"level_1":"이 프로젝트는 5단계로 나뉘어 있어요. 단계마다 안내와 해 볼 일을 따라가 보세요!","level_2":"단어장 딕셔너리, 채점 함수, 순서 섞기, 오답 노트 순서로 만들어요.","level_3":"막히면 단계마다 있는 힌트를 열어 보세요. 빈칸 ___ 을 채우면 돼요!"}'::jsonb,
  NULL,
  '[{"step_number":1,"expected_output":"[{\"type\":\"output_match\",\"expected\":\"apple = 사과\\nsea = 바다\\nstar = 별\\nfish = 물고기\\nship = 배\"},{\"type\":\"code_check\",\"expected\":\".items(\"}]","hints":{"level_1":"책장 한 바퀴 퀘스트에서 이름표와 내용을 한 쌍씩 꺼냈던 메서드를 떠올려 보세요!","level_2":"빈칸에 영어로 \"물건들\"이라는 뜻의 메서드 이름을 넣어요.","level_3":"for eng, kor in words.___():\n빈칸에 i 로 시작하는 다섯 글자 메서드 이름을 넣어 보세요!"},"solution_code":"# 1단계: 단어장을 만들어요\nwords = {\"apple\": \"사과\", \"sea\": \"바다\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"배\"}\n\nfor eng, kor in words.items():\n    print(f\"{eng} = {kor}\")"},{"step_number":2,"expected_output":"[{\"type\":\"contains\",\"expected\":\"True\\nFalse\"},{\"type\":\"code_check\",\"expected\":\"==\"}]","hints":{"level_1":"단어장에서 뜻을 꺼내 답과 같은지 비교하면 돼요.","level_2":"return 뒤에 words[word] == answer 처럼 비교를 바로 써도 True 나 False 가 돌아가요.","level_3":"return words[___] == answer\n빈칸에 함수가 받은 영어 단어 변수 이름을 넣어 보세요!"},"solution_code":"# 1단계: 단어장을 만들어요\nwords = {\"apple\": \"사과\", \"sea\": \"바다\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"배\"}\n\nfor eng, kor in words.items():\n    print(f\"{eng} = {kor}\")\n\n# 2단계: 답이 맞는지 알려 주는 함수\ndef check(word, answer):\n    return words[word] == answer\n\nprint(check(\"sea\", \"바다\"))\nprint(check(\"star\", \"달\"))"},{"step_number":3,"expected_output":"[{\"type\":\"contains\",\"expected\":\"맞힌 개수: 3/5\"},{\"type\":\"code_check\",\"expected\":\"if check(\"}]","hints":{"level_1":"2단계에서 만든 함수에 단어와 답을 넣어 불러 보세요.","level_2":"if check(word, answer): 다음 줄에 score = score + 1 을 써요. 들여쓰기를 한 번 더 해요!","level_3":"if check(word, ___):\n    score = score + 1\n빈칸에 친구가 적은 답 변수 이름을 넣어 보세요!"},"solution_code":"# 1단계: 단어장을 만들어요\nwords = {\"apple\": \"사과\", \"sea\": \"바다\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"배\"}\n\nfor eng, kor in words.items():\n    print(f\"{eng} = {kor}\")\n\n# 2단계: 답이 맞는지 알려 주는 함수\ndef check(word, answer):\n    return words[word] == answer\n\nprint(check(\"sea\", \"바다\"))\nprint(check(\"star\", \"달\"))\n\n# 3단계: 친구가 적은 답안지를 채점해요\nanswers = {\"apple\": \"사과\", \"sea\": \"산\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"새\"}\n\nscore = 0\nfor word, answer in answers.items():\n    if check(word, answer):\n        score = score + 1\n\nprint(f\"맞힌 개수: {score}/{len(words)}\")"},{"step_number":4,"expected_output":"[{\"type\":\"contains\",\"expected\":\"다시 풀어도 맞힌 개수: 3/5\"},{\"type\":\"code_check\",\"expected\":\"random.shuffle\"}]","hints":{"level_1":"놀이기구 줄 섞기 퀘스트에서 리스트를 섞었던 주문을 떠올려 보세요!","level_2":"빈칸에 random.shuffle(quiz) 처럼 섞을 리스트를 괄호 안에 넣어요.","level_3":"random.___(quiz)\n빈칸에 \"섞다\"라는 뜻의 영어 낱말을 넣어 보세요!"},"solution_code":"# 1단계: 단어장을 만들어요\nwords = {\"apple\": \"사과\", \"sea\": \"바다\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"배\"}\n\nfor eng, kor in words.items():\n    print(f\"{eng} = {kor}\")\n\n# 2단계: 답이 맞는지 알려 주는 함수\ndef check(word, answer):\n    return words[word] == answer\n\nprint(check(\"sea\", \"바다\"))\nprint(check(\"star\", \"달\"))\n\n# 3단계: 친구가 적은 답안지를 채점해요\nanswers = {\"apple\": \"사과\", \"sea\": \"산\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"새\"}\n\nscore = 0\nfor word, answer in answers.items():\n    if check(word, answer):\n        score = score + 1\n\nprint(f\"맞힌 개수: {score}/{len(words)}\")\n\n# 4단계: 문제 순서를 섞어서 다시 내요\nimport random\n\nquiz = [\"apple\", \"sea\", \"star\", \"fish\", \"ship\"]\nrandom.shuffle(quiz)\n\nscore = 0\nfor word in quiz:\n    answer = answers[word]\n    print(f\"{word} → {answer}\")\n    if check(word, answer):\n        score = score + 1\nprint(f\"다시 풀어도 맞힌 개수: {score}/{len(quiz)}\")"},{"step_number":5,"expected_output":"[{\"type\":\"contains\",\"expected\":\"WRONG NOTE\"},{\"type\":\"contains\",\"expected\":\"틀린 단어: 2개\"},{\"type\":\"code_check\",\"expected\":\".upper(\"},{\"type\":\"code_check\",\"expected\":\".append(\"}]","hints":{"level_1":"첫 빈칸은 리스트에 더하기, 둘째 빈칸은 큰 글자로 바꾸기예요.","level_2":"wrong.append(word) 로 틀린 단어를 더하고, \"wrong note\".upper() 로 제목을 바꿔요.","level_3":"wrong.___(word)\nprint(\"wrong note\".___())\n빈칸에 리스트에 더하는 메서드와 큰 글자로 바꾸는 메서드를 넣어 보세요!"},"solution_code":"# 1단계: 단어장을 만들어요\nwords = {\"apple\": \"사과\", \"sea\": \"바다\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"배\"}\n\nfor eng, kor in words.items():\n    print(f\"{eng} = {kor}\")\n\n# 2단계: 답이 맞는지 알려 주는 함수\ndef check(word, answer):\n    return words[word] == answer\n\nprint(check(\"sea\", \"바다\"))\nprint(check(\"star\", \"달\"))\n\n# 3단계: 친구가 적은 답안지를 채점해요\nanswers = {\"apple\": \"사과\", \"sea\": \"산\", \"star\": \"별\", \"fish\": \"물고기\", \"ship\": \"새\"}\n\nscore = 0\nfor word, answer in answers.items():\n    if check(word, answer):\n        score = score + 1\n\nprint(f\"맞힌 개수: {score}/{len(words)}\")\n\n# 4단계: 문제 순서를 섞어서 다시 내요\nimport random\n\nquiz = [\"apple\", \"sea\", \"star\", \"fish\", \"ship\"]\nrandom.shuffle(quiz)\n\nscore = 0\nfor word in quiz:\n    answer = answers[word]\n    print(f\"{word} → {answer}\")\n    if check(word, answer):\n        score = score + 1\nprint(f\"다시 풀어도 맞힌 개수: {score}/{len(quiz)}\")\n\n# 5단계: 틀린 단어를 오답 노트에 모아요\nwrong = []\nfor word in quiz:\n    if answers[word] != words[word]:\n        wrong.append(word)\n\nprint(\"wrong note\".upper())\nfor word in wrong:\n    print(f\"- {word}: {words[word]}\")\nprint(f\"틀린 단어: {len(wrong)}개\")"}]'::jsonb,
  NULL
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- 정답 7-5: 버그버그 선장
INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)
VALUES (
  'b2000000-0000-0000-0000-000000000207',
  '',
  '{}'::jsonb,
  NULL,
  '[]'::jsonb,
  '{"kind":"boss","rounds":[{"kind":"multiple_choice","accepted":["opt-z5qe"],"explanation":"split 으로 쉼표마다 쪼개면 pirate 와 ship 두 조각이 돼요. 1번 조각은 두 번째인 ship 이고, upper 로 큰 글자가 돼요.","explanations":{"opt-d3wv":"upper 는 모든 글자를 큰 글자로 바꿔요.","opt-k7nj":"split 으로 쪼갠 다음 조각 하나만 꺼냈어요.","opt-m8ta":"리스트 번호는 0부터 세요. 1번은 두 번째 조각이에요."}},{"kind":"fill_blank","accepted":[{"bk-q6wd":"tok-x8rc","bk-j2ns":"tok-f4ab"}],"explanation":"get 은 처음 보는 물고기면 0을 줘서 1부터 셀 수 있어요. items 는 이름표와 내용을 한 쌍씩 꺼내서 고등어 2마리, 참치 1마리가 나와요.","explanations":{"tok-c3mz":"append 는 리스트에 더하는 메서드예요. 딕셔너리에는 없어요.","tok-u9kh":"keys 는 이름표만 꺼내요. 내용 n 은 함께 나오지 않아요."}},{"kind":"multiple_choice","accepted":["opt-p2xg"],"explanation":"바깥 반복은 줄을 하나씩, 안쪽 반복은 그 줄의 칸을 하나씩 붙여요. 줄마다 한 번 보여 줘서 세 줄이 리스트 차례 그대로 나와요.","explanations":{"opt-a9le":"print 가 바깥 반복 안에 있어서 줄마다 따로 보여 줘요.","opt-h4ub":"줄은 리스트에 적힌 차례대로 나와요. 거꾸로가 아니에요.","opt-w6co":"바깥 반복은 칸이 아니라 줄을 하나씩 꺼내요. 그래서 세로가 아니라 가로로 이어요."}},{"kind":"multiple_choice","accepted":["opt-s3fy"],"explanation":"7 나누기 2는 3.5예요. floor 는 내림이라 3, ceil 은 올림이라 4가 돼요.","explanations":{"opt-b2qm":"ceil 은 올림이라 3.5 가 4가 돼요.","opt-e8kd":"floor 는 내림, ceil 은 올림이에요. 둘이 바뀌었어요.","opt-n6wr":"floor 와 ceil 은 소수점 없는 정수로 만들어 줘요."}},{"kind":"bug_hunt","accepted":[{"line":"ln-g5wb","fix":"fx-r8dn"}],"explanation":"명단에 버그버그 이름표가 없어서 대괄호로 꺼내면 KeyError 가 나요. get 으로 꺼내면 없는 이름표 대신 0을 줘서 멈추지 않아요.","explanations":{"fx-c9yz":"이름표는 번호가 아니라 이름이에요. 0 이름표도 없어서 멈춰요.","fx-l6qs":"딕셔너리는 함수처럼 괄호로 부를 수 없어요.","fx-v2hp":"get 은 괄호로 불러요. 대괄호를 쓰면 멈춰요.","ln-t3ka":"선원 명단 딕셔너리는 잘 만들었어요.","ln-y7mc":"이름을 하나씩 도는 반복은 맞아요."}},{"kind":"parsons","accepted":[[{"id":"ln-n4xw","indent":0},{"id":"ln-b7je","indent":0},{"id":"ln-w3go","indent":0},{"id":"ln-h9sa","indent":1},{"id":"ln-d6ry","indent":2},{"id":"ln-k2mf","indent":0}]],"explanation":"보물 리스트를 먼저 만들고, 첫 보물을 대장으로 정해요. 하나씩 보며 더 큰 보물이 나오면 대장을 바꾸고, 다 본 뒤에 한 번 보여 줘서 80이 나와요."},{"kind":"bug_hunt","accepted":[{"line":"ln-q9ha","fix":"fx-o7wm"}],"explanation":"r 은 기록 딕셔너리 하나라서 숫자와 바로 더할 수 없어요. r[\"금액\"] 으로 금액만 꺼내 더하면 모두 4500원이 나와요.","explanations":{"fx-a4kx":"더하지 않고 바꿔 넣기만 해서 마지막 금액만 남아요.","fx-h3ce":"records 는 리스트라서 이름표로 꺼낼 수 없어요. 지금 보고 있는 기록 r 에서 꺼내요.","fx-z6ug":"내용은 간식 같은 글자라서 숫자와 더할 수 없어요.","ln-e4tk":"합계를 0에서 시작하는 것은 맞아요.","ln-m2zd":"기록을 하나씩 도는 반복은 맞아요.","ln-s8pv":"리스트 속 딕셔너리로 기록을 잘 적었어요.","ln-x5bc":"합계를 보여 주는 줄은 맞아요. 더하는 줄을 살펴봐요."}}]}'::jsonb
)
ON CONFLICT (quest_id) DO UPDATE SET
  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,
  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,
  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();

-- ------------------------------------------------------------
-- 6. 실력 확인 퀴즈 (skill_check_questions, service_role 전용, P10-03 · 00052). quiz 는 공개 모양, answer 는 정답
-- ------------------------------------------------------------
INSERT INTO public.skill_check_questions (world_id, set_no, no, review_quest_id, quiz, answer)
VALUES
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 1, 'b1000000-0000-0000-0000-000000000024', '{"kind":"multiple_choice","question":"이 코드를 돌리면 무엇이 나올까?","code":"print(\"물고기\\n문어\")","options":[{"id":"opt-b2xa","text":"물고기 문어"},{"id":"opt-h6mu","text":"물고기문어"},{"id":"opt-r4kd","text":"물고기\n문어"},{"id":"opt-w8ze","text":"물고기\\n문어"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-r4kd"],"explanation":"\\n 은 줄을 바꾸는 특수 문자라서 물고기 다음 줄에 문어가 나와요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 2, 'b1000000-0000-0000-0000-000000000027', '{"kind":"multiple_choice","question":"조개껍데기 상자의 값이 바뀌어요. 돌리면 무엇이 나올까?","code":"shell = 3\nshell = shell + 2\nprint(shell)","options":[{"id":"opt-c9vt","text":"3"},{"id":"opt-k3pw","text":"shell"},{"id":"opt-n5gq","text":"5"},{"id":"opt-y7fe","text":"shell + 2"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-n5gq"],"explanation":"오른쪽 shell + 2 를 먼저 계산해서 3 + 2 = 5 를 다시 shell 상자에 넣어요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 3, 'b1000000-0000-0000-0000-000000000007', '{"kind":"bug_hunt","question":"돌고래 나이를 보여 주려는데 오류가 나요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-d4sk","code":"name = \"돌고래\""},{"id":"ln-u7ma","code":"age = 10"},{"id":"ln-f2yc","code":"print(name + \"의 나이: \" + age)"}],"fixes":[{"id":"fx-g3tb","code":"print(name + \"의 나이: \" + int(age))"},{"id":"fx-q8lo","code":"print(name + \"의 나이: \" + str(age))"},{"id":"fx-v6wr","code":"print(name + \"의 나이: \" + \"age\")"}]}'::jsonb, '{"kind":"bug_hunt","accepted":[{"line":"ln-f2yc","fix":"fx-q8lo"}],"explanation":"글자와 숫자는 + 로 바로 이을 수 없어요. str()로 숫자를 글자로 바꿔야 해요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 4, 'b1000000-0000-0000-0000-000000000009', '{"kind":"multiple_choice","question":"점수에 따라 메달을 줘요. 돌리면 무엇이 나올까?","code":"score = 85\nif score >= 90:\n    print(\"금메달\")\nelif score >= 80:\n    print(\"은메달\")\nelse:\n    print(\"동메달\")","options":[{"id":"opt-a8ny","text":"동메달"},{"id":"opt-e5wx","text":"금메달"},{"id":"opt-l4qc","text":"은메달\n동메달"},{"id":"opt-s2jh","text":"은메달"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-s2jh"],"explanation":"85는 90보다 작고 80 이상이라 elif 줄만 실행돼요. 맞는 조건을 찾으면 나머지는 건너뛰어요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 5, 'b1000000-0000-0000-0000-000000000011', '{"kind":"fill_blank","question":"빈칸을 채워 표가 있고 키도 120 이상일 때만 배에 타게 해요","code":"ticket = True\nheight = 110\nif ticket {{bk-r7ma}} height >= 120:\n    print(\"배에 타요\")\nelse:\n    print(\"다음에 타요\")","tokens":[{"id":"tok-i9de","text":"not"},{"id":"tok-o2kv","text":"or"},{"id":"tok-z5ub","text":"and"}]}'::jsonb, '{"kind":"fill_blank","accepted":[{"bk-r7ma":"tok-z5ub"}],"explanation":"두 조건이 모두 참이어야 할 때는 and 를 써요. 키가 110이라 \"다음에 타요\"가 나와요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 6, 'b1000000-0000-0000-0000-000000000012', '{"kind":"multiple_choice","question":"동굴 계단 번호를 세요. 돌리면 무엇이 나올까?","code":"for i in range(2, 5):\n    print(i)","options":[{"id":"opt-j2wn","text":"3\n4\n5"},{"id":"opt-m6tr","text":"2\n3\n4"},{"id":"opt-p7ge","text":"0\n1\n2\n3\n4"},{"id":"opt-x3fa","text":"2\n3\n4\n5"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-m6tr"],"explanation":"range(2, 5)는 2부터 시작해서 5 바로 앞인 4까지 세요. 끝 숫자는 들어가지 않아요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 7, 'b1000000-0000-0000-0000-000000000034', '{"kind":"parsons","question":"줄을 순서대로 놓고 들여쓰기도 맞춰, while 로 1부터 5까지 더한 값을 한 번만 보여 줘요","lines":[{"id":"ln-a3ls","code":"print(total)"},{"id":"ln-c2rq","code":"n = 1"},{"id":"ln-e4ob","code":"total = total + n"},{"id":"ln-t5hu","code":"total = 0"},{"id":"ln-w9kx","code":"while n <= 5:"},{"id":"ln-y8vj","code":"n = n + 1"}],"indent":true}'::jsonb, '{"kind":"parsons","accepted":[[{"id":"ln-t5hu","indent":0},{"id":"ln-c2rq","indent":0},{"id":"ln-w9kx","indent":0},{"id":"ln-e4ob","indent":1},{"id":"ln-y8vj","indent":1},{"id":"ln-a3ls","indent":0}],[{"id":"ln-c2rq","indent":0},{"id":"ln-t5hu","indent":0},{"id":"ln-w9kx","indent":0},{"id":"ln-e4ob","indent":1},{"id":"ln-y8vj","indent":1},{"id":"ln-a3ls","indent":0}]],"explanation":"반복 안에서 total 에 n 을 더한 뒤 n 을 1 늘려요. 반복이 끝나면 들여쓰기 없이 한 번만 보여 줘서 15가 나와요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 8, 'b1000000-0000-0000-0000-000000000018', '{"kind":"multiple_choice","question":"바닷가에서 주운 것을 리스트에 담아요. 돌리면 무엇이 나올까?","code":"shells = [\"소라\", \"조개\"]\nshells.append(\"불가사리\")\nprint(shells[1], len(shells))","options":[{"id":"opt-f8dm","text":"조개 3"},{"id":"opt-k9ya","text":"불가사리 3"},{"id":"opt-q6sb","text":"조개 2"},{"id":"opt-u3hz","text":"소라 3"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-f8dm"],"explanation":"번호는 0부터 세서 shells[1]은 두 번째인 조개예요. append 로 하나 늘어 모두 3개예요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 9, 'b1000000-0000-0000-0000-000000000020', '{"kind":"fill_blank","question":"빈칸을 채워 두 수를 더해 돌려주는 함수를 만들어요","code":"{{bk-k2dw}} add(a, b):\n    {{bk-p8zn}} a + b\n\nprint(add(3, 4))","tokens":[{"id":"tok-b6ux","text":"print"},{"id":"tok-g7ra","text":"def"},{"id":"tok-n4ce","text":"return"}]}'::jsonb, '{"kind":"fill_blank","accepted":[{"bk-k2dw":"tok-g7ra","bk-p8zn":"tok-n4ce"}],"explanation":"함수는 def 로 만들고, 계산한 값은 return 으로 돌려줘요. 그래서 7이 나와요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 1, 10, 'b1000000-0000-0000-0000-000000000044', '{"kind":"bug_hunt","question":"평균을 보여 주려는데 None 이 나와요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-h3pe","code":"def average(nums):"},{"id":"ln-z7ck","code":"    total = 0"},{"id":"ln-r2wy","code":"    for n in nums:"},{"id":"ln-m5ia","code":"        total = total + n"},{"id":"ln-s8fo","code":"    total / len(nums)"},{"id":"ln-x6dl","code":"print(average([80, 90, 100]))"}],"fixes":[{"id":"fx-j5nv","code":"    return total / len(nums)"},{"id":"fx-o8qa","code":"    print(total / len(nums))"},{"id":"fx-w3ke","code":"return total / len(nums)"}]}'::jsonb, '{"kind":"bug_hunt","accepted":[{"line":"ln-s8fo","fix":"fx-j5nv"}],"explanation":"계산만 하고 돌려주지 않으면 함수는 None 을 돌려줘요. 함수 안에서 return 으로 돌려줘야 해요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 1, 'b1000000-0000-0000-0000-000000000003', '{"kind":"multiple_choice","question":"메모가 섞인 코드예요. 돌리면 무엇이 나올까?","code":"# print(\"안녕\")\nprint(\"바닷가\")\nprint(7 + 3)","options":[{"id":"opt-d9qe","text":"안녕\n바닷가\n10"},{"id":"opt-i4mz","text":"바닷가\n7 + 3"},{"id":"opt-t6wc","text":"바닷가\n73"},{"id":"opt-v2hs","text":"바닷가\n10"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-v2hs"],"explanation":"# 뒤는 메모라 실행하지 않아요. 따옴표 없는 7 + 3 은 계산해서 10이 나와요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 2, 'b1000000-0000-0000-0000-000000000023', '{"kind":"bug_hunt","question":"바다 소식을 두 줄로 보여 주려는데 오류가 나요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-k8ra","code":"print(\"갈매기가 날아요\")"},{"id":"ln-p3zu","code":"print(\"파도가 쳐요'')"}],"fixes":[{"id":"fx-c4lm","code":"print(''파도가 쳐요\")"},{"id":"fx-e6yn","code":"print(\"파도가 쳐요\")"},{"id":"fx-u9dg","code":"print(파도가 쳐요)"}]}'::jsonb, '{"kind":"bug_hunt","accepted":[{"line":"ln-p3zu","fix":"fx-e6yn"}],"explanation":"글자를 여는 따옴표와 닫는 따옴표는 같은 모양이어야 해요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 3, 'b1000000-0000-0000-0000-000000000028', '{"kind":"multiple_choice","question":"생선 가게 간판을 만들어요. 돌리면 무엇이 나올까?","code":"fish = \"고등어\"\ncount = \"3\"\nprint(fish + count + \"마리\")","options":[{"id":"opt-a6jt","text":"fishcount마리"},{"id":"opt-g5xk","text":"고등어3마리"},{"id":"opt-n8rf","text":"fish3마리"},{"id":"opt-w2ob","text":"고등어 3 마리"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-g5xk"],"explanation":"상자 이름 대신 상자 속 글자가 나오고, + 는 띄어쓰기 없이 글자를 그대로 이어 붙여요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 4, 'b1000000-0000-0000-0000-000000000007', '{"kind":"fill_blank","question":"빈칸을 채워 글자 \"4\"를 숫자로 바꾼 뒤 2를 더해 6이 나오게 해요","code":"apples = \"4\"\ntotal = {{bk-m3jx}}(apples) + 2\nprint(total)","tokens":[{"id":"tok-h2qa","text":"str"},{"id":"tok-s7pe","text":"int"},{"id":"tok-y5wi","text":"print"}]}'::jsonb, '{"kind":"fill_blank","accepted":[{"bk-m3jx":"tok-s7pe"}],"explanation":"int()는 글자를 숫자로 바꿔요. 숫자 4가 되어야 2를 더할 수 있어요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 5, 'b1000000-0000-0000-0000-000000000030', '{"kind":"multiple_choice","question":"숫자 요정이 짝을 맞춰 봐요. 돌리면 무엇이 나올까?","code":"n = 7\nif n % 2 == 0:\n    print(\"짝수\")\nelse:\n    print(\"홀수\")","options":[{"id":"opt-e9ks","text":"짝수\n홀수"},{"id":"opt-l7ha","text":"짝수"},{"id":"opt-q2vd","text":"1"},{"id":"opt-z3cu","text":"홀수"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-z3cu"],"explanation":"7 % 2 는 나머지 1이라 0과 같지 않아요. 그래서 else 줄이 실행돼요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 6, 'b1000000-0000-0000-0000-000000000010', '{"kind":"bug_hunt","question":"키가 120 이상이면 탈 수 있어야 하는데, 키가 딱 120인 친구가 못 타요. 틀린 줄을 찾아 고쳐요","lines":[{"id":"ln-f6md","code":"height = 120"},{"id":"ln-o4tw","code":"if height > 120:"},{"id":"ln-j8yb","code":"    print(\"탈 수 있어요\")"},{"id":"ln-r5ce","code":"else:"},{"id":"ln-i2gx","code":"    print(\"다음에 타요\")"}],"fixes":[{"id":"fx-b8wq","code":"if height >= 120:"},{"id":"fx-d6zr","code":"if height == 130:"},{"id":"fx-m4ul","code":"if height < 120:"}]}'::jsonb, '{"kind":"bug_hunt","accepted":[{"line":"ln-o4tw","fix":"fx-b8wq"}],"explanation":"> 는 120을 넣지 않아요. 120도 넣으려면 크거나 같다는 >= 를 써요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 7, 'b1000000-0000-0000-0000-000000000015', '{"kind":"fill_blank","question":"빈칸을 채워 3만 건너뛰고 나머지 숫자는 모두 보여 줘요","code":"for n in range(1, 6):\n    if n == 3:\n        {{bk-w4fe}}\n    print(n)","tokens":[{"id":"tok-c3ni","text":"pass"},{"id":"tok-k5oy","text":"continue"},{"id":"tok-x8bh","text":"break"}]}'::jsonb, '{"kind":"fill_blank","accepted":[{"bk-w4fe":"tok-k5oy"}],"explanation":"continue 는 이번 차례만 건너뛰고 다음 숫자로 가요. 그래서 1, 2, 4, 5가 나와요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 8, 'b1000000-0000-0000-0000-000000000016', '{"kind":"parsons","question":"줄을 순서대로 놓아 빈 리스트에 고등어를 먼저, 참치를 다음에 넣고 물고기 수와 첫 번째 물고기를 보여 줘요","lines":[{"id":"ln-g4qu","code":"fish.append(\"고등어\")"},{"id":"ln-l2ko","code":"print(len(fish), fish[0])"},{"id":"ln-n7sa","code":"fish = []"},{"id":"ln-v9ej","code":"fish.append(\"참치\")"}]}'::jsonb, '{"kind":"parsons","accepted":[["ln-n7sa","ln-g4qu","ln-v9ej","ln-l2ko"]],"explanation":"리스트를 먼저 만들고, 넣은 차례대로 번호가 붙어요. 2개를 넣었고 0번은 고등어예요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 9, 'b1000000-0000-0000-0000-000000000041', '{"kind":"multiple_choice","question":"응원 함수를 불러요. 돌리면 무엇이 나올까?","code":"def cheer(word, times=2):\n    return word * times\n\nprint(cheer(\"야호\"))","options":[{"id":"opt-b3ta","text":"야호 2"},{"id":"opt-h7gn","text":"야호야호야호"},{"id":"opt-p5xi","text":"야호야호"},{"id":"opt-u8cw","text":"야호"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-p5xi"],"explanation":"times 를 주지 않아서 기본값 2를 써요. 글자 * 2 는 글자를 두 번 이어 붙여요."}'::jsonb),
  ((SELECT w.id FROM public.worlds w WHERE w.slug = 'code-sea'), 2, 10, 'b1000000-0000-0000-0000-000000000022', '{"kind":"multiple_choice","question":"숫자 맞추기 게임에서 세 번 골랐어요. 돌리면 무엇이 나올까?","code":"secret = 7\nfor guess in [3, 9, 7]:\n    if guess < secret:\n        print(\"업\")\n    elif guess > secret:\n        print(\"다운\")\n    else:\n        print(\"맞았어\")","options":[{"id":"opt-c2zh","text":"맞았어"},{"id":"opt-o6mr","text":"업\n업\n맞았어"},{"id":"opt-s9fu","text":"다운\n업\n맞았어"},{"id":"opt-y4dk","text":"업\n다운\n맞았어"}]}'::jsonb, '{"kind":"multiple_choice","accepted":["opt-y4dk"],"explanation":"3은 7보다 작아서 업, 9는 커서 다운, 7은 같아서 맞았어가 차례로 나와요."}'::jsonb)
ON CONFLICT (world_id, set_no, no) DO UPDATE SET
  review_quest_id = EXCLUDED.review_quest_id, quiz = EXCLUDED.quiz, answer = EXCLUDED.answer;
