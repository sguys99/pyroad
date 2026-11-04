// 파이뱀 SVG 리그: 파라미터 공간 정의
// 모든 표정·자세는 "숫자 파라미터의 한 점"이고, 상태 전환은 이 공간에서 스프링으로 이동한다.
// 그래서 어느 순간에 끊어도(인터럽트) 값이 연속이라 튀지 않는다.

export const RIG_STATES = ['idle', 'talk', 'think', 'happy', 'sad', 'cheer', 'dance'] as const;
export type RigState = (typeof RIG_STATES)[number];

export const STATE_LABEL: Record<RigState, string> = {
  idle: '대기',
  talk: '말하기',
  think: '생각',
  happy: '기쁨',
  sad: '슬픔',
  cheer: '응원',
  dance: '춤',
};

/** 스프링으로 움직이는 파라미터 (상태 포즈의 목표값) */
export const POSE_KEYS = [
  // 몸 전체 (피벗: 바닥 64,108)
  'rootX', 'rootY', 'rootRot', 'sqXBase', 'sqYBase',
  // 머리 (피벗: 목 64,66)
  'headX', 'headY', 'headRot',
  // 얼굴
  'lookX', 'lookY', 'eyeOpen', 'eyeHappy', 'eyeScale', 'lidSad',
  'browOp', 'browY', 'browSad', 'browRaiseR',
  'mouthOpen', 'mouthSmile', 'mouthWidth', 'mouthRound', 'mouthX', 'blush',
  // 꼬리 (손 역할)
  'tailRaise', 'tailChin', 'tailDroop', 'tailRot',
  // 소품 표시 (0..1, 통통 튀는 스프링)
  'spark', 'think', 'notes', 'tear',
  // 레이어 세기 (엔벨로프)
  'breatheAmp', 'lookWeight', 'talkAmp', 'thinkAmp', 'hopHeight', 'waveAmp', 'danceAmp', 'halo',
] as const;
export type PoseKey = (typeof POSE_KEYS)[number];

/** 엔진이 매 프레임 계산하는 파생 값 (geometry 입력에 포함) */
export const DERIVED_KEYS = [
  'sqX', 'sqY', 'faceX', 'faceY', 'sparkPhase', 'notesPhase', 'dotsPhase', 'tearPhase',
  'hatRot', 'capeSwing', 'boilSeed',
] as const;
export type DerivedKey = (typeof DERIVED_KEYS)[number];
export type Params = Record<PoseKey | DerivedKey, number>;

export const NEUTRAL: Params = {
  rootX: 0, rootY: 0, rootRot: 0, sqXBase: 1, sqYBase: 1,
  headX: 0, headY: 0, headRot: 0,
  lookX: 0, lookY: 0, eyeOpen: 1, eyeHappy: 0, eyeScale: 1, lidSad: 0,
  browOp: 0, browY: 0, browSad: 0, browRaiseR: 0,
  mouthOpen: 0, mouthSmile: 1, mouthWidth: 1, mouthRound: 0, mouthX: 0, blush: 0,
  tailRaise: 0, tailChin: 0, tailDroop: 0, tailRot: 0,
  spark: 0, think: 0, notes: 0, tear: 0,
  breatheAmp: 1, lookWeight: 1, talkAmp: 0, thinkAmp: 0, hopHeight: 0, waveAmp: 0, danceAmp: 0, halo: 0,
  sqX: 1, sqY: 1, faceX: 0, faceY: 0, sparkPhase: 0, notesPhase: 0, dotsPhase: 0, tearPhase: 0,
  hatRot: 0, capeSwing: 0, boilSeed: 1,
};

/** 상태별 포즈 (NEUTRAL과 합쳐서 목표값이 된다) */
export const POSES: Record<RigState, Partial<Params>> = {
  idle: {},
  talk: { mouthSmile: 0.55, browOp: 0.35, lookWeight: 0.8, talkAmp: 1 },
  think: {
    headRot: -9, headX: -1, lookX: 0.75, lookY: -1, mouthRound: 0.6, mouthSmile: 0, mouthWidth: 0.85, mouthX: 4,
    browOp: 1, browRaiseR: 1, tailChin: 1, think: 1, thinkAmp: 1, lookWeight: 0.12, breatheAmp: 0.6,
  },
  happy: {
    eyeHappy: 1, mouthSmile: 1, mouthOpen: 0.55, mouthWidth: 1.15, blush: 1, spark: 1, hopHeight: 16,
    lookWeight: 0.4, tailRaise: 0.35, halo: 1,
  },
  sad: {
    headRot: 7, headY: 3, lookX: -0.25, lookY: 0.85, lidSad: 1, eyeOpen: 0.9, browOp: 1, browSad: 1,
    mouthSmile: -0.85, mouthWidth: 0.8, tailDroop: 1, sqXBase: 1.035, sqYBase: 0.955, breatheAmp: 0.5,
    tear: 1, lookWeight: 0.25, halo: 1,
  },
  cheer: {
    eyeHappy: 1, mouthOpen: 0.95, mouthSmile: 1, mouthWidth: 1.2, mouthRound: 0.15, tailRaise: 1, waveAmp: 1,
    hopHeight: 10, spark: 1, blush: 0.8, browOp: 0.4, browY: -2, lookWeight: 0.35, halo: 1,
  },
  dance: {
    eyeHappy: 1, mouthSmile: 1, mouthOpen: 0.35, danceAmp: 1, notes: 1, tailRaise: 0.25, lookWeight: 0.3,
    halo: 1,
  },
};

/** reduced-motion일 때 움직임 대신 쓰는 색 단서 (후광 색) */
export const HALO_COLOR: Record<RigState, string> = {
  idle: '#C8E6C9',
  talk: '#C8E6C9',
  think: '#E1BEE7',
  happy: '#FFE082',
  sad: '#B3E5FC',
  cheer: '#FFD180',
  dance: '#FFCCBC',
};

export type SpringGroup = 'face' | 'body' | 'envelope' | 'prop';
export const SPRING: Record<SpringGroup, { k: number; c: number }> = {
  face: { k: 420, c: 34 }, // 빠르고 거의 안 튐 (ζ≈0.83)
  body: { k: 200, c: 19 }, // 살짝 튐 (ζ≈0.67)
  envelope: { k: 60, c: 15 }, // 천천히 페이드 (ζ≈0.97)
  prop: { k: 170, c: 13 }, // 통통 (ζ≈0.5)
};

export function springGroupOf(key: PoseKey): SpringGroup {
  if (key === 'spark' || key === 'think' || key === 'notes' || key === 'tear') return 'prop';
  if (
    key === 'breatheAmp' || key === 'lookWeight' || key === 'talkAmp' || key === 'thinkAmp' ||
    key === 'waveAmp' || key === 'danceAmp' || key === 'halo' || key === 'hopHeight'
  ) return 'envelope';
  if (
    key.startsWith('root') || key.startsWith('head') || key.startsWith('tail') || key.startsWith('sq')
  ) return 'body';
  return 'face';
}

export function poseOf(state: RigState): Params {
  return { ...NEUTRAL, ...POSES[state] };
}

export type MotionTier = 'full' | 'lite' | 'minimal';
export type RigStyle = 'A' | 'B';

/** 정적 포즈 (SSR 첫 렌더·공유 카드·아바타·reduced-motion 공용) */
export function staticParams(state: RigState): Params {
  const p = poseOf(state);
  return {
    ...p,
    sqX: p.sqXBase,
    sqY: p.sqYBase,
    faceX: p.lookX * 1.6,
    faceY: p.lookY * 1.1,
    sparkPhase: 0.15,
    tearPhase: 0.45,
    notesPhase: 0.3,
    dotsPhase: 0.25,
    hatRot: 0,
    capeSwing: 0,
    boilSeed: 1,
    halo: 0,
  };
}
