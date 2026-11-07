import { describe, it, expect } from 'vitest';
import { FrameSampler, estimateRefresh, staticGuess } from '../detect';
import type { MotionTier } from '../tier';

/**
 * 합성 프레임 기록으로 판정 규칙 검증 (P0-16 스파이크 테스트 16개 이식).
 * 헤드리스는 rAF가 항상 60Hz라 30Hz·120Hz·끊김은 여기서만 확인한다.
 */

/** gen(t) → 다음 프레임 간격(ms). seconds 동안 넣고 샘플러 반환 */
function run(
  initial: MotionTier,
  seconds: number,
  gen: (t: number, i: number, tier: MotionTier) => number,
) {
  const s = new FrameSampler(initial);
  let t = 0;
  let i = 0;
  while (t < seconds * 1000) {
    const dt = gen(t, i++, s.tier);
    t += dt;
    s.push(t, dt);
  }
  return s;
}

const rng = (seed: number) => () =>
  (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

/** 60Hz에서 p 확률로 프레임을 놓침(1~2 vsync) */
const janky = (p: number, seed = 1) => {
  const r = rng(seed);
  return () => (r() < p ? 16.67 * (2 + Math.floor(r() * 2)) : 16.67);
};

describe('FrameSampler: 실측으로 하향만 (P0-16 §4.2)', () => {
  it('60Hz 매끄러움 → full 유지', () => {
    const s = run('full', 20, () => 16.67);
    expect(s.tier).toBe('full');
    expect(s.events).toHaveLength(0);
  });

  it('120Hz 화면 → full, 120Hz에서 60fps로 떨어져도 full (목표 하한 60fps)', () => {
    expect(run('full', 10, () => 8.33).tier).toBe('full');
    expect(run('full', 10, (t) => (t < 1000 ? 8.33 : 16.67)).tier).toBe('full');
  });

  it('계속 끊김(프레임 45% 놓침) → 3초 안에 lite', () => {
    const s = run('full', 10, janky(0.45));
    expect(s.events[0]?.to).toBe('lite');
    expect(s.events[0].t).toBeLessThanOrEqual(3500);
  });

  it('긴 작업 한 번(400ms, Pyodide 로딩 흉내) → full 유지', () => {
    let done = false;
    const s = run('full', 20, (t) =>
      t > 2000 && !done ? ((done = true), 400) : 16.67,
    );
    expect(s.tier).toBe('full');
  });

  it('긴 작업 3번(1초 간격, 150ms) → full 유지', () => {
    const hits = new Set<number>();
    const s = run('full', 20, (t) => {
      const k = Math.floor(t / 1000);
      if (k >= 5 && k <= 7 && !hits.has(k)) {
        hits.add(k);
        return 150;
      }
      return 16.67;
    });
    expect(s.tier).toBe('full');
  });

  it('4초 중 1초만 끊김이 반복 → 바꾸지 않음 (깜빡임 방지)', () => {
    const j = janky(0.6, 3);
    const s = run('full', 40, (t) =>
      Math.floor(t / 1000) % 4 === 0 ? j() : 16.67,
    );
    expect(s.tier).toBe('full');
  });

  it('세션 중간부터 무거워짐(10초 뒤) → 4초 안팎에 lite, 그 뒤 매끄러워도 다시 올리지 않음', () => {
    const j = janky(0.5, 7);
    // lite로 내리면 부하가 줄어 매끄러워지는 장면
    const s = run('full', 40, (t, _i, tier) =>
      t > 10000 && tier === 'full' ? j() : 16.67,
    );
    expect(s.tier).toBe('lite');
    expect(s.events[0].t).toBeGreaterThan(10000);
    expect(s.events[0].t).toBeLessThan(15500);
    expect(s.events).toHaveLength(1);
  });

  it('아주 느림(10fps) → full → lite → minimal 연쇄', () => {
    const s = run('full', 20, () => 100);
    expect(s.events.map((e) => e.to)).toEqual(['lite', 'minimal']);
    expect(s.events[1].t).toBeLessThan(12000);
  });

  it('고른 30Hz (iOS 저전력 모드) → lite, 그 뒤 minimal로는 안 내려감', () => {
    const s = run('full', 20, () => 33.33);
    expect(s.tier).toBe('lite');
    expect(s.refreshMs.toFixed(1)).toBe('33.3');
  });

  it('탭이 숨겨졌다 돌아옴(5초 공백) → 무시', () => {
    let gap = false;
    const s = run('full', 20, (t) =>
      t > 3000 && !gap ? ((gap = true), 5000) : 16.67,
    );
    expect(s.tier).toBe('full');
  });

  it('pause 중 끊김은 세지 않음 (pauseSampling: Pyodide 로딩)', () => {
    const s = new FrameSampler('full');
    const j = janky(0.7, 9);
    let t = 0;
    s.pause();
    expect(s.isPaused).toBe(true);
    while (t < 8000) {
      const dt = j();
      t += dt;
      s.push(t, dt);
    }
    s.resume();
    while (t < 16000) {
      t += 16.67;
      s.push(t, 16.67);
    }
    expect(s.tier).toBe('full');
  });

  it('처음부터 느린 기기(불규칙 15fps) → lite(불규칙 25fps)도 끊기면 minimal까지 (주사율 오추정 회귀)', () => {
    const r = rng(11);
    // full: 50~83ms 불규칙, lite: 33~50ms 불규칙 (60Hz 기준 40~60% 놓침), minimal: 16.7ms
    const s = run('full', 20, (_t, _i, tier) =>
      tier === 'full' ? 50 + r() * 33 : tier === 'lite' ? 33 + r() * 17 : 16.67,
    );
    expect(s.tier).toBe('minimal');
    expect(s.refreshMs.toFixed(1)).toBe('16.7');
  });

  it('바뀔 때마다 onChange로 알림 (분석·저장용)', () => {
    const seen: string[] = [];
    const s = new FrameSampler('full', {}, (e) =>
      seen.push(`${e.from}>${e.to}`),
    );
    let t = 0;
    while (t < 20000) {
      t += 100;
      s.push(t, 100);
    }
    expect(seen).toEqual(['full>lite', 'lite>minimal']);
  });
});

describe('estimateRefresh: 화면 주사율 추정', () => {
  it('표준 주사율', () => {
    expect(estimateRefresh(Array(60).fill(16.6)).toFixed(1)).toBe('16.7');
    expect(estimateRefresh(Array(60).fill(8.4)).toFixed(1)).toBe('8.3');
    const mix = [...Array(40).fill(16.7), ...Array(20).fill(50)];
    expect(estimateRefresh(mix).toFixed(1)).toBe('16.7');
  });

  it('고르지 않은 33ms 근처(과부하) → 30Hz로 착각하지 않음', () => {
    const r = rng(5);
    expect(
      estimateRefresh(Array.from({ length: 60 }, () => 30 + r() * 40)).toFixed(
        1,
      ),
    ).toBe('16.7');
  });
});

describe('staticGuess: 정적 추정 규칙', () => {
  it('확실히 약한 기기만 내림, reduced는 별도 축', () => {
    expect(staticGuess({ reducedMotion: false }).tier).toBe('full');
    expect(staticGuess({ reducedMotion: false, deviceMemory: 1 }).tier).toBe(
      'minimal',
    );
    expect(staticGuess({ reducedMotion: false, deviceMemory: 2 }).tier).toBe(
      'lite',
    );
    expect(
      staticGuess({
        reducedMotion: false,
        deviceMemory: 4,
        hardwareConcurrency: 2,
      }).tier,
    ).toBe('lite');
    expect(
      staticGuess({
        reducedMotion: false,
        hardwareConcurrency: 4,
        webkit: true,
      }).tier,
    ).toBe('full');
    expect(
      staticGuess({
        reducedMotion: false,
        hardwareConcurrency: 2,
        webkit: true,
      }).tier,
    ).toBe('full');
    expect(staticGuess({ reducedMotion: false, saveData: true }).tier).toBe(
      'lite',
    );
    expect(
      staticGuess({ reducedMotion: false, effectiveType: '2g' }).tier,
    ).toBe('lite');
    expect(staticGuess({ reducedMotion: true }).tier).toBe('full');
  });
});
