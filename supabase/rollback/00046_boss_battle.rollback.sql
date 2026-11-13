-- ============================================================
-- 00046 되돌리기: 보스 배틀 함수·판 테이블 삭제 · 금액표에서 boss 빼기 · is_stage_unlocked 00026 으로 · 정답 CHECK 좁히기   (P9-12)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P9-12 이전 앱으로 되돌린 뒤 실행합니다.
-- 잃는 데이터: boss_runs(진행 중인 판) 전부. 보스 정답(quest_answer_keys.quiz_answer kind = 'boss')은 NULL 로 비웁니다
--   (보스 퀘스트 행·학생 진행은 지우지 않음 — 지우려면 콘텐츠에서 보스 YAML 을 뺀 뒤 따로). 이미 받은 보스 코인(원장 quest/<보스 id>)은 그대로
-- 실행 후 상태 = 00045 까지 적용된 상태. 보스 퀘스트가 남아 있으면 그 스테이지는 보스를 깨기 전까지 클리어되지 않으니 콘텐츠도 함께 되돌림
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00046_boss_battle.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.boss_answer(UUID, UUID, INTEGER, JSONB);
DROP TABLE IF EXISTS public.boss_runs;

UPDATE public.quest_answer_keys SET quiz_answer = NULL WHERE quiz_answer->>'kind' = 'boss';
ALTER TABLE public.quest_answer_keys DROP CONSTRAINT IF EXISTS quest_answer_keys_quiz_answer_shape;
ALTER TABLE public.quest_answer_keys ADD CONSTRAINT quest_answer_keys_quiz_answer_shape CHECK (
  quiz_answer IS NULL OR (
    jsonb_typeof(quiz_answer) = 'object'
    AND quiz_answer->>'kind' IN ('multiple_choice', 'fill_blank', 'parsons', 'bug_hunt')
    AND jsonb_typeof(quiz_answer->'accepted') = 'array'
    AND jsonb_array_length(quiz_answer->'accepted') > 0
  )
);

CREATE OR REPLACE FUNCTION public.coin_reward(p_kind TEXT, p_n INTEGER DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(CASE p_kind
    WHEN 'quest'       THEN 10
    WHEN 'project'     THEN 40   -- 프로젝트 첫 완료 (§12-Q65 (a), XP 4배에 맞춤)
    WHEN 'star'        THEN 5
    WHEN 'level_up'    THEN CASE WHEN p_n BETWEEN 2 AND 50 THEN CASE WHEN p_n % 5 = 0 THEN 100 ELSE 20 END END
    WHEN 'mission'     THEN (ARRAY[10, 15, 20])[p_n]
    WHEN 'attendance'  THEN (ARRAY[5, 5, 10, 10, 15, 20, 30])[p_n]
    WHEN 'chest'       THEN (ARRAY[30, 50])[p_n]
    WHEN 'achievement' THEN (ARRAY[10, 30, 100])[p_n]
    WHEN 'share'       THEN 15   -- 자랑하기 하루 1회 (P9-10, §12-Q67 ④)
  END, 0);
$$;
REVOKE ALL ON FUNCTION public.coin_reward(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_reward(TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.is_stage_unlocked(p_user_id UUID, p_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH cur AS (
    SELECT w."order" AS world_order, s."order" AS stage_order
      FROM public.stages s
      JOIN public.worlds w ON w.id = s.world_id
     WHERE s.id = p_stage_id
  ),
  prev AS (
    SELECT p.id
      FROM cur
      JOIN public.stages p ON true
      JOIN public.worlds pw ON pw.id = p.world_id
     WHERE (pw."order", p."order") < (cur.world_order, cur.stage_order)
     ORDER BY pw."order" DESC, p."order" DESC
     LIMIT 1
  )
  SELECT NOT EXISTS (SELECT 1 FROM prev)
      OR (
        EXISTS (SELECT 1 FROM public.quests q JOIN prev ON q.stage_id = prev.id
                 WHERE q.quest_type <> 'quiz')
        AND NOT EXISTS (
          SELECT 1
            FROM public.quests q
            JOIN prev ON q.stage_id = prev.id
           WHERE q.quest_type <> 'quiz'
             AND NOT EXISTS (
               SELECT 1 FROM public.user_progress up
                WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed'))
      );
$$;
REVOKE ALL ON FUNCTION public.is_stage_unlocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_stage_unlocked(UUID, UUID) TO service_role;
