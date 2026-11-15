-- ============================================================
-- 00052 되돌리기: is_stage_unlocked 를 00046 정의로, 실력 확인 퀴즈 함수·테이블 삭제   (P10-03)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 먼저 P10-03 이전 앱으로 되돌립니다 (지금 앱은 /api/world/skill-check 에서 새 함수를 부름).
-- 잃는 데이터: 실력 확인 퀴즈 문제(content seed 로 다시 넣을 수 있음)와 도전·합격 기록.
--   합격으로만 2월드를 연 학생은 2월드 첫 스테이지가 다시 잠김 — 단, 2월드에서 이미 완료한 퀘스트가 있으면
--   00046 규칙("이 스테이지·뒤 스테이지에 완료가 있으면 열림")으로 그 스테이지까지는 계속 열림
-- 실행 후 상태 = 00051 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00052_skill_check.rollback.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. is_stage_unlocked: 00046 정의
-- ------------------------------------------------------------
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
      )
      -- 00046: 이 스테이지나 뒤 스테이지에서 이미 완료한 퀘스트가 있으면 계속 열림 (앞 스테이지에 보스가 새로 생겨도)
      OR EXISTS (
        SELECT 1
          FROM cur
          JOIN public.user_progress up ON up.user_id = p_user_id AND up.status = 'completed'
          JOIN public.quests q ON q.id = up.quest_id
          JOIN public.stages s ON s.id = q.stage_id
          JOIN public.worlds w ON w.id = s.world_id
         WHERE (w."order", s."order") >= (cur.world_order, cur.stage_order)
      );
$$;

COMMENT ON FUNCTION public.is_stage_unlocked(UUID, UUID) IS
  '스테이지 잠금 (00012, 00026 퀴즈 제외, 00046 이 스테이지·뒤 스테이지에 완료가 있으면 열림). TS 사본 src/lib/world/getStageStatuses.ts';

REVOKE ALL ON FUNCTION public.is_stage_unlocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_stage_unlocked(UUID, UUID) TO service_role;

-- ------------------------------------------------------------
-- 2. 새 함수·테이블
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.skill_check_submit(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS public.skill_check_start(UUID, UUID);
DROP FUNCTION IF EXISTS public.skill_check_set_for(DATE, INTEGER);
DROP TABLE IF EXISTS public.skill_check_attempts;
DROP TABLE IF EXISTS public.skill_check_questions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.is_stage_unlocked(uuid, uuid)'::regprocedure
                AND prosrc LIKE '%skill_check_attempts%') THEN
    RAISE EXCEPTION '[00052 rollback] is_stage_unlocked 가 아직 실력 확인 퀴즈를 봄';
  END IF;
  RAISE NOTICE '[00052 rollback] 실력 확인 퀴즈 삭제, is_stage_unlocked = 00046';
END $$;
