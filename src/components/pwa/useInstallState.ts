'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  detectInstallPlatform,
  installAction,
  isIosSafari,
  type InstallAction,
  type InstallPlatform,
} from '@/lib/pwa/install';
import {
  getInstallPromptSnapshot,
  getServerInstallPromptSnapshot,
  subscribeInstallPrompt,
} from '@/lib/pwa/installPrompt';

export interface InstallState {
  /** 하이드레이션 전에는 null (서버는 기기를 모름) */
  platform: InstallPlatform | null;
  action: InstallAction;
  /** iOS Safari인지 (공유 버튼 위치 안내) */
  iosSafari: boolean;
}

function readPlatform(): { platform: InstallPlatform; iosSafari: boolean } {
  const nav = navigator as Navigator & { standalone?: boolean };
  let standalone = nav.standalone === true;
  try {
    standalone ||= window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    // matchMedia가 없으면 브라우저 탭으로 본다
  }
  return {
    platform: detectInstallPlatform({
      userAgent: nav.userAgent,
      standalone,
      maxTouchPoints: nav.maxTouchPoints,
    }),
    iosSafari: isIosSafari(nav.userAgent),
  };
}

/** 이 기기에서 할 수 있는 "홈 화면에 추가" 안내 (P4-11) */
export function useInstallState(): InstallState {
  const prompt = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptSnapshot,
    getServerInstallPromptSnapshot,
  );
  const [device, setDevice] = useState<{
    platform: InstallPlatform;
    iosSafari: boolean;
  } | null>(null);
  useEffect(() => setDevice(readPlatform()), []);

  const platform = prompt.installed ? 'installed' : (device?.platform ?? null);
  return {
    platform,
    action: platform ? installAction(platform, prompt.canPrompt) : 'none',
    iosSafari: device?.iosSafari ?? false,
  };
}
