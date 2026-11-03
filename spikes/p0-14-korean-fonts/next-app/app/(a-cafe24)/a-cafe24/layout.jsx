import '@/styles/lab.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/generated/d2coding/D2Coding.css';
import '@/generated/cafe24/Cafe24Ssurround.css';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'A · 제목 Cafe24 써라운드 (자가 슬라이스)' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" fonts={{ title: `'Cafe24 Ssurround', ${SYS_SANS}`, body: `'Pretendard Variable', Pretendard, ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 400 }}>
      {children}
    </Doc>
  );
}
