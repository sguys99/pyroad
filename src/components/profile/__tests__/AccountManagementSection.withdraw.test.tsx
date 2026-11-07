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
import { WITHDRAW_STORAGE_KEY } from '@/lib/auth/withdrawIntent';

// 계정 관리 → 탈퇴 (P3-16): 네이버 계정은 재인증으로 연결을 끊고 돌아와 확인, 건너뛰면 직접 해제 안내

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { user, handleLogin, hookArgs } = vi.hoisted(() => ({
  user: {
    current: null as null | {
      id: string;
      identities: { provider: string }[];
    },
  },
  handleLogin: vi.fn(async () => 'redirecting' as const),
  hookArgs: [] as unknown[][],
}));
vi.mock('@/lib/supabase/loadClient', () => ({
  loadBrowserClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: user.current } }),
      signOut: vi.fn(),
    },
  }),
}));
vi.mock('@/lib/hooks/useSocialLogin', () => ({
  useSocialLogin: (...args: unknown[]) => {
    hookArgs.push(args);
    return {
      handleLogin,
      showBrowserGuide: false,
      setShowBrowserGuide: vi.fn(),
      browserInfo: null,
    };
  },
}));

import { AccountManagementSection } from '../AccountManagementSection';

const NAVER_USER = { id: 'u1', identities: [{ provider: 'custom:naver' }] };

async function mount() {
  render(<AccountManagementSection stages={[]} />);
  // 마운트 뒤 getUser
  await act(async () => {});
}

async function clickWithdraw() {
  fireEvent.click(screen.getByRole('button', { name: '탈퇴하기' }));
  const confirm = await screen.findByRole('alertdialog', {
    name: '정말 탈퇴하시겠어요?',
  });
  fireEvent.click(
    confirm.querySelector('[data-slot="button"][data-variant="danger"]')!,
  );
}

beforeEach(() => {
  user.current = null;
  handleLogin.mockClear();
  hookArgs.length = 0;
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('탈퇴: 네이버 연결 끊기 단계 (P3-16)', () => {
  it('네이버 계정이면 "네이버 연결도 끊을까요?" → 네이버 재인증(next = 탈퇴 표시), 시작한 사용자를 이 탭에 적는다', async () => {
    user.current = NAVER_USER;
    await mount();
    expect(hookArgs[0]).toEqual(['naver', { next: '/profile?withdraw=naver' }]);
    await clickWithdraw();
    expect(
      await screen.findByRole('alertdialog', {
        name: '네이버 연결도 끊을까요?',
      }),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('withdraw-naver-confirm'));
    });
    expect(handleLogin).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(window.sessionStorage.getItem(WITHDRAW_STORAGE_KEY)!).uid,
    ).toBe('u1');
  });

  it('건너뛰면 직접 해제 방법을 붙인 탈퇴 확인', async () => {
    user.current = NAVER_USER;
    await mount();
    await clickWithdraw();
    fireEvent.click(await screen.findByTestId('withdraw-naver-skip'));
    expect(
      await screen.findByText(/네이버 연결은 남아 있을 수 있어요/),
    ).toBeInTheDocument();
    expect(handleLogin).not.toHaveBeenCalled();
  });

  it('네이버가 없는 계정은 바로 탈퇴 확인', async () => {
    user.current = { id: 'u2', identities: [{ provider: 'kakao' }] };
    await mount();
    await clickWithdraw();
    expect(
      await screen.findByRole('alertdialog', {
        name: '정말로 탈퇴하시겠습니까?',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('네이버 연결도 끊을까요?')).toBeNull();
  });

  it('재인증에서 돌아오면(같은 사용자, ok) 탈퇴 확인을 이어서 연다 + 주소 정리', async () => {
    user.current = NAVER_USER;
    window.sessionStorage.setItem(
      WITHDRAW_STORAGE_KEY,
      JSON.stringify({ uid: 'u1', at: Date.now() }),
    );
    window.history.replaceState(null, '', '/profile?withdraw=naver&naver=ok');
    await mount();
    expect(
      await screen.findByRole('alertdialog', {
        name: '정말로 탈퇴하시겠습니까?',
      }),
    ).toHaveTextContent('네이버 연결을 끊었어요.');
    expect(window.location.search).toBe('');
  });

  it('다른 사용자로 돌아왔거나 mismatch면 이어 가지 않고 안내', async () => {
    user.current = { id: 'other', identities: [{ provider: 'custom:naver' }] };
    window.sessionStorage.setItem(
      WITHDRAW_STORAGE_KEY,
      JSON.stringify({ uid: 'u1', at: Date.now() }),
    );
    window.history.replaceState(null, '', '/profile?withdraw=naver&naver=ok');
    await mount();
    expect(await screen.findByTestId('withdraw-notice')).toHaveTextContent(
      '탈퇴를 시작한 계정과 다른 계정',
    );
    expect(
      screen.queryByRole('alertdialog', { name: '정말로 탈퇴하시겠습니까?' }),
    ).toBeNull();
  });
});
