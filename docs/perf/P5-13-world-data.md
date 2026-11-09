# P5-13 월드맵 서버 데이터 페치

> - 작성일: 2026-11-09 · 브랜치 `feat/phase5` · 전 = `df4d2a6`(P5-12) · 후 = 이 작업
> - 관련: [계획서](../4.upgrade-plan.md) P5-13 · 로더 `src/lib/world/loadWorldMapData.ts` · 형태 변환 `src/lib/world/mapData.ts`

## 1. 결론

`/world`의 서버 데이터는 `loadWorldMapData()` 하나가 **한 번의 병렬 묶음**으로 읽습니다. 전에는 `getUser` → (진행·프로필·뱃지·API 키) 2단계였는데, 사용자 테이블은 user.id 필터 대신 RLS(본인 행만)에 맡겨 `getUser`와 같이 보내고, service_role로 읽는 API 키만 확인한 id로 `getUser` 뒤에 잇습니다. 쿼리 수는 같고(Auth 1 + PostgREST 4 + API 키 1) 직렬 단계가 하나 줄었습니다.

공개 콘텐츠(worlds·stages·quests)는 **캐시하지 않습니다.** 이유는 셋입니다.

1. RLS가 `authenticated` 전용이라 `unstable_cache`/`'use cache'` 안에서 읽으려면 쿠키 없는 service_role 클라이언트가 필요합니다(RLS 우회 경로가 하나 늘어남).
2. 콘텐츠는 seed 배포 때 바뀌는데, 앱 쪽에서 그 순간을 알 방법이 없어 오래된 목록이 남을 수 있습니다.
3. 측정상 얻을 것이 없습니다: 스테이지+퀘스트 쿼리는 약 2ms이고 `getUser`(약 12ms)와 병렬이라 임계 경로에 있지 않습니다.

월드 지도 설정(`WORLDS`)은 빌드 생성물(`worlds.generated.ts`)이라 원래 캐시가 필요 없습니다. 사용자 데이터는 캐시하지 않습니다.

## 2. 측정 (로컬 스택, 60회 중앙값)

스크립트: 로컬 Supabase(`npm run db:start`)에 임시 사용자를 만들어 로그인한 뒤, 전·후 페이지와 같은 쿼리 묶음을 supabase-js로 반복 실행(앞 5회 버림, 전·후를 번갈아 두 번씩).

| | 중앙값 | p90 |
|---|---|---|
| 전: getUser ∥ stages → 진행·프로필·뱃지·API 키 | 18.4ms / 18.1ms | 19.7ms / 19.3ms |
| 후: 모두 병렬 (API 키만 getUser 뒤) | **16.1ms / 15.8ms** | 16.7ms / 16.5ms |
| 참고: stages+quests 쿼리 하나 | 2.2ms | 2.3ms |
| 참고: getUser 하나 | 12.5ms | 13.1ms |

로컬은 DB 왕복이 1~3ms라 차이가 작습니다. 운영(Vercel ↔ Supabase 왕복 수십 ms)에서는 줄어든 직렬 단계 하나가 그 왕복 하나만큼 줄어듭니다.

## 3. 담아 두는 데이터 (다음 항목용)

| 필드 | 쓰는 곳 |
|---|---|
| `progress` (`getWorldStatuses`: 월드·스테이지 상태, 현재 월드, `continueQuestId`, `unlockedStageIds`) | 지도·이어하기(P5-10)·잠금 해제(P5-05) |
| `questsByStage[stageId]`: `id, order, title, quest_type, is_mobile_friendly` + 내 `status`·`best_stars` | 스테이지 바텀시트(P5-06) |
| `profile` (닉네임·스킨·레벨·XP), `badges` | HUD(P5-07), 프로필 요약 |
| `completedAt` (완료 시각) | HUD 스트릭(P5-07, `src/lib/time/kst.ts`로 KST 날짜 계산) |
| `showApiKeyAlert` | ApiKeyAlert |
| (자리만) 잠금 해제 본 기록 | P5-05가 테이블(Q49)을 만들면 추가 |

정답·힌트·`solution_code`는 `quest_answer_keys`(service_role 전용)에 있고 로더는 읽지 않습니다. 퀘스트 열은 `authenticated`의 SELECT 권한과 `quests_select_authenticated` 정책 안에 있습니다(`npm run test:rls` FAIL 0).

## 4. 무효화 규칙 (월드맵이 최신이어야 하는 경우)

로그인 화면은 `force-dynamic`이고 Next 15 Router Cache의 동적 페이지 `staleTime`은 0이라, `/world`로 이동할 때마다 서버에서 다시 렌더합니다. 캐시가 없으니 `revalidatePath`는 지금 사실상 보험이고, 실제로 화면을 새로 받게 하는 것은 이동 자체와 `router.refresh()`입니다.

| 바뀌는 일 | 서버 | 클라이언트 |
|---|---|---|
| 퀘스트 완료 (황금키 마지막 단계 포함, 처음 완료만) | `/api/quest/complete`: `revalidatePath('/world')`·`('/profile')` | `useQuestSession.applyCompletion`: `router.refresh()` |
| 황금키 중간 단계 | 진행 저장만 (월드맵 값 변화 없음) | — |
| 진행 리셋 (전체·스테이지) | `/api/account/reset`: `revalidatePath('/world')`·`('/profile')` | `AccountManagementSection`: `router.refresh()` |
| 설정·API 키·닉네임 | `/api/settings`·`/api/onboarding` (무효화 없음) | 다른 화면에서 바뀌고 `/world`로 돌아올 때 새로 렌더 |
| 콘텐츠 (seed 배포) | — | 캐시 없음, 다음 요청부터 |

새 쓰기 API가 월드맵에 보이는 값을 바꾸면 이 표와 `loadWorldMapData.ts` 머리 주석에 더하고, 사용자가 `/world`에 머문 채 바뀌면 `router.refresh()`를 부릅니다. 나중에 콘텐츠를 캐시하게 되면 seed 적용 뒤 `revalidateTag`를 부를 경로부터 만들어야 합니다.

## 5. 범위 밖

`/profile`·`/quest/[questId]`도 getUser → 사용자 쿼리 2단계지만 데이터 모양이 달라(프로필: 스테이지별 리셋 목록, 퀘스트: `is_stage_unlocked` RPC) 공용 로더로 옮기지 않았습니다. 같은 방식(RLS에 맡겨 병렬)을 적용할 수는 있습니다.
