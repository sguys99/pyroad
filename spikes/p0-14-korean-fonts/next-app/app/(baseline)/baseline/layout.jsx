import '@/styles/lab.css';
import { noto } from '@/fonts/noto';
import { jetbrains } from '@/fonts/jetbrains';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: '현재 v0.3 설정 (Noto Sans KR next/font + JetBrains Mono)' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" className={`${noto.variable} ${jetbrains.variable}`} fonts={{ title: `var(--nf-noto), ${SYS_SANS}`, body: `var(--nf-noto), ${SYS_SANS}`, code: `var(--nf-jbm), ${SYS_MONO}`, titleWeight: 700 }}>
      {children}
    </Doc>
  );
}
