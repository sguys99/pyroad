'use client';

import { useCallback, useState } from 'react';
import { track } from '@/lib/analytics/track';
import { promptInstall } from '@/lib/pwa/installPrompt';
import { useInstallState } from './useInstallState';

export type InstallVia = 'world' | 'settings';

/**
 * "홈 화면에 추가" 버튼 동작 (P4-11). 안드로이드는 브라우저 설치 창, iOS는 그림 안내 시트를 연다.
 * @param onDone 안내를 마친 뒤(설치 창에서 고름·iOS 안내를 닫음) — 월드맵 쪽지는 여기서 30일 쉬기를 기록
 */
export function useInstallFlow(via: InstallVia, onDone?: () => void) {
  const state = useInstallState();
  const [guideOpen, setGuideOpen] = useState(false);

  const start = useCallback(async () => {
    if (state.action === 'prompt') {
      const outcome = await promptInstall();
      if (outcome !== 'unavailable') {
        track('pwa_install_prompt', {
          via,
          platform: 'android',
          result: outcome,
        });
      }
      onDone?.();
    } else if (state.action === 'ios-guide') {
      setGuideOpen(true);
      track('pwa_install_prompt', { via, platform: 'ios', result: 'guide' });
    }
  }, [state.action, via, onDone]);

  const onGuideOpenChange = useCallback(
    (open: boolean) => {
      setGuideOpen(open);
      if (!open) onDone?.();
    },
    [onDone],
  );

  return { ...state, start, guideOpen, onGuideOpenChange };
}
