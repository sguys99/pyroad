# 모션 가이드라인 (P2-15)

> - 근거: [P0-16 저사양 감지](../spikes/P0-16-low-spec-detection.md) §4.5 단계표 · [P0-07 마스코트 리그](../spikes/P0-07-mascot-animation.md) · [P2-01 무드보드](P2-01-moodboard.md) §2.3·§6 · 계획서 §2.5 "연출 단계", §2.10 규칙, §12-Q26
> - 코드: `src/lib/motion/` (`tier.ts` 단계표·정책 · `detect.ts` 감지 · `browser.ts` 저장소·rAF · `boot.ts` 첫 페인트 전 부트 · `tokens.ts` 모션 토큰 · `MotionTierProvider.tsx` `useMotionTier()`), CSS `src/app/globals.css` "연출 단계" 절(앱 화면만 쓰는 반복 연출 — 월드맵·퀘스트·축하·에디터 커서 — 은 `src/app/app.css`, P4-12), 설정 화면 `src/components/settings/MotionSettingsSection.tsx`
> - 모든 연출은 **연출 단계(full / lite / minimal)** 와 **동작 줄이기(reduced-motion, 별개의 축)** 를 따릅니다. 새 연출을 만들기 전에 §6 체크리스트를 보세요.

## 1. 단계는 어떻게 정해지나

| 순서 | 무엇 | 어디서 |
|---|---|---|
| 1 | **사용자 설정**이 있으면 그것 (움직임: 자동(추천) / 풍성하게 / 가볍게 / 최소로, 동작 줄이기: 기기 설정 따르기 / 켜기 / 끄기) | `users.settings.motion` (로그인) 또는 기기 사본 `localStorage pyroad.motion.prefs.v1` |
| 2 | 자동이면 **정적 신호로 첫 추정**: `deviceMemory ≤ 1` → minimal, `deviceMemory ≤ 2`·(WebKit이 아닌) 코어 ≤ 2·`saveData`·2g → lite | `detect.ts` `staticGuess` |
| 3 | **지난 세션 실측**이 더 낮으면 그 단계 (14일, 코어·메모리 값이 같을 때만) | `localStorage pyroad.motion.v1` (서버에 저장하지 않음) |
| 4 | **실측 rAF로 하향만**: 1초 창, 놓친 프레임 > 25% 또는 큰 끊김 ≥ 4개면 나쁜 창. 첫 3초 중 2개 또는 이후 4개 중 3개가 나쁘면 한 단계 내림. 세션 중 상향 없음 | `detect.ts` `FrameSampler`, `browser.ts` `startSampling` |
| 5 | 동작 줄이기는 단계와 별개: 기기 `prefers-reduced-motion` 또는 설정. 켜져 있으면 실측하지 않음 | `tier.ts` `resolvePolicy` |

- 알려진 무거운 작업 동안에는 판정을 멈춥니다: `useSamplingPause(active)` 또는 `pauseSampling()`/`resumeSampling()`(겹쳐 불러도 횟수로 셈). 지금은 **Pyodide 로딩·재준비·코드 실행**(`PyodideProvider`). 큰 라우트 이동·보스 배틀 로딩 같은 것을 추가할 때도 감쌉니다.
- 설정의 "자동" 아래 **다시 재 보기**: 지난 측정을 지우고 정적 추정부터 다시 잽니다 (잠깐의 부하로 내려간 단계를 되돌리는 방법, P0-16 §7).
- 단계가 바뀌면 익명 이벤트 `motion_tier_change`(from·to·cause·setting·reduced·elapsed_s)를 보냅니다 ([analytics.md](../analytics.md)). 임계값은 이 데이터와 실기기로 P12-04에서 조정합니다.

### 1.1 첫 화면 깜빡임을 막는 방법 (CSP 안에서)

1. 루트 레이아웃 `<head>`의 **고정 인라인 부트 스크립트**(`boot.ts`)가 첫 페인트 전에 기기 저장소 + 정적 신호 + `prefers-reduced-motion`으로 `<html data-motion data-reduced>`를 붙입니다. 내용이 고정이라 nonce 정책 CSP에 **sha256 해시**(`'sha256-…'`)로 허용합니다(루트 레이아웃은 정적 랜딩도 감싸서 요청마다 nonce를 읽을 수 없음). 정적 정책(랜딩)은 `'unsafe-inline'`이라 해시를 넣지 않습니다(해시가 있으면 `'unsafe-inline'`이 무시됨). 스크립트를 한 글자라도 바꾸면 `MOTION_BOOT_SCRIPT_SHA256`을 갱신해야 하고, 테스트(`boot.test.ts`)가 새 값을 알려 줍니다.
2. 로그인 레이아웃(`(protected)/layout.tsx`)이 서버 값 `users.settings.motion`을 **nonce 스크립트**로 본문보다 먼저 부트에 다시 넘깁니다(`window.__pyroadMotionBoot(…)`). 그래서 기기 저장소가 비어 있는 새 기기에서도 첫 화면부터 맞습니다. 소프트 내비게이션(클라이언트에서 만든 `<script>`는 실행되지 않음)은 `MotionSettingsSync`가 맡습니다.
3. React(`MotionTierProvider`)는 서버와 같은 `full`로 하이드레이션한 뒤 마운트 직후 같은 값을 다시 계산해 이어받습니다. 부트 결과와 Provider 결과가 같은지는 `boot.test.ts`가 기기 조합별로 확인합니다.

- 결과: **CSS 반복 연출은 첫 페인트부터** 단계·동작 줄이기를 지킵니다. JS(Framer) 일회성 연출은 하이드레이션 직후(수 ms)부터 맞고, 그 사이 동작 줄이기는 `MotionConfig reducedMotion`이 부트 속성을 읽어 지킵니다. 그래서 **반복 연출은 CSS로** 만드는 것이 규칙입니다(§4).

## 2. 단계표

`useMotionTier().budget`(`MotionBudget`)으로 읽습니다. 단계 이름으로 분기하지 말고 이 능력값을 보세요.

| 연출 | budget 키 | **full** | **lite** | **minimal** | **동작 줄이기** (별개 축) |
|---|---|---|---|---|---|
| 마스코트 리그 | `mascot` · `mascotFps` · `mascotSecondary` | live · 60fps · 두리번·오버래핑 켬 | live · **30fps 상한** · 두리번·오버래핑·B안 선 떨림 끔 | **상태 전환만** · 대기 CPU 0 | **still**: 위치·크기 변화 0, 표정 즉시 전환 |
| 눈 깜빡임 | `blink` | 보통 (4.2초마다) | 보통 | 끔 | **느리게** (7초마다 0.4초, §12-Q26). minimal이면 끔 |
| 대기 루프 (숨쉬기·통통·현재 위치 표시) | `idleLoops` · CSS `.m-loop` | 켬 | 켬 | 끔 | 끔 |
| 일회성 이펙트 (팝·코인·별) | `springs` · `effectDuration` | 스프링·바운스 | **70% 길이** | 페이드만 (150ms) | 즉시(0) + 색·글자·표정 |
| 파티클·컨페티 | `particles` | 100% | **30%** | 0 | 0 |
| 앰비언트 (구름·물결·반짝임) | `ambient` · CSS `.m-ambient` | 켬 | **끔** (정지 배경) | 끔 | 끔 |
| 패럴랙스 (지도 레이어) | `parallax` | 켬 (랜딩 히어로 포인터·스크롤 `.hero-par` · 월드 지도 스크롤 `.wm-par`) | **끔** (정지 배경) | 끔 | 끔 |
| `filter: blur`·`backdrop-filter` | `blur` · CSS `.m-blur` | 허용 | **끔** (불투명 배경) | 끔 | 단계 따름 |
| 큰 그림자 | `bigShadow` · CSS `.m-shadow` | 허용 | 단색 오프셋 | 단색 오프셋 | 단계 따름 |
| 페이지 전환 | `pageTransition` | slide (올라오며 페이드) | **fade** (짧게, 유지) | none | none |
| Lottie (P6) | `lottie` | play | short | still (정지 포즈) | still |
| 배경 음악 | `bgm` | 허용 | 허용 | **끔** | 단계 따름 |
| 효과음 | `sfx` | 유지 | 유지 | **유지** | 유지 |

- 바쁨 표시(로딩 점·스피너)는 기능 피드백이라 단계와 무관하게 돌고, 동작 줄이기에서만 멈춥니다.
- BGM·효과음은 사용자의 사운드 설정(P2-14)과 함께 봅니다: `bgmOn = soundSettings.bgm.enabled && budget.bgm`.

## 3. 동작 줄이기 대체 규칙 (§12-Q26)

- **움직임 0**: 위치·크기·회전 변화가 없습니다. 상태 변화는 **즉시 바꾸고 표정·색·글자로** 알립니다(예: 정답 → 초록 테두리 + "맞았어요!" + 웃는 표정, 레벨 업 → 숫자 즉시 교체 + "+1" 배지).
- **마스코트**: 몸은 멈추고 **느린 눈 깜빡임**만 남깁니다(7초에 한 번 0.4초, opacity·scaleY). 표정은 즉시 바꿉니다. 상태별 후광 색(P0-16 §4.5)은 정식 리그(P2-13)에서.
- 파티클·컨페티 0, 페이지 전환 없음, 자동 넘김 막대 없음(시퀀서는 그대로 진행).
- 기기 설정이 켜져 있어도 아이가 설정에서 "동작 줄이기: 끄기"를 고르면 움직임을 보여 줍니다(사용자 설정이 항상 우선). 그래서 CSS는 `@media (prefers-reduced-motion)`이 아니라 `[data-reduced]`를 봅니다. 컨페티(`fireConfetti`)도 같은 속성을 봅니다.

## 4. 규칙

1. **반복 연출은 CSS `transform`·`opacity`만.** Framer Motion `repeat: Infinity`, SVG SMIL(`<animate>`), `box-shadow`·`background-position`·`filter` 애니메이션 금지 (§2.10). 빛나는 고리는 미리 그린 그림자 층의 opacity로(`.stage-pulse`), 반짝임은 그라디언트 띠의 translateX로(`.stage-shimmer`).
2. 반복 연출은 조건 클래스로만 켭니다. globals.css의 조건:
   - 대기 루프: `:root[data-reduced='false']:not([data-motion='minimal'])`
   - 앰비언트: `:root[data-reduced='false'][data-motion='full']`
   - 바쁨 표시: `:root[data-reduced='false']`
   - 속성이 없으면(스크립트 실패) 아무것도 돌지 않는 것이 기본값입니다.
   - 공용 클래스: `.m-loop`·`.m-ambient`(자기 `animation`을 걸면 조건 밖에서 `paused`), `.m-blur`, `.m-shadow`. Tailwind 변형: `reduced:`·`motion-loop:`·`motion-ambient:`·`no-blur:` (예: `animate-spin reduced:animate-none`, `bg-white/60 backdrop-blur-md no-blur:bg-white/90`).
3. **JS 연출은 `useMotionTier()`** 의 `budget`으로 고릅니다. Framer `useReducedMotion()`은 기기 설정만 보므로 쓰지 않습니다(`MotionTierProvider`가 `MotionConfig reducedMotion`으로 사용자 설정까지 넘김).
4. 컨페티는 `fireConfetti(options, { scale: budget.particles })`로만. `<html data-motion>` 상한(lite 30%·minimal 0)을 넘지 않습니다.
5. 첫 화면 글자를 `opacity: 0`으로 서버 렌더링하지 않습니다. 등장 연출은 보이는 상태에서 transform만 (§2.10).
6. 스프링·길이·easing은 `tokens.ts`에서만 고릅니다. 새 스프링을 만들지 않습니다.
7. 알려진 무거운 작업은 `useSamplingPause(true)`로 감쌉니다.
8. 단계를 바꾸는 코드(설정 화면 밖)를 새로 만들지 않습니다. 단계 변경은 Provider만 하고 `motion_tier_change`를 남깁니다.

## 5. 모션 토큰 (`src/lib/motion/tokens.ts`)

P2-09가 CSS 토큰(`--spring-<이름>`·`--spring-<이름>-dur`·`--dur-<이름>`)으로 옮길 때 같은 값을 씁니다. CSS `linear()` easing은 `springTiming(name)`이 스프링을 샘플링해 만듭니다(시안 `design/prototypes/src/shared/motion.ts`와 같은 계산). Framer에서는 `framerSpring(name)` = `{ type: 'spring', stiffness: k, damping: c, mass: 1 }`.

### 5.1 스프링 (질량 1, 리그와 공유)

| 이름 | k | c | ζ | 0→1 정착 | 리그에서 | UI에서 |
|---|---:|---:|---:|---:|---|---|
| `face` | 420 | 34 | 0.83 | 418ms | 얼굴 파라미터 | 눌림 복귀, 탭·토글 전환 |
| `body` | 200 | 19 | 0.67 | 743ms | 몸·머리·꼬리 | 카드·모달 등장, 스탬프 안착 |
| `envelope` | 60 | 15 | 0.97 | 1,160ms | 레이어 세기 | 페이드·강조 하이라이트 |
| `prop` | 170 | 13 | 0.50 | 1,027ms | 소품 팝 | 코인·별·배지·HUD 숫자 팝 |
| `jellyA` | 520 | 10 | 0.22 | 1,360ms | A 착지 젤리 | A 젤리 스퀴시·버튼 복귀 |
| `jellyAB` | 500 | 16 | 0.36 | 852ms | A×B 젤리 | A×B 종이 버튼 |
| `jellyB` | 480 | 24 | 0.55 | 602ms | B 착지 | B 묵직한 복귀 |

**시안별 젤리** (`JELLY_BY_CONCEPT`): A = `jellyA`, B = `jellyB`, A×B = `jellyAB`. 최종 시안이 B(§12-Q31)라 기본값 `DEFAULT_CONCEPT = 'b'` → `jelly()` = `jellyB`(ζ 0.55, 602ms, 리그 B 스타일과 같음, P2-09). P2-15 동안은 임시로 A×B였습니다. CSS 변수(`--dur-*`·`--easing-*`·`--spring-*`)와 Tailwind 쓰는 법은 [tokens.md](tokens.md) §2.3.

### 5.2 길이 · easing

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `DURATION.instant` | 80ms | 색·눌림 상태 |
| `DURATION.fast` | 140ms | 툴팁, 작은 페이드, lite 페이지 전환 |
| `DURATION.fade` | 150ms | minimal 단계의 짧은 페이드 (`springOrFade`, P2-09) |
| `DURATION.base` | 220ms | 일반 전환, 스탬프 내려찍기 |
| `DURATION.slow` | 360ms | 화면 안 큰 요소, lite 잉크 |
| `DURATION.page` | 700ms | B 페이지 넘김 |
| `DURATION.progress` | 700ms | 진행 막대 채우기·숫자 카운트업 (P2-09) |
| `DURATION.draw` | 1,500ms | 지도 길 그리기 (P2-09) |
| `DURATION.celebrate` | 1,200ms | 축하 카드 한 장 (시퀀서 단위) |
| `EASING.out` | `cubic-bezier(0.22, 1, 0.36, 1)` | 등장 |
| `EASING.inOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | 이동 (코인 → HUD) |
| `EASING.press` | `cubic-bezier(0.3, 0, 0.5, 1)` | 누름 |
| `EASING.backOut` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 스프링을 못 쓰는 CSS 전환 대체 |
| `EASING.stampIn` | `cubic-bezier(0.55, 0, 0.9, 0.3)` | 가속 내려찍기 |
| `EASING.ink` | `cubic-bezier(0.2, 0.7, 0.3, 1)` | 잉크 번짐·길 그리기 |
| `EASING.page` | `cubic-bezier(0.45, 0.05, 0.25, 1)` | 페이지 넘김 |

Framer용 배열은 `EASE.<이름>`. 단계 보정은 `tierDuration(ms, budget)`(lite 70%, 동작 줄이기 0), `springOrFade(spring, budget, delay)`(스프링 → minimal 150ms 페이드 → 동작 줄이기 즉시).

## 6. 새 연출 체크리스트

- [ ] 반복인가? → CSS 키프레임(transform·opacity만) + §4.2 조건 클래스. Framer `repeat`·SMIL·`box-shadow`/`filter` 애니메이션 아님
- [ ] 단계표(§2)의 어느 줄인가? full · lite · minimal · 동작 줄이기 네 칸의 동작을 정했나
- [ ] JS 연출이면 `useMotionTier().budget`으로 길이(`tierDuration`)·스프링(`springOrFade`)·파티클(`particles`)을 고르나
- [ ] 동작 줄이기에서 **움직임 없이도 결과를 알 수 있나** (색·글자·표정). 색만으로 알리지 않나(모양·글자도)
- [ ] 첫 화면 글자를 `opacity: 0`으로 렌더링하지 않나. 등장은 transform만
- [ ] 스프링·길이·easing을 `tokens.ts`에서 골랐나 (새 값 금지)
- [ ] 흐림·큰 그림자에 `.m-blur`·`.m-shadow`(또는 Tailwind `backdrop-blur-*`, lite부터 자동으로 꺼짐)를 붙였나. 흐림이 꺼져도 글자 대비가 유지되나(배경 알파 0.9 이상)
- [ ] 무거운 로딩을 동반하면 `useSamplingPause`로 감쌌나
- [ ] 컨페티는 `fireConfetti`로만
- [ ] 360 / 768 / 1280 폭 + 동작 줄이기 + minimal에서 스크린샷으로 확인했나 (Playwright `emulateMedia({ reducedMotion: 'reduce' })`, 또는 설정 화면에서 단계 고르기)

## 7. 지금 앱에 적용한 것 (P2-15)

| 화면 | 연출 | 바꾼 것 |
|---|---|---|
| 월드맵 | 구름·나뭇잎 | 인라인 animation + JS reduced 분기 → `.float-cloud`·`.drift-leaf` (앰비언트, full만) |
| 월드맵 | 현재 스테이지 파이뱀 통통 | Framer `repeat: Infinity` → `.mascot-bob` (대기 루프) |
| 월드맵 | 현재 스테이지 빛 | Framer `boxShadow` 반복 → `.stage-pulse` 그림자 층 opacity (대기 루프) |
| 월드맵 | 완료 스테이지 반짝임 | `background-position` 반복 → `.stage-shimmer` translateX (앰비언트) |
| 월드맵 | 노드 등장·길 그리기 | 단계별: lite 70%, minimal 페이드·즉시, 동작 줄이기 즉시 |
| 월드맵 | 노드 `backdrop-blur-sm` | lite부터 꺼짐 (배경 알파 0.9~0.95라 대비 유지) |
| 월드맵 (P5-02) | 지도 레이어 패럴랙스 | 먼 곳(바다·물결·배·새, 깊이 0.08)·중간(산·나무, 0.035) SVG 레이어만 스크롤 따라 transform(`.wm-par`, full만). 길·랜드마크·노드는 고정이라 노드 자리는 어긋나지 않음. 스크롤할 때만 rAF 1번(passive), 멈추면 0. 측정(개발 서버, CPU 4배 감속): 대기 메인 스레드 0.7~0.9%, 스크롤 rAF p95 18.5ms |
| 월드맵 (P5-02) | 지난 길 그리기 | 잉크 길을 전체 길의 조각(`mapRoute`)으로 따로 그려 지금 노드에 정확히 닿음. full 1.5초 · lite 70% · minimal·동작 줄이기 즉시, 종이 점선은 그린 뒤 페이드 |
| 월드맵 (P5-04) | 스테이지 노드 | 카드 빛 고리(`.stage-pulse`)·반짝임(`.stage-shimmer`)·`backdrop-blur` 대신 지금 노드 점선 고리 `wn-ring`(대기 루프, transform·opacity) + 파이뱀 `.mascot-bob`. 등장은 노드 → 파이뱀 차례(기존 단계 규칙). 도장·링은 정지 그림 |
| 월드맵 (P5-02) | 물결·새·배 | 정지 그림만(클래스 `wm-wave`·`wm-bird`·`wm-boat` 자리), 반복 연출은 P5-09 |
| 퀘스트 | 단계 표시 현재 단계 | Framer `repeat: Infinity` → `.step-pulse` |
| 퀘스트 | Pyodide 로딩·실행 | 실측 판정 멈춤 |
| 축하 | 컨페티·카드·레벨 pop | `fireConfetti`가 `<html>` 속성 상한, 카드 연출은 기존 `budget` 그대로, 레벨 pop은 `[data-reduced]` |
| 캐릭터 | 눈 깜빡임·별똥이 반짝임 | SVG SMIL → `.char-blink-eye`·`.char-blink-highlight`·`.char-twinkle` (동작 줄이기는 느린 깜빡임) |
| 캐릭터 | 축하 점프·빛 고리 | `MotionConfig`가 사용자 설정까지, minimal은 빛 고리 없음 |
| 공통 | 페이지 전환 | full slide · lite fade · minimal·동작 줄이기 없음 |
| 공통 | 로딩 점·스피너·스켈레톤 | 동작 줄이기만 멈춤 (`reduced:` 변형) |
