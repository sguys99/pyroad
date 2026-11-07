import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_HINT_STATE,
  INSTALL_HINT_MIN_VISIT_DAYS,
  INSTALL_HINT_SNOOZE_DAYS,
  INSTALL_HINT_STORAGE_KEY,
  detectInstallPlatform,
  dismissHint,
  installAction,
  isIosSafari,
  loadHintState,
  parseHintState,
  recordVisit,
  saveHintState,
  shouldShowWorldHint,
  type InstallHintState,
} from '../install';

// 실제 UA 예시
const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1',
  ipadDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  androidKakao:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.0.0 Mobile Safari/537.36 KAKAOTALK/25.6.1 (INAPP)',
  iphoneKakao:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.6.1',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
};

describe('기기 판별 (P4-11)', () => {
  it.each([
    ['iPhone Safari', UA.iphoneSafari, 0, 'ios'],
    ['iPhone Chrome', UA.iphoneChrome, 0, 'ios'],
    ['iPadOS(데스크톱 UA + 터치)', UA.ipadDesktop, 5, 'ios'],
    ['맥 Safari(터치 없음)', UA.ipadDesktop, 0, 'desktop'],
    ['안드로이드 태블릿 Chrome', UA.androidChrome, 5, 'android'],
    ['안드로이드 카카오톡 인앱', UA.androidKakao, 5, 'inapp'],
    ['iPhone 카카오톡 인앱', UA.iphoneKakao, 5, 'inapp'],
    ['Windows Chrome', UA.windowsChrome, 0, 'desktop'],
  ] as const)('%s → %s', (_l, userAgent, maxTouchPoints, expected) => {
    expect(
      detectInstallPlatform({ userAgent, standalone: false, maxTouchPoints }),
    ).toBe(expected);
  });

  it('홈 화면에서 열었으면 기기와 상관없이 installed', () => {
    for (const userAgent of [UA.iphoneSafari, UA.androidChrome]) {
      expect(detectInstallPlatform({ userAgent, standalone: true })).toBe(
        'installed',
      );
    }
  });

  it('iOS Safari만 Safari (Chrome·Firefox·Edge는 아님)', () => {
    expect(isIosSafari(UA.iphoneSafari)).toBe(true);
    expect(isIosSafari(UA.ipadDesktop)).toBe(true);
    expect(isIosSafari(UA.iphoneChrome)).toBe(false);
    expect(isIosSafari(UA.iphoneKakao)).toBe(false);
  });

  it('할 수 있는 안내: 안드로이드는 설치 창 이벤트가 있을 때만', () => {
    expect(installAction('android', true)).toBe('prompt');
    expect(installAction('android', false)).toBe('none');
    expect(installAction('ios', false)).toBe('ios-guide');
    expect(installAction('installed', true)).toBe('installed');
    expect(installAction('inapp', true)).toBe('open-in-browser');
    expect(installAction('desktop', true)).toBe('none');
  });
});

describe('월드맵 쪽지 노출 (서로 다른 날 3번째 방문, 닫으면 30일)', () => {
  // KST 기준 날짜: 2026-11-08 10:00 KST = 01:00Z
  const day = (n: number) => Date.UTC(2026, 10, 8 + n, 1, 0, 0);

  it('같은 날은 한 번만 센다', () => {
    let s = recordVisit(EMPTY_HINT_STATE, day(0));
    s = recordVisit(s, day(0) + 3_600_000);
    expect(s).toEqual({
      visitDays: 1,
      lastVisit: '2026-11-08',
      dismissedOn: null,
    });
  });

  it('KST 자정을 넘기면 다른 날 (UTC 날짜가 같아도)', () => {
    const a = recordVisit(EMPTY_HINT_STATE, Date.UTC(2026, 10, 8, 14, 0)); // 23:00 KST
    const b = recordVisit(a, Date.UTC(2026, 10, 8, 15, 30)); // 다음날 00:30 KST
    expect(b.visitDays).toBe(2);
  });

  it('3번째 날부터, 설치할 수 있는 기기에서만', () => {
    let s: InstallHintState = EMPTY_HINT_STATE;
    for (let i = 0; i < INSTALL_HINT_MIN_VISIT_DAYS - 1; i++) {
      s = recordVisit(s, day(i));
      expect(shouldShowWorldHint(s, 'ios-guide', day(i))).toBe(false);
    }
    s = recordVisit(s, day(2));
    expect(shouldShowWorldHint(s, 'ios-guide', day(2))).toBe(true);
    expect(shouldShowWorldHint(s, 'prompt', day(2))).toBe(true);
    for (const a of ['none', 'installed', 'open-in-browser'] as const) {
      expect(shouldShowWorldHint(s, a, day(2))).toBe(false);
    }
  });

  it('닫으면 30일 동안 안 띄우고, 30일째부터 다시', () => {
    const s = dismissHint(
      { visitDays: 5, lastVisit: '2026-11-08', dismissedOn: null },
      day(0),
    );
    expect(s.dismissedOn).toBe('2026-11-08');
    expect(
      shouldShowWorldHint(s, 'prompt', day(INSTALL_HINT_SNOOZE_DAYS - 1)),
    ).toBe(false);
    expect(
      shouldShowWorldHint(s, 'prompt', day(INSTALL_HINT_SNOOZE_DAYS)),
    ).toBe(true);
  });

  it('저장값이 깨졌으면 빈 상태', () => {
    expect(parseHintState(null)).toEqual(EMPTY_HINT_STATE);
    expect(parseHintState('{')).toEqual(EMPTY_HINT_STATE);
    expect(
      parseHintState(
        JSON.stringify({ visitDays: -3, lastVisit: 'x', dismissedOn: 7 }),
      ),
    ).toEqual(EMPTY_HINT_STATE);
    expect(parseHintState(JSON.stringify({ visitDays: 2.7 })).visitDays).toBe(
      2,
    );
  });
});

describe('기기 저장 (localStorage)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('읽고 쓴다', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    const s = { visitDays: 2, lastVisit: '2026-11-08', dismissedOn: null };
    saveHintState(s);
    expect(JSON.parse(store.get(INSTALL_HINT_STORAGE_KEY)!)).toEqual(s);
    expect(loadHintState()).toEqual(s);
  });

  it('막혀서 던져도 앱은 그대로 (빈 상태)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    });
    expect(loadHintState()).toEqual(EMPTY_HINT_STATE);
    expect(() => saveHintState(EMPTY_HINT_STATE)).not.toThrow();
  });
});
