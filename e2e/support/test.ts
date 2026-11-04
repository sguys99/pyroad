// 로그인 스펙(chromium 프로젝트)의 공통 픽스처 (P1-21)
//
// - e2eUser: auth.setup.ts 가 이번 실행에 만든 테스트 사용자 (storageState 는 playwright.config.ts 가 붙임)
// - 테스트마다 시작 전에 진행을 처음 상태로 되돌린다(자동) → 스펙 순서·재실행과 무관
// - CSP 위반 감시(자동): 페이지에서 securitypolicyviolation 이 한 번이라도 나면 테스트 실패 (B27 회귀)

import { test as base, expect, type Page } from '@playwright/test';
import { readE2eUser, resetUser, type E2eUser } from './admin';

export { expect };

/** 페이지의 CSP 위반을 이동(전체 새로고침 포함)과 상관없이 모은다. 비로그인 스펙도 같이 씀 */
export async function watchCspViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction('__e2eCspViolation', (v: string) => {
    violations.push(v);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const report = (
        window as unknown as { __e2eCspViolation: (v: string) => void }
      ).__e2eCspViolation;
      void report(
        `${e.effectiveDirective} ← ${e.blockedURI || '(inline)'} @ ${e.sourceFile || e.documentURI}:${e.lineNumber}`,
      );
    });
  });
  return violations;
}

/**
 * 테스트가 끝날 때 아직 응답을 받지 못한 쓰기 요청(완료·채점·힌트 기록·자동 저장)을 기다린다.
 * 페이지를 닫아도 서버는 요청을 끝까지 처리하므로, 기다리지 않으면 다음 테스트의 진행 초기화 뒤에 완료가 기록될 수 있다
 */
async function settleWrites(
  page: Page,
  run: () => Promise<void>,
): Promise<void> {
  const pending = new Set<Promise<unknown>>();
  page.on('request', (req) => {
    if (
      req.method() === 'GET' ||
      req.method() === 'HEAD' ||
      req.method() === 'OPTIONS'
    )
      return;
    const done = req.response().then((res) => res?.finished());
    const tracked = done.catch(() => {}).finally(() => pending.delete(tracked));
    pending.add(tracked);
  });
  await run();
  // 채점 응답 뒤에 완료 요청이 이어지므로, 대기 중인 요청이 없는 상태가 잠시 이어질 때까지 본다
  const QUIET_MS = 750;
  const deadline = Date.now() + 15_000;
  let quietSince = Date.now();
  while (Date.now() < deadline) {
    if (pending.size > 0) {
      await Promise.race([Promise.allSettled([...pending]), sleep(500)]);
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= QUIET_MS) {
      return;
    } else {
      await sleep(100);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const test = base.extend<
  { resetProgress: void; cspGuard: void; settle: void },
  { e2eUser: E2eUser }
>({
  e2eUser: [
    async ({}, use) => {
      await use(readE2eUser());
    },
    { scope: 'worker' },
  ],
  resetProgress: [
    async ({ e2eUser }, use) => {
      await resetUser(e2eUser.id);
      await use();
    },
    { auto: true },
  ],
  settle: [
    async ({ page }, use) => {
      await settleWrites(page, () => use());
    },
    { auto: true },
  ],
  cspGuard: [
    async ({ page }, use) => {
      const violations = await watchCspViolations(page);
      await use();
      expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
    },
    { auto: true },
  ],
});
