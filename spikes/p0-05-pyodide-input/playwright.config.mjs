// P0-05 스파이크 전용 Playwright 설정 (루트 playwright.config와 무관).
// 실행: npx playwright test -c playwright.config.mjs   (spikes/p0-05-pyodide-input 에서)
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.mjs/,
  timeout: 20 * 60 * 1000,
  fullyParallel: true,
  workers: Number(process.env.PW_WORKERS || 3),
  reporter: [['list']],
  // 실패 시 스크린샷·trace 출력 위치 (커밋 대상 아님). 기본은 OS 임시 디렉터리
  outputDir: process.env.PW_OUTPUT_DIR || `${process.env.TMPDIR || '/tmp'}/p0-05-test-output`,
  use: { baseURL: 'http://localhost:3105' },
  webServer: {
    command: 'node server.mjs',
    env: { QUIET: '1' },
    url: 'http://localhost:3105/m/plain/web/index.html',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
