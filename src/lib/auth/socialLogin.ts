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
  /** 기기 (P3-09): Android면 네이버에 `appscheme=true` (`NAVER_APPSCHEME_ON_ANDROID`) */
  device?: Pick<InAppBrowserInfo, 'isAndroid'>;
}

/** provider별 `signInWithOAuth`·`linkIdentity` 인자. redirectTo는 기존 `/auth/callback` 흐름 그대로입니다. */
export function getOAuthCredentials(
  provider: SocialProvider,
  { origin, next, device }: OAuthOptionsInput,
): SignInWithOAuthCredentials {
  const callback = new URL('/auth/callback', origin);
  if (next) callback.searchParams.set('next', next);

  const options: NonNullable<SignInWithOAuthCredentials['options']> = {
    redirectTo: callback.toString(),
  };
  if (provider === 'kakao') {
    options.queryParams = { scope: KAKAO_SCOPE };
  }
  if (provider === 'naver' && NAVER_APPSCHEME_ON_ANDROID && device?.isAndroid) {
    options.queryParams = { appscheme: 'true' };
  }
  // 공용 기기 모드 `prompt: 'login'`(네이버는 로그아웃 API가 없어 다음 사람에게 세션이 남음)은 아직 붙이지 않는다:
  // 공용 기기를 고를 자리(설정·로그인 화면 옵션)가 생길 때 여기에 provider별로 추가한다 (P3-09 결정, Phase 4 P4-09 검토)

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
