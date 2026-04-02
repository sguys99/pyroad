import type { NextConfig } from 'next';

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
    ],
  },
};

export default nextConfig;
