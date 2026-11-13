# 코드 에디터 (CodeMirror 키즈 테마, P2-18 · 공책 머리 P6-03 · 공책 테마 P9-06)

퀘스트 화면의 코드 에디터 모양과 글자 규칙. 기준은 승인된 최종 시안(§12-Q31)의 "나의 주문 공책" 코드 상자(`design/prototypes/src/final/Quest.tsx`·`refine.css`)입니다. 색·글꼴 토큰은 [tokens.md](tokens.md)·[fonts.md](fonts.md).

| 파일 | 하는 일 |
|---|---|
| `src/lib/editor/kidsTheme.ts` | 테마 명세 `KIDS_THEME_SPEC`, 구문 클래스 `kidsHighlighter`, 틴트 진하기 `TINT`, 대비 표 `EDITOR_CONTRAST_PAIRS`, 한국어 문구 `KO_PHRASES` |
| `src/lib/editor/fontSize.ts` · `useCodeFontSize.ts` | 글자 크기 단계(14·16·18·20)·기기 저장 |
| `src/lib/editor/errorLine.ts` | traceback → 오류 줄 번호, 오류 줄 표시 확장 |
| `src/components/quest/CodeEditor.tsx` | 에디터 구성 (basicSetup에서 접기 칸만 뺌, 줄 바꿈 없음) |
| `src/components/quest/CodeFontSizeControl.tsx` | 글자 크기 버튼 (공책 머리 오른쪽 끝) |
| `src/components/quest/CodePanel.tsx` (`NotebookTitle`·`ResetCodeButton`) · `ResetCodeDialog.tsx` | 공책 머리 제목·"처음 코드로"·확인 창 (P6-03) |
| `src/app/dev/editor/` | 테스트 전용 페이지 (개발 서버·e2e만, 운영 404) |

## 1. 모양

- 상자: 흰 면(`codeBg`) + 1px `lineStrong` 테두리 + 반경 `--round-m`(14). 그림자 없음. 높이 11rem(176px, 약 6줄)~400px, 넘치면 상자 안에서 스크롤.
- 줄 번호: `surface2` 면 + `textMuted` 숫자, 오른쪽 1px `line` 구분선. 활성 줄 번호는 본문색 + 옅은 초록.
- 포커스: 앱 공용 포커스 링과 같은 2px `secondary` + 간격 2px(`--focus-w`·`--focus-offset`).
- 커서: 2px 본문색. 깜빡임은 CodeMirror 기본(1.2초 주기 opacity)이고 연출 단계와 상관없이 둡니다(입력 위치를 알리는 기능 신호). **동작 줄이기에서만 멈추고 늘 보이게** 합니다(`app.css`, P2-12, e2e `motion-tiers`).
- 활성 줄 띠·활성 줄 번호는 **에디터에 포커스가 있을 때만** 칠합니다(P6-03). 실행 버튼을 누른 뒤처럼 커서가 없는데 줄만 칠해져 있으면 오류 줄 띠와 섞여 잡음입니다.
- 접기 칸(▸)은 뺐습니다. 시안 공책에 없고 아이에게는 잡음입니다. 자동 완성·괄호 자동 닫기·찾기(Ctrl+F)는 그대로이고 찾기 창 문구는 한국어(`KO_PHRASES`). 단 터치 화면(`pointer: coarse`)에서는 자동 완성 목록을 눌러서만 고르고 Enter는 늘 줄바꿈입니다(P6-11: 폰 키보드 Enter가 목록을 골라 줄이 안 바뀌던 문제. 목록 자체를 끄지 않은 이유는 손가락으로 `print` 등을 고르는 것이 치는 것보다 쉬워서). Esc로 닫기는 그대로.
- **줄 바꿈 없음**(가로 스크롤, 시안과 같음). 줄을 꺾으면 좁은 화면에서 한글 주석이 글자 중간에서 꺾여 정렬이 깨지고, 꺾인 줄이 0칸에서 시작해 들여쓰기처럼 보입니다. 360px·20px에서도 줄마다 한 줄 높이인지 e2e가 확인합니다.

## 2. 색 (모두 토큰 변수, 색 리터럴 없음)

구문색은 3종 + 본문색입니다. 굵게·기울임은 쓰지 않습니다.

| 무엇 | 토큰 | 값 |
|---|---|---|
| 키워드 (`if` `for` `in` `and` `def` `import` `True` `False` `None` …) | `codeKeyword` | `#3A7336` (= primaryText) |
| 문자열 (f-문자열·이스케이프 포함) | `codeString` | `#8A5A00` (= accentText) |
| 주석 | `codeComment` | `#7A7268` |
| 이름·숫자·함수·연산자 | `codeText` · `codeNumber` · `codeFunc` | `#2E2A25` (본문색) |

상태 표시 (반투명 틴트는 `color-mix(… N%, transparent)`, `TINT` 상수):

| 상태 | 면 | 글자 |
|---|---|---|
| 활성 줄 | `primary` 6% | 주석은 `textMuted`로 |
| 선택 영역 (포커스) | `primary` 16% | 선택된 글자는 모두 `codeText` (`::selection { color }`) |
| 선택 영역 (포커스 없음) | `primary` 3% | 그대로 (글자색을 바꿀 수 없어서 주석도 4.5가 넘는 진하기) |
| 같은 단어 | `primarySoft` | 주석은 `textMuted` |
| 괄호 짝 | `accentLight` + 1px `accentText` 테두리 | `codeText` |
| 짝 없는 괄호 | `errorSoft` | `error` |
| 찾은 곳 / 지금 찾은 곳 | `accentSoft` / `accentLight` + 1px `accentText` 테두리 | 주석은 `textMuted` |
| 오류 줄 | `errorSoft` 85% + 아래 2px `error` 선(그림자라 줄 높이 그대로) | 주석은 `textMuted`, 줄 번호는 `error` on `errorSoft` |

**왜 주석만 바꾸나**: 주석색은 흰 면에서 4.73으로 여유가 거의 없어, 아주 옅은 틴트(primary 4% 이상)만 깔려도 4.5 아래로 내려갑니다. 그래서 틴트가 깔린 줄·범위 안의 주석만 한 단계 진한 `textMuted`로 그립니다(구문 클래스가 고정 이름 `pr-tok-*`이라 CSS로 덮을 수 있음).

### 대비 (WCAG, 소수 둘째 자리 내림)

`kidsTheme.test.ts`가 아래 조합(`EDITOR_CONTRAST_PAIRS`)이 AA 미달이면 실패시킵니다. 틴트는 흰 코드 면 위에 겹친 색으로 계산합니다.

| 면 | codeText | 주석 | 키워드 | 문자열 |
|---|---|---|---|---|
| 기본 (`codeBg`) | 14.24 | 4.73 (`codeComment`) | 5.69 | 5.92 |
| 활성 줄 | 13.16 | 5.39 (`textMuted`) | 5.26 | 5.47 |
| 선택 (포커스) | 11.53 (모든 글자) | — | — | — |
| 선택 (포커스 없음) | 13.69 | 4.55 (`codeComment`) | 5.47 | 5.69 |
| 같은 단어 | 12.21 | 5.00 | 4.88 | 5.08 |
| 오류 줄 | 12.51 | 5.12 | 5.00 | 5.20 |
| 찾은 곳 | 12.69 | 5.20 | 5.07 | 5.28 |
| 지금 찾은 곳·괄호 짝 | 11.28 | 4.62 | 4.51 | 4.69 |

| 그 밖 | 대비 | 기준 |
|---|---|---|
| 줄 번호 `textMuted` / `surface2` | 4.94 | 4.5 |
| 활성 줄 번호 `codeText` / primary 10% on surface2 | 10.71 | 4.5 |
| 오류 줄 번호·짝 없는 괄호 `error` / `errorSoft` | 4.88 | 4.5 |
| 오류 줄 밑줄 `error` / 오류 줄 면 | 4.99 | 3 (UI) |
| 커서 `codeText` / `codeBg` | 14.24 | 3 (UI) |
| 상자 테두리 `lineStrong` / `codeBg` · `bg` | 3.55 · 3.23 | 3 (UI) |
| 포커스 링 `secondary` / `bg` | 12.96 | 3 (UI) |
| 찾은 곳 테두리 `accentText` / `accentSoft` | 5.28 | 3 (UI) |
| 글자 크기 숫자·아이콘 `text` / `surface2` | 12.07 | 4.5 |

## 3. 글자

- 글꼴 `var(--font-mono)` = pyRoad Mono(D2Coding). 퀘스트 레이아웃(`(protected)/quest/layout.tsx`)과 테스트 페이지에서만 조각 CSS를 싣습니다([fonts.md](fonts.md)). 리거처 끔(`fontVariantLigatures: 'none'`), 커닝 끔, 자간 0. CodeMirror 기본 테마가 `.cm-scroller`에 `monospace`·행간 1.4를 넣으므로 거기도 덮습니다.
- 행간 1.6(`TYPE.code.lineHeight`), 글자 크기와 상관없이 같은 비율.
- **글자 크기는 14·16·18·20px만**(`CODE_FONT_SIZES`), 기본 16px(`TYPE.code.size`). D2Coding은 반각이 0.5em이라 홀수 px에서는 반올림으로 한글 1자 ≠ 영문 2자가 됩니다(15px: 주석 `#` 열 3~4px 어긋남, P2-01·P2-10). 홀수 px는 설정·테스트·저장값 어디에도 넣지 않습니다(저장소에 15가 있으면 16으로 읽음).
- px로 둡니다(rem 아님): 브라우저 글자 크기 배율이 곱해지면 홀수·소수 px가 될 수 있어서입니다. 더 크게 보고 싶은 아이는 에디터 버튼으로 20px까지 키웁니다.
- 글자 크기 버튼: 에디터 위 오른쪽, `surface2` 알약 안에 `A↓` · 숫자 · `A↑`. 버튼은 48px 터치 영역, 이름은 "코드 글자 작게/크게", 숫자는 `<output>`(바뀌면 화면 읽기 프로그램이 "코드 글자 크기 18"을 읽음). 양 끝에서는 버튼이 꺼집니다.
- 선택값은 기기 저장소 `pyroad.codeFontSize.v1`(움직임·소리 설정과 같은 이름 규칙). 로그인 사용자 서버 저장(`users.settings`)은 아직 없음 — 기기를 바꿔 쓰는 아이가 많으면 소리 설정(P2-14)과 같은 방식으로 붙입니다.

## 4. 공책 머리 (P6-03)

시안 `NotebookPage`의 `.f-notebook-head`를 따라 한 줄에 **제목 "나의 주문 공책"(Jua, h2) · "처음 코드로"(글자 버튼) · 글자 크기 알약**을 둡니다. `CodeEditor`의 `title`(왼쪽)·`actions`(글자 크기 앞) 자리에 넣습니다.

- 좁은 쪽: 퀘스트 쪽(`.qw-page`, 컨테이너) 안 폭이 24rem 미만이면(360px 화면 ≈ 18rem) 제목 아이콘을 빼고 "처음 코드로"는 아이콘만 보입니다(이름은 `aria-label`로 그대로). 모든 버튼은 48px 터치 영역 그대로.
- "처음 코드로": 세션의 `starterCode`(이번 단계를 처음 열었을 때 코드. 프로젝트는 이전 단계 코드 + 이번 단계 시작 코드, 저장된 코드는 제외)로 되돌립니다. 지금 코드와 같으면 꺼지고, 다르면 고친 코드가 사라지므로 확인 창("그대로 두기" / "처음 코드로")을 띄웁니다. 확인 창 모듈은 처음 누를 때 받습니다(`next/dynamic`, 퀘스트 첫 로드 JS에 넣지 않음 — 넣으면 약 10.7KB gzip).
- 되돌리면 문서가 바뀌므로 오류 줄 표시도 지워집니다.
- 바깥 손잡이: `CodeEditor`의 `ref`는 `CodeEditorHandle { insert(text, caret?), moveCursor(±1), undo(), focus(), revealCursor() }`. `insert`는 선택 영역을 바꾸고 커서를 `caret` 자리(기본 끝)에 둔 뒤 포커스하며, 한 번 = 되돌리기 한 번입니다(`isolateHistory`). 커서는 처음에 코드 끝에 있습니다. `CodePanel`이 안에서 만들어 코드 키보드(P6-04)에 넘깁니다.

## 5. 오류 줄

실행 결과에 예외가 있으면(`runResult.hadException`) stderr traceback에서 학생 코드 프레임 `File "<exec>", line N`의 마지막 것(가장 안쪽)을 찾아 그 줄을 표시합니다(`errorLineFromStderr`). 경고(`<exec>:2: SyntaxWarning`)나 학생이 직접 쓴 stderr는 표시하지 않습니다. 학생이 코드를 고치기 시작하면(문서 변경) 표시를 지우고, 다음 실행 결과가 다시 정합니다. 파일 이름은 `pyodide-core.mjs`의 `STUDENT_FILENAME`과 같아야 합니다(단위 테스트가 확인).

## 6. 검사

- 단위(`npx vitest run`): `kidsTheme.test.ts`(색 리터럴 없음·참조 변수가 모두 토큰·구문색 3종·굵게/기울임 없음·리거처 끔·행간·대비 AA), `fontSize.test.ts`(짝수 단계만·기본 16·잘못된 저장값), `errorLine.test.ts`, `CodeEditor.test.tsx`(오류 줄 표시·지우기, 글자 크기 버튼·저장), `NotebookHead.test.tsx`(처음 코드로 꺼짐·확인·취소, `insert`).
- e2e(`e2e/public/editor-alignment.spec.ts`, 비로그인 → CI e2e-smoke): `/dev/editor`에서 실제 렌더를 재서 14·16·18·20px마다 한글 주석 `#` 열 7줄과 주석 속 표 `|` 열 3줄의 x 좌표 차이 **0px**, `파`/`n` 폭 비 2.000, 계산된 글꼴이 pyRoad Mono·리거처 none·행간 1.6배인지 확인합니다. 360px·20px에서 줄이 꺾이지 않는지, 버튼이 짝수 단계만 오가고 저장되는지, 오류 줄 표시도 봅니다. 360·1280px에서 공책 머리 세 요소가 한 줄(세로 가운데 차이 4px 미만)인지와 "처음 코드로" 확인·취소도 봅니다. 실제 실행으로 생긴 오류 줄과 되돌리기는 로그인 e2e `runner.spec.ts`가 봅니다. 같은 측정으로 15px를 강제하면 `#` 열이 3px 어긋나 검사가 실제로 어긋남을 잡는 것을 확인했습니다(2026-11-06).
- 테스트 전용 페이지 `/dev/editor`는 `isTestPagesEnabled()`가 참일 때만 열립니다: 개발 서버, 또는 `PYROAD_TEST_PAGES=1`(e2e `serverEnv`만 넣음). 운영에는 이 변수가 없어 404입니다. 동적 렌더라 정적 페이지 CSP 검사와 상관없고, 퀘스트 밖이라 `fonts:check-build`의 라우트 표에도 없습니다. `?error=N`으로 오류 줄을 띄웁니다.

## 7. 범위 밖

- **모바일 코드 키보드 툴바**(§12-Q3 C안): P6-04에서 `src/components/quest/CodeKeyboard.tsx`로 완료. lg 미만 또는 터치 화면에서만 지연 로드, 키 목록·순서의 근거(1월드 1~2스테이지 정답 코드)는 파일 머리 주석, e2e `code-keyboard.spec.ts`. 모바일 문제 유형은 Phase 7.
- **폰 키보드 대응**(P6-11): 3스테이지부터 그 스테이지 주문(if·for·[ ]·def …)이 앞자리 바로 뒤 "이번 스테이지 주문" 묶음으로 옴(`keyGroups(stage)`). 폰 키보드가 열리고 에디터에 커서가 있으면 띠가 키보드 윗변에 붙는다: `visualViewport`의 `offsetTop + height`(= 키보드 윗변, layout viewport 좌표)로 `position: fixed; top: 0` + `translateY` — iOS Safari는 키보드가 열려도 layout viewport가 그대로이고 visual viewport만 줄고 위로 밀리기도 해서 `bottom: 0`은 키보드 뒤에 숨기 때문. 쪽(`.qw-page`)은 컨테이너 쿼리 상자라 fixed 기준이 되므로 붙을 때만 body로 포털, 자리(`.ck-slot`)는 남아 공책이 출렁이지 않음. 가린 높이(키보드 + 띠)는 `src/lib/editor/keyboardInset.ts` → 에디터 `scrollMargins`로 커서 줄이 띠 위에 오고, 붙는 순간 `revealCursor()`. 확대(pinch zoom) 중에는 띠가 화면 폭보다 넓을 수 있음(드묾). e2e `quest-mobile.spec.ts`는 가짜 visualViewport로 확인
- 통과 도장 같은 공책 장식: P6-06·P6-08.
- 다크 모드: 앱 전체가 범위 밖([tokens.md](tokens.md)). 어두운 코드 상자는 상점 밤하늘 공책(§8)뿐.

## 8. 공책 테마 (상점 아이템, P9-06)

상점 "공책" 3종(밤하늘·바다·솜사탕, 각 450코인)을 쓰면 퀘스트 에디터 **상자 안 색만** 바뀝니다. 장착은 P9-03 `equip_item`이 `users.settings.editor_theme`(아이템 id)에 씁니다(클라이언트 설정 API는 이 키를 못 씀).

- **원본**: `tokens.ts` `EDITOR_THEMES`(테마마다 `EDITOR_THEME_KEYS` 20색 전부) → `globals.css` `[data-editor-theme='night|ocean|candy']` 블록(`tokens.test.ts`가 같은지 검사). 이 블록은 코드 상자 요소에서 색 토큰 변수(`--code-*`·`--surface-2`·`--text-muted`·`--line(-strong)`·`--primary(-soft)`·`--accent-light/soft/text`·`--error(-soft)`·`--surface`·`--text`)를 다시 정할 뿐이라, 키즈 테마(`KIDS_THEME_SPEC`)·틴트·주석 진하기 규칙이 그대로 적용됩니다. 그래서 `codeEditor.css`(에디터가 오기 전 글자)와 상점 견본은 Tailwind `--color-*`가 아니라 토큰 변수를 직접 씁니다(`--color-*`는 `:root`에서 이미 풀린 값이라 상자 안에서 바뀌지 않음).
- **범위**: 코드 상자(`CodeEditor`의 `[data-testid=code-editor]` — 줄 번호·자동 완성·찾기 창 포함)만. 공책 머리·코드 키보드·실행 줄·결과 쪽지·튜터는 앱 색 그대로입니다. 밤하늘은 어두운 상자가 밝은 쪽 위에 놓이는 모양이고(테두리 `lineStrong`이 바깥 `bg`·안쪽 `codeBg` 모두 3:1), 결과 쪽지까지 어둡게 하면 화면 반이 다른 앱처럼 보여 넣지 않았습니다(기본값). 포커스 링(`secondary`)은 바깥 바탕 위라 그대로.
- **문법색**: 기본 공책은 구문색 3종 + 본문색이지만, 테마는 숫자·함수에도 색을 줍니다(키워드·문자열·숫자·함수·주석 5종). 굵게·기울임은 여전히 없음.

| 테마 | 면 · 글자 | 키워드 | 문자열 | 숫자 | 함수 | 주석 |
|---|---|---|---|---|---|---|
| 밤하늘 `night` | `#1E2340` · `#E9ECF8` | 라벤더 `#BBA6FF` | 별빛 금색 `#FFD37A` | 산호 `#FFA99E` | 민트 `#7FDCC4` | `#A3ABCF` |
| 바다 `ocean` | `#F2F9FB` · `#1E3340` | 바다색 `#066883` | 산호 `#A2461F` | 보라 `#6B46B0` | 해초 `#1F6E4C` | `#5B727D` |
| 솜사탕 `candy` | `#FFF6FA` · `#3B2836` | 딸기 `#AD2A69` | 라벤더 `#6A48B4` | 청록 `#0D6E77` | 파랑 `#2C62A8` | `#7D6776` |

- **대비**: `kidsTheme.test.ts`가 §2의 `EDITOR_CONTRAST_PAIRS` 전부(숫자·함수 포함 54조합)를 기본 + 테마 3종 색표(`editorThemePalette`)로 검사합니다. 가장 빠듯한 곳: 밤하늘 같은 단어 위 키워드 4.91·괄호 짝 위 키워드 4.99, 바다 기본 면 주석 4.75·포커스 없는 선택 위 주석 4.60, 솜사탕 같은 단어 위 숫자 4.71·상자 테두리 바깥 3.52.
- **적용**: 퀘스트 레이아웃(`(protected)/quest/layout.tsx`)이 로그인 레이아웃과 같은 조회(`loadOwnUserRow`, React cache)의 `settings`를 `editorThemeFromSettings`(`src/lib/shop/catalog.ts`, 모르는 값·다른 종류 id는 기본)로 읽어 `EditorThemeProvider`에 넣고, `CodeEditor`가 상자에 `data-editor-theme`을 붙입니다. 서버 HTML부터 그 색이라 깜빡이지 않습니다. 코드·프로젝트 퀘스트와 퀴즈 "직접 실행해 보기"가 모두 이 레이아웃 아래입니다. `/dev/editor?theme=night`, 카탈로그 `#editor` "에디터 테마" 견본(기본 + 3종)도 같은 Provider.
- **상점 견본** `ThemeArt`(`ShopItemArt.tsx`): 같은 `data-editor-theme` 블록으로 줄 번호 칸 + 코드 세 줄(키워드·이름·함수·숫자 / 함수·문자열 + 활성 줄·커서 / 주석)을 색 막대로 그립니다.
- 검사: 단위 `kidsTheme.test.ts`·`tokens.test.ts`·`catalog.test.ts`(`editorThemeFromSettings`), e2e `editor-theme.spec.ts`(360·1280: 상점 공책 탭에서 쓰기 → 퀘스트 서버 HTML에 `data-editor-theme` + CodeMirror 면 색 → 그만 쓰기 → 기본).
- CodeMirror 기본 테마의 밝은/어두운 구분(`&light`/`&dark`)은 쓰지 않습니다 — 우리가 덮지 않는 찾기 창 닫기 단추 정도만 밝은 기본값이라 밤하늘에서 조금 흐릴 수 있습니다(드묾).
