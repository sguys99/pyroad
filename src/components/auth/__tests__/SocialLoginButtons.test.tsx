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
import type { SocialProvider } from '@/lib/auth/socialLogin';
import type { SocialLoginResult } from '@/lib/hooks/useSocialLogin';

// 소셜 로그인 버튼 3종 (P3-05): provider별 브랜드 버튼, 호출은 useSocialLogin(provider)로만, 바쁨·비활성·오류

const play = vi.fn();
vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => play,
}));

/** provider마다 따로 끝낼 수 있는 가짜 handleLogin */
const { calls, hookProviders } = vi.hoisted(() => ({
  calls: [] as {
    provider: string;
    resolve: (r: SocialLoginResult) => void;
  }[],
  hookProviders: [] as string[],
}));
vi.mock('@/lib/hooks/useSocialLogin', () => ({
  useSocialLogin: (provider: string) => {
    hookProviders.push(provider);
    return {
      handleLogin: () =>
        new Promise<SocialLoginResult>((resolve) => {
          calls.push({ provider, resolve });
        }),
      showBrowserGuide: false,
      setShowBrowserGuide: vi.fn(),
      browserInfo: null,
    };
  },
}));

import { SocialLoginButtons } from '../SocialLoginButtons';
import { SocialLoginButton } from '../SocialLoginButton';

const button = (p: SocialProvider) => screen.getByTestId(`social-login-${p}`);

beforeEach(() => {
  calls.length = 0;
  hookProviders.length = 0;
  play.mockReset();
});
afterEach(cleanup);

describe('SocialLoginButton', () => {
  it.each([
    ['kakao', '카카오 로그인'],
    ['naver', '네이버 로그인'],
    ['google', 'Google로 로그인'],
  ] as const)(
    '%s: 가이드 문구가 이름이고, 로고는 장식(aria-hidden)',
    (provider, name) => {
      render(<SocialLoginButton provider={provider} />);
      const btn = screen.getByRole('button', { name });
      expect(btn).toHaveAttribute('data-provider', provider);
      expect(btn.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('로딩이면 aria-busy + 누를 수 없음, 소리·클릭 없음', () => {
    const onClick = vi.fn();
    render(<SocialLoginButton provider="kakao" loading onClick={onClick} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('누르면 탭 효과음 (sfx={false}면 없음)', () => {
    render(<SocialLoginButton provider="naver" />);
    fireEvent.click(screen.getByRole('button'));
    expect(play).toHaveBeenCalledWith('tap');
    cleanup();
    play.mockReset();
    render(<SocialLoginButton provider="naver" sfx={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(play).not.toHaveBeenCalled();
  });
});

describe('SocialLoginButtons', () => {
  it('기본 순서는 카카오 → 네이버 → Google, provider마다 useSocialLogin을 부른다', () => {
    render(<SocialLoginButtons />);
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('data-provider'));
    expect(names).toEqual(['kakao', 'naver', 'google']);
    expect(new Set(hookProviders)).toEqual(
      new Set(['kakao', 'naver', 'google']),
    );
  });

  it('누른 provider의 훅만 호출, 그 버튼은 바쁨·나머지는 비활성, 두 번 눌러도 한 번', async () => {
    const onBeforeLogin = vi.fn();
    render(<SocialLoginButtons onBeforeLogin={onBeforeLogin} />);
    fireEvent.click(button('naver'));
    fireEvent.click(button('naver'));
    fireEvent.click(button('kakao'));

    expect(calls.map((c) => c.provider)).toEqual(['naver']);
    expect(onBeforeLogin).toHaveBeenCalledTimes(1);
    expect(onBeforeLogin).toHaveBeenCalledWith('naver');
    expect(button('naver')).toHaveAttribute('aria-busy', 'true');
    expect(button('kakao')).toBeDisabled();
    expect(button('google')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '네이버 로그인 화면으로 가고 있어요',
    );

    // provider 화면으로 떠나는 중이면 바쁨 유지
    await act(async () => calls[0].resolve('redirecting'));
    expect(button('naver')).toHaveAttribute('aria-busy', 'true');
    expect(button('google')).toBeDisabled();
  });

  it('시작하지 못하면 버튼을 되살리고 오류 문구(role=alert)', async () => {
    render(<SocialLoginButtons />);
    fireEvent.click(button('kakao'));
    await act(async () => calls[0].resolve('error'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      '로그인을 시작하지 못했어요',
    );
    for (const p of ['kakao', 'naver', 'google'] as const) {
      expect(button(p)).toBeEnabled();
      expect(button(p)).not.toHaveAttribute('aria-busy');
    }

    // 다시 누르면 오류 문구는 사라진다
    fireEvent.click(button('google'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(calls.map((c) => c.provider)).toEqual(['kakao', 'google']);
  });

  it.each(['external-browser', 'browser-guide'] as const)(
    'Google이 %s면 이 화면에 남으므로 바로 되살린다',
    async (result) => {
      render(<SocialLoginButtons />);
      fireEvent.click(button('google'));
      await act(async () => calls[0].resolve(result));
      expect(button('google')).toBeEnabled();
      expect(button('kakao')).toBeEnabled();
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('provider 화면에서 뒤로 가기로 돌아오면(bfcache pageshow) 바쁨을 푼다', async () => {
    render(<SocialLoginButtons />);
    fireEvent.click(button('kakao'));
    await act(async () => calls[0].resolve('redirecting'));
    expect(button('kakao')).toHaveAttribute('aria-busy', 'true');

    act(() => {
      const e = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(e, 'persisted', { value: true });
      window.dispatchEvent(e);
    });
    expect(button('kakao')).not.toHaveAttribute('aria-busy');
    expect(button('naver')).toBeEnabled();
  });

  it('preview가 있으면 실제 로그인 대신 그것을 부른다 (카탈로그)', async () => {
    const preview = vi.fn(async () => 'error' as const);
    render(<SocialLoginButtons preview={preview} />);
    fireEvent.click(button('google'));
    await act(async () => {});
    expect(preview).toHaveBeenCalledWith('google');
    expect(calls).toHaveLength(0);
  });
});

describe('최근에 쓴 로그인 수단 (P3-08)', () => {
  it('lastUsed 버튼을 맨 위로, 금색 이름표는 장식이고 문장은 설명으로 읽는다', () => {
    render(<SocialLoginButtons lastUsed="google" />);
    const order = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('data-provider'));
    expect(order).toEqual(['google', 'kakao', 'naver']);

    const google = screen.getByRole('button', { name: 'Google로 로그인' });
    expect(google).toHaveAttribute('data-recent', 'true');
    expect(google).toHaveAccessibleDescription('최근에 Google로 로그인했어요');
    expect(google.querySelector('.g-social-recent')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    // 다른 버튼에는 이름표 없음
    expect(button('kakao')).not.toHaveAttribute('data-recent');
    expect(button('kakao')).not.toHaveAttribute('aria-describedby');
  });

  it('보이지 않는 provider면 순서·이름표 없음', () => {
    render(
      <SocialLoginButtons providers={['kakao', 'google']} lastUsed="naver" />,
    );
    expect(
      screen.getAllByRole('button').map((b) => b.getAttribute('data-provider')),
    ).toEqual(['kakao', 'google']);
    expect(document.querySelector('[data-recent]')).toBeNull();
  });
});
