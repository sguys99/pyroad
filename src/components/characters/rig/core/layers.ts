/** 캐릭터들이 함께 쓰는 절차적 레이어 (점프·말하기). DOM·React 없음 */
import { Follower, hopShape } from './math';

/**
 * 점프 (스쿼시 & 스트레치). "이번 점프는 끝까지"가 기본이라 공중에서 다른 상태가 와도 착지한 뒤 멈춘다 (P0-07 §4.4).
 */
export class HopLayer {
  active = false;
  phase = 0;
  cycles = 0;
  max = Infinity;
  stopping = false;
  H = 16;
  /** 마지막 step에서 착지했나 (털썩 같은 착지 반응용) */
  landed = false;

  start(H: number, max: number) {
    this.max = max;
    this.stopping = false;
    if (!this.active) {
      this.active = true;
      this.phase = 0;
      this.H = H;
    }
    this.cycles = 0;
  }

  /** 공중이면 이번 점프만 마치고 멈춤 */
  stop() {
    if (this.active) this.stopping = true;
  }

  cancel() {
    this.active = false;
    this.phase = 0;
    this.stopping = false;
  }

  /** 한 번의 길이(초): 높을수록 조금 길게 */
  static period(H: number) {
    return 0.38 + 0.015 * H;
  }

  step(
    dt: number,
    nextH: number,
  ): { y: number; sx: number; sy: number; phase: number } | null {
    this.landed = false;
    if (!this.active) return null;
    this.phase += dt / HopLayer.period(this.H);
    if (this.phase >= 1) {
      this.phase -= 1;
      this.cycles++;
      this.landed = true;
      if (this.stopping || this.cycles >= this.max || nextH <= 0) {
        this.active = false;
        this.phase = 0;
        return null;
      }
      this.H = nextH;
    }
    const s = hopShape(this.phase, this.H);
    return { ...s, phase: this.phase };
  }
}

/**
 * 말하기: 음절 리듬으로 입을 열고 닫는다 (어떤 표정 위에도 얹히는 레이어).
 * speed 1 = 음절 0.09~0.21초, 단어 사이 0.12~0.38초
 */
export class TalkLayer {
  private sylLeft = 0;
  private open = 0;
  private dur = 0;
  private elapsed = 0;
  emph = 0;
  private flap = new Follower(0, 1400, 55);

  reset() {
    this.flap.reset(0);
    this.elapsed = 0;
    this.dur = 0;
  }

  /** 입 벌림 0..1 */
  step(dt: number, rng: () => number, speed: number): number {
    this.elapsed += dt * speed;
    if (this.elapsed >= this.dur) {
      this.elapsed = 0;
      if (this.sylLeft > 0) {
        this.sylLeft--;
        this.dur = 0.09 + rng() * 0.12;
        this.open = 0.35 + rng() * 0.6;
      } else {
        this.dur = 0.12 + rng() * 0.26;
        this.open = 0.03;
        this.sylLeft = 2 + Math.floor(rng() * 4);
        this.emph = 1;
      }
    }
    const syl = this.elapsed < this.dur * 0.55 ? this.open : 0.06;
    this.emph = Math.max(0, this.emph - dt * 3);
    return this.flap.step(syl, dt);
  }
}
