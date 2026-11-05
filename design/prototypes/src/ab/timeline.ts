// 시그니처 모션 타임라인 (P2-05): 한 장면의 모든 비트를 한 시계에 올린다
// - 움직임은 WAAPI(transform·opacity)로 미리 만들어 두고(delay = 시작 시각) 같이 재생·일시정지·되감기(seek)
// - 상태 바꾸기(파이뱀 표정, 보이기, 숫자 카운트업)는 cue/tick으로: seek하면 그 시각의 상태를 다시 계산
// - 리뷰용 타임라인 막대는 beats(이름·시작·길이·easing)로 그린다 (P2-09 모션 토큰 근거)
// 앱(P2-15 시퀀서)과 같은 원칙: 단계별 길이·스프링은 motionView에 맞춰 builder가 고르고, 동작 줄이기에서도 시퀀스는 진행된다
import { springTiming } from '../shared/motion';
import { EASING, type SpringName } from '../shared/tokens';

export interface MotionView {
  tier: 'full' | 'lite' | 'minimal';
  reduced: boolean;
}
export interface Beat {
  label: string;
  start: number;
  dur: number;
  ease: string;
}
type Setter = (v: unknown) => void;

export class Timeline {
  readonly m: MotionView;
  private anims: Animation[] = [];
  private cues: { at: number; key: string; val: unknown }[] = [];
  private setters = new Map<string, { set: Setter; init: unknown; last?: unknown }>();
  private ticks: { start: number; dur: number; fn: (p: number) => void; last?: number }[] = [];
  readonly beats: Beat[] = [];
  duration = 0;
  private raf = 0;
  private t0 = 0;
  private t = 0;
  playing = false;
  onFrame?: (t: number) => void;
  onFinish?: () => void;

  constructor(m: MotionView) {
    this.m = m;
  }

  /** lite는 일회성 이펙트 70% 길이 (P0-16 §4.5) */
  d(ms: number) {
    return this.m.tier === 'lite' ? Math.round(ms * 0.7) : ms;
  }
  get moving() {
    return !this.m.reduced && this.m.tier !== 'minimal';
  }
  /** 스프링 또는 easing 이름으로 timing. 스프링 길이는 스프링이 정한다(lite에서도 줄이지 않고, lite용 다른 스프링을 고른다) */
  timing(ease: SpringName | keyof typeof EASING | 'linear' | 'steps3', dur?: number): { easing: string; duration: number } {
    if (ease === 'linear') return { easing: 'linear', duration: dur ?? 200 };
    if (ease === 'steps3') return { easing: 'steps(3)', duration: dur ?? 120 };
    if (ease in EASING) return { easing: EASING[ease as keyof typeof EASING], duration: dur ?? 220 };
    return springTiming(ease as SpringName);
  }

  beat(label: string, start: number, dur: number, ease: string) {
    const b = this.beats.find((x) => x.label === label);
    if (b) {
      const end = Math.max(b.start + b.dur, start + dur);
      b.start = Math.min(b.start, start);
      b.dur = end - b.start;
    } else this.beats.push({ label, start, dur, ease });
    this.duration = Math.max(this.duration, start + dur);
  }

  /** WAAPI 애니메이션 하나 (시작 전에는 첫 프레임, 끝난 뒤에는 마지막 프레임 유지) */
  add(
    el: Element | null | undefined,
    kf: Keyframe[],
    o: { at: number; ease: SpringName | keyof typeof EASING | 'linear' | 'steps3'; dur?: number; label?: string; fill?: FillMode },
  ) {
    const tm = this.timing(o.ease, o.dur);
    const dur = o.dur ?? tm.duration;
    if (o.label) this.beat(o.label, o.at, dur, String(o.ease));
    this.duration = Math.max(this.duration, o.at + dur);
    if (!el) return;
    const a = el.animate(kf, { duration: dur, delay: o.at, easing: tm.easing, fill: o.fill ?? 'both' });
    a.pause();
    this.anims.push(a);
  }

  /** 상태 키 등록: seek하면 시각에 맞는 값으로 다시 맞춘다 */
  state<T>(key: string, init: T, set: (v: T) => void) {
    this.setters.set(key, { set: set as Setter, init });
  }
  at(time: number, key: string, val: unknown, label?: string) {
    this.cues.push({ at: time, key, val });
    if (label) this.beat(label, time, 0, 'cue');
    this.duration = Math.max(this.duration, time);
  }
  /** 보이기 (data-on). 보이기 전에는 visibility:hidden (CSS [data-beat]) */
  show(el: Element | null | undefined, time: number, key: string) {
    if (!el) return;
    this.state(key, false, (v) => (v ? el.setAttribute('data-on', '') : el.removeAttribute('data-on')));
    this.at(time, key, true);
  }
  tick(start: number, dur: number, fn: (p: number) => void, label?: string) {
    this.ticks.push({ start, dur, fn });
    if (label) this.beat(label, start, dur, 'linear');
    this.duration = Math.max(this.duration, start + dur);
  }

  private apply(t: number) {
    const vals = new Map<string, unknown>();
    for (const [k, s] of this.setters) vals.set(k, s.init);
    for (const c of this.cues) if (c.at <= t) vals.set(c.key, c.val);
    for (const [k, v] of vals) {
      const s = this.setters.get(k)!;
      if (s.last !== v || s.last === undefined) {
        s.last = v;
        s.set(v);
      }
    }
    for (const k of this.ticks) {
      const p = k.dur <= 0 ? (t >= k.start ? 1 : 0) : Math.max(0, Math.min(1, (t - k.start) / k.dur));
      if (p !== k.last) {
        k.last = p;
        k.fn(p);
      }
    }
    this.onFrame?.(t);
  }

  seek(t: number) {
    this.stop();
    this.t = Math.max(0, Math.min(t, this.duration));
    for (const a of this.anims) {
      a.pause();
      a.currentTime = this.t;
    }
    this.apply(this.t);
  }
  play(from = 0) {
    this.seek(from);
    this.playing = true;
    this.t0 = performance.now() - this.t;
    for (const a of this.anims) a.play();
    const loop = () => {
      this.t = performance.now() - this.t0;
      if (this.t >= this.duration) {
        this.seek(this.duration);
        this.onFinish?.();
        return;
      }
      this.apply(this.t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  pause() {
    if (!this.playing) return;
    this.seek(performance.now() - this.t0);
  }
  stop() {
    cancelAnimationFrame(this.raf);
    this.playing = false;
    for (const a of this.anims) a.pause();
  }
  get time() {
    return this.t;
  }
  /** 모든 애니메이션을 지우고 상태를 처음 값으로 (다시 만들 때) */
  dispose(resetState = true) {
    this.stop();
    for (const a of this.anims) a.cancel();
    this.anims = [];
    if (resetState) for (const s of this.setters.values()) s.set(s.init);
  }
}
