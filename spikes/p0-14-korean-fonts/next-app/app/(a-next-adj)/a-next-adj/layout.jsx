import '@/styles/lab.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/generated/d2coding/D2Coding.css';
import '@/styles/fallback-adjust.css';
import { jua } from '@/fonts/jua';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'A · 권장 + 한글 폴백 size-adjust' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" className={`${jua.variable}`} fonts={{ title: `var(--nf-jua), 'Jua KR Fallback', ${SYS_SANS}`, body: `'Pretendard Variable', 'Pretendard KR Fallback', ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 400 }}>
      {children}
    </Doc>
  );
}
