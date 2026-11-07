import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';
import {
  API_CSP,
  COMMON_SECURITY_HEADERS,
  buildWorkerCsp,
} from './src/lib/security/csp';

/**
 * Pyodide 자체 호스팅 (B26, §2.9). `/pyodide/<버전>/`은 버전 경로라 내용이 바뀌지 않으므로 1년 immutable 캐시.
 * Content-Type을 직접 정한다: module Worker의 `import()`는 JS MIME이 아니면 거부하고,
 * wasm은 `application/wasm`이어야 스트리밍 컴파일(instantiateStreaming)을 쓴다.
 * Worker 스크립트(`/workers/*.mjs`)는 배포마다 바뀔 수 있으므로 캐시는 기본값(재검증)으로 둔다.
 * Worker 스크립트에는 Worker 전용 CSP를 붙인다 (B27, `src/lib/security/csp.ts`).
 */
/** 버전 경로·버전 파일 이름 공용 (Pyodide·사운드·이미지) */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
/** 파일 이름에 버전이 붙는 에셋 폴더 (P2-16, scripts/assets/) */
const VERSIONED_ASSET_DIRS = ['images', 'textures', 'animations'];
const PYODIDE_CONTENT_TYPES: Array<[string, string]> = [
  ['mjs', 'text/javascript; charset=utf-8'],
  ['wasm', 'application/wasm'],
  ['zip', 'application/zip'],
  ['json', 'application/json; charset=utf-8'],
  ['map', 'application/json; charset=utf-8'],
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['pyodide'],
  poweredByHeader: false,
  async headers() {
    return [
      // 보안 헤더 (B27). 페이지 CSP는 nonce가 필요해서 src/middleware.ts가 붙인다
      { source: '/:path*', headers: [...COMMON_SECURITY_HEADERS] },
      {
        source: '/api/:path*',
        headers: [{ key: 'Content-Security-Policy', value: API_CSP }],
      },
      {
        source: '/pyodide/:version/:file*',
        headers: [{ key: 'Cache-Control', value: IMMUTABLE_CACHE }],
      },
      ...PYODIDE_CONTENT_TYPES.map(([ext, type]) => ({
        source: `/pyodide/:version/:file(.*\\.${ext})`,
        headers: [{ key: 'Content-Type', value: type }],
      })),
      // 사운드 (P2-14): 파일 이름에 버전이 있어(`<id>.v<N>.webm`) 내용이 바뀌지 않으므로 1년 immutable 캐시.
      // 바꿀 때는 새 버전 파일 + src/lib/sound/manifest.ts 한 줄 (scripts/build-sounds.sh가 같은 이름 덮어쓰기를 막음)
      {
        source: '/sounds/:file*',
        headers: [{ key: 'Cache-Control', value: IMMUTABLE_CACHE }],
      },
      // 정지 그림·종이 결 타일·Lottie (P2-16): 같은 방식. 이 폴더들에는 파이프라인이 만든 `<id>.v<N>.<확장자>`만 두고
      // `npm run assets:check`가 이름 규칙·같은 이름 다른 내용·남은 파일을 막는다 (docs/design/assets.md)
      ...VERSIONED_ASSET_DIRS.map((dir) => ({
        source: `/${dir}/:file*`,
        headers: [{ key: 'Cache-Control', value: IMMUTABLE_CACHE }],
      })),
      {
        source: '/workers/:file(.*\\.mjs)',
        headers: [
          { key: 'Content-Type', value: 'text/javascript; charset=utf-8' },
          // Worker는 자기 스크립트 응답의 CSP를 쓴다. 'unsafe-eval' 없음 = Python → Function 우회 차단 (B27, §2.9)
          { key: 'Content-Security-Policy', value: buildWorkerCsp() },
        ],
      },
    ];
  },
  // 외부 이미지 출처 없음: provider 프로필 사진(lh3.googleusercontent.com)은 쓰지 않고 파이뱀 아바타로 그림 (P3-13, §2.6)
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
