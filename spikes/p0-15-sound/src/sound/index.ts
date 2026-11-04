import { createNoopEngine } from './noopEngine';
import { createLocalSettingsStorage } from './settings';
import { createWebAudioEngine, type WebAudioEngineOptions } from './webAudioEngine';
import type { SoundEngine, SoundManifest } from './types';

export * from './types';
export * from './settings';
export { attachUnlockListeners, setAudioSessionType, getAudioSessionType, playableSources } from './platform';
export { createNoopEngine, SERVER_SNAPSHOT } from './noopEngine';
export { createWebAudioEngine } from './webAudioEngine';

let singleton: SoundEngine<string, string> | null = null;

/**
 * 앱 전체에서 엔진 1개 (AudioContext 1개). 서버에서는 매번 no-op 엔진.
 * React StrictMode의 이중 렌더·이펙트에서도 AudioContext가 두 번 생기지 않도록 모듈 싱글턴으로 둔다.
 */
export function getSoundEngine<S extends string, B extends string>(
  manifest: SoundManifest<S, B>,
  options: WebAudioEngineOptions = {},
): SoundEngine<S, B> {
  if (typeof window === 'undefined') return createNoopEngine<S, B>();
  singleton ??= createWebAudioEngine(manifest, {
    storage: createLocalSettingsStorage(),
    ...options,
  }) as unknown as SoundEngine<string, string>;
  return singleton as unknown as SoundEngine<S, B>;
}

/** 테스트용 */
export function resetSoundEngineForTest(): void {
  singleton?.dispose();
  singleton = null;
}
