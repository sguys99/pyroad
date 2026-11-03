import '@/styles/lab.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/generated/d2coding/D2Coding.css';
import { cafe24Full } from '@/fonts/cafe24-full';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'A · 제목 Cafe24 써라운드 (공식 woff2 통파일)' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" className={`${cafe24Full.variable}`} fonts={{ title: `var(--nf-cafe24-full), ${SYS_SANS}`, body: `'Pretendard Variable', Pretendard, ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 400 }}>
      {children}
    </Doc>
  );
}
