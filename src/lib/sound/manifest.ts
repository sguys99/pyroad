import type { SoundManifest } from './types';

/**
 * pyRoad 효과음 12종 + 월드 BGM 3곡 (P0-15 → P2-14). 출처·라이선스: docs/assets-license.md §3, 규칙: docs/design/sound.md
 *
 * 파일은 `scripts/build-sounds.sh`가 만든 `public/sounds/{sfx,bgm}/<id>.v<N>.{webm,m4a}`이고 `/sounds/*`는 1년 immutable 캐시다.
 * **소리를 바꾸려면** 스크립트의 원본·버전을 바꿔 새 파일(v2 …)을 만들고 아래 한 줄의 버전 숫자만 바꾼다
 * (같은 이름의 파일을 다른 내용으로 덮어쓰지 않는다). 매니페스트가 가리키는 파일이 모두 있는지는 단위 테스트가 확인한다.
 *
 * 상태: **청취 검수 전 초안** (design/prototypes/src/sound-review → claude.ai 링크에서 사용자가 고름).
 */
export type SfxId =
  | 'tap'
  | 'correct'
  | 'wrong'
  | 'coin'
  | 'star'
  | 'levelup'
  | 'unlock'
  | 'chest'
  | 'run'
  | 'bug'
  | 'blip'
  | 'celebrate';

export type BgmId = 'world1' | 'world2' | 'world3';

// Opus(WebM) 우선, iOS 17.5 미만 Safari는 AAC. MP3는 쓰지 않는다 (WebKit 앞뒤 패딩, P0-15 §4.4)
const sfx = (id: SfxId, version: number) =>
  [
    `/sounds/sfx/${id}.v${version}.webm`,
    `/sounds/sfx/${id}.v${version}.m4a`,
  ] as const;
const bgm = (id: BgmId, version: number) =>
  [
    `/sounds/bgm/${id}.v${version}.webm`,
    `/sounds/bgm/${id}.v${version}.m4a`,
  ] as const;

export const SOUND_MANIFEST: SoundManifest<SfxId, BgmId> = {
  sfx: {
    tap: { src: sfx('tap', 1), core: true, gain: 0.6, maxVoices: 3 },
    correct: { src: sfx('correct', 1), core: true },
    wrong: { src: sfx('wrong', 1), core: true, gain: 0.8 },
    coin: { src: sfx('coin', 1), core: true, maxVoices: 6 },
    star: { src: sfx('star', 1), core: true, maxVoices: 3 },
    levelup: { src: sfx('levelup', 1) },
    // 잠금 해제 연출 한 번에 한 번 (건너뛰기·연달아 열림에도 겹치지 않게)
    unlock: { src: sfx('unlock', 1), maxVoices: 1 },
    chest: { src: sfx('chest', 1) },
    run: { src: sfx('run', 1), core: true },
    bug: { src: sfx('bug', 1) },
    blip: {
      src: sfx('blip', 1),
      gain: 0.35,
      maxVoices: 2,
      latencySensitive: true,
    },
    celebrate: { src: sfx('celebrate', 1) },
  },
  bgm: {
    world1: { src: bgm('world1', 1) },
    world2: { src: bgm('world2', 1) },
    world3: { src: bgm('world3', 1) },
  },
};

/** 잠긴 노드를 눌렀을 때: 경고음 대신 같은 탭을 작고 낮게 (P5-11). 안내는 쪽지 글자가 한다 */
export const SOFT_TAP = { gain: 0.45, rate: 0.84 } as const;

/** 별 1→3 상승음: 같은 소리를 장3화음 비율로 (도-미-솔, 2^(4/12)≈1.26 · 2^(7/12)≈1.5) */
export const STAR_RATES = [1, 1.26, 1.5] as const;

/** 언제 나는 소리인지 (문서·청취 검수 페이지·테스트용. 화면에서 소리가 유일한 정보 전달 수단이 되지 않게 함께 보여 줄 시각 피드백 포함) */
export const SFX_USES: Record<SfxId, { name: string; when: string }> = {
  tap: {
    name: '탭',
    when: '주요 버튼(힌트·소리 켜기)·지도 노드·차례 퀘스트를 누를 때 (잠긴 노드는 작고 낮게)',
  },
  correct: {
    name: '정답',
    when: '"통과!" 도장이 결과 쪽지에 닿을 때 (프로젝트 중간 단계는 통과 순간)',
  },
  wrong: {
    name: '오답',
    when: '실행은 됐지만 답이 다를 때 (작고 부드럽게, 파이뱀 안내와 함께)',
  },
  coin: {
    name: '코인',
    when: '코인 숫자가 올라가는 동안 짧게 여러 번 (최대 6번)',
  },
  star: { name: '별', when: '별·뱃지가 하나씩 톡 튈 때 (음이 1→3 올라감)' },
  levelup: { name: '레벨업', when: '레벨이 오를 때 (레벨업 카드)' },
  unlock: {
    name: '해제',
    when: '황금키를 쓸 때 · 지도에서 자물쇠가 깨지며 새 단계가 열릴 때',
  },
  chest: { name: '보물상자', when: '보물상자를 열 때 (Phase 6 이후)' },
  run: { name: '실행', when: '실행 버튼을 누를 때' },
  bug: {
    name: '버그버그',
    when: '코드에 에러가 났을 때 (장난스럽게, 버그버그 등장과 함께)',
  },
  blip: {
    name: '대사 블립',
    when: '대사창 글자가 나올 때 2~3글자마다 (작게, 넘기면 조용히)',
  },
  celebrate: { name: '축하', when: '스테이지·프로젝트를 깼을 때 (축하 카드)' },
};
