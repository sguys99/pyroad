// Spike-local config (the root vitest.config.ts excludes spikes/**). Run with the repo's vitest binary:
//   ../../node_modules/.bin/vitest run --config vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  test: {
    include: ['content.test.ts'],
    environment: 'node',
    // one Pyodide instance per test file, loaded in beforeAll
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
});
