import { effectiveGain, mergeSettings, normalizeSettings, type SettingsStorage } from './settings';
import {
  getAudioContextCtor,
  onIdle,
  playableSources,
  prefersSaveData,
  setAudioSessionType,
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
 * 자체 Web Audio 래퍼 (의존성 0, min+gzip 약 4.8KB, React 바인딩 포함 5.7KB: P0-15 실측).
 *
 * 그래프: AudioBufferSourceNode(효과음) ─┐
 *         MediaElementSource(BGM 스트림) ─┼→ [파일 gain] → 카테고리 gain(sfx/bgm/voice) → master gain → destination
 *
 * - AudioContext는 첫 사용자 활성화 이벤트 안에서 만든다 (Chrome 경고·iOS 잠금 회피).
 * - 효과음: 제스처 전에는 core 파일 바이트만 fetch, unlock 후 decode → AudioBuffer 캐시.
 * - BGM: 기본은 'buffer'(전체 디코드 → AudioBufferSourceNode.loop). 루프 이음새가 없고, Web Audio만 쓰므로 iOS에서
 *   무음 스위치를 따르며(ambient), 제스처 밖에서도 재생된다. 대신 75초 스테레오 ≈ 26MB 메모리 → 현재 곡만 보관.
 *   'stream'(<audio> → MediaElementSource → GainNode)은 저사양·긴 곡용. iOS는 HTMLMediaElement.volume을 바꿀 수 없어
 *   GainNode로 볼륨·크로스페이드를 처리하고, <audio>는 unlock 제스처 안에서 load()해 두어 이후 재생을 허용받는다.
 * - 탭이 숨겨지면 BGM을 멈추고 컨텍스트를 suspend, 다시 보이면 resume (안 되면 다음 탭에서 unlock).
 */
export interface WebAudioEngineOptions {
  storage?: SettingsStorage | null;
  initialSettings?: SoundSettings;
  /** 기본 'ambient' (iOS 무음 스위치를 따름). null이면 건드리지 않는다 */
  audioSessionType?: AudioSessionTypeName | null;
  onMetric?: (m: SoundMetric) => void;
  onSettingsChange?: (s: SoundSettings) => void;
  /** resume()이 이 시간 안에 끝나지 않으면 다음 제스처에서 컨텍스트를 새로 만든다 (iOS 백그라운드 복귀 버그 대비) */
  resumeTimeoutMs?: number;
  /** 탭 숨김 후 suspend까지 대기 (효과음 꼬리) */
  suspendDelayMs?: number;
  /** 전체 동시 효과음 상한 */
  maxTotalVoices?: number;
  /**
   * true(기본): prefetch() 때 core 효과음을 OfflineAudioContext로 미리 디코드한다 (제스처 불필요, 자동재생 경고 없음).
   * AudioBuffer는 컨텍스트에 묶이지 않으므로 첫 탭부터 바로 재생된다. false면 바이트만 받고 unlock 후 디코드
   */
  predecode?: boolean;
}

interface Voice {
  src: AudioBufferSourceNode;
  out: AudioNode;
}

interface BgmSlot {
  el: HTMLAudioElement;
  node: MediaElementAudioSourceNode | null;
  buf: AudioBufferSourceNode | null;
  gain: GainNode;
  /** 이 슬롯에 로드된 곡 (일시정지 상태일 수 있음) */
  id: string | null;
  srcIndex: number;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

interface Prefetched {
  ab: ArrayBuffer;
  src: string;
}

function decode(ctx: BaseAudioContext, ab: ArrayBuffer): Promise<AudioBuffer> {
  // Safari 14.1 미만은 콜백형만 지원. 둘 다 처리
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(ab, resolve, reject) as Promise<AudioBuffer> | undefined;
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

function keysOf<K extends string>(o: Record<K, unknown>): K[] {
  return Object.keys(o) as K[];
}

export class WebAudioEngine<S extends string, B extends string> implements SoundEngine<S, B> {
  readonly kind = 'webaudio' as const;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cat: Record<SoundCategory, GainNode> | null = null;
  private settings: SoundSettings;
  private state: EngineState;
  private desiredBgm: B | null = null;
  private desiredFadeMs = 800;
  private playingBgm: B | null = null;
  private snapshot: EngineSnapshot<B>;
  private readonly listeners = new Set<() => void>();
  private readonly prefetched = new Map<S, Promise<Prefetched | null>>();
  private readonly buffers = new Map<S, AudioBuffer>();
  private readonly decoding = new Map<S, Promise<AudioBuffer | null>>();
  private readonly bgmBuffers = new Map<B, Promise<AudioBuffer | null>>();
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
  private readonly detach: Array<() => void> = [];

  constructor(
    private readonly manifest: SoundManifest<S, B>,
    private readonly options: WebAudioEngineOptions = {},
  ) {
    this.settings = options.initialSettings ?? options.storage?.load() ?? normalizeSettings(null);
    this.state = getAudioContextCtor() ? 'idle' : 'unsupported';
    this.snapshot = this.makeSnapshot();
    if (typeof document !== 'undefined') {
      this.hidden = document.visibilityState === 'hidden';
      const onVis = () => this.setHidden(document.visibilityState === 'hidden');
      const onHide = () => this.setHidden(true);
      const onShow = () => this.setHidden(document.visibilityState === 'hidden');
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('pagehide', onHide);
      window.addEventListener('pageshow', onShow);
      this.detach.push(() => {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('pagehide', onHide);
        window.removeEventListener('pageshow', onShow);
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

  /** 데모·테스트용 내부 상태 */
  debug() {
    const c = this.ctx;
    return {
      ctxState: c?.state ?? null,
      sampleRate: c?.sampleRate ?? null,
      baseLatency: c?.baseLatency ?? null,
      outputLatency: c && 'outputLatency' in c ? c.outputLatency : null,
      voices: this.totalVoices,
      voicesById: Object.fromEntries([...this.voices].map(([k, l]) => [k, l.length])),
      buffers: this.buffers.size,
      bgmGains: this.slots.map((s) => ({ id: s.id, gain: s.gain.gain.value, paused: s.el.paused })),
    };
  }

  private makeSnapshot(): EngineSnapshot<B> {
    return { state: this.state, settings: this.settings, desiredBgm: this.desiredBgm, playingBgm: this.playingBgm };
  }

  private emit(): void {
    this.snapshot = this.makeSnapshot();
    for (const l of this.listeners) l();
  }

  private metric(m: SoundMetric): void {
    this.options.onMetric?.(m);
  }

  private syncState(): void {
    const c = this.ctx;
    let st: EngineState;
    if (this.disposed) st = 'closed';
    else if (!c) st = getAudioContextCtor() ? 'idle' : 'unsupported';
    else if (c.state === 'running') st = 'running';
    else if ((c.state as string) === 'interrupted') st = 'interrupted';
    else if (c.state === 'closed') st = 'closed';
    else st = this.hidden ? 'suspended' : 'locked';
    if (st !== this.state) {
      this.state = st;
      this.metric({ type: 'state', state: st, ctxState: c?.state ?? null, t: performance.now() });
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
    const Ctor = getAudioContextCtor();
    if (!Ctor) {
      this.syncState();
      return false;
    }
    if (this.options.audioSessionType !== null) setAudioSessionType(this.options.audioSessionType ?? 'ambient');
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
    // BGM용 <audio> 2개 (크로스페이드). 제스처 안에서 load()해 두면 iOS가 이후 play()를 허용한다
    this.slots = [this.makeSlot(c), this.makeSlot(c)];
    c.addEventListener('statechange', () => this.syncState());
    this.syncState();
    return true;
  }

  private makeSlot(c: AudioContext): BgmSlot {
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(this.cat!.bgm);
    const el = new Audio();
    el.preload = 'none';
    el.loop = true;
    try {
      el.load();
    } catch {
      /* 무시 */
    }
    let node: MediaElementAudioSourceNode | null = null;
    try {
      node = c.createMediaElementSource(el);
      node.connect(gain);
    } catch {
      node = null; // 라우팅 불가 → 볼륨 제어 없이 직접 재생 (iOS 외 브라우저는 el.volume으로 보정)
    }
    return { el, node, buf: null, gain, id: null, srcIndex: 0, stopTimer: null };
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
    const timeout = this.options.resumeTimeoutMs ?? 1500;
    setTimeout(() => {
      if (!settled && this.ctx === c && c.state !== 'running') this.needsRecreate = true;
    }, timeout);
  }

  /** resume이 끝나지 않는 경우(iOS 백그라운드 복귀 버그) 컨텍스트를 새로 만든다. AudioBuffer는 재사용 */
  private recreate(): void {
    const old = this.ctx;
    for (const s of this.slots) {
      s.el.pause();
      s.el.removeAttribute('src');
      s.buf?.stop();
    }
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

  private afterRunning(): void {
    this.reconcileBgm(this.desiredFadeMs);
    if (this.warmed) return;
    this.warmed = true;
    if (effectiveGain(this.settings, 'sfx') === 0 && effectiveGain(this.settings, 'voice') === 0) {
      this.warmed = false; // 소리를 켜면 그때 준비
      return;
    }
    const core = keysOf(this.manifest.sfx).filter((id) => this.manifest.sfx[id].core);
    void Promise.all(core.map((id) => this.loadBuffer(id))).then(() => onIdle(() => void this.preload()));
  }

  // ───────────── 효과음 로딩 ─────────────

  prefetch(): void {
    if (this.disposed || prefersSaveData() || typeof fetch === 'undefined') return;
    if (effectiveGain(this.settings, 'sfx') === 0) return;
    const offline = this.options.predecode === false ? null : this.getOfflineContext();
    for (const id of keysOf(this.manifest.sfx)) {
      if (!this.manifest.sfx[id].core) continue;
      if (offline) void this.loadBuffer(id, offline);
      else void this.fetchBytes(id);
    }
  }

  private offline: OfflineAudioContext | null = null;

  private getOfflineContext(): OfflineAudioContext | null {
    if (this.offline) return this.offline;
    const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext };
    if (!w.OfflineAudioContext) return null;
    try {
      // 디코드 전용. 길이 1프레임, 48kHz (실제 컨텍스트와 레이트가 달라도 재생 시 리샘플된다)
      this.offline = new w.OfflineAudioContext(1, 1, 48000);
    } catch {
      this.offline = null;
    }
    return this.offline;
  }

  private fetchBytes(id: S): Promise<Prefetched | null> {
    const have = this.prefetched.get(id);
    if (have) return have;
    const src = playableSources(this.manifest.sfx[id].src)[0];
    const p: Promise<Prefetched | null> = src
      ? fetch(src)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((ab) => ({ ab, src }))
          .catch(() => null)
      : Promise.resolve(null);
    this.prefetched.set(id, p);
    return p;
  }

  async preload(ids?: readonly S[]): Promise<void> {
    if (!this.ctx) return;
    const list = ids ?? keysOf(this.manifest.sfx);
    for (let i = 0; i < list.length; i += 4) {
      await Promise.all(list.slice(i, i + 4).map((id) => this.loadBuffer(id)));
    }
  }

  private loadBuffer(id: S, via?: BaseAudioContext): Promise<AudioBuffer | null> {
    const have = this.buffers.get(id);
    if (have) return Promise.resolve(have);
    const inflight = this.decoding.get(id);
    if (inflight) return inflight;
    const c = via ?? this.ctx;
    if (!c) return Promise.resolve(null);
    const p = (async () => {
      const candidates = playableSources(this.manifest.sfx[id].src);
      const pre = await this.prefetched.get(id);
      this.prefetched.delete(id);
      for (const src of candidates) {
        try {
          let ab: ArrayBuffer;
          if (pre && pre.src === src) ab = pre.ab;
          else {
            const r = await fetch(src);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            ab = await r.arrayBuffer();
          }
          const bytes = ab.byteLength;
          const t0 = performance.now();
          const buf = await decode(c, ab);
          this.metric({ type: 'decode', id, src, bytes, ms: performance.now() - t0, duration: buf.duration, sampleRate: buf.sampleRate });
          this.buffers.set(id, buf);
          return buf;
        } catch (e) {
          // canPlayType은 통과했지만 decodeAudioData가 못 여는 경우 → 다음 후보 (예: 구형 Safari의 WebM/Opus)
          this.metric({ type: 'decode-error', id, src, message: e instanceof Error ? e.message : String(e) });
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
      // unlock 리스너(capture)가 먼저 돌기 때문에 보통 여기 오지 않는다. 제스처 밖 자동 재생 시도는 버린다
      this.metric({ type: 'drop', id, reason: 'locked' });
      return;
    }
    if (c.state !== 'running') this.resume();
    const buf = this.buffers.get(id);
    if (buf) {
      this.startVoice(id, buf, opts);
      return;
    }
    const t0 = performance.now();
    const tolerance = opts.lateToleranceMs ?? 250;
    void this.loadBuffer(id).then((b) => {
      if (!b) return;
      if (performance.now() - t0 <= tolerance) this.startVoice(id, b, opts);
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
    if (!this.manifest.bgm[id]) return;
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

  /** 원하는 BGM(desired)과 설정·가시성·컨텍스트 상태를 맞춘다 */
  private reconcileBgm(fadeMs: number): void {
    const c = this.ctx;
    const want =
      this.desiredBgm && !this.hidden && c?.state === 'running' && effectiveGain(this.settings, 'bgm') > 0
        ? this.desiredBgm
        : null;
    if (want === this.playingBgm) return;
    if (this.activeSlot >= 0) this.fadeOutSlot(this.slots[this.activeSlot]!, fadeMs);
    this.activeSlot = -1;
    this.playingBgm = null;
    if (want && c) {
      // 같은 곡이 일시정지된 슬롯이 있으면 이어서, 아니면 번갈아 사용
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
    const now = c.currentTime;
    g.gain.cancelScheduledValues(now);
    if (ms <= 0) {
      g.gain.setValueAtTime(to, now);
      return;
    }
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(to, now + ms / 1000);
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
      void this.loadBgmBuffer(id).then((buf) => {
        if (!buf || this.playingBgm !== id || this.slots[i] !== slot) return;
        slot.buf?.stop();
        const s = c.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.connect(slot.gain);
        s.start();
        slot.buf = s;
        slot.id = id;
        this.ramp(slot.gain, target, fadeMs);
      });
      return true;
    }
    const candidates = playableSources(def.src);
    if (candidates.length === 0) return false;
    const el = slot.el;
    if (slot.id !== id) {
      slot.id = id;
      slot.srcIndex = 0;
      el.preload = 'auto';
      el.src = candidates[0]!;
      el.onerror = () => {
        // 다음 포맷으로 폴백
        slot.srcIndex++;
        const next = candidates[slot.srcIndex];
        if (next && slot.id === id) {
          el.src = next;
          void el.play().catch(() => {});
        }
      };
    }
    if (!slot.node) el.volume = Math.min(1, target * effectiveGain(this.settings, 'bgm'));
    const t0 = performance.now();
    el.addEventListener('playing', () => this.metric({ type: 'bgm-playing', id, src: el.currentSrc, ms: performance.now() - t0 }), {
      once: true,
    });
    el.play().catch((e: unknown) =>
      this.metric({ type: 'decode-error', id, src: el.currentSrc, message: e instanceof Error ? e.name : String(e) }),
    );
    this.ramp(slot.gain, target, fadeMs);
    return true;
  }

  private fadeOutSlot(slot: BgmSlot, fadeMs: number): void {
    if (!this.ctx) return;
    this.ramp(slot.gain, 0, fadeMs);
    const stop = () => {
      slot.stopTimer = null;
      slot.el.pause(); // src는 유지 → 같은 곡으로 돌아오면 이어서 재생
      if (slot.buf) {
        try {
          slot.buf.stop();
        } catch {
          /* 무시 */
        }
        slot.buf.disconnect();
        slot.buf = null;
        // 디코드된 BGM은 수십 MB → 지금 원하는 곡이 아니면 버린다 (다시 오면 재디코드)
        if (slot.id && slot.id !== this.desiredBgm) this.bgmBuffers.delete(slot.id as B);
        slot.id = null;
      }
    };
    if (slot.stopTimer) clearTimeout(slot.stopTimer);
    if (fadeMs <= 0) stop();
    else slot.stopTimer = setTimeout(stop, fadeMs + 50);
  }

  private loadBgmBuffer(id: B): Promise<AudioBuffer | null> {
    const have = this.bgmBuffers.get(id);
    if (have) return have;
    const c = this.ctx;
    if (!c) return Promise.resolve(null);
    const p = (async () => {
      for (const src of playableSources(this.manifest.bgm[id].src)) {
        try {
          const r = await fetch(src);
          const ab = await r.arrayBuffer();
          const bytes = ab.byteLength; // decodeAudioData가 ArrayBuffer를 분리(detach)하므로 먼저 읽는다
          const t0 = performance.now();
          const buf = await decode(c, ab);
          this.metric({ type: 'decode', id, src, bytes, ms: performance.now() - t0, duration: buf.duration, sampleRate: buf.sampleRate });
          return buf;
        } catch (e) {
          this.metric({ type: 'decode-error', id, src, message: e instanceof Error ? e.message : String(e) });
        }
      }
      return null;
    })();
    this.bgmBuffers.set(id, p);
    return p;
  }

  // ───────────── 가시성 ─────────────

  private setHidden(hidden: boolean): void {
    if (hidden === this.hidden || this.disposed) return;
    this.hidden = hidden;
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    const c = this.ctx;
    if (hidden) {
      this.reconcileBgm(0);
      this.suspendTimer = setTimeout(() => {
        if (this.hidden && c && c.state === 'running') c.suspend().then(() => this.syncState(), () => {});
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
    for (const k of ['sfx', 'bgm', 'voice'] as const) set(this.cat[k], s[k].enabled ? s[k].volume : 0);
  }

  setSettings(patch: SoundSettingsPatch): void {
    this.settings = mergeSettings(this.settings, patch);
    this.applyGains();
    this.options.storage?.save(this.settings);
    this.options.onSettingsChange?.(this.settings);
    this.emit();
    this.reconcileBgm(400);
    if (this.ctx?.state === 'running') this.afterRunning();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const d of this.detach) d();
    for (const s of this.slots) {
      s.el.pause();
      s.el.removeAttribute('src');
    }
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.listeners.clear();
    this.state = 'closed';
  }
}

export function createWebAudioEngine<S extends string, B extends string>(
  manifest: SoundManifest<S, B>,
  options?: WebAudioEngineOptions,
): WebAudioEngine<S, B> {
  return new WebAudioEngine(manifest, options);
}
