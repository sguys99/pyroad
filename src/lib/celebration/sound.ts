'use client';

import { createContext, useContext } from 'react';

/**
 * 축하 효과음 자리 (§2.5, P0-15). 축하 단계마다 `sfx` 키만 정하고, 실제 재생은 Phase 2
 * `SoundProvider`(P2-14, 자체 Web Audio 래퍼)가 이 Context에 엔진을 꽂아서 한다:
 *
 * ```tsx
 * <CelebrationSoundContext.Provider value={{ play: (id, opts) => engine.play(id, opts) }}>
 * ```
 *
 * 키는 P0-15 스타터 효과음 ID(`public/sounds/sfx/<id>`)와 같다. Provider가 없으면 아무 소리도 나지 않는다.
 * 효과음은 연출 단계와 무관하다 (P0-16 §4.5: 사운드는 단계와 무관, 설정의 효과음 켜기만 따름).
 */
export type CelebrationSfx =
  | 'celebrate'
  | 'levelup'
  | 'unlock'
  | 'star'
  | 'coin'
  | 'chest';

export interface CelebrationSoundPort {
  /** rate: 재생 속도(=피치). 뱃지를 차례로 보여 줄 때 1 → 1.26 → 1.5 */
  play(id: CelebrationSfx, opts?: { rate?: number; gain?: number }): void;
}

const SILENT: CelebrationSoundPort = { play: () => {} };

export const CelebrationSoundContext =
  createContext<CelebrationSoundPort>(SILENT);

export function useCelebrationSound(): CelebrationSoundPort {
  return useContext(CelebrationSoundContext);
}
