import '@/styles/lab.css';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'A · CDN (Google Fonts + jsDelivr)' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" head={<><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" /><link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap" /><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" /><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/fonts-archive/D2Coding/subsets/D2Coding-dynamic-subset.css" /></>} fonts={{ title: `'Jua', ${SYS_SANS}`, body: `'Pretendard Variable', Pretendard, ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 400 }}>
      {children}
    </Doc>
  );
}
