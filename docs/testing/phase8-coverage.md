# Phase 8 보상 규칙 테스트 지도 (P8-15)

Phase 8(레벨·코인·별·미션·출석·업적)의 규칙이 어디서 검사되는지 정리한 표입니다. P8-01~14가 항목마다 테스트를 넣었기 때문에 P8-15에서는 새로 쓰기보다 빈 곳을 찾아 채웠습니다. 새로 넣은 것은 **굵게** 표시했습니다.

- **TS 단위**: `npx vitest run` (`src/**/__tests__`, `scripts/balance/__tests__`)
- **SQL 점검**: `npm run test:rls` (`supabase/tests/checks.mjs`, 기대값은 `expectations.mjs`)
- **대조표**: `supabase/tests/fixtures/reward-rules.json`. vitest `rewardRules.test.ts`와 RLS `RW-1`이 같은 행을 TS 함수와 SQL 함수에 각각 넣어 봅니다. 둘 다 통과해야 TS와 SQL 규칙이 같다고 봅니다.
- **시계**: TS는 `now`/`today`를 인자로 받으니 고정 시각을 넘깁니다(`vi.useFakeTimers` 대신). SQL은 `kst_today()`가 `now()` 기준이라 날짜 컬럼(`stars_judged_on`, `day`, `completed_at`)을 `kst_today() - n`으로 옮겨 하루가 지난 상태를 만듭니다. 그래서 SQL에서 하루의 경계는 `kst_date()` 한 함수에 몰려 있고, 그 함수는 **대조표 `kst_date` 행**으로 검사합니다.

## 1. 레벨 곡선

| 경우 | 위치 |
| --- | --- |
| 문턱 공식 `round(200 × (N − 1)^1.3, 10)`, 늘 커짐, Lv 10·20·30 값 | `src/lib/quest/__tests__/xp.test.ts` "레벨 곡선" |
| Lv 1~50 **모든 문턱과 그 1 아래**(±1 전 구간), Lv 50 넘는 XP(31,500 · 999,999), 음수 XP | 대조표 `level` 101행 → `rewardRules.test.ts` + `RW-1`, `xp.test.ts` `calculateLevel` |
| 최고 레벨과 그 너머 진행률 100% | `xp.test.ts` `getXPProgress` |
| 칭호 50종·12자 이하·5레벨마다 큰 칭호 | `xp.test.ts` |
| 레벨 업 코인: **Lv 0~51 모든 레벨**(20, 5레벨마다 100, 범위 밖 0) | 대조표 `coins` level_up 행 52개(전에는 9개) → vitest + `RW-1` |
| 여러 레벨을 한 번에 넘을 때 코인 합 | `coins.test.ts` `levelUpCoinsTotal`, `CN-10`(Lv 1→6 = 20·20·20·100·20, 다시 0), `DM-4`(미션 XP로 Lv 2) |
| `current_level`은 `total_xp`에서만 정함(B20 트리거) | `RW-14` |
| 기존 사용자 재계산(레벨이 내려가지 않음, 두 번 실행해도 같음) | `RW-15`, `RW-16` |
| 월드별 목표 레벨 시뮬레이션 | `scripts/balance/__tests__/level-curve.test.ts`, `economy.test.ts` |

## 2. 별점

| 경우 | 위치 |
| --- | --- |
| 코드 퀘스트 별: 힌트 0·1·2+ → 3·2·1, 황금키 1 | 대조표 `stars` → `xp.test.ts` `codeQuestStars` + `RW-1`, `SR-1` |
| 별 번호마다 5코인, 새로 얻은 별만 | `SR-1`, `SR-2`, `CN-9`, 대조표 `coins` star |
| 퀴즈 별(1·2·3번째 정답 → 3·2·1, XP = 별 × 10) | `QZ-4`, `QZ-5` |
| 황금키 퀘스트를 다음 날 직접 풀면 그때 보상 | `SR-3` |
| 보물상자 목표 `ceil(코드 퀘스트 × 3 × 0.7)`, 코드 퀘스트 0개면 잠김, 100% 완벽 | 대조표 `chest_goal`, `chest.test.ts`, `CH-2`, `CH-3` |

## 3. 데일리 미션 판정

| 경우 | 위치 |
| --- | --- |
| 배정이 결정적, 할 수 있는 미션만, 오늘의 퀴즈 목록 고정 | `DM-2`, `DM-2b`(퀘스트 3개 미션: 7일 전은 셈, 8일 전·오늘은 안 셈) |
| 진행: 자정 정각은 오늘, 1초 전은 어제, 황금키·힌트 쓴 완료 제외, 복습·오늘의 퀴즈·퀴즈 맞히기 | `DM-3` |
| 받기: 미달 409, 남의 미션 404, 7일 전·내일 410, 동시 4번도 1회, 레벨 업 코인, 어제 것 pending | `DM-4` |
| **7일 보관 경계: 6일 전 것은 pending에 있고 받기 200, 7일 전 것은 pending에서 빠지고 410, 다시 받기 0** | **`DM-5`** |
| 화면: 받을 수 있는 수, 자정까지 남은 시간(KST 23:59:59 → 1초, 자정 정각 → 24시간) | `src/lib/world/__tests__/missions.test.ts`, `DailyMissions.test.tsx`, `api/missions/claim` 라우트 테스트 |

## 4. 스트릭(KST 경계)

| 경우 | 위치 |
| --- | --- |
| KST 자정: UTC 14:59:59.999 / 15:00, UTC 날짜가 바뀌기 전(UTC 15:00~24:00), 연말, 윤년, 서머타임 없음, 실행 TZ 5곳에서 같음 | `src/lib/time/__tests__/kst.test.ts` |
| **SQL `kst_date`도 같은 순간에 날짜가 바뀜: 1ms·1초 전, 자정 정각, UTC 자정, 월말, 연말, 평년·윤년 2월, +09 표기** | **대조표 `kst_date` 12행 → `rewardRules.test.ts`(`toKstDateKey`) + `RW-1`(`public.kst_date`)** (전에는 SQL 쪽이 `KST-1`·00012 자기 검증의 11-03 14:59:59/15:00 한 쌍뿐이었음) |
| 연속 학습일: 오늘 아직, 그제에서 끊김, 공백, 중복, 연말, 윤일 | 대조표 `streak_days` → `streak.test.ts`·`rewardRules.test.ts` + `RW-1`(`current_streak`) |
| **월말(11-30 → 12-01), 평년 2월 말, 윤일을 빠뜨리면 끊김, 연말 방패 날로 메운 공백, 윤일 앞뒤 방패 날** | **대조표 `streak_days` +5행** (`current_streak`은 학습일 ∪ 방패 날 목록을 받으므로 방패 날을 목록에 넣어 검사) |
| 방패 정산: 하루·이틀 공백, 모자람, 0개, 오늘도 풀었을 때, 동시 4번 1개, 퀴즈 끝낸 날도 학습일, 황금키 제외 | `AT-3` |
| 어제가 방패 날이었는지(월 경계) | `attendance.test.ts` `shieldSavedYesterday` |
| 출석 도장: 하루 한 번, 7회 사이클, 7일째 방패(가득이면 0) | `AT-2`, `attendance.test.ts`, `api/attendance/stamp` 라우트 테스트 |

## 5. 멱등성

모든 지급은 원장 키(`coin_ledger (user_id, source, ref)`) 한 번입니다. 같은 요청을 다시 보내거나, 동시에 보내거나, 진행을 리셋한 뒤 다시 풀어도 두 번 받지 않습니다.

| 경우 | 위치 |
| --- | --- |
| 동시 호출 | `RW-2`(완료 8번), `RW-3`(황금키 5번), `CN-4`, `CN-8`(8번), `SR-2`, `QZ-3`, `CN-9`, `CH-2`, `DM-4`, `AT-2`, `AT-3`, `AC-2`, `AC-4`(각 4번) |
| 다시 부르기 | `CN-8`, `CN-10`, `SR-2`, `CH-2`, `DM-4`, **`DM-5`**, `AT-2`, `AC-2`, `AC-4` |
| 리셋 뒤 | `CN-7`(퀘스트 코인 0, 퀘스트 밖 XP 남음 B55), `CN-9`, `CH-2`, `AC-4`, `QZ-10`, `RW-7`, `RW-8` |
| 마이그레이션 재실행 | `RW-10`(00006), `RW-15`(00029), `AC-5`(00036), `RT-1`(00037 + 되돌리기), 아래 리허설(00028~00038 전체) |
| 잔액 = 원장 합 | 거의 모든 코인 점검의 `mismatches` |

## 6. 퀴즈·코드 퀘스트 복습 가능일(KST 경계)

| 경우 | 위치 |
| --- | --- |
| 별 3개 미만이고 판정일이 오늘보다 전이면 열림, 판정 기록이 없으면 열림 | `src/lib/quest/__tests__/starReview.test.ts` |
| 판정일 다음 날 KST 0시 정각에 열림(UTC 14:59:59는 닫힘, 15:00은 열림) | `starReview.test.ts`, `dailyQuiz.test.ts` "KST 자정 경계" |
| **달·해·윤일 경계(11-30, 12-31, 02-28 → 02-29, 02-29 → 03-01)** | **`starReview.test.ts`** |
| 서버: 같은 날은 연습, 다음 날은 복습 도전, `next_review_on` = 판정일 + 1 | `QZ-6`, `QZ-7`, `SR-2`, `SR-3` (SQL 하루 경계는 위 `kst_date` 행) |
| 오늘의 퀴즈: 어제 판정한 것 먼저, 자정 직후 시도는 오늘 | `dailyQuiz.test.ts` |

## 7. 묶음 리허설 (2026-11-12, P8-15)

**CRLF 운영 재현** `RLS_CRLF=1 npm run test:rls:ci`: P8-14 후속 커밋 a71937a가 00031~00038을 제자리에서 고친 뒤로 이 점검은 돌리지 않았습니다. 이번 실행 결과는 prod_replay(CRLF 묶음, CR-1~4 포함), fresh_legacy, fresh_newdefault 세 시나리오 모두 FAIL 0입니다(수치는 계획서 P8-15 줄).

**되돌리기 → 재적용 → 재적용** (로컬 pyroad 스택, `npm run test:rls`로 사용자 96명·진행 169행이 있는 DB):

1. `supabase/rollback/00038` → `00028`을 역순으로 하나씩 `psql -1` 실행했고 모두 성공했습니다. 남은 Phase 8 객체(테이블 9개, 새 함수 29개, 열 3개, 트리거)는 0개이고 사용자·XP·레벨·진행 행 수는 그대로입니다.
2. 런북 00030 되돌리기 메모대로 `00027`을 다시 실행했습니다. 이 상태의 스키마 지문(public 함수 정의·권한, 열·기본값, 트리거, 정책, 테이블 권한)이 `supabase db reset --version 00027`로 만든 Phase 7 DB의 지문과 같았습니다.
3. `00028` → `00038`을 두 번 적용했습니다. 두 번 모두 성공했고 지문이 서로 같으며, 처음(되돌리기 전) 지문과도 같습니다. 데이터 수도 그대로이고 원장 ↔ 잔액 불일치는 0명입니다.
4. 런북 [v0.6-runbook](../release/v0.6-runbook.md) "Phase 8 병합" 표의 순서(00028 → 00038, 11개)가 `scripts/release/build-release-sql.mjs`의 `v0.6-phase8` 묶음 순서와 같습니다.

이 과정에서 **B59**를 찾았습니다. `AC-5`가 00036을 다시 실행하면 00038이 바꿔 둔 `achievement_progress`가 00036 본문으로 돌아갑니다. 그래서 뒤에 오는 점검(PS-*)이 옛 정의로 돌았고, 테스트를 마친 DB의 지문도 새로 만든 DB와 달랐습니다. 운영 경로와는 상관없습니다. `AC-5`가 끝나면 00038을 다시 적용하도록 고쳤고, 고친 뒤에는 테스트를 마친 DB의 지문이 새 DB와 같습니다.
