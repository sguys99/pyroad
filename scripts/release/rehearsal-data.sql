-- ============================================================
-- v1.0 마이그레이션 리허설용 합성 "기존 사용자" 데이터 (P12-07, scripts/release/rehearse-v1.0.sh 가 v0.9 운영 재현 DB 에 넣음)
-- ⛔ 로컬 리허설 스택 전용. 운영·개발 스택에 넣지 않습니다(auth.users 에 가짜 계정을 만듦).
--
-- 운영 데이터 복제본이 아닙니다. 운영에 있을 법한 사용자 유형을 시기별로 흉내 냅니다:
--   v0.3 시절 가입자(온보딩·나이 확인 전, 학습 기록 있음/없음) · 온보딩만 하고 나이 확인 전 · 최근 가입 후 떠난 계정(3~100일)
--   만 14세 미만 미동의·동의 · 14세 이상 · 구글(raw_user_meta_data 에 이름·사진)·카카오·네이버 · 관리자 1명
--   진행·XP·레벨·코인·별·뱃지·업적(받기)·상자·출석·상점 구매·착용·공유 카드·작품(갤러리·스티커·신고)·게시글·댓글·신고·보스 진행 중
--   퀴즈 기록·실력 확인 진행 중·보호자 리포트 링크·학생 API 키·분석 이벤트·소급 보상·레벨 곡선 조정 기록
--   긴 code_submitted (49,999·50,000·50,001자), 긴 step_submissions (512KB 바로 아래·초과)
-- 보상·진행은 앱과 같은 service_role RPC(complete_quest·submit_quiz_answer·record_hint·use_golden_key·open_stage_chest·
-- claim_achievement·purchase_item·equip_item·create_share_card·…)로 만듦 — e2e/support/admin.ts completeQuests 와 같은 방식.
-- 계정 id = md5('reh:' || 이름)::uuid (rehearsal-checks.sql 이 이름으로 찾음)
-- ============================================================
\set ON_ERROR_STOP 1
BEGIN;

CREATE TEMP TABLE reh_fail (what TEXT, err TEXT) ON COMMIT DROP;

CREATE FUNCTION pg_temp.uid(p_label TEXT) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$ SELECT md5('reh:' || p_label)::uuid $$;

-- 가입: auth.users + auth.identities (handle_new_user 트리거가 public.users 를 만듦) → 가입일을 과거로
CREATE FUNCTION pg_temp.mk_user(p_label TEXT, p_provider TEXT, p_days_ago INTEGER, p_role TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id    UUID := pg_temp.uid(p_label);
  v_sub   TEXT := (('x' || substr(md5(p_label), 1, 12))::bit(48)::bigint)::text;
  v_at    TIMESTAMPTZ := now() - make_interval(days => p_days_ago);
  v_email TEXT := CASE WHEN p_provider = 'google' THEN p_label || '@gmail.test' END;
  v_meta  JSONB;
  v_app   JSONB := jsonb_build_object('provider', p_provider, 'providers', jsonb_build_array(p_provider));
BEGIN
  v_meta := CASE p_provider
    WHEN 'google' THEN jsonb_build_object(
      'iss', 'https://accounts.google.com', 'sub', v_sub, 'provider_id', v_sub, 'email', v_email,
      'email_verified', true, 'phone_verified', false,
      'name', '김' || p_label, 'full_name', '김' || p_label, 'given_name', p_label, 'family_name', '김',
      'picture', 'https://lh3.googleusercontent.com/a/' || v_sub, 'avatar_url', 'https://lh3.googleusercontent.com/a/' || v_sub)
    WHEN 'kakao' THEN jsonb_build_object(
      'iss', 'https://kauth.kakao.com', 'sub', v_sub, 'provider_id', v_sub, 'email_verified', false, 'phone_verified', false)
    ELSE jsonb_build_object(
      'iss', 'https://nid.naver.com', 'sub', v_sub, 'provider_id', v_sub, 'email_verified', false, 'phone_verified', false)
  END;
  IF p_role IS NOT NULL THEN v_app := v_app || jsonb_build_object('role', p_role); END IF;
  -- 토큰 칸은 GoTrue 처럼 빈 문자열(NULL 이면 GoTrue 관리자 API 가 그 사용자를 읽지 못함 — 크론의 getUserById)
  INSERT INTO auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token, email_change_token_new,
                          email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  VALUES ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          CASE WHEN v_email IS NOT NULL THEN v_at END, v_app, v_meta, v_at, v_at, v_at, '', '', '', '', '', '', '', '');
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (v_sub, v_id, v_meta, p_provider, v_at, v_at, v_at);
  UPDATE public.users SET created_at = v_at, last_login_at = v_at WHERE id = v_id;
  RETURN v_id;
END $$;

CREATE FUNCTION pg_temp.onboard(p_id UUID, p_nick TEXT, p_band TEXT, p_guardian BOOLEAN DEFAULT false)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.complete_onboarding(
    p_id, p_nick, 'green', 4::smallint,
    '[{"item":"terms","version":"2026-11-16"},{"item":"privacy","version":"2026-11-16"}]'::jsonb, 'self', p_band,
    CASE WHEN p_guardian THEN '[{"item":"guardian_privacy","version":"2026-11-16"}]'::jsonb END,
    CASE WHEN p_guardian THEN 'mother' END);
END $$;

-- 선택 보상(상자·업적 받기·구매 …)은 조건이 안 맞으면 실패할 수 있음 → 기록만 하고 계속
CREATE FUNCTION pg_temp.try(p_what TEXT, p_sql TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO reh_fail VALUES (p_what, SQLERRM);
END $$;

-- 한 월드를 앞에서부터 p_n 개 퀘스트까지: 코드·프로젝트·보스 = complete_quest, 퀴즈 = submit_quiz_answer(정답)
-- p_hint_every 번째마다 힌트 1개, p_key_every 번째마다 황금키 → 별이 섞임. 스테이지를 다 깨면 상자 열기
CREATE FUNCTION pg_temp.play(p_id UUID, p_world TEXT, p_n INTEGER, p_hint_every INTEGER DEFAULT 0, p_key_every INTEGER DEFAULT 0)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  i INTEGER := 0;
BEGIN
  FOR r IN
    SELECT q.id, q.quest_type, q.stage_id, k.solution_code, k.quiz_answer,
           q.id = (SELECT q2.id FROM public.quests AS q2 WHERE q2.stage_id = q.stage_id ORDER BY q2."order" DESC LIMIT 1) AS last_in_stage
      FROM public.quests AS q JOIN public.stages AS s ON s.id = q.stage_id JOIN public.worlds AS w ON w.id = s.world_id
      LEFT JOIN public.quest_answer_keys AS k ON k.quest_id = q.id
     WHERE w.slug = p_world ORDER BY s."order", q."order"
  LOOP
    i := i + 1;
    EXIT WHEN i > p_n;
    IF r.quest_type = 'quiz' THEN
      PERFORM public.submit_quiz_answer(p_id, r.id, r.quiz_answer -> 'accepted' -> 0);
    ELSE
      IF r.quest_type = 'code' AND p_hint_every > 0 AND i % p_hint_every = 0 THEN
        PERFORM public.record_hint(p_id, r.id, 1);
      END IF;
      IF r.quest_type = 'code' AND p_key_every > 0 AND i % p_key_every = 0 THEN
        PERFORM pg_temp.try('golden_key', format('SELECT public.use_golden_key(%L, %L)', p_id, r.id));
      END IF;
      PERFORM public.complete_quest(p_id, r.id, jsonb_build_object('code', coalesce(r.solution_code, ''), 'passed', true,
                                                                  'had_error', i % 5 = 0));
    END IF;
    IF r.last_in_stage THEN
      PERFORM pg_temp.try('chest', format('SELECT public.open_stage_chest(%L, %L)', p_id, r.stage_id));
      PERFORM pg_temp.try('stage_card', format('SELECT public.create_share_card(%L, %L, %L)', p_id, 'stage', r.stage_id));
    END IF;
  END LOOP;
END $$;

-- 업적 받기 · 출석 · 공유 카드 · 상점(살 수 있는 싼 것부터 p_buys 개, 코스튬은 착용) · 본 잠금 해제
CREATE FUNCTION pg_temp.extras(p_id UUID, p_buys INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  n INTEGER := 0;
BEGIN
  PERFORM public.evaluate_achievements(p_id);
  FOR r IN SELECT achievement_id FROM public.user_achievements WHERE user_id = p_id AND claimed_at IS NULL LOOP
    PERFORM pg_temp.try('claim', format('SELECT public.claim_achievement(%L, %L)', p_id, r.achievement_id));
  END LOOP;
  PERFORM pg_temp.try('attendance', format('SELECT public.stamp_attendance(%L)', p_id));
  PERFORM pg_temp.try('levelup_card', format('SELECT public.create_share_card(%L, %L)', p_id, 'levelup'));
  FOR r IN SELECT id FROM public.share_cards WHERE user_id = p_id LIMIT 1 LOOP
    PERFORM pg_temp.try('share_reward', format('SELECT public.claim_share_reward(%L, %L)', p_id, r.id));
  END LOOP;
  FOR r IN SELECT i.id, i.slot FROM public.shop_items AS i
            WHERE i.is_active AND i.kind <> 'consumable' AND i.price <= (SELECT coins FROM public.users WHERE id = p_id)
            ORDER BY i.price, i.id LOOP
    EXIT WHEN n >= p_buys;
    CONTINUE WHEN r.id IN (SELECT item_id FROM public.user_items WHERE user_id = p_id);
    CONTINUE WHEN (SELECT price FROM public.shop_items WHERE id = r.id) > (SELECT coins FROM public.users WHERE id = p_id);
    PERFORM public.purchase_item(p_id, r.id);
    n := n + 1;
    IF r.slot IS NOT NULL THEN
      PERFORM pg_temp.try('equip', format('SELECT public.equip_item(%L, %L, %L)', p_id, r.slot, r.id));
    END IF;
  END LOOP;
  PERFORM public.record_seen_unlocks(p_id, ARRAY(SELECT s.id FROM public.stages AS s WHERE public.is_stage_unlocked(p_id, s.id)));
END $$;

-- 작품 (그림: gzip·PNG 머리 바이트만 맞춘 가짜 값)
CREATE FUNCTION pg_temp.creation(p_id UUID, p_title TEXT, p_public BOOLEAN) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v UUID;
BEGIN
  INSERT INTO public.creations (user_id, quest_id, kind, title, code, commands_gz, thumbnail, visibility, show_code, published_at)
  VALUES (p_id, (SELECT q.id FROM public.quests AS q JOIN public.stages AS s ON s.id = q.stage_id JOIN public.worlds AS w ON w.id = s.world_id
                  WHERE w.slug = 'maker-city' AND q.quest_type = 'project' ORDER BY s."order" LIMIT 1),
          'drawing', p_title, 'import turtle' || chr(10) || 'turtle.forward(100)',
          decode('1f8b0800000000000003' || repeat('ab', 40), 'hex'), decode('89504e470d0a1a0a' || repeat('cd', 80), 'hex'),
          CASE WHEN p_public THEN 'public' ELSE 'private' END, p_public, CASE WHEN p_public THEN now() END)
  RETURNING id INTO v;
  RETURN v;
END $$;

DO $$
DECLARE
  v_admin UUID;
  v UUID;
  v_c UUID;
  v_post UUID;
  i INTEGER;
  prov TEXT[] := ARRAY['google', 'kakao', 'naver'];
BEGIN
  -- 관리자 1명 (role=admin, 온보딩 완료, 공지 2개)
  v_admin := pg_temp.mk_user('admin', 'google', 420, 'admin');
  PERFORM pg_temp.onboard(v_admin, '파이로드운영자', '14plus');
  INSERT INTO public.notices (user_id, title, content) VALUES
    (v_admin, 'v0.9 업데이트', '메이커 시티가 열렸어요'), (v_admin, '점검 안내', '잠깐 쉬어요');

  -- v0.3 시절 가입자: 온보딩·나이 확인 전(관문 이전), 학습 기록 있음 → 파기 대상 아님
  FOR i IN 1..5 LOOP
    v := pg_temp.mk_user('legacy' || i, 'google', 200 + i * 40);
    PERFORM pg_temp.play(v, 'python-island', 4 + i * 4, 3, 0);
    UPDATE public.users SET onboarded_at = NULL, age_band = NULL, age_checked_at = NULL, nickname = NULL WHERE id = v;
  END LOOP;
  INSERT INTO public.level_curve_adjustments (user_id, level_before, xp_before, xp_after)
  SELECT id, 3, total_xp - 30, total_xp FROM public.users WHERE id IN (pg_temp.uid('legacy4'), pg_temp.uid('legacy5'));
  INSERT INTO public.retro_rewards (user_id, granted_at, stars, coins, seen_at)
  SELECT id, now() - interval '100 days', 12, 120, NULL FROM public.users WHERE id IN (pg_temp.uid('legacy4'), pg_temp.uid('legacy5'));
  PERFORM public.grant_coins(pg_temp.uid('legacy' || j), 'retro', 'retro', 120) FROM generate_series(4, 5) AS j;

  -- v0.3 시절 뱃지 (Phase 8 부터 새로 주지 않지만 기존 사용자에게는 남아 있음)
  INSERT INTO public.user_badges (user_id, badge_type, earned_at)
  SELECT pg_temp.uid('legacy' || j), b, now() - interval '150 days'
    FROM generate_series(1, 5) AS j, unnest(ARRAY['first_code', 'stage_clear', 'hint_master']) AS b WHERE j > 1 OR b = 'first_code';

  -- v0.3 시절 가입 후 아무것도 안 한 계정 → 31일 뒤 파기 대상
  FOR i IN 1..3 LOOP PERFORM pg_temp.mk_user('ghost' || i, 'google', 250 + i * 50); END LOOP;
  -- 최근 가입 후 온보딩 전에 떠난 계정 (3·10·40·100일 전, 세 provider) → 31일 뒤 파기 대상
  PERFORM pg_temp.mk_user('left3', 'kakao', 3);
  PERFORM pg_temp.mk_user('left10', 'naver', 10);
  PERFORM pg_temp.mk_user('left40', 'google', 40);
  PERFORM pg_temp.mk_user('left100', 'kakao', 100);
  -- 온보딩은 했지만 나이 확인 전 (P3-11~P3-15 사이 가입): 활동 없음 → 파기 대상 / 활동 있음 → 아님
  v := pg_temp.mk_user('noage-empty', 'google', 120);
  UPDATE public.users SET onboarded_at = now() - interval '119 days', nickname = '나이몰라1' WHERE id = v;
  v := pg_temp.mk_user('noage-study', 'google', 115);
  UPDATE public.users SET onboarded_at = now() - interval '114 days', nickname = '나이몰라2' WHERE id = v;
  PERFORM pg_temp.play(v, 'python-island', 6);
  -- 온보딩 미완료지만 게시글만 있는 계정 (활동 = 게시글) → 아님
  v := pg_temp.mk_user('legacy-poster', 'google', 300);
  INSERT INTO public.board_posts (user_id, title, content) VALUES (v, '안녕하세요', '처음 왔어요');

  -- 만 14세 미만 미동의 (제한 모드): 기한 지남 1·남음 2
  FOR i IN 1..3 LOOP
    v := pg_temp.mk_user('kid-wait' || i, prov[1 + i % 3], 5 + i * 15);
    PERFORM pg_temp.onboard(v, '기다림' || i, 'under14');
    UPDATE public.users SET consent_deadline = now() + make_interval(days => 25 - i * 12) WHERE id = v;
    PERFORM pg_temp.play(v, 'python-island', i * 3);
  END LOOP;
  -- 만 14세 미만 동의 완료
  FOR i IN 1..4 LOOP
    v := pg_temp.mk_user('kid-ok' || i, prov[1 + i % 3], 30 + i * 20);
    PERFORM pg_temp.onboard(v, '꼬마' || i, 'under14', true);
    PERFORM pg_temp.play(v, 'python-island', 15 + i * 12, 4, 7);
    PERFORM pg_temp.extras(v, i);
  END LOOP;

  -- 14세 이상 열심히 하는 학생 12명: 1월드 전부 → 2월드 → 3월드 일부
  FOR i IN 1..12 LOOP
    v := pg_temp.mk_user('pro' || i, prov[1 + i % 3], 20 + i * 12);
    PERFORM pg_temp.onboard(v, '탐험가' || i, '14plus');
    PERFORM pg_temp.play(v, 'python-island', 999, 3 + i % 3, 6 + i % 4);
    IF i > 3 THEN PERFORM pg_temp.play(v, 'code-sea', CASE WHEN i > 7 THEN 999 ELSE i * 6 END, 4, 9); END IF;
    IF i > 7 THEN PERFORM pg_temp.play(v, 'maker-city', i * 4, 5, 0); END IF;
    PERFORM pg_temp.extras(v, 1 + i % 4);
    IF i <= 6 THEN
      INSERT INTO public.user_badges (user_id, badge_type, earned_at) VALUES (v, 'first_code', now() - interval '60 days'), (v, 'streak_3', now() - interval '50 days');
    END IF;
    IF i % 3 = 0 THEN PERFORM public.guardian_report_link(v, 'create'); END IF;
  END LOOP;
  -- 14세 이상 가볍게 해 본 학생 8명
  FOR i IN 1..8 LOOP
    v := pg_temp.mk_user('lite' || i, prov[1 + i % 3], 7 + i * 9);
    PERFORM pg_temp.onboard(v, '새싹' || i, '14plus');
    PERFORM pg_temp.play(v, 'python-island', i * 2, 2, 0);
    PERFORM pg_temp.extras(v, 0);
  END LOOP;

  -- 작품·갤러리: pro8~12 가 작품, 일부 전시 → 다른 학생 스티커, 신고 1
  FOR i IN 8..12 LOOP
    v := pg_temp.uid('pro' || i);
    v_c := pg_temp.creation(v, '별 그림 ' || i, i % 2 = 0);
    PERFORM pg_temp.creation(v, '내 작품 ' || i, false);
    IF i % 2 = 0 THEN
      INSERT INTO public.creation_reactions (creation_id, user_id, sticker)
      SELECT v_c, pg_temp.uid('pro' || j), 'wow' FROM generate_series(1, 4) AS j;
      PERFORM pg_temp.try('creation_card', format('SELECT public.create_creation_share_card(%L, %L)', v, v_c));
    END IF;
  END LOOP;
  PERFORM public.report_creation(pg_temp.uid('lite1'), (SELECT id FROM public.creations WHERE visibility = 'public' ORDER BY id LIMIT 1), 'other');

  -- 게시판: 글 6 · 댓글 10 · 신고 1
  FOR i IN 1..6 LOOP
    INSERT INTO public.board_posts (user_id, title, content) VALUES (pg_temp.uid('pro' || i), '질문 ' || i, '반복문이 어려워요 ' || i)
    RETURNING id INTO v_post;
    INSERT INTO public.board_comments (post_id, user_id, content)
    SELECT v_post, pg_temp.uid('lite' || j), '저도요 ' || j FROM generate_series(1, 1 + i % 3) AS j;
  END LOOP;
  INSERT INTO public.board_reports (reporter_id, target_type, target_id, target_user_id, reason)
  SELECT pg_temp.uid('lite2'), 'post', id, user_id, 'other' FROM public.board_posts ORDER BY created_at, id LIMIT 1;

  -- 보스 전투 중(하트 2, 라운드 2) · 실력 확인 진행 중
  INSERT INTO public.boss_runs (user_id, quest_id, round, hearts)
  SELECT pg_temp.uid('pro4'), q.id, 2, 2 FROM public.quests AS q JOIN public.stages AS s ON s.id = q.stage_id
    JOIN public.worlds AS w ON w.id = s.world_id
   WHERE w.slug = 'code-sea' AND q.quest_type = 'boss'
     AND NOT EXISTS (SELECT 1 FROM public.user_progress AS p WHERE p.user_id = pg_temp.uid('pro4') AND p.quest_id = q.id)
   ORDER BY s."order" LIMIT 1;
  PERFORM pg_temp.try('skill_check', format('SELECT public.skill_check_start(%L, %L)', pg_temp.uid('lite8'),
                                            (SELECT id FROM public.worlds WHERE slug = 'code-sea')));

  -- 학생 본인 API 키 (Google 2 · OpenAI 1, 암호문은 가짜)
  INSERT INTO public.user_api_keys (user_id, provider, key_version, iv, auth_tag, ciphertext)
  VALUES (pg_temp.uid('pro2'), 'gemini', 1, 'aXY=', 'dGFn', 'Y2lwaGVy'), (pg_temp.uid('pro5'), 'gemini', 1, 'aXY=', 'dGFn', 'Y2lwaGVy'),
         (pg_temp.uid('pro6'), 'openai', 1, 'aXY=', 'dGFn', 'Y2lwaGVy');
  UPDATE public.users SET preferred_provider = 'gemini' WHERE id IN (pg_temp.uid('pro2'), pg_temp.uid('pro5'));
  UPDATE public.users SET preferred_provider = 'openai' WHERE id = pg_temp.uid('pro6');

  -- 분석 이벤트·요청 횟수
  INSERT INTO public.analytics_events (name, actor, anon_id, source, props, device, path)
  SELECT 'quest_complete', 'user', substr(md5(g::text), 1, 22), 'server', '{}'::jsonb, 'mobile', '/quest/[id]'
    FROM generate_series(1, 60) AS g;
  INSERT INTO public.api_rate_limits (user_id, bucket, minute_start, minute_count, day, day_count)
  VALUES (pg_temp.uid('pro1'), 'tutor', date_trunc('minute', now()), 3, current_date, 12);

  -- 긴 코드 (00060 경계): 자동 저장 경로(code_submitted·step_submissions)로 쓴 진행 행
  v := pg_temp.mk_user('longcode', 'google', 60);
  PERFORM pg_temp.onboard(v, '긴코드', '14plus');
  PERFORM pg_temp.play(v, 'python-island', 3);
  INSERT INTO public.user_progress (user_id, quest_id, status, code_submitted)
  SELECT v, q.id, 'in_progress', repeat('a', n)
    FROM (SELECT q.id, row_number() OVER (ORDER BY s."order", q."order") AS rn
            FROM public.quests AS q JOIN public.stages AS s ON s.id = q.stage_id JOIN public.worlds AS w ON w.id = s.world_id
           WHERE w.slug = 'python-island' AND q.quest_type = 'code'
             AND NOT EXISTS (SELECT 1 FROM public.user_progress AS p WHERE p.user_id = v AND p.quest_id = q.id)) AS q
    JOIN (VALUES (1, 49999), (2, 50000), (3, 50001)) AS len(rn, n) ON len.rn = q.rn;
  INSERT INTO public.user_progress (user_id, quest_id, status, current_step, step_submissions)
  SELECT v, q.id, 'in_progress', 1, jsonb_build_object('0', repeat('b', n))
    FROM (SELECT q.id, row_number() OVER (ORDER BY w."order", s."order") AS rn
            FROM public.quests AS q JOIN public.stages AS s ON s.id = q.stage_id JOIN public.worlds AS w ON w.id = s.world_id
           WHERE q.quest_type = 'project') AS q
    JOIN (VALUES (1, 524000), (2, 524300)) AS len(rn, n) ON len.rn = q.rn;
END $$;

-- 결과 요약
SELECT 'users' AS what, count(*) AS n FROM public.users
UNION ALL SELECT 'auth.identities ' || provider, count(*) FROM auth.identities GROUP BY provider
UNION ALL SELECT 'progress completed', count(*) FROM public.user_progress WHERE status = 'completed'
UNION ALL SELECT 'badges', count(*) FROM public.user_badges
UNION ALL SELECT 'achievements claimed', count(*) FROM public.user_achievements WHERE claimed_at IS NOT NULL
UNION ALL SELECT 'items', count(*) FROM public.user_items
UNION ALL SELECT 'share_cards', count(*) FROM public.share_cards
UNION ALL SELECT 'creations', count(*) FROM public.creations
UNION ALL SELECT 'quiz_attempts', count(*) FROM public.quiz_attempts
UNION ALL SELECT 'coin_ledger', count(*) FROM public.coin_ledger
UNION ALL SELECT 'skipped: ' || what || ' — ' || left(err, 60), count(*) FROM reh_fail GROUP BY what, err
ORDER BY 1;

COMMIT;
