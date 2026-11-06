'use client';

import { useEffect } from 'react';
import { useSoundEngine } from '@/components/providers/SoundProvider';
import {
  normalizeSettings,
  pickNewerSettings,
  type SoundSettings,
} from '@/lib/sound';
import { getSoundSettingsSaver } from '@/lib/sound/sync';

/**
 * 로그인 사용자의 사운드 설정 동기화 (P2-14). 로그인 레이아웃에 둔다.
 *
 * - 서버 값(`users.settings.sound`)과 기기 값 중 `updatedAt`이 늦은 쪽을 쓴다 (P0-15 §4.7). 기기 값이 더 새로우면
 *   (로그아웃 상태에서 바꿈) 서버에 올린다
 * - 이 컴포넌트가 떠 있는 동안 사용자가 바꾼 설정(설정 화면·HUD 음소거)을 서버에 저장한다 (`sync.ts`, 원자적 갱신 API)
 */
export function SoundSettingsSync({
  settings,
}: {
  /** 서버 값. 없으면 기기 값을 그대로 쓰고, 기기에서 바꾼 적이 있으면 올린다 */
  settings: SoundSettings | null;
}) {
  const engine = useSoundEngine();
  const serverKey = settings ? JSON.stringify(settings) : '';

  useEffect(() => {
    const saver = getSoundSettingsSaver();
    saver.enable();
    const off = engine.onUserSettings((s) => saver.save(s));
    return () => {
      off();
      void saver.flush().finally(() => saver.disable());
    };
  }, [engine]);

  useEffect(() => {
    if (engine.kind === 'noop') return;
    const server = serverKey ? normalizeSettings(JSON.parse(serverKey)) : null;
    const local = engine.getSnapshot().settings;
    const next = pickNewerSettings(local, server);
    if (next !== local) engine.adoptSettings(next);
    else if (local.updatedAt > (server?.updatedAt ?? 0))
      getSoundSettingsSaver().save(local);
  }, [engine, serverKey]);

  return null;
}
