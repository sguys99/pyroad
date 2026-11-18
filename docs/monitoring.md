# 운영 지표 (P12-09)

> - 화면: 관리자(`app_metadata.role = 'admin'`)로 로그인 → 월드맵 메뉴 **운영 지표** = `/admin?d=1|7|28`(오늘·7일·28일, 한국 시간 날짜, 오늘 포함). 학생·비로그인은 404. 읽기 전용
> - 집계: DB 함수 `public.monitoring_summary(p_days)`(00062, ① 추가형, **service_role 전용**, 합계만 돌려줌). 페이지가 `isAdminUser` 확인 뒤 service_role로 한 번 부름(`src/lib/monitoring/load.ts`). 화면 `src/app/admin/page.tsx`, 조각 `src/components/monitoring/`
> - 원천: 분석 이벤트 `analytics_events`([analytics.md](analytics.md), 익명 ID·180일) + `users`(계정 단계) + `api_rate_limits`(오늘 튜터 요청) + 코인 원장·파기 대상·신고·숨김 표. 새로 모으는 데이터는 **없음**
> - 이 화면은 P12-13(출시 후 1주 핫픽스)과 P12-14(4주 뒤 §1 회고)에서 씁니다. 특정 아이를 들여다보는 도구가 아니고, 화면에도 익명 ID·user id·닉네임은 나오지 않습니다

## 1. 지표 정의

"기간" = 고른 날 수(KST 자정 기준, 오늘 포함). 비율 분모가 **20 미만**이면 화면에 "표본 적음"으로 붙이고 목표·경고 판정을 하지 않습니다(출시 초기 1~2명으로 0%·100%가 뜨는 것을 오해하지 않게). 작은 수 자체는 가리지 않습니다 — 합계만 있고 사람·시각을 잇는 값이 없어 한 명을 알아볼 수 없고, 운영자는 원본 표 권한이 이미 있으므로 가리면 쓸모만 줄어듭니다.

| 묶음 | 지표 | 정의 (분자 / 분모) | 원천 | 주의 |
|---|---|---|---|---|
| 사용 | 활동한 학생 | 기간 안 이벤트가 있는 로그인 익명 ID 수 (+ 날짜별 14일 스파크라인) | `analytics_events` `actor='user'` | DNT·GPC 켠 브라우저는 빠짐. 월드맵만 보고 간 날도 브라우저 이벤트가 없으면 빠짐 |
| 사용 | 비로그인 방문 세션 | 기간 안 `actor='visitor'` 익명 ID 수 | 같음 | 탭 단위 난수라 같은 아이가 여러 번 셈 |
| 튜터 | 힌트 받음 · 단계 분포 | `hint_used` 횟수, `level` 1·2·3 | 같음 | 끊긴 요청은 안 셈 |
| 튜터 | 자유 질문 결과 | `tutor_free_question` 횟수와 `result`: AI 답 / 저장된 답변(= `fallback` + `answer_blocked`) / 질문을 거름 | 같음 | v1.0은 서버 AI가 꺼져 있어(§12-Q80) 학생 본인 키가 없으면 저장된 답변이 **정상**. 폴백률은 본인 키 학생에서만 의미 |
| 튜터 | 오늘 튜터 요청 (유형별 받음·한도 초과) | `api_rate_limits` 의 `tutor:<유형>` 버킷, `day = 오늘` 행의 `day_count`·`day_denied` 합 | 요청 한도 카운터 | **오늘만**(어제 값은 덮어써져 없음). 기간 선택과 무관 |
| 퍼널 | 방문 → 로그인 | 랜딩 방문 세션 → 로그인 버튼 누른 세션 → 로그인 완료 학생 → 그중 가입(`new_user`) | 이벤트 | 비로그인 세션과 학생을 **잇지 않는** 날짜 합계라 단계 사이 비율은 근사(analytics.md SQL 1) |
| 퍼널 | 가입한 계정의 온보딩 | 기간 안 `users.created_at` → 나이 확인(`age_band`) → 14세 미만 중 보호자 동의(`guardian_consented_at`, "동의 수 / 14세 미만 수") → 온보딩 완료(`onboarded_at`) | `users` | 파기·탈퇴한 계정은 빠짐(30일 미동의 파기 뒤 줄어듦). 관리자 계정도 섞임 |
| 퍼널 | 가입 뒤 첫 학습 | 기간 안 가입(`login_success new_user`) 익명 ID → 그 뒤 `quest_start` → `quest_complete` → `quest_complete.stage_cleared` | 이벤트 (사람 단위) | "스테이지 하나 클리어" = 어느 스테이지든 처음 클리어(새 학생은 거의 1스테이지) |
| §1 | 랜딩 → 가입 | 가입 / 랜딩 방문 세션 | 이벤트 | 목표 "기준선 대비 +30%"의 기준선 값은 analytics.md SQL 1로 따로 비교 |
| §1 | D1 · D7 재방문 | 가입한 날 d0 의 다음 날(d0+1) / 7일째(d0+7)에 그 학생 서버·브라우저 이벤트가 있나. **돌아올 날이 기간 안**인 가입자만 분모(오늘을 고르면 D1 = 어제 가입자) | 이벤트 | analytics.md SQL 4는 "첫 활동일" 코호트(기존 학생 포함), 여기는 **가입** 코호트. §1 "출석 데이터"와는 근사 |
| §1 | 세션당 완료 퀘스트 · 3개 이상 세션 비율 | 로그인 학생 이벤트를 30분 공백으로 나눈 세션마다 `quest_complete` 수의 평균 | 이벤트 (SQL 5) | 처음 완료만 기록 → 다시 풀기 안 셈. §1은 `user_progress` 기준이라 근사 |
| §1 | 휴대폰·태블릿 비율 | 기간 안 익명 ID 중 `device` 가 mobile·tablet 인 ID / 전체 ID | 이벤트 (SQL 3) | iPadOS Safari는 desktop |
| §1 | 휴대폰 퀴즈 완료율 | 휴대폰·태블릿에서 시작한 **퀴즈** 퀘스트(익명 ID × 퀘스트) 중 같은 ID가 완료한 비율 | 이벤트 + `quests.quest_type` | 완료는 기기 무관. 기간 밖에서 시작한 것은 안 셈 |
| §1 | 자랑하기 사용률 | `share_open`·`share_channel` 을 보낸 로그인 ID / 활동한 학생 | 이벤트 | 브라우저 이벤트 |
| §1 | Lighthouse · 보상 조작 경로 | 화면에 숫자 없음 | CI `perf:lighthouse`·`test:rls:ci`·Advisors | |
| 건강 | 코인 불일치 | `count(*) from coin_balance_mismatches()` | 00030 | 0이 정상 |
| 건강 | 파기 기한 지난 계정 | `list_expired_unconsented(500)` ∪ `list_expired_incomplete(500)` 수 | 00024·00061 | 크론이 매일 03:00 하루 50명까지 지우므로 0이거나 줄어야 정상. **관리자 계정은 크론이 건너뛰어 남을 수 있음** |
| 건강 | 연출 자동 하향 · 하향 뒤 되돌림 | 자동 하향(`motion_tier_change cause=measured`) 학생 / 브라우저 이벤트를 보낸 로그인 학생 · 그중 그 뒤 직접 "풍성하게"로 바꾼 학생 / 하향 학생 | 이벤트 ([P12-04 §8](perf/P12-04-low-end.md) ①·②의 기기 합계) | 정적 추정으로 처음부터 lite 인 기기는 이벤트가 없어 분자에 안 들어감 |
| 건강 | 숨김 대기 · 기간 안 신고 | `board_posts`·`board_comments` `is_hidden` + `creations.hidden_at` 수 / 기간 안 `board_reports` + `creation_reports` 수 | 게시판·갤러리 | 숨김은 관리자가 풀거나 지울 때까지 남음(처리 기록 칸은 없음) |

### 수집 안 함 (화면에 그렇게 표시)

| 지표 | 이유 | 대신 |
|---|---|---|
| 앱 오류율(실행기 오류·API 실패·로그인 실패) | 분석 이벤트에 오류 이벤트가 없음. 오류는 Sentry에만(DSN 없으면 꺼짐) | `SENTRY_ORG` 가 있으면 화면에 Sentry 이슈 링크. 볼 것은 아래 3절 |
| 힌트·설명·피드백 등 자유 질문 밖 튜터 요청의 AI/저장된 답변/오류 비율 | `tutor_free_question` 만 결과 갈래를 남김 | 오늘 요청 수(한도 카운터). v1.0은 서버 AI가 꺼져 본인 키 학생 외에는 모두 저장된 답변 |
| 기간별(어제 이전) 튜터 요청 수 | 한도 카운터는 하루 창 한 행이라 지난 날은 덮어써짐 | 힌트 수(`hint_used`)·자유 질문 수는 기간별로 있음 |
| 파기 크론 마지막 실행 결과 | 크론은 결과를 DB에 남기지 않고 로그만(`[consent] 미동의·미완료 계정 파기: …`) | "파기 기한 지난 계정" 수 + Vercel → Logs |
| 온보딩 단계별 이탈 시각 | 나이 확인·보호자 동의는 이벤트가 없음 | `users` 표 상태 합계 |

새 이벤트를 더하지 않은 이유: 위 항목을 이벤트로 재려면 튜터 결과·오류 종류를 새로 기록해야 하는데, 처리방침의 분석 항목 서술(로그인·퀘스트 시작·완료·힌트 사용 등 이용 기록)을 넓히는 일이라 이번에는 하지 않았습니다(필요하면 사용자 결정 후 `tutor_reply { type, result }` 정도의 결과 갈래만).

## 2. 출시 후 1주 동안 매일 볼 것 / 경고 기준 (P12-13)

화면 맨 위 "지금 살펴볼 것"이 아래 경고 줄을 자동으로 보입니다(`src/lib/monitoring/metrics.ts` `alertsOf`, 단위 테스트 있음). 매일 아침 **오늘** → **7일** 순서로 봅니다.

| 볼 것 | 정상 | 경고 (화면에 뜸) | 경고면 |
|---|---|---|---|
| 코인 불일치 | 0 | 1 이상 | 원장 확인(`select * from public.coin_balance_mismatches()`), 보상 RPC 핫픽스 |
| 파기 기한 지난 계정 | 0 (관리자 계정만큼은 남을 수 있음) | 1 이상 | Vercel 크론 로그·`CRON_SECRET`·`?dry=1` ([v1.0 런북](release/v1.0-runbook.md) 4절) |
| 숨김 대기 | 0 | 1 이상 | 갤러리 `/gallery/review`, 게시판은 런북 "게시판 신고 처리" SQL |
| 오늘 튜터 한도 초과 | 0 | 1 이상 | 한 학생의 반복인지(Sentry `[tutor-abuse]`) 한도가 너무 낮은지 |
| 연출 자동 하향 | 30% 이하 | 30% 초과 (분모 20 이상) | P12-04 §4: 놓친 프레임 임계값 25% → 33% 검토 |
| 하향 뒤 "풍성하게" 되돌림 | 10% 이하 | 10% 초과 (분모 20 이상) | 같음 |
| Sentry 새 이슈 | 없음 | 새 이슈·급증 | 아래 3절 |
| 가입 → 온보딩 완료 · 첫 퀘스트 시작 | 대부분 | (자동 경고 없음) 어제보다 크게 떨어지면 | 로그인 콜백·온보딩·보호자 동의 화면 스모크 |
| D1 (7일 범위) | 40% 이상 | (목표 미달 딱지) | P12-14 회고 자료 — 1주 차에는 기록만 |

## 3. 오류 (Sentry)

앱은 Sentry 데이터를 읽지 않습니다. `SENTRY_ORG`(소스맵 올리기에 이미 쓰는 env)가 있으면 화면에 `https://<org>.sentry.io/issues/?statsPeriod=24h` 링크를 보입니다. 볼 것:

- 새 이슈와 급증: 태그 `area`(tutor·quest·consent·analytics·monitoring …), `op`
- 실행기·튜터 오류가 특정 `device` 에만 몰리는지
- `analytics visitor limit exceeded` warning이 매일 뜨면 봇(비로그인 지표가 덜 쌓임)
- `[tutor-abuse]` warning(`free_answer_blocked`)은 모델이 규칙을 어긴 답 — 본인 키 학생만

## 4. 화면이 안 열릴 때 (SQL Editor, 읽기 전용)

00062가 있으면 화면과 **같은 숫자**:

```sql
select jsonb_pretty(public.monitoring_summary(7));   -- 1 · 7 · 28
```

00062가 없거나 함수가 실패하면 아래(같은 정의, 7일). 그 밖의 표는 [analytics.md](analytics.md) §7 SQL 1~8, 연출은 [P12-04-low-end.md](perf/P12-04-low-end.md) §8 ①~③.

```sql
-- 기간 시작 (KST 오늘 포함 7일). 28일이면 6 → 27, 오늘이면 0
with w as (select ((public.kst_today() - 6)::timestamp at time zone 'Asia/Seoul') as t)
select count(distinct anon_id) filter (where actor = 'user')                                   as active_users,
       count(distinct anon_id) filter (where actor = 'visitor')                                as visitor_sessions,
       count(distinct anon_id) filter (where name = 'landing_view')                            as landing_sessions,
       count(distinct anon_id) filter (where name = 'landing_cta_click')                       as cta_sessions,
       count(distinct anon_id) filter (where name = 'login_success')                           as login_users,
       count(distinct anon_id) filter (where name = 'login_success' and (props->>'new_user')::boolean) as signups,
       count(*) filter (where name = 'hint_used')                                              as hints,
       count(*) filter (where name = 'hint_used' and props->>'level' = '3')                    as hints_l3,
       count(*) filter (where name = 'tutor_free_question')                                    as free_total,
       count(*) filter (where name = 'tutor_free_question' and props->>'result' in ('fallback', 'answer_blocked')) as free_saved
  from public.analytics_events, w
 where occurred_at >= w.t;

-- 가입한 계정의 온보딩 단계 (7일)
select count(*) as created,
       count(*) filter (where age_band is not null) as age_checked,
       count(*) filter (where age_band = 'under14') as under14,
       count(*) filter (where age_band = 'under14' and guardian_consented_at is not null) as guardian_ok,
       count(*) filter (where onboarded_at is not null) as onboarded
  from public.users
 where created_at >= (public.kst_today() - 6)::timestamp at time zone 'Asia/Seoul';

-- 가입 뒤 첫 학습 (7일 안 가입자, 사람 단위)
with s as (
  select anon_id, min(occurred_at) as at from public.analytics_events
   where name = 'login_success' and (props->>'new_user')::boolean
     and occurred_at >= (public.kst_today() - 6)::timestamp at time zone 'Asia/Seoul'
   group by 1
), f as (
  select e.anon_id, bool_or(e.name = 'quest_start') as started, bool_or(e.name = 'quest_complete') as completed,
         bool_or(e.name = 'quest_complete' and (e.props->>'stage_cleared')::boolean) as stage_cleared
    from public.analytics_events e join s on s.anon_id = e.anon_id and e.occurred_at >= s.at
   where e.name in ('quest_start', 'quest_complete') group by 1
)
select count(*) as signups, count(*) filter (where started) as started,
       count(*) filter (where completed) as completed, count(*) filter (where stage_cleared) as stage_cleared
  from s left join f using (anon_id);

-- D1 (돌아올 날이 최근 7일 안인 가입자)
with s as (
  select anon_id, public.kst_date(min(occurred_at)) as d0 from public.analytics_events
   where name = 'login_success' and (props->>'new_user')::boolean
     and occurred_at >= (public.kst_today() - 14)::timestamp at time zone 'Asia/Seoul'
   group by 1
)
select count(*) as d1_cohort,
       count(*) filter (where exists (select 1 from public.analytics_events e
                                       where e.anon_id = s.anon_id and e.actor = 'user'
                                         and public.kst_date(e.occurred_at) = s.d0 + 1)) as d1_back
  from s where s.d0 between public.kst_today() - 7 and public.kst_today() - 1;

-- 오늘 튜터 요청 (유형별)
select substr(bucket, 7) as kind, sum(day_count) as allowed, sum(day_denied) as denied
  from public.api_rate_limits
 where bucket like 'tutor:%' and day = public.kst_today()
 group by 1 order by 2 desc;

-- 건강
select (select count(*) from public.coin_balance_mismatches())                       as coin_mismatches,
       (select count(*) from public.list_expired_unconsented(500))                   as purge_overdue_unconsented,
       (select count(*) from public.board_posts where is_hidden)                     as hidden_posts,
       (select count(*) from public.board_comments where is_hidden)                  as hidden_comments,
       (select count(*) from public.creations where hidden_at is not null)           as hidden_creations,
       (select count(*) from public.board_reports where created_at >= now() - interval '7 days')
     + (select count(*) from public.creation_reports where created_at >= now() - interval '7 days') as reports_7d;
-- 00061 이 있으면: select count(*) from public.list_expired_incomplete(500);
```

## 5. 성능

`analytics_events` 는 00017 인덱스 `(name, occurred_at)`·`(occurred_at)` 로 기간 조건을 받칩니다(새 인덱스 없음). 합성 이벤트 20만 행(28일, 익명 ID 2,000개 + 가입 2,000, 로컬 스택에서 트랜잭션 안에 넣고 ROLLBACK)으로 잰 함수 한 번: 오늘 114ms · 7일 209ms · 28일 752ms, 기간 조건은 `idx_analytics_events_occurred` 비트맵 스캔(7일 5만 행 17ms). 함수는 한 번에 10개 쿼리이고 28일이 가장 무겁습니다. 느려지면 먼저 28일만 피하고, 보존 180일 정리(`prune_analytics_events`)가 밀렸는지 봅니다.

## 6. 검증

- 단위: `src/lib/monitoring/__tests__/metrics.test.ts`(기간·0으로 나누기·빈 데이터·경고 기준), `WorldHud.test.tsx`(관리자만 메뉴 줄)
- DB: `supabase/tests` MON-1(anon·학생 실행 거부)·MON-2(넣은 이벤트만큼 정확히 늘고 직접 SQL과 같음, 기간 1·7·28만)
- e2e: `e2e/admin-monitoring.spec.ts`(비로그인·학생 404, 관리자 화면·메뉴 줄·기간 전환)
