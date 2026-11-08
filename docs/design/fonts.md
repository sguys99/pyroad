# 웹폰트 (P2-10, 랜딩 서브셋 P4-12)

> 근거: [P0-14 한글 웹폰트 로딩 전략](../spikes/P0-14-korean-fonts.md), 계획서 §2.5·§2.10, §12-Q15·Q27·Q28. 라이선스 정본은 [`docs/assets-license.md`](../assets-license.md) §2(P2-17)입니다.

## 1. 구성

모든 폰트는 **우리 도메인에서** 제공합니다(Google Fonts·jsDelivr 같은 외부 요청 없음, CSP `font-src 'self'`). 모두 `font-display: swap`입니다.

| 토큰 | 글꼴 | 원본 | 랜딩 `/` | 앱 화면 | 파일 위치 |
|---|---|---|---|---|---|
| `--font-display` (`font-display`) | **Jua** | google/fonts `ofl/jua` 1.001 | 텍스트 서브셋 34KB(**제목 글꼴 자리 글자만**), preload | unicode-range 조각 86개 (합계 537KB) | `src/fonts/jua/` |
| `--font-sans` (`font-sans`, 기본) | **pyRoad Sans** = Pretendard Variable 이름 변경 | npm `pretendard` 1.3.9 | 텍스트 서브셋 72KB(가변 **400~700** 한 파일), preload | 공식 가변 동적 서브셋 92조각 (2.8MB) | `src/fonts/pyroad-sans/` |
| `--font-mono` (`font-mono`) | **pyRoad Mono** = D2Coding Regular 이름 변경 | naver/d2-coding-font 1.3.2 | 싣지 않음 (랜딩에 코드 없음) | 한자·가나 뺀 조각 109개 (957KB), **퀘스트 화면에서만** | `src/fonts/pyroad-mono/` |

- Gaegu·Gowun Dodum·Noto Sans KR·JetBrains Mono는 쓰지 않습니다(§12-Q28).
- **공유 카드**(`next/og`, P2-19)는 브라우저 폰트가 아니라 서버 함수에 번들하는 TTF/OTF 3개(`src/fonts/share-card/`: Jua KS X 1001 2,350자, pyRoad Sans 600 2,350자, pyRoad Sans 700 11,172자 = 대체 폰트, 합계 2.9MB)를 씁니다. 자세한 것은 [share-card.md](share-card.md) §6.
- **랜딩**(`src/app/page.tsx`)은 `src/fonts/landing.ts`의 `next/font/local` 두 개(제목·본문)만 import합니다. 랜딩 문구에 쓰인 글자만 담은 파일이라 첫 페인트와 거의 동시에 브랜드 폰트로 그려집니다. 앱 조각 CSS는 싣지 않습니다(렌더 차단 CSS 예산). 두 파일이 담는 글자가 다릅니다(P4-12, §3 "랜딩 글자 모으기"): **Jua는 제목 글꼴 자리(`font-display` 클래스·h1~h3)에 쓰인 글자 + 숫자·문장부호**, **pyRoad Sans는 랜딩 글자 전부 + ASCII**(굵기 축 400~700, 브라우저 기본 OpenType 기능 + `tnum`).
- **앱 화면**은 `src/fonts/app.css`(Jua + pyRoad Sans 조각)를 `(protected)/layout.tsx`·`notice/layout.tsx`·`[...missing]/page.tsx`에서 import합니다. 화면에 나온 글자가 든 조각만 받으므로 닉네임·튜터 답변처럼 미리 모르는 글자도 그립니다. 루트 레이아웃·루트 `not-found.tsx`에서 import하면 랜딩에도 실리니 넣지 마세요.
- **코드 글꼴**은 `(protected)/quest/layout.tsx`에서만 `pyroad-mono/pyroad-mono.css`를 import합니다. 퀘스트 밖에서 `font-mono`는 시스템 고정폭으로 그려집니다.

### 토큰과 폴백

`src/app/globals.css`의 `@theme inline`:

```
--font-display: var(--font-display-landing, 'Jua'), 'Jua', 'Jua Fallback Malgun', 'Jua Fallback Noto', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', system-ui, sans-serif;
--font-sans:    var(--font-sans-landing, 'pyRoad Sans'), 'pyRoad Sans', 'pyRoad Sans Fallback Malgun', 'pyRoad Sans Fallback Noto', 'Apple SD Gothic Neo', …, sans-serif;
--font-mono:    'pyRoad Mono', 'D2Coding', 'NanumGothicCoding', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
```

- 맨 앞 `var(--font-*-landing, …)`은 랜딩 래퍼(`next/font`의 `variable` 클래스)에서만 채워집니다. `:root`에 둔 변수는 거기서 한 번 풀려 상속되므로, **CSS에서는 `var(--font-sans)` 대신 `font-sans`·`font-display` 유틸리티(`@apply`)를 씁니다**(제목 규칙이 이렇게 되어 있음). `--font-mono`는 랜딩 변수가 없어 `var()`로 써도 됩니다(CodeMirror 테마).
- **한글 폴백 보정** `src/fonts/fallbacks.css`(생성물): `next/font`의 폴백 보정은 라틴(Arial) 기준이라 한글은 보정 없이 그려집니다. 그래서 시스템 한글 폰트를 `local()`로 감싸 한글 평균 폭이 웹폰트와 같게 `size-adjust`를 겁니다(값 = 웹폰트 한글 폭 / 시스템 한글 폭, `ascent/descent-override` = 웹폰트 값 / size-adjust, 범위는 한글만).

  | 폴백 | 한글 평균 폭 | Jua (0.814em) | pyRoad Sans (0.864em) |
  |---|---|---|---|
  | 맑은 고딕 (Windows, malgun.ttf 6.69 실측) | 1.000em | 81.42% | 86.43% |
  | Noto Sans CJK KR (Android·크롬북, P0-14 실측) | 0.920em | 88.50% | 93.94% |
  | Apple SD Gothic Neo (iOS·macOS) | 미측정 | 보정 없음 | 보정 없음 |

### 전역 기본값 (P0-14 §4.7)

- `body`: 17px(`1.0625rem`) · 행간 1.7 · 자간 0 · `word-break: keep-all` · `overflow-wrap: break-word`. 크기·행간 유틸리티(`text-sm` 등)가 있으면 그쪽이 우선입니다.
- `h1`~`h3`: `font-display`(Jua). Jua는 굵기가 하나뿐이지만 `@font-face`를 `font-weight: 100 900`으로 선언해 `font-bold` 제목도 **합성 굵게 없이** 그대로 그립니다.
- `code`·`kbd`·`samp`·`pre`: `font-mono` + `font-variant-ligatures: none`.
- 색·간격 등 다른 토큰은 P2-09에서 정합니다(이 항목은 글꼴만).

## 2. 코드 글꼴 규칙

- **D2Coding은 짝수 px만** 씁니다(14·16·18·20). 반각이 0.5em이라 홀수 px에서는 반올림으로 한글 2칸이 어긋납니다. 실측(Chromium, P2-10): 16px에서 `가`/`a` 폭 비 2.000, 주석 `#` 열 차이 0px / 15px에서 1.875, 4px 어긋남 / 14px 2.000, 0px (P2-01에서 처음 발견).
- 리거처 없음: CodeMirror 테마에 `fontVariantLigatures: 'none'`(`!=`가 한 글자처럼 보이지 않게). CodeMirror 기본 테마가 `.cm-scroller`에 `monospace`를 직접 넣으므로 거기도 `var(--font-mono)`를 줍니다.
- 에디터는 기본 16px, 14·16·18·20px 네 단계 조절, 행간 1.6입니다(P2-18, [editor.md](editor.md)). 한글 주석 정렬은 e2e `editor-alignment.spec.ts`가 단계마다 실제 렌더로 0px인지 잽니다.
- 파이썬 `f"{x:<6}"` 패딩은 글자 **수** 기준이라 D2Coding에서도 한글 표가 어긋납니다(P0-14 §4.6).

## 3. 파일과 다시 만드는 법

```
src/fonts/
├── landing.ts            # next/font/local (랜딩 텍스트 서브셋 2개)
├── app.css               # 앱 화면: jua.css + pyroad-sans.css
├── fallbacks.css         # 한글 폴백 보정 (생성물, globals.css가 @import)
├── manifest.json         # 생성물: 원본 주소·해시, 랜딩 글자, 파일 해시, 메트릭
├── jua/                  # Jua-landing.woff2, jua.css, slices/, OFL.txt, README.md
├── pyroad-sans/          # pyRoadSans-landing.woff2, pyroad-sans.css, slices/, OFL.txt, README.md
├── pyroad-mono/          # pyroad-mono.css, slices/, OFL.txt, README.md
└── share-card/           # 공유 카드 TTF/OTF (서버 전용): jua/, pyroad-sans/ (각 OFL.txt) + README.md
```

`landing.ts`·`app.css` 말고는 모두 생성물입니다. 직접 고치지 마세요.

```bash
pip install -r scripts/fonts/requirements.txt   # fontTools 4.63 + brotli (처음 한 번)
npm run fonts:build -- --landing                # 랜딩 문구를 바꿨을 때: 랜딩 서브셋만 (몇 초)
npm run fonts:build -- --share-card             # 공유 카드 TTF/OTF만 (약 13초)
npm run fonts:build                             # 전부 (원본 받기 → 서브셋 → 조각 → CSS·폴백·README·manifest, 20코어 약 30초)
npm run fonts:check                             # 검사 (Node만, prebuild·CI)
```

- 원본은 `scripts/fonts/build-fonts.mjs`의 `SOURCES`에 **주소·sha256을 고정**하고 `node_modules/.cache/pyroad-fonts/`에 받습니다(커밋하지 않음, `FONT_CACHE`로 바꿀 수 있음). 해시가 다르면 멈춥니다.
- 서브셋·조각은 `scripts/fonts/fontkit.py`(fontTools, `python3 -P -E`로 실행): 힌팅 제거, 레이아웃 기능·저작권·라이선스 name 레코드 유지, `--family`면 이름 변경. 조각 묶음은 npm `pretendard`의 가변 동적 서브셋 CSS를 기준으로 하고, 거기 없는 글자(D2Coding의 라틴 확장·그리스·키릴·괘선 등)는 코드포인트 순 160자씩 나눕니다. `unicode-range`에는 실제 글리프가 있는 글자만 적습니다.
- **랜딩 글자 모으기**(`scripts/fonts/landing-text.mjs`, P4-12): `src/app/page.tsx`에서 `@/`·상대 경로 import(동적 `import()` 포함)를 따라가 닿는 모든 모듈의 문자열·JSX 텍스트를 TypeScript AST로 모읍니다(주석·타입 자리 제외). 화면에 글자로 안 그려지는 자리는 뺍니다: HTML 요소 속성(`value`·`placeholder`·`label` 말고 전부 — `title` 툴팁·`alt`·`aria-*`), 컴포넌트의 `aria-*`·`data-*`·`className` 등, `console.*`·`new Error()` 인자, `export const metadata`, 그리고 `NON_TEXT_MODULES`(디자인 토큰 대비표 설명·연출 단계 판정 이유). 이 글자 전부가 **본문(pyRoad Sans) 서브셋**입니다.
  - **제목(Jua) 서브셋**은 그중 제목 글꼴이 걸리는 자리의 글자만 담습니다. 제목 글꼴은 `font-display` 클래스와 h1~h3(`globals.css`)으로만 걸리므로(CSS `font-family`는 tokens:check가 막음, 랜딩이 import한 CSS의 `@apply font-display` 클래스도 읽음) 그 JSX 아래 글자를 모으고, 안쪽 `font-sans`·`font-mono`에서 멈춥니다. 값은 따라갑니다: 컴포넌트 prop(`{title}` → 사용처의 `title=`, `{children}` → 사용처 children, `{...props}`로 감싼 컴포넌트까지), 그 밖의 이름(`{f.name}`·`{worldLabel(n)}`·`{HEADINGS[ctx]}`)은 **같은 이름의 변수·객체 속성·함수 반환값을 모든 모듈에서 이름 기준으로**(일부러 넉넉하게) 모읍니다. 이름은 3단계까지, 한두 글자 이름(콜백 매개변수)·컴포넌트 이름·객체 통째는 따라가지 않습니다. 제목 안에 쓴 컴포넌트는 그 컴포넌트가 그리는 글자 전부를 제목으로 봅니다. 어디서 온 글자인지는 `node scripts/fonts/landing-text.mjs --why`.
  - Jua의 라틴 글리프가 무거워(ASCII 95자만 23KB) 제목 서브셋의 영문은 제목 문구에 나온 글자(대·소문자 둘 다)만 넣고, 숫자·흔한 문장부호(`DISPLAY_ALWAYS_CHARS`)는 늘 넣습니다.
  - 놓친 제목 글자는 시스템 글꼴(폴백 보정된 맑은 고딕 등)로 보입니다. 그래서 **두 번 더 검사**합니다: 빌드 뒤 `check-build.mjs`가 정적 HTML을 CSS 캐스케이드대로(층 → 명시도 → 순서, jsdom) 제목·본문 글자로 나눠 **실제 preload된 서브셋 파일의 cmap**과 비교하고, e2e `e2e/public/landing-fonts.spec.ts`가 스크롤·말풍선·체험 실행·로그인 시트·로그인 오류 안내까지 띄워 계산된 글꼴(`displayLanding`·`sansLanding`)별 글자와 본문 굵기(400~700 안)를 확인합니다.
  - 랜딩 문구는 `npm run fonts:build -- --landing`으로 다시 만듭니다(몇 초). 서브셋 설정(굵기 축·OpenType 기능·담는 글자)은 `build-fonts.mjs`의 `FAMILIES.*.landingSubset`, `landing.ts`의 `weight`와 같아야 합니다(fonts:check가 비교).
- 서브셋 명령 `fontkit.py subset --sfnt`는 WOFF2 대신 압축 없는 TTF/OTF를 냅니다(satori는 WOFF2를 못 읽음). CFF(OTF)는 서브루틴을 풀면 커져서 그대로 둡니다. 공유 카드 글자 범위는 `scripts/fonts/share-card-chars.mjs`(KS X 1001 2,350자 = EUC-KR 한글 영역 디코딩, 닉네임 허용 글자와 같은 집합).
- **검사**: `fonts:check`는 랜딩 글자가 서브셋에 있는지(제목 자리 글자 → Jua, 전부 → pyRoad Sans. 원본 글꼴에 아예 없는 이모지 등은 manifest `notInFont`만 허용)와 서브셋 합계(예산 150KB 넘으면 실패, preload 목표 100KB 넘으면 경고), `landing.ts` 굵기 선언, 파일 해시, 예약 이름 잔존, `OFL.txt`·README, 앱 코드의 외부 폰트(`next/font/google`·Google Fonts·jsDelivr), 그리고 공유 카드 폰트(manifest 해시·남는 파일·예약 이름·`OFL.txt`·닉네임 허용 글자 2,350자 + 영문·숫자가 세 파일 모두에, 11,172자가 대체 폰트에 있는지)를 봅니다. 랜딩 문구를 바꾸고 서브셋을 안 만들면 실패 메시지가 `npm run fonts:build -- --landing`을 안내합니다. postbuild의 `scripts/fonts/check-build.mjs`는 라우트별 font preload·CSS를 보고 아래 예산과 랜딩 HTML 글자(위)를 확인합니다. 다른 빌드 폴더를 볼 때는 `FONTS_CHECK_NEXT_DIR=<경로>/.next`.

## 4. 예산과 실측 (2026-11-06, `npm run build` Turbopack)

| 라우트 | font preload | 렌더 차단 CSS (gzip) | 실리는 조각 CSS |
|---|---|---|---|
| `/` 랜딩 | 2 (Jua·pyRoad Sans 랜딩 서브셋) | 19.4KB (폰트 선언은 local 폴백 4개 + 서브셋 2개) | 없음 |
| `/world` · `/settings` · `/notice` | 0 | 38.0KB | Jua 86 + pyRoad Sans 92 |
| `/quest/[questId]` | 0 | 50.9KB | + pyRoad Mono 109 |

- (P2-10 당시) **랜딩 폰트 전송 105KB / 예산 150KB**(§2.10, 요청 2개, CLS 0, Playwright 측정). 랜딩 글자 238개(한글 음절 152개). 넘으면 postbuild 실패.
- 랜딩 렌더 차단 CSS 19.4KB는 예산 15KB를 넘지만 대부분 Tailwind·shadcn 기본 CSS입니다(예전 Noto Sans KR `@font-face` 249개는 빠짐). 줄이는 일은 P4-12. postbuild는 경고만 냅니다.
- Turbopack 누수 없음: `next-font-manifest`에서 랜딩만 preload가 있고, 코드 글꼴 조각은 퀘스트 라우트에만 실립니다. 다른 라우트에 preload가 붙거나 랜딩 preload가 2개를 넘으면 postbuild가 실패합니다(Next를 올릴 때 다시 확인).
- 앱 화면에서 실제로 받은 조각(1280px, 첫 방문): 월드맵 Jua 4 + pyRoad Sans 10, 퀘스트 1-1 Jua 7 + pyRoad Sans 16 + pyRoad Mono 7.
- 저장소 용량: 폰트 파일 합계 약 4.6MB(§12-Q27 예상 3~6MB 안).

### 랜딩 서브셋 (P4-12, 2026-11-08)

같은 문구(본문 528자·제목 자리 175자, 한글 음절 약 440·150)로 잰 값입니다. 크기는 글자 수에 거의 비례합니다(본문 약 0.14KB/자, 제목 약 0.13KB/자).

| 구성 | Jua | pyRoad Sans | 합계 (= preload) |
|---|---|---|---|
| P2-10 방식 (두 파일 모두 랜딩 글자 전부 + ASCII, 가변 45~920, 기능 전부) | 66.8KB | 113.6KB | 180.4KB |
| P4-12 (Jua 제목 자리 글자만 · Sans 400~700 + 기본 기능) | **33.9KB** | **71.8KB** | **105.8KB** |

- 줄인 몫: Jua 제목 자리만 −33KB(그중 영문 축소 약 −10KB), Sans 가는 쪽 마스터 버리기(400~700) −27%, ss01~·case 같은 대체 글리프 빼기 약 −13%, 화면에 안 나오는 문자열 빼기 약 −3KB.
- 정적 굵기 파일로 쪼개는 것은 손해입니다: 400 한 굵기만 해도 가변 400~700의 약 87%라 굵기 2개면 더 커지고 preload도 3개가 됩니다.
- **앞으로 문구가 늘 때**: 본문 +300자·제목 +60자면 약 157KB로 예산(150KB)을 넘습니다(측정). 본문 +200자 안팎까지가 여유입니다. 넘으면 fonts:check·postbuild가 실패하므로 그때 고를 수 있는 것: ① 손으로 띄우는 문구(말풍선·체험 오류·로그인 오류)만 담은 두 번째 본문 서브셋을 `unicode-range` + preload 없이 붙이기(첫 로드에 그려지지 않는 글자만 늦게 받음 — 어느 문구가 첫 로드에 안 그려지는지 정적으로 가르는 기준이 필요), ② 본문 preload 끄기(`preload: false`, 첫 화면 본문만 조금 늦게 바뀜). 지금 동적 import로만 닿는 모듈의 고유 글자는 한글 33자(약 5KB)뿐이라 ①을 import 경계로 가르는 것은 효과가 작습니다.
- 첫 화면 preload 목표 100KB(경고): 지금 105.8KB. 히어로·헤더 트리 글자만 preload하는 2단 구성은 preload 88KB · 전송 +7KB로 계산돼(측정) 효과에 비해 같은 글꼴 이름을 두 `@font-face`가 나눠 쓰는 결합이 생겨 하지 않았습니다.
- 모양: 360·1280px 전후 스크린샷 화소 차이 0.02~0.05%(굵기 600·650 글자의 안티앨리어싱), 페이지 높이 같음.

## 5. 라이선스

출처·버전·원본 해시·저작권자·예약 이름·바꾼 것은 [`docs/assets-license.md`](../assets-license.md) §2(정본)에 있습니다. 요점만:

- 셋 다 SIL OFL 1.1. 폴더마다 `OFL.txt`(원본 그대로)와 README. 예약 이름이 있는 Pretendard·D2Coding은 수정본(서브셋·조각)이라 이름을 `pyRoad Sans`·`pyRoad Mono`로 바꿨고, Jua는 예약 이름이 없어 그대로입니다. 저작권·상표·라이선스 name 레코드(0·7·13·14)는 원문 그대로 둡니다(`fonts:check`가 예약 이름 잔존을 봄).
- 폰트 폴더를 추가·삭제하면 `docs/assets-license.md`의 표도 고칩니다(`npm run assets:license`가 `src/fonts/<이름>/`마다 기록을 확인).
- 디자인 프로토타입(`design/prototypes/`)의 base64 서브셋도 같은 규칙입니다(§12-Q27).

## 6. 남은 일

- **iOS·macOS Apple SD Gothic Neo 폴백 보정**: 한글 폭을 못 재서 보정 없이 둡니다. 실기기에서 FOUT·CLS를 보고 값을 넣습니다(P0-14 남은 리스크와 같음).
- D2Coding 1.3.3~1.4.0(2026-07~10)이 새로 나왔습니다. 메트릭·글리프 차이를 확인하기 전까지 P0-14·P2-01에서 잰 1.3.2를 씁니다.
- 공유 카드 폰트는 P2-19에서 만들었습니다([share-card.md](share-card.md) §6). 이미지 라우트·파일 추적 설정은 P9-07.
