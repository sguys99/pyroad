import { defineConfig, devices } from '@playwright/test';
import { STORAGE_STATE, resolveLocalStack, serverEnv } from './e2e/support/env';

/**
 * e2e (P1-21). 사용법: e2e/README.md
 *
 * 프로젝트
 * - public: 비로그인 스펙(e2e/public/). 로컬 Supabase 없이 돈다 → CI e2e-smoke (PR 필수 체크 후보)
 * - setup → chromium → teardown: 로그인 스펙. 로컬 Supabase 에 이번 실행 전용 사용자를 만들고(service_role) 끝나면 지운다
 *
 * 서버
 * - 포트는 PORT(기본 3100). 3000 은 다른 프로젝트 dev 서버가 쓰는 일이 많아 피한다 (B29 ①)
 * - 이미 떠 있는 서버는 E2E_REUSE_SERVER=1 일 때만 쓴다 (엉뚱한 서버를 대상으로 돌지 않게). 그 서버도 e2e env 로 떠 있어야 함
 *   (setup 이 CSP 의 Supabase 주소로 확인)
 * - E2E_SERVER=prod(기본): `npm run build` + `npm run start` (prebuild 가 Pyodide 자체 호스팅 파일 복사, 배포와 같은 CSP)
 *   E2E_SERVER=dev: `npm run dev` (predev 가 복사, 첫 요청마다 컴파일이라 느림). E2E_SKIP_BUILD=1: 이미 e2e env 로 만든 빌드로 start 만
 * - env 는 로컬 스택만 가리키고 .env·.env.local 의 값(운영 키·LLM 키·Sentry·분석 salt)은 빈 값으로 덮는다 (e2e/support/env.ts)
 */
const PORT = Number(process.env.PORT || 3100);
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_MODE = process.env.E2E_SERVER === 'dev' ? 'dev' : 'prod';
const CI = !!process.env.CI;

// 테스트 월드(e2e/fixtures/content, Q48·P5-01)의 지도 설정·DB 행을 build/e2e/ 에 만든다. 운영 seed·커밋 생성물은 그대로
const FIXTURES = 'npm run content:build -- --fixtures e2e/fixtures/content';

function serverCommand(): string {
  if (SERVER_MODE === 'dev')
    return `${FIXTURES} && npm run dev -- --port ${PORT}`;
  const start = `npm run start -- --port ${PORT}`;
  return process.env.E2E_SKIP_BUILD === '1'
    ? `${FIXTURES} && ${start}`
    : `${FIXTURES} && npm run build && ${start}`;
}

export default defineConfig({
  testDir: './e2e',
  // 로그인 스펙은 테스트 사용자 1명을 테스트마다 되돌리며 쓰므로 한 줄로 돈다
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  // 재시도로 흔들림을 가리지 않는다. 실패하면 trace 로 본다
  retries: 0,
  reporter: CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },

  projects: [
    {
      name: 'public',
      testMatch: /public\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      teardown: 'teardown',
    },
    {
      name: 'teardown',
      testMatch: /auth\.teardown\.ts/,
    },
    {
      name: 'chromium',
      // e2e/support/__tests__ 는 vitest 단위 테스트 (P3-17)
      testIgnore: [/public\//, /__tests__\//],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: serverCommand(),
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
    // 빌드 포함 (로컬 약 2분, CI 약 3분)
    timeout: 360_000,
    env: serverEnv(resolveLocalStack(), PORT),
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
