import '@/styles/lab.css';
import { juaKsx } from '@/fonts/ksx-jua';
import { pretendardKsx } from '@/fonts/ksx-pretendard';
import { d2codingKsx } from '@/fonts/ksx-d2coding';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'A · KS X 1001 고정 서브셋 + preload' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" className={`${juaKsx.variable} ${pretendardKsx.variable} ${d2codingKsx.variable}`} fonts={{ title: `var(--nf-jua-ksx), ${SYS_SANS}`, body: `var(--nf-pretendard-ksx), ${SYS_SANS}`, code: `var(--nf-d2-ksx), ${SYS_MONO}`, titleWeight: 400 }}>
      {children}
    </Doc>
  );
}
