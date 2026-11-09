# P5-14 월드맵 저사양·반응형 검수

> - 작성일: 2026-11-09 · 브랜치 `feat/phase5` · 대상 = P5-01~13 반영 + 이 작업
> - 관련: [계획서](../4.upgrade-plan.md) §2.10 · P5-14 · 기준선 [P0-13](../spikes/P0-13-perf-baseline.md)(v0.3) · 저사양 감지 [P0-16](../spikes/P0-16-low-spec.md) · 앞 측정 [P4-12](P4-12-landing.md)
> - 측정 스크립트: [`scripts/perf/world-map-bench.ts`](../../scripts/perf/world-map-bench.ts) (`npm run perf:world`), 판정 [`worldMapBudget.ts`](../../scripts/perf/worldMapBudget.ts)(단위 테스트 있음)
> - 회귀 e2e: [`e2e/world-responsive.spec.ts`](../../e2e/world-responsive.spec.ts)

## 1. 결론

§2.10 월드맵 예산을 큰 여유로 지킵니다. CPU 4배 태블릿에서 가만히 있을 때 메인 스레드는 **83% → 1.1%**(full), 스크롤 rAF p95 **17.5ms**(예산 33ms), 컴포지터 **60fps**(예산 50fps)입니다. CPU 6배에서도 같습니다. 자동 연출 단계는 기기 신호대로 내려가고(2GB·2코어 → lite, 1GB → minimal), minimal·동작 줄이기에서는 앰비언트·패럴랙스가 0입니다.

| 예산 (§2.10) | P0-13 기준선 (v0.3) | P5-14 | 예산 |
|---|---|---|---|
| CPU 4배 대기 메인 스레드 (full) | **83%** (동작 줄이기 27%) | **1.1%** (lite 0.7 · minimal 0.2 · 동작 줄이기 0.2) | 50% 이하 |
| CPU 4배 스크롤 rAF p95 (full · lite) | 측정 16.7ms (스크롤 없는 짧은 지도) | **17.5 · 17.5ms** | 33ms 이하 |
| CPU 4배 스크롤 컴포지터 (full · lite) | — | **60 · 60fps** (낸 프레임 비율, 버린 프레임 0% · 0%) | 50fps 이상 |
| CPU 6배 스크롤 (full · lite) | — | rAF p95 17.6 · 17.6ms, 컴포지터 59.8 · 60fps | (참고) |

실기기(중급 안드로이드 태블릿) 50fps는 P12-04에서 확인합니다. 지금은 P0-13 하네스 게이트(CPU 4배 컴포지터 50fps 이상·rAF p95 33ms 이하)를 통과한 상태입니다.

## 2. 방법

장비: Apple Silicon Mac(macOS 26), Playwright Chromium 헤드리스, 로컬 Supabase, 1분 부하 1.4~2. 앱은 e2e와 같은 env로 만든 프로덕션 빌드(`next start`).

`npm run perf:world`(옵션 `--build` · `--base <주소>` · `--runs 3` · `--out build/perf/world-map.json`)가 하는 일:

1. 로컬 Supabase에 측정용 사용자를 만들고(온보딩 끝, 1단계 둘째 퀘스트까지 완료 = 지도 위 진행·지금 위치가 있는 보통 화면) 첫 방문으로 잠금 해제 본 기록을 남김(측정 중 연출이 끼지 않게). 끝나면 사용자를 지움
2. 기기: P0-13과 같은 태블릿 820×1180 DPR 2 터치, 안드로이드 UA, 매 회 새 컨텍스트, CPU는 CDP `Emulation.setCPUThrottlingRate`. 단계는 사용자 설정(`users.settings.motion`)으로 고정
3. **대기**: 로드 3초 뒤 5초 동안 CDP `TaskDuration` 증가 ÷ 시간 = 메인 스레드 바쁨, rAF 간격
4. **스크롤**: 터치 스와이프(`Input.synthesizeScrollGesture`, 800px/s) 아래·위 2번(지도 1,091px). rAF 간격 p95 + Chrome trace `PipelineReporter`로 컴포지터가 낸·버린 프레임. 컴포지터 fps = 60 × 낸 ÷ (낸 + 버린). 스와이프 사이 쉬는 동안은 새 프레임이 필요 없어 집계되지 않으므로, P0-13식 "낸 프레임 ÷ 전체 시간"(`presentedPerSec`, 48~51)보다 끊김을 정확히 봅니다
5. **자동 단계**: 단계 `auto`에서 CPU 1·4·6배 × 기기 신호(P0-16 `validate.mjs`와 같은 프로필: pc 그대로 · 크롬북 2코어 4GB · 약한 기기 2코어 2GB · 1GB) — `navigator.hardwareConcurrency`·`deviceMemory` 덮어쓰기, 10초 뒤 `<html data-motion>`이 정적 추정(`staticGuess`) 이하인지(실측은 내리기만 함)
6. **멈춤 확인**: full(대조군)·minimal·동작 줄이기에서 스크롤 뒤 `getAnimations()` 중 앰비언트(`wm-*`) 수, `.wm-par` 레이어 transform 변화 수
7. 예산·기대 밖이면 종료 코드 1

## 3. 결과 (3회 중앙값)

앞서 같은 빌드로 한 번 더 돌린 회차(부하 2~3)도 대기 full 1.2%·스크롤 rAF p95 17.5ms·컴포지터 59.7fps로 거의 같았습니다.

### 대기 (CPU 4배)

| 단계 | 메인 스레드 | 3회 | rAF fps · p95 |
|---|---|---|---|
| full | 1.1% | 1.2 · 1.1 · 1.0 | 60 · 17.5ms |
| lite | 0.7% | 0.7 · 0.9 · 0.6 | 60 · 17.5ms |
| minimal | 0.2% | 0.2 · 0.2 · 0.2 | 60 · 17.5ms |
| 동작 줄이기 | 0.2% | 0.2 · 0.2 · 0.3 | 59.8 · 17.5ms |

v0.3의 83%는 거의 전부 JS·SVG 속성으로 돌던 무한 반복(Framer `repeat: Infinity`, SMIL `<animate>`)이었습니다(P0-13). 지금 반복 연출은 모두 CSS transform·opacity라 컴포지터가 처리합니다. 코드 확인: `src/`에 `repeat: Infinity`·`<animate`·`<animateTransform`·`<animateMotion`·`repeatCount` 없음(주석만), `public/` SVG에도 SMIL 없음.

### 스크롤

| CPU | 단계 | rAF p95 | rAF fps | 컴포지터 fps | 버린 프레임 |
|---|---|---|---|---|---|
| 4배 | full | 17.5ms | 59.9 | 60 | 0% |
| 4배 | lite | 17.5ms | 60 | 60 | 0% |
| 4배 | minimal | 17.6ms | 60 | 60 | 0% |
| 6배 | full | 17.6ms | 59.7 | 59.8 | 0.3% |
| 6배 | lite | 17.6ms | 60 | 60 | 0% |
| 6배 | minimal | 17.6ms | 60 | 60 | 0% |

### 자동 단계 (CPU 1·4·6배 모두 같음)

| 기기 신호 | 정적 추정 | 10초 뒤 |
|---|---|---|
| 그대로 (헤드리스 Mac) | full | full |
| 2코어 · 4GB (크롬북) | lite | lite |
| 2코어 · 2GB | lite | lite |
| 4코어 · 1GB | minimal | minimal |

CPU 6배에서도 지도가 60fps를 유지해 실측 하향(`FrameSampler`)은 일어나지 않았습니다 — 지도가 가벼워서 내릴 이유가 없는 것이 맞는 결과입니다. 하향 경로 자체는 P0-16 단위 테스트(`src/lib/motion/__tests__/`)가 봅니다.

### 앰비언트·패럴랙스 멈춤

| 단계 (CPU 4배, 700px 스크롤 뒤) | 돌고 있는 앰비언트 | 움직인 패럴랙스 레이어 |
|---|---|---|
| full (대조군 — 검사가 살아 있는지) | 11 | 3 |
| minimal | **0** | **0** |
| 동작 줄이기 | **0** | **0** |

lite도 앰비언트·패럴랙스 0입니다(e2e `motion-tiers.spec.ts`가 lite부터 앰비언트 0을 검사).

탭 숨김 시 앰비언트 멈춤(P5-09 `data-amb-off`)은 e2e `world-responsive.spec.ts`가 `visibilitychange`로 확인합니다(숨기면 돌던 `wm-*` 0개 → 돌아오면 다시 돔).

## 4. 반응형·접근성 전수 검수

320·360·390·768·1024·1280·1440 × full·lite·minimal·동작 줄이기, 화면: `/world`(지도 위→아래 390px씩 + 떠 있는 이어하기), 스테이지 시트, HUD 메뉴 시트, `/worlds`, 잠긴 월드 `/world/code-sea`, 잠금 해제 연출(390·1280, 도중·끝). 검사 스크립트는 일회용(Playwright + axe-core 4.x 주입), 다시 깨지기 쉬운 것만 e2e로 남김.

| 항목 | 결과 |
|---|---|
| 가로 스크롤 | 0 (모든 폭·화면) |
| 겹침 (이름표·"잠김"·지금 위치 깃발·떠 있는 버튼·토스트·HUD) | **고침 1건** 뒤 0 — 아래. HUD·떠 있는 버튼 아래로 지도가 지나가는 것은 설계(위에 뜸) |
| 잘림 (화면·지도 밖 글자, 넘친 제목) | 0. 320px HUD 닉네임은 말줄임(…)으로 1~2글자만 보임(설계, 이름은 링크 이름으로 읽힘) |
| 14px 미만 글자 | 0 (지도 SVG 안 글자 없음) |
| 터치 타깃 44px | 0 위반 (토스트 닫기 40px는 `::after`로 48px) |
| 포커스 링 | **고침 2건**("책장 전체 보기"·"모험 지도로" 링크에 `focus-ring` 없음) 뒤 모두 보임. 순서: HUD → 지도 머리(월드 바꾸기·이어서 하기) → 노드 1~7 → 책장 전체 보기 → 떠 있는 이어하기, 시트는 차례 줄 → 주 버튼 → 닫기 |
| axe-core | 위반 0 (지도·시트·메뉴 시트·책장·잠긴 월드, 7폭) |
| 헤딩 | 지도 h1 "파이썬 섬 모험 지도" → h2 "모험 스테이지"(숨김)·"다음 권 미리 보기" → h3 월드 이름, 책장 h1 → 월드마다 h2, 잠긴 월드 h1, 시트 제목 h2 → "차례" h3 |
| 스크린리더 이름 | 노드 "1단계 파이썬 마을 입구, 도전 중…", 잠김 "2단계 변수의 숲, 잠김", HUD "닉네임, 내 프로필"·"1일 연속 모험 중", 떠 있는 버튼 "이어서 하기: 1단계 …" |
| 대비 AA | axe `color-contrast` 위반 0 (토큰 대비 47쌍 테스트와 같음) |
| minimal·동작 줄이기 위치·크기 변화 | 0 (지도·책장·잠금 해제 연출 도중 — 끝 상태 전환 + 문구만) |

### 고친 것

- **지금 위치 깃발 겹침**: 좁은 세로 지도(320~390px)에서 파이뱀은 이웃 노드 쪽(지도 가운데)에 서서, 깃발이 이웃 노드 이름표·"잠김"에 걸렸습니다(2번 노드 + 잠금 해제 "새 곳 도착!" 23×7px, 6번 노드 + 보스 "잠김" 35×9px). 깃발을 노드 쪽으로 24px 당기고(`worldMap.css .wn-here-flag`), 월드 1 세로 지도 6번 노드를 14단위 내림(`map.yaml` tall 350 → 364). e2e가 320px에서 7개 노드 모두를 긴 문구로 확인
- **포커스 링**: `NextBooks` "책장 전체 보기", `WorldShelf` "모험 지도로"에 `focus-ring`
- **API 키 안내**(`ApiKeyAlert`): 12px 글자·작은 링크 버튼 → 14px 이상 + 공통 `Button`(48px, 포커스 링)

## 5. 다시 재려면

```bash
npm run db:start                         # 로컬 Supabase
npm run perf:world -- --build            # e2e env로 빌드 → 포트 3110에서 서버 → 측정 → 정리 (약 8분)
# 이미 e2e env 서버가 떠 있으면: npm run perf:world -- --base http://localhost:3100
```

`npm run build`를 `.env.local`로 하면 빌드에 운영 쪽 공개 값이 박혀 소셜 로그인 e2e가 깨지니, 측정용 빌드는 `--build`(= e2e와 같은 env)로 만듭니다. 결과 JSON은 `build/perf/`(git 제외).
