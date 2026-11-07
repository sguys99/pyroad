/**
 * 연출 단계 (§2.5, P0-16 §4.5, P2-15). 규칙 문서: docs/design/motion-guidelines.md
 *
 * 모든 연출은 단계(full / lite / minimal)와 reduced-motion(별도 축)을 따른다.
 * - 단계: 정적 신호로 첫 추정 → 실제 프레임 시간으로 하향만(`detect.ts`·`browser.ts`). 사용자 설정이 항상 우선
 * - reduced-motion: 움직임 0. 표정·색·글자로 피드백 (§12-Q26: 마스코트는 몸 정지 + 느린 눈 깜빡임만)
 *
 * 이 파일은 DOM·React 의존이 없는 표와 순수 함수만 둔다 (서버·클라이언트·부트 스크립트 테스트가 함께 쓴다).
 * 화면 코드는 `useMotionTier()`(`MotionTierProvider.tsx`)로 읽고, CSS는 `<html data-motion data-reduced>`로 분기한다.
 */

export type MotionTier = 'full' | 'lite' | 'minimal';
export const MOTION_TIERS: readonly MotionTier[] = ['full', 'lite', 'minimal'];

export function isMotionTier(value: unknown): value is MotionTier {
  return value === 'full' || value === 'lite' || value === 'minimal';
}

/** 0 = full, 2 = minimal (클수록 가벼움) */
export function tierIndex(tier: MotionTier): number {
  return MOTION_TIERS.indexOf(tier);
}

/** 둘 중 더 가벼운 단계 */
export function lowerTier(a: MotionTier, b: MotionTier): MotionTier {
  return tierIndex(a) >= tierIndex(b) ? a : b;
}

/** 한 단계 아래 (minimal은 그대로) */
export function stepDown(tier: MotionTier): MotionTier {
  return MOTION_TIERS[Math.min(2, tierIndex(tier) + 1)];
}

/** 설정의 "움직임": 자동(추천) / 풍성하게 / 가볍게 / 최소로 */
export type MotionTierSetting = 'auto' | MotionTier;

/** 설정의 "동작 줄이기": 기기 설정 따르기 / 켜기 / 끄기 (`users.settings.motion.reduced`, P0-16 §4.6) */
export type ReducedMotionSetting = 'system' | 'on' | 'off';

/** `users.settings.motion` (00012 기본값과 같음). 기기마다 다른 측정값은 저장하지 않는다 (localStorage) */
export interface MotionSettings {
  tier: MotionTierSetting;
  reduced: ReducedMotionSetting;
}

export const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  tier: 'auto',
  reduced: 'system',
};

const TIER_SETTINGS: readonly MotionTierSetting[] = [
  'auto',
  'full',
  'lite',
  'minimal',
];
const REDUCED_SETTINGS: readonly ReducedMotionSetting[] = [
  'system',
  'on',
  'off',
];

/**
 * 저장된 값(서버 JSONB·localStorage)을 믿지 않고 고친다. 모르는 값은 기본값으로.
 * 서버 쓰기 검증은 zod 스키마(`schema.ts`)가 따로 한다 — 이 함수는 브라우저 번들에 zod를 넣지 않으려는 읽기용.
 */
export function normalizeMotionSettings(value: unknown): MotionSettings {
  const v =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    tier: TIER_SETTINGS.includes(v.tier as MotionTierSetting)
      ? (v.tier as MotionTierSetting)
      : DEFAULT_MOTION_SETTINGS.tier,
    reduced: REDUCED_SETTINGS.includes(v.reduced as ReducedMotionSetting)
      ? (v.reduced as ReducedMotionSetting)
      : DEFAULT_MOTION_SETTINGS.reduced,
  };
}

export function sameMotionSettings(a: MotionSettings, b: MotionSettings) {
  return a.tier === b.tier && a.reduced === b.reduced;
}

export function resolveReduced(
  setting: ReducedMotionSetting,
  systemPrefersReduced: boolean,
): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return systemPrefersReduced;
}

/** 단계를 누가 정했나. default = 아직 감지 전(서버 렌더·첫 하이드레이션) */
export type MotionSource =
  | 'default'
  | 'user'
  | 'static'
  | 'stored'
  | 'measured';

export interface MotionPolicy {
  tier: MotionTier;
  reduced: boolean;
  source: MotionSource;
}

/** 최종 정책: 사용자 설정(auto가 아니면) > 감지. reduced는 단계와 별개의 축 */
export function resolvePolicy(
  settings: MotionSettings,
  detected: { tier: MotionTier; source: MotionSource },
  systemPrefersReduced: boolean,
): MotionPolicy {
  const reduced = resolveReduced(settings.reduced, systemPrefersReduced);
  if (settings.tier !== 'auto')
    return { tier: settings.tier, reduced, source: 'user' };
  return { tier: detected.tier, reduced, source: detected.source };
}

/**
 * 단계별 능력값 (P0-16 §4.5 단계표 + 계획서 P2-15). 연출 코드는 단계 이름 대신 이 값을 읽는다.
 * P2-13 마스코트 리그는 `mascot`·`mascotFps`·`blink`, P2-14 사운드는 `bgm`·`sfx`를 쓴다.
 */
export interface MotionBudget {
  /** 컨페티·파티클 배율 (full 100% / lite 30% / minimal 0) */
  particles: number;
  /** 일회성 이펙트 길이 배율 (lite 70%). 0이면 즉시 (reduced) */
  effectDuration: number;
  /** 스프링·바운스를 쓸지 (minimal은 페이드만) */
  springs: boolean;
  /** 마스코트 리그: live = 모든 레이어, transitions = 상태 전환만(대기 CPU 0), still = 움직임 0 */
  mascot: 'live' | 'transitions' | 'still';
  /** 마스코트 리그 프레임 상한 (0 = 대기 루프 없음) */
  mascotFps: number;
  /** 마스코트 두리번·오버래핑 액션·B안 선 떨림 */
  mascotSecondary: boolean;
  /** 대기 루프 (숨쉬기·통통·반짝이는 현재 위치 표시) `.m-loop` */
  idleLoops: boolean;
  /** 눈 깜빡임: reduced는 느리게(§12-Q26), minimal은 대기 루프가 없으므로 끔 */
  blink: 'normal' | 'slow' | 'off';
  /** 앰비언트 루프 (구름·물결·반짝임, P5-09) `.m-ambient` */
  ambient: boolean;
  /** 패럴랙스 (지도 레이어) */
  parallax: boolean;
  /** `filter: blur`·`backdrop-filter` (`.m-blur`, lite부터 불투명 배경으로 대체) */
  blur: boolean;
  /** 흐림 반경이 큰 그림자 (`.m-shadow`, lite부터 단색 오프셋 그림자) */
  bigShadow: boolean;
  /** 페이지 전환: slide = 슬라이드·스케일, fade = 짧은 페이드, none = 즉시 */
  pageTransition: 'slide' | 'fade' | 'none';
  /** Lottie 이펙트 (P6): play = 재생, short = 짧은 것만, still = 정지 포즈 이미지 */
  lottie: 'play' | 'short' | 'still';
  /** 배경 음악 허용 (minimal은 끔, P0-15). 사용자 BGM 설정과 함께 본다 */
  bgm: boolean;
  /** 효과음 허용 (단계와 무관하게 유지) */
  sfx: boolean;
}

export const MOTION_BUDGETS: Record<MotionTier, MotionBudget> = {
  full: {
    particles: 1,
    effectDuration: 1,
    springs: true,
    mascot: 'live',
    mascotFps: 60,
    mascotSecondary: true,
    idleLoops: true,
    blink: 'normal',
    ambient: true,
    parallax: true,
    blur: true,
    bigShadow: true,
    pageTransition: 'slide',
    lottie: 'play',
    bgm: true,
    sfx: true,
  },
  lite: {
    particles: 0.3,
    effectDuration: 0.7,
    springs: true,
    mascot: 'live',
    mascotFps: 30,
    mascotSecondary: false,
    idleLoops: true,
    blink: 'normal',
    ambient: false,
    parallax: false,
    blur: false,
    bigShadow: false,
    pageTransition: 'fade',
    lottie: 'short',
    bgm: true,
    sfx: true,
  },
  minimal: {
    particles: 0,
    effectDuration: 0.7,
    springs: false,
    mascot: 'transitions',
    mascotFps: 0,
    mascotSecondary: false,
    idleLoops: false,
    blink: 'off',
    ambient: false,
    parallax: false,
    blur: false,
    bigShadow: false,
    pageTransition: 'none',
    lottie: 'still',
    bgm: false,
    sfx: true,
  },
};

/**
 * reduced-motion: 단계와 무관하게 움직임 0 · 파티클 0 (표정·색·글자로 피드백, §12-Q26).
 * blur·그림자·BGM은 움직임이 아니므로 단계를 따른다. 눈 깜빡임은 느리게 남긴다(minimal이면 끔).
 */
export function motionBudget(tier: MotionTier, reduced: boolean): MotionBudget {
  const base = MOTION_BUDGETS[tier];
  if (!reduced) return base;
  return {
    ...base,
    particles: 0,
    effectDuration: 0,
    springs: false,
    mascot: 'still',
    mascotFps: 0,
    mascotSecondary: false,
    idleLoops: false,
    blink: base.blink === 'off' ? 'off' : 'slow',
    ambient: false,
    parallax: false,
    pageTransition: 'none',
    lottie: 'still',
  };
}
