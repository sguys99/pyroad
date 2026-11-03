// next/font/google: 한글 폰트는 subsets가 latin뿐 → latin 슬라이스만 preload, 한글 슬라이스(~86~120개)는 빌드 시 전부 자가 호스팅되고 unicode-range로 필요한 것만 받는다.
import { Jua } from 'next/font/google';
export const jua = Jua({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--nf-jua' });
