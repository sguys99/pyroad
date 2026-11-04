import type { ReactNode } from 'react';
import Probe from '@/components/Probe';

export const metadata = { title: 'P0-05 COI routing' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: 'system-ui', padding: 16 }}>
        <Probe />
        {children}
      </body>
    </html>
  );
}
