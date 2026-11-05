import 'server-only';

import { getAuthUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { reportServerError } from '@/lib/api/serverError';
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
 * 로그인 사용자의 움직임 설정 (P2-15). 로그인 레이아웃이 부트 동기화에 쓴다.
 * 비로그인·조회 실패면 null (그때는 기기 사본·기본값으로 동작하므로 화면을 막지 않음)
 */
export async function loadMotionSettings(): Promise<MotionSettings | null> {
  const { user } = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('settings')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    reportServerError(error, { area: 'motion', op: 'load settings' });
    return null;
  }
  return data ? motionFromUserSettings(data.settings) : null;
}
