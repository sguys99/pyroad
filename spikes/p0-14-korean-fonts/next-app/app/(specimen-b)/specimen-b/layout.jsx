import '@/styles/lab.css';
import '@/generated/d2coding/D2Coding.css';
import { gaeguAll } from '@/fonts/gaegu-specimen';
import { gowun } from '@/fonts/gowun';
import { jetbrains } from '@/fonts/jetbrains';
import { nanumCoding } from '@/fonts/nanumcoding';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: 'P0-14 스페시멘 B · 마법 그림책' };

export default function Layout({ children }) {
  return (
    <Doc
      stack="b"
      className={`${gaeguAll.variable} ${gowun.variable} ${jetbrains.variable} ${nanumCoding.variable}`}
      fonts={{ title: `var(--nf-gaegu), ${SYS_SANS}`, body: `var(--nf-gowun), ${SYS_SANS}`, code: `'D2Coding', ${SYS_MONO}`, titleWeight: 700 }}
    >
      {children}
    </Doc>
  );
}
