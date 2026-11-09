# 분석 이벤트 설계 (P1-17)

> - 결정: §12-Q22 — 외부 서비스 없이 Supabase `analytics_events` 테이블 + API Route + `track()` 추상화. 비용·국외 이전 없음.
> - 원칙: 아동 대상이라 **익명 ID만** 저장하고 개인정보는 수집하지 않습니다(§2.6, §7 PostHog 행). IP·User-Agent 원문·URL 쿼리도 저장하지 않습니다.
> - 코드: `src/lib/analytics/`(이벤트 정의·`track()`·서버 기록), `src/app/api/analytics/route.ts`, 마이그레이션 `supabase/migrations/00017_analytics_events.sql`
> - 운영 적용: [v0.4 런북](release/v0.4-runbook.md) ① 9번, "분석 이벤트 (운영, P1-17)"

## 1. 무엇을 재나 (§1 성공 지표와의 연결)

| §1 지표 | 이 도구로 재는 방법 | 쓰는 이벤트 | 한계 |
|---|---|---|---|
| 랜딩 → 로그인 전환율 (현재 대비 +30%) | 날짜별 `랜딩 세션 수 → CTA 누른 세션 수 → 로그인 성공 사용자 수(가입)` 비율 (SQL 1) | `landing_view`, `landing_cta_click`, `login_success` | 비로그인 세션 ID와 로그인 사용자 ID를 **잇지 않으므로** 사람 단위 퍼널이 아니라 날짜별 합계 비율입니다(개인을 이어 붙이지 않는 쪽을 택함). "현재" 기준값이 없으므로 **v0.4 배포 뒤 Phase 4(랜딩 개편) 전 2주를 기준선**으로 씁니다 |
| 가입 → 첫 퀘스트 시작 → 첫 완료 (온보딩) | 가입 코호트별 시작률·완료률·첫 완료까지 걸린 시간 (SQL 2) | `login_success(new_user)`, `quest_start`, `quest_complete` | 로그인 사용자 ID(HMAC)는 계속 같으므로 사람 단위로 이어집니다 |
| D1 / D7 재방문율 (40% / 20%) | 정식 측정은 출석 데이터(Phase 8). 그 전에는 서버 이벤트가 있는 날을 "활동한 날"로 근사 (SQL 4) | 로그인 사용자의 모든 서버 이벤트 | 월드맵만 보고 퀘스트를 열지 않은 날은 빠집니다 |
| 세션당 완료 퀘스트 수 (3개 이상) | 정식 측정은 `user_progress`. 이벤트로는 30분 간격 세션 근사 (SQL 5) | `quest_complete`, 그 밖의 서버 이벤트 | 처음 완료만 기록하므로 다시 풀기는 세지 않습니다 |
| 모바일 세션 비율 (측정 시작) | 날짜별 기기 유형 비율 (SQL 3) | 모든 이벤트의 `device` | iPadOS Safari는 Mac으로 보고하므로 `desktop`으로 셉니다. 퀴즈(모바일 퀘스트) 완료율은 Phase 7에서 `quest_complete`에 퀘스트 유형이 생기면 같은 방식으로 |
| 힌트 사용 (보상 설계·난이도 조정 참고) | 퀘스트별 힌트 단계 분포, 시작 대비 힌트 비율 (SQL 6) | `hint_used`, `quest_start` | |
| 30초 체험 → 로그인 전환 (P4-03) | 날짜별 `랜딩 세션 → 체험을 만진 세션 → 체험 성공 세션 → 체험 CTA에서 로그인을 고른 세션` (SQL 8). 오류 종류 분포로 어디서 막히는지 | `landing_view`, `trial_start`, `trial_run`, `trial_success`, `landing_cta_click(cta=trial)` | 같은 탭 세션(`sid`) 안에서는 이어서 셉니다. 로그인 성공(`login_success`)은 사용자 ID라 체험 세션과 잇지 않습니다(위 랜딩 전환과 같은 한계) |

이 도구는 **제품 개선용 합계**를 보는 곳입니다. 특정 아이의 행동을 들여다보거나 보상·제재 판단에 쓰지 않습니다.

## 2. 이벤트 목록

모든 속성은 **자유 문자열이 없는** 정해진 값(enum·UUID·범위가 있는 정수·불리언)입니다. 정해 둔 키 밖의 값이 오면 서버가 거부합니다(zod `.strict()`, `src/lib/analytics/schema.ts`). 퀘스트 id는 공개 콘텐츠 id라 개인정보가 아닙니다.

| 이름 | 기록하는 곳 | 속성 | 언제 | 횟수 |
|---|---|---|---|---|
| `landing_view` | 브라우저 `track()` — `src/components/landing/LandingViewTracker.tsx` (`src/app/page.tsx`) | 없음 | 랜딩을 열 때 | 볼 때마다 |
| `landing_cta_click` | 브라우저 `track(…, { immediate: true })` — `HeroSection`(→ `LoginButton` `onBeforeLogin`), `LandingHeader` | `cta`: `hero`·`header`·`trial`(30초 체험 성공 뒤 "모험을 저장하려면 로그인!", P4-03), `provider`: `google`·`kakao`·`naver`, `shared`(선택, 불리언): 공용 기기 체크 "학교·도서관 컴퓨터예요"를 켜고 골랐는지(P4-09) | 로그인 버튼을 누른 직후(OAuth로 떠나기 전에 바로 전송) | 누를 때마다 |
| `trial_start` | 브라우저 `track()` — `src/components/landing/sections/trial/TrialNotebook.tsx` (P4-03) | 없음 | 랜딩 30초 체험 공책을 처음 만질 때(글자를 고치거나·보조 키·추천 주문·"주문 걸기"). 데모가 자동으로 치는 것은 세지 않음 | 페이지당 1번 |
| `trial_run` | 브라우저 `track()` — 같은 곳 (P4-03) | `result`: `ok`(찍힘)·`no_print`(print 없이 식만)·오류 종류(`src/lib/landing/miniPython/errors.ts`의 `MINI_ERROR_KINDS`: `unterminated_string`·`unclosed_paren`·`print_typo`·`unquoted_text`·`zero_division`·`str_plus_number`·`unsupported` 등 21가지). **아이가 쓴 코드·출력은 보내지 않음** | "주문 걸기"(또는 Enter·추천 주문)를 누를 때 | 누를 때마다 |
| `trial_success` | 브라우저 `track()` — 같은 곳 (P4-03) | `runs`: 몇 번째 주문에서 처음 성공했나(1~99 정수) | 체험 공책에서 처음 print 결과가 나왔을 때 | 페이지당 1번 |
| `login_success` | 서버 — `src/app/auth/callback/route.ts` | `provider`: `google`·`kakao`·`naver`·`unknown`, `new_user`: 가입 직후 첫 로그인 | 코드 교환 성공 뒤 | 로그인마다. `new_user=true`는 사용자당 1번(dedupe) |
| `onboarding_complete` | 서버 — `src/app/api/onboarding/route.ts` (P3-11) | `skin`: 파이뱀 색 6종 id(`green`·`sky`·`sunset`·`berry`·`violet`·`sunny`), `grade_given`: 학년을 골랐는지(학년 값·닉네임은 보내지 않음), `returning`: 온보딩 전부터 학습하던 기존 사용자였는지(P3-12, 서버가 경험치·진행 행으로 판별) | `complete_onboarding` RPC가 처음 온보딩을 마친 것으로 처리했을 때 | 사용자당 1번(dedupe) |
| `quest_start` | 서버 — 퀘스트 페이지 서버 컴포넌트 `trackQuestStart()` (**아래 4. 연결 대기**) | `quest_id` | 퀘스트에 처음 들어올 때. 잠긴 스테이지로 돌려보낼 때는 기록하지 않음 | 사용자·퀘스트마다 1번(dedupe) |
| `quest_complete` | 서버 — `src/app/api/quest/complete/route.ts` | `quest_id`, `hints_used`(0~99), `used_golden_key`, `level_up`, `stage_cleared` | `complete_quest` RPC가 **처음** 완료로 처리했을 때(값은 모두 DB 함수가 정한 것) | 사용자·퀘스트마다 1번 |
| `hint_used` | 서버 — `src/app/api/tutor/route.ts`·`stream/route.ts`의 `withHintTracking()` (`record_hint` 경로) | `quest_id`, `level`(1~3) | 튜터가 힌트 내용을 보내기 시작한 때(`record_hint`와 같은 시점, 끊긴 요청은 세지 않음) | 받을 때마다 |
| `motion_tier_change` | 브라우저 `track()` — `src/lib/motion/MotionTierProvider.tsx` (P2-15) | `from`·`to`: `full`·`lite`·`minimal`(바뀌기 전·후 적용 단계), `cause`: `measured`(실측 자동 하향)·`user`(설정 화면에서 바꿈·"다시 재 보기"), `setting`: `auto`·`full`·`lite`·`minimal`(그때의 움직임 설정), `reduced`: `system`·`on`·`off`(그때의 동작 줄이기 설정), `elapsed_s`: 페이지를 연 뒤 초(0~86400 정수) | 자동 하향은 실측 샘플러가 한 단계 내릴 때(페이지당 최대 2번, 내려간 단계는 기기에 저장되어 다음 세션은 그 단계에서 시작하므로 반복되지 않음). 사용자는 설정을 고를 때 | 바뀔 때마다 |
| `pwa_install_prompt` | 브라우저 `track()` — `src/components/pwa/useInstallFlow.ts` (P4-11) | `via`: `world`(월드맵 쪽지)·`settings`(설정 화면), `platform`: `android`(브라우저 설치 창)·`ios`(그림 안내), `result`: `accepted`·`dismissed`(안드로이드 설치 창에서 고른 것)·`guide`(iOS 안내를 엶 — iOS는 실제로 추가했는지 알 수 없음) | "홈 화면에 추가" 버튼을 눌러 설치 창에서 고르거나 iOS 안내를 열 때 | 누를 때마다 |
| `pwa_installed` | 브라우저 `track()` — `src/lib/pwa/installPrompt.ts` (P4-11) | 없음 | 브라우저가 `appinstalled`를 보낼 때(Chromium만, iOS는 알 수 없음) | 설치할 때마다 |
| `continue_click` | 브라우저 `track()` — `src/components/world/ContinueCta.tsx` (P5-10) | `kind`: `recent`(하다 만 퀘스트)·`next`(다음 차례)·`start`(진행 0, "모험 시작하기"), `place`: `head`(지도 머리)·`float`(모바일 아래 떠 있는 버튼) | 월드맵 이어하기 버튼을 누를 때(퀘스트 id는 보내지 않음, 실제 진입은 `quest_start`) | 누를 때마다 |

- **서버 이벤트는 클라이언트가 보낼 수 없습니다.** `/api/analytics`는 `landing_view`·`landing_cta_click`·`motion_tier_change`·`pwa_install_prompt`·`pwa_installed`·`continue_click`·`trial_start`·`trial_run`·`trial_success`만 받습니다(나머지는 400). 그래서 로그인·온보딩·시작·완료·힌트 지표는 조작할 수 없고(지표 신뢰도), RLS 회귀 AN-3·AN-4가 테이블 직접 쓰기도 막혀 있는지 확인합니다.
- 새 이벤트를 더할 때: `events.ts`(타입·이름) → `schema.ts`(strict 스키마) → 이 표. DB는 이름 형식(`^[a-z][a-z0-9_]{1,47}$`)·크기만 보므로 마이그레이션이 필요 없습니다.
- `motion_tier_change`는 **기기 성능 분포로 연출 단계 임계값을 조정**하려는 것입니다(P12-04: 놓친 프레임 25%, 창 4개 중 3개). 프레임 수치·화면 크기·기기 모델 같은 지문 정보는 보내지 않고 단계 이름과 경과 초만 보냅니다. `device`(서버가 UA로 판별한 유형)와 함께 보면 "태블릿에서 자동 하향이 얼마나 자주, 몇 초 만에 일어나는지"를 알 수 있습니다(SQL 7). 클라이언트 이벤트라 부풀릴 수 있지만 보상·지표 판정에 쓰지 않는 진단용입니다.

## 3. 저장 형태와 익명 ID

`analytics_events` (00017, **service_role 전용**: RLS ON + 정책 없음 + anon·authenticated 권한 없음. service_role도 UPDATE 없음 = 기록은 고치지 않음)

| 컬럼 | 값 |
|---|---|
| `id` | UUID |
| `occurred_at` | 서버가 받은 시각 (클라이언트 시계는 믿지 않음) |
| `name` | 이벤트 이름 |
| `actor` | `user`(로그인) · `visitor`(비로그인) |
| `anon_id` | 아래 익명 ID (base64url 22자, DB CHECK) |
| `source` | `server` · `client` |
| `props` | 위 속성 (jsonb 객체, 512바이트 이하) |
| `device` | `mobile` · `tablet` · `desktop` · `unknown` — 서버가 User-Agent로 판별하고 **원문은 버림** |
| `path` | 경로 템플릿만 (`/`, `/quest/[id]`, `/auth/callback`). 쿼리·해시는 버리고 UUID는 `[id]`, 이상한 조각은 `[x]`로 (`normalizePath`) |
| `dedupe_key` | "처음 한 번" 이벤트용 (`quest_start:<quest id>` 등). `(anon_id, dedupe_key)` UNIQUE + `ON CONFLICT DO NOTHING` |

**익명 ID**
- 로그인 사용자: `base64url(HMAC-SHA256(ANALYTICS_SALT, "pyroad:analytics:user:" + user id))` 앞 22자(132비트). 서버(`anonymizeUserId`)만 만듭니다.
  - 같은 사용자는 늘 같은 값 → 가입 코호트·재방문을 계산할 수 있습니다.
  - salt는 서버 env에만 있으므로 DB·내보낸 CSV만으로는 사용자와 이을 수 없습니다. P1-19 로그 해시(`sha256(user id)`)와 달리 user id를 아는 사람도 salt 없이는 같은 값을 만들 수 없습니다.
  - **salt를 바꾸면** 그 뒤의 ID가 모두 바뀌어 기존 기록과 이어지지 않습니다(복구할 것은 없음, 연속성만 끊김). 그래서 한 번 정하면 바꾸지 않습니다.
  - 탈퇴하면 `/api/account/delete`가 HMAC으로 그 사용자의 행을 지웁니다(`deleteUserAnalytics`).
- 비로그인 방문자: 탭마다 브라우저가 만든 128비트 난수(`crypto.getRandomValues`)를 **sessionStorage**(`pyroad.analytics.sid`)에 둡니다. 쿠키·localStorage를 쓰지 않으므로 탭을 닫으면 사라지고 다음 방문과 이어지지 않습니다. 저장소를 쓸 수 없으면(개인 정보 보호 모드) 그 페이지 동안만 메모리에 둡니다.
- 로그인 뒤 브라우저 이벤트도 서버가 HMAC ID로 바꿔 저장하고 세션 ID는 버립니다(비로그인 기록과 로그인 사용자를 잇지 않음).

**저장하지 않는 것**: user id, 이메일·이름·닉네임·프로필, IP(`x-forwarded-for`), User-Agent 원문, URL 쿼리·해시·referrer, 학생 코드·출력·튜터 대화, 화면 크기 같은 지문 정보.

**보존**: 180일. pg_cron이 없으므로 `/api/analytics`가 인스턴스마다 1시간에 한 번 `prune_analytics_events()`(최대 5,000행, 오래된 것부터)를 부르고, 밀리면 런북 SQL로 직접 실행합니다.

## 4. 흐름

```
브라우저 track(name, props)            서버 (Route Handler·Server Component)
  ├ DNT/GPC 켜짐 → 버림                 ├ ANALYTICS_SALT 없음 / DNT·GPC 헤더 → 버림
  ├ 개발: 콘솔만 · 테스트: off          ├ 속성 strict 검사 (틀리면 로그만)
  ├ 큐 → 2초 또는 10건 → fetch keepalive └ after() 로 응답 뒤에 analytics_events upsert
  └ immediate·pagehide·탭 숨김 → sendBeacon(text/plain)
           │
           ▼
POST /api/analytics
  1. 다른 출처(Origin·Sec-Fetch-Site) → 403      4. ANALYTICS_SALT 없음·DNT/GPC → 204 (버림)
  2. 8KB 초과 → 413                              5. getUser(): 로그인이면 HMAC ID, 아니면 sid
  3. zod strict (클라이언트 이벤트만, ≤10건) → 400  6. 한도 → 429 + Retry-After
                                                 7. insert, 기회적 보존 정리 → 204
```

- **남용 방지**: 로그인은 사용자별 `consume_rate_limit(user, 'analytics:client')`(기본 분당 20·하루 300 요청, env `ANALYTICS_LIMIT_USER`). 비로그인은 사용자 단위가 없어(세션 ID는 클라이언트가 마음대로 바꿈) **전체 합계** `consume_global_rate_limit('analytics:visitor')`(기본 분당 120·하루 5,000 요청, env `ANALYTICS_LIMIT_VISITOR`)로 테이블 크기의 상한을 둡니다. 봇이 이 한도를 다 쓰면 그날 비로그인 지표만 덜 쌓이고(화면 영향 없음), 분 창마다 처음 한 번 Sentry warning `analytics visitor limit exceeded`가 갑니다. 한도 DB 호출이 실패하면 통과시킵니다.
- **실패해도 사용자 경험에 영향 없음**: 클라이언트는 응답을 보지 않고 재시도하지 않습니다. 서버 이벤트는 던지지 않고(`[analytics] … 실패` 로그 + Sentry `area:analytics`), 응답을 기다리게 하지 않습니다(`after()`).
- **연결 대기 — `quest_start`**: 퀘스트 페이지(`src/app/(protected)/quest/[questId]/page.tsx`)는 B38이 수정 중이라 P1-17에서는 고치지 않았습니다. B38 뒤에 잠긴 스테이지 redirect **다음**, `return` 전에 한 줄을 넣습니다(사용자·퀘스트마다 한 번만 남으므로 매 방문 불러도 됨):
  ```ts
  import { headers } from 'next/headers';
  import { trackQuestStart } from '@/lib/analytics/server';
  // … if (!stageUnlocked && progress?.status !== 'completed') redirect(STAGE_LOCKED_REDIRECT); 다음
  trackQuestStart(await headers(), user.id, quest.id);
  ```
  클라이언트(`useQuestSession`)에서는 기록하지 않습니다(클라이언트 이벤트로 두면 퍼널을 부풀릴 수 있음).

## 5. 개인정보·동의 판단 (한국 개인정보 보호법 기준, 법률 자문 아님)

- **비로그인 세션 ID**: 탭 단위 난수이고 서버가 IP·User-Agent 원문을 저장하지 않으므로, 이 테이블만으로도, 다른 정보와 합쳐도 사람을 알아보기 어렵습니다. 개인정보 보호법 제2조 제1호의 개인정보가 아닌 익명 정보로 볼 여지가 큽니다(제58조의2).
- **로그인 HMAC ID**: salt를 가진 운영자는 `users`와 대조해 다시 알아볼 수 있으므로 **가명정보이자 개인정보**로 다룹니다(제2조 제1호 다목). 회원 서비스 제공 중에 생기는 "서비스 이용 기록"을 서비스 개선 목적으로 처리하는 것이므로,
  - 개인정보 처리방침에 수집 항목(서비스 이용 기록: 로그인·퀘스트 시작·완료·힌트 사용 이벤트, 기기 유형), 목적(서비스 개선·통계), 보유 기간(180일, 탈퇴 시 즉시 삭제), 제3자 제공·국외 이전 없음을 적어야 합니다(제30조).
  - 14세 미만 아동은 가입 때 법정대리인 동의를 받는 항목(제22조의2)에 "서비스 이용 기록"이 들어 있어야 합니다. 들어 있지 않으면 동의 문구·처리방침을 갱신합니다 → **사용자 작업**.
  - 맞춤형 광고·프로파일링·외부 전송은 하지 않습니다(개인정보보호위원회 「아동·청소년 개인정보 보호 가이드라인」의 최소 수집 원칙).
- **쿠키 배너**: 한국 법은 EU ePrivacy처럼 쿠키 사전 동의 배너를 요구하지 않습니다. 대신 처리방침에 "개인정보를 자동으로 수집하는 장치의 설치·운영 및 그 거부에 관한 사항"을 적어야 합니다(제30조 제1항). 이 도구는 **쿠키를 쓰지 않고**(sessionStorage만, 탭을 닫으면 삭제) 거부 방법(브라우저의 추적 거부 DNT·GPC 설정)을 존중하므로, **배너는 필요 없고 처리방침 한 단락**이면 됩니다. 처리방침 예시:
  > 서비스 개선을 위해 로그인·퀘스트 이용 기록을 사용자를 알아볼 수 없는 익명 번호로 바꿔 180일 동안 보관합니다. 로그인하지 않은 방문은 브라우저 탭을 닫으면 사라지는 임시 번호로만 셉니다. 쿠키는 쓰지 않으며, 브라우저에서 '추적 거부(Do Not Track)' 또는 'Global Privacy Control'을 켜면 기록하지 않습니다. 탈퇴하면 바로 지웁니다.
- **DNT·GPC 존중**: 한국에서는 법적 효력이 없지만 아동 서비스라 보수적으로 따릅니다. 처리방침의 "거부 방법"이 되고, 브라우저(`track()`)와 서버(`DNT: 1`·`Sec-GPC: 1` 헤더) 모두 같은 규칙입니다. Brave 등 GPC가 기본으로 켜진 브라우저 사용자는 지표에서 빠지므로 비율은 이를 감안해 읽습니다.
- 출시 전 개인정보 처리방침 문구는 전문가 검토를 권합니다(P12-06 점검 대상).

## 6. 환경별 동작

| 환경 | 브라우저 `track()` | 서버 기록 |
|---|---|---|
| 운영 Production (`ANALYTICS_SALT` 있음) | 보냄 | 기록 |
| Preview·로컬 (`ANALYTICS_SALT` 없음) | production 빌드면 보내지만 서버가 버림(204) | 안 함 |
| `npm run dev` | 콘솔에만 `[analytics] name props` (보내지 않음) | `ANALYTICS_SALT`를 넣으면 로컬 DB에 기록 |
| 테스트 (vitest) | off | env를 넣은 테스트만 |

- 로컬에서 저장까지 확인: `.env.local`에 `ANALYTICS_SALT`와 `NEXT_PUBLIC_ANALYTICS_MODE=send`를 넣고 `npm run dev` → 랜딩 열기·로그인 → `docker exec supabase_db_pyroad psql -U postgres -c "select name, actor, device, path, props from analytics_events order by occurred_at desc limit 10"`.
- 나중에 PostHog 등으로 옮길 때: 브라우저는 `track.ts`의 transport, 서버는 `server.ts`의 `insertAnalyticsRows`만 바꾸면 됩니다(호출부는 그대로). 그때도 익명 ID·속성 규칙과 국외 이전 고지(§12-Q22)를 다시 확인합니다.

## 7. 확인용 SQL

SQL Editor(postgres)에서 실행합니다. 날짜는 KST(`public.kst_date`, 00012). 관리자 화면은 만들지 않았습니다.

```sql
-- 1. 랜딩 → CTA → 로그인 (날짜별 합계, 최근 28일). 비로그인 세션과 로그인 사용자는 잇지 않으므로 합계 비율
select public.kst_date(occurred_at) as day,
       count(distinct anon_id) filter (where name = 'landing_view')      as landing_sessions,
       count(distinct anon_id) filter (where name = 'landing_cta_click') as cta_sessions,
       count(distinct anon_id) filter (where name = 'login_success')     as login_users,
       count(distinct anon_id) filter (where name = 'login_success' and (props->>'new_user')::boolean) as signups,
       round(100.0 * count(distinct anon_id) filter (where name = 'landing_cta_click')
             / nullif(count(distinct anon_id) filter (where name = 'landing_view'), 0), 1) as cta_rate_pct,
       round(100.0 * count(distinct anon_id) filter (where name = 'login_success' and (props->>'new_user')::boolean)
             / nullif(count(distinct anon_id) filter (where name = 'landing_view'), 0), 1) as signup_per_landing_pct
  from public.analytics_events
 where occurred_at >= now() - interval '28 days'
 group by 1 order by 1 desc;

-- 2. 가입 코호트 퍼널: 가입 → 첫 퀘스트 시작 → 첫 완료 (최근 28일 가입자, 주별)
with signup as (
  select anon_id, min(occurred_at) as at
    from public.analytics_events
   where name = 'login_success' and (props->>'new_user')::boolean
     and occurred_at >= now() - interval '28 days'
   group by anon_id
), first_of as (
  select e.anon_id, e.name, min(e.occurred_at) as at
    from public.analytics_events e join signup s using (anon_id)
   where e.name in ('quest_start', 'quest_complete')
   group by 1, 2
)
select date_trunc('week', public.kst_date(s.at))::date as signup_week,
       count(*) as signups,
       count(fs.anon_id) as started,
       count(fc.anon_id) as completed,
       round(100.0 * count(fs.anon_id) / count(*), 1) as start_pct,
       round(100.0 * count(fc.anon_id) / count(*), 1) as complete_pct,
       round((percentile_cont(0.5) within group (order by extract(epoch from fc.at - s.at) / 60))::numeric, 1)
         as median_min_to_first_complete
  from signup s
  left join first_of fs on fs.anon_id = s.anon_id and fs.name = 'quest_start'
  left join first_of fc on fc.anon_id = s.anon_id and fc.name = 'quest_complete'
 group by 1 order by 1 desc;

-- 3. 일별 활성 익명 ID와 기기 비율 (최근 28일). user = 그날 서버 이벤트가 있는 로그인 사용자, visitor = 랜딩 세션
select public.kst_date(occurred_at) as day,
       count(distinct anon_id) filter (where actor = 'user')    as active_users,
       count(distinct anon_id) filter (where actor = 'visitor') as visitor_sessions,
       round(100.0 * count(distinct anon_id) filter (where device in ('mobile', 'tablet'))
             / nullif(count(distinct anon_id), 0), 1) as mobile_tablet_pct
  from public.analytics_events
 where occurred_at >= now() - interval '28 days'
 group by 1 order by 1 desc;

-- 4. D1·D7 재방문 근사 (첫 활동일 코호트, 출석 데이터(Phase 8) 전까지)
with days as (
  select distinct anon_id, public.kst_date(occurred_at) as d
    from public.analytics_events where actor = 'user'
), first_day as (
  select anon_id, min(d) as d0 from days group by 1
)
select f.d0 as cohort_day, count(*) as users,
       round(100.0 * count(*) filter (where exists (select 1 from days x where x.anon_id = f.anon_id and x.d = f.d0 + 1)) / count(*), 1) as d1_pct,
       round(100.0 * count(*) filter (where exists (select 1 from days x where x.anon_id = f.anon_id and x.d = f.d0 + 7)) / count(*), 1) as d7_pct
  from first_day f
 where f.d0 >= public.kst_today() - 35 and f.d0 <= public.kst_today() - 7
 group by 1 order by 1 desc;

-- 5. 세션당 처음 완료한 퀘스트 수 (30분 넘게 이벤트가 없으면 새 세션, 최근 28일 근사)
with e as (
  select anon_id, name, occurred_at,
         lag(occurred_at) over (partition by anon_id order by occurred_at) as prev
    from public.analytics_events
   where actor = 'user' and occurred_at >= now() - interval '28 days'
), s as (
  select *, sum(case when prev is null or occurred_at - prev > interval '30 minutes' then 1 else 0 end)
              over (partition by anon_id order by occurred_at) as session_no
    from e
)
select count(*) as sessions,
       round(avg(completed), 2) as avg_completed_per_session,
       round(100.0 * count(*) filter (where completed >= 3) / nullif(count(*), 0), 1) as sessions_3plus_pct
  from (select anon_id, session_no, count(*) filter (where name = 'quest_complete') as completed
          from s group by 1, 2) x;

-- 6. 퀘스트별 시작·완료·힌트 (최근 28일, 시작이 많은 순)
select q.title,
       count(distinct e.anon_id) filter (where e.name = 'quest_start')    as started,
       count(distinct e.anon_id) filter (where e.name = 'quest_complete') as completed,
       count(*) filter (where e.name = 'hint_used')                       as hints,
       count(*) filter (where e.name = 'hint_used' and e.props->>'level' = '3') as hint_level3,
       round(100.0 * count(*) filter (where e.name = 'quest_complete' and (e.props->>'hints_used')::int = 0)
             / nullif(count(*) filter (where e.name = 'quest_complete'), 0), 1) as no_hint_complete_pct
  from public.analytics_events e
  join public.quests q on q.id = (e.props->>'quest_id')::uuid
 where e.name in ('quest_start', 'quest_complete', 'hint_used')
   and e.occurred_at >= now() - interval '28 days'
 group by q.id, q.title order by started desc limit 50;

-- 7. 연출 단계 변경 (P2-15, 최근 28일): 원인·기기 유형별 하향 횟수와 정착 시간 중앙값
select props->>'cause' as cause, device,
       props->>'from' || '→' || (props->>'to') as change,
       count(*) as events,
       count(distinct anon_id) as ids,
       percentile_cont(0.5) within group (order by (props->>'elapsed_s')::int) as median_elapsed_s
  from public.analytics_events
 where name = 'motion_tier_change' and occurred_at >= now() - interval '28 days'
 group by 1, 2, 3 order by events desc;

-- 8. 30초 체험 퍼널 (P4-03, 날짜별 탭 세션 수, 최근 28일) + 오류 종류 분포
select public.kst_date(occurred_at) as day,
       count(distinct anon_id) filter (where name = 'landing_view')  as landing_sessions,
       count(distinct anon_id) filter (where name = 'trial_start')   as trial_sessions,
       count(distinct anon_id) filter (where name = 'trial_success') as success_sessions,
       count(distinct anon_id) filter (where name = 'landing_cta_click' and props->>'cta' = 'trial') as trial_cta_sessions
  from public.analytics_events
 where occurred_at >= now() - interval '28 days'
 group by 1 order by 1 desc;

select props->>'result' as result, count(*) as runs, count(distinct anon_id) as sessions
  from public.analytics_events
 where name = 'trial_run' and occurred_at >= now() - interval '28 days'
 group by 1 order by runs desc;
```
