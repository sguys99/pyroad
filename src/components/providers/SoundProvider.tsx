'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  CelebrationSoundContext,
  type CelebrationSoundPort,
} from '@/lib/celebration/sound';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  attachUnlockListeners,
  getSoundEngine,
  onIdle,
  SERVER_SNAPSHOT,
  type EngineSnapshot,
  type SoundSettings,
  type SoundSettingsPatch,
} from '@/lib/sound';
import { SOUND_MANIFEST, type BgmId } from '@/lib/sound/manifest';
import { SoundContext, useSfx, useSoundEngine } from './soundContext';

/**
 * 사운드 Provider (§2.5, P0-15 → P2-14). 루트 레이아웃에 하나만 둔다 (`MotionTierProvider` 안쪽). 규칙: docs/design/sound.md
 *
 * - 서버·하이드레이션: no-op 엔진 스냅샷(`SERVER_SNAPSHOT`) → 불일치 없음. 서버 렌더에서 Web Audio에 손대지 않는다
 * - 클라이언트: 모듈 싱글턴 엔진. AudioContext는 첫 사용자 활성화 이벤트(capture)에서 만들고, 자주 쓰는 효과음은 유휴 시간에 미리 디코드
 * - 연출 단계가 minimal이면 BGM을 끈다(`budget.bgm`). 효과음은 단계와 무관 (P0-16 §4.5)
 * - 축하 시퀀서(`src/lib/celebration/sound.ts`)에 같은 엔진을 꽂는다
 * - 설정 서버 동기화는 로그인 레이아웃의 `SoundSettingsSync`가 한다 (비로그인은 기기 저장소만)
 *
 * 소리는 정보의 유일한 전달 수단이 아니다: 효과음을 거는 곳마다 같은 내용을 글자·색·모양으로도 보여 준다.
 */

// 컨텍스트·`useSfx`는 가벼운 모듈에 있다 (랜딩에 들어가는 게임 버튼용, P2-11). 여기서는 다시 내보낸다
export { useSfx, useSoundEngine };

export function SoundProvider({ children }: { children: ReactNode }) {
  // 싱글턴이라 렌더 중 불러도 안전 (AudioContext를 만들지 않음, 서버에서는 no-op)
  const engine = getSoundEngine(SOUND_MANIFEST);
  const { budget } = useMotionTier();

  useEffect(() => {
    const detach = attachUnlockListeners(engine);
    // 하이드레이션·첫 화면 작업과 겹치지 않게 유휴 시간에
    onIdle(() => engine.prefetch(), 3000);
    return detach;
  }, [engine]);

  useEffect(() => {
    engine.setBgmAllowed(budget.bgm);
  }, [engine, budget.bgm]);

  // 디버그·e2e 훅: <html data-bgm(원하는 곡) data-bgm-playing(실제로 나는 곡)>. 화면 정보가 아니라 확인용
  useEffect(() => {
    const sync = () => {
      const { desiredBgm, playingBgm } = engine.getSnapshot();
      const d = document.documentElement.dataset;
      d.bgm = desiredBgm ?? '';
      d.bgmPlaying = playingBgm ?? '';
    };
    sync();
    return engine.subscribe(sync);
  }, [engine]);

  const celebration = useMemo<CelebrationSoundPort>(
    () => ({ play: (id, opts) => engine.play(id, opts) }),
    [engine],
  );

  return (
    <SoundContext.Provider value={engine}>
      <CelebrationSoundContext.Provider value={celebration}>
        {children}
      </CelebrationSoundContext.Provider>
    </SoundContext.Provider>
  );
}

export function useSoundSnapshot(): EngineSnapshot<BgmId> {
  const e = useSoundEngine();
  const subscribe = useCallback((l: () => void) => e.subscribe(l), [e]);
  const get = useCallback(() => e.getSnapshot(), [e]);
  return useSyncExternalStore(
    subscribe,
    get,
    () => SERVER_SNAPSHOT as EngineSnapshot<BgmId>,
  );
}

// 같은 곡을 원하는 화면이 이어서 마운트되면(월드맵 → 퀘스트) 멈췄다 다시 시작하지 않게 짧게 미뤄서 멈춘다
const bgmClaims = new Map<BgmId, number>();
const BGM_RELEASE_DELAY_MS = 120;

/**
 * 이 화면이 떠 있는 동안 원하는 BGM을 선언 (월드맵·퀘스트: `useBgm('world1')`).
 * 사용자가 BGM을 꺼 두었으면(기본) 아무 소리도 나지 않고, 켜면 그때 재생된다.
 * 다른 곡을 원하는 화면으로 가면 크로스페이드, 원하는 화면이 모두 사라지면 페이드아웃.
 */
export function useBgm(id: BgmId | null, fadeMs = 800): void {
  const e = useSoundEngine();
  useEffect(() => {
    if (!id) return;
    bgmClaims.set(id, (bgmClaims.get(id) ?? 0) + 1);
    e.playBgm(id, { fadeMs });
    return () => {
      bgmClaims.set(id, (bgmClaims.get(id) ?? 1) - 1);
      setTimeout(() => {
        if ((bgmClaims.get(id) ?? 0) <= 0 && e.getSnapshot().desiredBgm === id)
          e.stopBgm({ fadeMs });
      }, BGM_RELEASE_DELAY_MS);
    };
  }, [e, id, fadeMs]);
}

export function useSoundSettings(): readonly [
  SoundSettings,
  (p: SoundSettingsPatch) => void,
] {
  const snap = useSoundSnapshot();
  const e = useSoundEngine();
  const set = useCallback((p: SoundSettingsPatch) => e.setSettings(p), [e]);
  return [snap.settings, set] as const;
}
