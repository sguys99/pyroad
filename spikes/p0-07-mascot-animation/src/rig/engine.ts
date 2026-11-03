// 파이뱀 리그 엔진 (프레임워크 없음, React 리렌더 없음)
// - 상태 포즈: 파라미터별 스프링 (어느 순간 끊어도 현재 값·속도에서 이어짐)
// - 절차적 레이어: 숨쉬기·눈깜빡·점프(스쿼시&스트레치)·젤리·춤·말하기·생각·두리번·따라보기·콕 찌르기
// - 모든 인스턴스가 rAF 하나를 공유 (Ticker)
import { geometry, type Geo } from './geometry';
import {
  HALO_COLOR,
  NEUTRAL,
  POSE_KEYS,
  SPRING,
  poseOf,
  springGroupOf,
  type MotionTier,
  type Params,
  type PoseKey,
  type RigState,
  type RigStyle,
} from './params';

// ───────────── 공유 ticker
type Tickable = { tick(dt: number, now: number): boolean };
const active = new Set<Tickable>();
let rafId = 0;
let last = 0;
function loop(now: number) {
  const dt = last ? (now - last) / 1000 : 1 / 60;
  last = now;
  for (const e of active) {
    if (!e.tick(dt, now)) active.delete(e);
  }
  rafId = active.size ? requestAnimationFrame(loop) : 0;
  if (!rafId) last = 0;
}
function schedule(e: Tickable) {
  active.add(e);
  if (!rafId) rafId = requestAnimationFrame(loop);
}
function unschedule(e: Tickable) {
  active.delete(e);
}

// ───────────── 작은 도구
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
class Follower {
  x: number;
  v = 0;
  constructor(x: number, public k: number, public c: number) {
    this.x = x;
  }
  step(target: number, dt: number) {
    const a = this.k * (target - this.x) - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
  reset(x: number) {
    this.x = x;
    this.v = 0;
  }
}

/** 점프 한 번의 모양: 준비(찌그러짐) → 공중(늘어남) → 착지(찌그러짐) */
export function hopShape(u: number, H: number) {
  const A = 0.18;
  const L = 0.78;
  const k = Math.min(1.3, H / 16);
  if (u < A) {
    const s = Math.sin((Math.PI * u) / A);
    return { y: 0, sx: 0.12 * s * k, sy: -0.15 * s * k };
  }
  if (u < L) {
    const a = (u - A) / (L - A);
    const v = Math.cos(Math.PI * a);
    const st = 0.1 * Math.abs(v) * k;
    return { y: -H * Math.sin(Math.PI * a), sx: -0.7 * st, sy: st };
  }
  const s = Math.sin((Math.PI * (u - L)) / (1 - L));
  return { y: 0, sx: 0.15 * s * k, sy: -0.18 * s * k };
}

export interface EngineOptions {
  tier?: MotionTier;
  reduced?: boolean;
  style?: RigStyle;
  seed?: number;
  /** false면 소품(반짝이·음표 등) 계산을 끈다 (벤치 비교용) */
  props?: boolean;
  onRender: (geo: Geo) => void;
}

export interface EngineStats {
  frames: number;
  renders: number;
}

export class RigEngine implements Tickable {
  state: RigState = 'idle';
  talking = false;
  tier: MotionTier;
  reduced: boolean;
  style: RigStyle;
  props: boolean;
  stats: EngineStats = { frames: 0, renders: 0 };

  private cur: Params = { ...NEUTRAL };
  private vel: Record<PoseKey, number>;
  private target: Params = { ...NEUTRAL };
  private onRender: (geo: Geo) => void;
  private rng: () => number;
  private visible = true;
  private running = false;

  private t = 0;
  private ts = 0;
  private renderAcc = 0;
  // 레이어 상태
  private blinkNext = 2.5;
  private blinkStart = -10;
  private blinkDouble = false;
  private hop = { active: false, phase: 0, cycles: 0, max: 0, stop: false, H: 16 };
  private dance = 0;
  private talk = { left: 0, sylLeft: 0, open: 0, dur: 0, elapsed: 0, emph: 0 };
  private fidget = { next: 6, until: 0, lookX: 0, lookY: 0 };
  private pointer = { x: 0, y: 0, active: false, lastMove: -10, touch: false };
  private pokeAt = -10;
  // 팔로워 (오버래핑 액션)
  private jx = new Follower(1, 520, 10);
  private jy = new Follower(1, 520, 10);
  private headLag = new Follower(0, 260, 16);
  private hat = new Follower(0, 170, 6);
  private cape = new Follower(0, 90, 7);
  private tailFlick = new Follower(0, 120, 6);
  private flap = new Follower(0, 1400, 55);
  private fidLook = { x: new Follower(0, 90, 16), y: new Follower(0, 90, 16) };
  private ptr = { x: new Follower(0, 150, 22), y: new Follower(0, 150, 22), env: new Follower(0, 40, 12) };
  private prevRootX = 0;

  constructor(opts: EngineOptions) {
    this.tier = opts.tier ?? 'full';
    this.reduced = opts.reduced ?? false;
    this.style = opts.style ?? 'A';
    this.props = opts.props ?? true;
    this.onRender = opts.onRender;
    this.rng = mulberry32(opts.seed ?? 7);
    this.vel = Object.fromEntries(POSE_KEYS.map((k) => [k, 0])) as Record<PoseKey, number>;
    this.applyStyle();
    this.retarget(true);
  }

  // ───────── 공개 API
  setState(s: RigState) {
    if (s === this.state) return;
    const prev = this.state;
    this.state = s;
    this.ts = 0;
    const hopTarget = poseOf(s).hopHeight;
    if (hopTarget > 0) {
      this.hop.max = s === 'happy' ? 2 : Infinity;
      this.hop.stop = false;
      if (!this.hop.active) {
        this.hop.active = true;
        this.hop.phase = 0;
        this.hop.H = hopTarget;
      }
      this.hop.cycles = 0;
    } else if (this.hop.active) {
      this.hop.stop = true; // 공중에 있으면 이번 점프는 끝까지 (착지 후 멈춤)
    }
    if (prev === 'idle') this.fidget.until = 0;
    this.retarget(false);
  }
  setTalking(on: boolean) {
    this.talking = on;
    this.retarget(false);
  }
  setTier(tier: MotionTier) {
    this.tier = tier;
    this.applyStyle();
    this.retarget(false);
  }
  setReduced(r: boolean) {
    this.reduced = r;
    this.retarget(true);
  }
  setStyle(s: RigStyle) {
    this.style = s;
    this.applyStyle();
    this.kick();
  }
  setVisible(v: boolean) {
    this.visible = v;
    if (v) this.kick();
    else {
      unschedule(this);
      this.running = false;
    }
  }
  /** 화면 좌표를 캐릭터 기준 -1..1로 정규화한 값 */
  setPointer(nx: number, ny: number, touch: boolean) {
    this.pointer.x = Math.max(-1, Math.min(1, nx));
    this.pointer.y = Math.max(-1, Math.min(1, ny));
    this.pointer.active = true;
    this.pointer.touch = touch;
    this.pointer.lastMove = this.t;
    this.kick();
  }
  clearPointer() {
    this.pointer.active = false;
  }
  poke() {
    if (this.reduced) return;
    this.pokeAt = this.t;
    this.jy.v -= 3.2;
    this.jx.v += 2.4;
    this.hat.v += 160;
    this.kick();
  }
  destroy() {
    unschedule(this);
    this.running = false;
  }
  /** 현재 파라미터 (테스트·베이크용) */
  snapshot(): Params {
    return { ...this.out };
  }

  // ───────── 내부
  private out: Params = { ...NEUTRAL };

  private applyStyle() {
    // B(그림책): 덜 출렁이고 묵직하게
    if (this.style === 'B') {
      this.jx.k = this.jy.k = 480;
      this.jx.c = this.jy.c = 24;
    } else {
      this.jx.k = this.jy.k = 520;
      this.jx.c = this.jy.c = 10;
    }
  }

  private continuous() {
    return !this.reduced && this.tier !== 'minimal';
  }

  private retarget(instant: boolean) {
    const pose = poseOf(this.state);
    if (this.talking && this.state !== 'talk') pose.talkAmp = 1;
    // 후광(색 단서)은 움직임을 줄였을 때만
    pose.halo = this.reduced || this.tier === 'minimal' ? (this.state === 'idle' ? 0 : 1) : 0;
    if (!this.continuous()) {
      pose.breatheAmp = 0;
      pose.talkAmp = 0;
      pose.thinkAmp = 0;
      pose.waveAmp = 0;
      pose.danceAmp = 0;
      pose.hopHeight = 0;
      this.hop.active = false;
    }
    this.target = pose;
    if (instant || this.reduced) {
      for (const k of POSE_KEYS) {
        this.cur[k] = pose[k];
        this.vel[k] = 0;
      }
      this.jx.reset(pose.sqXBase);
      this.jy.reset(pose.sqYBase);
    }
    this.kick();
  }

  private kick() {
    if (!this.visible) return;
    if (this.reduced) {
      this.compose(0);
      this.render(true);
      return;
    }
    if (!this.running) {
      this.running = true;
      schedule(this);
    }
  }

  tick(dtRaw: number): boolean {
    if (!this.visible) {
      this.running = false;
      return false;
    }
    const dt = Math.min(dtRaw, 1 / 20);
    this.t += dt;
    this.ts += dt;
    this.stats.frames++;
    // 스프링 적분 (반암시적 오일러, 1/60 단위로 쪼갬)
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    const h = dt / steps;
    let energy = 0;
    for (const k of POSE_KEYS) {
      const { k: K, c: C } = SPRING[springGroupOf(k)];
      let x = this.cur[k];
      let v = this.vel[k];
      const tg = this.target[k];
      for (let i = 0; i < steps; i++) {
        v += (K * (tg - x) - C * v) * h;
        x += v * h;
      }
      this.cur[k] = x;
      this.vel[k] = v;
      energy += Math.abs(v) + Math.abs(tg - x);
    }
    this.compose(dt);
    // 렌더 간격: B는 "2프레임마다"(12fps) 손그림 느낌, lite는 30fps 상한
    const interval = this.style === 'B' ? 1 / 12 : this.tier === 'lite' ? 1 / 30 : 0;
    this.renderAcc += dt;
    if (this.renderAcc + 1e-4 >= interval) {
      this.renderAcc = interval ? this.renderAcc % interval : 0;
      this.render(false);
    }
    if (!this.continuous()) {
      // minimal: 전환이 끝나면 루프를 멈춘다 (대기 비용 0)
      const followers = Math.abs(this.jx.v) + Math.abs(this.jy.v);
      if (energy < 2e-3 && followers < 1e-3) {
        this.render(true);
        this.running = false;
        return false;
      }
    }
    return true;
  }

  private compose(dt: number) {
    const c = this.cur;
    const o = this.out;
    Object.assign(o, c);
    const full = this.continuous();
    const t = this.t;
    let sqXT = c.sqXBase;
    let sqYT = c.sqYBase;

    if (full) {
      // 숨쉬기
      const period = this.state === 'sad' ? 4.4 : 3.2;
      const b = Math.sin((2 * Math.PI * t) / period) * c.breatheAmp;
      sqYT *= 1 + 0.02 * b;
      sqXT *= 1 - 0.009 * b;
      o.headY += -0.5 * b;

      // 눈깜빡임 (2.2~5.5초 간격, 18%는 두 번)
      if (t >= this.blinkNext) {
        this.blinkStart = t;
        this.blinkDouble = this.rng() < 0.18;
        this.blinkNext = t + 2.2 + this.rng() * 3.3;
      }
      const blinkAt = (u: number) => (u < 0 ? 0 : u < 0.06 ? u / 0.06 : u < 0.08 ? 1 : u < 0.16 ? 1 - (u - 0.08) / 0.08 : 0);
      const bl = Math.max(blinkAt(t - this.blinkStart), this.blinkDouble ? blinkAt(t - this.blinkStart - 0.24) : 0);
      o.eyeOpen = c.eyeOpen * (1 - 0.96 * bl);

      // 점프 (기쁨·응원)
      if (this.hop.active) {
        const P = 0.38 + 0.015 * this.hop.H;
        this.hop.phase += dt / P;
        if (this.hop.phase >= 1) {
          this.hop.phase -= 1;
          this.hop.cycles++;
          if (this.hop.stop || this.hop.cycles >= this.hop.max) {
            this.hop.active = false;
            this.hop.phase = 0;
          } else if (this.target.hopHeight > 0) {
            this.hop.H = this.target.hopHeight;
          }
        }
        if (this.hop.active) {
          const hs = hopShape(this.hop.phase, this.hop.H);
          o.rootY += hs.y;
          sqXT *= 1 + hs.sx;
          sqYT *= 1 + hs.sy;
          o.tailRot += -10 * Math.sin(2 * Math.PI * this.hop.phase);
        }
      }

      // 춤 (120bpm, 2박에 한 번 좌우)
      if (c.danceAmp > 0.002) {
        this.dance += dt;
        const a = c.danceAmp;
        const beat = 0.5;
        const sway = Math.sin((2 * Math.PI * this.dance) / (2 * beat));
        const bounce = Math.abs(Math.sin((Math.PI * this.dance) / beat));
        o.rootRot += 7 * a * sway;
        o.rootX += 3.5 * a * sway;
        o.rootY += -5 * a * bounce;
        o.headRot += -6 * a * Math.sin((2 * Math.PI * this.dance) / (2 * beat) - 0.7);
        const down = Math.pow(1 - bounce, 3);
        sqYT *= 1 - 0.07 * a * down;
        sqXT *= 1 + 0.055 * a * down;
        o.tailRot += 16 * a * Math.sin((2 * Math.PI * this.dance) / beat);
      } else if (this.state !== 'dance') {
        this.dance = 0;
      }
      o.notesPhase = this.dance * 0.55;

      // 응원: 꼬리 흔들기
      o.tailRot += 14 * c.waveAmp * Math.sin(2 * Math.PI * t * 2.2);
      // 생각: 턱 톡톡 + 천천히 갸웃
      o.tailRot += c.thinkAmp * 6 * Math.max(0, Math.sin(2 * Math.PI * t * 1.7));
      o.headRot += c.thinkAmp * 1.5 * Math.sin(2 * Math.PI * t * 0.35);
      o.dotsPhase = t * 1.1;

      // 말하기 레이어 (어떤 표정 위에도 얹힘)
      if (c.talkAmp > 0.01) {
        const tk = this.talk;
        tk.elapsed += dt;
        if (tk.elapsed >= tk.dur) {
          tk.elapsed = 0;
          if (tk.sylLeft > 0) {
            tk.sylLeft--;
            tk.dur = 0.09 + this.rng() * 0.12;
            tk.open = 0.35 + this.rng() * 0.6;
          } else {
            tk.dur = 0.12 + this.rng() * 0.26;
            tk.open = 0.03;
            tk.sylLeft = 2 + Math.floor(this.rng() * 4);
            tk.emph = 1;
          }
        }
        const syl = tk.elapsed < tk.dur * 0.55 ? tk.open : 0.06;
        const fl = this.flap.step(syl, dt);
        tk.emph = Math.max(0, tk.emph - dt * 3);
        o.mouthOpen += c.talkAmp * fl;
        o.headY += c.talkAmp * 0.9 * fl;
        o.headRot += c.talkAmp * 1.2 * Math.sin(t * 5.3) * fl;
        o.browY += -c.talkAmp * 1.6 * tk.emph;
        o.browOp = Math.max(o.browOp, c.talkAmp * 0.35);
      } else {
        this.flap.reset(0);
      }

      // 대기 중 두리번·꼬리 털기 (full만)
      if (this.state === 'idle' && this.tier === 'full' && t - this.pointer.lastMove > 2) {
        const f = this.fidget;
        if (t >= f.next) {
          const r = this.rng();
          if (r < 0.6) {
            f.lookX = this.rng() < 0.5 ? -0.85 : 0.85;
            f.lookY = -0.25 + this.rng() * 0.3;
            f.until = t + 0.9 + this.rng() * 0.6;
          } else {
            this.tailFlick.v += 220;
          }
          f.next = t + 5 + this.rng() * 4;
        }
        if (t > f.until) {
          f.lookX = 0;
          f.lookY = 0;
        }
      } else {
        this.fidget.lookX = 0;
        this.fidget.lookY = 0;
      }
      o.lookX += this.fidLook.x.step(this.fidget.lookX, dt);
      o.lookY += this.fidLook.y.step(this.fidget.lookY, dt);
      o.tailRot += this.tailFlick.step(0, dt);

      // 포인터 따라보기 (터치는 2.5초 뒤 원위치)
      const pActive = this.pointer.active && (!this.pointer.touch || t - this.pointer.lastMove < 2.5);
      const px = this.ptr.x.step(this.pointer.x, dt);
      const py = this.ptr.y.step(this.pointer.y, dt);
      const pe = this.ptr.env.step(pActive ? 1 : 0, dt);
      const w = Math.max(0, Math.min(1, c.lookWeight)) * pe;
      o.lookX = o.lookX * (1 - w) + px * w;
      o.lookY = o.lookY * (1 - w) + py * w;
      o.headRot += px * w * 4;
      o.headX += px * w * 1.2;

      // 콕 찌르기: 간지럼 (눈 웃음 + 볼 빨개짐 + 부르르)
      const pk = t - this.pokeAt;
      if (pk < 1.2) {
        const env = Math.exp(-pk * 3.2);
        o.eyeHappy = Math.max(o.eyeHappy, env * 0.95);
        o.blush += env;
        o.mouthOpen = Math.max(o.mouthOpen, env * 0.5);
        o.rootX += Math.sin(pk * 55) * 1.3 * env;
      }
    }

    // 얼굴 시차: 보는 방향으로 얼굴 전체가 살짝 이동
    o.faceX = o.lookX * 1.6;
    o.faceY = o.lookY * 1.1;

    // 젤리 (밑동 피벗 찌그러짐이 스프링으로 출렁)
    if (full) {
      o.sqX = this.jx.step(sqXT, dt);
      o.sqY = this.jy.step(sqYT, dt);
    } else if (this.reduced) {
      o.sqX = sqXT;
      o.sqY = sqYT;
    } else {
      o.sqX = this.jx.step(sqXT, dt);
      o.sqY = this.jy.step(sqYT, dt);
    }

    // 오버래핑 액션: 머리가 몸을 한 박자 늦게 따라감, 모자·망토 출렁
    if (full && this.tier === 'full') {
      const hl = this.headLag.step(o.rootY, dt);
      o.headY += (hl - o.rootY) * 0.5;
      o.hatRot = this.hat.step((hl - o.rootY) * 1.6 + o.rootRot * -0.4, dt);
      const vx = dt > 0 ? (o.rootX - this.prevRootX) / dt : 0;
      o.capeSwing = this.cape.step(-vx * 0.06 - o.rootRot * 0.8 + (hl - o.rootY) * 0.15, dt);
    } else {
      this.headLag.reset(o.rootY);
      o.hatRot = full ? this.hat.step(0, dt) : 0;
      o.capeSwing = 0;
    }
    this.prevRootX = o.rootX;

    // 소품 위상
    if (full && this.props) {
      o.sparkPhase = this.tier === 'full' ? t * 0.8 : 0.15;
      o.tearPhase = (t * 0.6) % 1;
      o.boilSeed = this.style === 'B' && this.tier === 'full' ? 1 + (Math.floor(t * 8) % 40) : 1;
    } else {
      o.sparkPhase = 0.15;
      o.tearPhase = 0.45;
      o.notesPhase = 0.3;
      o.dotsPhase = 0.25;
      o.boilSeed = 1;
    }
    if (!this.props) {
      o.spark = 0;
      o.notes = 0;
      o.think = 0;
      o.tear = 0;
    }
  }

  private render(_force: boolean) {
    this.stats.renders++;
    this.onRender(geometry(this.out, { haloColor: HALO_COLOR[this.state] }));
  }
}

export { staticParams } from './params';
