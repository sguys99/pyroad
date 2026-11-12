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

/** 코드 퀘스트 폰 퀴즈 쪽지(P7-11) "본 기록" 키 (`src/components/quest/PhoneQuizNote.tsx`) */
export const PHONE_QUIZ_NOTE_KEY = 'pyroad.phoneQuizNote';

/**
 * 스트리밍 숨은 사본(`div[hidden][id^="S:"]`)이 사라질 때까지 (아래 `streamSettled` 픽스처). goto·reload 밖에서 문서가 새로 열릴 때
 * (예: 스트리밍 중 redirect → meta refresh로 /world 새 문서, B62) 직접 부른다
 */
export function waitStreamSettled(page: Page) {
  return page
    .waitForFunction(
      () => !document.querySelector('div[hidden][id^="S:"]'),
      undefined,
      { timeout: 10_000 },
    )
    .then(
      () => {},
      () => {},
    );
}

export const test = base.extend<
  {
    resetProgress: void;
    cspGuard: void;
    settle: void;
    quietPhoneQuizNote: void;
    streamSettled: void;
  },
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
  // 좁은 화면 퀘스트 스펙에서 폰 퀴즈 쪽지(아래 가운데 토스트)가 실행 버튼·키보드를 가리지 않게 "봤음"으로 시작.
  // 쪽지를 보는 테스트는 자기 init 스크립트(이 뒤에 실행됨)로 키를 지운다
  quietPhoneQuizNote: [
    async ({ page }, use) => {
      await page.addInitScript((key) => {
        try {
          localStorage.setItem(key, '1');
        } catch {}
      }, PHONE_QUIZ_NOTE_KEY);
      await use();
    },
    { auto: true },
  ],
  // 스트리밍 렌더(로딩 화면 → 내용)는 React 가 내용을 숨은 div(S:n)로 먼저 보낸 뒤 제자리로 옮겨, 그 사이 같은 testid 가 둘이라
  // strict 위치 찾기가 실패한다. 운영(Vercel ↔ Supabase 지연)에선 늘 스트리밍이고, 로컬은 월드맵 렌더가 조금만 길어져도(P8-07 미션 조회)
  // 그렇게 됨 → 페이지 이동·새로고침 뒤 숨은 div 가 사라질 때까지 기다린다 (화면에는 안 보이는 사본)
  streamSettled: [
    async ({ page }, use) => {
      const settled = () => waitStreamSettled(page);
      const goto = page.goto.bind(page);
      const reload = page.reload.bind(page);
      page.goto = async (...args) => {
        const res = await goto(...args);
        await settled();
        return res;
      };
      page.reload = async (...args) => {
        const res = await reload(...args);
        await settled();
        return res;
      };
      await use();
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
