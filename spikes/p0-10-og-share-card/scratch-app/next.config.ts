import type { NextConfig } from 'next';

// 스크래치 앱 전용 설정. 폰트는 process.cwd() 기준 readFile 이라 파일 추적(nft)에 명시적으로 포함합니다.
// 실제 운영에 필요한 폰트(ks2350 서브셋 TTF/OTF 5종 + Fallback Pretendard 전체 1종)만 넣습니다.
const PROD_FONTS = ['./assets/fonts/*.ks2350.{ttf,otf}', './assets/fonts/Pretendard-Bold.full.otf'];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/og/[kind]': PROD_FONTS,
    '/share/[cardId]/opengraph-image': PROD_FONTS,
  },
  // 측정용 변형 폰트(full/ui/woff/orig)를 빼려는 설정. 실측 결과 Turbopack 빌드에서는 효과가 없어
  // process.cwd() 기준 폰트 디렉토리 전체(39MB)가 추적됐습니다 → 운영에서는 운영 폰트만 둔 전용 디렉토리를 쓰세요.
  outputFileTracingExcludes: {
    '*': ['./assets/fonts/orig/**', './assets/fonts/*.ui.*', './assets/fonts/*.woff', './assets/fonts/*.full.ttf', './assets/fonts/Pretendard-ExtraBold.full.otf', './assets/fonts/Cafe24*'],
  },
};

export default nextConfig;
