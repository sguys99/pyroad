/**
 * 리그 엔진 (프레임워크 없음, React 리렌더 없음). 세 캐릭터가 함께 쓴다 (P0-07 → P2-13).
 *
 * - 상태 포즈: 파라미터마다 스프링. 어느 순간 끊어도 현재 값·속도에서 이어져 순간이동이 없다
 * - 공용 레이어: 눈 깜빡임 · 포인터 따라보기 · 콕 찌르기 · 착지 젤리 · 얼굴 시차 · 후광 색
 * - 캐릭터 레이어(숨쉬기·점프·말하기·종종걸음·비행…)는 정의의 `createBehavior()`가 더한다
 * - 연출 단계·동작 줄이기는 `rigPolicy()`(P2-15 `MotionBudget`)를 따른다
 * - 모든 인스턴스가 rAF 하나를 공유하고(`ticker.ts`), 할 일이 없으면 잠든다
 */
import { SPRINGS, type Spring } from '../../../../lib/motion/tokens';
import type { MotionTier } from '../../../../lib/motion/tier';
import { DEFAULT_RIG_STYLE, STYLE_RULES, type RigStyle } from '../style';
import { Follower, clamp, mulberry32 } from './math';
import { policyInterval, rigPolicy, type RigPolicy } from './policy';
import { schedule, unschedule, wakeAfter, type Tickable } from './ticker';
import {
  DEFAULT_TUNING,
  type Behavior,
  type ComposeCtx,
  type Geo,
  type Params,
  type RigDef,
  type RigTuning,
} from './types';

export interface EngineOptions<S extends string> {
  tier?: MotionTier;
  reduced?: boolean;
  style?: RigStyle;
  seed?: number;
  tuning?: Partial<RigTuning>;
  /** clipPath·filter id 접두사 (마크업과 같아야 함) */
  idp?: string;
  /** 처음 상태 (첫 렌더 정적 포즈와 같게) */
  initial?: S;
  onRender: (geo: Geo) => void;
  /** behavior가 보낸 신호 (예: 'reward') */
  onCue?: (cue: string) => void;
  /** 일회성 상태가 끝나 다음 상태로 넘어감 */
  onAutoState?: (state: S) => void;
}

export interface EngineStats {
  /** 계산한 프레임 */
  frames: number;
  /** DOM에 그린 횟수 (단계 상한·B 12fps로 줄어듦) */
  renders: number;
}

const POKE_LEN = 1.2;
/** 조용한 대기의 렌더 간격 (30fps) */
const CALM_INTERVAL = 1 / 30;
const SLOW_BLINK_EVERY = 7;
const SLOW_BLINK_LEN = 0.4;

/** 감쇠비 ζ → 같은 강성에서의 감쇠 c (질량 1) */
export function dampingFor(k: number, zeta: number): number {
  return 2 * zeta * Math.sqrt(k);
}

export class RigEngine<S extends string = string> implements Tickable {
  readonly def: RigDef<S, unknown>;
  state: S;
  talking = false;
  policy: RigPolicy;
  style: RigStyle;
  tuning: RigTuning;
  stats: EngineStats = { frames: 0, renders: 0 };

  private cur: Params;
  private vel: Params;
  private target: Params;
  private out: Params;
  private keys: string[];
  private springs: Spring[];
  private behavior: Behavior<S>;
  private ctx: ComposeCtx<S>;
  private rng: () => number;
  private idp: string;
  private opts: EngineOptions<S>;

  private t = 0;
  private ts = 0;
  private lastNow = 0;
  private renderAcc = 0;
  private visible = true;
  private running = false;
  private destroyed = false;
  /** 잠든 엔진이 깰 엔진 시간 (느린 눈 깜빡임 등). null이면 깨울 일 없음 */
  private sleepUntil: number | null = null;
  private cancelWake: (() => void) | null = null;

  private blinkNext = 2.5;
  private blinkStart = -10;
  private blinkDouble = false;
  private pointer = { x: 0, y: 0, active: false, lastMove: -10, touch: false };
  private ptr = {
    x: new Follower(0, 150, 22),
    y: new Follower(0, 150, 22),
    env: new Follower(0, 40, 12),
  };
  private pokeAt = -10;
  private jx: Follower;
  private jy: Follower;

  constructor(def: RigDef<S, unknown>, opts: EngineOptions<S>) {
    this.def = def;
    this.opts = opts;
    this.state = opts.initial ?? def.idleState;
    this.policy = rigPolicy(opts.tier ?? 'full', opts.reduced ?? false);
    this.style = opts.style ?? DEFAULT_RIG_STYLE;
    this.tuning = { ...DEFAULT_TUNING, ...opts.tuning };
    this.idp = opts.idp ?? def.id;
    this.rng = mulberry32(opts.seed ?? 7);
    this.keys = [...def.poseKeys];
    this.springs = this.keys.map((k) => SPRINGS[def.springOf(k)]);
    this.cur = { ...def.neutral, ...def.poses[this.state] };
    this.target = { ...this.cur };
    this.out = { ...this.cur };
    this.vel = Object.fromEntries(this.keys.map((k) => [k, 0]));
    this.jx = new Follower(this.cur.sqXBase ?? 1, 520, 10);
    this.jy = new Follower(this.cur.sqYBase ?? 1, 520, 10);
    this.applyJelly();
    this.behavior = def.createBehavior();
    this.ctx = {
      dt: 0,
      t: 0,
      ts: 0,
      state: this.state,
      live: true,
      policy: this.policy,
      tuning: this.tuning,
      style: this.style,
      cur: this.cur,
      target: this.target,
      out: this.out,
      sq: { x: 1, y: 1 },
      rng: this.rng,
      talking: false,
      look: { x: 0, y: 0, w: 0 },
      kickJelly: (vx: number, vy: number) => {
        if (this.policy.reduced) return;
        this.jx.v += vx;
        this.jy.v += vy;
      },
      emit: (cue: string) => {
        this.opts.onCue?.(cue);
      },
    };
    this.syncCtx(0);
    this.behavior.enter(this.ctx, this.state, false);
    this.retarget(true);
  }

  // ───────── 공개 API

  /** 상태 바꾸기. 같은 상태면 무시 (`replay()`로 다시 재생) */
  setState(s: S): void {
    if (s === this.state) return;
    this.enterState(s, false);
  }

  /** 지금 상태를 처음부터 다시 (일회성 동작: 등장·피격·보상 건네기…) */
  replay(): void {
    this.enterState(this.state, true);
  }

  setTalking(on: boolean): void {
    if (on === this.talking) return;
    this.talking = on;
    this.retarget(false);
  }

  setMotion(tier: MotionTier, reduced: boolean): void {
    if (tier === this.policy.tier && reduced === this.policy.reduced) return;
    this.policy = rigPolicy(tier, reduced);
    this.ctx.policy = this.policy;
    this.retarget(reduced);
  }

  setStyle(style: RigStyle): void {
    if (style === this.style) return;
    this.style = style;
    this.ctx.style = style;
    this.applyJelly();
    this.forceRender();
  }

  /** 지금 모습을 다시 그린다 (마크업 구조가 바뀐 뒤) */
  refresh(): void {
    this.forceRender();
  }

  setTuning(partial: Partial<RigTuning>): void {
    this.tuning = { ...this.tuning, ...partial };
    this.ctx.tuning = this.tuning;
    this.applyJelly();
    this.retarget(false);
  }

  /** 화면 밖·숨긴 탭이면 false → 멈춤 */
  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    if (v) {
      this.kick();
    } else {
      this.stop();
    }
  }

  /** 화면 좌표를 캐릭터 기준 -1..1로 정규화한 값. 터치는 2.5초 보고 돌아온다 */
  setPointer(nx: number, ny: number, touch: boolean): void {
    this.pointer.x = clamp(nx, -1, 1);
    this.pointer.y = clamp(ny, -1, 1);
    this.pointer.active = true;
    this.pointer.touch = touch;
    this.pointer.lastMove = this.t;
    if (this.policy.mode === 'live') this.kick();
  }

  clearPointer(): void {
    this.pointer.active = false;
  }

  /** 콕 찌르기: 간지럼 (눈웃음 + 볼 빨개짐 + 부르르 + 젤리). 동작 줄이기면 표정만 */
  poke(): void {
    this.pokeAt = this.t;
    if (this.policy.mode === 'live') {
      this.jy.v -= 3.2;
      this.jx.v += 2.4;
    }
    this.kick();
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
  }

  /** 현재 출력 파라미터 (테스트·베이크용 복사본) */
  snapshot(): Params {
    return { ...this.out };
  }

  /** 현재 geometry */
  geometry(): Geo {
    return this.def.geometry(this.out, this.geoCtx());
  }

  /** 프레임을 계속 받는 중인가 (잠들면 false) */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 시간을 직접 넘긴다 (테스트·프레임 스트립용, rAF 없이). 잠든 동안은 시간만 흐르고,
   * 깰 시간(느린 눈 깜빡임)이 되면 다시 계산한다 — 브라우저의 wakeAfter와 같은 결과.
   */
  advance(seconds: number, fps = 60): void {
    const dt = 1 / fps;
    const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i++) {
      if (!this.running) {
        this.t += dt;
        this.ts += dt;
        if (this.sleepUntil === null || this.t < this.sleepUntil) continue;
        this.sleepUntil = null;
        this.running = true;
      }
      this.running = this.frame(dt, dt);
    }
  }

  // ───────── 내부

  tick(now: number): boolean {
    if (!this.visible || this.destroyed) {
      this.running = false;
      return false;
    }
    const raw = this.lastNow ? (now - this.lastNow) / 1000 : 1 / 60;
    this.lastNow = now;
    if (raw <= 0) return true;
    this.running = this.frame(Math.min(raw, 1 / 20), Math.min(raw, 10));
    // 잠들 때 lastNow는 그대로 둔다: 타이머로 깨면 잠든 시간만큼 시계가 흘러 깜빡임 시각에 닿는다
    if (!this.running) this.armWake();
    return this.running;
  }

  private enterState(s: S, replay: boolean) {
    const prev = this.state;
    this.state = s;
    this.ts = 0;
    this.syncCtx(0);
    this.behavior.enter(this.ctx, prev, replay);
    this.retarget(false);
  }

  private applyJelly() {
    const base = SPRINGS[STYLE_RULES[this.style].jelly];
    const k = base.k;
    const c =
      this.tuning.jellyZeta === null
        ? base.c
        : dampingFor(k, this.tuning.jellyZeta);
    this.jx.k = this.jy.k = k;
    this.jx.c = this.jy.c = c;
  }

  private live() {
    return this.policy.mode === 'live';
  }

  private retarget(instant: boolean) {
    const d = this.def;
    const pose: Params = { ...d.neutral, ...d.poses[this.state] };
    if (this.talking && 'talkAmp' in pose && !(pose.talkAmp > 0))
      pose.talkAmp = 1;
    if (!this.live()) for (const k of d.loopKeys) pose[k] = 0;
    if (this.policy.reduced)
      for (const k of d.pinnedKeys) pose[k] = d.neutral[k];
    if ('halo' in pose)
      pose.halo = this.policy.halo && this.state !== d.idleState ? 1 : 0;
    this.target = pose;
    this.ctx.target = pose;
    if (instant || this.policy.mode === 'still') {
      for (const k of this.keys) {
        this.cur[k] = pose[k];
        this.vel[k] = 0;
      }
      this.jx.reset(pose.sqXBase ?? 1);
      this.jy.reset(pose.sqYBase ?? 1);
    }
    this.kick();
  }

  private kick() {
    if (!this.visible || this.destroyed) return;
    this.sleepUntil = null;
    this.cancelWake?.();
    this.cancelWake = null;
    if (!this.running) {
      // 입력으로 깨면 첫 프레임은 1/60초 (잠든 시간이 일회성 동작의 시간으로 새지 않게)
      this.lastNow = 0;
      this.running = true;
      schedule(this);
    }
  }

  private stop() {
    unschedule(this);
    this.cancelWake?.();
    this.cancelWake = null;
    this.running = false;
  }

  private forceRender() {
    this.compose(0);
    this.render();
    this.kick();
  }

  private armWake() {
    this.cancelWake?.();
    this.cancelWake = null;
    if (this.sleepUntil === null || !this.visible) return;
    this.cancelWake = wakeAfter(this, (this.sleepUntil - this.t) * 1000);
  }

  private syncCtx(dt: number) {
    const c = this.ctx;
    c.dt = dt;
    c.t = this.t;
    c.ts = this.ts;
    c.state = this.state;
    c.live = this.live();
    c.talking = this.talking;
  }

  /** 한 프레임. 계속 그려야 하면 true */
  private frame(dt: number, wall: number): boolean {
    this.t += wall;
    this.ts += wall;
    this.stats.frames++;
    // 스프링 적분 (반암시적 오일러, 1/60 단위로 쪼갬)
    const steps = Math.max(1, Math.ceil(dt * 60 - 1e-6));
    const h = dt / steps;
    let energy = 0;
    const { cur, vel, target, keys, springs } = this;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const { k: K, c: C } = springs[i];
      let x = cur[k];
      let v = vel[k];
      const tg = target[k];
      for (let j = 0; j < steps; j++) {
        v += (K * (tg - x) - C * v) * h;
        x += v * h;
      }
      cur[k] = x;
      vel[k] = v;
      energy += Math.abs(v) + Math.abs(tg - x);
    }
    // 일회성 상태 → 다음 상태
    const next = this.def.autoNext?.[this.state];
    if (next && this.ts >= next.after) {
      this.enterState(next.to, false);
      this.opts.onAutoState?.(next.to);
    }
    this.compose(dt);
    // 렌더 간격: 스타일(B 12fps)과 단계 상한(lite 30fps) 중 긴 쪽.
    // 조용한 대기(전환·일회성 동작·따라보기·콕 찌르기 없음)는 숨쉬기·깜빡임뿐이라 full도 30fps로 그린다 (대기 CPU 절반)
    const calm =
      this.state === this.def.idleState &&
      !this.talking &&
      energy < 0.05 &&
      !this.behavior.busy?.(this.ctx) &&
      this.ptr.env.x < 0.01 &&
      this.t - this.pokeAt >= POKE_LEN &&
      Math.abs(this.jx.v) + Math.abs(this.jy.v) < 0.2;
    const interval = Math.max(
      STYLE_RULES[this.style].renderInterval,
      policyInterval(this.policy),
      calm ? CALM_INTERVAL : 0,
    );
    this.renderAcc += dt;
    let rendered = false;
    if (this.renderAcc + 1e-4 >= interval) {
      this.renderAcc = interval ? this.renderAcc % interval : 0;
      this.render();
      rendered = true;
    }
    if (this.live()) return true;
    // 전환만 그리는 단계·동작 줄이기: 전환·일회성 동작·깜빡임이 끝나면 잠든다 (대기 CPU 0)
    const jelly =
      Math.abs(this.jx.v) +
      Math.abs(this.jy.v) +
      Math.abs(this.jx.x - this.ctx.sq.x) +
      Math.abs(this.jy.x - this.ctx.sq.y);
    const busy =
      this.behavior.busy?.(this.ctx) ||
      this.blinking() ||
      this.t - this.pokeAt < POKE_LEN;
    if (energy < 2e-3 && jelly < 2e-3 && !busy) {
      if (!rendered) this.render();
      // 깰 시각: 다음 깜빡임 또는 일회성 상태의 끝(자동 다음 상태) 중 이른 쪽
      let wake = this.policy.blink === 'off' ? Infinity : this.blinkNext;
      const auto = this.def.autoNext?.[this.state];
      if (auto) wake = Math.min(wake, this.t - this.ts + auto.after);
      this.sleepUntil = Number.isFinite(wake) ? wake : null;
      return false;
    }
    return true;
  }

  private blinking() {
    return (
      this.policy.blink !== 'off' &&
      this.t - this.blinkStart < (this.policy.blink === 'slow' ? 0.4 : 0.45)
    );
  }

  /** 눈 감김 정도 0..1 */
  private blinkAmount(): number {
    const t = this.t;
    if (this.policy.blink === 'off') return 0;
    if (this.policy.blink === 'slow') {
      // 동작 줄이기: 7초에 한 번, 0.4초 (§12-Q26)
      if (t >= this.blinkNext) {
        this.blinkStart = t;
        this.blinkNext = t + SLOW_BLINK_EVERY;
      }
      const u = (t - this.blinkStart) / SLOW_BLINK_LEN;
      if (u < 0 || u > 1) return 0;
      return u < 0.3 ? u / 0.3 : u < 0.7 ? 1 : (1 - u) / 0.3;
    }
    // 보통: 2.2~5.5초 간격, 18%는 두 번
    if (t >= this.blinkNext) {
      this.blinkStart = t;
      this.blinkDouble = this.rng() < 0.18;
      this.blinkNext = t + 2.2 + this.rng() * 3.3;
    }
    const at = (u: number) =>
      u < 0
        ? 0
        : u < 0.06
          ? u / 0.06
          : u < 0.08
            ? 1
            : u < 0.16
              ? 1 - (u - 0.08) / 0.08
              : 0;
    const d = t - this.blinkStart;
    return Math.max(at(d), this.blinkDouble ? at(d - 0.24) : 0);
  }

  private compose(dt: number) {
    const { cur, out, ctx, def, tuning } = this;
    Object.assign(out, cur);
    const live = this.live();
    this.syncCtx(dt);
    ctx.sq.x = cur.sqXBase ?? 1;
    ctx.sq.y = cur.sqYBase ?? 1;

    // 포인터 따라보기 (터치는 2.5초 뒤 원위치)
    const t = this.t;
    if (live) {
      const p = this.pointer;
      const on = p.active && (!p.touch || t - p.lastMove < 2.5);
      const m = tuning.look;
      const px = this.ptr.x.step(clamp(p.x * m, -1.8, 1.8), dt);
      const py = this.ptr.y.step(clamp(p.y * m, -1.8, 1.8), dt);
      const pe = this.ptr.env.step(on ? 1 : 0, dt);
      ctx.look.x = px;
      ctx.look.y = py;
      ctx.look.w = clamp(cur.lookWeight ?? 1) * pe;
    } else {
      ctx.look.x = ctx.look.y = ctx.look.w = 0;
    }

    this.behavior.compose(ctx);

    if (live && ctx.look.w > 0) {
      const { x, y, w } = ctx.look;
      out.lookX = out.lookX * (1 - w) + x * w;
      out.lookY = out.lookY * (1 - w) + y * w;
      out.headRot += x * w * def.lookHead.rot * Math.min(1.5, tuning.look);
      out.headX += x * w * def.lookHead.x;
    }

    // 눈 깜빡임
    out.eyeOpen = cur.eyeOpen * (1 - 0.96 * this.blinkAmount());

    // 콕 찌르기: 간지럼. 동작 줄이기·minimal은 표정만 (흔들림 없이 1초)
    const pk = t - this.pokeAt;
    if (pk < POKE_LEN) {
      const env = live ? Math.exp(-pk * 3.2) : pk < 1 ? 1 : 0;
      out.eyeHappy = Math.max(out.eyeHappy, env * 0.95);
      out.blush += env;
      out.mouthOpen = Math.max(out.mouthOpen, env * 0.5);
      if (live) out.rootX += Math.sin(pk * 55) * 1.3 * env;
    }

    // 얼굴 시차: 보는 방향으로 얼굴 전체가 살짝 이동
    out.faceX = out.lookX * 1.6;
    out.faceY = out.lookY * 1.1;

    // 젤리 (피벗 찌그러짐이 스프링으로 출렁)
    if (this.policy.reduced) {
      out.sqX = ctx.sq.x;
      out.sqY = ctx.sq.y;
      this.jx.reset(ctx.sq.x);
      this.jy.reset(ctx.sq.y);
    } else {
      out.sqX = this.jx.step(ctx.sq.x, dt);
      out.sqY = this.jy.step(ctx.sq.y, dt);
    }
  }

  private geoCtx() {
    return {
      idp: this.idp,
      style: this.style,
      haloColor:
        this.tuning.haloColors[this.state] ?? this.def.halo[this.state],
      tuning: this.tuning,
    };
  }

  private render() {
    this.stats.renders++;
    this.opts.onRender(this.def.geometry(this.out, this.geoCtx()));
  }
}
