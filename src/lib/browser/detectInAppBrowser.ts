export type InAppBrowserType =
  | 'kakaotalk'
  | 'naver'
  | 'instagram'
  | 'facebook'
  | 'line'
  | 'band'
  | 'unknown-webview'
  | null;

export interface InAppBrowserInfo {
  isInApp: boolean;
  type: InAppBrowserType;
  isAndroid: boolean;
  isIOS: boolean;
}

/**
 * 인앱 브라우저(앱 안의 웹뷰) 판별 (B16, P3-09). `ua`를 주면 그 값으로(테스트·서버), 없으면 `navigator.userAgent`.
 * 판별표와 실제 UA 예시는 `__tests__/detectInAppBrowser.test.ts`.
 */
export function detectInAppBrowser(ua?: string): InAppBrowserInfo {
  if (ua === undefined) {
    if (typeof navigator === 'undefined') {
      return { isInApp: false, type: null, isAndroid: false, isIOS: false };
    }
    ua = navigator.userAgent;
  }

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  let type: InAppBrowserType = null;

  if (/KAKAOTALK/i.test(ua)) {
    type = 'kakaotalk';
  } else if (/NAVER|naver/i.test(ua)) {
    type = 'naver';
  } else if (/Instagram/i.test(ua)) {
    type = 'instagram';
  } else if (/FBAN|FBAV/i.test(ua)) {
    type = 'facebook';
  } else if (/\bLine\//i.test(ua)) {
    type = 'line';
  } else if (/BAND\//i.test(ua)) {
    type = 'band';
  } else if (isAndroid && /; wv\)/.test(ua)) {
    type = 'unknown-webview';
  } else if (isIOS && /AppleWebKit/.test(ua) && !/Safari/.test(ua)) {
    type = 'unknown-webview';
  }

  return {
    isInApp: type !== null,
    type,
    isAndroid,
    isIOS,
  };
}
