import localFont from 'next/font/local';
// 코드 블록은 첫 화면 핵심이 아니므로 preload하지 않는다.
export const d2codingKsx = localFont({ src: '../generated/ksx/D2Coding-ksx.woff2', weight: '400', display: 'swap', preload: false, variable: '--nf-d2-ksx' });
