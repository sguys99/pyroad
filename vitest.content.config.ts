import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// 모든 퀘스트의 정답 코드를 실제 Pyodide 314로 실행하는 콘텐츠 검증 (`npm run test:content`, P1-13).
// Pyodide 를 여러 개 띄우고 수백 번 실행해 `npm test`에서는 뺀다 (vitest.config.ts의 exclude).
// mergeConfig는 exclude 배열을 이어 붙이므로 쓰지 않고 resolve만 가져온다.
export default defineConfig({
  resolve: base.resolve,
  test: {
    environment: 'node',
    include: ['**/*.content.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'spikes/**', '.claude/worktrees/**'],
    // 각 테스트는 미리 예약한 자기 단위의 실행 결과를 기다림
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
