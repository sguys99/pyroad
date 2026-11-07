import type { ReactElement } from 'react';
import type { SocialProvider } from '@/lib/auth/socialLogin';

/**
 * 소셜 로그인 버튼의 브랜드 문구와 로고 (P3-05). 버튼 색은 `social-login.css`, 규칙 근거·예외는 docs/design/components.md §12.
 *
 * 로고는 각 사가 배포한 원본 도형을 그대로 옮긴 인라인 SVG다(다시 그리지 않음, 색·비율 바꾸지 않음).
 * 출처·이용 조건은 docs/assets-license.md §9. 브랜드가 정한 색이라 토큰이 아니다 → 줄마다 `tokens-allow` (tokens.md §6)
 */

/** 버튼 글자. 각 가이드가 허용한 문구만 쓴다 */
export const SOCIAL_LABEL: Record<SocialProvider, string> = {
  // 카카오 가이드의 완성형 레이블 (축약형은 "로그인")
  kakao: '카카오 로그인',
  // 네이버 공식 버튼 애셋 문구 (가이드: 목적에 맞으면 문구 변경 가능)
  naver: '네이버 로그인',
  // "Sign in with Google"의 한국어 현지화 (가이드: 현지화 허용·권장, Google 자격 증명으로 로그인함이 분명해야 함).
  // GIS 기본 문구 "Google 계정으로 로그인"은 320px 화면에서 한 줄에 들어가지 않아 같은 뜻의 짧은 문구를 쓴다
  google: 'Google로 로그인',
};

/** 버튼을 누른 뒤 낭독기에 알리는 문구 (화면 글자는 그대로 두고 바쁨 표시만 더함) */
export const SOCIAL_PENDING: Record<SocialProvider, string> = {
  kakao: '카카오 로그인 화면으로 가고 있어요',
  naver: '네이버 로그인 화면으로 가고 있어요',
  google: 'Google 로그인 화면으로 가고 있어요',
};

/**
 * 카카오 심볼(말풍선). 카카오 디벨로퍼스 리소스 다운로드의 완성형 미리 보기
 * (https://developers.kakao.com/tool/images/resource/preview/login-complete-ko.svg)에서 말풍선 경로만 떼어 왔다.
 * viewBox는 그 경로의 경계 상자다. 색은 디자인 가이드 규정 #000000 (미리 보기 파일의 #191919가 아니라 가이드 문구를 따름)
 */
export function KakaoSymbol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="61.52 16.52 12.96 12.96"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d="M68.001 16.5225C64.4222 16.5225 61.5225 19.0037 61.5225 22.0641C61.5225 24.0312 62.7219 25.7596 64.5292 26.7423L63.9181 29.2113C63.8954 29.285 63.9132 29.364 63.9619 29.4184C63.9975 29.457 64.0461 29.478 64.0931 29.478C64.1337 29.478 64.1742 29.464 64.2082 29.4341L66.834 27.5144C67.2117 27.5723 67.6007 27.6039 67.9994 27.6039C71.5767 27.6039 74.478 25.1226 74.478 22.0623C74.478 19.002 71.5783 16.5225 68.001 16.5225Z"
        // tokens-allow: 카카오 로그인 디자인 가이드 심볼 색 #000000 (변경 불가)
        fill="#000000"
      />
    </svg>
  );
}

/**
 * 네이버 N 로고. 네이버 로그인 버튼 사용 가이드(https://developers.naver.com/docs/login/bi/bi.md)의
 * 공식 PNG 애셋(NAVER_login_KR.zip `NAVER_login_Light_KR_green_wide_H56.png`, 4배 해상도)에서 픽셀 경계를 재어
 * 80칸 격자로 옮긴 것이다(왼쪽 기둥 26 · 오른쪽 기둥 26 · 대각선, 180° 대칭). 색은 가이드의 Logo #FFFFFF
 */
export function NaverMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d="M0 0H26L54 43V0H80V80H54L26 37V80H0Z"
        // tokens-allow: 네이버 로그인 가이드 로고 색 #FFFFFF (녹색 배경 위)
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Google "G" 로고. Google Identity Services가 지금 그리는 공식 로그인 버튼
 * (accounts.google.com/gsi/button → credential_button_library, 2026-11-06 받음)의 SVG 경로·색을 그대로 썼다.
 * 크기·색은 바꾸지 않는다(브랜딩 가이드). 경로 4개뿐이라 id·마스크가 없어 어느 브라우저에서나 같게 그려진다
 */
export function GoogleG({ className }: { className?: string }) {
  // 원본 마지막 투명 사각형(fill none)은 그림에 영향이 없어 뺐다
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        // tokens-allow: Google 로고 원본 색 (빨강)
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        // tokens-allow: Google 로고 원본 색 (파랑)
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        // tokens-allow: Google 로고 원본 색 (노랑)
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        // tokens-allow: Google 로고 원본 색 (초록)
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export const SOCIAL_MARK: Record<
  SocialProvider,
  (props: { className?: string }) => ReactElement
> = {
  kakao: KakaoSymbol,
  naver: NaverMark,
  google: GoogleG,
};
