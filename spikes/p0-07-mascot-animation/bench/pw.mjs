// 공통: playwright-core 1.62.1 + 설치된 chromium-1234 (헤드리스 셸)
import { chromium } from 'playwright-core';
export const BASE = 'http://127.0.0.1:3107';
export async function launch(opts = {}) {
  return chromium.launch({ headless: true, args: ['--enable-precise-memory-info', ...(opts.args ?? [])], ...opts });
}
