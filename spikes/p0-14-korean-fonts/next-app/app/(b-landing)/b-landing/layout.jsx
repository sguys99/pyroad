import '@/styles/lab.css';
import { gaeguLanding, gowunLanding, d2LandingB } from '@/fonts/landing-b';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'B · 랜딩 텍스트 서브셋 (preload)' };

export default function Layout({ children }) {
  return (
    <Doc stack="b" className={`${gaeguLanding.variable} ${gowunLanding.variable} ${d2LandingB.variable}`} fonts={{ title: `var(--nf-gaegu-landing), ${SYS_SANS}`, body: `var(--nf-gowun-landing), ${SYS_SANS}`, code: `var(--nf-d2-landing-b), ${SYS_MONO}`, titleWeight: 700 }}>
      {children}
    </Doc>
  );
}
