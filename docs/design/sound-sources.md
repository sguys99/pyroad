# 사운드 출처·라이선스 (P2-14 → P2-17 `docs/assets-license.md`로 옮길 표 초안)

> 받은 날: 효과음 팩 2026-11-05(OpenGameArt의 Kenney 공식 업로드, P0-15는 kenney.nl에서 2026-11-03), 배경음악 후보 2026-11-05.
> 상태: **사용자 청취 검수 전 초안**. 검수 보드: `design/prototypes/dist/sound-review.html`.
> 처리: `scripts/build-sounds.sh` (규칙은 [sound.md](sound.md)).

## 규칙 (P0-15 §6.3)

| 출처 | 라이선스 | 사용 규칙 |
|---|---|---|
| Kenney | CC0 1.0 | 효과음 기본 출처. 음악 루프 팩은 없음(징글만). 크레딧 의무는 없지만 크레딧 페이지에 "Sound effects: Kenney (kenney.nl), CC0" |
| OpenGameArt | 파일마다 다름 | **페이지의 License(s)가 CC0 하나뿐인 것만** 씀. CC-BY·OGA-BY는 크레딧 페이지가 생기면 검토, CC-BY-SA·GPL은 쓰지 않음. 올린 사람(Submitted by)과 작가(Author)가 다른 페이지는 권리 확인이 어려워 제외 |
| Freesound | CC0 / BY / BY-NC | CC0만 (이번에는 쓰지 않음) |
| Pixabay | Pixabay Content License | 앱에 넣어 쓰는 것은 허용, 단독 재배포 금지, 업로더 권리 문제는 이용자 책임 → 파일별 URL 기록 필수. **이번에는 쓰지 않음**: OpenGameArt CC0만으로 월드별 후보 2곡씩을 구할 수 있었고, Pixabay는 사이트가 자동 접근을 막아 라이선스 조건·업로더를 파일마다 확인할 수 없었다 |
| ElevenLabs 생성 | 무료 플랜 비상업 전용 | 쓰지 않음 (§12-Q10) |

## 효과음 12종 (`public/sounds/sfx/<id>.v1.{webm,m4a}`)

모두 Kenney, CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). 팩 원본: kenney.nl/assets/{interface-sounds, digital-audio, rpg-audio, music-jingles} = OpenGameArt [interface-sounds](https://opengameart.org/content/interface-sounds) · [63-digital-sound-effects](https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc) · [50-rpg-sound-effects](https://opengameart.org/content/50-rpg-sound-effects) · [85-short-music-jingles](https://opengameart.org/content/85-short-music-jingles) (작가 Kenney, License CC0).

| id | 쓰임 | 팩 | 원본 | 목표 RMS | 길이 | webm / m4a |
|---|---|---|---|---|---|---|
| `tap` | 주요 버튼 | Interface Sounds | `click_001` | -24 | 0.10s | 2.2 / 2.3KB |
| `blip` | 대사 블립 | Interface Sounds | `tick_004` | -24 | 0.06s | 1.6 / 1.8KB |
| `correct` | 정답 | Interface Sounds | `confirmation_002` | -19 | 0.54s | 5.7 / 7.7KB |
| `wrong` | 오답 (부드럽게) | Interface Sounds | `question_002` (**P2-14 교체**, 이전 `error_006`) | -23 | 0.33s | 3.4 / 5.0KB |
| `coin` | 코인 | RPG Audio | `handleCoins2` | -19 | 0.29s | 3.5 / 4.9KB |
| `star` | 뱃지 (1→3 상승) | Interface Sounds | `glass_001` | -20 | 0.28s | 3.4 / 4.4KB |
| `run` | 실행 | Digital Audio | `phaseJump1` | -20 | 0.34s | 3.5 / 5.3KB |
| `bug` | 에러 (버그버그) | Digital Audio | `phaserDown1` (**P2-14 교체**, 이전 `lowRandom`) | -21 | 0.35s | 4.4 / 5.5KB |
| `unlock` | 황금키·해제 | RPG Audio + Interface Sounds | `metalLatch` + `maximize_004`(+150ms) | -19 | 0.57s | 6.3 / 8.1KB |
| `chest` | 보물상자 | RPG Audio | `creak1` + `handleCoins`(+300ms) | -19 | 1.08s | 11.5 / 14.4KB |
| `levelup` | 레벨업 | Music Jingles | `jingles_NES00` | -18 | 1.76s | 23.3 / 22.1KB |
| `celebrate` | 스테이지 클리어 | Music Jingles | `jingles_STEEL07` | -18 | 1.55s | 15.1 / 19.6KB |

합계 webm 83.9KB / m4a 101.1KB. Kenney 라이선스 원문(팩의 License.txt): "License: (Creative Commons Zero, CC0) … This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)". Digital Audio(OGA 업로드)의 readme: "You may use these sounds in personal and commercial projects. Credit (www.kenney.nl) would be nice but is not mandatory." (OGA 페이지 License: CC0)

## 배경음악 후보 (OpenGameArt, 모두 CC0 1.0, 받은 날 2026-11-05)

`public/sounds/bgm/`에는 각 월드의 **A 후보만** 넣었다 (`world{1,2,3}.v1`). B 후보는 검수 보드에만 있다 (원본은 아래 주소에서 다시 받아 `scripts/build-sounds.sh bgm`).

| 월드 | 후보 | 곡 | 작가 | 페이지 | 받은 파일 | 길이 | 원본 LUFS | 비고 |
|---|---|---|---|---|---|---|---|---|
| 1 숲·섬 | **A** (앱 기본) | Keep your dream alive! (seamless) | congusbongus | https://opengameart.org/content/keep-your-dream-alive-seamless-loop (2020-04-21) | `Keep your dream alive! seamless.ogg` | 73.4s | -16.7 | 작가가 seamless loop로 올림 |
| 1 | B | Flowerbed Fields | Zane Little Music | https://opengameart.org/content/flowerbed-fields-loop (2023-05-14) | `flowerbed_fields.wav` | 105.9s | -18.8 | 목표(60~75s)보다 김. 52.97s에 비슷한 반복(상관 0.89)이 있어 앞 절반만 쓰는 안 가능 |
| 2 바다·하늘 | **A** (앱 기본) | Aurora | Trex0n | https://opengameart.org/content/aurora-0 (2021-05-31) | `aurora.wav` | 80.0s | -21.3 | "water level용 짧은 루프" |
| 2 | B | Gumdrop Plains (2024) | Bobjt | https://opengameart.org/content/gumdrop-plains (2019-06-04, 2024 리마스터) | `gumdrop_plains_2024.ogg` | 87.0s | -8.6 | 원본 true peak +2.9dBTP(클리핑) → gain -7.4dB로 해소 |
| 3 공방·메이커 | **A** (앱 기본) | A Respectable Amount of Bounce | Some Weirdo | https://opengameart.org/content/a-respectable-amount-of-bounce (2025-09-27) | `a_respectable_amount_of_bounce.ogg` | 76.8s | -23.2 | 38.4s 구간 2회(상관 0.97) |
| 3 | B | Wacky Workings | Fupi | https://opengameart.org/content/wacky-workings (2021-02-23) | `wackyworkings.wav` | 39.6s | -16.0 | 짧아서 반복이 잦음 |

처리 후(앱 파일): world1 73.39s · -16.0 LUFS · TP -1.2dBTP · webm 858KB / m4a 1,166KB, world2 79.99s · -16.0 · -1.5 · 1,270 / 1,361KB, world3 76.79s · -16.0 · -2.4 · 1,159 / 1,227KB. Chromium `decodeAudioData` 길이 = 원본 − 256샘플(이음매 크로스페이드)로 webm·m4a 모두 정확, 끝→처음 샘플 차이는 곡 안의 최대 인접 차이의 4~18%.

검토했지만 넣지 않은 것: 끝에 페이드아웃·무음이 있어 루프가 아닌 곡(Bouncy Hamster, Snow Globe, Seaside Village, Sunny Day, Toy Soldiers 등), 이음매 점프가 큰 곡(Through Sea), 3분 넘는 곡.
