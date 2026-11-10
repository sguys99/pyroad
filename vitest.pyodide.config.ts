import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// 실제 Pyodide 314를 Node worker_threads에서 띄우는 느린 테스트 (`npm run test:pyodide`).
// Pyodide 로딩이 테스트 파일마다 4~10초 걸려서 `npm test`에서는 뺀다 (vitest.config.ts의 exclude).
// mergeConfig는 exclude 배열을 이어 붙이므로 쓰지 않고 resolve만 가져온다.
export default defineConfig({
  resolve: base.resolve,
  test: {
    environment: 'node',
    include: ['**/*.pyodide.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'spikes/**', '.claude/worktrees/**'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
