import '@/styles/lab.css';
import { juaLanding, pretendardLanding, d2Landing } from '@/fonts/landing-a';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'A · 랜딩 텍스트 서브셋 (preload)' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" className={`${juaLanding.variable} ${pretendardLanding.variable} ${d2Landing.variable}`} fonts={{ title: `var(--nf-jua-landing), ${SYS_SANS}`, body: `var(--nf-pretendard-landing), ${SYS_SANS}`, code: `var(--nf-d2-landing), ${SYS_MONO}`, titleWeight: 400 }}>
      {children}
    </Doc>
  );
}
