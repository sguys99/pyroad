import { defineConfig, devices } from '@playwright/test';
import base from '../../playwright.config';

/**
 * README 스크린샷 (P12-10). `npm run shots:readme` → img/readme-*.webp
 * 서버·로컬 Supabase 는 e2e 와 같은 방식 — 루트 playwright.config 의 webServer(PORT·E2E_REUSE_SERVER·E2E_SKIP_BUILD 그대로,
 * npm run 은 저장소 루트에서 돈다). 단 테스트 월드(책장 4권 "test-meadow")·테스트 페이지는 빼고 띄운다
 */
const server = base.webServer as Exclude<
  typeof base.webServer,
  unknown[] | undefined
>;

export default defineConfig({
  ...base,
  testDir: __dirname,
  testMatch: /shots\.spec\.ts/,
  timeout: 900_000,
  reporter: [['list']],
  projects: [{ name: 'readme-shots', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    ...server,
    env: { ...server.env, PYROAD_E2E_WORLDS: '', PYROAD_TEST_PAGES: '' },
  },
});
