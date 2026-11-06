import 'server-only';

import { loadUserSettingsJson } from '@/lib/motion/server';
import { normalizeSettings } from './settings';
import type { SoundSettings } from './types';

/** `users.settings` JSONB에서 사운드 설정만 꺼낸다 (모르는 값은 기본값). 없으면 null → 기기 값을 그대로 씀 */
export function soundFromUserSettings(settings: unknown): SoundSettings | null {
  const sound =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as Record<string, unknown>).sound
      : undefined;
  return sound && typeof sound === 'object' ? normalizeSettings(sound) : null;
}

/**
 * 로그인 사용자의 사운드 설정 (로그인 레이아웃 → `SoundSettingsSync`). 움직임 설정과 같은 조회 결과를 쓴다 (React cache).
 * 비로그인·조회 실패·서버 값 없음이면 null
 */
export async function loadSoundSettings(): Promise<SoundSettings | null> {
  const settings = await loadUserSettingsJson();
  return settings === undefined ? null : soundFromUserSettings(settings);
}
