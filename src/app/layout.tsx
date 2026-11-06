import type { Metadata } from 'next';
import { Noto_Sans_KR, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { MotionTierProvider } from '@/lib/motion/MotionTierProvider';
import { SoundProvider } from '@/components/providers/SoundProvider';
import { MOTION_BOOT_SCRIPT } from '@/lib/motion/boot';
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
  // data-motion·data-reduced는 부트 스크립트가 첫 페인트 전에 붙이므로 서버 HTML과 다르다 → suppressHydrationWarning (P2-15)
  return (
    <html
      lang="ko"
      className={cn('font-sans', notoSansKR.variable, jetbrainsMono.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* 연출 단계 부트 (src/lib/motion/boot.ts). CSP nonce 정책은 이 내용의 sha256 해시로 허용 */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>
          <MotionTierProvider>
            <SoundProvider>{children}</SoundProvider>
          </MotionTierProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
