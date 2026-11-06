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
import type { InAppBrowserInfo } from '@/lib/browser/detectInAppBrowser';
import type { SocialLoginResult } from '@/lib/hooks/useSocialLogin';

// 인앱 브라우저 처리 (P3-09): 카카오톡이면 카카오 먼저·크게, Google만 외부 브라우저, 막히면 안내 + 이 앱 안에서 되는 수단

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));

const KAKAOTALK: InAppBrowserInfo = {
  isInApp: true,
  type: 'kakaotalk',
  isAndroid: false,
  isIOS: true,
};
const INSTAGRAM: InAppBrowserInfo = {
  isInApp: true,
  type: 'instagram',
  isAndroid: false,
  isIOS: true,
};
const NORMAL: InAppBrowserInfo = {
  isInApp: false,
  type: null,
  isAndroid: false,
  isIOS: false,
};

/** provider별 가짜 훅 상태: google은 안내 모달을 띄운 상태로 만들 수 있다 */
const { state, handle } = vi.hoisted(() => ({
  state: { guide: false, info: null as InAppBrowserInfo | null },
  handle: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock('@/lib/hooks/useSocialLogin', () => ({
  useSocialLogin: (provider: string) => {
    handle[provider] ??= vi.fn(
      async (): Promise<SocialLoginResult> => 'redirecting',
    );
    return {
      handleLogin: handle[provider],
      showBrowserGuide: provider === 'google' && state.guide,
      setShowBrowserGuide: (v: boolean) => {
        state.guide = v;
      },
      browserInfo: provider === 'google' ? state.info : null,
    };
  },
}));

import { SocialLoginButtons } from '../SocialLoginButtons';

const order = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.getAttribute('data-provider'))
    .filter(Boolean);

beforeEach(() => {
  state.guide = false;
  state.info = null;
  for (const k of Object.keys(handle)) delete handle[k];
});
afterEach(cleanup);

describe('카카오톡 인앱 (P3-09)', () => {
  it('카카오가 맨 위에 크게(lg), Google은 브라우저에서 열린다는 한 줄', () => {
    render(<SocialLoginButtons browser={KAKAOTALK} />);
    expect(order()).toEqual(['kakao', 'naver', 'google']);
    expect(screen.getByTestId('social-login-kakao')).toHaveAttribute(
      'data-size',
      'lg',
    );
    expect(screen.getByTestId('social-login-naver')).not.toHaveAttribute(
      'data-size',
    );
    expect(screen.getByTestId('social-login-inapp-note')).toHaveTextContent(
      'Google 로그인은 Chrome·Safari 같은 브라우저에서 열려요',
    );
  });

  it('최근에 Google을 썼어도 카카오톡에서는 카카오가 먼저, 그다음 최근 사용', () => {
    render(<SocialLoginButtons browser={KAKAOTALK} lastUsed="google" />);
    expect(order()).toEqual(['kakao', 'google', 'naver']);
    expect(screen.getByTestId('social-login-google')).toHaveAttribute(
      'data-recent',
      'true',
    );
  });

  it('카카오를 숨긴 빌드면 크게 보일 버튼이 없다', () => {
    render(
      <SocialLoginButtons
        browser={KAKAOTALK}
        providers={['naver', 'google']}
      />,
    );
    expect(order()).toEqual(['naver', 'google']);
    expect(document.querySelector('[data-size="lg"]')).toBeNull();
  });
});

describe('다른 인앱·일반 브라우저', () => {
  it('인스타그램 인앱: 순서는 기본, Google 안내 한 줄은 있음', () => {
    render(<SocialLoginButtons browser={INSTAGRAM} />);
    expect(order()).toEqual(['kakao', 'naver', 'google']);
    expect(document.querySelector('[data-size="lg"]')).toBeNull();
    expect(screen.getByTestId('social-login-inapp-note')).toBeInTheDocument();
  });

  it('일반 브라우저: 크게·안내 없음', () => {
    render(<SocialLoginButtons browser={NORMAL} />);
    expect(screen.queryByTestId('social-login-inapp-note')).toBeNull();
    expect(document.querySelector('[data-size="lg"]')).toBeNull();
  });

  it('Google 숨김 빌드(NEXT_PUBLIC_LOGIN_PROVIDERS=kakao,naver)면 인앱 안내도 없음', () => {
    render(
      <SocialLoginButtons browser={INSTAGRAM} providers={['kakao', 'naver']} />,
    );
    expect(screen.queryByTestId('social-login-inapp-note')).toBeNull();
  });
});

describe('Google을 눌렀을 때', () => {
  it('외부 브라우저를 열었으면 버튼을 되살리고 "거기서 한 번 더" 안내', async () => {
    render(<SocialLoginButtons browser={KAKAOTALK} />);
    handle.google.mockResolvedValueOnce('external-browser');
    await act(async () => {
      fireEvent.click(screen.getByTestId('social-login-google'));
    });
    expect(handle.google).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('social-login-external')).toHaveTextContent(
      '브라우저를 열었어요',
    );
    expect(screen.getByTestId('social-login-kakao')).toBeEnabled();
  });

  it('안내 모달: 앱 이름·Google 문구 + 이 앱 안에서 되는 카카오·네이버로 바로 로그인', async () => {
    state.info = KAKAOTALK;
    state.guide = true;
    render(<SocialLoginButtons browser={KAKAOTALK} />);
    const guide = await screen.findByTestId('inapp-guide');
    expect(guide).toHaveTextContent('앗! 여기서는 Google 로그인이 안 돼요');
    expect(guide).toHaveTextContent('카카오톡 안에서 열린 화면이라 그래요');
    expect(screen.queryByTestId('inapp-guide-google')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('inapp-guide-kakao'));
    });
    expect(handle.kakao).toHaveBeenCalledTimes(1);
    expect(handle.google).not.toHaveBeenCalled();
    expect(state.guide).toBe(false);
  });
});
