import localFont from 'next/font/local';

/**
 * 랜딩 텍스트 서브셋 (P2-10, P0-14 §1, P4-12). 랜딩 문구에 쓰인 글자만 담은 작은 파일이라
 * 첫 페인트와 거의 동시에 브랜드 폰트로 그려진다. 랜딩 페이지(`src/app/page.tsx`)에서만 import한다:
 * 여기서 import한 라우트에만 preload가 붙는다.
 *
 * - 제목(Jua): 제목 글꼴 자리(`font-display` 클래스·h1~h3)에 쓰인 글자 + 숫자·문장부호만
 * - 본문(pyRoad Sans): 랜딩 문구 글자 전부 + ASCII. 가변 축은 랜딩이 쓰는 굵기 400~700만 (그 밖 굵기는 가까운 끝으로 그려짐)
 *
 * 파일은 `npm run fonts:build -- --landing`이 만든다. 랜딩 문구를 바꾸면 다시 만들어야 하고,
 * 빠뜨리면 `npm run fonts:check`(prebuild·CI)가 실패한다. 서브셋에 없는 글자는 토큰 스택의 다음 폰트로 그려진다.
 *
 * `variable`은 globals.css의 `--font-display`·`--font-sans` 맨 앞 자리(`var(--font-*-landing, …)`)를 채운다.
 * 굵기는 파일 하나에 범위로 선언한다(Jua는 굵기가 하나라 `font-bold`도 합성 없이 그대로, pyRoad Sans는 가변 400~700 —
 * 바꾸면 scripts/fonts/build-fonts.mjs `FAMILIES.sans.landingSubset.wght`도 같이, fonts:check가 비교).
 */
export const displayLanding = localFont({
  src: './jua/Jua-landing.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-display-landing',
});

export const sansLanding = localFont({
  src: './pyroad-sans/pyRoadSans-landing.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-sans-landing',
});
