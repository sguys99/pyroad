/**
 * 모션 토큰 (P2-01 무드보드 §6 → P2-15). 앱의 스프링·길이·easing은 이 한 곳에서만 고른다.
 *
 * - 스프링 7종은 마스코트 리그(P0-07 `params.ts`의 SPRING 4종 + 젤리 3종)와 같은 값이다. 질량 1.
 *   새 스프링을 만들지 않는 것이 원칙 (무드보드 §6.1)
 * - P2-09가 CSS 토큰(`--spring-<이름>`·`--spring-<이름>-dur`·`--dur-<이름>`)으로 옮길 때 이 값을 그대로 쓴다.
 *   CSS `linear()` easing은 `springTiming()`이 같은 스프링을 샘플링해서 만든다 (시안 `design/prototypes/src/shared/motion.ts`와 같은 계산)
 * - 젤리는 시안별 표(`JELLY_BY_CONCEPT`). 최종 시안이 B(§12-Q31)라 기본값은 B 젤리(P2-09)
 * - 디자인 토큰 원본 `@/lib/design/tokens`가 이 파일을 다시 내보내고, globals.css의 `--dur-*`·`--easing-*`·`--spring-*` 변수와 같은지 검사한다
 * - 연출 단계·reduced-motion 대체는 `tier.ts`의 `MotionBudget`을 함께 본다: `tierDuration()`, `springOrFade()`
 */
import type { MotionBudget } from './tier';

export interface Spring {
  /** 강성 (stiffness) */
  k: number;
  /** 감쇠 (damping) */
  c: number;
}

export const SPRINGS = {
  /** ζ≈0.83 거의 안 튐: 얼굴 파라미터 · 눌림 복귀, 탭·토글 전환 (0→1 정착 418ms) */
  face: { k: 420, c: 34 },
  /** ζ≈0.67 살짝 튐: 몸·머리·꼬리 · 카드·모달 등장, 스탬프 안착 (743ms) */
  body: { k: 200, c: 19 },
  /** ζ≈0.97 천천히: 레이어 세기 · 페이드·강조 하이라이트 (1,160ms) */
  envelope: { k: 60, c: 15 },
  /** ζ≈0.50 통통: 소품 팝 · 코인·별·배지·HUD 숫자 팝 (1,027ms) */
  prop: { k: 170, c: 13 },
  /** ζ≈0.22 A 젤리: 리그 착지 출렁임 · A 젤리 스퀴시·버튼 복귀 (1,360ms) */
  jellyA: { k: 520, c: 10 },
  /** ζ≈0.36 A×B 젤리 (A보다 덜): A×B 종이 버튼 (852ms) */
  jellyAB: { k: 500, c: 16 },
  /** ζ≈0.55 B 묵직: B 착지 · 묵직한 복귀 (602ms) */
  jellyB: { k: 480, c: 24 },
} as const satisfies Record<string, Spring>;

export type SpringName = keyof typeof SPRINGS;

/** 시안별 젤리 (확정 전). 버튼 복귀·젤리 스퀴시는 `jelly()`로 읽는다 */
export type DesignConcept = 'a' | 'b' | 'ab';
export const JELLY_BY_CONCEPT: Record<DesignConcept, SpringName> = {
  a: 'jellyA',
  b: 'jellyB',
  ab: 'jellyAB',
};
/**
 * 기본 시안 젤리: 최종 시안 B(§12-Q31) → jellyB(ζ≈0.55 묵직, 602ms). 리그 B 스타일(`STYLE_RULES.B.jelly`)과 같다.
 * P2-15 동안은 확정 전 임시값으로 A×B였다 (P2-09에서 B로)
 */
export const DEFAULT_CONCEPT: DesignConcept = 'b';

export function jelly(concept: DesignConcept = DEFAULT_CONCEPT): SpringName {
  return JELLY_BY_CONCEPT[concept];
}

/** 길이 (ms) */
export const DURATION = {
  /** 색·눌림 상태 */
  instant: 80,
  /** 툴팁, 작은 페이드 */
  fast: 140,
  /** minimal 단계의 짧은 페이드 (`springOrFade`) */
  fade: 150,
  /** 일반 전환, 스탬프 내려찍기 */
  base: 220,
  /** 화면 안 큰 요소, lite 잉크 */
  slow: 360,
  /** B 페이지 넘김 */
  page: 700,
  /** 진행 막대 채우기·숫자 카운트업 */
  progress: 700,
  /** 지도 길 그리기 (잉크로 선을 긋는 한 번) */
  draw: 1500,
  /** 축하 카드 한 장 (시퀀서 단위) */
  celebrate: 1200,
} as const;

export type DurationName = keyof typeof DURATION;

/** Framer Motion은 초 단위: `transition={{ duration: sec('base') }}` */
export function sec(name: DurationName): number {
  return DURATION[name] / 1000;
}

/** CSS cubic-bezier 문자열 */
export const EASING = {
  /** 등장 */
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** 이동 (코인 → HUD) */
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  /** 누름 */
  press: 'cubic-bezier(0.3, 0, 0.5, 1)',
  /** 스프링을 못 쓰는 CSS 전환 대체 */
  backOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** 가속 내려찍기 */
  stampIn: 'cubic-bezier(0.55, 0, 0.9, 0.3)',
  /** 잉크 번짐·길 그리기 */
  ink: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
  /** 페이지 넘김 */
  page: 'cubic-bezier(0.45, 0.05, 0.25, 1)',
} as const;

export type EasingName = keyof typeof EASING;

/** Framer Motion용 cubic-bezier 배열 (`ease: EASE.out`) */
export const EASE = Object.fromEntries(
  Object.entries(EASING).map(([name, css]) => [
    name,
    css
      .slice('cubic-bezier('.length, -1)
      .split(',')
      .map((n) => Number(n.trim())),
  ]),
) as Record<EasingName, [number, number, number, number]>;

/** Framer Motion `transition` 스프링 (질량 1이라 리그·CSS `linear()`와 같은 곡선) */
export function framerSpring(
  spring: SpringName | Spring,
  extra: { delay?: number; velocity?: number } = {},
): {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass: 1;
  delay?: number;
  velocity?: number;
} {
  const s = typeof spring === 'string' ? SPRINGS[spring] : spring;
  return { type: 'spring', stiffness: s.k, damping: s.c, mass: 1, ...extra };
}

/** lite는 일회성 이펙트를 70% 길이로, reduced는 0 (`MotionBudget.effectDuration`) */
export function tierDuration(ms: number, budget: MotionBudget): number {
  return Math.round(ms * budget.effectDuration);
}

/**
 * 단계에 맞는 전환: 스프링을 쓸 수 있으면 스프링, minimal은 짧은 페이드(150ms), reduced는 즉시(0).
 * 반환값은 Framer `transition`에 그대로 넣는다.
 */
export function springOrFade(
  spring: SpringName,
  budget: MotionBudget,
  delaySec = 0,
):
  | ReturnType<typeof framerSpring>
  | {
      duration: number;
      ease: [number, number, number, number];
      delay?: number;
    } {
  if (budget.effectDuration === 0) return { duration: 0, ease: EASE.out };
  if (!budget.springs)
    return {
      duration: sec('fade'),
      ease: EASE.out,
      delay: delaySec * budget.effectDuration,
    };
  return framerSpring(spring, { delay: delaySec * budget.effectDuration });
}

/** 감쇠 스프링(질량 1)의 0→1 진행을 샘플링. 끝(잔떨림 0.1% 이하)까지 걸린 시간도 돌려준다 */
export function sampleSpring(
  { k, c }: Spring,
  opts: { dt?: number; maxMs?: number } = {},
): { values: number[]; durationMs: number } {
  const dt = opts.dt ?? 1 / 120;
  const maxMs = opts.maxMs ?? 2500;
  let x = 0;
  let v = 0;
  const values: number[] = [0];
  let t = 0;
  let settledAt = 0;
  while (t * 1000 < maxMs) {
    v += (k * (1 - x) - c * v) * dt;
    x += v * dt;
    t += dt;
    values.push(x);
    if (Math.abs(1 - x) > 0.001 || Math.abs(v) > 0.01) settledAt = t;
    else if (t - settledAt > 0.05) break;
  }
  return { values, durationMs: Math.round(settledAt * 1000) + 10 };
}

const timingCache = new Map<string, { easing: string; duration: number }>();

/**
 * 스프링 → CSS `linear()` easing + 길이(ms). WAAPI·CSS animation에 쓴다 (Chrome 113+, Safari 17.2+, Firefox 112+).
 * 예: `el.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], springTiming('prop'))`
 */
export function springTiming(
  spring: SpringName | Spring,
  points = 40,
): { easing: string; duration: number } {
  const s = typeof spring === 'string' ? SPRINGS[spring] : spring;
  const key = `${s.k}/${s.c}/${points}`;
  const hit = timingCache.get(key);
  if (hit) return hit;
  const { values, durationMs } = sampleSpring(s);
  const n = Math.round((durationMs / 1000) * 120);
  const stops: string[] = [];
  for (let i = 0; i <= points; i++) {
    const idx = Math.min(values.length - 1, Math.round((i / points) * n));
    stops.push((Math.round(values[idx] * 1000) / 1000).toString());
  }
  stops[stops.length - 1] = '1';
  const r = { easing: `linear(${stops.join(', ')})`, duration: durationMs };
  timingCache.set(key, r);
  return r;
}
