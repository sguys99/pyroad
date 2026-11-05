import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // 실제 Pyodide를 띄우는 느린 테스트는 따로 돌린다:
    // *.pyodide.test.ts → `npm run test:pyodide`, *.content.test.ts → `npm run test:content` (P1-13)
    exclude: [
      'e2e/**',
      'node_modules/**',
      'spikes/**',
      'design/**',
      '**/*.pyodide.test.ts',
      '**/*.content.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only'는 Next.js가 빌드 때 처리하므로 패키지가 없음. 테스트에서는 빈 모듈로
      'server-only': path.resolve(
        __dirname,
        './node_modules/next/dist/compiled/server-only/empty.js',
      ),
    },
  },
});
