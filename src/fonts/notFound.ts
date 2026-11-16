import localFont from 'next/font/local';

/**
 * 404 화면(루트 `not-found.tsx`) 글꼴 (B99): 랜딩 텍스트 서브셋과 같은 파일, preload만 끈다.
 * 루트 not-found는 모든 라우트 트리에 들어가므로 preload를 켜면 모든 화면이 랜딩 글꼴을 미리 받는다(postbuild 검사가 막음).
 * 담긴 글자는 `scripts/fonts/landing-text.mjs`의 `LANDING_ENTRIES`(not-found 포함)가 정한다.
 */
export const displayNotFound = localFont({
  src: './jua/Jua-landing.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--font-display-landing',
});

export const sansNotFound = localFont({
  src: './pyroad-sans/pyRoadSans-landing.woff2',
  weight: '400 700',
  display: 'swap',
  preload: false,
  variable: '--font-sans-landing',
});
