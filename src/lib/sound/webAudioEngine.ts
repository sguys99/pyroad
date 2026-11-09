import {
  effectiveGain,
  mergeSettings,
  normalizeSettings,
  sameSoundSettings,
  type SettingsStorage,
} from './settings';
import {
  canPlayUrl,
  getAudioContextCtor,
  onIdle,
  prefersLightNetwork,
  prefersSaveData,
  setAudioSessionType,
  type AudioContextCtor,
  type AudioSessionTypeName,
} from './platform';
import type {
  BgmOptions,
  EngineSnapshot,
  EngineState,
  PlayOptions,
  SoundCategory,
  SoundEngine,
  SoundManifest,
  SoundMetric,
  SoundSettings,
  SoundSettingsPatch,
} from './types';

/**
 * 자체 Web Audio 래퍼 (P0-15 → P2-14, 의존성 0). 규칙 문서: docs/design/sound.md
 *
 * 그래프: AudioBufferSourceNode(효과음·BGM 버퍼) ─┐
 *         MediaElementSource(BGM 스트림, 선택)  ─┼→ [파일 gain] → 카테고리 gain(sfx/bgm/voice) → master gain → destination
 *
 * - AudioContext는 첫 사용자 활성화 이벤트 안에서 만든다 (Chrome 경고·WebKit `interrupted` 고착 회피. use-sound·Howler를
 *   쓰지 않는 이유, P0-15 §1). resume이 1.5초 안에 끝나지 않으면 다음 제스처에서 컨텍스트를 새로 만든다 (iOS 복귀 버그).
 * - 효과음: core는 제스처 전 유휴 시간에 OfflineAudioContext로 미리 디코드 → 첫 탭부터 바로. 나머지는 unlock 뒤 디코드.
 * - BGM: 기본 'buffer'(전체 디코드 → loop). 루프 이음새가 없고, Web Audio만 써서 iOS 무음 스위치를 따른다(ambient).
 *   지금 곡만 메모리에 둔다. 다른 곡으로 바뀌면 크로스페이드, 탭이 숨겨지면 멈추고 300ms 뒤 컨텍스트 suspend.
 * - 실제 재생 = 원하는 곡(desired) ∧ 탭 보임 ∧ running ∧ BGM 설정 켜짐 ∧ 연출 단계 허용(minimal이면 끔, P0-16 §4.5).
 * - 서버에서는 만들지 않는다 (`index.ts`가 no-op 엔진을 준다).
 */
export interface WebAudioEngineOptions {
  storage?: SettingsStorage | null;
  initialSettings?: SoundSettings;
  /** 기본 'ambient' (iOS 무음 스위치를 따름). null이면 건드리지 않는다 */
  audioSessionType?: AudioSessionTypeName | null;
  onMetric?: (m: SoundMetric) => void;
  /** resume()이 이 시간 안에 끝나지 않으면 다음 제스처에서 컨텍스트를 새로 만든다 */
  resumeTimeoutMs?: number;
  /** 탭 숨김 뒤 suspend까지 대기 (효과음 꼬리) */
  suspendDelayMs?: number;
  /** 전체 동시 효과음 상한 */
  maxTotalVoices?: number;
  /** false면 prefetch()가 아무것도 하지 않는다 (unlock 뒤 첫 재생 때 디코드) */
  predecode?: boolean;
  /** 이 값(초)을 넘는 출력 지연이면 `latencySensitive` 효과음(대사 블립)을 끈다. 기본 0.15 */
  maxLatencySensitiveDelay?: number;
  // ── 테스트 주입 (기본값은 브라우저 전역) ──
  audioContextCtor?: AudioContextCtor | null;
  createOfflineContext?: () => BaseAudioContext | null;
  loadBytes?: (url: string) => Promise<ArrayBuffer>;
  canPlay?: (url: string) => boolean;
  createAudio?: () => HTMLAudioElement;
  /** false면 document·window 가시성 이벤트를 듣지 않는다 (테스트는 `setHiddenForTest`) */
  listenVisibility?: boolean;
}

interface Voice {
  src: AudioBufferSourceNode;
  out: AudioNode;
}

interface BgmSlot {
  gain: GainNode;
  buf: AudioBufferSourceNode | null;
  /** 스트림 모드에서만 만든다 */
  el: HTMLAudioElement | null;
  node: MediaElementAudioSourceNode | null;
  /** 이 슬롯에 걸린 곡 */
  id: string | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

function decode(ctx: BaseAudioContext, ab: ArrayBuffer): Promise<AudioBuffer> {
  // Safari 14.1 미만은 콜백형만 지원. 둘 다 처리
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(ab, resolve, reject) as
      | Promise<AudioBuffer>
      | undefined;
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

function keysOf<K extends string>(o: Record<K, unknown>): K[] {
  return Object.keys(o) as K[];
}

const defaultLoadBytes = (url: string) =>
  fetch(url).then((r) =>
    r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`)),
  );

function defaultOfflineContext(): BaseAudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    OfflineAudioContext?: typeof OfflineAudioContext;
  };
  if (!w.OfflineAudioContext) return null;
  try {
    // 디코드 전용 (1프레임, 48kHz). 실제 컨텍스트와 레이트가 달라도 재생할 때 리샘플된다
    return new w.OfflineAudioContext(1, 1, 48000);
  } catch {
    return null;
  }
}

const now = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

export class WebAudioEngine<
  S extends string,
  B extends string,
> implements SoundEngine<S, B> {
  readonly kind = 'webaudio' as const;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cat: Record<SoundCategory, GainNode> | null = null;
  private settings: SoundSettings;
  private state: EngineState;
  private desiredBgm: B | null = null;
  private desiredFadeMs = 800;
  private playingBgm: B | null = null;
  private bgmAllowed = true;
  private snapshot: EngineSnapshot<B>;
  private readonly listeners = new Set<() => void>();
  private readonly userListeners = new Set<(s: SoundSettings) => void>();
  private readonly buffers = new Map<S, AudioBuffer>();
  private readonly decoding = new Map<S, Promise<AudioBuffer | null>>();
  private readonly bgmBuffers = new Map<B, Promise<AudioBuffer | null>>();
  /** prefetchBgm 으로 받았거나 받는 중인 곡 (중복 요청 방지) */
  private readonly bgmFetched = new Set<B>();
  private readonly voices = new Map<S, Voice[]>();
  private totalVoices = 0;
  private slots: BgmSlot[] = [];
  private activeSlot = -1;
  private lastSlot = 1;
  private hidden = false;
  private warmed = false;
  private needsRecreate = false;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private offline: BaseAudioContext | null | undefined;
  private readonly detach: Array<() => void> = [];
  private readonly Ctor: AudioContextCtor | null;
  private readonly loadBytes: (url: string) => Promise<ArrayBuffer>;
  private readonly canPlay: (url: string) => boolean;

  constructor(
    private readonly manifest: SoundManifest<S, B>,
    private readonly options: WebAudioEngineOptions = {},
  ) {
    this.Ctor =
      options.audioContextCtor === undefined
        ? getAudioContextCtor()
        : options.audioContextCtor;
    this.loadBytes = options.loadBytes ?? defaultLoadBytes;
    this.canPlay = options.canPlay ?? canPlayUrl;
    this.settings =
      options.initialSettings ??
      options.storage?.load() ??
      normalizeSettings(null);
    this.state = this.Ctor ? 'idle' : 'unsupported';
    this.snapshot = this.makeSnapshot();
    if (options.listenVisibility !== false && typeof document !== 'undefined') {
      this.hidden = document.visibilityState === 'hidden';
      const onVis = () => this.setHidden(document.visibilityState === 'hidden');
      const onHide = () => this.setHidden(true);
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('pagehide', onHide);
      window.addEventListener('pageshow', onVis);
      this.detach.push(() => {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('pagehide', onHide);
        window.removeEventListener('pageshow', onVis);
      });
    }
  }

  // ───────────── 상태 ─────────────

  getSnapshot(): EngineSnapshot<B> {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onUserSettings(listener: (s: SoundSettings) => void): () => void {
    this.userListeners.add(listener);
    return () => this.userListeners.delete(listener);
  }

  private makeSnapshot(): EngineSnapshot<B> {
    return {
      state: this.state,
      settings: this.settings,
      desiredBgm: this.desiredBgm,
      playingBgm: this.playingBgm,
      bgmAllowed: this.bgmAllowed,
    };
  }

  private emit(): void {
    const next = this.makeSnapshot();
    const prev = this.snapshot;
    if (
      prev.state === next.state &&
      prev.settings === next.settings &&
      prev.desiredBgm === next.desiredBgm &&
      prev.playingBgm === next.playingBgm &&
      prev.bgmAllowed === next.bgmAllowed
    )
      return;
    this.snapshot = next;
    for (const l of this.listeners) l();
  }

  private metric(m: SoundMetric): void {
    this.options.onMetric?.(m);
  }

  private syncState(): void {
    const c = this.ctx;
    let st: EngineState;
    if (this.disposed) st = 'closed';
    else if (!c) st = this.Ctor ? 'idle' : 'unsupported';
    else if (c.state === 'running') st = 'running';
    else if ((c.state as string) === 'interrupted') st = 'interrupted';
    else if (c.state === 'closed') st = 'closed';
    else st = this.hidden ? 'suspended' : 'locked';
    if (st !== this.state) {
      this.state = st;
      this.metric({ type: 'state', state: st, ctxState: c?.state ?? null });
      this.emit();
    }
    if (st === 'running') this.afterRunning();
    else this.reconcileBgm(0);
  }

  // ───────────── 잠금 해제 ─────────────

  unlock(): void {
    if (this.disposed) return;
    if (this.ctx && this.needsRecreate) this.recreate();
    if (!this.ctx && !this.createContext()) return;
    const c = this.ctx!;
    if (c.state === 'running') return;
    // 구형 iOS: 제스처 안에서 무음 버퍼를 start해야 출력이 열린다
    try {
      const b = c.createBuffer(1, 1, c.sampleRate);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start(0);
    } catch {
      /* 무시 */
    }
    this.resume();
  }

  private createContext(): boolean {
    const Ctor = this.Ctor;
    if (!Ctor) {
      this.syncState();
      return false;
    }
    if (this.options.audioSessionType !== null)
      setAudioSessionType(this.options.audioSessionType ?? 'ambient');
    let c: AudioContext;
    try {
      c = new Ctor({ latencyHint: 'interactive' });
    } catch {
      this.state = 'unsupported';
      this.emit();
      return false;
    }
    this.ctx = c;
    const master = c.createGain();
    master.connect(c.destination);
    const mk = () => {
      const g = c.createGain();
      g.connect(master);
      return g;
    };
    this.master = master;
    this.cat = { sfx: mk(), bgm: mk(), voice: mk() };
    this.applyGains(true);
    this.slots = [this.makeSlot(c), this.makeSlot(c)];
    c.addEventListener('statechange', () => this.syncState());
    this.syncState();
    return true;
  }

  private hasStreamBgm(): boolean {
    return keysOf(this.manifest.bgm).some(
      (id) => this.manifest.bgm[id].mode === 'stream',
    );
  }

  private makeSlot(c: AudioContext): BgmSlot {
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(this.cat!.bgm);
    const slot: BgmSlot = {
      gain,
      buf: null,
      el: null,
      node: null,
      id: null,
      stopTimer: null,
    };
    if (this.hasStreamBgm()) {
      // 스트림 BGM용 <audio>. 제스처 안에서 load()해 두면 iOS가 이후 play()를 허용한다
      const el = this.options.createAudio?.() ?? new Audio();
      el.preload = 'none';
      el.loop = true;
      try {
        el.load();
        slot.node = c.createMediaElementSource(el);
        slot.node.connect(gain);
      } catch {
        slot.node = null;
      }
      slot.el = el;
    }
    return slot;
  }

  private resume(): void {
    const c = this.ctx;
    if (!c || c.state === 'closed') return;
    let settled = false;
    const done = () => {
      settled = true;
      this.syncState();
    };
    c.resume().then(done, done);
    setTimeout(() => {
      if (!settled && this.ctx === c && c.state !== 'running')
        this.needsRecreate = true;
    }, this.options.resumeTimeoutMs ?? 1500);
  }

  /** resume이 끝나지 않을 때(iOS 백그라운드 복귀 버그, WebKit 291892) 컨텍스트를 새로 만든다. AudioBuffer는 재사용 */
  private recreate(): void {
    const old = this.ctx;
    for (const s of this.slots) this.releaseSlot(s);
    this.slots = [];
    this.activeSlot = -1;
    this.playingBgm = null;
    this.ctx = null;
    this.master = null;
    this.cat = null;
    this.voices.clear();
    this.totalVoices = 0;
    this.needsRecreate = false;
    old?.close().catch(() => {});
  }

  private releaseSlot(s: BgmSlot): void {
    if (s.stopTimer) clearTimeout(s.stopTimer);
    s.el?.pause();
    s.el?.removeAttribute('src');
    try {
      s.buf?.stop();
    } catch {
      /* 이미 멈춤 */
    }
  }

  private afterRunning(): void {
    this.reconcileBgm(this.desiredFadeMs);
    if (this.warmed) return;
    if (
      effectiveGain(this.settings, 'sfx') === 0 &&
      effectiveGain(this.settings, 'voice') === 0
    )
      return; // 소리를 켜면 그때 준비
    this.warmed = true;
    const core = keysOf(this.manifest.sfx).filter(
      (id) => this.manifest.sfx[id].core,
    );
    void Promise.all(core.map((id) => this.loadBuffer(id))).then(() =>
      onIdle(() => void this.preload()),
    );
  }

  // ───────────── 효과음 로딩 ─────────────

  prefetch(): void {
    if (this.disposed || this.options.predecode === false || prefersSaveData())
      return;
    if (effectiveGain(this.settings, 'sfx') === 0) return;
    if (this.offline === undefined)
      this.offline = (
        this.options.createOfflineContext ?? defaultOfflineContext
      )();
    const offline = this.offline;
    if (!offline) return;
    for (const id of keysOf(this.manifest.sfx)) {
      if (this.manifest.sfx[id].core) void this.loadBuffer(id, offline);
    }
  }

  async preload(ids?: readonly S[]): Promise<void> {
    if (!this.ctx) return;
    const list = ids ?? keysOf(this.manifest.sfx);
    for (let i = 0; i < list.length; i += 4) {
      await Promise.all(list.slice(i, i + 4).map((id) => this.loadBuffer(id)));
    }
  }

  private loadBuffer(
    id: S,
    via?: BaseAudioContext,
  ): Promise<AudioBuffer | null> {
    const have = this.buffers.get(id);
    if (have) return Promise.resolve(have);
    const inflight = this.decoding.get(id);
    if (inflight) return inflight;
    const c = via ?? this.ctx;
    if (!c) return Promise.resolve(null);
    const p = (async () => {
      for (const src of this.manifest.sfx[id].src.filter(this.canPlay)) {
        try {
          const ab = await this.loadBytes(src);
          const bytes = ab.byteLength; // decodeAudioData가 ArrayBuffer를 분리하므로 먼저 읽는다
          const t0 = now();
          const buf = await decode(c, ab);
          this.metric({
            type: 'decode',
            id,
            src,
            bytes,
            ms: now() - t0,
            duration: buf.duration,
          });
          this.buffers.set(id, buf);
          return buf;
        } catch (e) {
          // canPlayType은 통과했지만 decodeAudioData가 못 여는 경우 → 다음 후보 (구형 Safari의 WebM/Opus)
          this.metric({
            type: 'decode-error',
            id,
            src,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return null;
    })();
    this.decoding.set(id, p);
    void p.finally(() => this.decoding.delete(id));
    return p;
  }

  // ───────────── 효과음 재생 ─────────────

  play(id: S, opts: PlayOptions = {}): void {
    const def = this.manifest.sfx[id];
    if (!def || this.disposed) return;
    if (effectiveGain(this.settings, def.category ?? 'sfx') === 0) return;
    const c = this.ctx;
    if (!c) {
      // unlock 리스너(capture)가 먼저 돌아서 보통 여기 오지 않는다. 제스처 밖 자동 재생 시도는 버린다
      this.metric({ type: 'drop', id, reason: 'locked' });
      return;
    }
    if (
      def.latencySensitive &&
      (c.outputLatency ?? 0) + (c.baseLatency ?? 0) >
        (this.options.maxLatencySensitiveDelay ?? 0.15)
    ) {
      this.metric({ type: 'drop', id, reason: 'latency' });
      return;
    }
    if (c.state !== 'running') this.resume();
    const buf = this.buffers.get(id);
    if (buf) {
      this.startVoice(id, buf, opts);
      return;
    }
    const t0 = now();
    const tolerance = opts.lateToleranceMs ?? 250;
    void this.loadBuffer(id).then((b) => {
      if (!b) return;
      if (now() - t0 <= tolerance) this.startVoice(id, b, opts);
      else this.metric({ type: 'drop', id, reason: 'late' });
    });
  }

  private startVoice(id: S, buf: AudioBuffer, opts: PlayOptions): void {
    const c = this.ctx;
    const cat = this.cat;
    if (!c || !cat) return;
    const def = this.manifest.sfx[id];
    const list = this.voices.get(id) ?? [];
    const max = def.maxVoices ?? 4;
    while (list.length >= max) this.stopVoice(list.shift()!);
    if (this.totalVoices >= (this.options.maxTotalVoices ?? 24)) {
      this.metric({ type: 'drop', id, reason: 'voice-limit' });
      return;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    if (opts.rate && opts.rate !== 1) src.playbackRate.value = opts.rate;
    const g = (def.gain ?? 1) * (opts.gain ?? 1);
    let out: AudioNode = src;
    if (g !== 1) {
      const gn = c.createGain();
      gn.gain.value = g;
      src.connect(gn);
      out = gn;
    }
    out.connect(cat[def.category ?? 'sfx']);
    const v: Voice = { src, out };
    list.push(v);
    this.voices.set(id, list);
    this.totalVoices++;
    src.onended = () => {
      const l = this.voices.get(id);
      const i = l ? l.indexOf(v) : -1;
      if (l && i >= 0) {
        l.splice(i, 1);
        this.totalVoices--;
      }
      try {
        out.disconnect();
        if (out !== src) src.disconnect();
      } catch {
        /* 무시 */
      }
    };
    src.start();
  }

  private stopVoice(v: Voice): void {
    this.totalVoices--;
    try {
      v.src.stop();
    } catch {
      /* 이미 끝남 */
    }
  }

  // ───────────── BGM ─────────────

  playBgm(id: B, opts: BgmOptions = {}): void {
    if (!this.manifest.bgm[id] || this.disposed) return;
    this.desiredBgm = id;
    this.desiredFadeMs = opts.fadeMs ?? 800;
    this.reconcileBgm(this.desiredFadeMs);
    this.emit();
  }

  stopBgm(opts: BgmOptions = {}): void {
    this.desiredBgm = null;
    this.reconcileBgm(opts.fadeMs ?? 800);
    this.emit();
  }

  setBgmAllowed(allowed: boolean): void {
    if (allowed === this.bgmAllowed) return;
    this.bgmAllowed = allowed;
    this.reconcileBgm(400);
    this.emit();
  }

  /** 원하는 BGM과 설정·연출 단계·가시성·컨텍스트 상태를 맞춘다 */
  private reconcileBgm(fadeMs: number): void {
    const c = this.ctx;
    const want =
      this.desiredBgm &&
      this.bgmAllowed &&
      !this.hidden &&
      c?.state === 'running' &&
      effectiveGain(this.settings, 'bgm') > 0
        ? this.desiredBgm
        : null;
    if (want === this.playingBgm) return;
    if (this.activeSlot >= 0)
      this.fadeOutSlot(this.slots[this.activeSlot]!, fadeMs);
    this.activeSlot = -1;
    this.playingBgm = null;
    if (want && c) {
      // 같은 곡이 페이드아웃 중인 슬롯이 있으면 그 슬롯으로, 아니면 번갈아
      let i = this.slots.findIndex((s) => s.id === want);
      if (i < 0) i = this.lastSlot === 0 ? 1 : 0;
      if (this.startSlot(i, want, fadeMs)) {
        this.activeSlot = i;
        this.lastSlot = i;
        this.playingBgm = want;
      }
    }
    this.emit();
  }

  private ramp(g: GainNode, to: number, ms: number): void {
    const c = this.ctx!;
    const t = c.currentTime;
    g.gain.cancelScheduledValues(t);
    if (ms <= 0) {
      g.gain.setValueAtTime(to, t);
      return;
    }
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(to, t + ms / 1000);
  }

  private startSlot(i: number, id: B, fadeMs: number): boolean {
    const slot = this.slots[i];
    const c = this.ctx;
    if (!slot || !c) return false;
    const def = this.manifest.bgm[id];
    if (slot.stopTimer) {
      clearTimeout(slot.stopTimer);
      slot.stopTimer = null;
    }
    const target = def.gain ?? 1;
    if ((def.mode ?? 'buffer') === 'buffer') {
      // 페이드아웃 중이던 같은 곡이면 이어서 (처음부터 다시 시작하지 않음)
      if (slot.id === id && slot.buf) {
        this.ramp(slot.gain, target, fadeMs);
        return true;
      }
      // 빠르게 곡을 여러 번 바꿔 아직 다른 곡이 페이드아웃 중인 슬롯이면 그 곡은 바로 멈춘다
      if (slot.buf) {
        try {
          slot.buf.stop();
        } catch {
          /* 무시 */
        }
        slot.buf.disconnect();
        slot.buf = null;
      }
      slot.id = id;
      void this.loadBgmBuffer(id).then((buf) => {
        if (
          !buf ||
          this.playingBgm !== id ||
          this.slots[i] !== slot ||
          slot.id !== id ||
          slot.buf
        )
          return;
        const s = c.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.connect(slot.gain);
        s.start();
        slot.buf = s;
        this.ramp(slot.gain, target, fadeMs);
      });
      return true;
    }
    const el = slot.el;
    const candidates = def.src.filter(this.canPlay);
    if (!el || candidates.length === 0) return false;
    if (slot.id !== id) {
      slot.id = id;
      let index = 0;
      el.preload = 'auto';
      el.src = candidates[0]!;
      el.onerror = () => {
        // 다음 포맷으로
        const next = candidates[++index];
        if (next && slot.id === id) {
          el.src = next;
          void el.play().catch(() => {});
        }
      };
    }
    el.play().catch((e: unknown) =>
      this.metric({
        type: 'decode-error',
        id,
        src: el.currentSrc,
        message: e instanceof Error ? e.name : String(e),
      }),
    );
    this.ramp(slot.gain, target, fadeMs);
    return true;
  }

  private fadeOutSlot(slot: BgmSlot, fadeMs: number): void {
    if (!this.ctx) return;
    this.ramp(slot.gain, 0, fadeMs);
    const stop = () => {
      slot.stopTimer = null;
      slot.el?.pause(); // src는 유지 → 같은 곡으로 돌아오면 이어서 재생
      if (slot.buf) {
        try {
          slot.buf.stop();
        } catch {
          /* 무시 */
        }
        slot.buf.disconnect();
        slot.buf = null;
      }
      // 디코드된 BGM은 수십 MB → 지금 원하는 곡이 아니면 버린다 (다시 오면 재디코드)
      if (slot.id && slot.id !== this.desiredBgm)
        this.bgmBuffers.delete(slot.id as B);
      if (!slot.el) slot.id = null;
    };
    if (slot.stopTimer) clearTimeout(slot.stopTimer);
    if (fadeMs <= 0) stop();
    else slot.stopTimer = setTimeout(stop, fadeMs + 50);
  }

  /**
   * BGM 파일을 받아 HTTP 캐시(`/sounds/*` immutable)에만 데워 둔다 (P5-11 추가). 디코드하지 않으므로 메모리에 남지 않고,
   * 첫 재생 때 `loadBgmBuffer`의 fetch 가 캐시에서 바로 받아 디코드만 한다. 버퍼 보관 규칙("현재 곡만")은 그대로.
   * BGM 이 꺼져 있거나(기본) 연출 단계가 막았거나, 데이터 절약·느린 연결이면 받지 않는다. 곡마다 한 번만.
   */
  prefetchBgm(ids: readonly B[]): void {
    if (this.disposed || !this.bgmAllowed || prefersLightNetwork()) return;
    if (effectiveGain(this.settings, 'bgm') === 0) return;
    for (const id of ids) {
      const def = this.manifest.bgm[id];
      // 이미 받았거나 디코드 중·디코드된 곡(재생 중)은 건너뜀
      if (!def || this.bgmFetched.has(id) || this.bgmBuffers.has(id)) continue;
      const src = def.src.find(this.canPlay);
      if (!src) continue;
      this.bgmFetched.add(id);
      this.loadBytes(src).catch(() => this.bgmFetched.delete(id));
    }
  }

  private loadBgmBuffer(id: B): Promise<AudioBuffer | null> {
    const have = this.bgmBuffers.get(id);
    if (have) return have;
    const c = this.ctx;
    if (!c) return Promise.resolve(null);
    const p = (async () => {
      for (const src of this.manifest.bgm[id].src.filter(this.canPlay)) {
        try {
          const ab = await this.loadBytes(src);
          const bytes = ab.byteLength;
          const t0 = now();
          const buf = await decode(c, ab);
          this.metric({
            type: 'decode',
            id,
            src,
            bytes,
            ms: now() - t0,
            duration: buf.duration,
          });
          return buf;
        } catch (e) {
          this.metric({
            type: 'decode-error',
            id,
            src,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      this.bgmBuffers.delete(id); // 실패는 기억하지 않는다 (다음에 다시 시도)
      return null;
    })();
    this.bgmBuffers.set(id, p);
    return p;
  }

  // ───────────── 가시성 ─────────────

  /** 테스트용: 가시성 이벤트 대신 */
  setHiddenForTest(hidden: boolean): void {
    this.setHidden(hidden);
  }

  private setHidden(hidden: boolean): void {
    if (hidden === this.hidden || this.disposed) return;
    this.hidden = hidden;
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    const c = this.ctx;
    if (hidden) {
      // Chrome 등은 백그라운드 탭에서도 Web Audio가 계속 나므로 직접 멈춘다
      this.reconcileBgm(0);
      this.suspendTimer = setTimeout(() => {
        if (this.hidden && c && c.state === 'running')
          c.suspend().then(
            () => this.syncState(),
            () => {},
          );
      }, this.options.suspendDelayMs ?? 300);
    } else if (c && c.state !== 'running' && c.state !== 'closed') {
      // 한 번이라도 사용자 활성화가 있었으면(sticky) 대부분 허용. 실패하면 다음 탭에서 unlock 리스너가 복구
      this.resume();
    } else {
      this.reconcileBgm(600);
    }
    this.syncState();
  }

  // ───────────── 설정 ─────────────

  private applyGains(immediate = false): void {
    const c = this.ctx;
    if (!c || !this.master || !this.cat) return;
    const s = this.settings;
    const set = (g: GainNode, v: number) => {
      if (immediate) g.gain.setValueAtTime(v, c.currentTime);
      else g.gain.setTargetAtTime(v, c.currentTime, 0.02);
    };
    set(this.master, s.muted ? 0 : s.master);
    for (const k of ['sfx', 'bgm', 'voice'] as const)
      set(this.cat[k], s[k].enabled ? s[k].volume : 0);
  }

  private apply(next: SoundSettings): void {
    this.settings = next;
    this.applyGains();
    this.options.storage?.save(next);
    this.emit();
    this.reconcileBgm(400);
    if (this.ctx?.state === 'running') this.afterRunning();
  }

  setSettings(patch: SoundSettingsPatch): void {
    if (this.disposed) return;
    this.apply(mergeSettings(this.settings, patch));
    for (const l of this.userListeners) l(this.settings);
  }

  adoptSettings(next: SoundSettings): void {
    if (this.disposed || sameSoundSettings(next, this.settings)) return;
    this.apply(normalizeSettings(next));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const d of this.detach) d();
    for (const s of this.slots) this.releaseSlot(s);
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.listeners.clear();
    this.userListeners.clear();
    this.state = 'closed';
    this.snapshot = this.makeSnapshot();
  }
}

export function createWebAudioEngine<S extends string, B extends string>(
  manifest: SoundManifest<S, B>,
  options?: WebAudioEngineOptions,
): WebAudioEngine<S, B> {
  return new WebAudioEngine(manifest, options);
}
