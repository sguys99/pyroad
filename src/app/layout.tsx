import type { Metadata } from 'next';
import { Noto_Sans_KR, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { MotionProvider } from '@/components/providers/MotionProvider';
import './globals.css';

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-noto',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

const SITE_URL = 'https://pyroad.vercel.app';

export const metadata: Metadata = {
  title: 'pyRoad - 파이썬 모험의 시작',
  description:
    '파이뱀 선생님과 함께 퀘스트를 깨며 파이썬을 배우는 초등학생 전용 웹 학습 플랫폼',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'pyRoad - 파이썬 모험의 시작',
    description:
      '파이뱀 선생님과 함께 퀘스트를 깨며 파이썬을 배우는 초등학생 전용 웹 학습 플랫폼',
    url: SITE_URL,
    siteName: 'pyRoad',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'pyRoad - 파이뱀 선생님과 파이썬 모험',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'pyRoad - 파이썬 모험의 시작',
    description:
      '파이뱀 선생님과 함께 퀘스트를 깨며 파이썬을 배우는 초등학생 전용 웹 학습 플랫폼',
    images: ['/og-image.png'],
  },
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
