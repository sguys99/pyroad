---
name: pyRoad
description: 초등학생이 파이뱀과 그림책 지도를 따라 파이썬을 배우는 게임형 웹 학습 서비스
colors:
  bg: "#F6F7F3"
  surface: "#FFFFFF"
  surface-2: "#ECEEE7"
  surface-lip: "#D9DCD2"
  line: "#E2E5DC"
  line-strong: "#828A7C"
  text: "#22271F"
  text-muted: "#5C6457"
  primary: "#2A7D3D"
  on-primary: "#FFFFFF"
  primary-lip: "#1C5A2C"
  primary-text: "#257338"
  primary-bright: "#A1D995"
  primary-soft: "#E1F2E0"
  secondary: "#22271F"
  accent: "#F6B92B"
  on-accent: "#22271F"
  accent-lip: "#C98F12"
  accent-light: "#FDE5A0"
  accent-text: "#7A5200"
  accent-soft: "#FFF4D4"
  caution: "#EE7F4A"
  caution-text: "#9C4A1A"
  caution-soft: "#FFE8D6"
  error: "#B3402F"
  error-soft: "#FCE9E5"
  w1: "#A4D49A"
  w1-ink: "#257338"
  w1-soft: "#E9F4E6"
  w2: "#9CC4DE"
  w2-ink: "#4A6170"
  w2-soft: "#E8F2F9"
  w3: "#EDB787"
  w3-ink: "#75583F"
  w3-soft: "#FBEEE2"
typography:
  hero:
    fontFamily: "Jua, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "34px"
    lineHeight: 1.22
    letterSpacing: "-0.01em"
  h1:
    fontFamily: "Jua, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "28px"
    lineHeight: 1.25
  h2:
    fontFamily: "Jua, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "24px"
    lineHeight: 1.3
  h3:
    fontFamily: "Jua, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "19px"
    lineHeight: 1.35
  button:
    fontFamily: "Jua, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "18px"
    lineHeight: 1
  body:
    fontFamily: "pyRoad Sans, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "17px"
    lineHeight: 1.7
  small:
    fontFamily: "pyRoad Sans, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
  caption:
    fontFamily: "pyRoad Sans, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  kicker:
    fontFamily: "pyRoad Sans, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "0.02em"
  code:
    fontFamily: "pyRoad Mono, D2Coding, ui-monospace, monospace"
    fontSize: "16px"
    lineHeight: 1.6
rounded:
  s: "10px"
  m: "14px"
  l: "20px"
  pill: "9999px"
spacing:
  unit: "4px"
  gutter: "16px"
  touch: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.m}"
    height: "48px"
  button-primary-pressed:
    backgroundColor: "{colors.primary-lip}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.m}"
    height: "48px"
  button-reward:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.m}"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.error}"
    typography: "{typography.button}"
    rounded: "{rounded.m}"
    height: "48px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "16px"
  status-pill:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
  code-box:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.code}"
    rounded: "{rounded.m}"
---

# Design System: pyRoad

> 이 파일은 **요약·입구**다. 값의 원본은 코드(`src/lib/design/tokens.ts` → `src/app/globals.css`, 모션 `src/lib/motion/tokens.ts`)이고, 상세 규칙은 [docs/design/](docs/design/)에 있다. 이 파일과 그 문서들이 다르면 코드와 상세 문서가 맞다 — 이 파일을 고친다. 제품 사실은 [PRODUCT.md](PRODUCT.md).
>
> | 주제 | 상세 문서 |
> |---|---|
> | 색·대비·타이포 스케일·반경·그림자·월드 테마·금지 검사 | [tokens.md](docs/design/tokens.md) |
> | 공통 컴포넌트·쓰지 않는 패턴(§0) | [components.md](docs/design/components.md) |
> | 연출 단계·동작 줄이기·easing | [motion-guidelines.md](docs/design/motion-guidelines.md) |
> | 글꼴 파일·폴백·서브셋 | [fonts.md](docs/design/fonts.md) |
> | 코드 에디터 | [editor.md](docs/design/editor.md) |
> | 마스코트 리그 | [rig.md](docs/design/rig.md) |

## Overview

**Creative North Star: "그림책 모험 지도"**

아이가 펼쳐 읽는 그림책 한 권. 바탕은 풀빛이 살짝 도는 밝은 중립 한 톤이고, 그 위에 테두리 없는 흰 면이 놓이며, 그림(지도·표지·마스코트)이 화면의 색과 개성을 맡는다. UI는 그림을 방해하지 않게 조용하다: 주색 초록 하나, 보상에만 쓰는 금색 하나, 의미색, 그리고 월드마다 바뀌는 옅은 틴트.

손에 잡히는 장난감 같은 촉감은 **버튼 아랫면 3px**와 캐릭터·보상의 출렁이는 움직임에서만 나온다. 나머지 컨트롤은 차분하게 움직인다. 연출은 저사양·동작 줄이기에서 줄어들어도 뜻이 같아야 한다.

Phase 13 감사(2026-11-18, [P13-audit](docs/design/P13-audit.md))에서 AI가 자주 만드는 습관 12가지를 걸러 냈다. 새 화면도 그 목록(아래 Do's and Don'ts)을 따른다.

**Key Characteristics:**

- 단일 톤 바탕 + 테두리 없는 흰 면 + 그림자 두 종류
- 초록 = 학습·지금 여기·선택·주 버튼, 금색 = 보상만, 주의 색 = 틀림·주의
- 제목·버튼·숫자는 Jua, 본문은 pyRoad Sans, 코드는 pyRoad Mono(퀘스트 화면만)
- 누르는 것은 모두 48px 이상, 글자는 14px 이상
- 튀는 움직임은 캐릭터·보상·도장·버튼 눌림 복귀에만

## Colors

중립 + 주색 초록 하나 + 강조 금색 하나 + 의미색. 쓰임은 bg · text · fill · ui(경계 3:1) · decor(장식 전용) 다섯 가지로 나뉘며, 전체 표와 대비 값은 [tokens.md §1](docs/design/tokens.md).

### Primary

- **숲길 초록** (`primary`): 주 버튼 면, "지금 여기"·선택 상태. 아랫면은 `primary-lip`, 옅은 면은 `primary-soft`.
- **글자 초록** (`primary-text`): 초록 글자·링크. 주 버튼 면 색(`primary`)을 글자색으로 쓰지 않는다.

### Secondary

- **보상 금색** (`accent`): 별·코인·도장·받기 버튼과 보상 계열(스트릭 불꽃·황금 열쇠·"전설" 등급·메달·왕관)에만. 금색 면 위 글자는 `on-accent`, 금색 계열 글자는 `accent-text`.

### Tertiary

- **주의 주황** (`caution`·`caution-text`·`caution-soft`): "틀렸어요·달라요" 피드백(퀴즈 틀린 보기, 실행 결과 다름)과 주의 안내. `caution` 자체는 장식이라 글자는 `caution-text`. 빨강(`error`)은 오류 글자·위험 버튼에만 — 틀림에 쓰지 않는다.
- **월드 틴트** (`w1`·`w2`·`w3`와 `-ink`·`-soft`): 1권 풀빛, 2권 하늘, 3권 살구. 지도·표지와 "지금 어느 책인가"를 알리는 옅은 면에만.

### Neutral

- **밝은 종이** (`bg`): 화면 바탕, 종이 결 없는 단색.
- **흰 면** (`surface`): 카드·시트·입력. 테두리가 없으므로 바탕과의 명도 차가 유일한 구분 — 흰 면을 바탕 색조로 옮기지 않는다.
- **보조 면** (`surface-2`): 칩·결과 상자·눌린 탭·줄 번호, 흰 면 위의 흰 버튼.
- **선** (`line` 구분선 장식, `line-strong` 입력·코드 상자 경계 3:1).
- **먹색 글자** (`text`·`text-muted`), 포커스 링·어두운 버튼은 `secondary`(같은 먹색, 파랑 없음).

### Named Rules

**The Gold Is Reward Rule.** 금색은 보상에만 쓴다. "지금 여기"·선택은 초록, 패널·안내는 중립, 틀림·주의는 주의 색.

**The World Is Location Rule.** 월드 색은 위치 신호다. `[data-world]`가 `--world`·`--world-ink`·`--world-soft`만 바꾸고, 화면에는 `bg-world-wash` 면 하나(지도 화면 바탕·퀘스트 머리 줄·HUD 경험치 홈)로만 알린다. 테두리·측면 띠·그라데이션으로 더하지 않는다.

**The Not By Color Alone Rule.** 상태를 색만으로 전하지 않는다. 면·점·알약을 바꾸면 글자·아이콘·낭독 문구가 함께 간다.

## Typography

**Display Font:** Jua (한글 폴백 보정 후 Apple SD Gothic Neo·맑은 고딕·Noto Sans KR)
**Body Font:** pyRoad Sans (= Pretendard Variable 이름 변경, 400~700)
**Label/Mono Font:** pyRoad Mono (= D2Coding, 퀘스트 화면에서만 싣는다)

**Character:** 둥글고 손글씨 같은 Jua가 제목·버튼·큰 숫자에서 놀이의 목소리를 내고, 본문은 읽기 쉬운 고딕으로 차분하다. 모두 자체 호스팅([fonts.md](docs/design/fonts.md)).

### Hierarchy

- **Hero** (Jua, 34 → 600px 이상 42, 1.22): 랜딩 큰 제목.
- **H1 / H2 / H3** (Jua, 28 / 24 / 19): 화면 제목 · 절 제목 · 카드 제목. `text-wrap-style: balance`.
- **Button** (Jua, 18, lg 20): 버튼 글자.
- **Body** (pyRoad Sans, 17, 1.7, `word-break: keep-all`): 본문. 읽는 화면은 768부터 내용 폭 640px(한글 한 줄 약 38~40자).
- **Small / Caption** (pyRoad Sans, 15 / 14): 보조 문단 · 캡션. **14px 미만 없음**.
- **Kicker** (pyRoad Sans 650, 14, 자간 0.02em): 위치 표기(권·스테이지·퀘스트 경로)와 결과 상태에만.
- **Code** (pyRoad Mono, 16, 에디터는 14·16·18·20 짝수만): D2Coding이 짝수 px에서만 한글 2칸이 정확하다([editor.md](docs/design/editor.md)).

### Named Rules

**The Jua Is For Voice Rule.** Jua는 제목·버튼·HUD 숫자만. 작은 이름표·라벨은 본문 글꼴. HUD 숫자는 고정 폭(`hud-num`).

## Layout

- 기준 폭 360 / 768 / 1280. 4px 간격 단위, 좌우 여백 16px(`px-gutter`), 터치 타깃 48px(`min-h-touch`).
- 화면 폭 두 단계([components.md §16](docs/design/components.md)): 읽는 화면(게시판·공지·설정)은 `max-w-lg` → 768부터 `max-w-2xl`. 격자 화면(상점·책장·월드맵·갤러리·프로필·업적)은 화면별 폭, 새 격자 화면은 `md:max-w-5xl`.
- 카드·시트 안의 묶음은 여백·1px `line`·글자 위계로 나눈다(면은 한 겹).
- 불러오는 중 자리표시는 실제 화면 틀과 같은 모양(자리가 크게 바뀌지 않게).

## Elevation & Depth

평평한 면이 기본이고 그림자는 두 종류뿐이다. 깊이는 바탕 → 흰 면의 명도 차와 버튼 아랫면으로 전한다. 그림자 값은 `--elev-card`·`--elev-pop`([tokens.md §2.2](docs/design/tokens.md)).

- **카드 그림자** (`shadow-card`): 흰 카드 기본 한 종류.
- **떠 있는 층** (`shadow-pop`): 시트·토스트·오버레이만.
- **덮개** (`scrim`, 먹색 65%): 축하·대화 상자 뒤.

### Named Rules

**The One Surface Rule.** 카드·시트·모달 안에 또 테두리·그림자·배경 상자를 두지 않는다. 강조가 필요하면 옅은 면 하나(테두리 없음). 예외는 입력·코드·선택 컨트롤 등 기능상 면이 필요한 것([components.md §0 면 한 겹의 예외](docs/design/components.md)).

## Shapes

- 반경 세 단계 + 원형: `s` 10(작은 버튼) · `m` 14(카드·버튼·코드 상자 기본) · `l` 20(큰 카드·패널) · `pill`(알약·아이콘 원).
- 테두리는 입력·코드 상자의 1px `line-strong`만. 버튼·카드·칩은 테두리 없음.
- 버튼 아랫면 3px(`--lip-h`): 같은 계열의 진한 면이 아래로 비치고, 누르면 그만큼 내려간다.
- 포커스: 2px `secondary` 링 + 2px 간격(`focus-ring`).
- 일러스트·캐릭터 선은 면 색의 진한 톤 1px 안팎이라 토큰 색이 아니다([rig.md §5](docs/design/rig.md)).

## Components

공통 게임 UI는 `src/components/ui/`이고, 새 컴포넌트·상태는 `/dev/design` 카탈로그에 진열한다. 상세 props·상태는 [components.md](docs/design/components.md).

### Buttons

- **Shape:** 반경 `m`(sm은 `s`), 높이 sm 45 · md 48 · lg 54 + 아랫면 3px.
- **Primary:** 초록 면 + 흰 글자, 화면당 주요 행동 하나.
- **Secondary / Danger:** 흰 면(흰 카드 위에서는 보조 면) + 먹색 글자 / 오류색 글자. 빨간 면은 쓰지 않는다.
- **Reward:** 금색 면 + 먹색 글자, 보상·특별 행동(황금키, 보상 받기)만.
- **Ghost:** 면 없음 + 1px 밑줄, 글자 버튼.
- **Press:** 아랫면만큼 내려갔다가 손을 떼면 `jellyB` 스프링으로 복귀(연출 단계별 대체, 동작 줄이기에서는 면 색만 진해짐). 비활성은 보조 면 + 보조 글자.

### Chips

- **Style:** 보조 면 알약, 글자 포함. 한 줄(한 카드)에 **상태 하나만**.
- **Meta:** 유형·보상 수치·추천은 알약이 아니라 아이콘 + `text-muted` 글자, 여러 개면 0.75rem 간격(가운뎃점으로 잇지 않음).

### Cards / Containers

- **Corner Style:** `m`(기본) · `l`(큰 카드).
- **Background:** 흰 면, `data-surface="raised"`로 안의 흰 버튼·진행바 홈을 보조 면으로 바꾼다.
- **Shadow Strategy:** 카드 그림자 한 종류.
- **Border:** 없음.
- **Internal Padding:** 12 · 16(기본) · 24. `CardButton`은 카드 전체가 버튼 — 안에 다른 버튼을 넣지 않는다.

### Inputs / Fields

- **Style:** 흰 면 + 1px `line-strong` + 반경 `m`.
- **Focus:** 공용 포커스 링.
- **Error / Warning:** 오류 글자 `error`, 경고 줄은 주의 글자·면.

### Navigation

- 월드맵 HUD(아바타·레벨 도장·경험치 막대·스트릭 불꽃·코인·미션 칸·메뉴, 위에 붙어 따라오는 얇은 바), 뒤로 가기 `BackLink`, 세그먼트 탭(손잡이는 튀지 않는 `face` 스프링).

### 마스코트 리그 (Signature)

파이뱀·버그버그·별똥이는 같은 SVG 리그 엔진(스타일 B "그림책": 몸색 진한 톤 외곽선, 광택 없음)으로 움직인다. 캐릭터 연출은 리그 포즈 표로만([rig.md](docs/design/rig.md)).

### 모션

값은 `src/lib/motion/tokens.ts`에서만. 일반 전환은 `--easing-out` + `--dur-fast`(140) · `--dur-base`(220) · `--dur-slow`(360). 반복 연출은 CSS `transform`·`opacity`만, 조건 클래스(`.m-loop`·`.m-ambient`)와 `<html data-motion data-reduced>`로 켠다(`@media prefers-reduced-motion` 대신 — 아이가 고른 설정이 우선). 첫 화면 글자를 `opacity: 0`으로 서버 렌더하지 않는다. 단계표·체크리스트는 [motion-guidelines.md](docs/design/motion-guidelines.md).

## Do's and Don'ts

### Do:

- **Do** 색·글꼴·반경·그림자·모션을 토큰으로만 쓴다(`npm run tokens:check`가 하드코딩을 막음, 예외는 [tokens.md §6](docs/design/tokens.md)).
- **Do** 새 글자·배경 조합을 만들면 `CONTRAST_PAIRS`에 먼저 넣어 AA를 확인한다.
- **Do** 버튼·카드·모달·시트·토스트·탭·HUD는 `src/components/ui/` 공통 컴포넌트를 쓴다.
- **Do** 상태를 바꿀 때 글자·아이콘·낭독 문구를 함께 바꾼다.
- **Do** 새 연출은 연출 단계(full / lite / minimal)와 동작 줄이기 대체를 함께 만든다.

### Don't:

[components.md §0 "쓰지 않는 패턴"](docs/design/components.md)과 같은 목록이다. 예외는 그 표에 이유와 함께 올린 것만.

- **Don't** 둥근 카드·줄에 **측면 색 띠**를 붙이지 않는다(`::before` 띠, `inset ±Npx 0 0`, 2px 이상 색 `border-left/right`). `tokens:check` `stripe`가 막는다.
- **Don't** 제목이 이미 한 말을 제목 위 작은 색 글씨(**머리말 라벨**)로 되풀이하지 않는다. `kicker`는 위치 표기만.
- **Don't** **반짝이 아이콘**(Lucide `Sparkles`·`Sparkle`, 꾸밈용 4각 별)을 쓰지 않는다. 보상 순간의 `Glint`만 예외.
- **Don't** **카드 속 카드**를 만들지 않는다.
- **Don't** 한 줄에 같은 무게의 **알약 칩**을 여러 개 두지 않는다.
- **Don't** 성격이 다른 값을 ` · `(**가운뎃점 메타**)로 잇지 않는다. 위치 경로만 예외.
- **Don't** 글 링크 뒤 `→`·`›`, 글자 앞 꾸밈 점(**장식 화살표·점**)을 쓰지 않는다.
- **Don't** 옅은 틴트 면에 같은 색조 테를 겹친 **배경 + 테두리 이중 강조**를 쓰지 않는다. 강조는 하나.
- **Don't** "비어 있음·잠김"의 기본값으로 **점선**을 쓰지 않는다. 도장 자리·드롭 영역·들여쓰기 안내선만.
- **Don't** **유리 효과**(`backdrop-filter`), 제목 **형광펜** 띠, 그림이 아닌 **장식 그라데이션**을 쓰지 않는다.
- **Don't** 카드 호버·모달·시트·토스트·목록 등장에 **튀는 easing**(스프링·back-out)을 쓰지 않는다.
- **Don't** **금색을 보상 밖에** 쓰지 않는다("지금 여기"·선택·패널·테두리·틀림).
- **Don't** 컴포넌트에 `dark:` 색 클래스를 쓰지 않는다(다크 모드는 범위 밖).
