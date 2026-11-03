import '@/styles/lab.css';
import 'pretendard/dist/web/static/pretendard-dynamic-subset.css';
import '@/generated/d2coding/D2Coding.css';
import { jua } from '@/fonts/jua';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'A · Pretendard 정적(400/700) 동적 서브셋' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" className={`${jua.variable}`} fonts={{ title: `var(--nf-jua), ${SYS_SANS}`, body: `Pretendard, ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 400 }}>
      {children}
    </Doc>
  );
}
