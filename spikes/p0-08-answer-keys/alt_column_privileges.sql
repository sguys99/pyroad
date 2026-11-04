-- ============================================================
-- [P0-08 비교 실험 · 채택하지 않음] 대안: quests 컬럼 단위 SELECT 권한 회수
-- 별도 테이블 없이 quests 의 정답 컬럼만 클라이언트에서 못 읽게 하는 방식.
-- verify.sh 의 alt_column_privs 시나리오에서만 적용합니다. 운영에 적용하지 마세요.
--
-- 핵심 한계: hints·solution_code 는 prompt_skeleton(jsonb) "안"에 있어서 컬럼 권한으로는 가릴 수 없음.
--           가리려면 prompt_skeleton 을 공개/비공개 컬럼으로 쪼개야 하고, 그러면 사실상 별도 저장소를 만드는 셈.
-- ============================================================

-- 테이블 단위 SELECT 를 회수하고, 공개할 컬럼만 다시 부여 (expected_output 제외)
REVOKE SELECT ON TABLE public.quests FROM anon, authenticated;
GRANT SELECT (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, xp_reward, created_at)
  ON TABLE public.quests TO anon, authenticated;
