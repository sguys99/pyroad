import type { SoundManifest } from './sound/types';

/**
 * pyRoad 스타터 효과음 12종 (모두 Kenney CC0 팩에서 선정, 청취 검수는 P2-14에서).
 * 출처·원본 파일명은 sounds/sources.json, 라이선스 원문은 sounds/LICENSE-kenney.txt.
 * 앱에서는 public/sounds/sfx/<id>.{webm,m4a} 로 옮긴다 (P2-16).
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

// Opus(WebM) 우선, 구형 Safari(iOS 17.3 이하)는 AAC. MP3는 WebKit에서 앞뒤 패딩이 생겨 마지막 폴백으로만
const sfx = (id: SfxId) => [`/sounds/${id}.webm`, `/sounds/${id}.m4a`, `/sounds/${id}.mp3`] as const;
const bgm = (id: BgmId) => [`/generated/bgm-${id}.webm`, `/generated/bgm-${id}.m4a`] as const;

export const STARTER_MANIFEST: SoundManifest<SfxId, BgmId> = {
  sfx: {
    tap: { src: sfx('tap'), core: true, gain: 0.6, maxVoices: 3 },
    correct: { src: sfx('correct'), core: true },
    wrong: { src: sfx('wrong'), core: true, gain: 0.8 },
    coin: { src: sfx('coin'), core: true, maxVoices: 6 },
    star: { src: sfx('star'), core: true, maxVoices: 3 },
    levelup: { src: sfx('levelup') },
    unlock: { src: sfx('unlock') },
    chest: { src: sfx('chest') },
    run: { src: sfx('run'), core: true },
    bug: { src: sfx('bug') },
    blip: { src: sfx('blip'), gain: 0.35, maxVoices: 2 },
    celebrate: { src: sfx('celebrate') },
  },
  bgm: {
    // 데모에서는 스트림 경로도 시험하려고 1·2를 stream으로 둔다. 앱 기본은 buffer
    world1: { src: bgm('world1'), mode: 'stream' },
    world2: { src: bgm('world2'), mode: 'stream' },
    world3: { src: bgm('world3') },
  },
};

/** 별 1→3 상승음: 같은 소리를 장3화음 비율로 (도-미-솔) */
export const STAR_RATES = [1, 2 ** (4 / 12), 2 ** (7 / 12)] as const;
