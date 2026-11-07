// 시그니처 모션 타임라인 (P2-05). 장면 = 비트(WAAPI 애니메이션) + 큐(상태 바꾸기·숫자 올리기)
// - 재생: 모든 WAAPI를 처음에 delay를 붙여 한꺼번에 만든다 → 컴포지터가 돌리고, 메인 스레드는 큐만 본다
// - 일시정지·되감기(seek): 모든 애니메이션을 pause + currentTime = t, 큐는 처음 상태로 되돌린 뒤 t까지 다시 적용
//   → 리뷰어가 타임라인을 눌러 원하는 프레임에서 멈출 수 있고, 스크린샷도 같은 방법으로 찍는다
// - 단계(full/lite/minimal/동작 줄이기)는 장면을 만들 때 고른다 (build(m)). 도구 막대를 따르거나 장면 안 토글로 덮어씀

export type Tier = 'full' | 'lite' | 'minimal';
export interface M {
  tier: Tier;
  reduced: boolean;
}

/** 타임라인 막대에 그리는 비트 (리뷰·P2-09 모션 토큰용 기록) */
export interface BeatInfo {
  id: string;
  label: string;
  start: number;
  dur: number;
  ease: string; // 스프링 이름이나 easing 토큰 이름
  lane?: number;
}

/** 큐: t가 at을 지나면 apply(p). dur가 있으면 p가 0→1로 진행(숫자 올리기 등), 없으면 p=1 한 번 */
export interface Cue {
  at: number;
  dur?: number;
  apply: (p: number) => void;
}

export interface SceneSpec {
  total: number;
  beats: BeatInfo[];
  /** 처음 상태로 되돌리기 (다시 보기·되감기 전에) */
  reset: () => void;
  /** WAAPI 애니메이션 만들기. 모든 애니메이션은 delay = 비트 시작 시각 */
  animate: () => Animation[];
  cues: Cue[];
}

export class Scene {
  private anims: Animation[] = [];
  private raf = 0;
  private t0 = 0;
  private last = new Map<Cue, number>();
  t = 0;
  playing = false;
  onTick?: (t: number) => void;
  onEnd?: () => void;
  constructor(public spec: SceneSpec) {}

  play() {
    this.stop();
    this.spec.reset();
    this.last.clear();
    this.anims = this.spec.animate();
    this.t0 = performance.now();
    this.t = 0;
    this.playing = true;
    this.applyCues(0);
    const loop = (now: number) => {
      this.t = now - this.t0;
      this.applyCues(this.t);
      this.onTick?.(this.t);
      if (this.t >= this.spec.total) {
        this.playing = false;
        this.raf = 0;
        this.onEnd?.();
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.anims.forEach((a) => a.pause());
  }

  resume() {
    if (this.playing || this.t >= this.spec.total) return;
    this.anims.forEach((a) => a.play());
    this.t0 = performance.now() - this.t;
    this.playing = true;
    const loop = (now: number) => {
      this.t = now - this.t0;
      this.applyCues(this.t);
      this.onTick?.(this.t);
      if (this.t >= this.spec.total) {
        this.playing = false;
        this.onEnd?.();
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** t(ms)에서 멈춘 프레임 보기 */
  seek(t: number) {
    if (!this.anims.length) {
      this.spec.reset();
      this.anims = this.spec.animate();
    }
    this.pause();
    this.playing = false;
    this.t = Math.max(0, Math.min(t, this.spec.total));
    this.anims.forEach((a) => {
      a.pause();
      a.currentTime = this.t;
    });
    this.spec.reset();
    this.last.clear();
    this.applyCues(this.t);
    this.onTick?.(this.t);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.playing = false;
    this.anims.forEach((a) => a.cancel());
    this.anims = [];
  }

  private applyCues(t: number) {
    for (const c of this.spec.cues) {
      if (t < c.at) continue;
      const p = c.dur ? Math.min(1, (t - c.at) / c.dur) : 1;
      if (this.last.get(c) === p) continue;
      this.last.set(c, p);
      c.apply(p);
    }
  }
}

/** 비트 하나에 해당하는 애니메이션 만들기 도우미: delay = at, fill backwards(시작 전 첫 프레임 유지) + forwards */
export function anim(el: Element | null | undefined, kf: Keyframe[], at: number, dur: number, easing = 'linear', fill: FillMode = 'both'): Animation | null {
  if (!el) return null;
  return el.animate(kf, { delay: at, duration: Math.max(1, dur), easing, fill });
}

/** 3차 감속 (숫자 올리기) */
export const easeOut3 = (p: number) => 1 - Math.pow(1 - p, 3);

/** 동작 줄이기·minimal: at 시각에 from → to로 즉시 바뀜 (움직임 없음). 시작 전에는 from 유지 */
export function snap(el: Element | null | undefined, at: number, to: Keyframe, from: Keyframe = { opacity: 0 }): Animation | null {
  return anim(el, [from, to], at, 1, 'linear');
}

/** minimal: 150ms 페이드 */
export function fade(el: Element | null | undefined, at: number, to: Keyframe = { opacity: 1 }, from: Keyframe = { opacity: 0 }): Animation | null {
  return anim(el, [from, to], at, 150, 'linear');
}
