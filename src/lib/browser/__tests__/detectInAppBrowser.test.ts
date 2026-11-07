import { describe, expect, it } from 'vitest';
import {
  detectInAppBrowser,
  type InAppBrowserType,
} from '../detectInAppBrowser';
import { needsExternalBrowser } from '@/lib/auth/socialLogin';

// 인앱 브라우저 판별표 (B16 · P3-09). UA는 각 앱·브라우저의 실제 형식(버전만 대표값)

const UA = {
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36;KAKAOTALK 2410520',
  kakaoIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.5',
  naverAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.10.4)',
  naverIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.10.4; 15PRO)',
  instagramIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 352.0.0.24.98 (iPhone16,1; iOS 17_6; ko_KR; ko; scale=3.00; 1179x2556; 646318484)',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 Instagram 352.0.0.37.100 Android (34/14; 450dpi; 1080x2340; samsung; SM-S921N; e1q; qcom; ko_KR; 647089584)',
  facebookIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/482.0.0.39.97;FBBV/650000000;FBDV/iPhone16,1;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBID/phone;FBLC/ko_KR;FBOP/5]',
  lineIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.16.0',
  lineAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 Line/14.16.1/IAB',
  bandAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 BAND/15.2.1',
  otherAndroidWebView:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36',
  otherIOSWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.102 Mobile Safari/537.36',
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  safariIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  chromeIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  whaleAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.138 Whale/3.29.7.1 Mobile Safari/537.36',
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
} as const;

const MATRIX: [
  keyof typeof UA,
  InAppBrowserType,
  { android?: boolean; ios?: boolean },
][] = [
  ['kakaoAndroid', 'kakaotalk', { android: true }],
  ['kakaoIOS', 'kakaotalk', { ios: true }],
  ['naverAndroid', 'naver', { android: true }],
  ['naverIOS', 'naver', { ios: true }],
  ['instagramIOS', 'instagram', { ios: true }],
  ['instagramAndroid', 'instagram', { android: true }],
  ['facebookIOS', 'facebook', { ios: true }],
  ['lineIOS', 'line', { ios: true }],
  ['lineAndroid', 'line', { android: true }],
  ['bandAndroid', 'band', { android: true }],
  ['otherAndroidWebView', 'unknown-webview', { android: true }],
  ['otherIOSWebView', 'unknown-webview', { ios: true }],
  ['chromeAndroid', null, { android: true }],
  ['samsungInternet', null, { android: true }],
  ['safariIOS', null, { ios: true }],
  ['chromeIOS', null, { ios: true }],
  ['whaleAndroid', null, { android: true }],
  ['chromeWindows', null, {}],
  ['safariMac', null, {}],
  ['ipadDesktopMode', null, {}],
];

describe('detectInAppBrowser 판별표', () => {
  it.each(MATRIX)('%s → %s', (name, type, os) => {
    const info = detectInAppBrowser(UA[name]);
    expect(info.type).toBe(type);
    expect(info.isInApp).toBe(type !== null);
    expect(info.isAndroid).toBe(!!os.android);
    expect(info.isIOS).toBe(!!os.ios);
  });

  it('외부 브라우저로 보내는 것은 인앱의 Google뿐 (카카오·네이버는 인앱에서 그대로)', () => {
    for (const [name, type] of MATRIX) {
      const info = detectInAppBrowser(UA[name]);
      expect(needsExternalBrowser('google', info)).toBe(type !== null);
      expect(needsExternalBrowser('kakao', info)).toBe(false);
      expect(needsExternalBrowser('naver', info)).toBe(false);
    }
  });
});
