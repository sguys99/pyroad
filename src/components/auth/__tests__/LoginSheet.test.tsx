// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LAST_LOGIN_STORAGE_KEY } from '@/lib/auth/lastLogin';
import {
  SHARED_DEVICE_STORAGE_KEY,
  resetSharedDeviceMemory,
} from '@/lib/auth/sharedDevice';
import { track } from '@/lib/analytics/track';

// 로그인 시트 (P3-05 · P3-08): 이 기기의 최근 로그인 수단을 읽어 맨 위 + 이름표 + 같은 계정 안내

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));
vi.mock('@/components/characters/rig/MascotRig', () => ({
  PybaemRig: () => null,
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/hooks/useSocialLogin', () => ({
  useSocialLogin: () => ({
    handleLogin: vi.fn(),
    showBrowserGuide: false,
    setShowBrowserGuide: vi.fn(),
    browserInfo: null,
  }),
}));

import {
  LOGIN_SHEET_FIRST_HINT,
  LOGIN_SHEET_GUARDIAN_NOTE,
  LoginSheet,
  loginSheetContextOf,
} from '../LoginSheet';

const order = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.getAttribute('data-provider'))
    .filter(Boolean);

beforeEach(() => {
  window.localStorage.clear();
  resetSharedDeviceMemory();
  vi.mocked(track).mockClear();
});
afterEach(cleanup);

describe('LoginSheet', () => {
  it('기록이 없으면 기본 순서와 "아무거나, 다음에도 같은 걸로" 안내 (P3-08 X3)', () => {
    render(<LoginSheet open onOpenChange={() => {}} />);
    expect(order()).toEqual(['kakao', 'naver', 'google']);
    expect(screen.getByTestId('login-sheet-hint')).toHaveTextContent(
      LOGIN_SHEET_FIRST_HINT,
    );
  });

  it('공개 정보 + 보호자 동의(만 14세 미만, P3-15) 두 줄', () => {
    render(<LoginSheet open onOpenChange={() => {}} lastUsed={null} />);
    const notes = screen.getByTestId('login-sheet-notes');
    expect(notes).toHaveTextContent('이름·사진은 다른 친구에게 보이지 않아요');
    expect(screen.getByTestId('login-sheet-guardian')).toHaveTextContent(
      LOGIN_SHEET_GUARDIAN_NOTE,
    );
    expect(LOGIN_SHEET_GUARDIAN_NOTE).toContain('만 14세');
  });

  it('이 기기 저장값(네이버)을 열 때 읽어 맨 위 + 같은 계정 안내', () => {
    window.localStorage.setItem(
      LAST_LOGIN_STORAGE_KEY,
      JSON.stringify({ provider: 'naver', at: new Date().toISOString() }),
    );
    render(<LoginSheet open onOpenChange={() => {}} />);
    expect(order()).toEqual(['naver', 'kakao', 'google']);
    expect(screen.getByTestId('login-sheet-hint')).toHaveTextContent(
      '지난번엔 네이버로 들어왔어',
    );
    expect(
      screen.getByRole('button', { name: '네이버 로그인' }),
    ).toHaveAccessibleDescription('최근에 네이버로 로그인했어요');
  });

  it('lastUsed를 직접 주면 저장값보다 우선 (카탈로그)', () => {
    window.localStorage.setItem(
      LAST_LOGIN_STORAGE_KEY,
      JSON.stringify({ provider: 'naver', at: new Date().toISOString() }),
    );
    render(<LoginSheet open onOpenChange={() => {}} lastUsed={null} />);
    expect(order()).toEqual(['kakao', 'naver', 'google']);
  });
});

describe('LoginSheet 실패 안내 (P3-10)', () => {
  it('사유별 제목·설명으로 바뀌고 버튼은 그대로 (바로 다시 해 보기)', () => {
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        lastUsed={null}
        notice={{ reason: 'cancelled', via: 'kakao' }}
      />,
    );
    expect(
      screen.getByRole('dialog', { name: '카카오 로그인을 그만뒀구나' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('login-sheet-hint')).toHaveTextContent(
      '마음이 바뀌면 아래에서 다시 골라 줘',
    );
    expect(order()).toEqual(['kakao', 'naver', 'google']);
    // 취소에는 "다른 방법" 한마디가 없다
    expect(screen.queryByTestId('login-error-hint')).toBeNull();
  });

  it('설정 오류면 다른 계정을 권하는 한마디', () => {
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        lastUsed={null}
        notice={{ reason: 'unavailable', via: 'naver' }}
      />,
    );
    expect(screen.getByTestId('login-error-hint')).toHaveTextContent(
      '카카오·Google 계정이 있으면 그걸로 들어가 봐.',
    );
  });
});

describe('LoginSheet 맥락별 머리말 (P4-09)', () => {
  const title = (name: string) => screen.getByRole('dialog', { name });

  it('cta로 맥락을 고른다: hero · header · trial', () => {
    expect(loginSheetContextOf('hero')).toBe('hero');
    expect(loginSheetContextOf('header')).toBe('header');
    expect(loginSheetContextOf('trial')).toBe('trial');
    expect(loginSheetContextOf(undefined)).toBe('hero');
  });

  it('히어로(기본)', () => {
    render(
      <LoginSheet open onOpenChange={() => {}} cta="hero" lastUsed={null} />,
    );
    expect(title('어떤 계정으로 모험을 시작할까?')).toBeInTheDocument();
  });

  it('헤더', () => {
    render(
      <LoginSheet open onOpenChange={() => {}} cta="header" lastUsed={null} />,
    );
    expect(title('어떤 계정으로 들어갈까?')).toBeInTheDocument();
  });

  it('체험 성공 (context=trial), 최근 로그인 안내는 그대로', () => {
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        cta="hero"
        context="trial"
        lastUsed="kakao"
      />,
    );
    expect(title('모험을 저장하려면 로그인!')).toBeInTheDocument();
    expect(screen.getByTestId('login-sheet-hint')).toHaveTextContent(
      '지난번엔 카카오로 들어왔어',
    );
  });

  it('heading을 주면 그 제목, 실패 안내가 있으면 실패 제목이 먼저', () => {
    const { unmount } = render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        heading="별 3개! 저장하러 가자"
        lastUsed={null}
      />,
    );
    expect(title('별 3개! 저장하러 가자')).toBeInTheDocument();
    unmount();
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        heading="별 3개! 저장하러 가자"
        lastUsed={null}
        notice={{ reason: 'cancelled', via: 'kakao' }}
      />,
    );
    expect(title('카카오 로그인을 그만뒀구나')).toBeInTheDocument();
  });

  it('providers를 주면 그것만 (카탈로그)', () => {
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        lastUsed={null}
        providers={['google']}
      />,
    );
    expect(order()).toEqual(['google']);
  });
});

describe('LoginSheet 숨긴 provider (P4-09)', () => {
  it('지난번 수단이 지금 목록에 없으면 기록 없음 안내 (없는 버튼을 가리키지 않음)', () => {
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        lastUsed="naver"
        providers={['kakao', 'google']}
      />,
    );
    expect(order()).toEqual(['kakao', 'google']);
    expect(screen.getByTestId('login-sheet-hint')).toHaveTextContent(
      LOGIN_SHEET_FIRST_HINT,
    );
  });
});

describe('LoginSheet 공용 기기 체크 (P4-09, §12-Q44)', () => {
  const KAKAOTALK = {
    isInApp: true,
    type: 'kakaotalk' as const,
    isAndroid: true,
    isIOS: false,
  };
  const NORMAL = { isInApp: false, type: null, isAndroid: false, isIOS: false };

  it('기본 꺼짐, 켜면 이 기기에 기억하고 최근 로그인 기록은 쓰지 않는다(앞 사람 것)', () => {
    window.localStorage.setItem(
      LAST_LOGIN_STORAGE_KEY,
      JSON.stringify({ provider: 'naver', at: new Date().toISOString() }),
    );
    render(<LoginSheet open onOpenChange={() => {}} browser={NORMAL} />);
    const check = screen.getByRole('checkbox', {
      name: '학교·도서관 컴퓨터예요',
    });
    expect(check).not.toBeChecked();
    expect(check).toHaveAccessibleDescription(
      '다음 사람이 내 계정으로 들어오지 않게 매번 다시 물어봐요',
    );
    expect(order()[0]).toBe('naver');

    fireEvent.click(check);
    expect(check).toBeChecked();
    expect(window.localStorage.getItem(SHARED_DEVICE_STORAGE_KEY)).toBe('1');
    expect(order()).toEqual(['kakao', 'naver', 'google']);
    expect(screen.getByTestId('login-sheet-hint')).toHaveTextContent(
      LOGIN_SHEET_FIRST_HINT,
    );

    fireEvent.click(check);
    expect(window.localStorage.getItem(SHARED_DEVICE_STORAGE_KEY)).toBeNull();
  });

  it('저장된 표시를 열 때 읽는다', () => {
    window.localStorage.setItem(SHARED_DEVICE_STORAGE_KEY, '1');
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        browser={NORMAL}
        lastUsed={null}
      />,
    );
    expect(screen.getByTestId('shared-device-check')).toBeChecked();
  });

  it('카카오톡 인앱에서는 숨긴다 (그 사람 휴대폰, 카카오 prompt=login 미지원)', () => {
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        browser={KAKAOTALK}
        lastUsed={null}
      />,
    );
    expect(screen.queryByTestId('shared-device')).toBeNull();
  });

  it('분석 landing_cta_click에 shared(불리언)만 더한다', async () => {
    window.localStorage.setItem(SHARED_DEVICE_STORAGE_KEY, '1');
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        cta="hero"
        browser={NORMAL}
        lastUsed={null}
        preview={async () => 'error'}
      />,
    );
    fireEvent.click(screen.getByTestId('social-login-kakao'));
    expect(track).toHaveBeenCalledWith(
      'landing_cta_click',
      { cta: 'hero', provider: 'kakao', shared: true },
      { immediate: true },
    );
  });
});
