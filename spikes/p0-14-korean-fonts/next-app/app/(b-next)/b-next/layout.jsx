import '@/styles/lab.css';
import '@/generated/d2coding/D2Coding.css';
import { gaegu } from '@/fonts/gaegu';
import { gowun } from '@/fonts/gowun';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'B · 권장 (next/font/google Gaegu + Gowun Dodum + D2Coding 슬라이스)' };

export default function Layout({ children }) {
  return (
    <Doc stack="b" className={`${gaegu.variable} ${gowun.variable}`} fonts={{ title: `var(--nf-gaegu), ${SYS_SANS}`, body: `var(--nf-gowun), ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 700 }}>
      {children}
    </Doc>
  );
}
