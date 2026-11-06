// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';

const trackMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics/track', () => ({ track: trackMock }));

import {
  MotionTierProvider,
  useMotionTier,
  useSamplingPause,
  type MotionTierState,
} from '../MotionTierProvider';
import { MEASURED_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '../browser';

const html = document.documentElement;
let systemReduced = false;

/** rAF를 손으로 돌린다: frames(n, dt)가 dt 간격으로 n프레임 */
let rafQueue: Array<(t: number) => void> = [];
let now = 0;
function frames(n: number, dt: number) {
  for (let i = 0; i < n; i++) {
    now += dt;
    const q = rafQueue;
    rafQueue = [];
    act(() => q.forEach((cb) => cb(now)));
  }
}

let latest: MotionTierState | null = null;
function Probe() {
  latest = useMotionTier();
  return null;
}

beforeEach(() => {
  localStorage.clear();
  delete html.dataset.motion;
  delete html.dataset.reduced;
  systemReduced = false;
  rafQueue = [];
  now = 0;
  latest = null;
  trackMock.mockClear();
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') && systemReduced,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    value: 8,
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MotionTierProvider (감지 모드, P2-15)', () => {
  it('마운트 뒤 <html data-motion data-reduced>를 쓰고, 첫 렌더는 full(서버와 같음)', () => {
    const seen: string[] = [];
    function Record() {
      const { tier, source } = useMotionTier();
      seen.push(`${tier}/${source}`);
      return null;
    }
    render(
      <MotionTierProvider>
        <Record />
      </MotionTierProvider>,
    );
    expect(seen[0]).toBe('full/default');
    expect(html.dataset.motion).toBe('full');
    expect(html.dataset.reduced).toBe('false');
    expect(latest).toBeNull();
  });

  it('기기 사본 설정을 읽어 적용 (로그인 부트 동기화가 써 둔 값)', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ tier: 'lite', reduced: 'on' }),
    );
    render(
      <MotionTierProvider>
        <Probe />
      </MotionTierProvider>,
    );
    expect(latest).toMatchObject({
      tier: 'lite',
      reduced: true,
      source: 'user',
    });
    expect(latest?.budget.particles).toBe(0);
    expect(html.dataset).toMatchObject({ motion: 'lite', reduced: 'true' });
  });

  it('사용자가 바꾸면 즉시 적용 + 기기 사본 + 익명 이벤트(cause: user)', () => {
    render(
      <MotionTierProvider>
        <Probe />
      </MotionTierProvider>,
    );
    act(() => latest!.setSettings({ tier: 'minimal', reduced: 'system' }));
    expect(html.dataset.motion).toBe('minimal');
    expect(latest?.budget).toMatchObject({ particles: 0, bgm: false });
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toEqual({
      tier: 'minimal',
      reduced: 'system',
    });
    expect(trackMock).toHaveBeenCalledWith(
      'motion_tier_change',
      expect.objectContaining({
        from: 'full',
        to: 'minimal',
        cause: 'user',
        setting: 'minimal',
        reduced: 'system',
      }),
    );
  });

  it('서버 값 반영(adoptSettings)은 이벤트를 보내지 않음', () => {
    render(
      <MotionTierProvider>
        <Probe />
      </MotionTierProvider>,
    );
    act(() => latest!.adoptSettings({ tier: 'lite', reduced: 'off' }));
    expect(latest?.tier).toBe('lite');
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('실측: 계속 느리면 한 단계씩 내리고, 저장하고, 이벤트(cause: measured)를 보낸다. minimal이면 rAF를 멈춤', () => {
    render(
      <MotionTierProvider>
        <Probe />
      </MotionTierProvider>,
    );
    frames(80, 100); // 10fps 8초
    expect(latest?.tier).toBe('minimal');
    expect(latest?.source).toBe('measured');
    expect(html.dataset.motion).toBe('minimal');
    expect(
      JSON.parse(localStorage.getItem(MEASURED_STORAGE_KEY)!).measured,
    ).toBe('minimal');
    const calls = trackMock.mock.calls.filter(
      ([, p]) => p.cause === 'measured',
    );
    expect(calls.map(([, p]) => `${p.from}>${p.to}`)).toEqual([
      'full>lite',
      'lite>minimal',
    ]);
    expect(calls[0][1].elapsed_s).toBeGreaterThan(0);
    expect(rafQueue).toHaveLength(0);
  });

  it('pauseSampling 중에는 내려가지 않고 (겹친 호출은 횟수로), 모두 풀리면 다시 잰다', () => {
    function Heavy({ active }: { active: boolean }) {
      useSamplingPause(active);
      return null;
    }
    const { rerender } = render(
      <MotionTierProvider>
        <Probe />
        <Heavy active />
        <Heavy active />
      </MotionTierProvider>,
    );
    frames(60, 100);
    expect(latest?.tier).toBe('full');
    rerender(
      <MotionTierProvider>
        <Probe />
        <Heavy active={false} />
        <Heavy active />
      </MotionTierProvider>,
    );
    frames(60, 100);
    expect(latest?.tier).toBe('full');
    rerender(
      <MotionTierProvider>
        <Probe />
        <Heavy active={false} />
        <Heavy active={false} />
      </MotionTierProvider>,
    );
    frames(40, 100);
    expect(latest?.tier).not.toBe('full');
  });

  it('동작 줄이기(움직임 0)면 실측하지 않음', () => {
    systemReduced = true;
    render(
      <MotionTierProvider>
        <Probe />
      </MotionTierProvider>,
    );
    expect(latest?.reduced).toBe(true);
    expect(html.dataset.reduced).toBe('true');
    expect(rafQueue).toHaveLength(0);
  });

  it('다시 재 보기(remeasure): 지난 측정을 지우고 정적 추정부터', () => {
    render(
      <MotionTierProvider>
        <Probe />
      </MotionTierProvider>,
    );
    frames(40, 100);
    expect(latest?.detected).not.toBe('full');
    act(() => latest!.remeasure());
    expect(latest?.detected).toBe('full');
    expect(localStorage.getItem(MEASURED_STORAGE_KEY)).toBeNull();
    expect(rafQueue.length).toBeGreaterThan(0);
  });
});

describe('고정 모드·Provider 없음', () => {
  it('tier·reduced를 주면 그 값만 (감지·<html> 속성 없음)', () => {
    render(
      <MotionTierProvider tier="lite" reduced="off">
        <Probe />
      </MotionTierProvider>,
    );
    expect(latest).toMatchObject({ tier: 'lite', reduced: false });
    expect(html.dataset.motion).toBeUndefined();
    expect(rafQueue).toHaveLength(0);
  });

  it('Provider가 없으면 full + 기기 설정', () => {
    systemReduced = true;
    function Check() {
      const state = useMotionTier();
      useEffect(() => {
        latest = state;
      });
      return null;
    }
    render(<Check />);
    expect(latest).toMatchObject({ tier: 'full', reduced: true });
    expect(latest?.budget.particles).toBe(0);
  });
});
