# 컴포넌트 카탈로그 `/dev/design` (P2-12)

> - 코드: `src/app/dev/design/` (`page.tsx` 라우트 · `DesignCatalog.tsx` 막대·목차 · `_catalog/*` 절) · 공유 카드 샘플 라우트 `src/app/dev/design/share-card/[id]/route.ts`
> - 진열 기준: [components.md](components.md) 각 절 끝의 **대표 상태** · [tokens.md](tokens.md) · [motion-guidelines.md](motion-guidelines.md) · [rig.md](rig.md) · [sound.md](sound.md) · [share-card.md](share-card.md) · [editor.md](editor.md)
> - 검사: `e2e/public/design-catalog.spec.ts`(카탈로그) · `e2e/motion-tiers.spec.ts`(월드맵·퀘스트, 로그인) · 공용 `e2e/support/motion.ts`

## 1. 여는 법

| 어디서 | 어떻게 |
|---|---|
| 개발 서버 | `npm run dev` → `http://localhost:3000/dev/design` |
| e2e·운영 빌드 확인 | 서버 env `PYROAD_TEST_PAGES=1` (`e2e/support/env.ts`가 넣음) |
| 운영(Vercel) | **404** (`isTestPagesEnabled()`가 거짓 → `notFound()`). 페이지는 `connection()`으로 동적 렌더라 요청 때 env를 읽고, 빌드에 굳지 않아 postbuild 정적 CSP 검사·nonce 규칙도 그대로 |
| 처음 단계 고르기 | `?motion=full\|lite\|minimal&reduced=on\|off` (막대에서 바꾸면 주소에 남음) |

앱 레이아웃 밖이라 페이지가 직접 앱 웹폰트(`src/fonts/app.css`: Jua·pyRoad Sans 조각)와 코드 글꼴(`pyroad-mono.css`)을 싣는다. 루트 레이아웃의 `MotionTierProvider`·`SoundProvider` 안에서 그린다.

## 2. 연출 단계 막대 (페이지 위 고정)

- **연출 단계**: 자동 · full · lite · minimal / **동작 줄이기**: 기기 설정 · 켜기 · 끄기. "지금" 칸에 실제 적용 값과 감지 값·기기 설정을 보여 준다.
- **이 화면에만** 적용한다. 설정 API(`/api/settings`)·기기 저장소(`pyroad.motion.prefs.v1`)에 쓰지 않고 분석 이벤트도 보내지 않는다(motion-guidelines §4.8 "단계 변경은 Provider만"을 지키는 로컬 덮어쓰기).
  - JS 연출: 안쪽을 고정 모드 `MotionTierProvider tier reduced`로 감싼다 → `useMotionTier().budget`·Framer `MotionConfig`·리그.
  - CSS 연출: `<html data-motion data-reduced>`를 직접 덮어쓴다. 루트 Provider가 감지·기기 설정 변화로 다시 쓰면 MutationObserver로 바로 되돌리고, 덮어쓰는 동안 실측 판정을 멈춘다(`useSamplingPause`). 자동 + 기기 설정으로 돌아가거나 화면을 떠나면 루트 값으로 되돌린다.
  - 포털(시트·모달·토스트·툴팁)도 같은 `<html>` 속성과 React 컨텍스트를 따르므로 함께 바뀐다.

## 3. 절 목록

| 묶음 | 절 (anchor) | 내용 |
|---|---|---|
| 연출 | `#motion` 연출 단계 견본 | 단계표(`MOTION_BUDGETS` full·lite·minimal·동작 줄이기 + "지금" 줄) · 앱과 **같은 클래스**의 반복 연출 견본(대기 루프 `.mascot-bob`·`.character-breathe`·`.step-pulse`·`.stage-pulse`, 앰비언트 `.float-cloud`·`.drift-leaf`·`.stage-shimmer`, 바쁨 `.waking-dot`·`.thinking-dot`·`animate-spin`·`animate-pulse`, 눈 깜빡임 `.char-blink-*`·`.char-twinkle`), 흐림·큰 그림자. 칸마다 "돌고 있는 반복 연출 수"를 e2e와 같은 기준으로 센다 |
| 토큰 | `#colors` 색 | 토큰 원본(`COLOR`)의 이름·hex·CSS 변수·쓰임 + 바탕·카드 위 대비를 `contrastRatio`로 그 자리에서 계산, `CONTRAST_PAIRS` 52쌍 표(견본 글자·기준·대비) |
| | `#type` 글자 | `TYPE` 12단계 견본(Jua 제목·버튼 / pyRoad Sans 본문·캡션·눈썹 / pyRoad Mono 코드) + HUD 숫자 `.hud-num` |
| | `#shape` 반경·그림자·간격·선 | `RADIUS`·`SHADOW`·`SPACE`·`LINE` |
| | `#worlds` 월드 테마 | `data-world` 1·2·3 틴트 견본 + 표지 글자·본문 대비 |
| | `#motion-tokens` 모션 토큰 | 스프링 7종(k·c·ζ·정착 길이)을 눌러서 재생, `DURATION` 표, `EASING` 7종 재생. 재생은 지금 단계를 따른다(minimal 150ms·동작 줄이기 즉시) |
| 컴포넌트 | `#buttons` | 5변형 × 3크기 × 기본·눌림(`pressed`)·로딩·비활성, 아이콘 앞·뒤·없음, 흰 카드 위, 링크·탭 소리, IconButton md·sm × 기본·눌림(`pressed` prop, P2-12 추가) |
| | `#cards` | Card m·l × padding 4종, 안의 secondary·진행바, CardButton 버튼·링크 |
| | `#alert-dialog` | default·sm × 제목+설명·Media × primary·danger·로딩 |
| | `#sheet` | Sheet · wide · 긴 내용 스크롤 · Modal · Modal media+가운데 (열기 버튼) |
| | `#toast` | tone 4종 띄우기·3개 쌓기 + 4 tone × 아이콘·닫기 있음/없음, 두 줄 정지 견본 |
| | `#tabs` | 2·3(아이콘)·4칸 |
| | `#progress` | 값 올리기(빛 띠)·0으로, 0·40·100% × primary·reward × sm·md·lg, 흰 카드 위 `animateOnMount` |
| | `#hud` | 전체(코인·별·키·소리) + 코인·별·키·레벨·경험치 올리기·큰 수, 키 없음(월드맵), LevelSeal md·sm·두 자리, 칩 하나씩(1.5억 축약) |
| | `#bubble` | 타자 효과(다시 타자)·스트리밍 커서·배지·긴 대사, 4 tone × 꼬리 3종 |
| | `#reward` | 4종 × 20·26·34px, Stars 0~3, 비활성 버튼 안 |
| | `#tooltip` | 올려놓기로 보기 (위·아래) |
| 캐릭터 | `#rig` | 파이뱀(14)·버그버그(8)·별똥이(5) 라이브 리그 + 상태 버튼·다시 보기·말하기 레이어, 정지 그림(`*Static`, 후광), 파이뱀 스킨 6색·`UserAvatar` 32/48/96 (P3-13) |
| 기타 | `#editor` | `/dev/editor` 점검 페이지 링크(오류 줄 포함) |
| | `#share-card` | `SHARE_CARD_SAMPLES` 10장을 운영과 같은 엔진(next/og)으로 요청 때 그린 PNG(`/dev/design/share-card/<id>`, 개발 전용·운영 404). 커밋된 PNG는 `docs/design/img/share-card/`라 서빙되지 않으므로 라우트로 대신했다(템플릿을 고치면 바로 보임) |
| | `#sound` | 효과음 12종 재생 버튼(첫 탭 뒤, 꺼져 있으면 안내) + 별 1→3 상승음 |
| | `#legal` 약관 동의 (P3-14) | `AgreementChecklist`(`src/components/legal/`) 처음·일부(모두 동의 중간 상태)·모두 동의·"다음"과 함께(필수 안내 + `toAgreementRecords()` 기록 미리보기), 법적 고지 링크 `LegalNav` |

포커스(Tab)·올려놓기(마우스)는 고정 상태로 만들지 않았다: 직접 해 본다. 360폭 HUD 전체 줄은 넘쳐서 그 칸만 가로 스크롤(§5).

## 4. 연출 단계 대체 검사 (Phase 2 완료 기준)

"reduced-motion과 연출 단계(lite·minimal)에서 모든 연출에 대체 동작이 있다"를 e2e로 확인한다.

**반복 연출**: 단계마다 `document.getAnimations()` 중 `playState === 'running'`이고 `iterations === Infinity`인 것을 모은다(CSS는 `animationName`, 나머지는 `waapi`). Framer 일회성·CSS 전환은 유한이라 세지 않는다.

| 단계 | 기대 |
|---|---|
| full | 검사가 실제로 잡는지: 앰비언트·대기 루프가 돌고, 흐림 요소가 있다 |
| lite | 앰비언트(`float-cloud`·`drift-leaf`·`stage-shimmer`) 0개, 대기 루프는 돎, 흐림 요소 0개, `.m-shadow`는 단색 오프셋 |
| minimal | 아래 **minimal 허용 목록** 밖 0개 (대기 루프 0개, 바쁨 표시는 돎) · 흐림 0개 |
| 동작 줄이기 (full) | 아래 **동작 줄이기 허용 목록** 밖 0개 |
| minimal + 동작 줄이기 | 0개 |

**minimal 허용 목록** (기능 신호, motion-guidelines §2 "바쁨 표시는 단계와 무관, 동작 줄이기에서만 멈춤"):

| 애니메이션 | 근거 |
|---|---|
| `g-caret` | 말풍선 타자·AI 튜터 스트리밍 커서 = "아직 말하는 중" |
| `spin` | 로딩 스피너(버튼 `loading`·실행 중), `reduced:animate-none` |
| `pulse` | 화면 로딩 스켈레톤, `reduced:animate-none` |
| `waking-dot` · `thinking-dot` | 실행기 깨우는 중 · AI 튜터 생각 중 점 세 개 |
| `cm-blink` · `cm-blink2` | 코드 에디터 커서 = 입력 위치 신호(CodeMirror 기본). 동작 줄이기에서는 멈추고 늘 보이게(app.css — P4-12에서 globals.css에서 옮김, P2-12 추가) |

**동작 줄이기 허용 목록** (§12-Q26 "몸은 멈추고 느린 눈 깜빡임만", minimal이면 이것도 없음): `char-blink-eye-slow` · `char-blink-highlight-slow`.

**마스코트 리그**(JS rAF라 `getAnimations`에 안 잡힘): full은 SVG 속성 쓰기가 계속 있고, minimal은 첫 전환 뒤 1.5초 동안 쓰기 0, 동작 줄이기는 상태를 바꿔도(춤) `transform` 쓰기 0(위치·크기 고정, 표정만).

**일회성 연출**(대표):

| 연출 | full | lite | minimal | 동작 줄이기 |
|---|---|---|---|---|
| 버튼 올려놓기·누름 | -1px · +3px, 손 떼면 WAAPI 젤리 | (같은 규칙, face 스프링) | -1px · +3px, 전환 0s | 이동 0, 누르면 면 색 |
| HUD 코인 +37 | 150ms에 중간값 + 칩 팝(WAAPI) | — | 바로 1,317 + 금색 틴트(`data-flash`) | 바로 + 틴트 |
| 시트 등장(넓은 화면) | transform·opacity 전환 | transform 전환 | opacity만 | 전환 없음 |
| 진행바 빛 띠 | 있음 | 있음 | 없음 | 없음 |
| 토스트 등장 | `g-toast-in` | `g-toast-in-lite` | `g-fade-in` | 없음 |
| 말풍선 타자 | 커서 + 타자 | 커서 + 타자 | 처음부터 전체 | 처음부터 전체 |

앱 화면은 `e2e/motion-tiers.spec.ts`가 사용자 설정(`users.settings.motion`)으로 단계를 고정해 월드맵·퀘스트(실행기 로딩 중 포함)에 같은 반복 연출·흐림 기준을 건다.

## 5. P2-12에서 찾아 고친 것 · 남은 것

고친 것 (e2e·감사에서 발견):

| 무엇 | 원인 → 고침 |
|---|---|
| **lite·minimal에서 흐림이 안 꺼짐** (월드맵 노드 `backdrop-blur-sm`, 랜딩 헤더 등) | globals.css `[class*='backdrop-blur'] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important }`를 Lightning CSS가 한 속성으로 합쳐 접두 쪽만 남김 → Chromium에서 무효. 접두 선언을 빼서 해결(접두는 빌드가 붙임) |
| **마우스로 버튼을 누르면 내려가지 않음** | 올려놓기 규칙(명시도 0-6-0)이 누름 규칙(0-5-0)을 이김 → 누름에 `:not([data-variant='ghost'])`를 맞춰 붙여 같은 명시도 + 뒤 순서 |
| **동작 줄이기에서 버튼이 1px·3px 움직임** | 움직임 0 규칙(0-4-0)이 올려놓기·누름 규칙에 짐 → `:root[data-reduced='true'] .g-btn:is(:hover, :active, [data-pressed])…` (0-7-0) |
| minimal에서 누르는 동안 80ms 전환 | minimal 누름 규칙 추가 (즉시) |
| minimal에서 레벨업 숫자 팝·빛 고리 | `.celebration-pop` 조건에 `:not([data-motion='minimal'])` (단계표: minimal은 바운스 없음) |
| minimal에서 축하 캐릭터 점프·등장 스프링 (`LottieCharacter`) | 스프링이 없으면 `initial={false}`로 마지막 자세 |
| 동작 줄이기에서 코드 에디터 커서 깜빡임 | `.cm-cursorLayer` 애니메이션 끔 (커서는 보임) |
| 동작 줄이기에서 설정 소리 토글 손잡이·축하 쪽 점 크기 전환 | `reduced:transition-none` |

남은 것 (Phase 4~6 화면 개편에서): 아래 표는 동작 줄이기에서는 Framer `MotionConfig`가 막지만 lite·minimal 구분이 없는 일회성 연출이다(단계표상 minimal은 페이드만이어야 함).

| 위치 | 연출 | 개편 |
|---|---|---|
| `world/StageNode.tsx` · `characters/CharacterAvatar.tsx` | 올려놓기·누름 크기 변화(1.05·0.95·1.08) | Phase 5 월드맵 |
| `quest/CodePanel.tsx` · `QuestStatusBar.tsx` · `OutputPanel.tsx` | 팁 y 이동·다음 버튼 등장·별똥이·"+XP"·버그버그 x 이동 (스프링) | Phase 4 퀘스트 (`springOrFade`·`tierDuration`) |
| `board/ReportButton.tsx` | 체크 아이콘 팝 (`reduced`만 봄) | `budget.springs`로 |
| ~~`landing/HeroSection.tsx` · `AboutSection.tsx`~~ | ~~차례로 떠오르기. Hero는 첫 화면 글자를 `opacity: 0`으로 서버 렌더~~ → P4-01에서 삭제. 새 히어로(`landing/hero/`)는 보이는 상태에서 CSS transform만, minimal·동작 줄이기는 등장 없음 | 해결 (P4-01) |
| `quest/CodePanel.tsx` 코딩 팁 회전 | 실행기 로딩 중 3.5초마다 Framer 페이드 (유한, 동작 줄이기에서 opacity만) | Phase 4 |
| `components/ui/hud.tsx` `CurrencyHud` | 360폭에서 코인·별·키·소리를 모두 넣으면 약 380px로 넘침 (카탈로그 칸은 가로 스크롤) | HUD 개편 때 칸 줄이기(키는 퀘스트만·XP 바 접기 등) |
| ~~패럴랙스~~ | 랜딩 히어로(P4-01 `HeroParallax`, CSS `.hero-par`)와 월드 지도(P5-02 `WorldMap` 스크롤 `--ms`, CSS `.wm-par`) 모두 full만. 카탈로그 "월드 지도" 절 | 해결 (P5-02) |
