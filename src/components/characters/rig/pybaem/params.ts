/**
 * 파이뱀 파라미터 공간 (P0-07 `params.ts` 이식 + 기존 표정 10종).
 * 모든 표정·자세는 숫자 파라미터의 한 점이고, 상태 전환은 이 공간에서 스프링으로 이동한다.
 */
import type { PybaemExpression } from '../../expressions';
import type { Params, SpringGroup } from '../core/types';

/** 리그 상태: 핵심 7종 + 기존 표정을 옮긴 포즈 7종 */
export const PYBAEM_STATES = [
  'idle',
  'talk',
  'think',
  'happy',
  'sad',
  'cheer',
  'dance',
  'wave',
  'surprised',
  'teach',
  'encourage',
  'confused',
  'proud',
  'sleep',
] as const;
export type PybaemState = (typeof PYBAEM_STATES)[number];

export const PYBAEM_CORE_STATES: readonly PybaemState[] = [
  'idle',
  'talk',
  'think',
  'happy',
  'sad',
  'cheer',
  'dance',
];

export const PYBAEM_STATE_LABEL: Record<PybaemState, string> = {
  idle: '대기',
  talk: '말하기',
  think: '생각',
  happy: '기쁨',
  sad: '슬픔',
  cheer: '응원',
  dance: '춤',
  wave: '손 흔들기',
  surprised: '놀람',
  teach: '설명',
  encourage: '격려',
  confused: '갸우뚱',
  proud: '뿌듯',
  sleep: '잠',
};

/**
 * 기존 표정 10종(`expressions.ts`) → 리그 상태. `useCharacterExpression`의 키워드 규칙은 그대로 두고 결과만 넘긴다 (P0-07 §6.2)
 */
export const PYBAEM_EXPRESSION_STATE: Record<PybaemExpression, PybaemState> = {
  happy: 'idle',
  thinking: 'think',
  celebrating: 'happy',
  encouraging: 'encourage',
  surprised: 'surprised',
  teaching: 'teach',
  waving: 'wave',
  sleeping: 'sleep',
  confused: 'confused',
  proud: 'proud',
};

/** 스프링으로 움직이는 파라미터 */
export const PYBAEM_POSE_KEYS = [
  // 몸 전체 (피벗: 바닥 64,108)
  'rootX',
  'rootY',
  'rootRot',
  'sqXBase',
  'sqYBase',
  // 머리 (피벗: 목 64,66)
  'headX',
  'headY',
  'headRot',
  // 얼굴
  'lookX',
  'lookY',
  'eyeOpen',
  'eyeHappy',
  'eyeScale',
  'lidSad',
  'eyeWink',
  'eyeStar',
  'eyeAsym',
  'eyeSleep',
  'browOp',
  'browY',
  'browSad',
  'browRaiseR',
  'mouthOpen',
  'mouthSmile',
  'mouthWidth',
  'mouthRound',
  'mouthX',
  'mouthTilt',
  'blush',
  // 꼬리 (손 역할)
  'tailRaise',
  'tailChin',
  'tailDroop',
  'tailPoint',
  'tailRot',
  // 소품 (0..1, 통통 튀는 스프링)
  'spark',
  'think',
  'notes',
  'tear',
  'zzz',
  'qmark',
  // 레이어 세기 (엔벨로프)
  'breatheAmp',
  'lookWeight',
  'talkAmp',
  'thinkAmp',
  'hopHeight',
  'waveAmp',
  'danceAmp',
  'halo',
] as const;

export const PYBAEM_NEUTRAL: Params = {
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
  lidSad: 0,
  eyeWink: 0,
  eyeStar: 0,
  eyeAsym: 0,
  eyeSleep: 0,
  browOp: 0,
  browY: 0,
  browSad: 0,
  browRaiseR: 0,
  mouthOpen: 0,
  mouthSmile: 1,
  mouthWidth: 1,
  mouthRound: 0,
  mouthX: 0,
  mouthTilt: 0,
  blush: 0,
  tailRaise: 0,
  tailChin: 0,
  tailDroop: 0,
  tailPoint: 0,
  tailRot: 0,
  spark: 0,
  think: 0,
  notes: 0,
  tear: 0,
  zzz: 0,
  qmark: 0,
  breatheAmp: 1,
  lookWeight: 1,
  talkAmp: 0,
  thinkAmp: 0,
  hopHeight: 0,
  waveAmp: 0,
  danceAmp: 0,
  halo: 0,
  // 파생 값 (엔진·behavior가 매 프레임 계산)
  sqX: 1,
  sqY: 1,
  faceX: 0,
  faceY: 0,
  sparkPhase: 0.15,
  notesPhase: 0.3,
  dotsPhase: 0.25,
  tearPhase: 0.45,
  zzzPhase: 0,
  qmarkRot: 0,
  hatRot: 0,
  capeSwing: 0,
  boilSeed: 1,
};

/** 상태별 포즈 (중립과 합쳐서 목표값이 된다) */
export const PYBAEM_POSES: Record<PybaemState, Params> = {
  idle: {},
  talk: { mouthSmile: 0.55, browOp: 0.35, lookWeight: 0.8, talkAmp: 1 },
  think: {
    headRot: -9,
    headX: -1,
    lookX: 0.75,
    lookY: -1,
    mouthRound: 0.6,
    mouthSmile: 0,
    mouthWidth: 0.85,
    mouthX: 4,
    browOp: 1,
    browRaiseR: 1,
    tailChin: 1,
    think: 1,
    thinkAmp: 1,
    lookWeight: 0.12,
    breatheAmp: 0.6,
  },
  happy: {
    eyeHappy: 1,
    mouthSmile: 1,
    mouthOpen: 0.55,
    mouthWidth: 1.15,
    blush: 1,
    spark: 1,
    hopHeight: 16,
    lookWeight: 0.4,
    tailRaise: 0.35,
  },
  sad: {
    headRot: 7,
    headY: 3,
    lookX: -0.25,
    lookY: 0.85,
    lidSad: 1,
    eyeOpen: 0.9,
    browOp: 1,
    browSad: 1,
    mouthSmile: -0.85,
    mouthWidth: 0.8,
    tailDroop: 1,
    sqXBase: 1.035,
    sqYBase: 0.955,
    breatheAmp: 0.5,
    tear: 1,
    lookWeight: 0.25,
  },
  cheer: {
    eyeHappy: 1,
    mouthOpen: 0.95,
    mouthSmile: 1,
    mouthWidth: 1.2,
    mouthRound: 0.15,
    tailRaise: 1,
    waveAmp: 1,
    hopHeight: 10,
    spark: 1,
    blush: 0.8,
    browOp: 0.4,
    browY: -2,
    lookWeight: 0.35,
  },
  dance: {
    eyeHappy: 1,
    mouthSmile: 1,
    mouthOpen: 0.35,
    danceAmp: 1,
    notes: 1,
    tailRaise: 0.25,
    lookWeight: 0.3,
  },
  // ── 기존 표정 10종을 옮긴 포즈
  wave: {
    mouthSmile: 1,
    mouthOpen: 0.4,
    mouthWidth: 1.1,
    tailRaise: 1,
    waveAmp: 1,
    browOp: 0.3,
    blush: 0.45,
    lookWeight: 0.6,
  },
  surprised: {
    eyeScale: 1.28,
    mouthRound: 1,
    mouthOpen: 0.55,
    mouthSmile: 0,
    browOp: 1,
    browY: -3.5,
    headY: -1.5,
    sqXBase: 0.975,
    sqYBase: 1.03,
    tailRaise: 0.55,
    lookWeight: 0.5,
  },
  teach: {
    eyeWink: 1,
    mouthSmile: 1,
    mouthOpen: 0.15,
    browOp: 0.55,
    browY: -1,
    tailPoint: 1,
    headRot: -4,
    lookWeight: 0.6,
  },
  encourage: {
    eyeOpen: 0.88,
    eyeHappy: 0.3,
    mouthSmile: 0.85,
    mouthWidth: 1.05,
    browOp: 0.6,
    browSad: 0.35,
    headRot: -5,
    tailRaise: 0.45,
    blush: 0.35,
    lookWeight: 0.7,
  },
  confused: {
    eyeAsym: 1,
    mouthSmile: -0.2,
    mouthTilt: 0.8,
    mouthX: 2,
    mouthWidth: 0.85,
    browOp: 1,
    browRaiseR: 1,
    headRot: 8,
    qmark: 1,
    lookX: 0.35,
    lookY: -0.4,
    lookWeight: 0.3,
  },
  proud: {
    eyeStar: 1,
    mouthSmile: 1,
    mouthOpen: 0.45,
    mouthWidth: 1.12,
    spark: 1,
    blush: 0.7,
    headRot: -5,
    headY: -1.5,
    sqYBase: 1.02,
    tailRaise: 0.5,
    lookWeight: 0.3,
  },
  sleep: {
    eyeSleep: 1,
    mouthSmile: 0.35,
    mouthWidth: 0.7,
    zzz: 1,
    breatheAmp: 1.4,
    headRot: 6,
    headY: 2,
    tailDroop: 0.35,
    lookWeight: 0,
  },
};

/** 동작 줄이기·minimal일 때 움직임 대신 쓰는 후광 색 (P0-07 HALO_COLOR) */
export const PYBAEM_HALO: Record<PybaemState, string> = {
  idle: '#C8E6C9',
  talk: '#C8E6C9',
  think: '#E1BEE7',
  happy: '#FFE082',
  sad: '#B3E5FC',
  cheer: '#FFD180',
  dance: '#FFCCBC',
  wave: '#FFE082',
  surprised: '#FFF59D',
  teach: '#C5CAE9',
  encourage: '#DCEDC8',
  confused: '#E1BEE7',
  proud: '#FFE082',
  sleep: '#C5CAE9',
};

const PROPS = new Set(['spark', 'think', 'notes', 'tear', 'zzz', 'qmark']);
const ENVELOPES = new Set([
  'breatheAmp',
  'lookWeight',
  'talkAmp',
  'thinkAmp',
  'waveAmp',
  'danceAmp',
  'halo',
  'hopHeight',
]);

export function pybaemSpringOf(key: string): SpringGroup {
  if (PROPS.has(key)) return 'prop';
  if (ENVELOPES.has(key)) return 'envelope';
  if (/^(root|head|tail|sq)/.test(key)) return 'body';
  return 'face';
}

/** 연속 레이어 세기 (live가 아니면 0) */
export const PYBAEM_LOOP_KEYS = [
  'breatheAmp',
  'talkAmp',
  'thinkAmp',
  'waveAmp',
  'danceAmp',
  'hopHeight',
];

/** 동작 줄이기: 위치·크기·회전 고정 */
export const PYBAEM_PINNED_KEYS = [
  'rootX',
  'rootY',
  'rootRot',
  'sqXBase',
  'sqYBase',
  'headX',
  'headY',
  'headRot',
];

/** 정적 포즈 (SSR 첫 렌더·공유 카드·아바타·동작 줄이기 첫 프레임 공용) */
export function pybaemStaticParams(state: PybaemState): Params {
  const p = { ...PYBAEM_NEUTRAL, ...PYBAEM_POSES[state] };
  return {
    ...p,
    sqX: p.sqXBase,
    sqY: p.sqYBase,
    faceX: p.lookX * 1.6,
    faceY: p.lookY * 1.1,
    halo: 0,
  };
}
