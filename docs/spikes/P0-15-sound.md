# P0-15 사운드

> - 작성일: 2026-11-03 · 브랜치 `feat/phase0`
> - 코드: [`spikes/p0-15-sound/`](../../spikes/p0-15-sound/) · 원자료: `spikes/p0-15-sound/results/*.json`
> - 표기: **실측** = 이 스파이크에서 직접 잰 값 · **문서 확인** = 공식 문서·표준·브라우저 버그 트래커에서 확인 · **미확인** = 실기기 확인 필요

## 1. 결론

**대안 채택.** §2.5의 "`use-sound`(Howler) 기반 `SoundProvider`" 대신 **의존성 없는 자체 Web Audio 래퍼(gzip 4.8KB) + `SoundProvider`(React 바인딩 포함 5.7KB)**를 씁니다. Howler 직접 사용은 2순위 대안으로 남기고, use-sound는 쓰지 않습니다.

| 항목 | 결정 |
|---|---|
| 라이브러리 | 자체 래퍼 (`src/lib/sound/` + `src/components/providers/SoundProvider.tsx`). 스파이크 코드가 초안 |
| 효과음 재생 | `AudioBuffer` + `AudioBufferSourceNode`. 자주 쓰는 6종은 페이지 유휴 시간에 `OfflineAudioContext`로 미리 디코드해서 **첫 탭부터 바로** 재생합니다 |
| BGM 재생 | 기본 **버퍼 모드** (전체 디코드 → `loop`). 루프 이음새가 0ms이고 iOS 무음 스위치를 따릅니다. 현재 월드 곡만 메모리에 둡니다 (75초 스테레오 약 26MB). 저사양 모드에서는 BGM을 끄거나 스트림 모드로 바꿉니다 |
| 포맷 | **WebM(Opus) 기본 + AAC(.m4a) 폴백.** MP3는 쓰지 않습니다 (WebKit에서 앞뒤 무음 23~32ms 실측) |
| 비트레이트 | 효과음 Opus 64k 모노 / AAC 96k 모노, BGM Opus 96k 스테레오 / AAC 128k |
| 기본값 | 효과음 ON, BGM OFF (§12-Q8). 마스터 0.8 · 효과음 0.7 · BGM 0.4 · 음성 0.9, HUD 음소거 토글 |
| iOS | `navigator.audioSession.type = 'ambient'` (Safari 16.4+). 효과음·BGM이 무음 스위치를 따르고, 다른 앱 음악을 끊지 않습니다. 사용자가 직접 누르는 "읽어주기"(음성)에서만 잠시 `'playback'` |
| 효과음 출처 | **Kenney CC0** 4개 팩에서 12종 초안 선정 (WebM 87.6KB + AAC 104.9KB). 청취 검수는 P2-14에서 |

Howler와 use-sound를 쓰지 않는 이유 (모두 실측 또는 코드 확인):

1. **use-sound는 Provider 구조에 보탬이 없습니다.** 훅을 부를 때마다 `Howl`을 하나씩 만들고 마운트 때 로드합니다. 카테고리 볼륨, BGM, 탭 숨김 처리가 없고, 로드 전에 `play()`를 부르면 소리 없이 무시합니다 (`use-sound.esm.js`).
2. **마운트 때 Howl을 만들면(use-sound 방식) WebKit에서 소리가 영영 나지 않았습니다.** 제스처 전에 만든 AudioContext가 WebKit 비표준 상태 `interrupted`로 바뀌는데, Howler 2.2.4의 `_autoResume`에는 이 상태를 되살리는 분기가 없습니다. 30번 클릭해서 30번 모두 재생되지 않았습니다 (WebKit 26.5 실측). Howler 저장소에 같은 증상의 iOS 이슈가 열려 있습니다 ([#1234](https://github.com/goldfire/howler.js/issues/1234) 2019, [#1702](https://github.com/goldfire/howler.js/issues/1702) 2024, [#1753](https://github.com/goldfire/howler.js/issues/1753) 2025).
3. **Howler의 html5 모드(긴 BGM 스트리밍)는 iOS에서 볼륨과 페이드가 듣지 않습니다.** `HTMLMediaElement.volume`을 setInterval로 바꾸는 방식인데, iOS는 이 값을 바꿀 수 없습니다 (Apple 문서 확인).
4. **Howler는 30초 동안 소리가 없으면 컨텍스트를 suspend합니다** (`autoSuspend` 기본 true). 그 뒤 첫 소리는 69~103ms 늦게 시작했습니다 (평소 3~9ms, 실측).
5. 지연은 같고 크기는 절반입니다. 두 엔진 모두 핸들러 진입부터 `start()`까지 중앙값 1ms 이하입니다. 반면 Howler는 9.9KB이고, 카테고리·BGM·가시성 처리를 얹은 어댑터까지 합치면 11.9KB입니다 (자체 래퍼는 4.8KB). Howler는 마지막 릴리스가 2023-09(2.2.4)이고 열린 이슈가 420개입니다.

자체 래퍼의 비용은 iOS 특이 동작을 우리가 직접 챙겨야 한다는 점입니다. 필요한 처리(제스처 안에서 컨텍스트 생성, `interrupted` 복구, resume이 끝나지 않을 때 컨텍스트 재생성, BGM `<audio>` 미리 허가받기)는 스파이크 코드에 넣었고, 실기기 확인 항목은 §7에 정리했습니다.

## 2. 검증한 질문

1. 라이브러리: use-sound(+Howler), Howler 직접, 자체 Web Audio 래퍼, 그 밖의 후보(Tone.js, react-sounds, zzfx)를 번들 크기, 지연, 스프라이트, 동시 재생, BGM 스트리밍·크로스페이드, 카테고리 볼륨, React 19/Next 15 SSR 안전성, 유지보수 상태로 비교
2. 플랫폼 정책: 자동재생과 제스처 해제(Chrome, iOS Safari, Android WebView, 카카오톡 인앱), iOS 무음 스위치와 `navigator.audioSession`, 탭 숨김·화면 잠금, 블루투스 지연, 소리 기본값
3. 포맷: 코덱 지원 범위, 비트레이트, 파일 크기, 루프 이음새(MP3 패딩), 라우드니스 정규화
4. 무료 에셋: Kenney(CC0), Freesound CC0, Pixabay, OpenGameArt, ElevenLabs 생성. 스타터 12종 매핑

## 3. 방법 & 환경

| 구분 | 내용 |
|---|---|
| 문서 확인 | Chrome 자동재생 정책, MDN(User activation, BaseAudioContext.state, AudioSession), W3C Audio Session 초안, MDN browser-compat-data(JSON), caniuse(JSON: opus, ogg-vorbis, mp3, aac), WebKit 버그 237322·262781·291892, Apple Safari HTML5 Audio 가이드(보관 문서), Android `WebSettings`, Howler README·소스, 각 에셋 사이트 라이선스 페이지, ElevenLabs 가격·약관 |
| 실측 | Playwright로 Chromium·Firefox·WebKit 헤드리스 구동. 소리는 들을 수 없으므로 AudioContext 상태 전이, `decodeAudioData` 시간·결과 길이, `start()` 호출 시점, `<audio loop>` 출력 녹음(AudioWorklet)의 무음 구간, 콘솔 경고를 쟀습니다 |
| 브라우저 | Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5 (playwright-core 1.62.1). 저장소의 `@playwright/test` 1.58.2는 캐시에 맞는 브라우저 빌드가 없어서 캐시와 맞는 1.62.1을 스파이크 로컬에만 설치했습니다 |
| WebKit 주의 | Linux WPE 빌드라 코덱은 GStreamer 플러그인에 좌우됩니다. 시스템 라이브러리 6개와 GStreamer good/libav 플러그인을 root 없이 스크래치 디렉토리에 풀어서 썼습니다. **iOS Safari와 같지 않습니다.** 정책 경향을 보는 참고값입니다 |
| 자동재생 재현 | Chromium은 `--autoplay-policy=document-user-activation-required`, Firefox는 `media.autoplay.default=1`, `media.autoplay.block-webaudio=true`로 실제 기본 정책을 맞췄습니다 |
| 측정 함정 | **Playwright의 `page.evaluate`/`waitForFunction`은 사용자 활성화를 부여합니다.** 그래서 "제스처 없이" 시험은 페이지 스크립트와 타이머로만 했습니다 (`gap.html?probe=1`, `?blessTest=6000`). 터치 이벤트별 활성화 여부도 이 때문에 Playwright로는 판단할 수 없어 문서로 확인했습니다 |
| 기타 | WSL2 Ubuntu 24.04, Node 22.23.2, esbuild 0.25.12, ffmpeg 6.1.1. 다른 에이전트가 같은 머신에서 병렬로 작업 중이라 **지연 절댓값은 잡음이 큽니다**. 엔진 간 비교는 같은 조건에서 번갈아 쟀습니다. 헤드리스의 `outputLatency`(WSLg PulseAudio, 75~208ms)는 실기기 값이 아닙니다 |
| 오디오 | 효과음: Kenney CC0 원본을 정규화·인코딩. 루프 시험: 정확히 4.000초 440Hz 코사인. BGM 시험: 75초 합성 루프 3곡(-16 LUFS). 생성 스크립트는 §8 |

## 4. 결과

### 4.1 번들 크기 (실측, esbuild minify, React는 외부로 제외)

| 대상 | min KB | gzip KB | brotli KB | 비고 |
|---|---:|---:|---:|---|
| **자체 엔진 core** (engine + settings + platform) | 13.7 | **4.8** | 4.4 | 의존성 0 |
| **자체 엔진 + React 바인딩** | 15.8 | **5.7** | 5.1 | Provider, `useSfx`, `useBgm`, `useSoundSettings`, 토글 |
| howler 2.2.4 (전체) | 36.4 | 9.9 | 8.9 | core + spatial |
| howler.core.min.js | 26.8 | 8.1 | 7.2 | spatial 제외 |
| use-sound 5.0.0 | 1.7 | 0.8 | 0.8 | + 지연 로드 howler 9.7KB |
| Howler 어댑터 (같은 인터페이스를 Howler로 구현) | 42.1 | 11.9 | 10.7 | 비교용 `src/sound/howlerEngine.ts` |
| react-sounds 1.0.30 | 47.3 | 13.8 | 12.3 | howler 포함 |
| tone 15.1.22 (`import *`) | 340.7 | 81.0 | 68.0 | |
| tone 15.1.22 (Player만) | 231.5 | 59.7 | 50.7 | tree-shaking 후에도 큼 |
| zzfx 1.4.0 | 1.7 | 1.0 | 0.9 | 코드로 효과음 합성 (보조 후보) |

### 4.2 지연 (실측)

효과음 버튼 클릭 → `AudioBufferSourceNode.start()` 호출. 프리로드 후 엔진별 40회씩 2라운드를 번갈아 쟀습니다 (`results/latency.json`). Firefox와 WebKit은 타이머 정밀도가 1ms입니다.

| 브라우저 | 엔진 | 이벤트 → start() 중앙값 / p90 / 최대 (ms) | 핸들러 → start() 중앙값 / p90 (ms) |
|---|---|---|---|
| Chromium 151 | 자체 | 5.9 / 13.8 / 24 | 0.4 / 0.9 |
| | Howler | 3.6 / 8.9 / 18.1 | 0.3 / 0.8 |
| Firefox 153 | 자체 | 7 / 18 / 28 | 0 / 1 |
| | Howler | 9 / 20 / 39 | 1 / 2 |
| WebKit 26.5 | 자체 | 3 / 4 / 13 | 0 / 1 |
| | Howler | 3 / 6 / 20 | 0 / 1 |

- 엔진 자체 오버헤드는 두 엔진 모두 중앙값 1ms 이하입니다. 차이는 입력 파이프라인과 머신 부하 잡음입니다.
- 실제로 들리는 시점 = `start()` + `baseLatency` + `outputLatency`. `baseLatency`는 Chromium 11.6ms(44.1kHz, 512프레임), WebKit 2.9ms, Firefox 0(미보고)이었습니다. `outputLatency`는 기기마다 다르고, 블루투스 이어폰이면 더 깁니다(§4.7).

**첫 탭 지연** (잠금 해제와 첫 소리가 같은 탭, 각 3회, `results/first-tap.json`)

| 브라우저 | 사전 디코드 켬 (OfflineAudioContext) | 사전 디코드 끔 (바이트만 prefetch) |
|---|---|---|
| Chromium | 8.5 / 18.2 / 58.6 ms | 12.4 / 13.2 / 18.8 ms |
| Firefox | 11 / 11 / 11 ms | 26 / 34 / 36 ms |
| WebKit | 29 / 29 / 30 ms | 64 / 80 / 85 ms |

- 사전 디코드는 제스처가 필요 없고 콘솔 경고도 0건입니다. WebKit의 약 29ms는 첫 탭 핸들러 안에서 AudioContext를 만드는 비용으로 보입니다.
- 사전 디코드를 넣기 전 전체 측정(`results/<browser>.json`)에서 첫 소리는 63~441ms였습니다. 부하가 큰 시점의 Chromium이 441ms였습니다. 250ms 늦게 재생 허용 덕분에 첫 소리를 놓친 경우는 없었습니다.

**Howler 30초 무음 후 첫 소리** (autoSuspend 영향): 컨텍스트가 3개 브라우저 모두 `suspended`였고, 첫 소리는 Chromium 103ms, Firefox 69ms, WebKit 20ms 늦었습니다. 자체 엔진은 탭이 보이는 동안 suspend하지 않습니다.

### 4.3 디코드 시간 (실측)

**효과음 12종을 순차 디코드** (파일당, `gap.html`)

| 브라우저 | WebM/Opus 중앙값 · 최대 · 12종 합 | MP3 중앙값 · 최대 · 12종 합 |
|---|---|---|
| Chromium | 8.1 · 34.1 · 145 ms | 3.2 · 16.5 · 73 ms |
| Chromium (CPU 4배 감속) | 10.5 · 56.1 · 175 ms | 8.8 · 25.9 · 136 ms |
| Firefox | 9 · 17 · 112 ms | 8 · 12 · 89 ms |
| WebKit | 17 · 23 · 190 ms | 14 · 18 · 153 ms |

**75초 스테레오 BGM**

| 브라우저 | Opus 96k (0.78MB) | MP3 128k (1.20MB) | AAC 128k (1.20MB) | 디코드 후 메모리 |
|---|---|---|---|---|
| Chromium | 1,999 ms | 1,419 ms | 1,475 ms | 26.5MB (44.1kHz) |
| Firefox | 719 ms | 604 ms | 625 ms | 26.5MB |
| WebKit | 522 ms | 349 ms | 596 ms | 26.5MB |

- 메모리 = 길이 × 샘플레이트 × 채널 수 × 4바이트. 48kHz 기기라면 28.8MB이고, 모노로 만들면 절반입니다.
- `decodeAudioData`는 메인 스레드 밖에서 돌아서 CDP CPU 감속이 거의 반영되지 않습니다. 저사양 기기의 실제 디코드 시간은 P12-04에서 확인해야 합니다.
- 엔진은 BGM을 디코드하는 1~2초 동안 소리 없이 기다렸다가 페이드인합니다. 3개 브라우저 모두 버퍼 모드 BGM이 재생됐고, 스트림 곡으로 바꾸면 이전 슬롯이 해제되는 것까지 확인했습니다.

### 4.4 루프 이음새와 인코더 패딩 (실측)

**`decodeAudioData` 결과 길이** (정확히 4.000초 신호, 기대값 176,400샘플 @44.1kHz)

| 포맷 | Chromium | Firefox | WebKit (Linux) |
|---|---|---|---|
| WAV | -1샘플, 무음 0 | 정확, 무음 0 | 정확, 무음 0 |
| WebM/Opus | -1샘플, 무음 0 | 정확, 무음 0 | 정확, 무음 0 |
| Ogg/Opus | -1샘플, 무음 0 | 정확, 무음 0 | 정확, 무음 0 |
| MP3 (LAME, gapless 태그 있음) | -1샘플, 무음 0 | 정확, 무음 0 | **+1,411샘플: 앞 23.0ms + 뒤 9.0ms 무음 → 루프마다 32ms 끊김** |
| AAC .m4a (ffmpeg, edts 있음) | -1샘플, 무음 0 | 정확, 무음 0 | +1샘플, 무음 0 |

- 실제 효과음에서도 같았습니다. WebKit에서 MP3는 앞 무음이 23~30ms였고, Opus·AAC는 0~5ms(원본 소리의 시작 부분)였습니다 (`results/sfx-padding.json`). MP3 폴백을 쓰면 효과음이 23ms쯤 늦고, BGM 루프가 끊깁니다.
- Chromium의 -1샘플은 48kHz → 44.1kHz 리샘플링 반올림입니다.

**`<audio loop>` 실제 출력의 루프 지점 무음** (9초 녹음, 1ms 이상 무음 구간)

| 포맷 | Chromium | Chromium (CPU 4배) | Firefox |
|---|---|---|---|
| WAV | 8.0 / 16.0 ms | 16.0 / 5.3 ms | 0 |
| WebM/Opus | 18.7 / 18.6 ms | 42.7 / 16.0 ms | 7.5 ms |
| Ogg/Opus | 14.5 / 16.0 ms | 59.8 / 18.7 ms | 6.5 ms |
| MP3 | 13.3 / 5.3 ms | 18.7 / 53.3 ms | 0 |
| AAC .m4a | 39.0 ms | 39.0 / 73.7 ms | 9.7 ms |

- **`<audio loop>`는 Chromium에서 포맷과 상관없이(WAV 포함) 루프마다 5~40ms 끊깁니다.** 부하가 걸리면 74ms까지 끊겼습니다. 스트림 BGM으로는 이음새 없는 루프를 보장할 수 없습니다. 이것이 BGM 기본값을 버퍼 모드로 정한 근거입니다.
- WebKit은 첫 `<audio>`만 재생되고 나머지는 `NotAllowedError`가 났습니다 (요소마다 제스처 필요, §4.5). 재생된 WAV 1개의 무음 구간은 루프 지점과 맞지 않아 결론을 내지 않았습니다.

### 4.5 자동재생·상태 전이 (실측)

| 확인 | Chromium 151 | Firefox 153 | WebKit 26.5 |
|---|---|---|---|
| 제스처 전에 만든 AudioContext | `suspended`, resume() 1초 넘게 미해결 + 콘솔 경고 "The AudioContext was not allowed to start…" | `suspended`, 미해결 + 경고 "An AudioContext was prevented from starting automatically…" | `suspended` → 곧 비표준 **`interrupted`**, 미해결 |
| 자체 엔진 (첫 제스처 안에서 생성) | 생성 즉시 `running` | `suspended` → 104~322ms 뒤 `running` | `suspended` → 43~82ms 뒤 `running` |
| 자체 엔진 콘솔 경고·오류 | 0 | 0 | 0 |
| Howler (첫 제스처에 Howl 생성) | 정상 | 정상 | 정상 |
| Howler (로드 즉시 생성 = use-sound 방식) | `suspended`로 생성, 이후 정상 | `suspended` + 콘솔 경고 1건, 이후 정상 | **`interrupted`에서 멈춤: 30회 클릭 중 0회 재생** |
| 잠금 해제 6초 뒤 제스처 밖(페이지 타이머)에서 재생: 새 `<audio>` | 재생됨 | 재생됨 | **`NotAllowedError`** |
| 같은 조건: 엔진 BGM 슬롯 (unlock 때 `load()`로 미리 허가) | 재생 (282ms) | 재생 (237ms) | **재생 (395ms)** |
| React 19 StrictMode에서 AudioContext 개수 | 1 | 1 | 1 |

### 4.6 기능 검증 (실측, 3개 브라우저 공통)

- **크로스페이드**: 800ms 크로스페이드의 400ms 시점 gain(월드1/월드2)이 Chromium 0.32/0.67, Firefox 0.44/0.56, WebKit 0.47/0.53이었습니다. 끝나면 0/1이 되고 이전 `<audio>`는 일시정지합니다. 스트림 BGM은 `play()` 후 62~366ms 안에 재생을 시작했습니다.
- **가시성**: hidden이 되면 BGM이 멈추고 컨텍스트가 `suspended`가 됩니다. visible이 되면 `running`으로 돌아오고 같은 곡이 이어서 재생됩니다. Howler 어댑터도 같았습니다. `visibilityState`를 덮어써서 흉내 낸 것이라 실제 백그라운드·화면 잠금은 §7에서 확인해야 합니다.
- **음소거**: 음소거 중에는 `start()` 호출이 0회이고 BGM도 멈춥니다. 설정은 localStorage에 저장됩니다.
- **동시 재생**: 코인을 30ms 간격으로 10번 쳐도 10번 모두 시작했고, 코인 동시 재생은 최대 6개로 유지됐습니다.
- **React**: StrictMode에서도 컨텍스트가 1개였습니다. `useBgm`으로 월드1 → 월드2 → 월드맵 나가기를 하면 재생, 크로스페이드, 정지가 순서대로 일어났습니다. 콘솔 오류는 0건입니다.
- **SSR**: Node 22에서 `renderToString(<SoundProvider>…)`가 예외 없이 끝났습니다. 서버에서는 no-op 엔진이 쓰이고, 서버 스냅샷 상태는 `idle`입니다. howler를 import해도, use-sound 컴포넌트를 렌더해도 Node에서 문제가 없었습니다 (`results/ssr-check.json`).

### 4.7 플랫폼 정책 (문서 확인 · 일부 실측)

| 항목 | 내용 | 근거 |
|---|---|---|
| Chrome 자동재생 | 제스처 전에 만든 AudioContext는 `suspended`입니다. 제스처 안에서 `resume()`을 부르거나, 제스처 뒤 연결된 노드에서 `start()`를 부르면 풀립니다 | 문서 확인 [Chrome autoplay](https://developer.chrome.com/blog/autoplay) + 실측 |
| 사용자 활성화 이벤트 | `keydown`, `mousedown`, `pointerdown`(마우스만), `pointerup`(마우스 외), `touchend`. **터치 기기의 `pointerdown`은 활성화가 아닙니다.** Web Audio 자동재생은 sticky activation에 묶입니다 | 문서 확인 [MDN User activation](https://developer.mozilla.org/en-US/docs/Web/Security/User_activation). 엔진은 위 이벤트를 모두 듣고, 잠금 해제 뒤 효과음은 `pointerdown`에서 재생합니다 |
| iOS/iPadOS Safari 제스처 | Web Audio와 `<audio>` 모두 사용자 동작으로 시작해야 합니다. `<audio>`는 요소마다 허가가 필요합니다 | 문서 확인 [Apple Safari HTML5 Audio](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html) (2012 보관 문서) + WebKit 실측 |
| iOS `<audio>` 볼륨 | "volume 속성은 JavaScript로 설정할 수 없고 읽으면 항상 1" → 볼륨·페이드는 GainNode로만 가능합니다 | 문서 확인 (같은 Apple 문서) |
| iOS 무음 스위치 | Web Audio는 기본 `ambient`라서 무음 스위치를 켜면 소리가 나지 않습니다(설계상 의도). `<audio>`는 `playback`이라 무음 스위치를 무시합니다. `<audio>`를 MediaElementSource로 Web Audio에 연결해도 계속 소리가 납니다 | 문서 확인 [WebKit 237322](https://bugs.webkit.org/show_bug.cgi?id=237322) 6번 댓글(WebKit 엔지니어), [WebKit 262781](https://bugs.webkit.org/show_bug.cgi?id=262781) |
| `navigator.audioSession` | Safari/iOS 16.4+. Chrome 없음, Firefox는 preview. 타입은 `auto`, `playback`, `transient`, `transient-solo`, `ambient`, `play-and-record`. `auto`는 미디어 요소가 있으면 `playback`, Web Audio만 있으면 `ambient`로 정해집니다. iOS 17+에서는 `'playback'`으로 무음 스위치를 무시하게 할 수 있습니다 | 문서 확인 [W3C Audio Session](https://w3c.github.io/audio-session/), MDN BCD `api/AudioSession.json`, WebKit 237322 |
| **우리 설정** | 엔진을 만들 때 `'ambient'`로 둡니다. 효과음·BGM이 무음 스위치를 따르고 다른 앱 음악과 섞입니다. "읽어주기"처럼 사용자가 직접 누르는 음성만 재생하는 동안 `'playback'`으로 바꿨다가 끝나면 되돌립니다. BGM을 버퍼 모드(Web Audio만 사용)로 두면 audioSession이 없는 iOS 15~16.3에서도 무음 스위치를 따릅니다 | 설계 (실기기 미확인, §7) |
| 화면 꺼짐·탭 전환 (iOS) | AudioContext가 `interrupted`가 되며, 다시 `resume()`해야 합니다 | 문서 확인 [MDN BaseAudioContext.state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state) |
| iOS PWA 복귀 버그 | 백그라운드에서 돌아오면 `running`인데도 소리가 안 나거나, `resume()`이 끝나지 않습니다(iOS 18~26). 26.2 베타 3에서 고쳐졌다는 사용자 보고가 있지만 버그는 열려 있습니다 | 문서 확인 [WebKit 291892](https://bugs.webkit.org/show_bug.cgi?id=291892). 엔진 대응: resume이 1.5초 안에 끝나지 않으면 다음 탭에서 컨텍스트를 새로 만들고, AudioBuffer는 재사용합니다 |
| 백그라운드 탭 (Chrome 등) | Web Audio는 계속 재생됩니다. 그래서 `visibilitychange`/`pagehide`에서 직접 BGM을 멈추고 300ms 뒤 suspend합니다 | 실측 (흉내 낸 가시성) |
| Android WebView (카카오톡 Android) | `setMediaPlaybackRequiresUserGesture` 기본값이 `true`라서 제스처가 필요합니다. 카카오톡의 실제 설정은 알 수 없습니다 | 문서 확인 [Android WebSettings](https://developer.android.com/reference/android/webkit/WebSettings#setMediaPlaybackRequiresUserGesture(boolean)), 미확인 |
| iOS 카카오톡 인앱 (WKWebView) | `mediaTypesRequiringUserActionForPlayback`은 앱이 정하며 기본값은 문서에 없습니다. WKWebView에서 audioSession을 쓸 수 있는지도 확인하지 못했습니다 | 미확인 (P3-19) |
| Firefox | 소리 있는 자동재생을 막습니다. 제스처 전 AudioContext에 콘솔 경고가 납니다 | 실측 |
| 블루투스 지연 | A2DP 이어폰은 보통 100~300ms 늦습니다. `AudioContext.outputLatency`로 읽을 수 있습니다(Chrome 102+, Firefox 70+, Safari 18.4+) | 지연 범위는 일반 지식(미확인), 지원 버전은 문서 확인(MDN BCD) |
| 출력 지연 정책 | 게임 판정을 소리 타이밍에 묶지 않습니다. 시각 연출이 소리를 기다리지 않습니다. `outputLatency`가 150ms를 넘으면 대사 블립을 끕니다(글자보다 늦게 들리면 어색함) | 설계 |

**소리 기본값** (`prefers-reduced-motion` 같은 소리용 미디어 쿼리는 없으므로 사용자 설정만 따릅니다. §2.6에 따라 시간대별 규칙은 두지 않습니다)

- 첫 사용자 동작 전에는 아무 소리도 내지 않습니다 (정책상으로도 불가). 랜딩에서 BGM 자동 재생은 하지 않습니다.
- 효과음 ON(0.7), BGM OFF(켜면 0.4), 음성 0.9, 마스터 0.8. 파일을 정규화해 두었기 때문에 실효 레벨은 효과음 약 -5dB, BGM 약 -10dB이고, BGM이 항상 효과음 아래에 깔립니다.
- HUD 음소거 토글을 항상 보이게 둡니다 (48px). 설정 화면에서 효과음·BGM·음성을 각각 켜고 끄고 볼륨을 조절합니다. 설정은 기기에 저장하고, 로그인하면 `users.settings.sound`와 동기화합니다(`updatedAt`이 늦은 쪽 우선).
- 오답은 부드럽고 조용하게 냅니다(목표 RMS -22dB). 경고 부저 같은 소리는 쓰지 않습니다. 버그버그 에러는 장난스러운 소리로 냅니다.
- 반복되는 소리(대사 블립, 코인)는 동시 재생 상한(2개, 6개)과 낮은 gain(0.35)을 둡니다. 전체 동시 재생은 24개까지입니다.
- 크롬북에는 무음 스위치가 없어서 교실에서는 음소거 토글이 유일한 수단입니다. 첫 방문 때 한 번 "🔇로 소리를 끌 수 있어요" 안내를 띄우는 것을 P2-14에서 검토합니다.

### 4.8 포맷 지원과 에셋 크기

**코덱 지원** (문서 확인: caniuse JSON, `audio` 요소 기준)

| 코덱·컨테이너 | Chrome·Android·크롬북 | Firefox | Safari·iOS |
|---|---|---|---|
| Opus in WebM | 33+ | 15+ | **iOS 17.4 부분(회귀 버그), 17.5+ 지원**. 그 전에는 CAF 컨테이너에서만 |
| Opus·Vorbis in Ogg | 지원 | 지원 | 18.4+ |
| MP3 | 지원 | 지원 | 지원 |
| AAC (.m4a) | 지원 | OS 코덱이 있을 때만 (Opus를 쓰므로 무관) | 지원 |

- 결론은 `[.webm(Opus), .m4a(AAC)]` 순서입니다. iOS 17.5 미만(예: iPadOS 16이 마지막인 iPad 5세대, 17이 마지막인 iPad 6세대 중 17.3 이하)만 AAC를 받습니다.
- Howler의 `codecs('webm')`은 Opus가 아니라 `codecs="vorbis"`로 검사합니다(소스 L286-287). 지금 브라우저들에서는 결과가 대체로 겹치지만(Safari는 WebM 안의 Vorbis를 macOS 14.1+, iOS 17.4+부터 지원), Opus 지원을 직접 확인하지는 않습니다. 자체 엔진은 `audio/webm; codecs="opus"`로 검사하고, 디코드에 실패하면 다음 후보로 넘어갑니다.

**에셋 크기** (실측)

| 묶음 | WebM/Opus | AAC .m4a | MP3 (비교) |
|---|---|---|---|
| 효과음 12종 (모노, 0.06~1.8초) | 87.6KB (Opus 64k) | 104.9KB (96k) | 97.6KB (96k) |
| BGM 75초 1곡 (스테레오) | 713~850KB (96k VBR) | 1,172~1,176KB (128k) | 1,173KB (128k) |
| BGM 3곡 | 약 2.3MB (BGM을 켠 사용자만, 현재 월드 곡만 받음) | 약 3.5MB (구형 Safari만) | |

**라우드니스** (실측): Kenney 원본은 RMS가 -34dBFS(handleCoins2)부터 -10dBFS(lowRandom)까지 24dB 차이가 났습니다. 몇 개는 true peak가 0dBTP를 넘었습니다(metalLatch +2.1, tick_002 +1.1, switch1 +1.0, pluck_002 +1.0). 그대로 쓰면 소리 크기가 들쭉날쭉하고 클리핑이 생깁니다. 파이프라인(`scripts/build-sounds.sh`) 처리 후에는 RMS가 역할별 목표(-18~-24dB) 안에 들어왔고 피크는 -0.2dBTP 이하였습니다.

- 목표: 효과음은 역할별 RMS(탭·블립 -24, 피드백 -19~-22, 징글 -18) + 피크 -1.5dBFS. BGM은 -16 LUFS 통합 라우드니스 + true peak -1.5dBTP.
- 0.4초 미만 효과음은 LUFS 측정 게이트에 걸려 -70이 나오므로 RMS로 맞춥니다.
- MP3/AAC 인코딩에서 피크가 최대 1.3dB 올라갔습니다. 정식 파이프라인은 리미터를 -2dBFS로 두거나 `loudnorm`의 TP 옵션을 씁니다.

## 5. 선택지 비교

| 기준 | use-sound + Howler | Howler 직접 + 자체 어댑터 | **자체 Web Audio 래퍼** | Tone.js | react-sounds |
|---|---|---|---|---|---|
| 크기 (gzip) | 0.8 + 지연 9.7KB | 11.9KB | **4.8KB (React 포함 5.7)** | 60~81KB | 13.8KB |
| 효과음 지연 | Web Audio 버퍼, 핸들러 → start() < 1ms | 같음 | 같음 | 같음 (스케줄러가 붙음) | Howler와 같음 |
| 첫 탭 지연 | 마운트 때 로드(그래서 WebKit에서 멈춤) | 첫 제스처 때 로드: 첫 소리 63~403ms | **사전 디코드: 8~30ms** | - | - |
| 스프라이트 | 있음 | 있음 | `start(when, offset, dur)`로 몇 줄이면 됨 (현재 없음. 파일 12개라 불필요) | 있음 | - |
| 동시 재생 | 풀 (상한 없음) | 상한은 직접 구현 | 효과음별 상한 + 전체 24 | 있음 | 풀 |
| BGM 스트리밍 | html5 모드 (iOS 볼륨 불가) | 같음 | `<audio>` → GainNode (iOS 볼륨 가능) + 버퍼 루프 | Player (버퍼) | Howler |
| 크로스페이드 | 직접 (html5는 iOS 불가) | `fade()` (html5는 iOS 불가) | GainNode 램프 | 있음 | - |
| 카테고리 볼륨 | 없음 | 직접 구현 | GainNode 3개 | 직접 | 일부 |
| iOS `interrupted` 복구 | 없음 (멈춤 실측) | 없음 | 매 탭 resume + 타임아웃 시 재생성 | - | Howler와 같음 |
| SSR / React 19 | 안전 (실측) | import 안전 (실측) | no-op 엔진 + 서버 스냅샷 (실측) | 클라이언트 전용 | peer 19 명시 |
| 유지보수 | use-sound 5.0.0 (2025-02), Howler 2.2.4 (2023-09), 열린 이슈 420 | Howler와 같음 | 우리 코드 (엔진+React 약 1,250줄, 주석 포함, 단위 테스트 가능) | 활발 (2026-10) | 1인 관리 (2026-03) |
| 판단 | **불가** (Provider 구조와 안 맞고 WebKit에서 멈춤) | **2순위 대안** | **채택** | 불가 (음악 합성용이라 과함) | 불가 |

zzfx(1KB)는 코드로 효과음을 합성하는 도구입니다. 스타터 효과음을 Kenney로 정했으므로 지금은 쓰지 않습니다. 버튼마다 다른 피치의 짧은 블립이 많이 필요해지면 다시 검토합니다.

## 6. 이후 Phase 영향

### 6.1 `docs/4.upgrade-plan.md` 수정 제안 (P0-11에서 반영)

**§2.5 사운드 줄** (현재: "사운드: `use-sound`(Howler) 기반 `SoundProvider`. 효과음은 기본 ON, BGM은 기본 OFF.")

> - 사운드: 의존성 없는 자체 Web Audio 래퍼(`src/lib/sound/`, gzip 약 5KB) + `SoundProvider`(`src/components/providers/`). 카테고리(효과음·BGM·음성)별 켜기·볼륨과 음소거 토글을 두고, 효과음은 기본 ON, BGM은 기본 OFF(§12-Q8). 효과음은 미리 디코드한 AudioBuffer로 첫 탭부터 바로 재생하고, BGM은 디코드 후 끊김 없이 루프하며 월드를 옮길 때 크로스페이드, 탭이 숨겨지면 멈춥니다. iOS는 `navigator.audioSession.type = 'ambient'`로 무음 스위치를 따릅니다. 포맷은 WebM(Opus) + AAC(.m4a) 폴백. 근거: [P0-15](spikes/P0-15-sound.md)

**§2.2 `users` 행**: `settings jsonb`(사운드 등) 그대로 두고, 형태만 덧붙입니다: `settings.sound = { version, muted, master, sfx:{enabled,volume}, bgm:{enabled,volume}, voice:{enabled,volume}, updatedAt }`

**§3 F10 내용**:
> 효과음 12종(정답·오답·코인·별·레벨업·탭·해제·보물상자·실행·버그버그·대사 블립·축하), 월드별 BGM(기본 OFF), 음소거 토글과 카테고리별 볼륨

**§7 ElevenLabs 행 비고**:
> 비용 발생. 무료 플랜은 비상업 전용(약관 1(c)), 상업 라이선스는 Starter(월 $6, 첫 달 $1)부터, 효과음 1회 생성에 약 200크레딧. 스타터 효과음은 Kenney CC0로 충분(P0-15) → 음성(읽어주기)을 도입할 때 다시 검토

**Phase 항목 교체 문구**

- **P2-14** 사운드 디자인: 스타터 효과음 12종(P0-15 Kenney CC0 초안: 정답·오답·코인·별·레벨업·탭·해제·보물상자·실행·버그버그·대사 블립·축하) **청취 검수 후 확정·교체** + 월드별 BGM 3곡 선정(CC0 또는 Pixabay, 60~75초 루프, -16 LUFS) + `SoundProvider`(P0-15 자체 Web Audio 래퍼) + HUD 음소거 토글 + 설정 화면(효과음·BGM·음성 각각 켜기/볼륨)
- **P2-16** 에셋 파이프라인: 일러스트 생성 → 보정 → SVGO/WebP, `public/animations`, `public/sounds/{sfx,bgm}` 구조. 사운드는 `scripts/build-sounds.sh`(P0-15 초안: 앞 무음 제거 → 정규화 → WebM/Opus + AAC 인코딩)로 만듭니다
- **P2-17** `docs/assets-license.md` 작성 (사운드는 P0-15 §6.3 표에서 시작)
- **P5-11** 월드 BGM(`useBgm(world.bgm)`, 기본 OFF, 월드를 옮길 때 800ms 크로스페이드, 디코드된 BGM은 현재 월드 곡만 보관) + 노드 탭(`tap`)·잠금 해제(`unlock`) 효과음
- **P6-14** 효과음 연동: 실행 `run`, 성공 `correct`, 에러 `bug`(버그버그 등장과 함께, 경고음 대신 장난스럽게), 별 1→3 `star`(rate 1 / 1.26 / 1.5), 코인 카운트업 `coin`(동시 최대 6), 대사 타이핑 `blip`(2~3글자마다, 낮은 볼륨), 축하 `celebrate`·`levelup`
- **P7-09** 정답·오답 연출과 효과음 (콤보 표시: 연속 정답마다 `correct` 피치를 조금씩 올림(rate 1 → 1.12 → 1.26), 오답 `wrong`은 낮은 볼륨의 부드러운 소리)
- **P3-19** 끝에 추가: "사운드도 함께 확인: 첫 탭 후 효과음, iPhone 무음 스위치(효과음·BGM이 꺼져야 함), 백그라운드 복귀·화면 잠금 후 소리 복구 (P0-15 §7)"
- **P12-04** 끝에 추가: "사운드: iPadOS 15~17.3에서 AAC 폴백 재생, BGM 버퍼 메모리(곡당 약 26MB), 블루투스 이어폰 지연"
- **P2-15 / P0-16 저사양 모드**: `minimal` 단계에서는 BGM을 끄거나 스트림 모드로 둡니다. 효과음은 유지합니다.
- **P12-01 메모**: Playwright `page.evaluate`는 사용자 활성화를 부여하므로, 자동재생·잠금 해제 e2e는 실제 클릭과 페이지 스크립트로 검증합니다.

### 6.2 구현 메모 (Phase 2에서 `src/`로 옮길 때)

- 옮길 파일: `spikes/p0-15-sound/src/sound/{types,settings,platform,webAudioEngine,noopEngine,index}.ts` → `src/lib/sound/`, `src/react/SoundProvider.tsx` → `src/components/providers/SoundProvider.tsx`. `howlerEngine.ts`와 `demo/`는 옮기지 않습니다.
- 루트 레이아웃에서 `MotionProvider` 옆에 `<SoundProvider manifest={…} serverSettings={user?.settings?.sound}>`를 둡니다. 효과음 ID는 `SfxId` 유니언 타입으로 관리합니다.
- 단위 테스트(`src/lib/sound/__tests__/`): `normalizeSettings`·`mergeSettings`·`pickNewerSettings`, 동시 재생 상한, `reconcileBgm` 상태 전이(가짜 AudioContext 사용).
- 사운드 파일은 이름에 버전이나 해시를 넣고 `next.config.ts`의 `headers()`로 `/sounds/*`에 `Cache-Control: public, max-age=31536000, immutable`을 줍니다 (Phase 2에서 결정. 이 스파이크에서는 설정을 바꾸지 않았습니다). Vercel 정적 파일은 Range 요청을 지원합니다. 스트림 BGM은 Range가 있어야 WebKit에서 재생됩니다.
- 스프라이트는 지금 필요 없습니다 (12개, HTTP/2, 사전 디코드). 효과음이 40개를 넘으면 `start(0, offset, duration)` 방식의 스프라이트를 검토합니다.

### 6.3 `docs/assets-license.md` 사운드 초안 (P2-17)

모두 **CC0 1.0** (https://creativecommons.org/publicdomain/zero/1.0/), 제작 Kenney (www.kenney.nl), 받은 날 2026-11-03. 크레딧은 의무가 아니지만 크레딧 페이지에 "Sound effects: Kenney (kenney.nl), CC0"를 남깁니다. 라이선스 원문은 `spikes/p0-15-sound/sounds/LICENSE-kenney.txt`에 있습니다.

| 파일 (`public/sounds/sfx/`) | 용도 | 팩 | 원본 파일 | 가공 | 길이 | 크기 webm / m4a |
|---|---|---|---|---|---|---|
| `tap` | 클릭/탭 | Interface Sounds | `click_001.ogg` | 정규화(RMS -24) | 0.10s | 2.3 / 2.3KB |
| `blip` | 타이핑/대사 블립 | Interface Sounds | `tick_004.ogg` | RMS -24 | 0.06s | 1.6 / 1.9KB |
| `correct` | 정답 | Interface Sounds | `confirmation_002.ogg` | RMS -19 | 0.55s | 5.8 / 7.8KB |
| `wrong` | 오답 (부드럽게) | Interface Sounds | `error_006.ogg` | RMS -22 | 0.48s | 6.2 / 7.0KB |
| `coin` | 코인 | RPG Audio | `handleCoins2.ogg` | RMS -19 (+14.7dB) | 0.29s | 3.6 / 4.8KB |
| `star` | 별 획득 1→3 (rate 1/1.26/1.5) | Interface Sounds | `glass_001.ogg` | RMS -20 | 0.28s | 3.4 / 4.5KB |
| `run` | 실행 버튼 | Digital Audio | `phaseJump1.ogg` | RMS -20 | 0.37s | 3.8 / 5.4KB |
| `bug` | 에러 (버그버그 등장) | Digital Audio | `lowRandom.ogg` | RMS -21 | 0.46s | 4.5 / 6.8KB |
| `unlock` | 스테이지 해제 | RPG Audio + Interface Sounds | `metalLatch.ogg` + `maximize_004.ogg`(+150ms) | 믹스, RMS -19 | 0.58s | 6.3 / 8.1KB |
| `chest` | 보물상자 | RPG Audio | `creak1.ogg` + `handleCoins.ogg`(+300ms) | 믹스, RMS -19 | 1.09s | 11.5 / 14.5KB |
| `levelup` | 레벨업 징글 | Music Jingles | `8-Bit jingles/jingles_NES00.ogg` | RMS -18 | 1.77s | 23.4 / 22.2KB |
| `celebrate` | 축하 (스테이지 클리어) | Music Jingles | `Steel jingles/jingles_STEEL07.ogg` | RMS -18 | 1.56s | 15.1 / 19.7KB |

공통 가공: 앞 무음 제거, 모노 48kHz, 리미터 -1.5dBFS, Opus 64k / AAC 96k. 팩 주소는 `https://kenney.nl/assets/{interface-sounds,digital-audio,rpg-audio,music-jingles}`입니다. 위 선정은 파일명·길이·레벨로만 골랐고 **사람이 들어 보지 않았습니다**. 함께 받은 Casino Audio, UI Audio, Impact Sounds(모두 CC0)가 교체 후보입니다.

**BGM과 추가 출처 규칙**

| 출처 | 라이선스 | 사용 규칙 |
|---|---|---|
| Kenney | CC0 | 효과음 기본 출처. 음악 루프 팩은 없음 (징글만 있음) |
| OpenGameArt | 파일마다 다름 (CC0, CC-BY, CC-BY-SA, OGA-BY, GPL) | **CC0만** 씁니다. CC-BY/OGA-BY는 크레딧 페이지가 있을 때만. CC-BY-SA, GPL은 쓰지 않습니다 |
| Freesound | CC0 / CC BY / CC BY-NC (Sampling+는 폐지 중) | **CC0만** 씁니다. BY-NC는 금지. 파일별 URL과 작성자를 기록합니다 |
| Pixabay (음악·효과음) | Pixabay Content License: 무료, 상업 이용·수정 가능, 출처 표기 불필요. 원본 그대로 단독 재배포·판매 금지, 상표 사용 금지 | 앱에 넣어 쓰는 것은 허용됩니다. 업로더 권리 문제는 이용자 책임이라고 명시되어 있으므로 파일별 페이지 URL을 기록합니다. BGM 후보 1순위 |
| ElevenLabs 생성 | 출력물 권리는 이용자에게 있음. **무료 플랜은 비상업 전용**, 상업 이용은 유료(Starter 월 $6)부터. 만 18세 미만은 서비스를 이용할 수 없음(운영자만 사용) | §12-Q10(무료 티어 우선)에 따라 지금은 쓰지 않습니다. 필요하면 한 달만 유료로 생성하고 생성 날짜·프롬프트를 기록합니다 |

## 7. 남은 리스크 & 사용자 확인 필요 사항

**사용자 확인 필요**

1. **효과음 12종 청취 검수**: 이 스파이크에서는 소리를 들을 수 없어서 파일명과 레벨로만 골랐습니다. 데모 페이지(§8)에서 직접 들어 보고 마음에 안 드는 것을 알려 주세요 (P2-14). 특히 `wrong`(무섭지 않은지), `bug`(장난스러운지), `coin`이 확인 대상입니다.
2. **BGM 3곡 선정**: Kenney에 음악 루프가 없습니다. Pixabay 또는 OpenGameArt CC0에서 월드 분위기에 맞는 60~75초 루프를 고르는 일은 취향이 필요합니다 (P2-14).
3. **ElevenLabs**: 무료 플랜으로는 상업 이용이 불가합니다. 지금은 쓰지 않는 쪽으로 제안합니다.

**실기기 확인 (P3-19, P12-04에 추가 제안)**

| 확인 | 기대 동작 | 왜 실기기인가 |
|---|---|---|
| iPhone 무음 스위치 ON (iOS 16.4+) | 효과음·BGM 무음, "읽어주기"는 소리남 | `audioSession`은 Safari 전용이라 헤드리스에서 확인 불가 |
| iPhone 무음 스위치 ON (iOS 15~16.3) | 효과음·BGM(버퍼) 무음 | audioSession이 없어 Web Audio 기본(ambient)에 의존 |
| 다른 앱 음악 재생 중 효과음 | 음악이 끊기지 않고 섞임 (ambient) | 같음 |
| 카카오톡 인앱 (iOS WKWebView, Android WebView) | 첫 탭 후 효과음, BGM 켜기, 화면 잠금 후 복구 | 앱별 WebView 설정을 알 수 없음 |
| 전화 수신·Siri·화면 잠금 후 복귀 (iOS) | 다음 탭에서 소리 복구 (`interrupted` → resume, 안 되면 재생성) | 헤드리스에서는 가시성만 흉내 냄 |
| 홈 화면 PWA 복귀 (X9, iOS 18~26) | 소리 복구 | WebKit 291892 |
| iPadOS 15~17.3 기기 | AAC 폴백으로 재생 | Opus 미지원 버전 |
| 구형 iPad·크롬북에서 BGM 켜기 | 디코드 2초 이내, 메모리 문제 없음 (곡당 약 26MB) | 디코드는 메인 스레드 밖이라 CPU 감속으로 재현 불가 |
| 블루투스 이어폰 | 효과음이 늦게 들려도 진행에 지장 없음, 블립 자동 끔(`outputLatency` > 150ms) | 출력 지연은 기기마다 다름 |

**기술 리스크**

- 자체 래퍼는 iOS 특이 동작을 우리가 챙겨야 합니다. 위 실기기 표를 통과하지 못하는 항목이 나오면 해당 부분만 Howler 방식(첫 제스처에 생성, autoSuspend 끔)으로 바꾸는 것이 2순위 대안입니다.
- `audioSession.type`을 재생 중에 바꿨을 때의 동작은 표준 초안에 정의되어 있지 않습니다. "읽어주기"를 도입할 때 실기기에서 다시 확인합니다.
- WebKit 측정은 Linux GStreamer 경로입니다. Safari(AudioToolbox)의 MP3 패딩과 `<audio loop>` 끊김은 다를 수 있습니다. 결론(Opus + AAC, 버퍼 루프)은 어느 쪽이든 안전한 선택입니다.
- 지연 절댓값은 병렬 작업 부하로 잡음이 큽니다. 엔진 간 상대 비교와 "1ms 미만 엔진 오버헤드"는 유효합니다.

## 8. 재현 방법

```bash
cd spikes/p0-15-sound
npm install                    # 스파이크 로컬 (node_modules는 gitignore)
npm run gen:test-audio         # generated/: 루프 시험 신호, 75초 BGM 3곡 (ffmpeg 필요, 약 2분)
npm run build                  # dist/: 데모 번들
npm run serve                  # http://127.0.0.1:3115/ (포트 고정, Ctrl+C로 종료)
```

- 브라우저에서 `http://127.0.0.1:3115/`(자체 엔진), `?engine=howler`, `?engine=howler-eager`(use-sound 방식), `gap.html`(코덱·루프 틈), `react.html`(Provider)을 열어 직접 들어 볼 수 있습니다.
- 측정 (서버를 켠 상태에서, 다른 터미널):

```bash
node bench/measure.mjs [chromium firefox webkit] [--quick]   # results/<browser>.json (전체 약 12분)
node bench/latency.mjs                                       # results/latency.json
node bench/first-tap.mjs                                     # results/first-tap.json
node bench/ssr-check.mjs                                     # results/ssr-check.json
```

- WebKit은 Linux에 시스템 라이브러리가 없으면 실행되지 않습니다. `npx playwright install-deps webkit`(sudo 필요)을 하거나, 이 스파이크처럼 `apt-get download`로 받은 .deb를 `dpkg -x`로 풀고 `LD_LIBRARY_PATH`·`GST_PLUGIN_PATH`를 지정한 래퍼를 `WK_EXECUTABLE=<래퍼의 pw_run.sh>`로 넘깁니다. 받은 패키지: libavif16, libenchant-2-2, libevent-2.1-7t64, libgstreamer-plugins-bad1.0-0, libwayland-server0, libwebpdemux2, libgav1-1, libnice10, libxkbcommon-x11-0, libyuv0, gstreamer1.0-plugins-good, gstreamer1.0-libav.
- 번들 크기: 임시 디렉토리에 `npm i esbuild@0.25.12 howler@2.2.4 use-sound@5.0.0 tone@15.1.22 zzfx@1.4.0 react-sounds@1.0.30 react@19.1.0 react-dom@19.1.0`을 설치하고 `bench/bundle-size.mjs`를 복사한 뒤 `node bundle-size.mjs <spikes/p0-15-sound 절대경로> <출력.json>`을 실행합니다.
- 효과음 재생성: Kenney 4개 팩(위 표)을 받아 `ex-<slug>/` 이름으로 압축을 풀고 `bash scripts/build-sounds.sh <그 상위 디렉토리>`를 실행합니다.
- 타입 체크: `npm run typecheck`
