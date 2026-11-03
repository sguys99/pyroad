import '@/styles/lab.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/generated/d2coding/D2Coding.css';
import { jua } from '@/fonts/jua';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'A · 권장 (next/font/google Jua + Pretendard 동적 서브셋 + D2Coding 슬라이스)' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" className={`${jua.variable}`} fonts={{ title: `var(--nf-jua), ${SYS_SANS}`, body: `'Pretendard Variable', Pretendard, ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 400 }}>
      {children}
    </Doc>
  );
}
