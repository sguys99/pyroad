import { DEFAULT_SOUND_SETTINGS } from './settings';
import type { EngineSnapshot, SoundEngine } from './types';

/**
 * 서버 스냅샷 (모든 요청에서 같은 참조여야 한다). 하이드레이션 직후 클라이언트 첫 상태(`idle`)와 같게 둔다.
 * 클라이언트는 `useSyncExternalStore`의 getServerSnapshot으로 불일치 없이 시작한 뒤 실제 설정으로 다시 그린다.
 */
export const SERVER_SNAPSHOT: EngineSnapshot<never> = Object.freeze({
  state: 'idle',
  settings: DEFAULT_SOUND_SETTINGS,
  desiredBgm: null,
  playingBgm: null,
  bgmAllowed: true,
}) as EngineSnapshot<never>;

const UNSUPPORTED_SNAPSHOT: EngineSnapshot<never> = Object.freeze({
  ...SERVER_SNAPSHOT,
  state: 'unsupported',
}) as EngineSnapshot<never>;

const noop = () => {};

/**
 * 서버 렌더·Provider 밖·Web Audio 미지원 환경용. 모든 호출이 아무 일도 하지 않는다 (SSR에서 Web Audio 접근 없음).
 */
export function createNoopEngine<
  S extends string = string,
  B extends string = string,
>(): SoundEngine<S, B> {
  return {
    kind: 'noop',
    getSnapshot: () => UNSUPPORTED_SNAPSHOT,
    subscribe: () => noop,
    onUserSettings: () => noop,
    unlock: noop,
    prefetch: noop,
    prefetchBgm: noop,
    preload: () => Promise.resolve(),
    play: noop,
    playBgm: noop,
    stopBgm: noop,
    setSettings: noop,
    adoptSettings: noop,
    setBgmAllowed: noop,
    dispose: noop,
  };
}
