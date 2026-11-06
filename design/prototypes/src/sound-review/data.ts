// 청취 검수 목록 (P2-14). 출처 표 원본: docs/design/sound-sources.md
// 쓰임 설명은 앱 매니페스트(src/lib/sound/manifest.ts SFX_USES)를 그대로 쓴다

export interface SfxItem {
  key: string; // AUDIO 키 (sfx:<id>)
  id: string;
  source: string;
  note?: string;
  /** 같은 쓰임의 비교용 이전 초안 */
  compare?: { key: string; label: string; source: string };
  rate?: number[];
}

export interface BgmItem {
  key: string; // bgm:<w1a…>
  world: 1 | 2 | 3;
  pick: 'A' | 'B';
  title: string;
  author: string;
  url: string;
  mood: string;
  note: string;
}

const KENNEY = 'Kenney (CC0)';

export const SFX_ITEMS: SfxItem[] = [
  { key: 'sfx:tap', id: 'tap', source: `${KENNEY} Interface Sounds · click_001` },
  { key: 'sfx:correct', id: 'correct', source: `${KENNEY} Interface Sounds · confirmation_002` },
  {
    key: 'sfx:wrong',
    id: 'wrong',
    source: `${KENNEY} Interface Sounds · question_002`,
    note: 'P2-14에서 바꿈: 위에서 아래로 내려가는 부드러운 두 음 (중음역, RMS -23dB로 작게). 이전 초안은 120~160Hz의 낮은 "부-" 소리라 노트북·태블릿 스피커에서 잘 안 들리고 실패 부저처럼 들릴 수 있었어요.',
    compare: { key: 'sfx:wrong-p015', label: '이전 초안 (P0-15)', source: `${KENNEY} Interface Sounds · error_006` },
  },
  { key: 'sfx:coin', id: 'coin', source: `${KENNEY} RPG Audio · handleCoins2` },
  {
    key: 'sfx:star',
    id: 'star',
    source: `${KENNEY} Interface Sounds · glass_001`,
    note: '뱃지가 여러 개면 음이 도-미-솔로 올라가요.',
    rate: [1, 1.26, 1.5],
  },
  { key: 'sfx:levelup', id: 'levelup', source: `${KENNEY} Music Jingles · jingles_NES00` },
  { key: 'sfx:unlock', id: 'unlock', source: `${KENNEY} RPG Audio metalLatch + Interface Sounds maximize_004` },
  { key: 'sfx:chest', id: 'chest', source: `${KENNEY} RPG Audio creak1 + handleCoins` },
  { key: 'sfx:run', id: 'run', source: `${KENNEY} Digital Audio · phaseJump1` },
  {
    key: 'sfx:bug',
    id: 'bug',
    source: `${KENNEY} Digital Audio · phaserDown1`,
    note: 'P2-14에서 바꿈: 만화 같은 "삐융" 내려가는 소리 (장난스럽게). 이전 초안은 아주 낮은 웅웅 소리(스펙트럼 중심 120Hz)라 작은 스피커에서 거의 안 들렸어요.',
    compare: { key: 'sfx:bug-p015', label: '이전 초안 (P0-15)', source: `${KENNEY} Digital Audio · lowRandom` },
  },
  {
    key: 'sfx:blip',
    id: 'blip',
    source: `${KENNEY} Interface Sounds · tick_004`,
    note: '앱에서는 0.15초에 한 번 이하, 대사 하나에 16번까지만, 음높이를 조금씩 흔들어서 나요. 아래 "연속 재생"으로 실제 느낌을 들어 보세요.',
  },
  { key: 'sfx:celebrate', id: 'celebrate', source: `${KENNEY} Music Jingles · jingles_STEEL07` },
];

const OGA = 'https://opengameart.org/content/';

export const BGM_ITEMS: BgmItem[] = [
  {
    key: 'bgm:w1a',
    world: 1,
    pick: 'A',
    title: 'Keep your dream alive!',
    author: 'congusbongus',
    url: `${OGA}keep-your-dream-alive-seamless-loop`,
    mood: '밝은 칩튠, 경쾌한 모험 시작',
    note: '73.4초 루프 (목표 60~75초 안). 작가가 "seamless loop"로 올린 곡.',
  },
  {
    key: 'bgm:w1b',
    world: 1,
    pick: 'B',
    title: 'Flowerbed Fields',
    author: 'Zane Little Music',
    url: `${OGA}flowerbed-fields-loop`,
    mood: '귀여운 칩튠 ("모험을 시작하는 곡")',
    note: '105.9초 루프로 목표보다 길어요 (디코드 후 메모리 약 41MB). 고르면 앞 절반(53초)만 쓰는 방법도 검토할게요.',
  },
  {
    key: 'bgm:w2a',
    world: 2,
    pick: 'A',
    title: 'Aurora',
    author: 'Trex0n',
    url: `${OGA}aurora-0`,
    mood: '물속·하늘 같은 잔잔하고 시원한 루프',
    note: '80.0초 루프 (목표보다 5초 김). 작가 설명: "water level에 어울릴 짧은 루프".',
  },
  {
    key: 'bgm:w2b',
    world: 2,
    pick: 'B',
    title: 'Gumdrop Plains (2024)',
    author: 'Bobjt',
    url: `${OGA}gumdrop-plains`,
    mood: '하늘을 나는 듯한 신나는 신스',
    note: '87.0초. 작가 설명: "flying game에 어울림". 음이 빽빽해서 대사와 겹치면 조금 바쁠 수 있어요.',
  },
  {
    key: 'bgm:w3a',
    world: 3,
    pick: 'A',
    title: 'A Respectable Amount of Bounce',
    author: 'Some Weirdo',
    url: `${OGA}a-respectable-amount-of-bounce`,
    mood: '통통 튀는 리듬 ("가장 신나는 곡")',
    note: '76.8초 루프 (38.4초 구간이 두 번 변주).',
  },
  {
    key: 'bgm:w3b',
    world: 3,
    pick: 'B',
    title: 'Wacky Workings',
    author: 'Fupi',
    url: `${OGA}wacky-workings`,
    mood: '엉뚱한 펑키 베이스 (공방·기계 느낌)',
    note: '39.6초 루프로 짧아요 (자주 반복). 메모리는 가장 적어요.',
  },
];

export const WORLD_NAMES: Record<1 | 2 | 3, string> = {
  1: '1월드 · 숲과 섬 (밝고 경쾌하게)',
  2: '2월드 · 바다와 하늘 (시원한 모험)',
  3: '3월드 · 공방과 메이커 (통통 튀는 리듬)',
};
