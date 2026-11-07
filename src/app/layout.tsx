import type { Metadata, Viewport } from 'next';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { MotionTierProvider } from '@/lib/motion/MotionTierProvider';
import { SoundProvider } from '@/components/providers/SoundProvider';
import { LastLoginRecorder } from '@/components/auth/LastLoginRecorder';
import { MOTION_BOOT_SCRIPT } from '@/lib/motion/boot';
import { rootMetadata, rootViewport } from '@/lib/seo/metadata';
import './globals.css';

/**
 * 사이트 기본 메타데이터 (P4-10, `src/lib/seo/`). 하위 페이지 제목은 "%s - pyRoad" 틀.
 * 공유 미리보기 그림은 `src/app/opengraph-image.tsx`(빌드 때 정적 생성)가 붙는다.
 */
export const metadata: Metadata = rootMetadata();
export const viewport: Viewport = rootViewport;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // data-motion·data-reduced는 부트 스크립트가 첫 페인트 전에 붙이므로 서버 HTML과 다르다 → suppressHydrationWarning (P2-15)
  // 웹폰트는 루트에서 싣지 않는다 (P2-10): 랜딩은 src/fonts/landing.ts의 텍스트 서브셋, 앱 화면은 src/fonts/app.css의 조각
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 연출 단계 부트 (src/lib/motion/boot.ts). CSP nonce 정책은 이 내용의 sha256 해시로 허용 */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>
          <MotionTierProvider>
            <SoundProvider>{children}</SoundProvider>
            {/* 로그인 직후 #lp= 조각 → 최근 로그인 배지 저장 (P3-08). 그리는 것 없음 */}
            <LastLoginRecorder />
          </MotionTierProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
