import { Howl, Howler } from 'howler';
import { effectiveGain, mergeSettings, normalizeSettings, type SettingsStorage } from './settings';
import { setAudioSessionType, type AudioSessionTypeName } from './platform';
import type {
  BgmOptions,
  EngineSnapshot,
  EngineState,
  PlayOptions,
  SoundEngine,
  SoundManifest,
  SoundMetric,
  SoundSettings,
  SoundSettingsPatch,
} from './types';

/**
 * 비교용: 같은 SoundEngine 인터페이스를 Howler로 구현한 버전.
 * §2.5 원안(use-sound/Howler 기반 SoundProvider)을 실제로 만들면 이 정도 래퍼가 필요하다는 것을 보여 준다.
 * Howler에 없는 것(카테고리 볼륨, 효과음별 동시 재생 상한, 가시성 처리, audioSession)은 직접 구현했다.
 */
export interface HowlerEngineOptions {
  storage?: SettingsStorage | null;
  initialSettings?: SoundSettings;
  audioSessionType?: AudioSessionTypeName | null;
  onMetric?: (m: SoundMetric) => void;
  /**
   * true: 생성 즉시 Howl을 만든다 (use-sound가 마운트 때 하는 방식 → 제스처 전에 AudioContext 생성).
   * false: 첫 unlock() 때 만든다.
   */
  eager?: boolean;
  /** Howler 기본값 true (30초 무음이면 컨텍스트 suspend → 다음 첫 소리가 resume을 기다림) */
  autoSuspend?: boolean;
}

export class HowlerEngine<S extends string, B extends string> implements SoundEngine<S, B> {
  readonly kind = 'howler' as const;
  private settings: SoundSettings;
  private state: EngineState = 'idle';
  private snapshot: EngineSnapshot<B>;
  private readonly listeners = new Set<() => void>();
  private sfx: Partial<Record<S, Howl>> = {};
  private bgm: Partial<Record<B, Howl>> = {};
  private readonly voiceIds = new Map<S, number[]>();
  private desiredBgm: B | null = null;
  private playingBgm: B | null = null;
  private desiredFadeMs = 800;
  private hidden = false;
  private created = false;
  private readonly detach: Array<() => void> = [];

  constructor(
    private readonly manifest: SoundManifest<S, B>,
    private readonly options: HowlerEngineOptions = {},
  ) {
    this.settings = options.initialSettings ?? options.storage?.load() ?? normalizeSettings(null);
    Howler.autoSuspend = options.autoSuspend ?? true;
    this.snapshot = this.makeSnapshot();
    if (options.eager) this.createHowls();
    if (typeof document !== 'undefined') {
      const onVis = () => this.setHidden(document.visibilityState === 'hidden');
      document.addEventListener('visibilitychange', onVis);
      this.detach.push(() => document.removeEventListener('visibilitychange', onVis));
    }
  }

  getSnapshot(): EngineSnapshot<B> {
    return this.snapshot;
  }

  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  debug() {
    const c = Howler.ctx as AudioContext | undefined;
    return {
      ctxState: c?.state ?? null,
      sampleRate: c?.sampleRate ?? null,
      howlerState: (Howler as unknown as { state?: string }).state ?? null,
      usingWebAudio: Howler.usingWebAudio,
      voices: [...this.voiceIds.values()].reduce((n, l) => n + l.length, 0),
    };
  }

  private makeSnapshot(): EngineSnapshot<B> {
    return { state: this.state, settings: this.settings, desiredBgm: this.desiredBgm, playingBgm: this.playingBgm };
  }

  private emit(): void {
    this.snapshot = this.makeSnapshot();
    for (const l of this.listeners) l();
  }

  private syncState(): void {
    const c = Howler.ctx as AudioContext | undefined;
    const cs = c?.state as string | undefined;
    const st: EngineState = !c ? 'idle' : cs === 'running' ? 'running' : cs === 'interrupted' ? 'interrupted' : this.hidden ? 'suspended' : 'locked';
    if (st !== this.state) {
      this.state = st;
      this.options.onMetric?.({ type: 'state', state: st, ctxState: cs ?? null, t: performance.now() });
      this.emit();
    }
  }

  private catVolume(cat: 'sfx' | 'bgm' | 'voice'): number {
    // master·mute는 Howler 전역(volume/mute)으로, 카테고리는 Howl별 volume으로 곱한다
    const s = this.settings;
    return s[cat].enabled ? s[cat].volume : 0;
  }

  private createHowls(): void {
    if (this.created) return;
    this.created = true;
    if (this.options.audioSessionType !== null) setAudioSessionType(this.options.audioSessionType ?? 'ambient');
    for (const id of Object.keys(this.manifest.sfx) as S[]) {
      const def = this.manifest.sfx[id];
      const t0 = performance.now();
      const h = new Howl({
        src: [...def.src],
        volume: (def.gain ?? 1) * this.catVolume(def.category ?? 'sfx'),
        preload: true,
        onload: () =>
          this.options.onMetric?.({
            type: 'decode',
            id,
            src: (h as unknown as { _src: string })._src,
            bytes: 0,
            ms: performance.now() - t0, // Howler는 fetch+decode를 구분해 주지 않는다
            duration: h.duration(),
            sampleRate: (Howler.ctx as AudioContext | undefined)?.sampleRate ?? 0,
          }),
        onloaderror: (_sid, err) => this.options.onMetric?.({ type: 'decode-error', id, src: String(def.src[0]), message: String(err) }),
      });
      this.sfx[id] = h;
    }
    Howler.volume(this.settings.master);
    Howler.mute(this.settings.muted);
    const c = Howler.ctx as AudioContext | undefined;
    c?.addEventListener('statechange', () => this.syncState());
    this.syncState();
  }

  unlock(): void {
    this.createHowls();
    const c = Howler.ctx as AudioContext | undefined;
    if (c && c.state !== 'running') void c.resume().then(() => this.syncState());
    this.syncState();
  }

  prefetch(): void {
    /* Howler는 Howl 생성 = fetch+decode. 바이트만 미리 받는 단계가 없다 */
  }

  async preload(): Promise<void> {
    this.createHowls();
  }

  play(id: S, opts: PlayOptions = {}): void {
    const def = this.manifest.sfx[id];
    const h = this.sfx[id];
    if (!def || !h || effectiveGain(this.settings, def.category ?? 'sfx') === 0) return;
    const ids = this.voiceIds.get(id) ?? [];
    const max = def.maxVoices ?? 4;
    while (ids.length >= max) h.stop(ids.shift());
    const sid = h.play();
    if (opts.rate) h.rate(opts.rate, sid);
    if (opts.gain !== undefined) h.volume((def.gain ?? 1) * this.catVolume(def.category ?? 'sfx') * opts.gain, sid);
    ids.push(sid);
    this.voiceIds.set(id, ids);
    h.once('end', () => {
      const l = this.voiceIds.get(id);
      const i = l ? l.indexOf(sid) : -1;
      if (l && i >= 0) l.splice(i, 1);
    }, sid);
  }

  private ensureBgm(id: B): Howl {
    let h = this.bgm[id];
    if (!h) {
      const def = this.manifest.bgm[id];
      const t0 = performance.now();
      // 긴 파일은 html5: true (스트리밍). iOS에서는 HTMLMediaElement.volume을 바꿀 수 없어 fade/volume이 듣지 않는다
      h = new Howl({ src: [...def.src], html5: def.mode === 'stream', loop: true, volume: 0 });
      h.once('play', () => this.options.onMetric?.({ type: 'bgm-playing', id, src: String(def.src[0]), ms: performance.now() - t0 }));
      this.bgm[id] = h;
    }
    return h;
  }

  private reconcileBgm(fadeMs: number): void {
    const want = this.desiredBgm && !this.hidden && effectiveGain(this.settings, 'bgm') > 0 ? this.desiredBgm : null;
    if (want === this.playingBgm) return;
    if (this.playingBgm) {
      const old = this.bgm[this.playingBgm];
      if (old) {
        old.fade(old.volume(), 0, Math.max(1, fadeMs));
        old.once('fade', () => old.pause());
      }
    }
    this.playingBgm = want;
    if (want) {
      const h = this.ensureBgm(want);
      const target = (this.manifest.bgm[want].gain ?? 1) * this.catVolume('bgm');
      if (!h.playing()) h.play();
      h.fade(h.volume(), target, Math.max(1, fadeMs));
    }
    this.emit();
  }

  playBgm(id: B, opts: BgmOptions = {}): void {
    this.desiredBgm = id;
    this.desiredFadeMs = opts.fadeMs ?? 800;
    this.reconcileBgm(this.desiredFadeMs);
  }

  stopBgm(opts: BgmOptions = {}): void {
    this.desiredBgm = null;
    this.reconcileBgm(opts.fadeMs ?? 800);
  }

  private setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    this.reconcileBgm(hidden ? 1 : 600);
    const c = Howler.ctx as AudioContext | undefined;
    if (c) void (hidden ? c.suspend() : c.resume()).then(() => this.syncState(), () => {});
  }

  setSettings(patch: SoundSettingsPatch): void {
    this.settings = mergeSettings(this.settings, patch);
    this.options.storage?.save(this.settings);
    Howler.volume(this.settings.master);
    Howler.mute(this.settings.muted);
    for (const id of Object.keys(this.sfx) as S[]) {
      const def = this.manifest.sfx[id];
      this.sfx[id]?.volume((def.gain ?? 1) * this.catVolume(def.category ?? 'sfx'));
    }
    if (this.playingBgm) this.bgm[this.playingBgm]?.volume((this.manifest.bgm[this.playingBgm].gain ?? 1) * this.catVolume('bgm'));
    this.reconcileBgm(400);
    this.emit();
  }

  dispose(): void {
    for (const d of this.detach) d();
    Howler.unload();
    this.listeners.clear();
  }
}

export function createHowlerEngine<S extends string, B extends string>(
  manifest: SoundManifest<S, B>,
  options?: HowlerEngineOptions,
): HowlerEngine<S, B> {
  return new HowlerEngine(manifest, options);
}
