import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

/**
 * Pyodide 자체 호스팅 (B26, §2.9). `/pyodide/<버전>/`은 버전 경로라 내용이 바뀌지 않으므로 1년 immutable 캐시.
 * Content-Type을 직접 정한다: module Worker의 `import()`는 JS MIME이 아니면 거부하고,
 * wasm은 `application/wasm`이어야 스트리밍 컴파일(instantiateStreaming)을 쓴다.
 * Worker 스크립트(`/workers/*.mjs`)는 배포마다 바뀔 수 있으므로 캐시는 기본값(재검증)으로 둔다.
 */
const PYODIDE_IMMUTABLE = 'public, max-age=31536000, immutable';
const PYODIDE_CONTENT_TYPES: Array<[string, string]> = [
  ['mjs', 'text/javascript; charset=utf-8'],
  ['wasm', 'application/wasm'],
  ['zip', 'application/zip'],
  ['json', 'application/json; charset=utf-8'],
  ['map', 'application/json; charset=utf-8'],
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['pyodide'],
  async headers() {
    return [
      {
        source: '/pyodide/:version/:file*',
        headers: [{ key: 'Cache-Control', value: PYODIDE_IMMUTABLE }],
      },
      ...PYODIDE_CONTENT_TYPES.map(([ext, type]) => ({
        source: `/pyodide/:version/:file(.*\\.${ext})`,
        headers: [{ key: 'Content-Type', value: type }],
      })),
      {
        source: '/workers/:file(.*\\.mjs)',
        headers: [
          { key: 'Content-Type', value: 'text/javascript; charset=utf-8' },
        ],
      },
    ];
  },
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
