-- ============================================================
-- 스테이지 잠금 해제 연출 "본 기록" (Idempotent)   (P5-05, §12-Q49)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱은 새 테이블·함수를 쓰지 않으므로 그대로 동작)
--
-- 배경
--   - 월드맵은 새로 열린 스테이지에서 잠금 해제 연출(통과 도장 → 잉크 길 → 자물쇠 깨짐 → 파이뱀 이동)을 **한 번만** 보여 줌.
--     "이미 봤는지"를 기기(localStorage)가 아니라 서버에 두어 기기를 바꿔도 다시 나오지 않게 함 (Q49)
--   - 앱은 지금 열린 스테이지(getWorldStatuses().unlockedStageIds)와 이 표를 비교해 새로 열린 것을 찾음 (src/lib/world/unlockSeen.ts).
--     행이 하나도 없는 사용자(배포 전부터 있던 사용자·새 사용자)는 처음 지도를 열 때 지금 열린 스테이지를 모두 연출 없이 기록
--     → 배포 직후 기존 사용자에게 연출이 줄줄이 나오지 않음
--
-- 하는 일
--   1. user_seen_unlocks: (user_id, stage_id) 1행 = 그 스테이지의 해제 연출을 봤음(또는 조용히 기록함). seen_at 서버 시각
--      - 읽기: 로그인 사용자가 **본인 행만** (RLS, 월드맵 서버 조회가 user_progress 처럼 사용자 클라이언트로 읽음)
--      - 쓰기: record_seen_unlocks(service_role) 로만. authenticated 에는 INSERT·UPDATE·DELETE 권한 없음
--        (보상·채점은 아니지만 "잠긴 스테이지는 기록하지 않음"을 서버가 is_stage_unlocked 로 확인해 정합성을 지킴.
--         is_stage_unlocked 는 service_role 전용(00006)이라 RLS 정책에서 부를 수 없어 RPC 로 씀)
--      - 탈퇴하면 users 와 함께, 스테이지가 콘텐츠에서 빠지면 그 행도 지워짐 (ON DELETE CASCADE, B28)
--   2. record_seen_unlocks(p_user_id, p_stage_ids) → integer (새로 기록한 행 수, SECURITY INVOKER, service_role 전용)
--      - 열린 스테이지만 기록 (is_stage_unlocked), 없는 스테이지 id 는 무시, 이미 있으면 처음 시각 유지 (ON CONFLICT DO NOTHING)
--      - 개수 상한은 API 가 확인 (/api/world/unlocks, 64개). 여기서는 256개 넘으면 invalid_arguments(PT400)
--   3. 자기 검증: anon 접근 없음, authenticated 는 SELECT 만, 함수는 service_role 만
--
-- 왜 ① 인가: 새 테이블·새 함수뿐이고 기존 객체·권한을 바꾸지 않음. 새 테이블의 GRANT SELECT 는 ③ 파일(00005·08·11·13·15·22)이
--   건드리지 않는 새 객체라 ① 에 둠 (운영은 v0.4 ③ 이 이미 적용돼 있어 뒤에 지워질 일도 없음)
-- 앱: src/lib/world/loadWorldMapData.ts (읽기), src/app/api/world/unlocks/route.ts (쓰기),
--     src/app/api/account/reset/route.ts (진행 리셋하면 기록도 지워 다시 열 때 연출이 나옴)
-- 확인: supabase/tests UL-1~4, APP-16
-- 되돌리기: supabase/rollback/00025_seen_unlocks.rollback.sql (본 기록만 지워짐 → 다음 방문에 다시 조용히 기록)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00025] user_seen_unlocks: 본인 행 읽기만, record_seen_unlocks: service_role 전용` 확인
-- ============================================================

-- ------------------------------------------------------------
-- 1. 본 기록
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_seen_unlocks (
  user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stage_id)
);

-- stage_id 로 지울 때(콘텐츠에서 스테이지가 빠질 때) 전체를 훑지 않게 (FK 인덱스, advisors unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS user_seen_unlocks_stage_id_idx ON public.user_seen_unlocks (stage_id);

COMMENT ON TABLE public.user_seen_unlocks IS
  '스테이지 잠금 해제 연출을 본 기록 (P5-05, Q49). 행 = 그 스테이지의 연출을 봤거나 처음 지도를 열 때 조용히 기록함. 본인 읽기만, 쓰기는 record_seen_unlocks(service_role)';

ALTER TABLE public.user_seen_unlocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_seen_unlocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_seen_unlocks TO authenticated;
GRANT ALL ON TABLE public.user_seen_unlocks TO service_role;

DROP POLICY IF EXISTS "user_seen_unlocks_select_own" ON public.user_seen_unlocks;
CREATE POLICY "user_seen_unlocks_select_own" ON public.user_seen_unlocks
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- 2. record_seen_unlocks
--   반환: 이번에 새로 기록한 행 수
--   오류 (message): invalid_arguments(PT400) · 없는 사용자 23503
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_seen_unlocks(p_user_id UUID, p_stage_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_stage_ids IS NULL OR cardinality(p_stage_ids) > 256 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  INSERT INTO public.user_seen_unlocks (user_id, stage_id)
  SELECT p_user_id, s.id
    FROM public.stages s
   WHERE s.id = ANY (p_stage_ids)
     AND public.is_stage_unlocked(p_user_id, s.id)
  ON CONFLICT (user_id, stage_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.record_seen_unlocks(UUID, UUID[]) IS
  '해제 연출 본 기록 (P5-05): 열린 스테이지만, 이미 있으면 그대로. service_role 전용: /api/world/unlocks';

REVOKE ALL ON FUNCTION public.record_seen_unlocks(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_seen_unlocks(UUID, UUID[]) TO service_role;

-- ------------------------------------------------------------
-- 3. 자기 검증
-- ------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.record_seen_unlocks(uuid, uuid[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.record_seen_unlocks(uuid, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION '[00025] anon/authenticated 가 record_seen_unlocks 를 실행할 수 있음';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.record_seen_unlocks(uuid, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION '[00025] service_role 이 record_seen_unlocks 를 실행할 수 없음';
  END IF;
  IF has_table_privilege('anon', 'public.user_seen_unlocks', 'SELECT, INSERT, UPDATE, DELETE')
     OR has_table_privilege('authenticated', 'public.user_seen_unlocks', 'INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION '[00025] anon 이 user_seen_unlocks 에 접근하거나 authenticated 가 쓸 수 있음';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.user_seen_unlocks', 'SELECT') THEN
    RAISE EXCEPTION '[00025] authenticated 가 user_seen_unlocks 를 읽을 수 없음';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_seen_unlocks'::regclass) THEN
    RAISE EXCEPTION '[00025] user_seen_unlocks RLS 가 꺼져 있음';
  END IF;
  RAISE NOTICE '[00025] user_seen_unlocks: 본인 행 읽기만, record_seen_unlocks: service_role 전용';
END $$;
