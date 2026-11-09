/**
 * 사운드 엔진 타입 (§2.5, P0-15 → P2-14). 프레임워크 독립: React 바인딩은 `src/components/providers/SoundProvider.tsx`.
 * 규칙 문서: docs/design/sound.md
 */

export type SoundCategory = 'sfx' | 'bgm' | 'voice';

export interface CategorySetting {
  enabled: boolean;
  /** 0..1 (선형 gain) */
  volume: number;
}

/**
 * 사용자 사운드 설정. 기기(localStorage)에 두고, 로그인하면 `users.settings.sound`(00012 기본값과 같은 모양)와 동기화한다.
 * 필드를 늘리면 version을 올리고 `normalizeSettings()`에서 옮긴다. 서버 쓰기 검증은 `schema.ts`(zod strict).
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
  /** 기기 사이 동기화의 last-write-wins 판단용 (epoch ms) */
  updatedAt: number;
}

export type SoundSettingsPatch = Partial<
  Pick<SoundSettings, 'muted' | 'master'>
> & {
  [K in SoundCategory]?: Partial<CategorySetting>;
};

export interface SfxDef {
  /** 우선순위 순 후보 URL. 확장자로 MIME을 판단해 재생 가능한 첫 파일을 쓴다 ([.webm, .m4a]) */
  src: readonly string[];
  /** 기본 'sfx'. 파이뱀 읽어주기 같은 음성은 'voice' */
  category?: 'sfx' | 'voice';
  /** 파일별 보정 gain (0..1). 라우드니스 정규화 뒤 미세 조정용 */
  gain?: number;
  /** 같은 효과음 동시 재생 상한. 넘으면 가장 오래된 것을 멈춘다 (코인 연타 대비). 기본 4 */
  maxVoices?: number;
  /** true면 첫 제스처 전 유휴 시간에 미리 디코드한다 (탭·정답·오답처럼 첫 탭부터 바로 나야 하는 것) */
  core?: boolean;
  /** true면 출력 지연이 150ms를 넘을 때(블루투스 이어폰 등) 재생하지 않는다 — 글자보다 늦게 들리면 어색한 대사 블립 (P0-15 §4.7) */
  latencySensitive?: boolean;
}

export interface BgmDef {
  src: readonly string[];
  gain?: number;
  /**
   * 'buffer'(기본): 전체 디코드 후 AudioBufferSourceNode.loop. 루프 이음새 0ms, iOS 무음 스위치를 따름.
   *   메모리 = 길이(s) × 샘플레이트 × 채널 × 4바이트 (75초 스테레오 48kHz ≈ 29MB). 지금 곡만 보관한다.
   * 'stream': <audio> + MediaElementAudioSourceNode → GainNode. 메모리가 적지만 <audio loop>는 루프마다 5~40ms 끊긴다
   *   (Chromium 실측). 저사양 대비로만 남겨 둔다.
   */
  mode?: 'stream' | 'buffer';
}

export interface SoundManifest<
  S extends string = string,
  B extends string = string,
> {
  sfx: Record<S, SfxDef>;
  bgm: Record<B, BgmDef>;
}

/**
 * idle: 아직 AudioContext 없음 (첫 제스처 전)
 * locked: 컨텍스트는 있지만 suspended (제스처로 resume 필요)
 * running: 재생 가능
 * suspended: 탭이 숨겨져 엔진이 스스로 멈춤
 * interrupted: iOS Safari 전용 상태 (전화·화면 꺼짐 등). 다음 제스처에서 resume
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
  /** 크로스페이드·페이드 시간 (ms). 기본 800 */
  fadeMs?: number;
}

export interface EngineSnapshot<B extends string = string> {
  state: EngineState;
  settings: SoundSettings;
  /** 페이지가 원하는 BGM (설정이 꺼져 있으면 실제로는 재생되지 않음) */
  desiredBgm: B | null;
  /** 실제로 소리가 나고 있는 BGM */
  playingBgm: B | null;
  /** 연출 단계가 BGM을 허용하는지 (minimal이면 false, P0-16 §4.5). 사용자 BGM 설정과 함께 본다 */
  bgmAllowed: boolean;
}

export type SoundMetric =
  | {
      type: 'decode';
      id: string;
      src: string;
      bytes: number;
      ms: number;
      duration: number;
    }
  | { type: 'decode-error'; id: string; src: string; message: string }
  | { type: 'state'; state: EngineState; ctxState: string | null }
  | { type: 'drop'; id: string; reason: string };

export interface SoundEngine<
  S extends string = string,
  B extends string = string,
> {
  readonly kind: 'webaudio' | 'noop';
  getSnapshot(): EngineSnapshot<B>;
  subscribe(listener: () => void): () => void;
  /** 사용자가 설정을 바꿀 때만 불린다 (`setSettings`). 서버 값 반영(`adoptSettings`)에는 불리지 않음 → 서버 저장용 */
  onUserSettings(listener: (s: SoundSettings) => void): () => void;
  /** 반드시 사용자 활성화 이벤트(pointerup·touchend·keydown·click 등) 핸들러 안에서 동기 호출 */
  unlock(): void;
  /** 제스처 전: 자주 쓰는 효과음(core)을 미리 디코드해 둔다 (OfflineAudioContext, 제스처 불필요) */
  prefetch(): void;
  /** BGM 파일을 HTTP 캐시에만 미리 받아 둔다(디코드 안 함). BGM 설정이 켜져 있고 데이터 절약·느린 연결이 아닐 때만, 곡마다 한 번 */
  prefetchBgm(ids: readonly B[]): void;
  /** unlock 뒤: 지정한(없으면 전체) 효과음을 디코드해 둔다 */
  preload(ids?: readonly S[]): Promise<void>;
  play(id: S, opts?: PlayOptions): void;
  /** 이 BGM을 원한다고 선언. 설정·연출 단계가 허용하고 탭이 보일 때만 실제로 재생 (다른 곡이면 크로스페이드) */
  playBgm(id: B, opts?: BgmOptions): void;
  stopBgm(opts?: BgmOptions): void;
  /** 사용자 변경: 적용 + 기기 저장 + `onUserSettings` 알림 */
  setSettings(patch: SoundSettingsPatch): void;
  /** 서버·다른 탭 값 반영: 적용 + 기기 저장 (알림 없음) */
  adoptSettings(next: SoundSettings): void;
  /** 연출 단계의 BGM 허용 (`useMotionTier().budget.bgm`) */
  setBgmAllowed(allowed: boolean): void;
  dispose(): void;
}
