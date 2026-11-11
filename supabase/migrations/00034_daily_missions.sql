-- ============================================================
-- 데일리 미션: 미션 풀 + 하루 3개 배정(오늘의 퀴즈 목록 고정) + 진행 판정 + "받기" RPC (Idempotent)
--   (P8-07, §3 F4, §2.2·§2.3·§2.6, §12-Q61·Q62 ③·Q63 ②, 금액은 00031 coin_reward('mission'), 레벨 업 코인 00031)
-- 릴리즈 단계: ① 추가형 (새 테이블 2개 + 새 함수만. 기존 테이블·함수 변경 없음 — 이전 앱은 부르지 않음)
--
-- 하는 일
--   1. daily_missions: 미션 풀 (이 파일이 정의를 upsert — 고칠 때는 새 마이그레이션에서 같은 upsert). service_role 전용
--        kind = 진행을 세는 법, grp = 같은 날 한 그룹에서 하나만, target = 목표 수, difficulty 1~3 → 코인 10·15·20
--        §2.6: 학습 행동만 (출석·방문 미션 없음 — 출석은 P8-08)
--   2. user_daily_missions: (사용자, KST 날짜)마다 1행 — 그날 배정한 미션 id 들 + 그날 오늘의 퀴즈 목록(quiz_ids, §12-Q61 고정).
--        본인 행 읽기만(월드맵 로더가 quiz_ids 를 병렬로 읽음), 쓰기 권한 없음(RPC 만). 받았는지는 따로 두지 않고 원장 coin_ledger mission/<날짜>:<미션 id> 행 (P8-06 상자와 같은 방식)
--   3. 진행 판정 daily_mission_progress(user, day, kind, quiz_ids) — 클라이언트 신호 없이 기존 기록에서 그 KST 날짜로 셈 (소유자만):
--        quest_clear  그날 완료한 코드·프로젝트 퀘스트 수 (황금키 완료는 빼고, 황금키 퀘스트를 그날 처음 직접 풀었으면 셈)
--        no_hint      그날 힌트 0번·황금키 없이 완료한 코드·프로젝트 퀘스트 수
--        review       그날 끝낸 복습 도전 수 (P8-05): 코드 = 별 판정일이 그날이고 처음 완료는 그 전날 이전,
--                     퀴즈 = 그날 mode 'review' 시도가 정답 또는 3번째 오답(별 판정)인 퀴즈
--        daily_quiz   그날 저장한 오늘의 퀴즈 중 끝난 문제 수 (P7-10 dailyQuizResults 와 같은 규칙: 정답 또는 3번째 오답). 목표 = 목록 길이
--        quiz_correct 그날 한 번이라도 맞힌 퀴즈 수 (연습 포함 — 다시 풀어 맞히는 것도 학습)
--      진행은 기록에서 파생하므로 진행 초기화로 기록이 지워지면 그날 진행도 줄어듦(받은 보상은 그대로)
--   4. daily_missions_today(user, quiz_ids) (service_role, 월드맵 HUD 미션 칸 WorldHudBar 가 확인한 사용자 id 만, Suspense 안):
--        오늘(KST) 행이 없고 quiz_ids 가 NULL 이면 {assigned:false} (읽기만)
--        없고 quiz_ids 를 주면 배정: 할 수 있는 미션만(daily_mission_possible — 퀘스트 3개는 최근 7일 중 하루 3개 이상 깬 학생만, §12-Q65 (e)) 그룹마다 하나, 퀘스트 그룹은 할 수 있으면 늘 첫 칸,
--          나머지는 md5(사용자:날짜:미션 id) 순 — 결정적. quiz_ids(서버가 고른 오늘의 퀴즈)는 퀴즈 퀘스트만 최대 3개로 걸러 저장.
--          동시에 두 번 와도 ON CONFLICT DO NOTHING 이라 먼저 저장한 것 하나
--        반환 {assigned, day, quiz_ids, missions:[{id,title,kind,difficulty,target,progress,coins,xp,claimed}],
--              pending:[지난 6일 중 달성했는데 안 받은 미션 + day]}
--   5. claim_daily_mission(user, day, mission_id) (service_role, /api/missions/claim):
--        - 받을 수 있는 날 = 오늘과 지난 6일 (KST, 7일 보관). 그 밖 mission_expired(PT410), 배정에 없으면 mission_not_found(PT404)
--        - 이미 받았으면 {claimed:true, already_claimed:true, 코인·XP 0}
--        - 서버가 진행을 다시 셈 → 목표 미달 mission_not_done(PT409)
--        - 받기 = coin_apply('mission', '<YYYY-MM-DD>:<미션 id>', coin_reward('mission', 난이도)) + XP 15 (§12-Q63 ②, users.total_xp,
--          earned_xp 밖이라 스테이지 리셋에도 남음 B55) + grant_level_up_coins(지나간 레벨). 사용자 행 잠금 아래라 동시·중복도 한 번
--        반환 {claimed, already_claimed, mission_coins, xp_earned, coins_earned(레벨 업 코인 포함), coins_balance, total_xp,
--              level_before, level_after, level_ups}
--   6. 권한 + 자기 검증
-- 적용 후 NOTICE `[00034] 데일리 미션: 미션 풀 7종, daily_missions_today·claim_daily_mission service_role 전용` 확인
-- 확인: supabase/tests DM-1(권한), DM-2(배정 결정성·할 수 있는 것만), DM-3(진행 판정·KST 자정 경계), DM-4(받기: 미달 거부·멱등·동시·XP·레벨 업 코인·지난날·보관 기한)
-- 되돌리기: supabase/rollback/00034_daily_missions.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 미션 풀
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_missions (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  grp        TEXT NOT NULL,
  target     INTEGER NOT NULL,
  difficulty INTEGER NOT NULL,
  title      TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT daily_missions_id_check CHECK (id ~ '^[a-z0-9_]{1,40}$'),
  CONSTRAINT daily_missions_kind_check CHECK (kind IN ('quest_clear', 'no_hint', 'review', 'daily_quiz', 'quiz_correct')),
  CONSTRAINT daily_missions_target_check CHECK (target BETWEEN 1 AND 10),
  CONSTRAINT daily_missions_difficulty_check CHECK (difficulty BETWEEN 1 AND 3),
  CONSTRAINT daily_missions_title_check CHECK (char_length(title) BETWEEN 1 AND 40)
);

COMMENT ON TABLE public.daily_missions IS
  '데일리 미션 풀 (P8-07). 학습 행동만(§2.6). grp 마다 하루 하나, difficulty 1~3 = 코인 10·15·20 + XP 15. service_role 전용';

INSERT INTO public.daily_missions (id, kind, grp, target, difficulty, title) VALUES
  ('quest_1',        'quest_clear',  'quest',   1, 1, '퀘스트 1개 클리어'),
  ('quest_2',        'quest_clear',  'quest',   2, 2, '퀘스트 2개 클리어'),
  ('quest_3',        'quest_clear',  'quest',   3, 3, '퀘스트 3개 클리어'),
  ('no_hint_1',      'no_hint',      'no_hint', 1, 2, '힌트 없이 퀘스트 1개 클리어'),
  ('review_1',       'review',       'review',  1, 2, '복습 도전 1개 끝내기'),
  ('daily_quiz',     'daily_quiz',   'quiz',    1, 2, '오늘의 퀴즈 모두 풀기'),
  ('quiz_correct_2', 'quiz_correct', 'quiz',    2, 1, '퀴즈 2개 맞히기')
ON CONFLICT (id) DO UPDATE
  SET kind = EXCLUDED.kind, grp = EXCLUDED.grp, target = EXCLUDED.target,
      difficulty = EXCLUDED.difficulty, title = EXCLUDED.title, active = true;

ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.daily_missions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.daily_missions TO service_role;

-- ------------------------------------------------------------
-- 2. 그날 배정
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_daily_missions (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  mission_ids TEXT[] NOT NULL,
  quiz_ids    UUID[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day),
  CONSTRAINT user_daily_missions_count CHECK (cardinality(mission_ids) <= 3 AND cardinality(quiz_ids) <= 3)
);

COMMENT ON TABLE public.user_daily_missions IS
  '그날(KST) 배정한 데일리 미션과 오늘의 퀴즈 목록 (P8-07, §12-Q61 고정). 받기는 coin_ledger mission/<날짜>:<id>. 본인 행 읽기만, 쓰기는 RPC';

ALTER TABLE public.user_daily_missions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_daily_missions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.user_daily_missions TO authenticated, service_role;

-- 본인 행 읽기만 (월드맵 로더가 저장한 오늘의 퀴즈 목록을 다른 조회와 병렬로 읽음). 쓰기 경로는 daily_missions_today 뿐
DROP POLICY IF EXISTS "user_daily_missions_select_own" ON public.user_daily_missions;
CREATE POLICY "user_daily_missions_select_own" ON public.user_daily_missions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 3. 진행 판정 · 할 수 있는지 · 목록 (소유자만 — 보상 RPC 안에서만)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_mission_progress(p_user_id UUID, p_day DATE, p_kind TEXT, p_quiz_ids UUID[])
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE p_kind
    WHEN 'quest_clear' THEN (
      SELECT count(*) FROM public.user_progress up JOIN public.quests q ON q.id = up.quest_id
       WHERE up.user_id = p_user_id AND q.quest_type <> 'quiz' AND up.status = 'completed'
         AND ((NOT up.used_golden_key AND public.kst_date(up.completed_at) = p_day)
              OR (up.solved_directly_at IS NOT NULL AND public.kst_date(up.solved_directly_at) = p_day)))
    WHEN 'no_hint' THEN (
      SELECT count(*) FROM public.user_progress up JOIN public.quests q ON q.id = up.quest_id
       WHERE up.user_id = p_user_id AND q.quest_type <> 'quiz' AND up.status = 'completed'
         AND NOT up.used_golden_key AND up.hints_used = 0 AND public.kst_date(up.completed_at) = p_day)
    WHEN 'review' THEN (
      SELECT count(*) FROM public.user_progress up JOIN public.quests q ON q.id = up.quest_id
       WHERE up.user_id = p_user_id AND q.quest_type <> 'quiz' AND up.status = 'completed'
         AND up.stars_judged_on = p_day AND public.kst_date(up.completed_at) < p_day)
      + (SELECT count(DISTINCT qa.quest_id) FROM public.quiz_attempts qa
          WHERE qa.user_id = p_user_id AND qa.mode = 'review' AND public.kst_date(qa.created_at) = p_day
            AND (qa.is_correct OR qa.attempt_no >= 3))
    WHEN 'daily_quiz' THEN (
      SELECT count(DISTINCT qa.quest_id) FROM public.quiz_attempts qa
       WHERE qa.user_id = p_user_id AND qa.quest_id = ANY (COALESCE(p_quiz_ids, '{}'))
         AND public.kst_date(qa.created_at) = p_day AND (qa.is_correct OR qa.attempt_no >= 3))
    WHEN 'quiz_correct' THEN (
      SELECT count(DISTINCT qa.quest_id) FROM public.quiz_attempts qa
       WHERE qa.user_id = p_user_id AND qa.is_correct AND public.kst_date(qa.created_at) = p_day)
    ELSE 0
  END::integer;
$$;

COMMENT ON FUNCTION public.daily_mission_progress(UUID, DATE, TEXT, UUID[]) IS
  '데일리 미션 진행 (P8-07): 그 KST 날짜의 기존 기록(user_progress·quiz_attempts)에서 셈. 소유자만';

-- 목표: 오늘의 퀴즈는 그날 목록 길이, 나머지는 풀의 target
CREATE OR REPLACE FUNCTION public.daily_mission_target(p_kind TEXT, p_target INTEGER, p_quiz_ids UUID[])
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN p_kind = 'daily_quiz' THEN GREATEST(COALESCE(cardinality(p_quiz_ids), 0), 1) ELSE p_target END;
$$;

-- 배정할 때 학생이 실제로 할 수 있는지
CREATE OR REPLACE FUNCTION public.daily_mission_possible(p_user_id UUID, p_day DATE, p_kind TEXT, p_target INTEGER, p_quiz_ids UUID[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE p_kind
    -- 아직 안 깬 코드·프로젝트 퀘스트가 목표만큼 남았는지. 잠긴 스테이지 퀘스트도 셈 — 지금 스테이지를 깨면 같은 날 다음이 열림(P8-14 확인)
    -- + 목표 3개 이상은 최근 7일(어제까지) 중 하루에 그만큼 깬 적이 있는 학생에게만 (§12-Q65 (e): 하루 30분 학생은 quest_3 을 못 깸, docs/balance.md 3.9)
    WHEN 'quest_clear' THEN (
      SELECT count(*) FROM public.quests q
       WHERE q.quest_type <> 'quiz'
         AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                          WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed')) >= p_target
      AND (p_target <= 2
           OR (SELECT max(public.daily_mission_progress(p_user_id, p_day - g.i, 'quest_clear', NULL))
                 FROM generate_series(1, 7) AS g(i)) >= p_target)
    WHEN 'no_hint' THEN (
      SELECT count(*) FROM public.quests q
       WHERE q.quest_type <> 'quiz'
         AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                          WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed')) >= p_target
    -- 복습 도전이 열린 퀘스트(별 3개 미만, 판정일 < 그날 또는 판정 기록 없는 예전 완료)가 있는지
    WHEN 'review' THEN EXISTS (
      SELECT 1 FROM public.user_progress up
       WHERE up.user_id = p_user_id AND up.status = 'completed' AND up.best_stars < 3
         AND (up.stars_judged_on IS NULL OR up.stars_judged_on < p_day))
    -- 오늘의 퀴즈(열린 스테이지에서 서버가 고른 것)가 있으면 / 맞힐 퀴즈가 목표만큼 있으면
    WHEN 'daily_quiz' THEN COALESCE(cardinality(p_quiz_ids), 0) > 0
    WHEN 'quiz_correct' THEN COALESCE(cardinality(p_quiz_ids), 0) >= p_target
    ELSE false
  END;
$$;

-- 그날 배정 → [{id,title,kind,difficulty,target,progress,coins,xp,claimed}] (배정 순서)
CREATE OR REPLACE FUNCTION public.daily_mission_list(p_user_id UUID, p_day DATE, p_mission_ids TEXT[], p_quiz_ids UUID[])
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',         m.id,
           'title',      m.title,
           'kind',       m.kind,
           'difficulty', m.difficulty,
           'target',     public.daily_mission_target(m.kind, m.target, p_quiz_ids),
           'progress',   LEAST(public.daily_mission_progress(p_user_id, p_day, m.kind, p_quiz_ids),
                               public.daily_mission_target(m.kind, m.target, p_quiz_ids)),
           'coins',      public.coin_reward('mission', m.difficulty),
           'xp',         15,
           'claimed',    EXISTS (SELECT 1 FROM public.coin_ledger l
                                  WHERE l.user_id = p_user_id AND l.source = 'mission'
                                    AND l.ref = to_char(p_day, 'YYYY-MM-DD') || ':' || m.id))
         ORDER BY t.i), '[]'::jsonb)
    FROM unnest(p_mission_ids) WITH ORDINALITY AS t(id, i)
    JOIN public.daily_missions m ON m.id = t.id;
$$;

-- ------------------------------------------------------------
-- 4. daily_missions_today
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_missions_today(p_user_id UUID, p_quiz_ids UUID[] DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today   DATE := public.kst_today();
  v_row     public.user_daily_missions%ROWTYPE;
  v_quiz    UUID[];
  v_ids     TEXT[];
  v_pending JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT * INTO v_row FROM public.user_daily_missions d WHERE d.user_id = p_user_id AND d.day = v_today;
  IF NOT FOUND THEN
    IF p_quiz_ids IS NULL THEN
      RETURN jsonb_build_object('assigned', false, 'day', to_char(v_today, 'YYYY-MM-DD'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id) THEN
      RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
    END IF;

    -- 오늘의 퀴즈 목록: 퀴즈 퀘스트만, 처음 나온 순서, 최대 3개
    SELECT COALESCE(array_agg(x.id ORDER BY x.i), '{}') INTO v_quiz
      FROM (SELECT DISTINCT ON (t.id) t.id, t.i
              FROM unnest(p_quiz_ids) WITH ORDINALITY AS t(id, i)
              JOIN public.quests q ON q.id = t.id AND q.quest_type = 'quiz'
             ORDER BY t.id, t.i) x;
    v_quiz := v_quiz[1:3];

    -- 그룹마다 하나(사용자·날짜 시드 md5 순), 퀘스트 그룹은 할 수 있으면 첫 칸, 최대 3개
    SELECT COALESCE(array_agg(g.id ORDER BY g.grp <> 'quest', g.h), '{}') INTO v_ids
      FROM (SELECT * FROM (
              SELECT DISTINCT ON (m.grp) m.id, m.grp, md5(p_user_id::text || ':' || v_today::text || ':' || m.id) AS h
                FROM public.daily_missions m
               WHERE m.active AND public.daily_mission_possible(p_user_id, v_today, m.kind, m.target, v_quiz)
               ORDER BY m.grp, h) c
             ORDER BY c.grp <> 'quest', c.h
             LIMIT 3) g;

    INSERT INTO public.user_daily_missions (user_id, day, mission_ids, quiz_ids)
    VALUES (p_user_id, v_today, v_ids, v_quiz)
    ON CONFLICT (user_id, day) DO NOTHING;
    SELECT * INTO v_row FROM public.user_daily_missions d WHERE d.user_id = p_user_id AND d.day = v_today;
  END IF;

  -- 지난 6일 중 달성했는데 안 받은 미션 (§12-Q62 ③ 안 받은 보상은 사라지지 않음 — 7일 보관)
  SELECT COALESCE(jsonb_agg(e || jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD')) ORDER BY d.day DESC), '[]'::jsonb)
    INTO v_pending
    FROM public.user_daily_missions d
    CROSS JOIN LATERAL jsonb_array_elements(public.daily_mission_list(p_user_id, d.day, d.mission_ids, d.quiz_ids)) e
   WHERE d.user_id = p_user_id AND d.day BETWEEN v_today - 6 AND v_today - 1
     AND NOT (e->>'claimed')::boolean AND (e->>'progress')::integer >= (e->>'target')::integer;

  RETURN jsonb_build_object(
    'assigned', true,
    'day',      to_char(v_today, 'YYYY-MM-DD'),
    'quiz_ids', to_jsonb(v_row.quiz_ids),
    'missions', public.daily_mission_list(p_user_id, v_today, v_row.mission_ids, v_row.quiz_ids),
    'pending',  v_pending);
END;
$$;

COMMENT ON FUNCTION public.daily_missions_today(UUID, UUID[]) IS
  '오늘(KST) 데일리 미션 (P8-07). service_role 전용: 월드맵 로더. quiz_ids NULL 이면 읽기만, 주면 없을 때 결정적으로 배정·오늘의 퀴즈 목록 저장';

-- ------------------------------------------------------------
-- 5. claim_daily_mission
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_mission(p_user_id UUID, p_day DATE, p_mission_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_xp        CONSTANT INTEGER := 15;  -- §12-Q63 ②
  v_today     DATE := public.kst_today();
  v_user      RECORD;
  v_row       public.user_daily_missions%ROWTYPE;
  v_mission   public.daily_missions%ROWTYPE;
  v_ref       TEXT;
  v_res       JSONB;
  v_total_xp  INTEGER;
  v_level     INTEGER;
  v_level_ups JSONB;
BEGIN
  IF p_user_id IS NULL OR p_day IS NULL OR p_mission_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF p_day > v_today OR p_day < v_today - 6 THEN
    RAISE EXCEPTION 'mission_expired' USING ERRCODE = 'PT410';
  END IF;

  -- 같은 사용자의 받기를 줄 세움 (coin_apply 와 같은 잠금 순서: users 먼저)
  SELECT u.total_xp, u.current_level, u.coins INTO v_user FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT * INTO v_row FROM public.user_daily_missions d WHERE d.user_id = p_user_id AND d.day = p_day;
  IF NOT FOUND OR NOT (p_mission_id = ANY (v_row.mission_ids)) THEN
    RAISE EXCEPTION 'mission_not_found' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO v_mission FROM public.daily_missions m WHERE m.id = p_mission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mission_not_found' USING ERRCODE = 'PT404';
  END IF;

  v_ref := to_char(p_day, 'YYYY-MM-DD') || ':' || p_mission_id;
  IF EXISTS (SELECT 1 FROM public.coin_ledger l
              WHERE l.user_id = p_user_id AND l.source = 'mission' AND l.ref = v_ref) THEN
    RETURN jsonb_build_object(
      'claimed', true, 'already_claimed', true, 'mission_coins', 0, 'xp_earned', 0, 'coins_earned', 0,
      'coins_balance', v_user.coins, 'total_xp', v_user.total_xp,
      'level_before', v_user.current_level, 'level_after', v_user.current_level, 'level_ups', '[]'::jsonb);
  END IF;

  IF public.daily_mission_progress(p_user_id, p_day, v_mission.kind, v_row.quiz_ids)
     < public.daily_mission_target(v_mission.kind, v_mission.target, v_row.quiz_ids) THEN
    RAISE EXCEPTION 'mission_not_done' USING ERRCODE = 'PT409';
  END IF;

  v_res := public.coin_apply(p_user_id, 'mission', v_ref, public.coin_reward('mission', v_mission.difficulty));

  -- XP 15: earned_xp 밖(스테이지 리셋이 지우지 않음, B55). current_level 은 트리거도 맞추지만 레벨 업 코인 계산에 씀
  v_total_xp := v_user.total_xp + c_xp;
  v_level := public.level_for_xp(v_total_xp);
  UPDATE public.users SET total_xp = v_total_xp, current_level = v_level WHERE id = p_user_id;
  v_level_ups := public.grant_level_up_coins(p_user_id, v_user.current_level, v_level);

  RETURN jsonb_build_object(
    'claimed',         true,
    'already_claimed', false,
    'mission_coins',   (v_res->>'delta')::integer,
    'xp_earned',       c_xp,
    'coins_earned',    (v_res->>'delta')::integer
                       + COALESCE((SELECT sum((l->>'coins')::integer) FROM jsonb_array_elements(v_level_ups) l), 0)::integer,
    'coins_balance',   (SELECT u.coins FROM public.users u WHERE u.id = p_user_id),
    'total_xp',        v_total_xp,
    'level_before',    v_user.current_level,
    'level_after',     v_level,
    'level_ups',       v_level_ups);
END;
$$;

COMMENT ON FUNCTION public.claim_daily_mission(UUID, DATE, TEXT) IS
  '데일리 미션 보상 받기 (P8-07). service_role 전용: /api/missions/claim. 서버가 진행을 다시 세어 달성이면 원장 mission/<날짜>:<id> 로 코인 + XP 15 한 번, 7일 보관';

-- ------------------------------------------------------------
-- 6. 권한
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.daily_mission_progress(UUID, DATE, TEXT, UUID[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.daily_mission_target(TEXT, INTEGER, UUID[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.daily_mission_possible(UUID, DATE, TEXT, INTEGER, UUID[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.daily_mission_list(UUID, DATE, TEXT[], UUID[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.daily_missions_today(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_missions_today(UUID, UUID[]) TO service_role;
REVOKE ALL ON FUNCTION public.claim_daily_mission(UUID, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_mission(UUID, DATE, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 7. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT[] := '{}';
BEGIN
  IF (SELECT count(*) FROM public.daily_missions WHERE active) <> 7
     OR EXISTS (SELECT 1 FROM public.daily_missions WHERE kind = 'review' AND active) IS NOT TRUE THEN
    v_bad := v_bad || '미션 풀 (7종, 복습 도전 포함)'::TEXT;
  END IF;
  IF public.coin_reward('mission', 1) <> 10 OR public.coin_reward('mission', 3) <> 20 THEN
    v_bad := v_bad || '미션 금액 (00031 이 먼저 있어야 함)'::TEXT;
  END IF;
  IF has_function_privilege('anon', 'public.daily_missions_today(uuid, uuid[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.daily_missions_today(uuid, uuid[])', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.daily_missions_today(uuid, uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_daily_mission(uuid, date, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_daily_mission(uuid, date, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.claim_daily_mission(uuid, date, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.daily_mission_progress(uuid, date, text, uuid[])', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.daily_mission_progress(uuid, date, text, uuid[])', 'EXECUTE') THEN
    v_bad := v_bad || '실행 권한'::TEXT;
  END IF;
  IF has_table_privilege('authenticated', 'public.user_daily_missions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_daily_missions', 'UPDATE')
     OR has_table_privilege('anon', 'public.user_daily_missions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.daily_missions', 'SELECT')
     OR has_table_privilege('anon', 'public.daily_missions', 'SELECT') THEN
    v_bad := v_bad || '테이블 권한'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00034] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00034] 데일리 미션: 미션 풀 7종, daily_missions_today·claim_daily_mission service_role 전용';
END $$;
