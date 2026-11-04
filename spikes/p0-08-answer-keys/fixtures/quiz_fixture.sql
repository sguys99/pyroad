-- [P0-08 테스트 픽스처] 객관식·순서 맞추기 퀴즈 1개씩 (stage 1, order 90~91)
-- 정답은 quest_answer_keys 에만 둠. 보기 id 는 정답 위치를 암시하지 않는 임의 문자열.
INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, xp_reward)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 90,
   '[픽스처] 출력 예측', 'print()',
   '{"topic":"print 결과 예측","learning_goals":[],"story_context":"","exercise_description":"출력은?",
     "starter_code":"","expected_output_hint":"","fallback_text":"",
     "quiz":{"kind":"multiple_choice","question":"print(1 + 2) 의 결과는?",
             "options":[{"id":"opt_q7","label":"12"},{"id":"opt_k2","label":"3"},
                        {"id":"opt_x9","label":"1 + 2"},{"id":"opt_m4","label":"에러"}]}}'::jsonb,
   'output_match', 30),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 91,
   '[픽스처] 코드 순서', 'for',
   '{"topic":"순서 맞추기","learning_goals":[],"story_context":"","exercise_description":"순서대로",
     "starter_code":"","expected_output_hint":"","fallback_text":"",
     "quiz":{"kind":"parsons","lines":[{"id":"ln_m","code":"    print(i)"},{"id":"ln_x","code":"for i in range(3):"}]}}'::jsonb,
   'output_match', 30)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quest_answer_keys (quest_id, quiz_answer)
VALUES
  ('c1000000-0000-0000-0000-000000000001',
   '{"kind":"multiple_choice","accepted":["opt_k2"],
     "explanations":{"opt_q7":"문자열이 아니라 숫자 덧셈이에요.","opt_x9":"따옴표가 없으면 계산돼요.","_default":"1 + 2 를 계산해서 3 이 나와요."}}'::jsonb),
  ('c1000000-0000-0000-0000-000000000002',
   '{"kind":"parsons","accepted":[["ln_x","ln_m"]],"explanations":{"_default":"for 줄이 먼저, 들여쓴 줄이 그 안에 와요."}}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();
