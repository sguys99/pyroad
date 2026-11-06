# 에셋·폰트·사운드 라이선스 기록 (X14)

> - 작업: P2-17 (계획서 §8 X14). 처음 작성 2026-11-06. **정본은 이 문서**입니다. 흩어져 있던 초안(P0-14 §6, P0-10 §7, P0-15 §6.3, `docs/design/sound-sources.md`, `docs/design/fonts.md` §5)은 여기로 합쳤습니다.
> - 처리 방법은 [fonts.md](design/fonts.md) · [sound.md](design/sound.md) · [assets.md](design/assets.md)에 있고, 이 문서는 **출처·라이선스·의무**만 다룹니다.
> - 검사: `npm run assets:license` (`npm run assets:check`와 CI `e2e-smoke`에 포함). 배포하는 에셋 파일이 이 문서에 없거나, 이 문서에 적힌 파일이 저장소에 없으면 실패합니다(§9).
> - 이 문서는 법률 자문이 아닙니다. 출시 전 법적 점검(P12-06)에서 §8·§10을 다시 봅니다.

## 0. 한눈에

| 종류 | 배포 위치 | 출처 | 라이선스 | 우리 의무 | 절 |
|---|---|---|---|---|---|
| 웹폰트 3종 | `src/fonts/*` → `/_next/static/media/*.woff2` (공유 카드용 TTF/OTF `src/fonts/share-card/`는 서버 함수 안에만) | Jua · Pretendard(→ pyRoad Sans) · D2Coding(→ pyRoad Mono) | SIL OFL 1.1 | 저작권·라이선스 고지 동봉, 예약 이름이 있으면 수정본 이름 변경, 폰트 단독 판매 금지 | §2 |
| 효과음 12종 | `public/sounds/sfx/` | Kenney | CC0 1.0 | 없음 (출처 기록, 크레딧 권장) | §3.2 |
| 배경음악 3곡 | `public/sounds/bgm/` | OpenGameArt 작가 3명 | CC0 1.0 | 없음 (출처 기록) | §3.3 |
| 종이 결 타일 2장 | `public/textures/` | 자체 생성 (코드) | 저장소 라이선스 | 없음 | §4 |
| 캐릭터 3종 | 번들 (리그 코드) | 자체 제작 | 저장소 라이선스 | 없음 | §4 |
| 공유 미리보기·랜딩 스크린샷 | `public/og-image.png`, `img/2·3` | 자체 촬영 (옛 앱 화면) | 저장소 라이선스 | 없음. 다만 교체 권장(§10-1) | §4 |
| 아이콘 | 번들 (`lucide-react`) | Lucide | ISC | 저작권·허락 문구 고지 | §5 |
| 브라우저 파이썬 | `public/pyodide/314.0.7/` (빌드 때 복사) | Pyodide | MPL 2.0 (+ CPython PSF 등) | 소스 위치 안내 + 고지 | §5 |
| 컨페티 · (P6) Lottie 플레이어 | 번들 | canvas-confetti · lottie-web | ISC · MIT | 저작권·허락 문구 고지 | §5 |

- **저장소 라이선스**: 저장소 루트 `LICENSE`는 Apache License 2.0이고 GitHub에 **공개**되어 있습니다(2026-11-06 확인). 우리가 만든 코드·그림(리그, 종이 결 생성기와 결과물, 검사기 시험 자료 `valid-pop.json`, 스크린샷)은 이 라이선스를 따릅니다. **아래 표의 제3자 파일은 Apache 2.0이 아니라 각자의 라이선스**를 따릅니다(폰트 폴더의 `OFL.txt`가 그 표시).
- 저장소가 공개라서 앱 배포뿐 아니라 **저장소 자체도 재배포**입니다. 디자인 프로토타입 `dist/*.html`, 스파이크 폴더처럼 앱에 실리지 않는 파일도 §6에 적습니다.

## 1. 판단 근거와 원칙

| 쟁점 | 결정 | 근거 |
|---|---|---|
| CC0는 의무가 없는데 왜 기록하나 | 출처 URL·작가·받은 날짜·원본 해시를 남김 | 업로더가 실제 권리자인지 문제가 생겼을 때 "언제 어디서 어떤 조건으로 받았는지"를 보여 줄 근거. 원본 해시가 있으면 같은 파일을 다시 받아 같은 결과가 나오는지 확인할 수 있음(§3에서 실제로 확인함) |
| OFL 예약 이름(RFN) | 예약 이름이 있는 폰트를 **서브셋·조각으로 바꾸면 이름을 바꿈**: Pretendard → `pyRoad Sans`, D2Coding → `pyRoad Mono`. 예약 이름이 없는 Jua는 이름 유지 | OFL §3 "수정본은 예약 이름을 쓸 수 없다". 서브셋·포맷 변환·힌팅 제거도 수정본(OFL-FAQ). 저작권(nameID 0)·상표(7)·라이선스(13·14) 레코드는 원문 그대로 둠 |
| Pretendard 안의 다른 글꼴 | 따로 고지하지 않음 (Pretendard의 `OFL.txt` 그대로) | Pretendard는 Inter·Source Han Sans·M PLUS 1p(모두 OFL) 파생이고 상표 문구(nameID 7)에 남아 있음. 이름을 `pyRoad Sans`로 바꿨으므로 이들 예약 이름("Source" 등)과도 겹치지 않음 |
| Cafe24 써라운드 | **쓰지 않음** (§12-Q15) | OFL이지만 공식 안내에 "이 폰트가 쓰인 이미지를 카페24 프로모션에 활용할 수 있음" 조항. 아이 닉네임이 들어가는 화면·공유 카드가 홍보물에 쓰일 여지를 두지 않음 |
| Pixabay | **쓰지 않음** (P2-14) | Pixabay Content License 자체는 앱 안 사용을 허용하지만 ① 업로더의 권리 문제는 이용자 책임이라고 적혀 있어 파일마다 업로더·페이지를 확인해야 하는데 ② 사이트가 자동 접근을 막아(2026-11-06에도 HTTP 403) 조건·업로더를 파일마다 기록하기 어려웠고 ③ OpenGameArt CC0만으로 월드별 후보를 구할 수 있었음 |
| ElevenLabs 등 생성 오디오 | 쓰지 않음 (§12-Q10) | 무료 플랜은 비상업 전용, 만 18세 미만 이용 불가(운영자만 가능). 쓰게 되면 §7.3 양식으로 기록 |
| Twemoji (`next/og` 기본 이모지) | 쓰지 않음 (P0-10) | 그래픽이 CC-BY 4.0이라 고지가 필요하고, 공유 카드는 자체 아이콘을 씀(P2-19) |
| LottieFiles 무료 애니메이션 | 아직 없음. 쓰면 §7.4 | 실제 약관 "Lottie Simple License (FL 9.13.21)"(2026-11-06 확인)은 상업 이용·수정·배포를 허용하되 **배포하는 사본과 수정본에 같은 라이선스 조건을 붙여야** 함(크레딧은 권장). P0-07 보고서의 "파일 단독 재배포 금지"는 약관 원문에 없는 표현이라 이 문서 기준으로 바로잡음 |

## 2. 폰트

모두 SIL Open Font License 1.1. 원본 주소·sha256은 `scripts/fonts/build-fonts.mjs`의 `SOURCES`에 고정되어 있고 생성물 `src/fonts/manifest.json`에도 기록됩니다(해시가 다르면 빌드가 멈춤). 폴더마다 `OFL.txt`(원본 배포본 그대로)와 출처·변경 내역 `README.md`가 있고, `npm run fonts:check`가 둘 다 있는지와 예약 이름이 name 테이블에 남지 않았는지를 봅니다.

| 앱 이름 (폴더) | 원본 · 버전 | 받은 곳 (고정) | 원본 sha256 | 저작권자 (OFL.txt / 폰트 nameID 0) | 예약 이름 | 우리가 바꾼 것 |
|---|---|---|---|---|---|---|
| `Jua` (`src/fonts/jua/`) | Jua 1.001 (upstream googlefonts/jua) | github.com/google/fonts `ofl/jua` @ `cbe7e8d` `Jua-Regular.ttf` | `769677ae…79f898` | Copyright 2018 The Jua Project Authors / "The BM JUA Project Authors" | 없음 | 랜딩 텍스트 서브셋 1개 + unicode-range 조각 86개, 힌팅 제거, nameID 5에 `; pyRoad subset`. 이름 유지 |
| `pyRoad Sans` (`src/fonts/pyroad-sans/`) | Pretendard Variable 1.3.9 (내부 1.309) | npm `pretendard` 1.3.9 tgz (github.com/orioncactus/pretendard) | `0ffc240c…b3bd53` | Copyright (c) 2021, Kil Hyung-jin / © 2023 Kil Hyung-jin | **"Pretendard"** | 공식 가변 동적 서브셋 92조각 + 랜딩 텍스트 서브셋, 힌팅 제거, **이름을 `pyRoad Sans`로** |
| 공유 카드 `Jua`·`pyRoad Sans` (`src/fonts/share-card/`) | 위 Jua 1.001 + Pretendard 1.3.9 **정적** `Pretendard-SemiBold.otf`·`Pretendard-Bold.otf` (같은 npm tgz의 `dist/public/static/`) | 위와 같음 (같은 `SOURCES` 해시) | 위와 같음 | 위와 같음 | Pretendard: **"Pretendard"** | P2-19: satori가 WOFF2를 못 읽어 압축 없는 TTF/OTF. `jua/Jua-KS2350.ttf`(KS X 1001 2,350자), `pyroad-sans/pyRoadSans-SemiBold-KS2350.otf`(2,350자), `pyroad-sans/pyRoadSans-Bold-Full.otf`(11,172자, 대체 폰트), 각각 ASCII·현대 호환 자모·카드 기호 포함, 힌팅 제거, CFF 서브루틴 유지, Pretendard는 **이름을 `pyRoad Sans`로**. 하위 폴더마다 `OFL.txt` + 폴더 `README.md`. 서버 함수에만 번들(브라우저로 안 보냄) |
| `pyRoad Mono` (`src/fonts/pyroad-mono/`) | D2Coding 1.3.2 (Build 20180524), 리거처 없는 Regular | github.com/naver/d2codingfont 릴리스 VER1.3.2 zip (OFL.txt는 저장소 `48d2941`) | `0f1c9192…0b24e6` | Copyright (c) 2015, NAVER Corporation / NHN Corporation, FONTRIX | **"D2Coding"·"D2Coding-Bold"** | 한자·가나 뺀 조각 109개, 힌팅 제거, **이름을 `pyRoad Mono`로** |

- 받은 날: 2026-11-06 (P2-10). 전체 해시는 각 폴더 README와 `manifest.json`.
- **배포 형태와 OFL 고지**: 앱은 woff2를 `/_next/static/media/`로 내보내고 `OFL.txt`는 웹에 올라가지 않습니다. 대신 모든 woff2 파일의 name 테이블에 저작권(nameID 0)과 라이선스 설명·주소(13·14)가 들어 있습니다(2026-11-06 fontTools로 확인). OFL §2는 고지를 "사용자가 쉽게 볼 수 있는 메타데이터"로 넣는 것을 허용하지만 요구하는 것은 저작권 고지 **와 라이선스 전문**이고, name 테이블에는 전문이 아니라 라이선스 이름·주소만 있습니다. 웹폰트 CDN(Google Fonts 등)도 같은 방식이라 관행상 통용되지만 엄밀하지 않으므로, 앱 고지 화면(§8)에서 OFL 전문을 보여 주는 것으로 보완합니다. 저장소(공개)에는 폴더마다 `OFL.txt`가 있습니다.
  - D2Coding의 nameID 14 주소(`dev.naver.com/…`)는 지금 열리지 않습니다. 원문 그대로 두는 것이 원칙이라 고치지 않고, 고지 화면에서 OFL 전문을 보여 주면 해결됩니다.
- **지금 쓰지 않는 폰트**: Gaegu·Gowun Dodum(시안 B, §12-Q31에서 제외), Noto Sans KR·JetBrains Mono(P2-10에서 제거), Cafe24 써라운드(§1). 프로토타입에서 쓴 것은 §6.
- **공유 카드 폰트**(P2-19, 위 표 넷째 행): 같은 `fontkit.py`(`subset --sfnt`)로 만들고 이름 변경 규칙을 지킵니다. 카드 PNG에는 글리프 모양만 들어가고 폰트 파일은 배포되지 않습니다(서버 함수 안). 공유 카드 아이콘·메달·로고 표시는 자체 SVG(`src/lib/share-card/icons.ts`, 이모지·Twemoji·Lucide path 없음).

## 3. 사운드

### 3.1 출처 규칙 (P0-15 §6.3, P2-14)

| 출처 | 라이선스 | 규칙 |
|---|---|---|
| Kenney (kenney.nl, OpenGameArt의 Kenney 공식 업로드) | CC0 1.0 | 효과음 기본 출처. 음악 루프 팩은 없음(징글만). 크레딧 의무는 없지만 고지 화면(§8)이 생기면 "Sound effects: Kenney (kenney.nl), CC0" |
| OpenGameArt | 파일마다 다름 | **페이지의 License(s)가 CC0 하나뿐인 것만.** CC-BY·OGA-BY는 고지 화면이 생기면 검토, CC-BY-SA·GPL은 쓰지 않음. 올린 사람(Submitted by)과 작가(Author)가 다른 페이지는 권리 확인이 어려워 제외 |
| Freesound | CC0 / BY / BY-NC | CC0만 (지금은 안 씀) |
| Pixabay | Pixabay Content License | 지금은 안 씀(§1). 쓰게 되면 파일별 페이지 URL·업로더·받은 날짜 + 페이지를 PDF로 보관 |
| 생성 오디오 (ElevenLabs 등) | 서비스 약관 | 지금은 안 씀(§1). 쓰면 §7.3 양식 |

공통 가공(`scripts/build-sounds.sh`): 앞 무음 제거, 정규화(효과음 RMS·BGM -16 LUFS), 리미터, WebM/Opus + AAC 인코딩, BGM은 루프 이음매 256샘플 크로스페이드. 메타데이터는 넣지 않음(bitexact).

### 3.2 효과음 12종 (`public/sounds/sfx/<id>.v<N>.{webm,m4a}`)

모두 **Kenney, CC0 1.0** (https://creativecommons.org/publicdomain/zero/1.0/). 처음 받은 날 2026-11-03(kenney.nl, P0-15)·2026-11-05(OpenGameArt, P2-14). **2026-11-06에 아래 OpenGameArt zip 4개를 다시 받아 `build-sounds.sh sfx`로 만든 결과가 저장소 파일 24개와 바이트 단위로 같음을 확인**했습니다.

| 팩 (작가 Kenney) | OpenGameArt 페이지 (License: CC0) | 받은 파일 | sha256 | 팩 안 라이선스 문구 |
|---|---|---|---|---|
| Interface Sounds 1.0 | https://opengameart.org/content/interface-sounds | `kenney_interfaceSounds.zip` | `f2193d07…c81232` | License.txt: "License: (Creative Commons Zero, CC0) … free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)" |
| RPG Audio | https://opengameart.org/content/50-rpg-sound-effects | `RPGsounds_Kenney.zip` | `3ae398ad…bbc231` | license.txt: "License (CC0) … Credit … would be nice but is not mandatory" |
| Digital Audio | https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc | `Digital_SFX_Set.zip` | `022f0f4b…06d063` | readme.txt: "You may use these sounds in personal and commercial projects. Credit (www.kenney.nl) would be nice but is not mandatory." |
| Music Jingles | https://opengameart.org/content/85-short-music-jingles | `jingleSounds_Kenney.zip` | `be324b6c…3682e5` | license.txt: CC0, 크레딧 선택 |

kenney.nl 쪽 팩 주소: `https://kenney.nl/assets/{interface-sounds,rpg-audio,digital-audio,music-jingles}`. kenney.nl 안내(2026-11-06): "all game assets on the asset pages are public domain licensed (CC0) … Attribution is not required".

| 파일 | 쓰임 | 팩 | 원본 | 목표 RMS | 길이 | webm / m4a |
|---|---|---|---|---|---|---|
| `tap.v1` | 주요 버튼 | Interface Sounds | `click_001` | -24 | 0.10s | 2.2 / 2.3KB |
| `blip.v1` | 대사 블립 | Interface Sounds | `tick_004` | -24 | 0.06s | 1.6 / 1.8KB |
| `correct.v1` | 정답 | Interface Sounds | `confirmation_002` | -19 | 0.54s | 5.7 / 7.7KB |
| `wrong.v1` | 오답 (부드럽게) | Interface Sounds | `question_002` (P2-14 교체, P0-15 초안은 `error_006`) | -23 | 0.33s | 3.4 / 5.0KB |
| `coin.v1` | 코인 | RPG Audio | `handleCoins2` | -19 | 0.29s | 3.5 / 4.9KB |
| `star.v1` | 뱃지 (1→3 상승) | Interface Sounds | `glass_001` | -20 | 0.28s | 3.4 / 4.4KB |
| `run.v1` | 실행 | Digital Audio | `phaseJump1` | -20 | 0.34s | 3.5 / 5.3KB |
| `bug.v1` | 에러 (버그버그) | Digital Audio | `phaserDown1` (P2-14 교체, 초안은 `lowRandom`) | -21 | 0.35s | 4.4 / 5.5KB |
| `unlock.v1` | 황금키·해제 | RPG Audio + Interface Sounds | `metalLatch` + `maximize_004`(+150ms) | -19 | 0.57s | 6.3 / 8.1KB |
| `chest.v1` | 보물상자 | RPG Audio | `creak1` + `handleCoins`(+300ms) | -19 | 1.08s | 11.5 / 14.4KB |
| `levelup.v1` | 레벨업 | Music Jingles | `jingles_NES00` | -18 | 1.76s | 23.3 / 22.1KB |
| `celebrate.v1` | 스테이지 클리어 | Music Jingles | `jingles_STEEL07` | -18 | 1.55s | 15.1 / 19.6KB |

합계 webm 83.9KB / m4a 101.1KB. 바꾼 것: 위 공통 가공 + `unlock`·`chest`는 두 소리를 섞음.

### 3.3 배경음악 (`public/sounds/bgm/world{1,2,3}.v1.{webm,m4a}`)

모두 **OpenGameArt, CC0 1.0**, 작가 = 올린 사람. 받은 날 2026-11-05, **2026-11-06에 페이지의 License(s)가 CC0인지 다시 확인하고, 원본을 다시 받아 `build-sounds.sh bgm`으로 만든 결과가 저장소 파일 6개와 바이트 단위로 같음을 확인**했습니다.

| 파일 | 월드 | 곡 · 작가 | 페이지 (올린 날) | 받은 파일 | 원본 sha256 | 원본 길이·LUFS | 결과 |
|---|---|---|---|---|---|---|---|
| `world1.v1` | 1 숲·섬 | Keep your dream alive! (seamless) · congusbongus | https://opengameart.org/content/keep-your-dream-alive-seamless-loop (2020-04-21) | `Keep your dream alive! seamless.ogg` | `96db973b…a44653`[^h] | 73.4s · -16.7 | 73.39s · -16.0 LUFS · TP -1.2dBTP · webm 858KB / m4a 1,166KB |
| `world2.v1` | 2 바다·하늘 | Aurora · Trex0n | https://opengameart.org/content/aurora-0 (2021-05-31) | `aurora.wav` | `a1469bd6…b56a25`[^h] | 80.0s · -21.3 | 79.99s · -16.0 · -1.5 · 1,270 / 1,361KB |
| `world3.v1` | 3 공방·메이커 | A Respectable Amount of Bounce · Some Weirdo | https://opengameart.org/content/a-respectable-amount-of-bounce (2025-09-27) | `a_respectable_amount_of_bounce.ogg` (`…_0.ogg`와 같은 파일) | `bd4da73a…63b9c4`[^h] | 76.8s · -23.2 | 76.79s · -16.0 · -2.4 · 1,159 / 1,227KB |

[^h]: 전체 해시: world1 `96db973b4de596abff4613b3e9a0b63d63bcad4d449e502906c8860438a44653`, world2 `a1469bd6adbb1db5a19c899f646e5769a214e1d9574b5157335c09d57fb56a25`, world3 `bd4da73ad4ffa90ddbf5061ba99db193796e7a49133c578d1e7b209c4fa63b9c4`. 효과음 zip: Interface `f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232`, RPG `3ae398ad63e293f9c450bda22d5d81c3af69c74df66fc1400f33c012c0bbc231`, Digital `022f0f4b73da55989567fe2b373c8af89d74f5d015257e293cab497ca606d063`, Jingles `be324b6cf26e35c95c2a344569a2470512819d0246cc81328bef3499de3682e5`.

**B 후보 (앱에 없음, 청취 검수 보드 `design/prototypes/dist/sound-review.html`에만 Opus 48k로 들어 있음)** — 모두 OpenGameArt CC0, 받은 날 2026-11-05, 2026-11-06 라이선스 재확인:

| 월드 | 곡 · 작가 | 페이지 | 받은 파일 | 메모 |
|---|---|---|---|---|
| 1 | Flowerbed Fields · Zane Little Music | https://opengameart.org/content/flowerbed-fields-loop (2023-05-14) | `flowerbed_fields.wav` | 105.9s · -18.8 LUFS. 목표보다 김, 52.97s에 비슷한 반복(상관 0.89) |
| 2 | Gumdrop Plains (2024) · Bobjt | https://opengameart.org/content/gumdrop-plains (2019-06-04, 2024 리마스터) | `gumdrop_plains_2024.ogg` | 87.0s · -8.6 LUFS, 원본 true peak +2.9dBTP → gain -7.4dB |
| 3 | Wacky Workings · Fupi | https://opengameart.org/content/wacky-workings (2021-02-23) | `wackyworkings.wav` | 39.6s · -16.0 LUFS, 짧아서 반복이 잦음 |

검토했지만 넣지 않은 것: 끝에 페이드아웃·무음이 있어 루프가 아닌 곡(Bouncy Hamster, Snow Globe, Seaside Village, Sunny Day, Toy Soldiers 등), 이음매 점프가 큰 곡(Through Sea), 3분 넘는 곡. 사용자 청취 검수(P2-08)에서 B로 바꾸면 이 표의 행을 위 표로 옮기고 원본 해시를 적습니다.

## 4. 그림·아이콘·텍스처·애니메이션

| 에셋 | 위치 | 출처 | 라이선스 | 메모 |
|---|---|---|---|---|
| 캐릭터 파이뱀·버그버그·별똥이 (+ 표정·코스튬) | `src/components/characters/rig/` (코드) | 자체 제작 | 저장소 라이선스 | SVG 파일 없이 리그 코드가 원본(P0-07, [rig.md](design/rig.md)). 이미지 생성 도구는 무드보드 참고용으로만 씀(배포 안 함) |
| 종이 결 타일 | `paper-grain.v1`, `paper-fiber.v1` (`public/textures/`) | 자체 생성: `scripts/assets/lib/textures.mjs` (시드 고정 PRNG, 시안 B `gen-paper.py`를 옮김) | 저장소 라이선스 | 스캔·사진 소재 없음. `assets:textures --check`가 생성기와 같은 그림인지 확인 |
| 파비콘 | `src/app/icon.svg` | 자체 (SVG 안 `<text>` 🐍 한 글자) | 저장소 라이선스 | 그림 파일을 싣지 않고 보는 기기의 이모지 글꼴로 그려짐. Phase 4 브랜드 아이콘으로 교체 예정 |
| 공유 미리보기 이미지 | `public/og-image.png` (810×411, 2026-04-04) | 자체: 옛 랜딩 화면 스크린샷 | 저장소 라이선스 | 화면에 옛 마스코트·Noto Sans KR(OFL)·Lucide GitHub 아이콘(ISC)·🚀 시스템 이모지가 보임. P4-10에서 `opengraph-image` 생성으로 교체(§10-1) |
| 랜딩 소개 스크린샷 | `img/2.world-map.png`, `img/3.learning-page.png` (`src/components/landing/AboutSection.tsx`가 import → `/_next/static/media/`) | 자체: 옛 앱 화면 스크린샷 (2026-04-04) | 저장소 라이선스 | 월드맵 그림에 **실명 계정 이름과 출처를 모르는 프로필 사진**, 시스템 이모지(성·탑 등)가 보임 → §10-1. `img/1.landing-page.png`는 README 전용(앱 미사용) |
| 래스터 정지 그림 | `public/images/`, `assets/share-card/` | — | — | **아직 없음.** 넣으면 원본 `assets-src/raster/`와 함께 이 절에 행 추가(§7) |
| 일회성 Lottie 이펙트 | `public/animations/` | — | — | **아직 없음.** 넣으면 §7.4 양식 |
| UI 아이콘 | 번들 (`lucide-react` 1.7.0) | Lucide (lucide.dev) | ISC | §5 |
| 시안·검수 보드 아이콘 | `design/prototypes/src/shared/icons.tsx` | 자체 (24px 격자 path를 직접 그림) | 저장소 라이선스 | 앱에 배포 안 함 |

## 5. 배포하는 제3자 런타임 파일 (에셋 성격)

npm 의존성 전체 목록은 `package.json`이 정본입니다. 여기서는 **에셋처럼 그대로 내보내는 파일**과 화면에 직접 보이는 것만 적습니다.

| 이름 · 버전 | 배포 형태 | 라이선스 · 저작권자 | 의무 | 지금 상태 |
|---|---|---|---|---|
| Pyodide 314.0.7 (Python 3.14.2, Emscripten 5.0.3) | `public/pyodide/314.0.7/`에 npm 패키지 파일 6개를 **수정 없이** 복사(`scripts/pyodide/copy-assets.mjs`, git 제외, 약 13MB) | Pyodide: MPL 2.0. 안에 든 CPython 인터프리터·표준 라이브러리 `python_stdlib.zip`: PSF License 2.0. Emscripten 런타임(MIT/UIUC)과 내장 C 라이브러리(zlib·bzip2·expat·libffi·mpdecimal·SQLite 등, 허용형) | MPL §3.2: 실행 형태를 배포하면 **소스를 어디서 받는지 알릴 것**(github.com/pyodide/pyodide 태그 314.0.7), 고지 유지. PSF: 라이선스·저작권 고지 유지 | npm 패키지에 라이선스 파일이 없어 복사본에도 없음 → §8 고지 화면에 넣음 |
| lucide-react 1.7.0 | JS 번들 (아이콘 SVG path) | ISC · Lucide Icons and Contributors | 저작권·허락 문구 고지 | 번들 압축 때 라이선스 주석이 빠짐(2026-11-06 `.next/static/chunks` 확인) → §8 |
| canvas-confetti 1.9.4 | JS 번들 | ISC · Kiril Vatev | 같음 | 같음 |
| lottie-web 5.13.0 (`lottie_light`) | P6에서 지연 로드 예정. 지금은 앱에서 쓰지 않음(B32, `lottie-react` 미사용 의존성) | MIT · Bodymovin | 같음 | 쓰기 시작하면 §8 목록에 포함 |
| 그 밖의 JS 의존성 (React, Next.js, Framer Motion, CodeMirror, react-markdown 등) | JS 번들 | 대부분 MIT·ISC·Apache-2.0 | 같음 | §8: 빌드 때 고지 파일 생성 제안 |

## 6. 저장소에만 있는 제3자 자원 (앱에 배포 안 함)

| 위치 | 담긴 것 | 라이선스 | 메모 |
|---|---|---|---|
| `design/prototypes/dist/*.html` (커밋, claude.ai 비공개 Artifact로 공유) | ① cdnjs React 18.3.1·ReactDOM 18.3.1 UMD **링크** ② Google Fonts **링크**(Jua·Gaegu·Gowun Dodum, 시안별 `entry.json`) ③ base64로 넣은 Pretendard·D2Coding **서브셋**(이름 `pyRoad Sans`·`pyRoad Mono`, name 테이블에 저작권·라이선스 유지) ④ `sound-review.html`의 효과음·BGM A·B 후보 Opus | ① MIT ② OFL 1.1(Google이 제공, 우리가 재배포하지 않음) ③ OFL 1.1, 이름 변경 규칙 지킴(`design/prototypes/scripts/subset_font.py`) ④ CC0(§3) | 앱 코드가 아니고 빌드·lint·테스트에서 제외. 프로토타입 폰트 원본은 `fetch-fonts.mjs`가 `.font-cache/`에 받음(커밋 안 함) |
| `spikes/p0-15-sound/sounds/` | P0-15 초안 효과음(mp3·webm·m4a) + `LICENSE-kenney.txt`(팩 라이선스 원문) | CC0 (Kenney) | 스파이크 기록 |
| `scripts/assets/__tests__/fixtures/` | `valid-pop.json`(P2-16 자작), `b32/*.json`(MVP 때 손으로 쓴 옛 파이뱀 Lottie, 그려지지 않는 회귀 시험 자료) | 저장소 라이선스 | 자체 제작 |
| `docs/**/img/`, `spikes/**/results/`, `img/1.landing-page.png` | 우리 앱·시안·스파이크 스크린샷 | 저장소 라이선스 | 스크린샷 속 글꼴·이모지는 각 글꼴 라이선스 |

## 7. 새 에셋을 넣을 때 규칙

### 7.1 허용·금지

| 구분 | 라이선스·조건 | 할 일 |
|---|---|---|
| ✅ 허용 | **SIL OFL 1.1** (폰트) | 예약 이름 확인 → 서브셋·변환하면 이름 변경, 폴더에 `OFL.txt`, §2 표에 행 |
| ✅ 허용 | **CC0 / 퍼블릭 도메인** | 출처 URL·작가·받은 날짜·원본 sha256 기록 (의무는 없어도 근거로) |
| ✅ 허용 | **MIT · ISC · BSD · Apache-2.0** (아이콘·코드형 에셋) | 저작권·허락 문구를 §8 고지 목록에. Apache-2.0은 NOTICE 파일이 있으면 그 내용도 |
| 🔶 조건부 | **CC-BY 4.0 · OGA-BY** | 고지 의무 → **앱 고지 화면(§8)이 생긴 뒤에만**. 표시할 문구(작가·제목·라이선스 링크·변경 여부)를 미리 적음 |
| 🔶 조건부 | **Lottie Simple License** (LottieFiles 무료) | §7.4. 배포본에 같은 라이선스 조건이 따라가야 함 |
| 🔶 조건부 | **Pixabay Content License** | 파일별 페이지 URL·업로더·받은 날짜, 페이지 PDF 보관. 사람·상표·로고가 든 소재는 피함 |
| 🔶 조건부 | 이미지·소리 **생성 도구** 결과물 | 약관상 상업 이용 가능 플랜만, §7.3 기록 |
| ❌ 금지 | **NC(비상업 전용)** 조건 (CC-BY-NC, 생성 도구 무료 플랜 비상업 조항 등) | 무료 서비스라도 "비상업" 해석이 모호하고 나중에 유료화·후원이 생기면 바로 위반 |
| ❌ 금지 | **ND(변경 금지)** | 서브셋·정규화·자르기·재인코딩·색 변경 자체가 변경 |
| ❌ 금지 | **CC-BY-SA · GPL · LGPL** 등 상속형 (에셋에) | 파생물·결합물 범위 해석 위험 (폰트의 OFL은 예외로 허용) |
| ❌ 금지 | **결과물을 제공자 홍보에 쓸 수 있다**는 조항 (Cafe24 써라운드, §12-Q15) | 아이 닉네임·작품이 든 화면·카드가 홍보물이 될 수 있음 |
| ❌ 금지 | 출처 불명, "무료 다운로드" 재업로드 사이트, 올린 사람 ≠ 작가 | 권리 확인 불가 |
| ❌ 금지 | 웹 임베딩·재배포를 막는 폰트 라이선스(데스크톱 전용), 사용자 수·도메인·기간 제한, 구독이 끝나면 쓸 수 없는 라이선스 | 자체 호스팅·공개 저장소와 맞지 않음 |
| ❌ 금지 | 실존 게임·애니메이션 캐릭터·상표를 닮게 만든 것, 실존 인물 얼굴·목소리 | 장르 분위기만 참고 (§6 공통 원칙) |

### 7.2 절차

1. 위 표로 판단하고, 애매하면 넣기 전에 사용자에게 묻습니다(이 문서 §10에 쟁점으로 적기).
2. 원본을 받은 날짜·주소·sha256을 남깁니다. 약관·라이선스 페이지가 바뀔 수 있는 출처(Pixabay·LottieFiles·생성 도구)는 확인한 날짜와 약관 버전(또는 개정일)을 적습니다.
3. 해당 파이프라인([assets.md](design/assets.md)·[sound.md](design/sound.md)·[fonts.md](design/fonts.md))으로 넣고, **같은 커밋에서 이 문서의 표에 행을 추가**합니다. 열쇠(§9)는 버전 붙은 파일이면 `` `<id>.v<N>` ``, 그 밖의 public 파일이면 경로를 백틱으로 적습니다.
4. `npm run assets:check`(또는 `npm run assets:license`) 통과. 옛 버전을 지우면 표의 열쇠도 새 버전으로 고칩니다.
5. PR 템플릿의 "에셋 라이선스" 체크 항목에 표시합니다.

### 7.3 이미지·소리 생성 도구로 만든 것

무드보드·참고용(배포 안 함)은 도구와 날짜만 적으면 됩니다. **배포하는 그림·소리**는 아래를 이 문서 §4(또는 §3)에 적습니다.

| 항목 | 예 |
|---|---|
| 도구 · 모델 · 버전 | (도구명) (모델명) |
| 플랜 | 유료 Pro / 팀 (무료 플랜이 비상업 전용이면 쓰지 않음) |
| 약관 URL · 확인 날짜 · 약관 개정일 | 출력물 권리 귀속, 상업 이용 가능 여부, 출력물 공개 여부(무료 플랜은 공개 갤러리에 올라가는 경우), 연령 제한(만 18세 미만 이용 금지면 운영자만) 조항을 한 줄씩 요약 |
| 프롬프트 요약 · 참조 이미지 | 프롬프트 요지, 참조 이미지를 넣었다면 그 출처(남의 그림·실존 캐릭터·작가 이름을 넣은 "○○ 풍" 프롬프트 금지) |
| 생성 날짜 · 원본 위치 · sha256 | `assets-src/raster/<id>.png` |
| 사람이 고친 정도 | 다시 그림 / 색·구도 보정 / 그대로 |

- 사람의 창작 기여가 적은 생성물은 저작권 보호를 받기 어려울 수 있어 **우리 것이라고 독점 주장하기 어렵습니다.** 브랜드 핵심(마스코트·로고)은 생성물 그대로 쓰지 않고 리그 코드로 다시 그립니다(지금 방식, [assets.md](design/assets.md) §1).

### 7.4 Lottie 에셋

LottieFiles 무료 애니메이션의 약관은 **Lottie Simple License (FL 9.13.21)**(2026-11-06 확인): 상업 이용·수정·배포 허용, 크레딧 선택(넣는다면 사용자에게 보이게), 단 **배포·게시하는 사본과 수정본에 같은 라이선스 조건이 붙어야** 하고 LottieFiles에서 모아 비슷한 서비스를 만드는 것은 금지. 프리미엄·마켓플레이스 애니메이션은 별도 조건이라 구매 영수증·라이선스 ID가 없으면 쓰지 않습니다.

넣을 때 §4 표에 적을 것: 페이지 URL, 작가(프로필 URL), 라이선스 이름과 버전(FL 날짜), 받은 날짜, 원본 sha256, 바꾼 것(색·길이·레이어 제거, `lottie_light` 호환 수정), 배포 파일 `` `<id>.v<N>` ``. 의무 이행: §8 고지 화면 목록에 파일·작가·라이선스 전문 링크를 넣습니다(같은 조건 적용 표시). 구조·렌더 검사는 [assets.md](design/assets.md) §4.

### 7.5 일러스트레이터·사운드 디자이너에게 맡길 때 계약 메모

- **저작재산권 양도인지 이용 허락인지** 정하고, 이용 허락이면 범위(웹·앱 화면, 공유 카드, SNS·스토어 홍보, 인쇄물·굿즈 여부), 기간, 지역, 독점 여부를 적습니다.
- **2차적저작물작성권을 명시**합니다. 저작권법 §45②에 따라 양도 계약에 따로 적지 않으면 포함되지 않은 것으로 추정됩니다. 리그로 다시 그리기·애니메이션·코스튬·변형에 필요합니다.
- 저작인격권(성명표시·동일성유지)은 양도되지 않으므로 **불행사 합의**, 크레딧 표시 방법을 정합니다.
- 원본(레이어 있는 PSD·AI·SVG, 멀티트랙)을 함께 받고, 제3자 소재·생성 도구를 썼는지 **고지·보증**을 받습니다(썼다면 §7.3 항목).
- 작가의 포트폴리오 사용 허용 여부. 계약서 사본은 저장소가 아니라 별도 보관하고, 이 문서에는 계약 날짜·범위 요약만 적습니다.

## 8. 앱 안 고지 화면이 필요한가

> **2026-11-06 P3-14로 만듦 (§12-Q33)**: 비로그인 정적 페이지 `/licenses`가 아래 "P12-06에 넘길 항목" ①~④를 보여 줍니다. 데이터는 `npm run licenses:build`(`scripts/licenses/build-licenses.mjs`)가 운영 의존성의 라이선스 파일과 `scripts/licenses/notices.mjs`(Pyodide·CPython·Emscripten 전문, 폰트 3종 OFL 전문과 원래 이름, 사운드 작가 크레딧)로 만들어 커밋하고, CI `licenses:check`가 드리프트를 잡습니다([ci.md](ci.md)). 에셋을 바꾸면 이 문서와 `notices.mjs`를 같은 커밋에서 고칩니다(단위 테스트가 작가·주소가 이 문서에 있는지 확인). 아래 판단은 기록으로 남깁니다.

| 의무 | 지금 충족 방법 | 충분한가 |
|---|---|---|
| OFL 1.1 (폰트 3종): 사본마다 저작권 고지 + 라이선스 | woff2 name 테이블(0·13·14: 저작권 + 라이선스 이름·주소), 공개 저장소 폴더마다 `OFL.txt` | 관행상 통용되지만 앱 사본에는 OFL 전문이 없음 → 고지 화면에서 전문을 보여 주면 확실 |
| CC0 (사운드) | 의무 없음 | 충분. 크레딧은 고지 화면이 생기면 덤으로 |
| MIT·ISC (lucide-react·canvas-confetti·React·Next.js 등 번들 라이브러리): 사본에 저작권·허락 문구 | **없음.** 압축 번들에서 라이선스 주석이 빠지고, 앱에서 볼 수 있는 고지가 없음 | **부족** |
| MPL 2.0 (Pyodide): 소스를 받을 곳 안내 | **없음.** npm 패키지에 라이선스 파일이 없어 `public/pyodide/` 복사본에도 없음 | **부족** |
| PSF 2.0 (CPython in Pyodide): 라이선스·저작권 고지 유지 | 없음 | **부족** |
| (앞으로) CC-BY · Lottie Simple License | — | 넣기 전에 고지 화면이 있어야 함 |

**판단**: 에셋(폰트·사운드)만 보면 저장소 문서와 폰트 메타데이터로 관행상 충분하지만(OFL 전문은 고지 화면에서 보완), **번들 라이브러리(MIT·ISC)와 Pyodide(MPL·PSF) 고지는 저장소 문서만으로는 부족**합니다(앱을 쓰는 사람이 받는 사본에 고지가 따라가야 함). 그래서 앱 안 "오픈소스·에셋 고지" 화면을 두는 것을 제안합니다. 이번에는 만들지 않고 **P12-06(출시 전 법적 점검)으로 넘깁니다.** 이용약관·개인정보처리방침(P3-14)이 먼저 생기면 그 옆 링크 자리만 잡아 둡니다.

P12-06에 넘길 항목 (제안 문안):

> - 오픈소스·에셋 고지 화면(예: `/licenses`, 비로그인 열람, 이용약관·개인정보처리방침 옆 링크): ① 빌드 때 클라이언트 번들에 들어간 npm 패키지의 이름·버전·라이선스·저작권 문구를 `node_modules/*/LICENSE`에서 모아 정적 텍스트로 생성(postbuild 검사로 누락 방지) ② Pyodide(MPL 2.0, 소스 github.com/pyodide/pyodide 태그 링크)·CPython(PSF 2.0) 고지 ③ 폰트 3종 OFL 전문과 원래 이름(Pretendard·D2Coding) 표기 ④ 사운드 크레딧(Kenney, OpenGameArt 작가 3명, CC0) ⑤ 이후 CC-BY·Lottie 에셋. 내용은 `docs/assets-license.md`와 같아야 함

보조 수단(고지 화면 전에 해 둘 수 있는 작은 일): `copy-assets.mjs`가 `public/pyodide/<버전>/`에 MPL·PSF 고지 텍스트를 함께 두게 하기. 이 항목에서는 손대지 않았습니다.

## 9. 검사 (`npm run assets:license`)

`scripts/assets/license.mjs`(순수 함수 `scripts/assets/lib/license.mjs`, 단위 테스트 `scripts/assets/__tests__/assets.test.ts`)가 이 문서에서 **백틱으로 감싼 열쇠**를 찾습니다. `npm run assets:check`의 마지막 단계이고 CI `e2e-smoke`에서 돕니다(Node만, 1초 안).

| 배포 파일 | 이 문서에 있어야 할 열쇠 |
|---|---|
| 버전 붙은 폴더 `public/sounds/sfx/`, `public/sounds/bgm/`, `public/textures/`, `public/images/`, `public/animations/`, `assets/share-card/`의 파일 | `` `<id>.v<N>` `` (확장자·`-<폭>w` 뺀 이름. webm·m4a, 폭별 파일은 한 열쇠) |
| 폰트 폴더 `src/fonts/<이름>/` | `` `src/fonts/<이름>/` `` |
| 그 밖의 `public/` 파일 (`public/pyodide/`·`public/workers/` 제외) | 파일 경로 또는 상위 폴더 경로 (예: `` `public/icons/` ``) |
| `src/app`의 메타데이터 그림(icon·apple-icon·favicon·opengraph-image·twitter-image 그림 파일) | 저장소 기준 경로 |
| `src` 코드가 정적 import하는 그림·소리·폰트 파일 | 저장소 기준 경로 |

거꾸로 이 문서에 적힌 `` `<id>.v<N>` ``·`` `src/fonts/<이름>/` ``·에셋 파일 경로(`public/`·`img/`·`src/`·`assets/` 아래, 그림·소리·폰트·JSON 확장자)가 저장소에 없으면 **오래된 기록**으로 실패합니다. 그래서 지운 옛 버전은 백틱 없이 적습니다.

검사하지 않는 것: 라이선스 판단 자체(사람이 함), 원본 해시(폰트는 `fonts:check`, 래스터는 `raster.lock.json`, 사운드는 이 문서의 해시로 사람이 확인), `design/`·`spikes/`(앱 배포 아님).

## 10. 열린 쟁점 (사용자 확인)

1. **옛 스크린샷 3장이 앱에 배포되고 있음**: 랜딩 소개 `img/2.world-map.png`에 **실명 계정 이름과 출처를 모르는 프로필 사진("LOVE YOUR DATA")**, 공유 미리보기 `public/og-image.png`와 두 스크린샷에 촬영 기기의 시스템 이모지(🚀·성·탑 등, 글꼴 제조사 그림)가 찍혀 있습니다. 라이선스 위험은 낮지만 공개 화면 원칙(닉네임 + 아바타만)과 맞지 않습니다. Phase 4 랜딩 개편(P4-01~05)·OG 이미지 생성(P4-10)에서 바뀔 예정인데, 그 전에 이름을 가린 이미지로 바꿀지 결정이 필요합니다.
2. **앱 안 고지 화면(§8)**: P12-06으로 넘기는 데 동의하는지, 이용약관(P3-14)과 같이 앞당길지.
3. **Kenney·OpenGameArt 크레딧**: CC0라 의무는 없지만 고지 화면에 감사 표기를 넣을지(권장).
