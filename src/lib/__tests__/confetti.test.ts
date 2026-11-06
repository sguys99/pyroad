// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';

const confettiMock = vi.fn<(options?: unknown) => null>(() => null);
vi.mock('canvas-confetti', () => ({ default: confettiMock }));

import { createConfettiBudget, fireConfetti } from '../confetti';

describe('fireConfetti', () => {
  it('항상 disableForReducedMotion: true로 발사한다 (B33)', async () => {
    fireConfetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });

    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
    expect(confettiMock).toHaveBeenCalledWith({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.6 },
      disableForReducedMotion: true,
    });
  });

  it('호출하는 쪽이 옵션을 넘겨도 reduced-motion 존중은 끌 수 없다', async () => {
    confettiMock.mockClear();
    // 타입으로 막혀 있지만 런타임에서도 덮어쓰지 못하는지 확인
    fireConfetti({
      particleCount: 10,
      disableForReducedMotion: false,
    } as Parameters<typeof fireConfetti>[0]);

    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
    expect(confettiMock.mock.calls[0][0]).toMatchObject({
      disableForReducedMotion: true,
    });
  });
});

describe('fireConfetti: 연출 단계·reduced-motion (P1-10)', () => {
  it('scale(연출 단계 배율)을 곱해 쏘고, 0이면 쏘지 않는다', async () => {
    confettiMock.mockClear();
    expect(fireConfetti({ particleCount: 100 }, { scale: 0.3 })).toBe(30);
    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
    expect(confettiMock.mock.calls[0][0]).toMatchObject({ particleCount: 30 });

    expect(fireConfetti({ particleCount: 100 }, { scale: 0 })).toBe(0);
    await Promise.resolve();
    expect(confettiMock).toHaveBeenCalledTimes(1);
  });

  it('prefers-reduced-motion이면 모듈을 부르지도 않는다', async () => {
    confettiMock.mockClear();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
    })) as unknown as typeof window.matchMedia;
    try {
      expect(fireConfetti({ particleCount: 50 })).toBe(0);
      await Promise.resolve();
      expect(confettiMock).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('fireConfetti: <html data-motion data-reduced> (P2-15)', () => {
  const html = document.documentElement;
  afterEach(() => {
    delete html.dataset.motion;
    delete html.dataset.reduced;
    vi.useRealTimers();
  });

  it('data-motion=lite면 배율을 빠뜨려도 30%를 넘지 않고, minimal이면 쏘지 않는다', async () => {
    // 앞 테스트의 파티클이 상한에 남지 않게 시간을 넘김
    vi.useFakeTimers({ now: Date.now(), toFake: ['performance'] });
    vi.advanceTimersByTime(5000);
    confettiMock.mockClear();
    html.dataset.motion = 'lite';
    expect(fireConfetti({ particleCount: 100 })).toBe(30);
    expect(fireConfetti({ particleCount: 100 }, { scale: 0.1 })).toBe(10);
    html.dataset.motion = 'minimal';
    expect(fireConfetti({ particleCount: 100 })).toBe(0);
  });

  it('data-reduced=true(사용자 설정 "켜기")면 기기 설정과 상관없이 쏘지 않는다', async () => {
    confettiMock.mockClear();
    html.dataset.reduced = 'true';
    expect(fireConfetti({ particleCount: 50 })).toBe(0);
    await Promise.resolve();
    expect(confettiMock).not.toHaveBeenCalled();
  });

  it('data-reduced=false(사용자 설정 "끄기")면 기기가 동작 줄이기여도 쏜다', async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ['performance'] });
    vi.advanceTimersByTime(10_000);
    confettiMock.mockClear();
    html.dataset.reduced = 'false';
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
    })) as unknown as typeof window.matchMedia;
    try {
      expect(fireConfetti({ particleCount: 40 })).toBe(40);
      await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
      expect(confettiMock.mock.calls[0][0]).toMatchObject({
        disableForReducedMotion: false,
      });
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('createConfettiBudget (연속 축하에서 컨페티가 겹쳐 과해지지 않게, P1-10)', () => {
  it('상한 안에서는 요청한 만큼', () => {
    const budget = createConfettiBudget(220, 1600);
    expect(budget.take(100, 0)).toBe(100);
    expect(budget.take(100, 0)).toBe(100);
  });

  it('상한을 넘는 만큼은 줄이고, 남은 자리가 너무 적으면 쏘지 않는다', () => {
    const budget = createConfettiBudget(220, 1600);
    budget.take(180, 0);
    expect(budget.take(100, 0)).toBe(40);
    expect(budget.take(100, 0)).toBe(0);
  });

  it('떠 있는 파티클은 시간이 지나면 줄어든다 (선형)', () => {
    const budget = createConfettiBudget(220, 1600);
    budget.take(200, 0);
    expect(budget.live(800)).toBeCloseTo(100);
    expect(budget.take(200, 800)).toBe(120);
    expect(budget.live(5000)).toBe(0);
    expect(budget.take(200, 5000)).toBe(200);
  });

  it('reset 하면 비운다', () => {
    const budget = createConfettiBudget(220, 1600);
    budget.take(220, 0);
    budget.reset();
    expect(budget.take(50, 0)).toBe(50);
  });
});
