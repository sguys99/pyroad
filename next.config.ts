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
      '@codemirror/view',
      '@codemirror/state',
      '@codemirror/lang-python',
      'codemirror',
    ],
  },
};

export default nextConfig;
