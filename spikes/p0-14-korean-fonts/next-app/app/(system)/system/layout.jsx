import '@/styles/lab.css';
import { Doc, SYS_SANS, SYS_MONO } from '@/components/parts';

export const metadata = { title: '웹폰트 없음 (시스템 폰트)' };

export default function Layout({ children }) {
  return (
    <Doc stack="a" fonts={{ title: `${SYS_SANS}`, body: `${SYS_SANS}`, code: `${SYS_MONO}`, titleWeight: 700 }}>
      {children}
    </Doc>
  );
}
