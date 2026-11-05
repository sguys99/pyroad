import {
  ANALYTICS_ENDPOINT,
  ANON_ID_RE,
  MAX_BATCH_EVENTS,
  normalizePath,
  type AnalyticsEventProps,
  type ClientEventName,
} from './events';

/**
 * 브라우저 분석 이벤트 `track()` (P1-17, §12-Q22). 앱의 클라이언트 이벤트 호출은 모두 여기를 지난다
 * (나중에 PostHog 등으로 옮길 때 이 파일의 transport 만 바꾸면 됨).
 *
 * - 큐에 모았다가 2초 뒤(또는 10건이 차면) 한 번에 보낸다. 페이지를 떠날 때(`pagehide`, 탭 숨김)는 `navigator.sendBeacon`으로 남은 것을 보낸다.
 *   곧바로 페이지를 떠나는 이벤트(로그인 버튼 → OAuth 이동)는 `{ immediate: true }`.
 * - 익명 세션 ID: 탭마다 128비트 난수를 sessionStorage(`pyroad.analytics.sid`)에 둔다. 쿠키·localStorage 를 쓰지 않으므로 탭을 닫으면 사라지고
 *   다음 방문과 이어지지 않는다. 로그인 사용자는 서버가 user id 를 HMAC 한 값으로 바꿔 저장한다.
 * - Do Not Track·Global Privacy Control 이 켜져 있으면 아무것도 보내지 않는다 (서버도 같은 신호로 서버 이벤트를 기록하지 않음).
 * - 모드: production 빌드는 send, 개발 서버는 console(보내지 않고 콘솔에만), 테스트는 off.
 *   `NEXT_PUBLIC_ANALYTICS_MODE=send|console|off`로 덮어쓸 수 있다 (로컬에서 실제 저장을 확인할 때 send).
 * - 실패해도 다시 보내지 않고 버린다. 어떤 경우에도 던지지 않는다.
 */

export type AnalyticsMode = 'send' | 'console' | 'off';

export function resolveAnalyticsMode(
  override: string | undefined,
  nodeEnv: string | undefined,
): AnalyticsMode {
  if (override === 'send' || override === 'console' || override === 'off')
    return override;
  if (nodeEnv === 'production') return 'send';
  if (nodeEnv === 'development') return 'console';
  return 'off';
}

export interface TrackOptions {
  /** 곧 페이지를 떠나므로 지금 바로 sendBeacon 으로 보낸다 */
  immediate?: boolean;
}

export interface QueuedEvent {
  name: ClientEventName;
  props: object;
  path?: string;
}

export interface AnalyticsTransport {
  /** body: JSON 문자열. beacon: 페이지를 떠나는 중이라 sendBeacon 을 써야 함 */
  send(body: string, options: { beacon: boolean }): void;
}

export interface TrackerDeps {
  mode: AnalyticsMode;
  transport: AnalyticsTransport;
  /** 세션 ID 저장소 (sessionStorage). 쓸 수 없으면(사파리 개인 정보 보호 등) 페이지 동안만 메모리에 */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** 추적 거부 신호 (DNT·GPC) */
  optedOut?: () => boolean;
  /** 지금 경로 (location.pathname) */
  currentPath?: () => string | undefined;
  randomBytes?: (n: number) => Uint8Array;
  flushDelayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  log?: (...args: unknown[]) => void;
}

export const SESSION_STORAGE_KEY = 'pyroad.analytics.sid';
const DEFAULT_FLUSH_DELAY_MS = 2000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function defaultRandomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

export interface Tracker {
  track<N extends ClientEventName>(
    name: N,
    props: AnalyticsEventProps[N],
    options?: TrackOptions,
  ): void;
  /** 큐를 비운다. beacon: 페이지를 떠나는 중 */
  flush(beacon?: boolean): void;
  /** 테스트용 */
  pending(): readonly QueuedEvent[];
  sessionId(): string;
}

export function createTracker(deps: TrackerDeps): Tracker {
  const queue: QueuedEvent[] = [];
  const delay = deps.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    deps.clearTimer ??
    ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const randomBytes = deps.randomBytes ?? defaultRandomBytes;
  let timer: unknown = null;
  let sid: string | null = null;

  function sessionId(): string {
    if (sid) return sid;
    try {
      const saved = deps.storage?.getItem(SESSION_STORAGE_KEY);
      if (saved && ANON_ID_RE.test(saved)) {
        sid = saved;
        return sid;
      }
    } catch {
      // 저장소를 못 쓰면 이 페이지 동안만 쓰는 ID
    }
    sid = toBase64Url(randomBytes(16)); // 128비트 → 22자
    try {
      deps.storage?.setItem(SESSION_STORAGE_KEY, sid);
    } catch {
      // 위와 같음
    }
    return sid;
  }

  function cancelTimer() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }

  function flush(beacon = false) {
    cancelTimer();
    while (queue.length > 0) {
      const events = queue.splice(0, MAX_BATCH_EVENTS);
      try {
        deps.transport.send(JSON.stringify({ sid: sessionId(), events }), {
          beacon,
        });
      } catch {
        // 버림
      }
    }
  }

  function track<N extends ClientEventName>(
    name: N,
    props: AnalyticsEventProps[N],
    options: TrackOptions = {},
  ) {
    try {
      if (deps.mode === 'off') return;
      if (deps.optedOut?.()) return;
      if (deps.mode === 'console') {
        (deps.log ?? console.info)('[analytics]', name, props);
        return;
      }
      const path = normalizePath(deps.currentPath?.()) ?? undefined;
      queue.push({ name, props, ...(path && { path }) });
      if (options.immediate) flush(true);
      else if (queue.length >= MAX_BATCH_EVENTS) flush(false);
      else if (timer === null)
        timer = setTimer(() => {
          timer = null;
          flush(false);
        }, delay);
    } catch {
      // 분석은 화면 동작을 깨뜨리지 않는다
    }
  }

  return { track, flush, pending: () => queue, sessionId };
}

/** 브라우저의 추적 거부 신호 */
export function browserOptedOut(
  nav: Partial<Navigator> & { globalPrivacyControl?: boolean } = navigator,
  win: { doNotTrack?: string | null } = window as unknown as {
    doNotTrack?: string | null;
  },
): boolean {
  return (
    nav.globalPrivacyControl === true ||
    nav.doNotTrack === '1' ||
    win.doNotTrack === '1'
  );
}

/** sendBeacon(문자열 = text/plain, CORS 안전 유형) → 안 되면 fetch keepalive */
export const beaconTransport: AnalyticsTransport = {
  send(body, { beacon }) {
    if (beacon && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(ANALYTICS_ENDPOINT, body)) return;
    }
    void fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => undefined);
  },
};

let browserTracker: Tracker | null = null;

function getBrowserTracker(): Tracker | null {
  if (typeof window === 'undefined') return null;
  if (browserTracker) return browserTracker;
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  const tracker = createTracker({
    mode: resolveAnalyticsMode(
      process.env.NEXT_PUBLIC_ANALYTICS_MODE,
      process.env.NODE_ENV,
    ),
    transport: beaconTransport,
    storage,
    optedOut: () => browserOptedOut(),
    currentPath: () => window.location.pathname,
  });
  // 페이지를 떠날 때 남은 이벤트를 보낸다 (모바일은 pagehide 가 안 올 수 있어 탭 숨김도)
  const leave = () => tracker.flush(true);
  window.addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave();
  });
  browserTracker = tracker;
  return tracker;
}

/** 클라이언트 이벤트 기록. 서버에서 부르면 아무것도 하지 않는다 */
export function track<N extends ClientEventName>(
  name: N,
  props: AnalyticsEventProps[N],
  options?: TrackOptions,
): void {
  try {
    getBrowserTracker()?.track(name, props, options);
  } catch {
    // 분석은 화면 동작을 깨뜨리지 않는다
  }
}
