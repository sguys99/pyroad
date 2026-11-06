import type { LoginErrorReason } from '@/lib/auth/loginError';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import type { InAppBrowserType } from '@/lib/browser/detectInAppBrowser';
import type { PybaemState } from '@/components/characters/rig/pybaem';

/**
 * 로그인 실패 안내 문구 (P3-10). 파이뱀이 아이에게 말하는 반말, 무섭지 않게: 잘못은 아이 탓이 아니고, 다음에 할 일 하나만 말한다.
 * 원문 오류(영어·내부 사정)는 보여 주지 않는다. 사유 표: `src/lib/auth/loginError.ts`.
 */
export interface LoginErrorCopy {
  title: string;
  body: string;
  /** 파이뱀 표정 (리그 상태). 슬픔·생각 쪽, 놀라거나 겁주는 표정은 쓰지 않음 */
  rig: PybaemState;
}

const NAME: Record<SocialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
};

export function loginErrorCopy(
  reason: LoginErrorReason,
  via: SocialProvider | null = null,
): LoginErrorCopy {
  const name = via ? `${NAME[via]} ` : '';
  switch (reason) {
    case 'cancelled':
      return {
        title: `${name}로그인을 그만뒀구나`,
        body: '괜찮아! 취소하거나 동의하지 않으면 들어갈 수 없어. 마음이 바뀌면 아래에서 다시 골라 줘.',
        rig: 'encourage',
      };
    case 'identity_taken':
      return {
        title: '이미 다른 계정에 연결돼 있어',
        body: `이 ${name}계정은 다른 pyRoad 계정에서 쓰고 있어. 그 계정으로 로그인하면 거기 기록을 볼 수 있어.`,
        rig: 'think',
      };
    case 'expired':
      return {
        title: '로그인 시간이 지났어',
        body: '너무 오래 걸렸거나 주소가 바뀌었어. 처음부터 다시 해 볼까?',
        rig: 'confused',
      };
    case 'reused':
      return {
        title: '이미 끝난 로그인이야',
        body: '같은 로그인 화면을 두 번 열었어. 버튼을 한 번 더 눌러 줘.',
        rig: 'think',
      };
    case 'other_browser':
      return {
        title: '처음 그 화면에서 다시 해 줘',
        body: '로그인을 시작한 곳과 지금 화면이 달라. 처음 버튼을 누른 브라우저나 앱에서 다시 눌러 줘.',
        rig: 'confused',
      };
    case 'unavailable':
      return {
        title: `지금은 ${name}로그인을 쓸 수 없어`,
        body: '다른 방법으로 들어가 볼래? 계속 안 되면 어른에게 알려 줘.',
        rig: 'sad',
      };
    case 'unknown':
    default:
      return {
        title: '앗, 로그인이 잘 안 됐어',
        body: '잠시 뒤에 다시 해 볼까? 다른 방법으로 들어가도 돼.',
        rig: 'sad',
      };
  }
}

/**
 * "다른 방법으로 들어가기" 한마디 (있을 때만). 버튼이 바로 아래에 있으므로 어느 버튼을 누를지 짚어 준다.
 * - 카카오톡 인앱에서 Google이 안 됐으면 → 카카오 (카카오톡 안에서 바로 됨, P3-09)
 * - 네이버가 다른 브라우저 문제로 실패 → "네이버 앱으로 자동로그인" 대신 이 화면에서 아이디로 (Android appscheme)
 * - 설정 오류(unavailable)는 그 수단 말고 다른 버튼
 */
export function loginErrorHint(
  reason: LoginErrorReason,
  {
    via = null,
    inApp = null,
    available = [],
  }: {
    via?: SocialProvider | null;
    inApp?: InAppBrowserType;
    /** 지금 보이는 provider (숨긴 수단은 권하지 않음) */
    available?: readonly SocialProvider[];
  } = {},
): string | null {
  if (reason === 'cancelled' || reason === 'reused') return null;
  if (inApp === 'kakaotalk' && via === 'google' && available.includes('kakao'))
    return '카카오톡에서는 카카오 로그인이 가장 빨라! 노란 카카오 버튼을 눌러 봐.';
  if (reason === 'other_browser' && via === 'naver')
    return '네이버 앱으로 넘어가지 말고, 이 화면에서 아이디로 로그인해 봐.';
  if ((reason === 'unavailable' || reason === 'unknown') && via) {
    const others = available.filter((p) => p !== via).map((p) => NAME[p]);
    if (others.length > 0)
      return `${others.join('·')} 계정이 있으면 그걸로 들어가 봐.`;
  }
  return null;
}
