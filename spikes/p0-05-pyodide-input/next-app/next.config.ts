import type { NextConfig } from 'next';

// P0-05: 라우트 단위로 COOP/COEP를 붙였을 때 소프트 내비게이션에서 crossOriginIsolated가 어떻게 되는지 확인
const COEP = process.env.COEP ?? 'require-corp';
const COI = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: COEP },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'http', hostname: '127.0.0.1', port: '3105' }],
  },
  async headers() {
    return [
      // A. 기본: 퀘스트 라우트에만 헤더 (계획서 §11 "퀘스트 라우트에만 적용")
      { source: '/quest/:path*', headers: COI },
      // B. 앱 전체 격리를 흉내: /iso 아래 모든 페이지
      { source: '/iso/:path*', headers: COI },
      // C. 퀘스트에만 헤더 + 비격리 페이지에서 퀘스트로 갈 때 하드 내비게이션 (QuestLink)
      { source: '/heal/quest/:path*', headers: COI },
      // (D. /mw/quest/* 는 middleware.ts에서 헤더를 붙임)
      { source: '/coi-worker.js', headers: COI },
    ];
  },
};

export default nextConfig;
