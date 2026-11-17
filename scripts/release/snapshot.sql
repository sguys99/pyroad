-- ============================================================
-- 운영 데이터 스냅샷 (읽기 전용)   (P12-07·P12-08, docs/release/v1.0-runbook.md 1-3 "적용 전 스냅샷"·2-2 "적용 후 스냅샷 비교")
--
-- 마이그레이션 묶음 적용 **직전**과 **직후**에 SQL Editor 에서 이 파일 전체를 붙여 실행하고, 결과를 각각 CSV 로 내려받아 비교합니다.
-- 한 문장(SELECT)이라 SQL Editor 가 결과 표 하나를 보여 줍니다. 아무것도 쓰지 않습니다(함수·임시 테이블도 만들지 않음).
--
-- 결과 열: kind | name | n | digest
--   table  <스키마.표>  행 수  행마다 md5 를 정렬해 이은 md5 (큰 표도 메모리 걱정 없음) (public 의 모든 표 + auth.users·auth.identities)
--   total  <지표>       합계   -                  (XP·레벨·코인·별·완료 퀘스트·뱃지·업적·구매·작품·글 …)
--   users  per_user     사용자 수  사용자마다 "진행·XP·레벨·코인·별·뱃지·업적·구매·작품·글·카드·원장 합" 한 줄씩을 이은 md5
--   check  coin_balance_mismatches  잔액 ≠ 원장 합인 사용자 수 (0 이어야 함)
--
-- 판정: v1.0 묶음(00059~00061)은 데이터를 바꾸지 않으므로 **모든 줄이 같아야** 합니다(리허설에서 확인).
--   다른 줄이 있으면 → 그사이 학생이 쓴 것인지 본다: total·table 의 n 이 **줄지 않았으면** 손실 아님
--   (사이트가 열려 있는 동안 analytics_events·api_rate_limits·api_global_rate_limits·auth.users(로그인 시각) 는 저절로 바뀜).
--   n 이 줄어든 줄이 하나라도 있으면 런북 "3. 되돌리기"의 판단 기준으로.
-- ============================================================
WITH tbl AS (
  SELECT n.nspname AS s, c.relname AS t
    FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r', 'p')
     AND (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname IN ('users', 'identities')))
),
tables AS (
  SELECT 'table' AS kind, s || '.' || t AS name,
         (xpath('/row/n/text()', x))[1]::text::bigint AS n,
         (xpath('/row/d/text()', x))[1]::text AS digest
    FROM tbl,
         LATERAL query_to_xml(format(
           'SELECT count(*) AS n, md5(coalesce(string_agg(md5(r::text), %L ORDER BY md5(r::text)), %L)) AS d FROM %I.%I AS r',
           '', '', s, t), false, true, '') AS x
),
per_user AS (
  SELECT u.id, u.total_xp, u.current_level, u.coins, u.golden_keys,
         (SELECT count(*) FROM public.user_progress AS p WHERE p.user_id = u.id) AS progress,
         (SELECT count(*) FROM public.user_progress AS p WHERE p.user_id = u.id AND p.status = 'completed') AS completed,
         (SELECT coalesce(sum(p.best_stars), 0) FROM public.user_progress AS p WHERE p.user_id = u.id) AS stars,
         (SELECT coalesce(sum(p.earned_xp), 0) FROM public.user_progress AS p WHERE p.user_id = u.id) AS earned_xp,
         (SELECT count(*) FROM public.user_badges AS b WHERE b.user_id = u.id) AS badges,
         (SELECT count(*) FROM public.user_achievements AS a WHERE a.user_id = u.id) AS achievements,
         (SELECT count(*) FROM public.user_achievements AS a WHERE a.user_id = u.id AND a.claimed_at IS NOT NULL) AS claimed,
         (SELECT count(*) FROM public.user_items AS i WHERE i.user_id = u.id) AS items,
         (SELECT count(*) FROM public.creations AS c WHERE c.user_id = u.id) AS creations,
         (SELECT count(*) FROM public.board_posts AS b WHERE b.user_id = u.id) AS posts,
         (SELECT count(*) FROM public.board_comments AS b WHERE b.user_id = u.id) AS comments,
         (SELECT count(*) FROM public.share_cards AS s WHERE s.user_id = u.id) AS share_cards,
         (SELECT coalesce(sum(l.delta), 0) FROM public.coin_ledger AS l WHERE l.user_id = u.id) AS ledger,
         u.avatar_config, u.onboarded_at, u.age_band, u.guardian_consented_at
    FROM public.users AS u
),
totals(name, n) AS (
  VALUES ('users',                (SELECT count(*) FROM per_user)),
         ('users_total_xp',       (SELECT sum(total_xp) FROM per_user)),
         ('users_level_sum',      (SELECT sum(current_level) FROM per_user)),
         ('users_coins',          (SELECT sum(coins) FROM per_user)),
         ('users_golden_keys',    (SELECT sum(golden_keys) FROM per_user)),
         ('users_onboarded',      (SELECT count(*) FROM per_user WHERE onboarded_at IS NOT NULL)),
         ('progress_rows',        (SELECT sum(progress) FROM per_user)),
         ('progress_completed',   (SELECT sum(completed) FROM per_user)),
         ('progress_best_stars',  (SELECT sum(stars) FROM per_user)),
         ('progress_earned_xp',   (SELECT sum(earned_xp) FROM per_user)),
         ('badges',               (SELECT sum(badges) FROM per_user)),
         ('achievements',         (SELECT sum(achievements) FROM per_user)),
         ('achievements_claimed', (SELECT sum(claimed) FROM per_user)),
         ('items',                (SELECT sum(items) FROM per_user)),
         ('creations',            (SELECT sum(creations) FROM per_user)),
         ('board_posts',          (SELECT sum(posts) FROM per_user)),
         ('board_comments',       (SELECT sum(comments) FROM per_user)),
         ('share_cards',          (SELECT sum(share_cards) FROM per_user)),
         ('coin_ledger_sum',      (SELECT sum(ledger) FROM per_user))
)
SELECT kind, name, n, digest FROM (
  SELECT 1 AS o, kind, name, n, digest FROM tables
  UNION ALL
  SELECT 2, 'total', name, coalesce(n, 0), '-' FROM totals
  UNION ALL
  SELECT 3, 'users', 'per_user', count(*),
         md5(coalesce(string_agg(concat_ws('|', id, total_xp, current_level, coins, golden_keys, progress, completed, stars,
                                           earned_xp, badges, achievements, claimed, items, creations, posts, comments,
                                           share_cards, ledger, avatar_config, onboarded_at, age_band, guardian_consented_at),
                                 chr(10) ORDER BY id), ''))
    FROM per_user
  UNION ALL
  SELECT 4, 'check', 'coin_balance_mismatches', (SELECT count(*) FROM public.coin_balance_mismatches()), '0 이어야 함'
) AS x
ORDER BY o, name;
