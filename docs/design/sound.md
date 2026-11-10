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
- 디코드한 BGM 버퍼는 지금 원하는 곡만 남긴다: 다른 곡으로 바뀌거나 BGM을 원하는 화면이 없어지면 이전 곡은 페이드가 끝난 뒤 버리고, 다시 오면 새로 받는다(곡당 약 28MB).
- 반복음 상한: 코인 6개, 탭·별 3개, 블립 2개, 해제 1개, 그 밖 4개, 전체 24개.
- 확인용 이벤트: 효과음을 요청할 때마다 window에 `pyroad:sfx` (`{ id, rate }`, `useSfx`·축하 시퀀서 공통, P6-14). 설정으로 꺼져 있어도 나가는 요청 기록이라 e2e가 박자·중복을 잰다 (`quest-flow.spec.ts`).

### 월드 BGM (P5-11)

| 화면 | 곡 | 비고 |
|---|---|---|
| 월드 지도 `/world`·`/world/[slug]` | 그 월드 `map.yaml` `bgm` (`WorldBgm`) | 월드를 바꾸면 800ms 크로스페이드 |
| 퀘스트 헤더 | 퀘스트가 속한 월드의 `bgm` (서버가 `quest.stage.world.bgm`에 붙임, e2e 테스트 월드 포함) | 지도 ↔ 퀘스트, 퀘스트 ↔ 퀘스트는 같은 곡이라 이어서 |
| 책장 `/worlds` | 지금 흐르는 곡 그대로 (`KeepWorldBgm`), 없으면 진행 중 월드 곡 | 지도 ↔ 책장을 오가도 곡이 바뀌지 않음 |
| 그 밖 (설정·프로필 등) | 없음 → 페이드아웃 | |

확인용 훅: `<html data-bgm="원하는 곡" data-bgm-playing="실제로 나는 곡">` (SoundProvider, e2e `world-select.spec.ts`).

**미리 받기** (`PrefetchBgm` → 엔진 `prefetchBgm(ids)`, P5-11 추가): 첫 재생의 받기+디코드 1~2초 무음을 줄이려고 지도는 그 월드 곡, 책장은 진행 중 월드 곡 + 그 뒤 열린 월드 곡을 유휴 시간(`requestIdleCallback`, 없으면 setTimeout)에 **파일만** 받아 HTTP 캐시(immutable)에 둔다. 디코드하지 않으므로 "디코드 버퍼는 지금 곡만" 규칙과 메모리는 그대로이고, 첫 재생은 캐시에서 받아 디코드만 한다. BGM 설정이 꺼져 있거나(기본)·연출 단계가 BGM을 막았거나·데이터 절약(`saveData`)·2G급 느린 연결이면 받지 않고, 곡마다 한 번만(이미 디코드 중·재생 중인 곡도 건너뜀). 랜딩·퀘스트 화면은 미리 받지 않음.

### 음량 표

실효 gain = 마스터(0.8) × 카테고리(효과음 0.7 · BGM 0.4) × 파일 보정 × 이번 재생 보정. 파일은 역할별 RMS로 정규화돼 있어 보정은 미세 조정만.

| 소리 | 파일 보정 `gain` | 동시 상한 | 비고 |
|---|---|---|---|
| `tap` | 0.6 | 3 | 잠긴 지도 노드는 `SOFT_TAP`(× 0.45, 속도 0.84 → 낮고 작게) |
| `wrong` | 0.8 | 4 | 작고 부드럽게 |
| `coin` | 1 | 6 | |
| `star` | 1 | 3 | 속도 `STAR_RATES` |
| `blip` | 0.35 | 2 | 지연 150ms 넘으면 끔, 속도 0.94~1.08 무작위 |
| `unlock` | 1 | 1 | 연출 한 번에 한 번 |
| 나머지 | 1 | 4 | |
| BGM 3곡 | 1 | 슬롯 2 (크로스페이드) | -16 LUFS 정규화 |
- **소리는 정보의 유일한 전달 수단이 아니다.** 효과음을 거는 곳마다 같은 내용이 글자·색·모양으로 보인다.

| 소리 | 거는 곳 | 같은 정보를 보여 주는 시각 피드백 |
|---|---|---|
| `run` | 실행 버튼 (`useQuestSession.handleRun`, 누르는 순간) | 실행 중 버튼 상태 |
| `correct` | 퀘스트를 마친 통과: 결과 쪽지 "통과!" 도장이 닿는 순간(`PassStamp` `onImpact`, 건너뛰면 그때, 동작 줄이기는 바로). 프로젝트 중간 단계는 채점 통과 순간(세션) | 도장·초록 쪽지, 파이뱀 칭찬 |
| `wrong` | 실행은 됐지만 답이 다름 | 결과 탭, 파이뱀 안내 |
| `bug` | 실행 에러: 결과 쪽지에 버그버그가 들어오는 순간(`BugbugAside` 마운트, 실행마다 한 번). 시간 초과·멈춤은 버그버그가 없어 소리도 없음 | 오류 쪽지·"N번째 줄", 버그버그 한마디, 파이뱀 안내 |
| `tap` | 힌트 요청, 월드맵 노드 누르기(시트 열기)·시트 차례 퀘스트·시트 시작 버튼, 잠긴 노드(`SOFT_TAP`, 경고음 없음), HUD에서 소리 켜기, 설정 볼륨 놓기, **게임 버튼 primary·reward 기본**(P2-11 `Button` `sfx`, 다른 소리를 내는 실행·힌트·축하 CTA는 끔) | 힌트 메시지, 시트·화면 이동, 잠긴 노드 쪽지 글자, 아이콘, 버튼 눌림 모양 |
| `unlock` | 황금키 (프로젝트 중간 단계) · 황금키 확인 카드 · 지도 잠금 해제 연출(P5-05/P5-11: full·lite는 자물쇠가 깨지는 순간, 그 전에 건너뛰면 건너뛸 때, minimal·동작 줄이기는 끝 상태로 바뀔 때 — 연출 단계와 무관하게 소리 설정만 따름, 한 번만) | 시스템 메시지·카드, 지도의 열린 노드·"열렸어요" 토스트 |
| `celebrate`·`levelup`·`star`·`coin` | 축하 시퀀서 (`src/lib/celebration/plan.ts` `STEP_SPECS`·`sfxSchedule`) + 결과 쪽지 보상 띠(`RewardStrip`, 별·코인은 `SHOW_STARS`·`SHOW_COINS` 켤 때만) | 축하 카드, 보상 띠 숫자·별 |
| `blip` | 대사창 `DialogueBox` 글자가 나올 때만 (AI 대화 스트리밍은 블립 없음) | 글자·깜빡이는 커서 |
| `chest` | (Phase 6 보물상자) | — |

### 퀘스트 화면 박자 (P6-14)

소리는 그 순간을 보여 주는 그림과 같은 시각에 난다. 화면을 떠나면(다음 퀘스트로) 예약해 둔 소리는 모두 취소한다(각 컴포넌트 언마운트 정리·세션 `aliveRef`, 도장은 언마운트로 끝낼 때 울리지 않음).

| 일 | 소리 | 때 | 볼륨·속도 | 같은 정보를 보여 주는 것 |
|---|---|---|---|---|
| 실행 | `run` | 버튼을 누르는 순간 | 기본 | 버튼 "돌아가는 중" |
| 정답(퀘스트 통과) | `correct` | "통과!" 도장이 닿는 순간 (full 약 0.4초 뒤) | 기본 | 도장·초록 쪽지 |
| 정답(프로젝트 중간 단계) | `correct` | 채점 통과 | 기본 | 초록 쪽지, 단계 진행 |
| 다른 출력 | `wrong` | 채점 직후 | × 0.8 | 견줘 보기 쪽지 |
| 에러 | `bug` | 버그버그 등장 (경고음 대신 장난스럽게) | 기본 | 오류 쪽지·버그버그 |
| 별 1→3 | `star` | 별이 하나씩 튈 때 (보상 띠 0.45초 + 0.15초 간격, 카드 0 + 0.15초) | 속도 1 → 1.26 → 1.5, 움직임 없으면 한꺼번에(화음) | 별 아이콘 |
| 코인 카운트업 | `coin` | 숫자가 오르는 동안 고르게, 80ms보다 촘촘하지 않게 최대 6번 (엔진 동시 상한 6) · 움직임 없으면 한 번 | 기본 | 숫자 |
| 대사 | `blip` | 대사창 글자 2~3글자마다 (첫 글자 포함, 간격 60ms 이상, 대사당 16번). 넘기기·minimal·동작 줄이기(글자가 한 번에 다 보임)·안 보이는 쪽(모바일 다른 탭)은 조용히 | × 0.35, 속도 0.94~1.08 | 글자·커서 |
| 레벨 업·축하 | `levelup`·`celebrate` | 축하 카드가 뜬 뒤 150ms (시퀀서) | 기본 | 축하 카드 |

보상 띠를 건너뛰면(아무 데나 누르기) 남은 별·코인 소리는 끊는다. XP 카운트업은 소리 없음(코인만). 지금 화면은 Q52로 별·코인이 숨겨져 XP만 보이므로 `star`·`coin`은 카탈로그(`#sound`, `#success-staging`)에서 확인한다.

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
