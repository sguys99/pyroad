import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // *.pyodide.test.ts는 실제 Pyodide를 띄우는 느린 테스트라 `npm run test:pyodide`로 따로 돌린다
    exclude: ['e2e/**', 'node_modules/**', 'spikes/**', '**/*.pyodide.test.ts'],
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
