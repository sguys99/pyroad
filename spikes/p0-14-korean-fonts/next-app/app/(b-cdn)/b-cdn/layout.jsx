import '@/styles/lab.css';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'B · CDN (Google Fonts)' };

export default function Layout({ children }) {
  return (
    <Doc stack="b" head={<><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" /><link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gaegu:wght@700&family=Gowun+Dodum&display=swap" /><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/fonts-archive/D2Coding/subsets/D2Coding-dynamic-subset.css" /></>} fonts={{ title: `'Gaegu', ${SYS_SANS}`, body: `'Gowun Dodum', ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 700 }}>
      {children}
    </Doc>
  );
}
