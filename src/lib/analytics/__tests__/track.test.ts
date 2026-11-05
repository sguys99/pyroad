import { describe, it, expect, vi } from 'vitest';
import {
  SESSION_STORAGE_KEY,
  browserOptedOut,
  createTracker,
  resolveAnalyticsMode,
  track,
  type AnalyticsMode,
  type TrackerDeps,
} from '../track';
import { clientBatchSchema } from '../schema';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

function setup(
  overrides: Partial<TrackerDeps> & { mode?: AnalyticsMode } = {},
) {
  const sent: { body: string; beacon: boolean }[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const storage = memoryStorage();
  const tracker = createTracker({
    mode: 'send',
    transport: { send: (body, { beacon }) => void sent.push({ body, beacon }) },
    storage,
    currentPath: () => '/',
    randomBytes: (n) => new Uint8Array(n).fill(7),
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimer: () => {},
    ...overrides,
  });
  const runTimers = () => timers.splice(0).forEach((t) => t.fn());
  const batches = () => sent.map((s) => JSON.parse(s.body));
  return { tracker, sent, timers, storage, runTimers, batches };
}

describe('resolveAnalyticsMode', () => {
  it('production 은 send, 개발은 console, 테스트·그 밖은 off. env 로 덮어씀', () => {
    expect(resolveAnalyticsMode(undefined, 'production')).toBe('send');
    expect(resolveAnalyticsMode(undefined, 'development')).toBe('console');
    expect(resolveAnalyticsMode(undefined, 'test')).toBe('off');
    expect(resolveAnalyticsMode('send', 'development')).toBe('send');
    expect(resolveAnalyticsMode('off', 'production')).toBe('off');
    expect(resolveAnalyticsMode('bogus', 'production')).toBe('send');
  });
});

describe('createTracker — 큐·배치·flush (P1-17)', () => {
  it('바로 보내지 않고 2초 뒤 한 묶음으로 보냄 (서버 스키마를 통과하는 형태)', () => {
    const { tracker, sent, timers, runTimers, batches } = setup();
    tracker.track('landing_view', {});
    tracker.track('landing_cta_click', { cta: 'header', provider: 'google' });
    expect(sent).toHaveLength(0);
    expect(timers).toHaveLength(1); // 타이머는 하나만
    expect(timers[0].ms).toBe(2000);
    runTimers();
    expect(sent).toHaveLength(1);
    expect(sent[0].beacon).toBe(false);
    const [b] = batches();
    expect(b.events).toEqual([
      { name: 'landing_view', props: {}, path: '/' },
      {
        name: 'landing_cta_click',
        props: { cta: 'header', provider: 'google' },
        path: '/',
      },
    ]);
    expect(clientBatchSchema.safeParse(b).success).toBe(true);
    expect(tracker.pending()).toHaveLength(0);
  });

  it('immediate 는 곧바로 beacon 으로 (OAuth 로 떠나기 전 CTA 클릭)', () => {
    const { tracker, sent, batches } = setup();
    tracker.track('landing_view', {});
    tracker.track(
      'landing_cta_click',
      { cta: 'hero', provider: 'google' },
      { immediate: true },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].beacon).toBe(true);
    expect(batches()[0].events.map((e: { name: string }) => e.name)).toEqual([
      'landing_view',
      'landing_cta_click',
    ]);
  });

  it('10건이 차면 기다리지 않고 보내고, 페이지를 떠날 때 남은 것을 beacon 으로', () => {
    const { tracker, sent, batches } = setup();
    for (let i = 0; i < 12; i++) tracker.track('landing_view', {});
    expect(sent).toHaveLength(1);
    expect(batches()[0].events).toHaveLength(10);
    tracker.flush(true);
    expect(sent).toHaveLength(2);
    expect(sent[1].beacon).toBe(true);
    expect(batches()[1].events).toHaveLength(2);
    tracker.flush(true); // 빈 큐는 보내지 않음
    expect(sent).toHaveLength(2);
  });

  it('쿼리·id 는 경로에서 지움', () => {
    const { tracker, runTimers, batches } = setup({
      currentPath: () => '/quest/6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
    });
    tracker.track('landing_view', {});
    runTimers();
    expect(batches()[0].events[0].path).toBe('/quest/[id]');
  });

  it('보내기가 실패(throw)해도 track 은 던지지 않고 이벤트를 버림', () => {
    const { tracker } = setup({
      transport: {
        send: () => {
          throw new Error('offline');
        },
      },
    });
    expect(() =>
      tracker.track(
        'landing_cta_click',
        { cta: 'hero', provider: 'google' },
        { immediate: true },
      ),
    ).not.toThrow();
    expect(tracker.pending()).toHaveLength(0);
  });

  it('off 모드·추적 거부(DNT/GPC)면 아무것도 쌓지 않음', () => {
    const off = setup({ mode: 'off' });
    off.tracker.track('landing_view', {}, { immediate: true });
    expect(off.sent).toHaveLength(0);
    const optedOut = setup({ optedOut: () => true });
    optedOut.tracker.track('landing_view', {}, { immediate: true });
    expect(optedOut.sent).toHaveLength(0);
    expect(optedOut.tracker.pending()).toHaveLength(0);
  });

  it('console 모드는 보내지 않고 콘솔에만', () => {
    const log = vi.fn();
    const { tracker, sent } = setup({ mode: 'console', log });
    tracker.track(
      'landing_cta_click',
      { cta: 'hero', provider: 'google' },
      { immediate: true },
    );
    expect(sent).toHaveLength(0);
    expect(log).toHaveBeenCalledWith('[analytics]', 'landing_cta_click', {
      cta: 'hero',
      provider: 'google',
    });
  });
});

describe('세션 ID', () => {
  it('128비트 난수 base64url 22자를 sessionStorage 에 두고 같은 탭에서 다시 씀', () => {
    const storage = memoryStorage();
    const a = setup({
      storage,
      randomBytes: (n) => new Uint8Array(n).fill(255),
    });
    const sid = a.tracker.sessionId();
    expect(sid).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(storage.data.get(SESSION_STORAGE_KEY)).toBe(sid);
    const b = setup({ storage, randomBytes: (n) => new Uint8Array(n).fill(1) });
    expect(b.tracker.sessionId()).toBe(sid);
  });

  it('저장된 값이 형식에 안 맞으면 새로 만듦', () => {
    const storage = memoryStorage({ [SESSION_STORAGE_KEY]: 'kid@example.com' });
    const { tracker } = setup({ storage });
    expect(tracker.sessionId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(tracker.sessionId()).not.toBe('kid@example.com');
  });

  it('저장소를 쓸 수 없으면(개인 정보 보호 모드) 페이지 동안만 메모리에', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };
    const { tracker } = setup({ storage: broken });
    const sid = tracker.sessionId();
    expect(sid).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(tracker.sessionId()).toBe(sid);
  });
});

describe('browserOptedOut·track', () => {
  it('GPC 또는 DNT 가 켜져 있으면 거부', () => {
    expect(browserOptedOut({ globalPrivacyControl: true }, {})).toBe(true);
    expect(browserOptedOut({ doNotTrack: '1' }, {})).toBe(true);
    expect(browserOptedOut({}, { doNotTrack: '1' })).toBe(true);
    expect(browserOptedOut({ doNotTrack: '0' }, {})).toBe(false);
    expect(browserOptedOut({}, {})).toBe(false);
  });

  it('서버(window 없음)에서 부르면 아무것도 하지 않음', () => {
    expect(() => track('landing_view', {})).not.toThrow();
  });
});
