# 에셋 파이프라인 (P2-16)

> - 근거: 계획서 §2.5(애니메이션·공유 카드)·§2.10(성능 예산)·§8 X14·§12-Q28(B 마법 그림책, **진짜 질감이 필요한 정지 그림만 래스터**) · [P0-07](../spikes/P0-07-mascot-animation.md) §6.2·§6.3(리그, B32) · [P0-10](../spikes/P0-10-og-share-card.md)(공유 카드 제약) · [rig.md](rig.md) · [sound.md](sound.md)
> - 코드: `scripts/assets/` (단위 테스트 `scripts/assets/__tests__/`) · SVGO 설정 `svgo.config.mjs`
> - 검사 한 번에: **`npm run assets:check`** (CI `e2e-smoke` job, [ci.md](../ci.md) "에셋 검사")

## 한눈에

| 종류 | 원본 | 처리 | 결과 위치 | 파일 규칙 | 예산 |
|---|---|---|---|---|---|
| 캐릭터 (파이뱀·버그버그·별똥이) | 코드 `src/components/characters/rig/*/geometry.ts`·`Markup.tsx` | 없음 (코드가 원본) | 번들 | 리그 규칙 ([rig.md](rig.md)) | 캐릭터당 요소 40개 안팎, 정적 그림 gzip 6~10KB |
| SVG 배경·일러스트·아이콘 | `public/**/*.svg` | `npm run assets:svg` (SVGO) | 같은 자리 | kebab-case `.svg` | 파일당 40KB |
| 종이 결 타일 (생성) | `scripts/assets/lib/textures.mjs` `TEXTURES` | `npm run assets:textures` | `public/textures/` | `<id>.v<N>.png` | 타일당 10KB |
| 래스터 정지 그림 (히어로·작은 정지 그림·공유 카드 배경·스캔 질감) | `assets-src/raster/` + `scripts/assets/raster.config.mjs` | `npm run assets:raster` (sharp) | `public/images/` · `assets/share-card/` · `public/textures/` | `<id>[-<폭>w].v<N>.<webp\|avif\|png>` + `raster.lock.json` | 아래 표 |
| 일회성 Lottie 이펙트 (2~3종) | LottieFiles 등에서 받은 JSON | `npm run assets:lottie` (검사만) | `public/animations/` | `<id>.v<N>.json` | 60KB, 4초, 60fps |
| 사운드 | Kenney CC0 등 | `bash scripts/build-sounds.sh` | `public/sounds/{sfx,bgm}/` | `<id>.v<N>.webm` + `.m4a` | [sound.md](sound.md) |
| 폰트 | P2-10에서 정함 | P2-10 | P2-10 | 자체 호스팅 + 폴더마다 `OFL.txt` | 랜딩 폰트 전송 150KB (§2.10) |

- **버전 붙은 이름 = 1년 immutable 캐시.** `/images/*`·`/textures/*`·`/animations/*`는 `/sounds/*`와 같이 `Cache-Control: public, max-age=31536000, immutable`(`next.config.ts` `VERSIONED_ASSET_DIRS`)이고 미들웨어(세션 갱신)를 타지 않습니다(`src/middleware.ts` matcher). 그래서 **내용을 바꾸면 반드시 버전을 올리고**, 같은 이름을 다른 내용으로 덮어쓰려 하면 스크립트가 멈춥니다. 옛 버전 파일은 경고만 내고 남겨 두니, 배포된 적이 있으면 한 릴리즈 뒤에 지웁니다.
- 이 세 폴더에는 파이프라인 생성물만 둡니다. 손으로 넣은 파일·버전 없는 이름은 `assets:check`가 실패시킵니다.
- **라이선스**: 받은 에셋(이미지·Lottie·사운드·폰트)은 출처 URL·작가·라이선스·받은 날짜·원본 해시를 [`docs/assets-license.md`](../assets-license.md)(X14, P2-17)에 **같은 커밋에서** 기록합니다. 허용·금지 라이선스와 생성 도구·Lottie 기록 양식도 거기 있습니다. 배포 파일이 문서에 없으면 `assets:check`의 "라이선스 기록" 단계가 실패합니다. 자체 생성물(리그·종이 결 타일·`valid-pop.json`)은 저장소 라이선스(Apache 2.0)를 따릅니다.

## 1. 캐릭터: 리그 코드

캐릭터는 SVG 파일이 아니라 **리그 코드**입니다 (P0-07 채택, [rig.md](rig.md)). `assets:svg`의 대상이 아니고, 래스터 부위도 쓰지 않습니다(SVG 안 래스터 `<image>`는 공유 카드 resvg가 그리지 않음: P0-10).

새 캐릭터·새 코스튬·부위를 바꿀 때 절차:

1. **일러스트 생성·수작업**: 이미지 생성 도구나 손그림은 참고용(무드보드)으로만 씁니다.
2. **부위별 단순 벡터**: 몸·머리·눈·입·꼬리처럼 움직이는 단위로 나눠 다시 그립니다. 그라디언트·필터는 최소로, 글자는 경로로(`<text>` 금지).
3. **SVGO**: 부위 SVG를 `npx svgo --config svgo.config.mjs <파일>`로 정리해 좌표·경로를 짧게 합니다(소수점·불필요한 그룹 제거).
4. **geometry 상수**: 정리된 경로·좌표를 `src/components/characters/rig/<캐릭터>/geometry.ts`(파라미터 → 속성 순수 함수)와 `Markup.tsx`로 옮깁니다. SVG 파일은 저장소에 남기지 않습니다(원본은 코드 하나).

규칙: **캐릭터당 요소 40개 안팎**(표정 소품·코스튬 제외). 요소가 많을수록 매 프레임 `setAttribute`가 늘어 저사양에서 프레임이 떨어집니다(P0-07 §4.3). 정적 그림과 라이브 첫 렌더가 같은지는 `static.test.tsx`가 확인합니다.

## 2. SVG 배경·일러스트·아이콘

```bash
npm run assets:svg              # public/**/*.svg 최적화 (이미 최적화된 파일은 그대로)
npm run assets:svg -- --check   # 최적화 안 된 파일·규칙 위반이 있으면 exit 1
```

- 대상: `public/` 아래 모든 `.svg`(`public/pyodide/` 제외). 지금은 0개입니다. 화면 안 아이콘은 Lucide·자체 React 컴포넌트가 우선이고, 파일로 둘 때만 여기에 해당합니다.
- 설정(`svgo.config.mjs`): `multipass`(한 번 더 돌려도 그대로 = 멱등, `--check`가 이걸 이용), `preset-default`(SVGO 4는 `viewBox`·`<title>`을 남김), `removeDimensions`(크기는 CSS로), `removeScripts`(`<script>`·`on*` 속성 제거: public SVG는 같은 출처에서 직접 열릴 수 있음), `data-*` 속성 제거.
- 규칙(`--check`가 실패시킴): `<text>`·`<foreignObject>`·래스터 `<image>` 금지(공유 카드 직렬화기·resvg, P0-10), SMIL(`<animate>` 등) 금지(§2.10), 파일당 40KB. 넘으면 그림을 단순하게 하거나 래스터(WebP)로.
- 스프라이트(`<use href="icons.svg#id">`)를 만들면 `cleanupIds`가 id를 바꾸므로 그 파일만 SVGO 설정을 따로 둡니다.

## 3. 래스터 정지 그림

§12-Q28: 래스터는 **진짜 질감이 필요한 정지 그림**에만 씁니다. 움직이는 화면·캐릭터는 코드 기반 SVG입니다.

### 3.1 종이 결 타일 (생성)

시안 B의 `design/prototypes/src/b/gen-paper.py`를 의존성 없는 Node 스크립트로 옮겼습니다(`scripts/assets/lib/textures.mjs` + 자체 팔레트 PNG 인코더 `lib/png.mjs`).

| 파일 | 크기 | 단계 | 용량 | 쓰는 법 |
|---|---|---|---|---|
| `public/textures/paper-grain.v1.png` | 128px | 6 | 2.0KB | 잔 입자. `background: url(/textures/paper-grain.v1.png) 0 0/128px` |
| `public/textures/paper-fiber.v1.png` | 256px | 8 | 7.4KB | 섬유 얼룩(바탕 1겹). `… 0 0/256px` |

```bash
npm run assets:textures            # 없는 타일만 만든다
npm run assets:textures -- --check # 파일이 정의와 같은 그림인지 (압축 바이트가 아니라 픽셀로 비교)
```

- 시드 고정 PRNG(mulberry32) + 사칙연산만 써서 어느 기기에서나 같은 픽셀이 나옵니다. 가장자리를 감싸는 흐림이라 이음매 없이 반복됩니다.
- 색은 잉크 갈색 하나(`#5C462A`)에 인덱스마다 투명도만 다른 팔레트 PNG입니다(최대 불투명도 grain 11%, fiber 4%). 다른 색이 필요하면(다크 모드 등) 같은 파일을 CSS `mask-image`로 쓰고 배경색을 칠합니다.
- PNG를 고른 이유: WebP 무손실은 8~10%만 작고(1.9KB·6.6KB), 공유 카드(satori + resvg)가 PNG를 확실히 그립니다(P0-10). 한 파일을 웹과 카드가 같이 씁니다.
- 바꿀 때: `TEXTURES`의 값·알고리즘을 바꾸고 **version을 올린 뒤** 다시 생성. 옛 파일은 한 릴리즈 뒤에 지웁니다.
- 공유 카드(P2-19): 라우트 핸들러가 `readFile(join(process.cwd(), 'public/textures/paper-grain.v1.png'))`처럼 **고정 경로**로 읽어 data URI로 배경에 반복합니다(동적 경로는 파일 추적이 폴더 전체를 함수에 넣음: P0-10 §4.6). satori `backgroundRepeat`는 P2-19에서 확인: `repeat`(기본)·`repeat-x`·`no-repeat` 모두 CSS대로 동작하고 이음매 없이 반복되지만, 1200×630 전면에 깔면 카드 PNG가 11KB → 117KB로 커지고 렌더가 약 100ms 늘어 지금 카드는 단색 바탕을 씁니다([share-card.md](share-card.md) §5).

### 3.2 그린 그림 (sharp)

```bash
npm run assets:raster              # raster.config.mjs의 새 항목·새 버전만 인코딩 → 출력 + raster.lock.json
npm run assets:raster -- --check   # 원본·출력이 기록과 같은지·예산·남은 파일 (인코더 없이, CI)
```

1. 원본을 `assets-src/raster/<id>.png`(무손실 PNG·WebP, **가장 큰 출력 폭의 2배 이하**)로 커밋합니다. 원본 폭이 가장 큰 출력보다 작으면 늘리지 않고 멈춥니다.
2. `scripts/assets/raster.config.mjs`에 `{ id, version, kind, source }`를 추가합니다(선택: `widths`·`formats`·`quality`·`png`·`maxBytes`·`setBytes`).
3. `npm run assets:raster` → 생성물과 `raster.lock.json`을 **같은 커밋에**.
4. 원본이나 설정을 바꾸면 `version`을 올립니다. 같은 버전에서 원본·폭·형식·품질이 기록과 다르거나, 기록된 출력 파일이 바뀌었으면 멈춥니다. 인코더(sharp) 버전이 달라 바이트가 조금 달라지는 것은 상관없습니다(기록된 파일이 기준이고 다시 만들지 않음).

| kind | 폭 | 형식 | 출력 | 예산 | 근거 |
|---|---|---|---|---|---|
| `hero` | 480 · 800 · 1200 | WebP (AVIF는 선택) | `public/images/` | 파일당 80KB, **800w 50KB**, 형식별 세트 합 **150KB** | 모바일 360~430px × 2배 ≈ 800px, 데스크톱 두 단 560px × 2배 ≈ 1200px. 모바일이 실제로 받는 800w 50KB는 Slow 4G(약 200KB/s)에서 0.25초라 랜딩 LCP 2.5초·JS 250KB·폰트 150KB 예산(§2.10) 옆에 얹힘 |
| `still` | 320 · 640 | WebP | `public/images/` | 파일당 40KB, 합 60KB | 빈 상태·안내 카드 같은 작은 그림, 2배 밀도까지 |
| `card-bg` | 1200(×630 고정) | PNG(팔레트, quality 90) | `assets/share-card/` (public 밖, 서버가 파일로 읽음) | 100KB | P0-10 §4.2·P2-19: satori+resvg가 PNG를 확실히 그림, 장당 100KB. **P2-19 템플릿은 단색 바탕이라 아직 없음** |
| `texture` | 256 | PNG | `public/textures/` | 10KB | 스캔한 수채·종이처럼 생성기로 못 만드는 타일 |

- 기본 품질: WebP 78(`effort 6`, `smartSubsample`), AVIF 52, PNG 팔레트 quality 90. 그림책 일러스트는 넓은 평면 + 선이라 WebP 78에서 경계 번짐이 눈에 띄지 않습니다. AVIF는 WebP보다 40~50% 작지만(시험 그림 1200w: WebP 20.6KB, AVIF 9.2KB) 인코딩이 느리고 파일 수가 두 배라, WebP 세트가 예산을 넘을 때만 켭니다.
- **공유 카드 배경은 낮은 주파수(큰 수채 얼룩)만 PNG로, 잔 질감은 3.1의 타일로** 겹칩니다. 1200×630 큰 수채 얼룩 팔레트 PNG는 24KB였고, 같은 크기에 고운 잡음(feTurbulence)을 구워 넣으면 팔레트 PNG도 208KB라 예산을 넘었습니다(실측).
- 앱에서 쓰기: Vercel 이미지 최적화(`next/image` 기본)를 거치지 않고 미리 만든 파일을 `<img srcSet sizes width height>`(또는 `next/image` `unoptimized`)로 씁니다. 폭·높이는 `raster.lock.json`에 있습니다(CLS 방지). 히어로는 LCP 요소이므로 `fetchPriority="high"`, 그 밖은 `loading="lazy"`.
- 인코더 sharp는 `next`의 선택 의존성(`optionalDependencies`)으로 이미 설치돼 있어 루트 `package.json`에 추가하지 않았습니다. 확인 모드(CI)는 sharp 없이 해시·크기만 봅니다.

## 4. 일회성 Lottie 이펙트

§2.5: Lottie는 상자 개봉 같은 **일회성 이펙트 2~3종만**, lottie-web의 **`lottie_light`**(SVG 렌더러, expressions·효과 없음, `eval` 없음, min 168KB · gzip 47KB)를 필요할 때 지연 로드합니다(P6). 마스코트는 Lottie로 만들지 않습니다(P0-07).

```bash
npm run assets:lottie                                   # public/animations/*.json 구조 + 실제 렌더
node scripts/assets/check-lottie.mjs ~/Downloads/box.json  # 넣기 전에 받은 파일을 바로 검사
npm run assets:lottie -- --no-render                    # 브라우저 없이 구조만
```

**구조 검사** (`scripts/assets/lib/lottie.mjs`)

- B32 재발 방지: 모든 레이어에 `ip`·`op`·`st`, 변형 `ks.a`·`ks.p`·`ks.s`·`ks.r`·`ks.o`, 마지막·멈춤(`h: 1`)이 아닌 키프레임마다 이징 `i`/`o`. 옛 형식 끝값 `e`는 경고(Bodymovin 5.5+로 다시 내보내기).
- `lottie_light` 비호환·금지: expressions(`x`, CSP `'unsafe-eval'`도 필요), 레이어 효과(`ef`)·스타일(`sy`), 텍스트 레이어·글꼴·글리프, 이미지 레이어·이미지 에셋, 오디오·카메라, 3D(`ddd: 1`), 패스 병합(`mm`), 없는 프리컴프 참조.
- 예산: JSON 60KB, 4초 이하(축하는 짧게 + 건너뛰기, §12-Q28), 60fps 이하. 레이어 40개 초과·캔버스 1024 초과·블렌드 모드는 경고.

**렌더 검사** (Playwright Chromium + `lottie_light`): 안쪽 프레임 6개를 마젠타 바탕에 그려 칠해진 픽셀을 셉니다. 칠해진 프레임이 2개 미만이거나 가장 많이 칠한 프레임이 0.5% 미만이면 **빈 화면으로 실패**, 모든 프레임이 같으면 경고. 매번 검사기 자체 시험(정상 `valid-pop.json`은 그려지고 B32 `entrance.json`은 비어야 함)을 먼저 돌립니다.

B32의 옛 Lottie 4종(`public/characters/pybaem/lottie/*.json`, 앱 사용처 0)은 이 검사로 **구조(레이어마다 `st`·`ks.a` 누락, 이징 없는 키프레임 14~30개)와 렌더(6프레임 모두 0%) 둘 다 실패**합니다. 앱에서 지우고 검사기의 회귀 시험 자료로 `scripts/assets/__tests__/fixtures/b32/`에 옮겼습니다(P0-07 스파이크 데모 경로도 함께 수정).

받은 Lottie를 넣는 순서: ① 라이선스 확인·기록([`docs/assets-license.md`](../assets-license.md) §7.4: LottieFiles 무료 에셋은 Lottie Simple License — 상업 이용·수정 가능, 배포본에 같은 조건이 따라가야 함) ② `check-lottie.mjs <파일>`로 검사, 실패하면 After Effects/LottieFiles 에디터에서 다시 내보내거나 다른 에셋 ③ `public/animations/<id>.v1.json`으로 복사 ④ `npm run assets:check`(라이선스 기록 포함).

## 5. 사운드

[sound.md](sound.md)를 따릅니다(P2-14에서 완료). 원본 → 앞 무음 제거 → 정규화 → WebM/Opus + AAC: `bash scripts/build-sounds.sh sfx|bgm|check`. 같은 버전 덮어쓰기 금지·immutable 캐시 규칙은 이 문서와 같습니다. ffmpeg가 필요해 `assets:check`·CI에는 넣지 않았습니다.

## 6. 폰트

P2-10에서 정합니다(§2.5, [P0-14](../spikes/P0-14-korean-fonts.md)): 모두 자체 호스팅, `display: swap`, 폴더마다 `OFL.txt`, Pretendard 서브셋은 예약 이름 변경. 공유 카드용 폰트는 운영 폰트만 든 전용 폴더(P0-10 §4.6).
