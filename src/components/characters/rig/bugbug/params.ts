/**
 * 버그버그 파라미터 공간 (에러·보스 담당 "장난꾸러기 라이벌 겸 친구", P0-07 §6.2).
 * 무섭지 않게: 큰 눈·하이라이트·볼터치를 늘 유지하고, 공격도 씩 웃는 얼굴로. 피격에 빨간 깜빡임 없음.
 */
import type { BugBugExpression } from '../../expressions';
import type { Params, SpringGroup } from '../core/types';

export const BUGBUG_STATES = [
  'idle',
  'appear',
  'search',
  'found',
  'attack',
  'hit',
  'defeat',
  'makeup',
] as const;
export type BugBugState = (typeof BUGBUG_STATES)[number];

export const BUGBUG_STATE_LABEL: Record<BugBugState, string> = {
  idle: '대기',
  appear: '등장',
  search: '탐색',
  found: '발견',
  attack: '공격',
  hit: '피격',
  defeat: '패배',
  makeup: '화해',
};

/** 기존 표정 3종 → 리그 상태 */
export const BUGBUG_EXPRESSION_STATE: Record<BugBugExpression, BugBugState> = {
  searching: 'search',
  found: 'found',
  fixed: 'makeup',
};

export const BUGBUG_POSE_KEYS = [
  // 몸 (회전 피벗: 몸 가운데 64,78 · 찌그러짐 피벗: 발밑 64,108)
  'rootX',
  'rootY',
  'rootRot',
  'sqXBase',
  'sqYBase',
  // 머리 (피벗: 목 64,62)
  'headX',
  'headY',
  'headRot',
  // 얼굴 (파이뱀과 같은 규칙)
  'lookX',
  'lookY',
  'eyeOpen',
  'eyeHappy',
  'eyeScale',
  'eyeSleep',
  'eyeSquint',
  'eyeWinkL',
  'browOp',
  'browY',
  'browSad',
  'browAngry',
  'browRaiseR',
  'mouthOpen',
  'mouthSmile',
  'mouthWidth',
  'mouthRound',
  'mouthX',
  'mouthTilt',
  'fang',
  'blush',
  // 등딱지·더듬이·다리
  'shellOpen',
  'antPerk',
  'antDroop',
  'legAmp',
  'legFlail',
  'legWave',
  // 소품
  'magnify',
  'exclaim',
  'dizzy',
  'badge',
  // 레이어 세기
  'breatheAmp',
  'lookWeight',
  'scanAmp',
  'attackAmp',
  'bobAmp',
  'halo',
] as const;

export const BUGBUG_NEUTRAL: Params = {
  rootX: 0,
  rootY: 0,
  rootRot: 0,
  sqXBase: 1,
  sqYBase: 1,
  headX: 0,
  headY: 0,
  headRot: 0,
  lookX: 0,
  lookY: 0,
  eyeOpen: 1,
  eyeHappy: 0,
  eyeScale: 1,
  eyeSleep: 0,
  eyeSquint: 0,
  eyeWinkL: 0,
  browOp: 0,
  browY: 0,
  browSad: 0,
  browAngry: 0,
  browRaiseR: 0,
  mouthOpen: 0.15,
  mouthSmile: 0.75,
  mouthWidth: 1,
  mouthRound: 0,
  mouthX: 0,
  mouthTilt: 0,
  fang: 0,
  blush: 0,
  shellOpen: 0,
  antPerk: 0,
  antDroop: 0,
  legAmp: 0,
  legFlail: 0,
  legWave: 0,
  magnify: 0,
  exclaim: 0,
  dizzy: 0,
  badge: 0,
  breatheAmp: 1,
  lookWeight: 1,
  scanAmp: 0,
  attackAmp: 0,
  bobAmp: 0,
  halo: 0,
  // 파생 값
  sqX: 1,
  sqY: 1,
  faceX: 0,
  faceY: 0,
  legPhase: 0,
  antL: 0,
  antR: 0,
  waveRot: 0,
  magRot: 0,
  exRot: 0,
  dizzyPhase: 0.1,
  puffPhase: 1,
  boilSeed: 1,
};

export const BUGBUG_POSES: Record<BugBugState, Params> = {
  idle: {},
  appear: { eyeHappy: 0.35, mouthOpen: 0.35, mouthWidth: 1.1, legAmp: 1 },
  search: {
    eyeWinkL: 1,
    eyeScale: 1.08,
    mouthRound: 0.55,
    mouthSmile: 0.2,
    mouthOpen: 0.2,
    mouthX: 1.5,
    browOp: 0.9,
    browRaiseR: 1,
    magnify: 1,
    scanAmp: 1,
    legAmp: 0.45,
    lookWeight: 0.25,
  },
  found: {
    eyeScale: 1.3,
    mouthRound: 1,
    mouthOpen: 0.65,
    mouthSmile: 0,
    browOp: 1,
    browY: -3,
    exclaim: 1,
    antPerk: 1,
    sqXBase: 0.97,
    sqYBase: 1.04,
    lookWeight: 0.5,
  },
  attack: {
    browOp: 1,
    browAngry: 1,
    mouthSmile: 1,
    mouthOpen: 0.4,
    mouthWidth: 1.18,
    fang: 1,
    eyeScale: 0.96,
    antPerk: 0.6,
    attackAmp: 1,
    lookWeight: 0.1,
  },
  hit: {
    eyeSquint: 1,
    mouthRound: 0.35,
    mouthOpen: 0.45,
    mouthSmile: -0.3,
    mouthTilt: 0.5,
    browOp: 1,
    browSad: 0.6,
    dizzy: 1,
    antDroop: 0.55,
    blush: 0.4,
    headRot: 6,
    lookWeight: 0,
  },
  defeat: {
    rootRot: 172,
    rootY: -14,
    eyeSleep: 1,
    mouthSmile: -0.4,
    mouthOpen: 0.35,
    mouthTilt: 0.45,
    browOp: 0.8,
    browSad: 1,
    legFlail: 1,
    dizzy: 1,
    antDroop: 1,
    shellOpen: 0.2,
    lookWeight: 0,
  },
  makeup: {
    eyeHappy: 1,
    mouthSmile: 1,
    mouthOpen: 0.5,
    mouthWidth: 1.12,
    blush: 0.9,
    badge: 1,
    legWave: 1,
    bobAmp: 1,
    antPerk: 0.35,
    lookWeight: 0.5,
  },
};

export const BUGBUG_HALO: Record<BugBugState, string> = {
  idle: '#FFE0B2',
  appear: '#FFE0B2',
  search: '#E1BEE7',
  found: '#FFF59D',
  attack: '#FFCCBC',
  hit: '#B3E5FC',
  defeat: '#CFD8DC',
  makeup: '#C8E6C9',
};

/** 일회성: 등장이 끝나면 대기 */
export const BUGBUG_AUTO_NEXT = {
  appear: { after: 1.25, to: 'idle' as const },
};

const PROPS = new Set(['magnify', 'exclaim', 'dizzy', 'badge']);
// attackAmp는 몸 스프링(0.74초): 첫 공격부터 힘 있게
const ENVELOPES = new Set([
  'breatheAmp',
  'lookWeight',
  'scanAmp',
  'bobAmp',
  'halo',
  'legAmp',
  'legFlail',
]);

export function bugbugSpringOf(key: string): SpringGroup {
  if (PROPS.has(key)) return 'prop';
  if (ENVELOPES.has(key)) return 'envelope';
  if (/^(root|head|sq|shell|ant|leg|attack)/.test(key)) return 'body';
  return 'face';
}

export const BUGBUG_LOOP_KEYS = [
  'breatheAmp',
  'scanAmp',
  'attackAmp',
  'bobAmp',
  'legAmp',
  'legFlail',
];

export const BUGBUG_PINNED_KEYS = [
  'rootX',
  'rootY',
  'rootRot',
  'sqXBase',
  'sqYBase',
  'headX',
  'headY',
  'headRot',
];

export function bugbugStaticParams(state: BugBugState): Params {
  const p = { ...BUGBUG_NEUTRAL, ...BUGBUG_POSES[state] };
  return {
    ...p,
    sqX: p.sqXBase,
    sqY: p.sqYBase,
    faceX: p.lookX * 1.6,
    faceY: p.lookY * 1.1,
    // 정지 그림의 다리·더듬이 모양
    legPhase: 0.15,
    waveRot: -62 * p.legWave,
    antL: 16 * p.antPerk - 30 * p.antDroop,
    antR: -16 * p.antPerk + 30 * p.antDroop,
    halo: 0,
  };
}
