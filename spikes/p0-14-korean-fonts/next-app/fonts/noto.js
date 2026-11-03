import { Noto_Sans_KR } from 'next/font/google';
// 현재 앱 설정과 동일 (src/app/layout.tsx): subsets latin, 400·700
export const noto = Noto_Sans_KR({ subsets: ['latin'], weight: ['400', '700'], variable: '--nf-noto' });
