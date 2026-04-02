import type { Metadata } from 'next';
import { Noto_Sans_KR, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { MotionProvider } from '@/components/providers/MotionProvider';
import './globals.css';

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'pyRoad',
  description:
    '파이뱀 선생님과 함께 퀘스트를 깨며 파이썬을 배우는 초등학생 전용 웹 학습 플랫폼',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={cn('font-sans', notoSansKR.variable, jetbrainsMono.variable)}
    >
      <body><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
