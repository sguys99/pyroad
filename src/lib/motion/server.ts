import 'server-only';

import { loadOwnUserRow } from '@/lib/supabase/ownUserRow';
import { normalizeMotionSettings, type MotionSettings } from './tier';

/** `users.settings` JSONB에서 움직임 설정만 꺼낸다 (모르는 값은 기본값) */
export function motionFromUserSettings(settings: unknown): MotionSettings {
  const motion =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as Record<string, unknown>).motion
      : undefined;
  return normalizeMotionSettings(motion);
}

/**
 * 로그인 사용자의 `users.settings` JSONB (요청 안에서 한 번만 조회, React cache).
 * 움직임(P2-15)·사운드(P2-14) 설정이 함께 쓴다. 조회는 온보딩 관문(P3-11 `onboarded_at`)과 같은 한 번(`loadOwnUserRow`).
 * 비로그인·조회 실패면 undefined
 */
export async function loadUserSettingsJson(): Promise<unknown> {
  const row = await loadOwnUserRow();
  return row ? row.settings : undefined;
}

/**
 * 로그인 사용자의 움직임 설정 (P2-15). 로그인 레이아웃이 부트 동기화에 쓴다.
 * 비로그인·조회 실패면 null (그때는 기기 사본·기본값으로 동작하므로 화면을 막지 않음)
 */
export async function loadMotionSettings(): Promise<MotionSettings | null> {
  const settings = await loadUserSettingsJson();
  return settings === undefined ? null : motionFromUserSettings(settings);
}
