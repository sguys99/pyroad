import localFont from 'next/font/local';
// 랜딩 전용 "페이지 텍스트 서브셋": content.js 문구에 쓰인 글자만 담은 작은 파일을 preload한다.
// 문구가 바뀌면 prebuild에서 다시 만든다. 빠진 글자는 font-family 스택의 다음 폰트(시스템)로 그려진다.
export const juaLanding = localFont({ src: '../generated/textsub/Jua-landing.woff2', weight: '400', display: 'swap', variable: '--nf-jua-landing' });
export const pretendardLanding = localFont({
  src: [
    { path: '../generated/textsub/Pretendard-Regular-landing.woff2', weight: '400' },
    { path: '../generated/textsub/Pretendard-Bold-landing.woff2', weight: '700' },
  ],
  display: 'swap',
  variable: '--nf-pretendard-landing',
});
export const d2Landing = localFont({ src: '../generated/textsub/D2Coding-landing.woff2', weight: '400', display: 'swap', preload: false, variable: '--nf-d2-landing' });
