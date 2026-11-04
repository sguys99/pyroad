import localFont from 'next/font/local';
export const pretendardKsx = localFont({
  src: [
    { path: '../generated/ksx/Pretendard-Regular-ksx.woff2', weight: '400' },
    { path: '../generated/ksx/Pretendard-Bold-ksx.woff2', weight: '700' },
  ],
  display: 'swap',
  variable: '--nf-pretendard-ksx',
});
