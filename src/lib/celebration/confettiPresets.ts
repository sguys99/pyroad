import type { Options } from 'canvas-confetti';
import type { ConfettiPresetName } from './plan';

/**
 * 축하 단계별 컨페티 (P1-10). 세기: 스테이지 클리어·프로젝트(180) > 레벨 업(124) > 뱃지(40) > 황금키(0).
 * `delay`는 카드가 등장한 시각 기준: 카드 스프링이 자리 잡는 순간(약 150ms)에 첫 발.
 * 레벨 업은 숫자가 새 레벨로 바뀌며 톡 튀는 순간(카운트업이 끝날 때)에 `LEVEL_POP_BURST`를 한 발 더.
 * 파티클 수는 연출 단계 배율과 화면 상한(`MAX_LIVE_PARTICLES`)을 거쳐 줄어들 수 있다 (`fireConfetti`).
 */
export interface ConfettiBurst extends Pick<
  Options,
  | 'particleCount'
  | 'spread'
  | 'angle'
  | 'origin'
  | 'colors'
  | 'shapes'
  | 'scalar'
  | 'ticks'
  | 'startVelocity'
> {
  particleCount: number;
  delay: number;
}

/** 디자인 토큰(globals.css)에 맞춘 색: primary 초록 · success 금색 · accent 주황 · secondary 하늘 · 산호 */
const BRAND = ['#4CAF50', '#FFD54F', '#FFB74D', '#87CEEB', '#FF8A80'];
const GOLD = ['#FFD54F', '#FFC107', '#FFB74D', '#4CAF50'];

export const CONFETTI_PRESETS: Record<ConfettiPresetName, ConfettiBurst[]> = {
  grand: [
    {
      particleCount: 100,
      spread: 100,
      origin: { x: 0.5, y: 0.45 },
      colors: BRAND,
      delay: 150,
      ticks: 110,
    },
    {
      particleCount: 40,
      spread: 60,
      angle: 60,
      origin: { x: 0.15, y: 0.6 },
      colors: BRAND,
      delay: 450,
    },
    {
      particleCount: 40,
      spread: 60,
      angle: 120,
      origin: { x: 0.85, y: 0.6 },
      colors: BRAND,
      delay: 450,
    },
  ],
  level: [
    {
      particleCount: 50,
      spread: 70,
      angle: 60,
      origin: { x: 0.2, y: 0.6 },
      colors: GOLD,
      delay: 150,
    },
    {
      particleCount: 50,
      spread: 70,
      angle: 120,
      origin: { x: 0.8, y: 0.6 },
      colors: GOLD,
      delay: 150,
    },
  ],
  badge: [
    {
      particleCount: 40,
      spread: 60,
      origin: { x: 0.5, y: 0.45 },
      colors: GOLD,
      delay: 200,
    },
  ],
  none: [],
};

/** 레벨 숫자가 바뀌는 순간 숫자 자리에서 퍼지는 작은 별 (레벨 업 합계 124). 숫자를 오래 가리지 않게 적게·빨리 */
export const LEVEL_POP_BURST: ConfettiBurst = {
  particleCount: 24,
  spread: 360,
  startVelocity: 28,
  origin: { x: 0.5, y: 0.45 },
  colors: GOLD,
  shapes: ['star'],
  scalar: 1.1,
  delay: 0,
  ticks: 70,
};

/** 공통 물리값: 빠르게 퍼졌다가 금방 떨어진다 (화면을 오래 가리지 않게) */
export const CONFETTI_PHYSICS = {
  gravity: 2.2,
  startVelocity: 55,
  ticks: 90,
} as const;
