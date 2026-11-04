/**
 * 브라우저 차이를 흡수하는 작은 유틸 모음. 모두 SSR에서 호출해도 안전하다 (window 없으면 no-op).
 */

const MIME_BY_EXT: Record<string, string> = {
  webm: 'audio/webm; codecs="opus"',
  weba: 'audio/webm; codecs="opus"',
  opus: 'audio/ogg; codecs="opus"',
  ogg: 'audio/ogg; codecs="opus"',
  oga: 'audio/ogg; codecs="vorbis"',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4; codecs="mp4a.40.2"',
  mp4: 'audio/mp4; codecs="mp4a.40.2"',
  aac: 'audio/aac',
  caf: 'audio/x-caf; codecs="opus"',
  wav: 'audio/wav',
};

let probe: HTMLAudioElement | null = null;

export function extOf(url: string): string {
  const clean = url.split(/[?#]/)[0] ?? url;
  const dot = clean.lastIndexOf('.');
  return dot < 0 ? '' : clean.slice(dot + 1).toLowerCase();
}

export function canPlayUrl(url: string): boolean {
  if (typeof document === 'undefined') return false;
  const mime = MIME_BY_EXT[extOf(url)];
  if (!mime) return false;
  probe ??= document.createElement('audio');
  return probe.canPlayType(mime) !== '';
}

/**
 * 후보 중 재생 가능한 것만 원래 순서대로 남긴다.
 * canPlayType은 미디어 요소 기준이라 decodeAudioData 지원과 다를 수 있으므로,
 * 호출부는 디코드 실패 시 다음 후보로 넘어가야 한다.
 */
export function playableSources(src: readonly string[]): string[] {
  return src.filter(canPlayUrl);
}

export type AudioSessionTypeName = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';

interface NavigatorWithAudioSession {
  audioSession?: { type: AudioSessionTypeName };
}

/**
 * Safari/iOS 16.4+ 의 navigator.audioSession.type 설정 (Chrome·Firefox 정식 버전에는 없음).
 * 'ambient': 다른 앱 음악과 섞이고 iOS 무음 스위치를 따른다 (기본으로 쓸 값).
 * 'playback': 무음 스위치를 무시하고 다른 앱 음악을 멈춘다 (사용자가 명시적으로 '읽어주기'를 눌렀을 때만).
 * 반환값: 실제로 설정했는지.
 */
export function setAudioSessionType(type: AudioSessionTypeName): boolean {
  if (typeof navigator === 'undefined') return false;
  const session = (navigator as unknown as NavigatorWithAudioSession).audioSession;
  if (!session) return false;
  try {
    session.type = type;
    return session.type === type;
  } catch {
    return false;
  }
}

export function getAudioSessionType(): AudioSessionTypeName | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as unknown as NavigatorWithAudioSession).audioSession?.type ?? null;
}

type AudioContextCtor = new (opts?: AudioContextOptions) => AudioContext;

export function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** 데이터 절약 모드면 제스처 전 prefetch를 건너뛴다 */
export function prefersSaveData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}

export function onIdle(fn: () => void, timeout = 2000): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 200);
}

/**
 * 사용자 활성화로 인정되는 이벤트 (HTML 표준): keydown, mousedown, pointerdown(마우스만),
 * pointerup(마우스 외), touchend. 터치 기기에서 pointerdown은 활성화가 아니므로 pointerup/touchend도 듣는다.
 * click은 위 이벤트 뒤에 오지만 일부 WebView 호환용으로 함께 둔다.
 */
export const ACTIVATION_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'mousedown', 'click'] as const;

/**
 * 사용자 활성화 이벤트마다 엔진 unlock을 시도한다. 엔진이 running이면 아무것도 안 한다.
 * iOS 'interrupted', 백그라운드 복귀 실패 등으로 다시 잠겨도 다음 탭에서 복구되도록 리스너를 계속 둔다.
 */
export function attachUnlockListeners(
  engine: { unlock(): void; getSnapshot(): { state: string } },
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null = typeof window === 'undefined' ? null : window,
): () => void {
  if (!target) return () => {};
  const handler = () => {
    const st = engine.getSnapshot().state;
    if (st !== 'running' && st !== 'unsupported' && st !== 'closed') engine.unlock();
  };
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  for (const t of ACTIVATION_EVENTS) target.addEventListener(t, handler, opts);
  return () => {
    for (const t of ACTIVATION_EVENTS) target.removeEventListener(t, handler, opts);
  };
}
