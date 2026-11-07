import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONCEPT,
  EASE,
  EASING,
  JELLY_BY_CONCEPT,
  SPRINGS,
  framerSpring,
  jelly,
  sampleSpring,
  springOrFade,
  springTiming,
  tierDuration,
} from '../tokens';
import { MOTION_BUDGETS, motionBudget } from '../tier';

describe('모션 토큰 (무드보드 §6, P2-09와 공유)', () => {
  it('스프링 7종은 리그와 같은 값 (질량 1)', () => {
    expect(SPRINGS).toEqual({
      face: { k: 420, c: 34 },
      body: { k: 200, c: 19 },
      envelope: { k: 60, c: 15 },
      prop: { k: 170, c: 13 },
      jellyA: { k: 520, c: 10 },
      jellyAB: { k: 500, c: 16 },
      jellyB: { k: 480, c: 24 },
    });
  });

  it('정착 시간이 무드보드 표와 같다 (±15ms)', () => {
    const expected = {
      face: 418,
      body: 743,
      envelope: 1160,
      prop: 1027,
      jellyA: 1360,
      jellyAB: 852,
      jellyB: 602,
    };
    for (const [name, ms] of Object.entries(expected)) {
      const { durationMs } = sampleSpring(
        SPRINGS[name as keyof typeof SPRINGS],
      );
      expect(Math.abs(durationMs - ms)).toBeLessThanOrEqual(15);
    }
  });

  it('Framer 스프링 변환: stiffness=k, damping=c, mass=1', () => {
    expect(framerSpring('prop', { delay: 0.2 })).toEqual({
      type: 'spring',
      stiffness: 170,
      damping: 13,
      mass: 1,
      delay: 0.2,
    });
  });

  it('CSS linear() easing: 0에서 1로, 길이는 정착 시간', () => {
    const t = springTiming('body');
    expect(t.easing.startsWith('linear(0, ')).toBe(true);
    expect(t.easing.endsWith(', 1)')).toBe(true);
    expect(t.duration).toBe(sampleSpring(SPRINGS.body).durationMs);
  });

  it('easing 문자열 ↔ Framer 배열', () => {
    expect(EASING.out).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(EASE.out).toEqual([0.22, 1, 0.36, 1]);
    expect(EASE.backOut).toEqual([0.34, 1.56, 0.64, 1]);
  });

  it('시안별 젤리 표와 기본값', () => {
    expect(JELLY_BY_CONCEPT).toEqual({
      a: 'jellyA',
      b: 'jellyB',
      ab: 'jellyAB',
    });
    // 최종 시안 B (§12-Q31, P2-09)
    expect(DEFAULT_CONCEPT).toBe('b');
    expect(jelly()).toBe('jellyB');
  });

  it('단계에 맞는 길이·전환: lite 70%, minimal 페이드, reduced 즉시', () => {
    expect(tierDuration(1000, MOTION_BUDGETS.lite)).toBe(700);
    expect(tierDuration(1000, motionBudget('full', true))).toBe(0);
    expect(springOrFade('body', MOTION_BUDGETS.full)).toMatchObject({
      type: 'spring',
      stiffness: 200,
    });
    expect(springOrFade('body', MOTION_BUDGETS.minimal)).toMatchObject({
      duration: 0.15,
    });
    expect(springOrFade('body', motionBudget('lite', true))).toMatchObject({
      duration: 0,
    });
  });
});
