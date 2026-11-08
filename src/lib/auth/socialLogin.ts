import type { SignInWithOAuthCredentials } from '@supabase/supabase-js';
import type { InAppBrowserInfo } from '@/lib/browser/detectInAppBrowser';

/**
 * 소셜 로그인 provider별 `signInWithOAuth` 호출 옵션 (P1-14, 계획서 §2.8).
 * Supabase Auth 호출 옵션은 이 파일 한 곳에만 둡니다. 로그인 버튼(P3-05)과 계정 연결(`linkIdentity`, P3-07)도
 * 이 함수가 만든 값을 그대로 씁니다.
 */
export type SocialProvider = 'google' | 'kakao' | 'naver';

/**
 * Kakao에 요청할 동의항목(scope). 빈 문자열 = **이용자 식별자(회원번호)만** 받음 (§12-Q16).
 * 실제 앱에서 식별자만으로 로그인이 안 되면(P3-01 확인) `'profile_nickname'`(선택 동의) 하나로 바꿉니다.
 * 닉네임을 받더라도 공개 필드에는 저장하지 않습니다(§2.6).
 *
 * 왜 `queryParams.scope`로 통째로 덮어쓰나 (P0-04):
 * - GoTrue 내장 `kakao` provider는 `account_email profile_image profile_nickname`을 항상 요청해,
 *   비즈앱이 아닌 앱에서는 KOE205로 막힙니다(supabase/auth#2574, 수정 PR #2579 미머지).
 * - `options.scopes`는 이 기본 목록 뒤에 **덧붙기만** 해서 `account_email`을 뺄 수 없으므로 쓰지 않습니다.
 * - `queryParams.scope`는 GoTrue가 인가 URL의 `scope` 값을 **교체**합니다(문서에 없는 동작 → 실 Kakao 스모크로 지킴).
 *   값이 빈 문자열이어도 키는 항상 보내야 합니다. 키가 빠지면 기본 목록이 그대로 나가 다시 KOE205가 됩니다.
 * PR #2579가 배포되면 이 덮어쓰기는 제거합니다(identity 이름은 그대로 `kakao`).
 */
export const KAKAO_SCOPE: string = '';

/**
 * Naver는 Supabase 커스텀 **OIDC** provider(`custom:naver`, issuer `https://nid.naver.com`, scope `openid`)입니다 (P0-03).
 * scope는 provider 설정에 저장되어 있으므로 여기서 따로 보내지 않습니다(이용자 식별자만).
 */
export const NAVER_PROVIDER_ID = 'custom:naver';

/**
 * 네이버 "네이버 앱으로 자동로그인" (P3-09 결정, P0-03 §4.7). Android(크롬·인앱 WebView)는 SDK 없이 웹으로 로그인할 때
 * `appscheme=true`를 줘야 이 버튼이 보이고, iOS는 주지 않아도 모든 모바일 브라우저에 보인다.
 * 그래서 **Android일 때만** 붙인다. 앱이 없거나 버튼이 무반응이어도 같은 화면의 아이디·비밀번호 로그인은 그대로 된다.
 * OIDC authorize(`custom:naver`)에서 동작하는지는 실 앱 스모크 N-8(docs/release/v0.4-phase3-providers.md §9)로 확인하고,
 * 문제가 있으면 이 값을 false로 바꾼다(다른 코드는 그대로).
 */
export const NAVER_APPSCHEME_ON_ANDROID = true;

const PROVIDER_IDS: Record<
  SocialProvider,
  SignInWithOAuthCredentials['provider']
> = {
  google: 'google',
  kakao: 'kakao',
  naver: NAVER_PROVIDER_ID,
};

interface OAuthOptionsInput {
  /** 앱 출처 (`window.location.origin`) */
  origin: string;
  /** 로그인 뒤 갈 같은 출처 경로. `/auth/callback`이 `safeNext`로 다시 검사합니다(B23). */
  next?: string;
  /**
   * 기기 (P3-09): Android면 네이버에 `appscheme=true` (`NAVER_APPSCHEME_ON_ANDROID`).
   * `type === 'kakaotalk'`이면 카카오 `prompt=login`을 붙이지 않는다(카카오톡 인앱 브라우저에서는 제공하지 않음)
   */
  device?: Pick<InAppBrowserInfo, 'isAndroid'> &
    Partial<Pick<InAppBrowserInfo, 'type'>>;
  /** 공용 기기 모드 (P4-09, `sharedDevice.ts`): provider가 매번 다시 로그인·계정 선택을 묻게 한다 (`SHARED_DEVICE_PARAMS`) */
  sharedDevice?: boolean;
}

/**
 * 공용 기기 모드에서 provider별로 더하는 인가 파라미터 (P4-09, §12-Q44). 확인 (2026-11-08):
 * - Kakao `prompt=login`: "기존 사용자 인증 여부와 상관없이 카카오계정 로그인 화면을 출력하여 다시 인증"
 *   (developers.kakao.com REST API 인가 코드 받기). **카카오톡 인앱 브라우저에서는 제공하지 않음** → 그때는 빼고 보낸다
 * - Naver(OIDC `custom:naver`) `prompt=login`: OIDC discovery `https://nid.naver.com/.well-known/openid-configuration`의
 *   `prompt_values_supported`가 `none·login·consent`. (`auth_type=reauthenticate`는 예전 `/oauth2.0/authorize` 파라미터라 쓰지 않음.)
 *   "네이버 앱으로 자동로그인"(`appscheme`)은 앱에 남은 로그인으로 들어가 버리므로 공용 기기에서는 붙이지 않는다
 * - Google `prompt=select_account`: Google OIDC 문서의 `prompt` 값은 `none`·`consent`·`select_account`뿐이다(`login` 없음,
 *   안 적힌 값은 오류가 날 수 있음). 비밀번호를 다시 묻지는 않지만 앞 사람 계정으로 **저절로** 들어가지 않고 계정을 고르게 한다.
 *   그래서 로그아웃 때 "Google 사이트에서도 로그아웃" 안내를 함께 한다(`LogoutButton`)
 * 실제 동작은 실기기 스모크 N-9(+K·G 같은 칸)로 확인한다 (docs/release/v0.4-phase3-providers.md)
 */
export const SHARED_DEVICE_PARAMS: Record<
  SocialProvider,
  Record<string, string>
> = {
  kakao: { prompt: 'login' },
  naver: { prompt: 'login' },
  google: { prompt: 'select_account' },
};

/** provider별 `signInWithOAuth`·`linkIdentity` 인자. redirectTo는 `next`가 없으면 정확히 `${origin}/auth/callback`입니다 (B43). */
export function getOAuthCredentials(
  provider: SocialProvider,
  { origin, next, device, sharedDevice = false }: OAuthOptionsInput,
): SignInWithOAuthCredentials {
  // redirectTo는 쿼리 없는 `/auth/callback`이 기본이다 (B43). Supabase는 Redirect URLs를 쿼리까지 비교하므로, 쿼리를 붙이면
  // 정확한 주소(`https://pyroad.vercel.app/auth/callback`)만 등록된 환경에서 맞지 않아 Site URL로 새어 나간다.
  // 시도한 수단은 주소가 아니라 sessionStorage에 둔다(`loginAttempt.ts`). `next`는 꼭 필요한 흐름(계정 연결 /settings,
  // 탈퇴 재인증)만 붙이고, 그 흐름은 Redirect URLs의 `https://pyroad.vercel.app/**`가 있어야 한다(providers 문서 §2)
  const callback = new URL('/auth/callback', origin);
  if (next) callback.searchParams.set('next', next);

  const options: NonNullable<SignInWithOAuthCredentials['options']> = {
    redirectTo: callback.toString(),
  };
  // 인가 URL 쿼리는 한 객체에 모아 합친다 (카카오 scope 덮어쓰기와 공용 기기 prompt가 서로 지우지 않게)
  const query: Record<string, string> = {};
  if (provider === 'kakao') query.scope = KAKAO_SCOPE;
  if (
    provider === 'naver' &&
    NAVER_APPSCHEME_ON_ANDROID &&
    device?.isAndroid &&
    !sharedDevice
  ) {
    query.appscheme = 'true';
  }
  // 공용 기기 모드 (P4-09): 매번 다시 로그인·계정 선택. 카카오톡 인앱의 카카오는 prompt=login을 지원하지 않아 뺀다
  if (sharedDevice && !(provider === 'kakao' && device?.type === 'kakaotalk')) {
    Object.assign(query, SHARED_DEVICE_PARAMS[provider]);
  }
  if (Object.keys(query).length > 0) options.queryParams = query;

  return { provider: PROVIDER_IDS[provider], options };
}

/**
 * 인앱 브라우저(웹뷰)에서 외부 브라우저로 보내야 하는지 (B16).
 * Google만 웹뷰 OAuth를 막으므로(`disallowed_useragent`) Google 버튼일 때만 보냅니다.
 * Kakao(카카오톡 인앱 로그인이 정식 시나리오)·Naver(인앱 WebView에서도 됨)는 인앱에서 그대로 진행합니다.
 * 외부 전환은 반드시 `signInWithOAuth` 호출 **전에** 합니다(PKCE verifier 쿠키가 시작한 브라우저에 있음).
 */
export function needsExternalBrowser(
  provider: SocialProvider,
  browserInfo: Pick<InAppBrowserInfo, 'isInApp'>,
): boolean {
  return provider === 'google' && browserInfo.isInApp;
}
