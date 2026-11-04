import { normalizeSettings, mergeSettings } from './settings';
import type { EngineSnapshot, SoundEngine, SoundSettings, SoundSettingsPatch } from './types';

/**
 * 서버 렌더링(SSR)·Web Audio 미지원 환경용. 모든 호출이 아무 일도 하지 않는다.
 * 서버 스냅샷은 항상 기본 설정이므로, 클라이언트는 useSyncExternalStore의 getServerSnapshot으로
 * 하이드레이션 불일치 없이 시작한 뒤 실제 설정으로 다시 그린다.
 */
export function createNoopEngine<S extends string = string, B extends string = string>(
  initial?: SoundSettings,
): SoundEngine<S, B> {
  let settings = initial ?? normalizeSettings(null);
  let snapshot: EngineSnapshot<B> = { state: 'unsupported', settings, desiredBgm: null, playingBgm: null };
  return {
    kind: 'noop',
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    unlock() {},
    prefetch() {},
    preload: () => Promise.resolve(),
    play() {},
    playBgm() {},
    stopBgm() {},
    setSettings(patch: SoundSettingsPatch) {
      settings = mergeSettings(settings, patch);
      snapshot = { ...snapshot, settings };
    },
    dispose() {},
  };
}

/** 서버 스냅샷 (모든 요청에서 동일한 참조여야 한다) */
export const SERVER_SNAPSHOT: EngineSnapshot<never> = Object.freeze({
  state: 'idle', // 하이드레이션 직후 클라이언트 첫 상태와 같게
  settings: normalizeSettings(null),
  desiredBgm: null,
  playingBgm: null,
}) as EngineSnapshot<never>;
