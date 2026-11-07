'use client';

import { createContext, useCallback, useContext } from 'react';
import { createNoopEngine } from '@/lib/sound/noopEngine';
import type { PlayOptions, SoundEngine } from '@/lib/sound/types';
import type { BgmId, SfxId } from '@/lib/sound/manifest';

/**
 * 사운드 컨텍스트와 효과음 훅만 담은 가벼운 모듈 (P2-11에서 `SoundProvider.tsx`에서 떼어 냄).
 * 공통 게임 버튼처럼 랜딩에도 들어가는 컴포넌트가 효과음을 쓰려고 매니페스트·엔진 전체(와 그 안의 문구)를
 * 끌고 오지 않게 한다 → 랜딩 텍스트 서브셋(`npm run fonts:check`)이 늘지 않는다. 엔진은 `SoundProvider`가 넣는다.
 */
export type AppEngine = SoundEngine<SfxId, BgmId>;

export const NOOP_ENGINE: AppEngine = createNoopEngine<SfxId, BgmId>();
export const SoundContext = createContext<AppEngine>(NOOP_ENGINE);

/** Provider가 없으면 아무 소리도 내지 않는 엔진 (단위 테스트·Provider 밖) */
export function useSoundEngine(): AppEngine {
  return useContext(SoundContext);
}

/** `const play = useSfx(); play('correct')` — 콜백 참조가 바뀌지 않는다 */
export function useSfx(): (id: SfxId, opts?: PlayOptions) => void {
  const e = useSoundEngine();
  return useCallback((id: SfxId, opts?: PlayOptions) => e.play(id, opts), [e]);
}
