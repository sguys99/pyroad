# 사운드 가이드 (P2-14)

> 근거: [P0-15](../spikes/P0-15-sound.md) · 계획서 §2.5 사운드 · §12-Q8 · 출처·라이선스: [assets-license.md §3](../assets-license.md#3-사운드)

## 구조

```
src/lib/sound/            의존성 없는 자체 Web Audio 래퍼 (min 15.2KB · gzip 5.3KB, 매니페스트 1KB 별도)
  types.ts settings.ts    설정 모양·기본값·정규화·병합(updatedAt)·기기 저장
  platform.ts             코덱 검사, audioSession, 사용자 활성화 리스너
  webAudioEngine.ts       엔진 (효과음 버퍼·BGM 버퍼 루프·크로스페이드·가시성·iOS 복구)
  noopEngine.ts index.ts  서버·Provider 밖 no-op, 앱 싱글턴 getSoundEngine()
  manifest.ts             효과음 12종·BGM 3곡 파일 (버전 붙은 이름) + 쓰임 설명
  schema.ts server.ts     서버 쓰기 검증(zod strict)·읽기
  sync.ts                 서버 저장기 (PATCH /api/settings, 디바운스·순서 보장)
src/components/providers/SoundProvider.tsx   루트 레이아웃. 훅 useSfx · useBgm · useSoundSettings · useSoundSnapshot
src/components/providers/SoundSettingsSync.tsx  로그인 레이아웃. 서버 ↔ 기기 동기화
src/components/sound/     SoundToggle(HUD 음소거) · WorldBgm · useDialogueBlip
src/components/settings/SoundSettingsSection.tsx  설정 화면 "소리" 절
public/sounds/{sfx,bgm}/  <id>.v<N>.webm (Opus) + .m4a (AAC). /sounds/* 는 1년 immutable 캐시
scripts/build-sounds.sh   원본 → 정규화·인코딩
```

## 카테고리와 기본값

| 카테고리 | 기본 | 볼륨 | 비고 |
|---|---|---|---|
| 마스터 | — | 0.8 | 설정 화면에는 노출하지 않음 |
| 효과음 `sfx` | **켜짐** | 0.7 | 연출 단계와 무관 (minimal에서도 유지) |
| 배경음악 `bgm` | **꺼짐** | 0.4 | 연출 단계 minimal이면 꺼짐(`budget.bgm`). 켠 아이에게만 |
| 음성 `voice` | (준비 중) | 0.9 | 읽어주기 도입 때 `audioSession`을 잠시 `playback`으로 |
| 음소거 `muted` | 꺼짐 | — | HUD 토글 = 설정 화면 "소리 모두 끄기" |

저장: 기기(`localStorage` `pyroad.sound.v1`, 로그아웃 뒤에도 남김) + 로그인하면 `users.settings.sound`. 서버와 기기 중 `updatedAt`이 늦은 쪽을 쓴다. 서버 쓰기는 `PATCH /api/settings { sound }` → service_role RPC `patch_user_settings`(00020, `settings || patch` 한 문장)라서 움직임·사운드를 연달아 바꿔도 한쪽이 사라지지 않는다.

## 재생 규칙

- 첫 사용자 동작 전에는 아무 소리도 내지 않는다 (AudioContext도 만들지 않음). 랜딩 BGM 자동재생 없음.
- 효과음 중 `core`(tap·correct·wrong·coin·star·run)는 유휴 시간에 미리 디코드해 첫 탭부터 바로 난다.
- BGM은 화면이 `useBgm(id)`로 원한다고 선언하고, 설정·연출 단계·탭 가시성이 허용할 때만 실제로 재생한다. 다른 곡이면 800ms 크로스페이드, 같은 곡을 원하는 화면으로 옮기면(월드맵 → 퀘스트) 끊기지 않는다. 탭이 숨겨지면 멈추고 300ms 뒤 컨텍스트 suspend.
- 반복음 상한: 코인 6개, 탭·별 3개, 블립 2개, 전체 24개.
- **소리는 정보의 유일한 전달 수단이 아니다.** 효과음을 거는 곳마다 같은 내용이 글자·색·모양으로 보인다.

| 소리 | 거는 곳 | 같은 정보를 보여 주는 시각 피드백 |
|---|---|---|
| `run` | 실행 버튼 (`useQuestSession.handleRun`) | 실행 중 버튼 상태 |
| `correct` | 채점 통과 (코드·프로젝트 단계) | 결과 탭의 정답 표시, 파이뱀 칭찬 |
| `wrong` | 실행은 됐지만 답이 다름 | 결과 탭, 파이뱀 안내 |
| `bug` | 실행 에러 | 에러 출력, 파이뱀 안내 |
| `tap` | 힌트 요청, 월드맵 단계 누르기, HUD에서 소리 켜기, 설정 볼륨 놓기 | 힌트 메시지, 화면 이동, 아이콘 |
| `unlock` | 황금키 (프로젝트 중간 단계) · 황금키 확인 카드 | 시스템 메시지·카드 |
| `celebrate`·`levelup`·`star`·`coin` | 축하 시퀀서 (`src/lib/celebration/plan.ts` `STEP_SPECS`) | 축하 카드 |
| `blip` | 파이뱀 대사 스트리밍 (0.15초에 한 번 이하, 대사당 16번, 출력 지연 150ms 넘으면 끔) | 글자·깜빡이는 커서 |
| `chest` | (Phase 6 보물상자) | — |

## 파일 규칙

- 이름: `<id>.v<N>.webm` + `<id>.v<N>.m4a`. MP3 금지 (WebKit 앞뒤 패딩).
- 효과음: 모노 48kHz, 앞 무음 제거, 역할별 RMS(탭·블립 -24, 피드백 -19~-23, 징글 -18), 리미터 -1.5dBFS, Opus 64k / AAC 96k.
- BGM: 스테레오 48kHz, 60~75초 루프 목표, 이음매 256샘플 크로스페이드, -16 LUFS, true peak -1.5dBTP 근처, Opus 96k / AAC 128k. 디코드 후 메모리는 곡당 약 28MB(75초)라 지금 곡만 보관.
- 출처는 CC0(Kenney, OpenGameArt CC0)만. 출처 URL·작가·라이선스·받은 날짜·원본 sha256을 [assets-license.md §3](../assets-license.md#3-사운드)에 적는다(파일 열쇠 `<id>.v<N>`, `npm run assets:license`가 확인).

## 소리 바꾸는 방법

1. 원본을 정한다 (Kenney 팩이면 `scripts/build-sounds.sh`의 `sfx_one` 줄, BGM이면 원본 파일).
2. **버전을 올려** 만든다. 같은 이름의 파일을 다른 내용으로 덮어쓰려 하면 스크립트가 멈춘다 (immutable 캐시).
   ```bash
   bash scripts/build-sounds.sh sfx <Kenney 팩 상위 디렉토리>     # 줄의 버전 숫자를 2로
   bash scripts/build-sounds.sh bgm world2 2 <원본.ogg>           # [--trim START END]
   bash scripts/build-sounds.sh check                             # 길이·피크·RMS·LUFS 표
   ```
3. `src/lib/sound/manifest.ts`에서 그 소리 한 줄의 버전 숫자만 바꾼다 (`sfx('wrong', 2)`). `npx vitest run src/lib/sound`가 파일이 있는지 확인한다.
4. 쓰지 않게 된 옛 버전 파일은 지운다 (배포된 적이 있으면 한 릴리즈 뒤에).
5. [assets-license.md §3](../assets-license.md#3-사운드) 표(열쇠를 새 버전으로)와 청취 검수 보드(`design/prototypes/src/sound-review/data.ts`)를 고친다.

## 청취 검수 보드

```bash
bash scripts/build-sounds.sh bgm-preview w1a <원본> design/prototypes/.build/sound-review-bgm   # 후보마다 (Opus 48k)
cd design/prototypes && node src/sound-review/gen-audio.mjs && node build.mjs sound-review    # → dist/sound-review.html
```

앱과 같은 엔진으로 재생하고, 각 소리에 "좋아요 / 바꿔 주세요"(+메모)와 월드별 A/B를 고르면 요약 텍스트를 복사할 수 있다.

## 실기기 확인 (P3-19 · P12-04)

iPhone 무음 스위치(효과음·BGM 무음), 다른 앱 음악과 섞임, 화면 잠금·전화 뒤 다음 탭에서 복구, 카카오톡 인앱, iPadOS 15~17.3 AAC 폴백, 구형 기기 BGM 디코드 시간·메모리, 블루투스 이어폰에서 블립 꺼짐 — P0-15 §7 표.
