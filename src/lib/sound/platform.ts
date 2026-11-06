/**
 * 브라우저 차이를 흡수하는 작은 유틸 (P0-15). 모두 서버 렌더에서 불러도 안전하다 (window가 없으면 아무것도 안 함).
 */

const MIME_BY_EXT: Record<string, string> = {
  webm: 'audio/webm; codecs="opus"',
  ogg: 'audio/ogg; codecs="opus"',
  m4a: 'audio/mp4; codecs="mp4a.40.2"',
  mp4: 'audio/mp4; codecs="mp4a.40.2"',
  wav: 'audio/wav',
};

let probe: HTMLAudioElement | null = null;

export function extOf(url: string): string {
  const clean = url.split(/[?#]/)[0] ?? url;
  const dot = clean.lastIndexOf('.');
  return dot < 0 ? '' : clean.slice(dot + 1).toLowerCase();
}

/**
 * `canPlayType`으로 코덱을 검사한다 (Opus는 `codecs="opus"`로 직접. Howler의 `codecs('webm')`은 Vorbis를 검사함, P0-15 §4.8).
 * 미디어 요소 기준이라 decodeAudioData 지원과 다를 수 있으므로, 호출부는 디코드 실패 시 다음 후보로 넘어간다.
 */
export function canPlayUrl(url: string): boolean {
  if (typeof document === 'undefined') return false;
  const mime = MIME_BY_EXT[extOf(url)];
  if (!mime) return false;
  probe ??= document.createElement('audio');
  return probe.canPlayType(mime) !== '';
}

export type AudioSessionTypeName =
  | 'auto'
  | 'playback'
  | 'transient'
  | 'transient-solo'
  | 'ambient'
  | 'play-and-record';

interface NavigatorWithAudioSession {
  audioSession?: { type: AudioSessionTypeName };
}

/**
 * Safari·iOS 16.4+의 `navigator.audioSession.type` (Chrome·Firefox 정식판에는 없음).
 * 'ambient': 다른 앱 음악과 섞이고 iOS 무음 스위치를 따른다 (기본값으로 쓸 것).
 * 'playback': 무음 스위치를 무시하고 다른 앱 음악을 멈춘다 (사용자가 직접 누른 "읽어주기" 동안만).
 * 반환값: 실제로 설정했는지.
 */
export function setAudioSessionType(type: AudioSessionTypeName): boolean {
  if (typeof navigator === 'undefined') return false;
  const session = (navigator as unknown as NavigatorWithAudioSession)
    .audioSession;
  if (!session) return false;
  try {
    session.type = type;
    return session.type === type;
  } catch {
    return false;
  }
}

export type AudioContextCtor = new (opts?: AudioContextOptions) => AudioContext;

export function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** 데이터 절약 모드면 제스처 전 미리 받기를 건너뛴다 */
export function prefersSaveData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const c = (navigator as unknown as { connection?: { saveData?: boolean } })
    .connection;
  return c?.saveData === true;
}

export function onIdle(fn: () => void, timeout = 2000): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 200);
}

/**
 * 사용자 활성화로 인정되는 이벤트 (HTML 표준): keydown, mousedown, pointerdown(마우스만), pointerup(마우스 외), touchend.
 * 터치 기기의 pointerdown은 활성화가 아니므로 pointerup·touchend도 듣는다. click은 일부 WebView 호환용.
 */
export const ACTIVATION_EVENTS = [
  'pointerdown',
  'pointerup',
  'touchend',
  'keydown',
  'mousedown',
  'click',
] as const;

/**
 * 사용자 활성화 이벤트마다 엔진 unlock을 시도한다 (running이면 아무것도 안 함).
 * iOS 'interrupted'·백그라운드 복귀 실패로 다시 잠겨도 다음 탭에서 복구되도록 리스너를 계속 둔다.
 * capture 단계라서 버튼 onClick의 `play()`보다 먼저 컨텍스트가 생긴다.
 */
export function attachUnlockListeners(
  engine: { unlock(): void; getSnapshot(): { state: string } },
  target: Pick<
    EventTarget,
    'addEventListener' | 'removeEventListener'
  > | null = typeof window === 'undefined' ? null : window,
): () => void {
  if (!target) return () => {};
  const handler = () => {
    const st = engine.getSnapshot().state;
    if (st !== 'running' && st !== 'unsupported' && st !== 'closed')
      engine.unlock();
  };
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  for (const t of ACTIVATION_EVENTS) target.addEventListener(t, handler, opts);
  return () => {
    for (const t of ACTIVATION_EVENTS)
      target.removeEventListener(t, handler, opts);
  };
}
