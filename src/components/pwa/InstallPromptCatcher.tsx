'use client';

import { useEffect } from 'react';
import { startInstallPromptCapture } from '@/lib/pwa/installPrompt';

/**
 * 브라우저 설치 창 이벤트(`beforeinstallprompt`)를 로그인 화면 어디서든 잡아 둔다 (P4-11). 그리는 것 없음.
 * 로그인 화면 공용 틀(`LoggedInShell`)에 한 번. 랜딩에는 두지 않는다(랜딩 JS 예산, 설치 안내는 로그인 뒤에만)
 */
export function InstallPromptCatcher() {
  useEffect(() => startInstallPromptCapture(), []);
  return null;
}
