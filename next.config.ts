import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pyodide'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'lucide-react',
      'canvas-confetti',
      'lottie-react',
      '@codemirror/view',
      '@codemirror/state',
      '@codemirror/lang-python',
      'codemirror',
    ],
  },
};

/**
 * Sentry (P1-16). DSN이 없으면(로컬·테스트·CI) withSentryConfig를 적용하지 않는다 (빌드 플러그인·값 주입·소스맵 없음).
 * 소스맵은 `SENTRY_AUTH_TOKEN`이 있을 때(Vercel 빌드)만 만들어 올리고, 올린 뒤 지워서 공개 배포에 남기지 않는다.
 */
const sentryUploadEnabled = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      // 빌드 정보를 Sentry에 보내지 않음
      telemetry: false,
      sourcemaps: { disable: !sentryUploadEnabled },
      release: { create: sentryUploadEnabled, finalize: sentryUploadEnabled },
      widenClientFileUpload: sentryUploadEnabled,
      // bundleSizeOptimizations는 쓰지 않는다: Next 15.5가 boolean `compiler.define`에 매 빌드 경고를 내고,
      // 줄어드는 것은 첫 에러 때만 받는 지연 청크(약 4KB gzip)뿐이다
    })
  : nextConfig;
