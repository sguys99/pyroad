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
import { LAST_LOGIN_STORAGE_KEY } from '@/lib/auth/lastLogin';

// 설정 "로그인 계정 연결" (P3-07)

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));

const { state, link } = vi.hoisted(() => ({
  state: { identities: [] as Record<string, unknown>[] },
  link: vi.fn(async () => 'redirecting' as string),
}));
vi.mock('@/lib/supabase/loadClient', () => ({
  loadBrowserClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'u1', identities: state.identities } },
      }),
    },
  }),
}));
vi.mock('@/lib/hooks/useLinkIdentity', () => ({ useLinkIdentity: () => link }));

import { LinkedAccountsSection } from '../LinkedAccountsSection';

const g = {
  provider: 'google',
  identity_id: 'i-g',
  created_at: '2026-11-01T03:00:00Z',
  identity_data: { email: 'kid@example.com', name: '김철수' },
};
const k = {
  provider: 'kakao',
  identity_id: 'i-k',
  created_at: '2026-11-03T03:00:00Z',
};

async function mount() {
  render(<LinkedAccountsSection />);
  await act(async () => {});
}
const row = (p: string) =>
  document.querySelector(
    `[data-testid="linked-accounts"] [data-provider="${p}"]`,
  )!;

beforeEach(() => {
  link.mockClear();
  state.identities = [];
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('LinkedAccountsSection', () => {
  it('연결된 수단은 "연결됨 · 날짜"만, 이메일·이름은 보이지 않는다', async () => {
    state.identities = [g, k];
    await mount();
    expect(row('google')).toHaveTextContent('연결됨 · 2026. 11. 1.');
    expect(row('kakao')).toHaveTextContent('연결됨 · 2026. 11. 3.');
    expect(document.body).not.toHaveTextContent('example.com');
    expect(document.body).not.toHaveTextContent('김철수');
  });

  it('마지막 수단은 끊기 막힘 + 이유, 연결 안 된 수단은 연결하기', async () => {
    state.identities = [g];
    await mount();
    expect(screen.getByTestId('unlink-google')).toBeDisabled();
    expect(row('google')).toHaveTextContent(
      '로그인할 방법이 하나뿐이라 끊을 수 없어요',
    );
    fireEvent.click(screen.getByTestId('link-kakao'));
    expect(link).toHaveBeenCalledWith('kakao');
  });

  it('카카오만 있는 계정: 네이버는 막히고 Google 먼저 안내, Google은 연결 가능', async () => {
    state.identities = [k];
    await mount();
    expect(screen.getByTestId('link-naver')).toBeDisabled();
    expect(row('naver')).toHaveTextContent(
      'Google을 먼저 연결하면 붙일 수 있어요',
    );
    expect(screen.getByTestId('link-google')).toBeEnabled();
  });

  it('인앱에서 Google 연결은 시작하지 않고 브라우저 안내', async () => {
    state.identities = [k];
    link.mockResolvedValueOnce('external-only');
    await mount();
    await act(async () => {
      fireEvent.click(screen.getByTestId('link-google'));
    });
    expect(screen.getByTestId('linked-accounts-status')).toHaveTextContent(
      'Chrome이나 Safari에서',
    );
  });

  it('끊기: 확인 창 → API, 끝나면 최근 로그인 배지가 그 수단이면 지우고 목록을 다시 읽는다', async () => {
    state.identities = [g, k];
    window.localStorage.setItem(
      LAST_LOGIN_STORAGE_KEY,
      JSON.stringify({ provider: 'kakao', at: new Date().toISOString() }),
    );
    const fetchMock = vi.fn(async () => {
      state.identities = [g];
      return new Response(
        JSON.stringify({
          success: true,
          provider: 'kakao',
          providerSide: 'failed',
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    await mount();
    fireEvent.click(screen.getByTestId('unlink-kakao'));
    expect(
      await screen.findByRole('alertdialog', {
        name: '카카오 연결을 끊을까요?',
      }),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('unlink-confirm'));
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/unlink',
      expect.objectContaining({ method: 'POST', body: '{"provider":"kakao"}' }),
    );
    expect(screen.getByTestId('linked-accounts-status')).toHaveTextContent(
      '카카오 연결을 끊었어요. 카카오 쪽 연결은',
    );
    expect(window.localStorage.getItem(LAST_LOGIN_STORAGE_KEY)).toBeNull();
    expect(row('kakao')).toHaveAttribute('data-state', 'available');
  });

  it('서버가 거절하면 그 문구를 보여 준다', async () => {
    state.identities = [g, k];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: '로그인할 방법이 하나뿐이라 끊을 수 없어요.',
            }),
            {
              status: 409,
            },
          ),
      ),
    );
    await mount();
    fireEvent.click(screen.getByTestId('unlink-google'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('unlink-confirm'));
    });
    expect(screen.getByTestId('linked-accounts-status')).toHaveTextContent(
      '하나뿐이라 끊을 수 없어요',
    );
  });

  it('연결하고 돌아오면(?linked=) 정말 붙었을 때만 알려 주고 주소를 정리', async () => {
    state.identities = [g, k];
    window.history.replaceState(null, '', '/settings?linked=kakao');
    await mount();
    expect(screen.getByTestId('linked-accounts-status')).toHaveTextContent(
      '카카오 계정을 연결했어요',
    );
    expect(window.location.search).toBe('');

    cleanup();
    state.identities = [g];
    window.history.replaceState(null, '', '/settings?linked=naver');
    await mount();
    expect(screen.queryByTestId('linked-accounts-status')).toBeNull();
  });
});
