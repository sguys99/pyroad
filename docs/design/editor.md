# 코드 에디터 (CodeMirror 키즈 테마, P2-18 · 공책 머리 P6-03)

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

- 상자: 흰 면(`codeBg`) + 1px `lineStrong` 테두리 + 반경 `--round-m`(14). 그림자 없음. 높이 200~400px, 넘치면 상자 안에서 스크롤.
- 줄 번호: `surface2` 면 + `textMuted` 숫자, 오른쪽 1px `line` 구분선. 활성 줄 번호는 본문색 + 옅은 초록.
- 포커스: 앱 공용 포커스 링과 같은 2px `secondary` + 간격 2px(`--focus-w`·`--focus-offset`).
- 커서: 2px 본문색. 깜빡임은 CodeMirror 기본(1.2초 주기 opacity)이고 연출 단계와 상관없이 둡니다(입력 위치를 알리는 기능 신호). **동작 줄이기에서만 멈추고 늘 보이게** 합니다(`app.css`, P2-12, e2e `motion-tiers`).
- 활성 줄 띠·활성 줄 번호는 **에디터에 포커스가 있을 때만** 칠합니다(P6-03). 실행 버튼을 누른 뒤처럼 커서가 없는데 줄만 칠해져 있으면 오류 줄 띠와 섞여 잡음입니다.
- 접기 칸(▸)은 뺐습니다. 시안 공책에 없고 아이에게는 잡음입니다. 자동 완성·괄호 자동 닫기·찾기(Ctrl+F)는 그대로이고 찾기 창 문구는 한국어(`KO_PHRASES`).
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
- 바깥 손잡이: `CodeEditor`의 `ref`는 `CodeEditorHandle { insert(text, caret?), focus() }`. `insert`는 선택 영역을 바꾸고 커서를 `caret` 자리(기본 끝)에 둔 뒤 포커스합니다(P6-04 코드 키보드 툴바용, `CodePanel`의 `editorRef`로 넘김).

## 5. 오류 줄

실행 결과에 예외가 있으면(`runResult.hadException`) stderr traceback에서 학생 코드 프레임 `File "<exec>", line N`의 마지막 것(가장 안쪽)을 찾아 그 줄을 표시합니다(`errorLineFromStderr`). 경고(`<exec>:2: SyntaxWarning`)나 학생이 직접 쓴 stderr는 표시하지 않습니다. 학생이 코드를 고치기 시작하면(문서 변경) 표시를 지우고, 다음 실행 결과가 다시 정합니다. 파일 이름은 `pyodide-core.mjs`의 `STUDENT_FILENAME`과 같아야 합니다(단위 테스트가 확인).

## 6. 검사

- 단위(`npx vitest run`): `kidsTheme.test.ts`(색 리터럴 없음·참조 변수가 모두 토큰·구문색 3종·굵게/기울임 없음·리거처 끔·행간·대비 AA), `fontSize.test.ts`(짝수 단계만·기본 16·잘못된 저장값), `errorLine.test.ts`, `CodeEditor.test.tsx`(오류 줄 표시·지우기, 글자 크기 버튼·저장), `NotebookHead.test.tsx`(처음 코드로 꺼짐·확인·취소, `insert`).
- e2e(`e2e/public/editor-alignment.spec.ts`, 비로그인 → CI e2e-smoke): `/dev/editor`에서 실제 렌더를 재서 14·16·18·20px마다 한글 주석 `#` 열 7줄과 주석 속 표 `|` 열 3줄의 x 좌표 차이 **0px**, `파`/`n` 폭 비 2.000, 계산된 글꼴이 pyRoad Mono·리거처 none·행간 1.6배인지 확인합니다. 360px·20px에서 줄이 꺾이지 않는지, 버튼이 짝수 단계만 오가고 저장되는지, 오류 줄 표시도 봅니다. 360·1280px에서 공책 머리 세 요소가 한 줄(세로 가운데 차이 4px 미만)인지와 "처음 코드로" 확인·취소도 봅니다. 실제 실행으로 생긴 오류 줄과 되돌리기는 로그인 e2e `runner.spec.ts`가 봅니다. 같은 측정으로 15px를 강제하면 `#` 열이 3px 어긋나 검사가 실제로 어긋남을 잡는 것을 확인했습니다(2026-11-06).
- 테스트 전용 페이지 `/dev/editor`는 `isTestPagesEnabled()`가 참일 때만 열립니다: 개발 서버, 또는 `PYROAD_TEST_PAGES=1`(e2e `serverEnv`만 넣음). 운영에는 이 변수가 없어 404입니다. 동적 렌더라 정적 페이지 CSP 검사와 상관없고, 퀘스트 밖이라 `fonts:check-build`의 라우트 표에도 없습니다. `?error=N`으로 오류 줄을 띄웁니다.

## 7. 범위 밖

- **모바일 코드 키보드 툴바**(`(` `)` `:` `"` `=` `Tab` `print` 같은 자주 쓰는 토큰 줄, §12-Q3 C안): **P6-04**(Phase 6 퀘스트 화면 개편), 모바일 문제 유형은 Phase 7. 시안의 `.f-keys`가 출발점이고, 넣기는 §4의 `CodeEditorHandle.insert`를 씁니다.
- 통과 도장 같은 공책 장식: P6-06·P6-08.
- 다크 모드: 앱 전체가 범위 밖([tokens.md](tokens.md)).
