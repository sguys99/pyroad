/** 별똥이 파라미터 공간 (보상 안내 요정, P0-07 §6.2). 별 몸의 양옆 끝이 팔, 아래 두 끝이 다리 역할 */
import type { ByeolttongiExpression } from '../../expressions';
import type { Params, SpringGroup } from '../core/types';

export const BYEOLTTONGI_STATES = [
  'idle',
  'flyIn',
  'land',
  'sparkle',
  'give',
] as const;
export type ByeolttongiState = (typeof BYEOLTTONGI_STATES)[number];

export const BYEOLTTONGI_STATE_LABEL: Record<ByeolttongiState, string> = {
  idle: '떠 있기',
  flyIn: '날아오기',
  land: '착지',
  sparkle: '반짝',
  give: '보상 건네기',
};

export const BYEOLTTONGI_EXPRESSION_STATE: Record<
  ByeolttongiExpression,
  ByeolttongiState
> = {
  flying: 'flyIn',
  landing: 'land',
  sparkling: 'sparkle',
};

export const BYEOLTTONGI_POSE_KEYS = [
  'rootX',
  'rootY',
  'rootRot',
  'sqXBase',
  'sqYBase',
  'lookX',
  'lookY',
  'eyeOpen',
  'eyeHappy',
  'eyeScale',
  'browOp',
  'browY',
  'browSad',
  'mouthOpen',
  'mouthSmile',
  'mouthWidth',
  'mouthRound',
  'mouthX',
  'mouthTilt',
  'blush',
  // 별 끝 (팔·다리)
  'armL',
  'armR',
  'reach',
  'legSpread',
  // 소품
  'trail',
  'twinkle',
  'dust',
  'coin',
  // 레이어 세기
  'floatAmp',
  'lookWeight',
  'spinAmp',
  'halo',
] as const;

export const BYEOLTTONGI_NEUTRAL: Params = {
  rootX: 0,
  rootY: 0,
  rootRot: 0,
  sqXBase: 1,
  sqYBase: 1,
  lookX: 0,
  lookY: 0,
  eyeOpen: 1,
  eyeHappy: 0,
  eyeScale: 1,
  browOp: 0,
  browY: 0,
  browSad: 0,
  mouthOpen: 0.1,
  mouthSmile: 0.9,
  mouthWidth: 1,
  mouthRound: 0,
  mouthX: 0,
  mouthTilt: 0,
  blush: 0,
  armL: 0.15,
  armR: 0.15,
  reach: 0,
  legSpread: 0,
  trail: 0,
  twinkle: 0,
  dust: 0,
  coin: 0,
  floatAmp: 1,
  lookWeight: 1,
  spinAmp: 0,
  halo: 0,
  // 파생 값
  sqX: 1,
  sqY: 1,
  faceX: 0,
  faceY: 0,
  flyX: 0,
  flyY: 0,
  stretch: 0,
  stretchDir: 0,
  tx1: 0,
  ty1: 0,
  tx2: 0,
  ty2: 0,
  armWiggle: 0,
  coinX: 64,
  coinY: 2,
  coinS: 1,
  coinFlip: 1,
  coinOp: 1,
  twPhase: 0.2,
  dustPhase: 0.35,
  boilSeed: 1,
};

export const BYEOLTTONGI_POSES: Record<ByeolttongiState, Params> = {
  idle: {},
  flyIn: {
    trail: 1,
    eyeScale: 0.92,
    eyeOpen: 0.82,
    mouthSmile: 0.55,
    mouthWidth: 0.8,
    browOp: 0.6,
    browY: -1,
    armL: -0.45,
    armR: -0.45,
    floatAmp: 0,
    lookX: 0.55,
    lookY: 0.35,
    lookWeight: 0.2,
  },
  land: {
    eyeHappy: 1,
    mouthOpen: 0.5,
    mouthSmile: 1,
    mouthWidth: 1.1,
    armL: 0.85,
    armR: 0.85,
    legSpread: 0.7,
    dust: 1,
    floatAmp: 0,
  },
  sparkle: {
    eyeHappy: 1,
    mouthSmile: 1,
    mouthOpen: 0.55,
    mouthWidth: 1.12,
    blush: 0.8,
    twinkle: 1,
    armL: 1,
    armR: 1,
    floatAmp: 0.6,
    spinAmp: 1,
    lookWeight: 0.4,
  },
  give: {
    reach: 1,
    coin: 1,
    eyeScale: 1.1,
    mouthSmile: 1,
    mouthOpen: 0.45,
    blush: 0.6,
    floatAmp: 0.4,
    lookY: -0.6,
    lookWeight: 0.4,
  },
};

export const BYEOLTTONGI_HALO: Record<ByeolttongiState, string> = {
  idle: '#FFF59D',
  flyIn: '#FFE082',
  land: '#FFE082',
  sparkle: '#FFD180',
  give: '#C8E6C9',
};

/** 일회성: 날아오기 → 착지 → 떠 있기, 보상 건네기 → 떠 있기 */
export const BYEOLTTONGI_AUTO_NEXT = {
  flyIn: { after: 0.95, to: 'land' as const },
  land: { after: 0.9, to: 'idle' as const },
  give: { after: 1.8, to: 'idle' as const },
};

const PROPS = new Set(['trail', 'twinkle', 'dust', 'coin']);
const ENVELOPES = new Set(['floatAmp', 'lookWeight', 'spinAmp', 'halo']);

export function byeolttongiSpringOf(key: string): SpringGroup {
  if (PROPS.has(key)) return 'prop';
  if (ENVELOPES.has(key)) return 'envelope';
  if (/^(root|sq|arm|reach|leg)/.test(key)) return 'body';
  return 'face';
}

export const BYEOLTTONGI_LOOP_KEYS = ['floatAmp', 'spinAmp'];

export const BYEOLTTONGI_PINNED_KEYS = [
  'rootX',
  'rootY',
  'rootRot',
  'sqXBase',
  'sqYBase',
];

export function byeolttongiStaticParams(state: ByeolttongiState): Params {
  const p = { ...BYEOLTTONGI_NEUTRAL, ...BYEOLTTONGI_POSES[state] };
  return {
    ...p,
    sqX: p.sqXBase,
    sqY: p.sqYBase,
    faceX: p.lookX * 1.6,
    faceY: p.lookY * 1.1,
    // 정지 그림: 날아오기는 왼쪽 아래로 꼬리 빛 (예전 FlyingTrail 자리)
    tx1: -24 * p.trail,
    ty1: 30 * p.trail,
    tx2: -50 * p.trail,
    ty2: 56 * p.trail,
    halo: 0,
  };
}
