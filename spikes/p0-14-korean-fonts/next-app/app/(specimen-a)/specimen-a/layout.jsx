import '@/styles/lab.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/generated/d2coding/D2Coding.css';
import '@/generated/cafe24/Cafe24Ssurround.css';
import '@/generated/cafe24air/Cafe24SsurroundAir.css';
import { jua } from '@/fonts/jua';
import { jetbrains } from '@/fonts/jetbrains';
import { nanumCoding } from '@/fonts/nanumcoding';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'P0-14 스페시멘 A · 모험 섬' };

export default function Layout({ children }) {
  return (
    <Doc
      stack="a"
      className={`${jua.variable} ${jetbrains.variable} ${nanumCoding.variable}`}
      fonts={{ title: `var(--nf-jua), ${SYS_SANS}`, body: `'Pretendard Variable', Pretendard, ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 400 }}
    >
      {children}
    </Doc>
  );
}
