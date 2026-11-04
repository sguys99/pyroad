/**
 * P0-15 사운드 스파이크: 프레임워크 독립 사운드 엔진 타입.
 * React 바인딩(src/react)과 엔진 구현(webAudioEngine / howlerEngine / noopEngine)이 공유한다.
 */

export type SoundCategory = 'sfx' | 'bgm' | 'voice';

export interface CategorySetting {
  enabled: boolean;
  /** 0..1 (선형 gain) */
  volume: number;
}

/**
 * 사용자 사운드 설정. 지금은 localStorage, 이후 `users.settings.sound`(jsonb)에 그대로 저장한다.
 * 필드 추가 시 version을 올리고 normalizeSettings()에서 마이그레이션한다.
 */
export interface SoundSettings {
  version: 1;
  /** HUD 음소거 토글. true면 모든 카테고리 무음 */
  muted: boolean;
  /** 0..1 */
  master: number;
  sfx: CategorySetting;
  bgm: CategorySetting;
  voice: CategorySetting;
  /** 기기 간 동기화 시 last-write-wins 판단용 (epoch ms) */
  updatedAt: number;
}

export type SoundSettingsPatch = Partial<Pick<SoundSettings, 'muted' | 'master'>> & {
  [K in SoundCategory]?: Partial<CategorySetting>;
};

export interface SfxDef {
  /** 우선순위 순 후보 URL. 확장자로 MIME을 판단해 재생 가능한 첫 파일을 쓴다 (예: [.webm, .mp3]) */
  src: readonly string[];
  /** 기본 'sfx'. 파이뱀 읽어주기 같은 음성은 'voice' */
  category?: 'sfx' | 'voice';
  /** 파일별 보정 gain (0..1). 라우드니스 정규화 후 미세 조정용 */
  gain?: number;
  /** 같은 효과음 동시 재생 상한. 넘으면 가장 오래된 것을 멈춘다 (코인 연타 대비) */
  maxVoices?: number;
  /** true면 첫 제스처 전에 바이트만 미리 받아 둔다 (탭, 정답, 오답 등 자주 쓰는 것) */
  core?: boolean;
}

export interface BgmDef {
  src: readonly string[];
  gain?: number;
  /**
   * 'buffer'(기본): 전체 디코드 후 AudioBufferSourceNode.loop. 루프 이음새 0ms, iOS 무음 스위치를 따름.
   *   메모리 = 길이(s) × 샘플레이트 × 채널 × 4바이트 (75초 스테레오 44.1kHz ≈ 26.5MB).
   * 'stream': <audio> 스트리밍 + MediaElementAudioSourceNode → GainNode. 메모리 적음.
   *   단 <audio loop>는 루프마다 5~40ms 끊김(Chromium 실측), iOS에서는 무음 스위치를 무시할 수 있음.
   */
  mode?: 'stream' | 'buffer';
}

export interface SoundManifest<S extends string = string, B extends string = string> {
  sfx: Record<S, SfxDef>;
  bgm: Record<B, BgmDef>;
}

/**
 * idle: 아직 AudioContext 없음 (첫 제스처 전)
 * locked: 컨텍스트는 있지만 suspended (제스처로 resume 필요)
 * running: 재생 가능
 * suspended: 탭이 숨겨져 엔진이 스스로 멈춤
 * interrupted: iOS Safari 전용 상태 (전화, 화면 꺼짐 등). 다음 제스처에서 resume
 * unsupported: Web Audio 없음 → 무음으로 동작
 */
export type EngineState =
  | 'idle'
  | 'locked'
  | 'running'
  | 'suspended'
  | 'interrupted'
  | 'unsupported'
  | 'closed';

export interface PlayOptions {
  /** 재생 속도(=피치). 별 1→3 상승음에 1, 1.26, 1.5 (장3화음) */
  rate?: number;
  /** 이번 재생에만 곱할 gain */
  gain?: number;
  /** 버퍼가 아직 준비되지 않았을 때, 준비되면 이 시간(ms) 안이면 늦게라도 재생. 기본 250 */
  lateToleranceMs?: number;
}

export interface BgmOptions {
  /** 크로스페이드/페이드 시간 (ms). 기본 800 */
  fadeMs?: number;
}

export interface EngineSnapshot<B extends string = string> {
  state: EngineState;
  settings: SoundSettings;
  /** 페이지가 원하는 BGM (설정이 꺼져 있으면 실제로는 재생되지 않음) */
  desiredBgm: B | null;
  /** 실제로 소리가 나고 있는 BGM */
  playingBgm: B | null;
}

export type SoundMetric =
  | { type: 'decode'; id: string; src: string; bytes: number; ms: number; duration: number; sampleRate: number }
  | { type: 'decode-error'; id: string; src: string; message: string }
  | { type: 'state'; state: EngineState; ctxState: string | null; t: number }
  | { type: 'bgm-playing'; id: string; src: string; ms: number }
  | { type: 'drop'; id: string; reason: string };

export interface SoundEngine<S extends string = string, B extends string = string> {
  readonly kind: 'webaudio' | 'howler' | 'noop';
  getSnapshot(): EngineSnapshot<B>;
  subscribe(listener: () => void): () => void;
  /** 반드시 사용자 활성화 이벤트(pointerup/touchend/keydown/click 등) 핸들러 안에서 동기 호출 */
  unlock(): void;
  /** 제스처 전: 자주 쓰는 효과음(core) 바이트만 받아 둔다. 디코드는 unlock 후 */
  prefetch(): void;
  /** unlock 후: 지정한(없으면 전체) 효과음을 디코드해 둔다 */
  preload(ids?: readonly S[]): Promise<void>;
  play(id: S, opts?: PlayOptions): void;
  /** 이 BGM을 원한다고 선언. 설정이 허용하고 탭이 보일 때만 실제로 재생 (다른 곡이면 크로스페이드) */
  playBgm(id: B, opts?: BgmOptions): void;
  stopBgm(opts?: BgmOptions): void;
  setSettings(patch: SoundSettingsPatch): void;
  dispose(): void;
}
