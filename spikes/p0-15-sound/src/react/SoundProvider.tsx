'use client';

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import {
  attachUnlockListeners,
  getSoundEngine,
  pickNewerSettings,
  SERVER_SNAPSHOT,
  type EngineSnapshot,
  type PlayOptions,
  type SoundEngine,
  type SoundManifest,
  type SoundSettings,
  type SoundSettingsPatch,
} from '../sound';

/**
 * 앱 루트 레이아웃에 1번 둔다 (MotionProvider 옆).
 * - 서버: no-op 엔진 + 기본 설정 스냅샷 → 하이드레이션 불일치 없음
 * - 클라이언트: 모듈 싱글턴 엔진. AudioContext는 첫 사용자 활성화 이벤트에서 생성
 */
const SoundContext = createContext<SoundEngine<string, string> | null>(null);

export interface SoundProviderProps<S extends string, B extends string> {
  manifest: SoundManifest<S, B>;
  children: ReactNode;
  /** 로그인 사용자의 users.settings.sound (서버 컴포넌트에서 내려줌). 로컬 값보다 최신이면 적용 */
  serverSettings?: unknown;
  /** 설정이 바뀔 때 서버 저장 (PATCH /api/settings). 디바운스는 호출부에서 */
  onSettingsChange?: (s: SoundSettings) => void;
}

export function SoundProvider<S extends string, B extends string>({
  manifest,
  children,
  serverSettings,
  onSettingsChange,
}: SoundProviderProps<S, B>) {
  // 싱글턴이라 렌더 중 호출해도 안전 (AudioContext를 만들지 않음, 서버에서는 no-op)
  const engine = getSoundEngine(manifest) as unknown as SoundEngine<string, string>;

  useEffect(() => {
    const detach = attachUnlockListeners(engine);
    engine.prefetch();
    return detach;
  }, [engine]);

  useEffect(() => {
    if (serverSettings === undefined) return;
    const cur = engine.getSnapshot().settings;
    const next = pickNewerSettings(cur, serverSettings);
    if (next !== cur) engine.setSettings(next);
  }, [engine, serverSettings]);

  useEffect(() => {
    if (!onSettingsChange) return;
    let last = engine.getSnapshot().settings;
    return engine.subscribe(() => {
      const s = engine.getSnapshot().settings;
      if (s !== last) {
        last = s;
        onSettingsChange(s);
      }
    });
  }, [engine, onSettingsChange]);

  return <SoundContext.Provider value={engine}>{children}</SoundContext.Provider>;
}

export function useSoundEngine<S extends string = string, B extends string = string>(): SoundEngine<S, B> {
  const e = useContext(SoundContext);
  if (!e) throw new Error('useSoundEngine은 <SoundProvider> 안에서만 쓸 수 있습니다');
  return e as unknown as SoundEngine<S, B>;
}

export function useSoundSnapshot<B extends string = string>(): EngineSnapshot<B> {
  const e = useSoundEngine<string, B>();
  const subscribe = useCallback((l: () => void) => e.subscribe(l), [e]);
  const get = useCallback(() => e.getSnapshot(), [e]);
  return useSyncExternalStore(subscribe, get, () => SERVER_SNAPSHOT as EngineSnapshot<B>);
}

/** const playCoin = useSfx<SfxId>('coin'); onClick={() => playCoin()} */
export function useSfx<S extends string>(id: S): (opts?: PlayOptions) => void {
  const e = useSoundEngine<S>();
  return useCallback((opts?: PlayOptions) => e.play(id, opts), [e, id]);
}

/**
 * 이 화면이 떠 있는 동안 원하는 BGM을 선언 (월드맵: useBgm(world.bgm)).
 * 사용자가 BGM을 꺼 두었으면(기본) 아무 소리도 나지 않고, 켜면 그때 재생된다.
 * 다른 월드로 이동하면 언마운트 정리(stop) → 새 화면 play 순서로 자연스럽게 크로스페이드된다.
 */
export function useBgm<B extends string>(id: B | null, fadeMs = 800): void {
  const e = useSoundEngine<string, B>();
  useEffect(() => {
    if (!id) return;
    e.playBgm(id, { fadeMs });
    return () => {
      if (e.getSnapshot().desiredBgm === id) e.stopBgm({ fadeMs });
    };
  }, [e, id, fadeMs]);
}

export function useSoundSettings(): readonly [SoundSettings, (p: SoundSettingsPatch) => void] {
  const snap = useSoundSnapshot();
  const e = useSoundEngine();
  const set = useCallback((p: SoundSettingsPatch) => e.setSettings(p), [e]);
  return [snap.settings, set] as const;
}

/** HUD 음소거 토글 스케치 (48px 터치 타겟, 상태를 aria-pressed로 노출) */
export function SoundToggle() {
  const [s, set] = useSoundSettings();
  return (
    <button
      type="button"
      aria-pressed={!s.muted}
      aria-label={s.muted ? '소리 켜기' : '소리 끄기'}
      onClick={() => set({ muted: !s.muted })}
      style={{ minWidth: 48, minHeight: 48 }}
    >
      {s.muted ? '🔇' : '🔊'}
    </button>
  );
}
