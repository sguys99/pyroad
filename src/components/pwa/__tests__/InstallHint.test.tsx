// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { INSTALL_HINT_STORAGE_KEY } from '@/lib/pwa/install';
import {
  __resetInstallPromptForTest,
  startInstallPromptCapture,
} from '@/lib/pwa/installPrompt';

// "홈 화면에 추가" 쪽지·설정 항목 (P4-11)

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ track }));

import { InstallHint, INSTALL_HINT_DELAY_MS } from '../InstallHint';
import { InstallAppSection } from '@/components/settings/InstallAppSection';

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  kakao:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.6.1',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
};

const NOW = Date.UTC(2026, 10, 8, 1, 0); // 2026-11-08 10:00 KST

function setDevice(ua: string, standalone = false) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: ua === UA.desktop ? 0 : 5,
    configurable: true,
  });
  window.matchMedia = ((q: string) => ({
    matches: standalone && q.includes('standalone'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

/** 이미 이틀 왔고 오늘이 셋째 날 */
function seedVisits(days = 2, extra: object = {}) {
  localStorage.setItem(
    INSTALL_HINT_STORAGE_KEY,
    JSON.stringify({ visitDays: days, lastVisit: '2026-11-07', ...extra }),
  );
}

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  e.prompt = vi.fn(async () => {});
  e.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(e);
  return e;
}

async function mountHint() {
  render(<InstallHint />);
  await act(async () => {
    vi.advanceTimersByTime(INSTALL_HINT_DELAY_MS + 10);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  track.mockClear();
  __resetInstallPromptForTest();
  startInstallPromptCapture();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('월드맵 쪽지', () => {
  it('iPhone 셋째 날: 쪽지 → 추가하기 → 그림 안내 → 닫으면 30일 쉬기', async () => {
    setDevice(UA.iphone);
    seedVisits();
    await mountHint();
    const hint = screen.getByTestId('install-hint');
    expect(hint).toHaveTextContent('홈 화면에 데려가면');
    fireEvent.click(screen.getByRole('button', { name: '추가하기' }));
    await act(async () => {});
    expect(screen.getByTestId('ios-install-guide')).toBeInTheDocument();
    expect(screen.getByTestId('ios-install-steps')).toHaveTextContent(
      '홈 화면에 추가',
    );
    expect(track).toHaveBeenCalledWith('pwa_install_prompt', {
      via: 'world',
      platform: 'ios',
      result: 'guide',
    });
    fireEvent.click(screen.getByRole('button', { name: '알겠어요' }));
    await act(async () => {});
    const saved = JSON.parse(localStorage.getItem(INSTALL_HINT_STORAGE_KEY)!);
    expect(saved).toMatchObject({ visitDays: 3, dismissedOn: '2026-11-08' });
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it('첫날·둘째 날은 띄우지 않고 방문만 센다', async () => {
    setDevice(UA.iphone);
    seedVisits(1);
    await mountHint();
    expect(screen.queryByTestId('install-hint')).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(INSTALL_HINT_STORAGE_KEY)!).visitDays,
    ).toBe(2);
  });

  it('✕로 닫으면 30일 쉬기', async () => {
    setDevice(UA.iphone);
    seedVisits();
    await mountHint();
    fireEvent.click(screen.getByRole('button', { name: '다음에 할게요' }));
    expect(screen.queryByTestId('install-hint')).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(INSTALL_HINT_STORAGE_KEY)!).dismissedOn,
    ).toBe('2026-11-08');
  });

  it('안드로이드: 설치 창 이벤트가 있을 때만, 누르면 prompt()', async () => {
    setDevice(UA.android);
    seedVisits();
    await mountHint();
    expect(screen.queryByTestId('install-hint')).toBeNull();
    let e!: ReturnType<typeof fireBeforeInstallPrompt>;
    await act(async () => {
      e = fireBeforeInstallPrompt('accepted');
    });
    expect(e.defaultPrevented).toBe(true); // 브라우저 자동 안내 띠를 막음
    fireEvent.click(screen.getByRole('button', { name: '추가하기' }));
    await act(async () => {});
    expect(e.prompt).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith('pwa_install_prompt', {
      via: 'world',
      platform: 'android',
      result: 'accepted',
    });
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it.each([
    ['카카오톡 인앱', UA.kakao, false],
    ['데스크톱', UA.desktop, false],
    ['이미 설치(홈 화면에서 엶)', UA.iphone, true],
  ])('%s: 띄우지 않음', async (_l, ua, standalone) => {
    setDevice(ua, standalone);
    seedVisits(9);
    await mountHint();
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it('설치를 마치면(appinstalled) 분석 이벤트', async () => {
    setDevice(UA.android);
    await act(async () => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(track).toHaveBeenCalledWith('pwa_installed', {});
  });
});

describe('설정 화면 항목', () => {
  it('데스크톱은 그리지 않음', async () => {
    setDevice(UA.desktop);
    render(<InstallAppSection />);
    await act(async () => {});
    expect(screen.queryByTestId('install-app-settings')).toBeNull();
  });

  it('iPhone: 방문 횟수와 상관없이 "방법 보기"', async () => {
    setDevice(UA.iphone);
    render(<InstallAppSection />);
    await act(async () => {});
    const card = screen.getByTestId('install-app-settings');
    expect(card).toHaveAttribute('data-action', 'ios-guide');
    fireEvent.click(screen.getByRole('button', { name: '방법 보기' }));
    await act(async () => {});
    expect(screen.getByTestId('ios-install-guide')).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('pwa_install_prompt', {
      via: 'settings',
      platform: 'ios',
      result: 'guide',
    });
  });

  it('인앱 브라우저: 기본 브라우저로 열어 달라는 글만', async () => {
    setDevice(UA.kakao);
    render(<InstallAppSection />);
    await act(async () => {});
    expect(screen.getByTestId('install-app-settings')).toHaveTextContent(
      '앱 안에서는 추가할 수 없어요',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('이미 설치: 안내만', async () => {
    setDevice(UA.android, true);
    render(<InstallAppSection />);
    await act(async () => {});
    expect(screen.getByTestId('install-app-settings')).toHaveAttribute(
      'data-action',
      'installed',
    );
  });
});
