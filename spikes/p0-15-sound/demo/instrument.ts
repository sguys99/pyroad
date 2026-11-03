/**
 * 측정용 계측. 엔진 코드보다 먼저 실행돼야 한다 (AudioContext·decodeAudioData·start를 감싼다).
 * 두 엔진(자체 래퍼, Howler)을 같은 기준으로 재기 위해 브라우저 API 레벨에서 기록한다.
 */
export interface P015 {
  engine: string;
  bootAt: number;
  ctxCreated: Array<{ t: number; state: string; sampleRate: number; baseLatency: number | null; inGesture: boolean }>;
  states: Array<{ t: number; state: string }>;
  decodes: Array<{ t: number; ms: number; bytes: number; duration: number | null; error?: string }>;
  starts: Array<{ t: number; duration: number; ctxState: string; gestureTs: number | null; gestureId: string | null }>;
  gestures: Array<{ ts: number; handlerAt: number; type: string; id: string }>;
  lastGesture: { ts: number; handlerAt: number; type: string; id: string } | null;
  inGesture: boolean;
  notes: string[];
  metrics: unknown[];
}

declare global {
  interface Window {
    __p015: P015;
    webkitAudioContext?: typeof AudioContext;
  }
}

export function installInstrumentation(engine: string): P015 {
  const P: P015 = {
    engine,
    bootAt: performance.now(),
    ctxCreated: [],
    states: [],
    decodes: [],
    starts: [],
    gestures: [],
    lastGesture: null,
    inGesture: false,
    notes: [],
    metrics: [],
  };
  window.__p015 = P;

  // 사용자 활성화 이벤트 안에 있는지 (컨텍스트가 제스처 안에서 만들어졌는지 확인용)
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'mousedown', 'click']) {
    // 리스너 사이마다 마이크로태스크 체크포인트가 돌기 때문에 queueMicrotask가 아니라 setTimeout으로 해제
    window.addEventListener(type, () => { P.inGesture = true; setTimeout(() => (P.inGesture = false), 0); }, { capture: true });
  }

  const Orig = window.AudioContext ?? window.webkitAudioContext;
  if (Orig) {
    class Tracked extends Orig {
      constructor(opts?: AudioContextOptions) {
        super(opts);
        P.ctxCreated.push({
          t: performance.now(),
          state: this.state,
          sampleRate: this.sampleRate,
          baseLatency: typeof this.baseLatency === 'number' ? this.baseLatency : null,
          inGesture: P.inGesture,
        });
        this.addEventListener('statechange', () => P.states.push({ t: performance.now(), state: this.state }));
      }
    }
    window.AudioContext = Tracked as typeof AudioContext;
  }

  const proto = BaseAudioContext.prototype;
  const origDecode = proto.decodeAudioData;
  proto.decodeAudioData = function (
    this: BaseAudioContext,
    ab: ArrayBuffer,
    ok?: DecodeSuccessCallback | null,
    err?: DecodeErrorCallback | null,
  ): Promise<AudioBuffer> {
    const t0 = performance.now();
    const bytes = ab.byteLength;
    let done = false;
    const rec = (b: AudioBuffer | null, e?: unknown) => {
      if (done) return;
      done = true;
      P.decodes.push({ t: performance.now(), ms: performance.now() - t0, bytes, duration: b ? b.duration : null, error: e ? String(e) : undefined });
    };
    const p = origDecode.call(
      this,
      ab,
      (b: AudioBuffer) => {
        rec(b);
        ok?.(b);
      },
      (e: DOMException) => {
        rec(null, e);
        err?.(e);
      },
    ) as Promise<AudioBuffer> | undefined;
    if (p && typeof p.then === 'function') {
      p.then((b) => rec(b), (e) => rec(null, e));
      return p;
    }
    return Promise.reject(new Error('no promise'));
  } as typeof proto.decodeAudioData;

  const origStart = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: [number?, number?, number?]) {
    const b = this.buffer;
    // 잠금 해제용 1샘플 무음 버퍼, Howler 스크래치 버퍼는 제외
    if (b && b.length > 16) {
      P.starts.push({
        t: performance.now(),
        duration: b.duration,
        ctxState: this.context.state,
        gestureTs: P.lastGesture?.ts ?? null,
        gestureId: P.lastGesture?.id ?? null,
      });
    }
    return origStart.apply(this, args);
  };

  return P;
}

export function markGesture(e: Event, id: string): void {
  const g = { ts: e.timeStamp, handlerAt: performance.now(), type: e.type, id };
  window.__p015.lastGesture = g;
  window.__p015.gestures.push(g);
}
