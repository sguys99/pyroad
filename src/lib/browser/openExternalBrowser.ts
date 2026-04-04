import type { InAppBrowserInfo } from './detectInAppBrowser';

export function openExternalBrowser(
  url: string,
  browserInfo: InAppBrowserInfo,
): boolean {
  const encoded = encodeURIComponent(url);

  switch (browserInfo.type) {
    case 'kakaotalk':
      window.location.href = `kakaotalk://web/openExternal?url=${encoded}`;
      return true;

    case 'naver':
      window.location.href = `naversearchapp://openExternal?url=${encoded}`;
      return true;

    case 'line': {
      if (browserInfo.isAndroid) {
        window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        return true;
      }
      return false;
    }

    case 'facebook':
    case 'instagram':
    case 'band':
    case 'unknown-webview': {
      if (browserInfo.isAndroid) {
        window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        return true;
      }
      return false;
    }

    default:
      return false;
  }
}
