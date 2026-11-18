# P13-01 디자인 감사 기준선 (2026-11-18)

Phase 13(디자인 다듬기)의 출발점을 고정하는 문서입니다. 계획서 [§ Phase 13 감사 표](../4.upgrade-plan.md)의 S1~S12가 어디서 나왔는지, 무엇을 "쓰지 않는 패턴"으로 삼는지, 금색을 어디서 빼는지(P13-03 판정표)를 적습니다.

- 대상 커밋: `379bf96`(브랜치 `feat/design-polish`). 화면 기준은 태그 `v1.0.0`(`d457071`)
- 이 문서는 **기록만** 합니다. 코드·CSS는 바꾸지 않았습니다.
- 행 번호는 위 커밋 기준이라 뒤 작업이 진행되면 어긋납니다. 선택자 이름으로 찾으세요.

## 1. 전후 비교 기준: 태그 `v1.0.0`

기준 이미지를 `docs/design/img/`에 복사하지 않습니다(PNG 69장을 두 벌 두면 저장소가 커짐). **"이전" 화면은 git 태그 `v1.0.0`의 `e2e/visual/__screenshots__/`** 입니다.

확인한 것:

- `git ls-tree -r --name-only v1.0.0 -- e2e/visual/__screenshots__` → **69개**(23화면 × 360·768·1280)
- 태그와 지금 브랜치의 그 폴더는 트리 해시가 같습니다(`d1e590f4…`). 즉 P13 작업 전 기준 이미지 = `v1.0.0`.
- 태그는 원격에도 있습니다(`git ls-remote --tags origin v1.0.0`).

꺼내 보는 법:

```bash
# 한 장만
git show v1.0.0:e2e/visual/__screenshots__/worlds-1280.png > /tmp/worlds-1280-before.png

# 전부 (작업 폴더 밖에 v1.0.0 체크아웃, 다 보면 지움)
git worktree add ../pyroad-v1.0.0 v1.0.0
open ../pyroad-v1.0.0/e2e/visual/__screenshots__
git worktree remove ../pyroad-v1.0.0

# 바뀐 이미지 목록 (P13-19에서 기준 이미지를 갱신한 뒤)
git diff --stat v1.0.0 -- e2e/visual/__screenshots__
```

화면 23개: achievements, board, board-post, boss, celebration, gallery, landing, login, not-found, notice, notice-post, onboarding, profile, profile-treasure, quest-code, quest-quiz, settings, share, shop, stage-sheet, world-first, world-progress, worlds. 모두 **첫 화면(뷰포트)만** 찍습니다(1280×800 · 768 · 360×740, `profile-treasure`만 요소 캡처). 스크롤 아래 영역은 기준 이미지에 없습니다.

> 계획서 본문은 "19화면 × 3폭"이라 적었지만 실제 파일은 23화면 69장입니다(B128 추가분 포함).

## 2. 탐지기 재실행 결과

### 2-1. Impeccable 탐지기 (0.1.24)

```bash
DO_NOT_TRACK=1 .claude/skills/impeccable/scripts/impeccable detect src --json
```

총 **29건** (종료 코드 2). 계획서 수치와 같습니다.

| 규칙 | 등급 | 건수 | 대표 위치 |
|---|---|---|---|
| `side-tab` | warning | 2 | `src/components/world/book/worldBook.css:193` `.wb-book::before`(6px 세로 띠) · `src/components/world/stageSheet.css:148` `.ss-row[data-state='now']`(`inset 3px 0 0`) |
| `bounce-easing` | advisory | 27 | `quiz.css` 5(336·384·839·931·974) · `outputPanel.css` 2(351·409) · `stepStrip.css` 2(148·151) · 나머지 18개 파일 1건씩 |

`bounce-easing` 27건 전체(P13-16 판정 대상): `globals.css:306`(토큰 선언) · `lib/motion/tokens.ts:95`(토큰 원본) · `ui/__tests__/game-ui-css.test.ts:99`(테스트 문자열) · `gallery.css:385` · `fun.css:719` · `trial.css:109` · `worlds.css:718` · `celebration.css:663` · `outputPanel.css:351·409` · `questHints.css:83` · `questSuccess.css:168` · `questWorkspace.css:293` · `daily.css:201` · `quiz.css:336·384·839·931·974` · `stepStrip.css:148·151` · `testGuests.css:173` · `toast.css:89` · `attendance.css:224` · `dailyQuizCard.css:110` · `phoneQuiz.css:77` · `stageSheet.css:335`. 이 중 3건(토큰 선언 2 + 테스트 1)은 화면 규칙이 아니므로 실제 판정 대상은 24곳입니다.

**탐지기가 놓친 측면 띠 2곳**(grep `inset Npx 0 0`·`border-left: … solid var(--색)`으로 찾음, P13-07 규칙이 잡아야 함):

- `src/components/world/dailyQuizCard.css:12` `.dqc { border-left: 0.375rem solid var(--accent) }` — 오늘의 퀴즈 카드 왼쪽 금색 띠
- `src/components/quest/outputPanel.css:364` `.qo-compare { box-shadow: inset 0.25rem 0 0 var(--accent) }` — 결과 비교 패널 왼쪽 금색 선

같은 계열로 `src/components/world/attendance.css:12` `.at { border-top: 0.375rem solid var(--accent) }`(출석 카드 윗변 금색 띠)도 있습니다. 측면은 아니지만 "둥근 카드 한쪽 색 띠"라 같이 판단하세요.

### 2-2. Hallmark sloplint (정적)

```bash
node .claude/skills/hallmark/scripts/sloplint.mjs src --scope app --json
```

471개 파일, **FAIL 171 · REFLEX 19 · WARN 16** (종료 코드 1, 렌더 단계 꺼짐).

| 게이트 | 등급 | 건수 | 내용 | 대표 위치 | 판정 |
|---|---|---|---|---|---|
| 48 | FAIL | 89 | 토큰 블록 밖 색 리터럴 | `globals.css` 80(에디터 테마 4종 `night`·`ocean`·`candy`·`arcade` × 20, 355행~) · `social-login.css` 9(구글·카카오·네이버 브랜드 색) | 오탐(§5) |
| 20 | FAIL | 24 | Hallmark 서명 주석 없음 | CSS 파일마다 1건 | 오탐(Hallmark로 만든 페이지가 아님) |
| 63 | FAIL | 16 | 가운뎃점 메타 문자열 | `dev/design/_catalog/*` 14 · `MonitoringDashboard.tsx:116` · `button.test.tsx:156` | 운영 화면 0건(§5). S6은 grep으로 봄 |
| 33 | FAIL | 13 | `<svg>`에 `aria-hidden`·`aria-label` 없음 | `ui/reward-icon.tsx` 6(52·64·81·107·128·143) · `fun/scenes.tsx:68·105` · `pets.tsx:323` · `BossArena.tsx:205` · `MapArt.tsx:192` | P13 범위 밖(부모 요소가 `aria-hidden`을 주는지는 확인하지 않음) |
| 7b | REFLEX | 13 | 순백 `#fff` 면 | `globals.css` 12(63행~, `--surface` 등) · `game-ui.css` 1 | P13-17 |
| 54 | FAIL | 9 | 제목 앞 머리말 라벨 | 아래 목록 | **S2 / P13-08** |
| 54 | WARN | 2 | 제목 요소 없이 라벨이 제목 노릇 | `ShopScreen.tsx:518` · `DailyQuizCard.tsx:38` | P13-08 때 함께 |
| 39a | FAIL | 6 | 투명도만으로 비활성 표시 | `social-login.css:197·204·214`(실제로는 hover 규칙, 오탐) · `profile.css:595` · `makerHelper.css:120` · `parsons.css:168` | 범위 밖 |
| 24b | REFLEX | 5 | 4px 눈금 밖 간격 | `worldMap.css:530·532·592·609` · `codeEditor.css:9` | 범위 밖 |
| F2 | WARN | 4 | 세 점 말줄임표 | `settings/page.tsx:197` · `StageClearCard.tsx:70` · `LinkedAccountsSection.tsx:297` | P13-17 |
| 10a | FAIL | 3 | `transition-all`·너비 전환 | `settings/page.tsx:237` · `QuestCelebrations.tsx:249` · `stageProgress.css:74` | 범위 밖(참고) |
| 19 | FAIL | 3 | 문구 속 긴 줄표 | `StageSheet.tsx:378` · `LicensesView.tsx:74` · `MonitoringDashboard.tsx:406` | P13-12·17 때 함께 |
| 34 | FAIL | 3 | 가로 넘침 위험 | `app.css:1` · `codeEditor.css:45` · `continueCta.css:93` | 범위 밖 |
| 62 | FAIL | 3 | 스크립트가 켜야 보이는 요소 | `worlds.css:365` · `progress-bar.css:38` · `continueCta.css:58` | 범위 밖 |
| 28a | WARN | 3 | 첫 이미지 지연 로드 | `MyCreations.tsx:114` · `MyShareCards.tsx:152` | 범위 밖 |
| F3 | WARN | 2 | 제목에 `text-wrap: balance` 없음 | `globals.css:615` · `monitoring.css:44` | P13-17 |
| F7 | WARN | 2 | 같은 상자 꼴 반복 | `askPybaem.css:8·38` | 범위 밖 |
| 4 | FAIL | 1 | 카드 속 카드 | `SoundSettingsSection.tsx:257` | **S4 / P13-10** |
| 27 | FAIL | 1 | 동작 줄이기 대체 없음 | `(protected)/loading.tsx:8` `animate-pulse` | 범위 밖(참고) |
| 64·F1·F5·F16 | — | 각 1 | 카탈로그 mono 글자 · 곧은 따옴표 · `.g-icon-btn` 원형 · 선택 영역 색 | `TokenSections.tsx:344` · `AuthSections.tsx:322` · `game-ui.css:255` · `app.css:1` | 오탐·범위 밖(§5) |

게이트 54 FAIL 9건(머리말 라벨, S2의 근거):

| 파일:행 | 머리말 | 뒤따르는 제목 |
|---|---|---|
| `world/book/WorldShelf.tsx:28` | 모험 책장 | h1 |
| `world/book/WorldMapHead.tsx:40` | 그림책 N권 | h1 |
| `world/book/LockedBook.tsx:45` | 그림책 N권 · | h1 |
| `gallery/GalleryParts.tsx:95` | 메이커 박람회 | h1 |
| `consent/GuardianConsentFlow.tsx:123` | 보호자 동의 | h1 |
| `guardian-report/GuardianReportView.tsx:243` | 주간 학습 리포트 | h1 |
| `onboarding/RegistrationCard.tsx:112` | 파이썬 섬 모험단 | h2 |
| `share/ShareCardView.tsx:87` | 구경해 주세요! / 축하해 주세요! | h1 |
| `landing/hero/HeroSection.tsx:33` | 월드 1 · 파이썬 섬 | h1 |

sloplint가 못 잡은 같은 꼴(클래스 이름으로 확인): 출석 카드 `.at-k` "출석 도장"(`AttendanceCard.tsx:247`), 오늘의 퀴즈 `.dqc-k`·`.dq-k`, 축하 카드 `.cel-k`("레벨 업!"), 통과 카드 `.qx-k`, 갤러리 `.gl-kicker`, 랜딩 섹션 kicker(`LandingSection.tsx`). P13-08에서 "위치를 알려 주는가"로 하나씩 판정하세요.

### 2-3. grep 근거 (탐지기가 세지 않는 패턴)

| 패턴 | 명령(요지) | 지금 수치 | 계획서 | 비고 |
|---|---|---|---|---|
| S3 반짝이 | `grep -rnE "\bSparkles?\b" src --include="*.tsx"` | Lucide `Sparkles`/`Sparkle`를 쓰는 운영 컴포넌트 **18개 파일**(아래) + 직접 그린 `Sparkle` 2개 파일(`HeroArt.tsx` 3개 · `fun/scenes.tsx` 4개) | "8곳" | **계획서보다 많음** |
| S6 가운뎃점 | `grep -rn " · " src --include="*.tsx"` | **480줄**, 카탈로그·테스트를 빼면 **201줄**(주석 포함) | "277줄" | 세는 기준이 달라 수치가 다름. 운영 201줄이 P13-12 대상의 상한 |
| S9 점선 | `grep -rnE "dashed" src`(`outline` 제외) | CSS 테두리 **13개 파일 14곳** + Tailwind `border-dashed` 1곳(`GuardianReportView.tsx:142`) = **14개 파일 15곳**(카탈로그 1곳 따로) | "15파일 17곳" | 포커스 `outline` 점선 3곳은 뺌 |
| S10 유리 효과 | `grep -rn backdrop-filter src` | `landing.css:37` 1곳 | 같음 | |
| S10 그라데이션 | `grep -c "gradient(" …` | `worlds.css` 8 · `parents.css` 4 | 같음 | |
| `transition: all` | | `settings/page.tsx:241` 1곳 | 같음 | |

S3 Lucide 반짝이 사용 파일(18): `StageSheet.tsx`(220·266·377) · `StageChest.tsx`(123·124) · `GalleryParts.tsx`(30·96) · `OwnerPanel.tsx`(149) · `MotionSettingsSection.tsx`(269) · `profile/creations/page.tsx`(50) · `ParentsSection.tsx`(15) · `AchievementBook.tsx`(141·142) · `AchievementMedal.tsx`(아이콘 표) · `ShopScreen.tsx`(642·701) · `SaveCreation.tsx`(91) · `QuizTryRun.tsx`(76) · `QuizPanel.tsx`(182) · `MakerHelper.tsx`(103·115) · `MyCreations.tsx`(153) · `NicknameField.tsx`(151) · `OnboardingFlow.tsx`(528) · `MyShareCards.tsx`(39). 계획서가 꼽은 8곳 밖에 상점(전설 등급·미리 보기), 퀴즈 패널, 메이커 도우미, 닉네임 추천 버튼, 온보딩 "바뀐 점", 작품 저장, 자랑 카드가 더 있습니다. → P13-09 범위를 넓힐지 결정 필요(§7).

S9 점선 위치: `gallery.css:552` · `shop.css:673` · `attendance.css:86` · `worldMap.css:701` · `worldBook.css:416` · `phoneQuiz.css:13` · `skillCheck.css:12` · `worldHud.css:135·169` · `outputPanel.css:137` · `daily.css:81` · `parsons.css:149` · `makerHelper.css:17` · `onboarding.css:670` · `GuardianReportView.tsx:142`.

S8 금색 테두리(계획서의 9곳, 행 번호 확인함): `profile.css:131` `.pf-title` · `celebration.css:257` `.cel-titlecard` · `unlock.css:107` `.wu-banner` · `attendance.css:131` `.at-stamp` · `worldMap.css:730` `.wn-stamp` · `onboarding.css:1131` `.ob-legend-stamp` · `hero.css:449` `.hero-poke-hint` · `trial.css:237` `.ld-trial-line::after` · `trial.css:328` `.ld-trial-stamp`. 이 중 **도장 6곳**(`.pf-title`·`.cel-titlecard`·`.at-stamp`·`.wn-stamp`·`.ob-legend-stamp`·`.ld-trial-stamp`)은 뜻이 있는 테두리입니다. 여기에 "옅은 금색 면 + `inset 0 0 0 2px var(--accent)`" 꼴이 더 있습니다: `achievementBook.css:90`·`266`, `dailyMissions.css:15`·`89`, `stageChest.css:16`, `shop.css:643`, `worldHud.css:205`, `parsons.css:222`, `quiz.css:278`·`549`·`780`.

## 3. 화면별 근거 (기준 이미지)

1280 폭 이미지 12장을 직접 보고 적었습니다. 좌표는 1280×800 이미지의 대략적인 픽셀(x, y)입니다. **나머지 화면 11개와 360·768 폭은 이번에 열어 보지 않았습니다**(P13-19 눈 검수에서 봄).

| 파일 | 보이는 패턴 (위치) |
|---|---|
| `worlds-1280.png` | **S1** 책 카드 3장의 왼쪽 세로 띠(x≈145·483·820, y 266~796. 1권 초록, 2권 회청, 3권 베이지) · **S2** "모험 책장"(144, 162), 카드마다 "그림책 N권"(y≈503) · **S4+S9** 2·3권 카드 안 점선 "실력 확인 퀴즈" 상자(501~787 × 624~780, 839~1124 × 624~780) · **S5** 상태 칩 "모험 중"·"잠겨 있어요"(y≈566) · **S6** "스테이지 2/7 · 퀘스트 18/51"(164, 609) · **S7** "지도 펼치기 →"(164, 641), 메뉴 알림 점(1127, 16) · **S12** 2·3권 표지가 회색조, 금색 책갈피 "지금 읽는 책"(417~445 × 262~368), HUD 금색 테두리 "상점"(946~1024 × 10~54) |
| `world-progress-1280.png` | **S12** 금색 "지금 여기!" 깃발(499~578 × 464~488), 3번 노드의 금색 진행 호(538, 573 부근), 통과 도장 2개((389, 405)·(222, 512), 유지 대상) · **S7** "책장 전체 보기 ›"(1034~1133, 737) · **S1** 아래 다음 권 카드 왼쪽 띠(x≈145·648, y 773~) |
| `stage-sheet-1280.png` | **S1** "지금 차례" 줄 왼쪽 초록 선(x≈325, y 597~679) · **S4** 살구색 요약 패널(324~964 × 206~312) 바로 아래 그림자 달린 보물상자 카드(324~964 × 328~449), 모두 시트 안 · **S3** 반짝이 아이콘: "보너스 퀴즈 0/3" 앞(347, 286), 지금 줄 번호 원(354, 643) · **S5** 줄마다 칩 "코드"·"완료"(384~486, 569), "퀴즈 · 버그 찾기"·"지금 차례"(384~574, 668) · **S6** "3단계 · 지금 모험 중"(464, 90), "퀴즈 · 버그 찾기" |
| `achievements-1280.png` | **S4+S8** "받을 코인 170개" 금색 테두리 + 살구 면 패널(292~988 × 230~310), 흰 카드 안 · **S8** 받을 수 있는 업적 카드 4장(금색 테두리 + 살구 면, 예: 272~447 × 494~660) · **S9** 잠긴 메달 점선 원((734, 534)·(921, 534)·(547, 712)·(734, 712)) · **S3** 메달 옆 4각 별(388, 510 등 카드마다 2개) · **S5** 등급 칩 3개(292~564, 198) |
| `gallery-1280.png` | **S2+S3** "메이커 박람회" 머리말과 반짝이 아이콘(100~197, 139) · **S5** 머리 안내 칩 3개(100~638, 247) · **S4** 빈 상태 아이콘 상자(597~683 × 341~427, 테두리 + 면) · **S12** 살구색 머리 패널(80~1200 × 92~280) |
| `settings-1280.png` | **S3** "움직임" 제목 앞 반짝이(346, 160), 미리보기 속 4각 별 2개((480, 250)·(790, 236)) · **S4** 카드 안 라디오 카드 4장(336~944 × 380~682), 선택된 줄은 테두리 + 배경 둘 다(458~527) |
| `landing-1280.png` | **S10** 위치 알약 "월드 1 · 파이썬 섬"(96~243 × 243~273), 제목 "모험 지도" 아래 형광펜 밑줄(92~272 × 388~401) · **S3** 성 주변 4각 별 3개((724, 317)·(888, 296)·(946, 353)). 헤더 유리 효과는 스크롤 뒤에만 보여 이 이미지에는 없음 |
| `onboarding-1280.png` | **S2** 등록증 "파이썬 섬 모험단"(894~986, 237) · **S4** 카드 안 동의 줄 3개(184~704 × 364~532) · **S9** 도장 자리 점선 원(1062, 250, 유지 대상) · **S12** 단계 점 마지막 하나만 금색(700, 34) |
| `profile-1280.png` | **S7** "받을 코인" 앞 금색 점(775, 337) · **S8** 칭호 도장(352~467 × 146~208, 유지 대상) · 금색: 레벨 인장(312, 218), 업적 진행 막대(672~727, 369) — 보상 문맥 |
| `shop-1280.png` | 금색은 코인·"전설" 배지(667~721, 706)뿐. **S5** "아직 안 꾸몄어요"·"희귀" 칩. 큰 문제 없음 |
| `quest-quiz-1280.png` | **S3+S6** "보너스 퀴즈 · 버그 찾기"와 반짝이(672~820, 119) · **S7** "→ 2. 고칠 방법을 골라요"(898, 202) · **S12** 진행 점에서 지금 문제만 금색 막대(1020, 32) · 위치 경로 "1권 · 파이썬 마을 입구 · 퀘스트 1-4"(56, 119)는 **남길 것** |
| `celebration-1280.png` | 금색이 맞게 쓰인 기준 화면: 새 칭호 도장(629~754 × 416~481), 코인(598, 528), 통과 도장(1168, 603), 별 3개(y≈714). 머리말 "레벨 업!"(618~662, 346)은 P13-08에서 판정 |

## 4. 쓰지 않는 패턴 (S1~S10)

P13 이후 운영 화면에 두지 않는 것. P13-18에서 `components.md`로 옮깁니다.

| # | 쓰지 않는 것 | 대신 |
|---|---|---|
| S1 | 둥근 카드·줄의 한쪽 색 띠(`::before` 세로 띠, `inset ±Npx 0 0`, 굵은 색 `border-left/right`) | 그림·배경 면·번호 원 채움 |
| S2 | 제목이 이미 말한 것을 되풀이하는 머리말 라벨 | 제목 하나. 위치 경로(권·스테이지·퀘스트)와 책 카드의 권 표기만 남김 |
| S3 | 뜻 없는 반짝이 아이콘(Lucide `Sparkles`·`Sparkle`), 꾸밈용 4각 별 | 뜻에 맞는 아이콘. 그린 별은 보상 순간(축하·업적 획득)만 |
| S4 | 카드 속 카드(면 3겹) | 면 한 겹 + 여백·선 |
| S5 | 한 줄에 알약 칩 여러 개 | 칩은 상태 하나, 나머지는 아이콘 + 글자 |
| S6 | 가운뎃점으로 이은 메타 문자열 | 줄 나눔·문장. 위치 경로만 허용 |
| S7 | 글 링크 뒤 "→"·"›", 뜻 없는 색 점 | 이동 버튼에만 화살표, 상태를 뜻하는 점은 `aria` 문구와 함께 |
| S8 | 옅은 면 + 같은 색 테두리로 두 번 강조 | 테두리나 면 하나만 |
| S9 | "비어 있음"을 뜻하는 기본값 점선 | 옅은 면. 뜻이 있는 점선만 남김 |
| S10 | 랜딩 헤더 유리 효과, 제목 형광펜 밑줄, 위치 알약 kicker, 그림이 아닌 장식 그라데이션 | 불투명 면 + 아래 선, 단색 |

S11(튀는 easing)·S12(색)는 "금지"가 아니라 **쓰는 곳을 좁히는** 항목입니다: 튀는 easing은 캐릭터·보상·도장에만(P13-16), 금색은 보상에만(§6).

## 5. 예외 (오탐·범위 밖)

- **sloplint 48(색 리터럴) 89건**: `globals.css`의 에디터 테마 블록 4종(`[data-editor-theme='night'|'ocean'|'candy'|'arcade']` 각 20건)은 토큰 선언부라 정상. `social-login.css` 9건은 구글·카카오·네이버 브랜드 지정색(`tokens.md` §6 예외). 계획서는 "대부분 arcade"라 적었지만 실제로는 네 테마가 같은 수입니다.
- **sloplint 63(가운뎃점) 16건**: 14건이 `/dev/design` 카탈로그 설명문(운영 404), 1건 관리자 화면, 1건 테스트. 정리 대상 아님.
- **sloplint 20(서명 주석) 24건**: Hallmark가 만든 페이지에만 해당.
- **`parsons.css:149` 점선 왼쪽 선**: 코드 들여쓰기 안내선. 유지(P13-07 예외 목록에).
- **뜻이 있는 점선(유지 후보)**: 도장 찍을 자리(`attendance.css:86`, `onboarding.css:670`), 드롭·빈칸 자리(`daily.css:81`, 포커스 `outline` 3곳), 영수증 선(`shop.css:673`, `outputPanel.css:137`, `gallery.css:552`는 P13-14에서 판정).
- **`.g-icon-btn` 원형(F5)**: 버튼이라 유지.
- **HUD 알약**: 게임 UI 정체성이라 유지(P13-11).
- **도장 테두리**: 칭호·통과·출석 도장의 금색 테두리는 유지 판정 대상(P13-13).
- **bounce-easing 3건**: 토큰 선언 2 + 테스트 문자열 1.
- **다크 모드**: 계속 범위 밖(P2-09).
- **운영에 안 나오는 화면**: `/dev/*` 카탈로그, 관리자 `/admin`(monitoring)은 낮은 우선.

## 6. 금색 판정표 (P13-03용)

원칙: **금색 = 보상(별·코인·도장·받기 버튼)만.** 판정은 셋입니다.

- **유지**: 보상 그 자체이거나 보상 순간의 연출
- **옮김**: 보상이 아님 → 초록(`--primary*`, "지금 여기"·선택) 또는 중립(`--surface-2`·`--line`·`--text-muted`, 패널·테두리·안내)
- **그림**: 일러스트 칠(지붕·해·깃발). 역할 색이 아니므로 그대로 두고 P13-04에서 새 색과 어울리는지만 봄

△는 원칙만으로 갈리지 않아 사용자 확인이 필요한 곳입니다(§7).

세는 기준: `--accent`·`--accent-lip`·`--accent-light`·`--accent-text`·`--accent-soft`와 짝인 `--on-accent`가 나오는 줄. 계획서 수치(quiz 22 등)는 `--on-accent` 줄을 빼고 센 것이라 1~2줄씩 적습니다.

### 6-1. 상위 8개 파일 (선택자 단위)

요약: **134줄 가운데 유지 69 · 그림 5 · 옮김 60**(선택자 묶음으로 옮김 29개).

| 파일 | 줄 | 유지 | 그림 | 옮김 |
|---|---|---|---|---|
| `quest/quiz/quiz.css` | 24 | 4 | 0 | 20 |
| `quest/celebrations/celebration.css` | 23 | 23 | 0 | 0 |
| `onboarding/onboarding.css` | 22 | 8 | 0 | 14 |
| `world/map/worldMap.css` | 17 | 6 | 5 | 6 |
| `world/attendance.css` | 13 | 7 | 0 | 6 |
| `shop/shop.css` | 13 | 8 | 0 | 5 |
| `profile/profile.css` | 12 | 11 | 0 | 1 |
| `world/stageSheet.css` | 10 | 2 | 0 | 8 |

**`quiz.css`**

| 선택자 (행) | 무엇 | 보상? | 판정 |
|---|---|---|---|
| `.qz-chip[data-tone='review']` (81·82) | "복습" 칩 | 아니오 | 옮김 → 중립 |
| `.qz-opt[data-mark='wrong']`, `.qz-opt-mark`, `.qz-opt-tag` (278~290) | 틀린 보기 표시(면 + 2px 테두리 + 아랫면) | 아니오 | 옮김 △D1 |
| `.qz-try-dare`, `> svg` (393·404) | "직접 돌려 볼까요?" 권유 패널 | 아니오 | 옮김 → 중립 면 |
| `.qz-fb-slot[data-mark='wrong']`, `> svg` (549~554) | 틀린 빈칸 | 아니오 | 옮김 △D1 |
| `.qz-bh-line[data-mark='wrong']`, `.qz-bh-mark`, `.qz-bh-tag` (780~790) | 버그 찾기 틀린 줄 | 아니오 | 옮김 △D1 |
| `.qz-combo`, `> svg` (950~960) | 연속 정답 배지(불꽃) | 보상 연출 | 유지 △D3 |
| `.qz-diff` (1000·1001) | 고친 줄의 바뀐 글자 밑줄 | 아니오 | 옮김 → 초록 밑줄 |

**`celebration.css`** — 전부 유지

| 선택자 (행) | 무엇 | 판정 |
|---|---|---|
| `.cel-k[data-gold]` (45) | 보상 카드 머리 글자 | 유지(글자 자체는 P13-08 판정) |
| `.cel-stamp` (191·193), `.cel-card .ob-splat` (203) | 통과 도장·잉크 | 유지 |
| `.cel-ring` (241), `.cel-seal-wrap[data-big] .cel-seal` (274~278) | 레벨 인장·고리 | 유지 |
| `.cel-titlecard` (257·259), `[data-big]` (282·283) | 칭호 도장 | 유지(테두리 + 면 중복은 P13-13) |
| `.cel-medal` (309·310) | 메달 기본 색 | 유지 |
| `.cel-chest-body`·`-band`·`-inner` (411~417) | 보물상자 그림 | 유지 |
| `.cel-buy`, `[data-rarity]`, `.cel-buy-spark` (429~482) | 구매 축하 빛·반짝 | 유지 |
| `.cel-buy-left` (511·512) | 남은 코인 | 유지 |

**`onboarding.css`**

| 선택자 (행) | 무엇 | 보상? | 판정 |
|---|---|---|---|
| `.ob-dot[data-gold]` (73·76) | 단계 점 중 마지막 점 | 아니오(진행 표시) | 옮김 △ → 다른 점과 같게 |
| `.ob-news`, `.ob-news-icon` (207·217) | 기존 사용자 "바뀐 점" 안내 면 | 아니오 | 옮김 → 중립 면 |
| `.ob-age-result[data-band='under14']` (485·486) | 나이 확인 결과 안내 | 아니오 | 옮김 △D2 |
| `.ob-restricted-note`, `> svg` (497·507) | 보호자 동의 전 안내 | 아니오 | 옮김 △D2 |
| `.ob-stamp[data-stamped]` (683~685), `.ob-stamp-star` (690·691), `.ob-splat` (710) | 등록증 도장 | 예 | 유지 |
| `.ob-node[data-state='now']` (849~851), `.ob-node-ring` (864) | 튜토리얼 지도의 "지금 여기" 노드 | 아니오 | 옮김 → 초록 |
| `.ob-chip[data-kind='hint'] > svg` (1039·1040) | 힌트 전구 아이콘 | 아니오 | 옮김 △ → 중립 |
| `.ob-legend-stamp` (1131·1133) | 범례의 도장 견본 | 예 | 유지 |

**`worldMap.css`**

| 선택자 (행) | 무엇 | 보상? | 판정 |
|---|---|---|---|
| `.wm-art .wm-mark` (296), `.wm-brass` (316), `.wm-roof` (325), `.wm-gold` (328), `.wm-sail` (331) | 지도 일러스트 칠 | — | 그림 |
| `.wn-crown` (566·662) | 마지막 스테이지 왕관 | 보상 상징 | 유지 △D3 |
| `.wn[data-perfect] .wn-meta` (618), `.wn-perfect` (624) | 별 100% 표시 | 예(별) | 유지 |
| `.wn-prog-bar` (645) | 지금 스테이지 진행 고리 | 아니오 | 옮김 → 밝은 초록·흰색(초록 알약 위 대비 확인) |
| `.wn[data-boss] .wn-no` (666·667), `.wn-plate` (671) | 보스 스테이지 번호·테두리 | 아니오 | 옮김 △D3 |
| `.wn-stamp` (730·733) | 통과 도장 | 예 | 유지 |
| `.wn-here-flag` (761·762) | "지금 여기!" 깃발 | 아니오 | 옮김 → 초록 |

**`attendance.css`**

| 선택자 (행) | 무엇 | 보상? | 판정 |
|---|---|---|---|
| `.at` (12) | 카드 윗변 금색 띠 0.375rem | 아니오 | 옮김(없앰, S1 계열) |
| `.at-k` (34) | 머리말 "출석 도장" | 아니오 | 옮김(P13-08과 함께) |
| `.at-saved` (58·59) | "방패가 불꽃을 지켜 줬어요" 안내 | 아니오 | 옮김 △ → 중립 |
| `.at-cell[data-state='next']` (85·87) | 다음에 찍을 칸(점선 + 금색) | 아니오("지금 여기") | 옮김 → 초록·중립. 점선은 도장 자리라 유지 후보 |
| `.at-cell[data-chest]` (94) | 상자 받는 날 칸 | 예 | 유지 |
| `.at-coins` (107) | 코인 수치 | 예 | 유지 |
| `.at-stamp` (131~134), `.at-cell .ob-splat` (178) | 출석 도장 | 예 | 유지 |
| `.at-chest-mark` (156) | 상자 표식 | 예 | 유지 |

**`shop.css`**

| 선택자 (행) | 무엇 | 보상? | 판정 |
|---|---|---|---|
| `.shop-try` (192·193) | "미리 보기" 배지 | 아니오 | 옮김 → 중립 |
| `[data-rarity='epic']` 변수 (300·301), `.shop-rarity[data-rarity='epic']` (421·422) | "전설" 등급 색 | 등급 표시 | 유지 △D3 |
| `.shop-confirm` (643·644) | "정말 살까요?" 패널(면 + 테두리, S8) | 아니오 | 옮김 → 중립 면 |
| `.shop-bill-left` (673) | 영수증 금색 점선 | 아니오 | 옮김 → 중립 선 |
| `.shop-bill-left dt`·`dd b` (676·680) | 남는 코인 수치 | 예 | 유지 |
| `.shop-short-t > svg`·`b` (705·708) | 모자란 코인 수치 | 예 | 유지 |

**`profile.css`**

| 선택자 (행) | 무엇 | 보상? | 판정 |
|---|---|---|---|
| `.pf-seal[data-big]` (106~110) | 레벨 인장 | 예(도장) | 유지 |
| `.pf-title` (131·133), `[data-big]` (147·148) | 칭호 도장 | 예 | 유지(P13-13에서 테두리·면 중 하나) |
| `.pf-tile[data-tone='reward'] .pf-tile-ic` (208) | 보상 타일 아이콘 | 예 | 유지 |
| `.pf-pill` (252·253) | "이번 주 +N" 코인 | 예 | 유지 |
| `.pf-day[data-shield]` (450) | 달력의 방패 쓴 날 테두리 | 아니오 | 옮김 △ → 중립 |
| `.pf-day-stamp` (475) | 달력 도장 점 | 예 | 유지 |

**`stageSheet.css`**

| 선택자 (행) | 무엇 | 보상? | 판정 |
|---|---|---|---|
| `.ss-sum` (66) | 살구색 요약 패널(넓은 면) | 아니오 | 옮김 → 중립 면(P13-10과 함께) |
| `.ss-perfect` (85·86) | "별을 모두 모았어요" 배지 | 예(별) | 유지 |
| `.ss-sum-quiz` (103) | "보너스 퀴즈 N/M" 글자 | 아니오 | 옮김 → 중립 글자 |
| `.ss-row[data-kind='boss'] .ss-no` (171) | 보스 줄 번호 고리 | 아니오 | 옮김 △D3 |
| `.ss-tag[data-kind='boss']` (212·213) | 보스 칩 | 아니오 | 옮김 △D3 |
| `.ss-tag[data-review]` (237·238) | 복습 칩 | 아니오 | 옮김 → 중립 |
| `.ss-bonus svg` (253) | "퀴즈는 보너스예요" 반짝이 | 아니오 | 옮김(P13-09 아이콘 교체와 함께) |

### 6-2. 나머지 CSS (파일 단위)

| 파일 (줄) | 무엇 | 판정 |
|---|---|---|
| `app/globals.css`, `lib/design/tokens.ts` | 토큰 선언 | 대상 아님(P13-02) |
| `ui/game-ui.css` (4) | `.g-btn[data-variant='reward']` 받기 버튼 | 유지 |
| `ui/progress-bar.css` (1) | 보상 진행 막대 | 유지 |
| `ui/hud.css` (1) | `.g-chip[data-flash]` 수치가 오를 때 반짝 | 유지 |
| `shared/achievementMedal.css` (9) | 금·동 메달 색, "받을 코인" 표시 | 유지 |
| `achievements/achievementBook.css` (6) | 받을 코인 패널, 받을 수 있는 카드, 반짝 | 유지(면 + 테두리 중복은 P13-10·13) |
| `world/stageChest.css` (6) | 보물상자 | 유지(준비 상태의 면 + 테두리는 P13-13) |
| `world/dailyMissions.css` (10) | 받을 수 있는 미션, 보상 알약, 알림 점 | 유지. `.dm-level i[data-on]`(156)만 △ |
| `world/unlock/unlock.css` (6) | 새 책이 열리는 연출 | 유지(보상 순간). `.wu-banner` 테두리는 P13-13 |
| `quest/questSuccess.css` (7) | 통과 도장·잉크, 통과 카드 머리, 새 기록 | 유지 |
| `quest/questHints.css` (4), `quest/askPybaem.css` (2) | 황금 열쇠 버튼·개수 | 유지 △D3 |
| `quest/boss/boss.css` (6) | 이긴 순간의 하늘·터짐·점수·결과 카드 | 유지. `.bb-hp-lag`(132)는 옮김 → 중립 |
| `profile/avatarFrame.css` (4) | 별 테두리 아이템 그림 | 그림 |
| `landing/sections/friends.css` (2), `landing/hero/hero-ambient.css` (2) | 터지는 조각 | 그림 |
| `world/book/worldBook.css` (9) | 표지 그림 5줄 = 그림 · `.wb-status[data-fresh]`(252·253) 옮김 → 초록 · `.wb-mark` 책갈피(288·289) | 섞임. 책갈피는 △D4 |
| `landing/hero/hero.css` (9) | 그림 6줄 = 그림 · `.hero` 배경 그라데이션(23) 옮김(P13-15) · `.hero-poke-hint` 테두리(449) 옮김 | 섞임 |
| `landing/sections/worlds.css` (6) | 그림 2줄 · "곧 열려요" 칩·잠금 안내 4줄 옮김 → 중립 | 섞임 |
| `landing/sections/fun.css` (7) | 코인 장면·레벨업·별 = 유지/그림 · `.ld-fun-soon`(115) 옮김 · `.ld-fun-impact` 테두리(371) △ | 섞임 |
| `landing/sections/trial.css` (5) | `.ld-trial-stamp` 도장 유지 · `.ld-trial-cta` 면(94)·`.ld-trial-line::after` 테두리(237) 옮김 · 점(407) △ | 섞임 |
| `landing/landing.css` (2) | 로고 표식 = 그림 · `.ld-ink-mark::after` 형광펜 밑줄(201) 옮김(P13-15) | 섞임 |
| `world/worldHud.css` (7) | 불꽃 2줄 유지 △D3 · `.wh-soon-k`(140) 옮김 · `.wh-shop` 상점 알약 4줄(205~220) 옮김 △ → 중립 | 섞임 |
| `gallery/gallery.css` (9) | 스티커 색 2줄 = 그림 · 깃발 장식(29)·`.gl-wall` 아랫면(131) △ · `.gl-kicker`·`.gl-rules svg`·`.gl-paper-icon`·`.gl-empty-easel` 옮김 → 중립 | 옮김 위주 |
| `quest/quiz/daily.css` (2) | `.dq-k` 머리말 옮김 · `.dq-sum-flame` 불꽃 유지 | 섞임 |
| `world/dailyQuizCard.css` (4) | 왼쪽 금색 띠(12, S1)·배지·머리말 | 옮김 |
| `quest/outputPanel.css` (5) | 결과가 다를 때의 면·칩·표시, `.qo-compare` 왼쪽 금색 선(364, S1) | 옮김 △D1 |
| `quest/quiz/parsons.css` (3) | 틀린 줄 상자·안내 | 옮김 △D1 |
| `quest/testGuests.css` (5) | 결과 다름 카드·칩 △D1 · 얼굴·말풍선 면(77·157) → 중립 | 옮김 |
| `quest/questWorkspace.css` (1) | 결과 탭의 "틀림" 점(S7) | 옮김 △D1 |
| `quest/stageProgress.css` (2) | 진행 점의 "지금 문제" | 옮김 → 초록 |
| `quest/saveCreation.css` (3) | 작품 저장 안내 줄 | 옮김 → 중립 |
| `quest/makerHelper.css` (1) | 도우미 아이콘 | 옮김 → 중립 |
| `consent/consent.css` (9) | 보호자 동의 경고 띠·안내·상태 아이콘 | 옮김 △D2 |
| `auth/social-login.css` (2) | "최근 사용" 배지 | 옮김 → 초록 |
| `landing/sections/parents.css` (2) | "준비 중" 칩 | 옮김 → 중립 |
| `world/retroWelcome.css` (2) | 돌아온 사용자 환영 통계 칩 | 옮김 △(보상 수치면 유지) |
| `world/skillCheck/skillCheck.css` (1) | 연습 안내 글자 | 옮김 → 중립 |
| `rest/restReminder.css` (2) | 쉬는 시간 안내 | 옮김 → 중립 |
| `monitoring/monitoring.css` (2) | 관리자 경고 아이콘 | 옮김 △D2(관리자 화면, 낮은 우선) |
| `app/app.css` (1) | `stage-shimmer` 장식 빛 | △(쓰임 확인 뒤 판정) |

파일 수: **유지 12 · 그림 3 · 섞임 9 · 옮김 15 · 미정 1**(토큰 선언 2개 제외, 모두 40개).

### 6-3. TSX의 Tailwind 금색 클래스

| 파일 | 클래스 | 판정 |
|---|---|---|
| `ui/reward-icon.tsx` (18) | `fill-accent*`·`stroke-accent*` | 유지(보상 아이콘 그림) |
| `quest/boss/BossArena.tsx` (2) | `fill-accent`·`stroke-accent-lip` | 그림 |
| `settings/page.tsx`, `MotionSettingsSection`, `SoundSettingsSection`, `LinkedAccountsSection`, `InstallAppSection` (각 1) | `text-accent-foreground` | 옮김 → `text-foreground`. 이 값은 금색이 아니라 금색 위 글자색(`--on-accent`)이라 화면 변화는 거의 없음 |
| `auth/LoginErrorPanel`, `SocialLoginButtons`, `LoginSheet` (5) | `bg-accent-soft`·`text-accent-text` | 옮김 △D2 |
| `board/BoardFormMessage` (3), `world/ApiKeyAlert` (1) | `bg-accent/15`·`border-accent` | 옮김 △D2 |
| `board/BoardCard`, `PostDetail`, `notice/NoticeCard`, `NoticeDetail` (각 1) | `bg-accent`·`bg-accent/50` 배지 | 옮김 → 중립 |
| `pwa/IosInstallGuide` (9) | `ring-accent`·`bg-accent-soft` 등 | 옮김 → 초록(눌러야 할 곳 표시) |
| `share/ShareCardView` (2) | 머리말 배지 | 옮김(P13-08과 함께) |
| `creations/MyCreations` (2), `profile/ProfileSections` (1), `quest/QuestHints` (1), `guardian-report/GuardianReportView` (2) | `text-accent-text`·`bg-accent*` | △(쓰임을 보고 판정: 코인·열쇠 수치면 유지) |

### 6-4. 옮김 요약

- 상위 8개 파일: **옮김 60줄(선택자 묶음 29개)**, 유지 69줄, 그림 5줄
  - 그중 "틀림 표시" 14줄(quiz.css)은 D1 결정에 달림
- 나머지 CSS 40개 파일: 옮김 15 · 섞임 9(안에 옮김 선택자 약 20개) · 유지 12 · 그림 3 · 미정 1
- TSX: 옮김 6묶음(29곳) · 유지·그림 2묶음 · 미정 4개 파일(6곳)
- `celebration.css`는 옮길 것이 없습니다(전부 보상). `profile.css`는 1줄뿐입니다.

## 7. 결정이 필요한 것

원칙("금색 = 별·코인·도장·받기 버튼")만으로 갈리지 않는 곳입니다. P13-02·03을 시작하기 전에 정하세요.

- **D1. "틀렸어요·달라요" 표시의 금색** — `quiz.css` 틀린 보기·빈칸·줄(14줄), `parsons.css`, `outputPanel.css` 결과 다름, `testGuests.css`, 결과 탭 점. 빨강 대신 금색을 써서 "틀려도 괜찮아"를 전하던 자리입니다. 원칙대로면 옮겨야 하는데 받을 색이 없습니다: 빨강(`--error`)은 아이에게 세고, 초록은 정답과 겹치고, 중립은 피드백이 약합니다. 고를 것: (a) 금색을 "보상 + 다시 해 보기" 두 역할로 인정하고 유지 (b) 주의 색 토큰을 새로 둠(P13-02) (c) 중립 면 + 아이콘·글자로만. `tokens.ts` 대비 쌍(`codeText`/`accentSoft` "퀴즈 틀린 빈칸·줄 코드")도 따라 바뀝니다.
- **D2. "주의·안내" 띠의 금색** — 보호자 동의 경고(`consent.css`), 로그인 오류, API 키 알림, 게시판 안내, 온보딩 제한 안내. D1과 같은 문제(주의 색이 따로 없음).
- **D3. 보상 "계열"의 범위** — 원칙의 네 가지에 글자 그대로는 없지만 보상으로 읽히는 것: 스트릭 불꽃·연속 정답 배지, 황금 열쇠, 상점 "전설" 등급, 메달, 왕관. 이 문서는 **유지**로 적었습니다. 반대로 보스 스테이지 표시(지도 번호·시트 칩)는 **옮김**으로 적었습니다.
- **D4. "지금 읽는 책" 책갈피(`.wb-mark`)** — P13-05가 "책갈피는 유지"라 했는데 색은 "지금 여기"를 뜻하는 금색입니다. 모양만 남기고 초록으로 옮길지, 금색까지 남길지.
- **S3 범위** — Lucide 반짝이가 계획서의 8곳이 아니라 18개 파일에 있습니다(§2-3). P13-09에서 전부 다룰지, 상점 "전설"·황금 열쇠처럼 보상 문맥은 남길지.

### 사용자 결정 (2026-11-18)

- **D1·D2 = 주의 색 토큰 신설.** 금색과 구분되는 순한 주황 `--caution` `#EE7F4A`(장식) · `--caution-text` `#9C4A1A` · `--caution-soft` `#FFE8D6`을 P13-02에서 정의했습니다([tokens.md](tokens.md) §1, 대비 쌍 8개). "틀렸어요·달라요" 피드백과 주의·안내 띠의 금색은 P13-03에서 이 토큰으로 옮깁니다(§6의 △D1·△D2 = 옮김 → 주의 색). `codeText`/`accentSoft` "퀴즈 틀린 빈칸·줄 코드" 대비 쌍은 컴포넌트를 옮길 때 지웁니다.
- **D3 = 이 문서 판정 그대로.** 스트릭 불꽃·연속 정답 배지·황금 열쇠·상점 "전설" 등급·메달·왕관은 금색 유지, 보스 스테이지 표시(지도 번호·시트 칩)는 옮김.
- **D4 = 책갈피 모양은 유지, 색은 초록.**
- **S3 = 반짝이 18개 파일 전부 교체**(보상 문맥도 남기지 않음, P13-09).
