/**
 * 저사양 자동 감지 (P0-16, X12). DOM 의존 없음 → 합성 프레임 기록으로 단위 테스트한다. 브라우저 어댑터는 `browser.ts`.
 *
 * 1) `staticGuess`: 정적 신호로 첫 추정 (렌더 전, 0ms). 확실히 약한 기기만 내린다
 * 2) `FrameSampler`: 실제 rAF 간격을 1초 창으로 보고 **하향만** 한다 (첫 3초 중 2초, 이후 4초 중 3초가 끊기면 한 단계).
 *    세션 중 상향 없음(깜빡임 방지), 다음 세션은 저장한 단계에서 시작
 *
 * 임계값은 헤드리스·합성 기록으로 정했다. 실기기·텔레메트리(`motion_tier_change`)로 P12-04에서 조정한다.
 */
import { stepDown, tierIndex, type MotionTier } from './tier';

export interface StaticSignals {
  hardwareConcurrency?: number;
  /** Chromium만 */
  deviceMemory?: number;
  /** Chromium만 */
  saveData?: boolean;
  /** Chromium만 */
  effectiveType?: string;
  reducedMotion: boolean;
  /** 현재 어떤 브라우저도 기본 지원 안 함 (지원해도 무해하게 읽음) */
  reducedData?: boolean;
  /** WebKit(iOS의 모든 브라우저 포함)은 코어 수를 4 또는 8로만 알려 줌 → 판단에 쓰지 않는다 */
  webkit?: boolean;
}

export interface Guess {
  tier: MotionTier;
  reasons: string[];
}

/** 정적 신호 → 첫 추정. 보수적으로: 확실히 약한 기기만 내리고, 나머지는 실측에 맡긴다 (부트 스크립트도 같은 규칙, 테스트가 확인) */
export function staticGuess(s: StaticSignals): Guess {
  let tier: MotionTier = 'full';
  const reasons: string[] = [];
  const cap = (t: MotionTier, why: string) => {
    if (tierIndex(t) > tierIndex(tier)) tier = t;
    reasons.push(why);
  };
  if (s.deviceMemory !== undefined) {
    if (s.deviceMemory <= 1)
      cap('minimal', `deviceMemory ${s.deviceMemory}GB ≤ 1`);
    else if (s.deviceMemory <= 2)
      cap('lite', `deviceMemory ${s.deviceMemory}GB ≤ 2`);
  }
  if (
    !s.webkit &&
    s.hardwareConcurrency !== undefined &&
    s.hardwareConcurrency <= 2
  ) {
    cap('lite', `hardwareConcurrency ${s.hardwareConcurrency} ≤ 2`);
  }
  if (s.saveData) cap('lite', 'saveData(데이터 절약)');
  if (s.reducedData) cap('lite', 'prefers-reduced-data');
  if (s.effectiveType === 'slow-2g' || s.effectiveType === '2g')
    cap('lite', `effectiveType ${s.effectiveType}`);
  if (!reasons.length) reasons.push('약한 기기 신호 없음 → 실측으로 판정');
  return { tier, reasons };
}

export interface SamplerOptions {
  /** 판정 창 길이 (ms) */
  windowMs: number;
  /** 최근 of개 창 중 need개가 나쁘면 한 단계 내림 */
  of: number;
  need: number;
  /** 첫 판정(프로브) 구간: 처음 probeWindows개 창 중 probeNeed개가 나쁘면 바로 내림 */
  probeWindows: number;
  probeNeed: number;
  /** 내린 직후 이 시간 동안은 창을 버림 (화면이 바뀌는 중) */
  cooldownMs: number;
  /** 창이 나쁜 기준: 놓친 프레임 비율 */
  dropRatio: number;
  /** 창이 나쁜 기준: 목표 간격의 2.5배 넘는 프레임(눈에 띄는 끊김) 개수 */
  hitches: number;
  /** 목표 프레임 간격 하한 (120Hz 화면에서도 60fps면 충분) */
  minTargetMs: number;
}

export const DEFAULT_SAMPLER: SamplerOptions = {
  windowMs: 1000,
  of: 4,
  need: 3,
  probeWindows: 3,
  probeNeed: 2,
  cooldownMs: 1500,
  dropRatio: 0.25,
  hitches: 4,
  minTargetMs: 1000 / 60,
};

export interface WindowStat {
  start: number;
  frames: number;
  expected: number;
  drop: number;
  hitches: number;
  p90: number;
  bad: boolean;
}

export interface TierEvent {
  /** rAF 타임스탬프 (페이지 시작부터 ms) */
  t: number;
  from: MotionTier;
  to: MotionTier;
  why: string;
}

const FAST_REFRESH = [1000 / 144, 1000 / 120, 1000 / 90, 1000 / 60];

/**
 * 화면 주사율 추정. 표준 주사율에만 맞추고, 아니면 60Hz로 본다.
 * - 처음부터 과부하인 기기는 프레임이 느리고 들쭉날쭉 → 느린 간격을 "주사율"로 착각하면 판정이 멈춤 (P0-16 1차 검증에서 발견, 회귀 테스트 있음)
 * - 30Hz는 아주 고를 때만 (iOS 저전력 모드처럼 rAF 자체가 30fps로 고정된 경우)
 */
export function estimateRefresh(deltas: number[]): number {
  if (deltas.length < 10) return 1000 / 60;
  const s = [...deltas].sort((a, b) => a - b);
  const q = (p: number) => s[Math.floor(s.length * p)];
  const q20 = q(0.2);
  for (const r of FAST_REFRESH) if (Math.abs(q20 - r) / r < 0.12) return r;
  const regular = q(0.8) / q20 < 1.2;
  if (regular && Math.abs(q(0.5) - 1000 / 30) / (1000 / 30) < 0.08)
    return 1000 / 30;
  return 1000 / 60;
}

/**
 * 프레임 간격을 받아 연출 단계를 판정.
 * - 하향만 (세션 중 자동 상향 없음)
 * - 한두 번의 긴 작업(Pyodide 로딩, 라우트 이동)은 무시: 여러 창이 연속으로 나빠야 내림
 * - 30Hz로 고르게 도는 기기(iOS 저전력 모드 등)는 lite
 */
export class FrameSampler {
  tier: MotionTier;
  readonly events: TierEvent[] = [];
  readonly windows: WindowStat[] = [];
  refreshMs = 1000 / 60;
  private o: SamplerOptions;
  private buf: number[] = [];
  private winStart = -1;
  private cooldownUntil = 0;
  private seen = 0;
  private early: number[] = [];
  private paused = false;
  private onChange?: (e: TierEvent) => void;

  constructor(
    initial: MotionTier,
    opts: Partial<SamplerOptions> = {},
    onChange?: (e: TierEvent) => void,
  ) {
    this.tier = initial;
    this.o = { ...DEFAULT_SAMPLER, ...opts };
    this.onChange = onChange;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** 알려진 무거운 작업(Pyodide 로딩 등) 동안 판정 중지. 모으던 창은 버린다 */
  pause() {
    this.paused = true;
    this.buf = [];
    this.winStart = -1;
  }

  resume() {
    this.paused = false;
  }

  /** rAF 한 번마다 호출: t = rAF 타임스탬프(ms), dt = 직전 프레임과 간격 */
  push(t: number, dt: number) {
    if (this.paused || dt <= 0) return;
    // 탭 전환·백그라운드 복귀 같은 큰 공백은 버림
    if (dt > 1000) {
      this.buf = [];
      this.winStart = -1;
      return;
    }
    if (this.early.length < 60) {
      this.early.push(dt);
      if (this.early.length === 60)
        this.refreshMs = estimateRefresh(this.early);
    }
    if (this.winStart < 0) this.winStart = t - dt;
    this.buf.push(dt);
    if (t - this.winStart >= this.o.windowMs) this.closeWindow(t);
  }

  private closeWindow(t: number) {
    const span = t - this.winStart;
    const target = Math.max(this.refreshMs, this.o.minTargetMs);
    const expected = span / target;
    const frames = this.buf.length;
    const drop = Math.max(0, 1 - frames / expected);
    const hitches = this.buf.filter((d) => d > target * 2.5).length;
    const sorted = [...this.buf].sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
    const bad = drop > this.o.dropRatio || hitches >= this.o.hitches;
    const w: WindowStat = {
      start: this.winStart,
      frames,
      expected: +expected.toFixed(1),
      drop: +drop.toFixed(3),
      hitches,
      p90: +p90.toFixed(1),
      bad,
    };
    this.buf = [];
    this.winStart = t;
    if (t < this.cooldownUntil) return;
    this.windows.push(w);
    // 판정에 쓰는 것은 최근 몇 개뿐이라 오래 켜 둔 탭에서도 커지지 않게
    if (this.windows.length > 16)
      this.windows.splice(0, this.windows.length - 16);
    this.seen++;
    this.decide(t);
  }

  private decide(t: number) {
    if (this.tier === 'minimal') return;
    // 30Hz로 고르게: 저전력 모드이거나 늘 과부하 → lite 상한
    if (
      this.tier === 'full' &&
      Math.abs(this.refreshMs - 1000 / 30) < 2 &&
      this.seen >= 2
    ) {
      return this.change(
        t,
        'lite',
        '주사율 30Hz (저전력 모드 또는 상시 과부하)',
      );
    }
    const recent = this.windows.slice(-this.o.of);
    const badCount = recent.filter((w) => w.bad).length;
    if (this.seen <= this.o.probeWindows) {
      const probeBad = this.windows
        .slice(-this.seen)
        .filter((w) => w.bad).length;
      if (probeBad >= this.o.probeNeed) {
        return this.change(
          t,
          stepDown(this.tier),
          `첫 ${this.seen}초 중 ${probeBad}초 끊김`,
        );
      }
      return;
    }
    if (recent.length >= this.o.of && badCount >= this.o.need) {
      return this.change(
        t,
        stepDown(this.tier),
        `최근 ${this.o.of}초 중 ${badCount}초 끊김`,
      );
    }
  }

  private change(t: number, to: MotionTier, why: string) {
    if (tierIndex(to) <= tierIndex(this.tier)) return;
    const e: TierEvent = { t, from: this.tier, to, why };
    this.tier = to;
    this.events.push(e);
    this.windows.length = 0;
    this.seen = 0;
    this.cooldownUntil = t + this.o.cooldownMs;
    this.onChange?.(e);
  }
}
