import '@/styles/lab.css';
import { gaeguKsx } from '@/fonts/ksx-gaegu';
import { gowunKsx } from '@/fonts/ksx-gowun';
import { d2codingKsx } from '@/fonts/ksx-d2coding';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'B · KS X 1001 고정 서브셋 + preload' };

export default function Layout({ children }) {
  return (
    <Doc stack="b" className={`${gaeguKsx.variable} ${gowunKsx.variable} ${d2codingKsx.variable}`} fonts={{ title: `var(--nf-gaegu-ksx), ${SYS_SANS}`, body: `var(--nf-gowun-ksx), ${SYS_SANS}`, code: `var(--nf-d2-ksx), ${SYS_MONO}`, titleWeight: 700 }}>
      {children}
    </Doc>
  );
}
