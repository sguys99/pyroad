// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// 로그아웃 (P4-09): 공용 기기 모드였으면 provider 사이트에서도 로그아웃하라는 안내 뒤 처음 화면으로

const { push, signOut, getUser } = vi.hoisted(() => ({
  push: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  getUser: vi.fn(async () => ({
    data: {
      user: {
        user_metadata: { iss: 'https://kauth.kakao.com' },
        identities: [{ provider: 'kakao' }],
      },
    },
  })),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/supabase/loadClient', () => ({
  loadBrowserClient: async () => ({ auth: { signOut, getUser } }),
}));
vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => () => {},
}));

import { LogoutButton, sharedLogoutMessage } from '../LogoutButton';
import { SHARED_DEVICE_STORAGE_KEY } from '@/lib/auth/sharedDevice';

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('LogoutButton', () => {
  it('보통은 로그아웃 뒤 바로 처음 화면으로', async () => {
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    expect(signOut).toHaveBeenCalled();
    expect(screen.queryByTestId('shared-logout-notice')).toBeNull();
  });

  it('공용 기기면 들어온 사이트에서도 로그아웃하라는 안내, 닫으면 처음 화면으로', async () => {
    window.localStorage.setItem(SHARED_DEVICE_STORAGE_KEY, '1');
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    const dialog = await screen.findByRole('dialog', { name: '로그아웃했어!' });
    expect(signOut).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(dialog).toHaveAccessibleDescription(sharedLogoutMessage('kakao'));
    fireEvent.click(screen.getByTestId('shared-logout-ok'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('수단을 모르면 세 사이트 모두', () => {
    expect(sharedLogoutMessage(null)).toContain('카카오·네이버·Google 사이트');
    expect(sharedLogoutMessage('naver')).toContain('네이버 사이트');
  });
});
