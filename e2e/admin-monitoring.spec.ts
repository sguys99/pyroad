// 운영 지표 (P12-09): 관리자만 /admin. 비로그인·학생은 404, 관리자는 월드맵 메뉴 → 운영 지표 → 기간 전환.
// 현실적인 분석 이벤트를 몇 개 넣고(끝나면 지움) 화면 숫자가 DB 함수(monitoring_summary) 값과 같은지.
// E2E_SHOTS=<폴더> 면 360·768·1280 전체 화면 스크린샷

import { randomBytes } from 'node:crypto';
import { type BrowserContext } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { test, expect, watchCspViolations } from './support/test';
import { adminClient } from './support/admin';
import { requireLocalStack } from './support/env';

const created: string[] = [];
const contexts: BrowserContext[] = [];
// 22자 익명 ID (DB CHECK). 이 스펙이 넣은 이벤트만 지우려고 앞을 고정
const ANON = (k: string) => `E2eMon${k}`.padEnd(22, 'x');

async function newAdmin(): Promise<{ name: string; value: string }[]> {
  const stack = requireLocalStack();
  const db = adminClient();
  const email = `e2e-mon-${Date.now()}-${randomBytes(3).toString('hex')}@e2e.pyroad.test`;
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });
  if (error || !data.user)
    throw new Error(`[e2e] 사용자 생성 실패: ${error?.message}`);
  created.push(data.user.id);
  const now = new Date().toISOString();
  await db
    .from('users')
    .update({
      nickname: '운영자',
      onboarded_at: now,
      age_band: '14plus',
      age_checked_at: now,
    })
    .eq('id', data.user.id);
  const jar = new Map<string, string>();
  const sb = createServerClient(stack.url, stack.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([n, value]) => ({ name: n, value })),
      setAll: (cs) =>
        cs.forEach(({ name: n, value }) =>
          value ? jar.set(n, value) : jar.delete(n),
        ),
    },
  });
  const { error: signInError } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`[e2e] 로그인 실패: ${signInError.message}`);
  return [...jar].map(([n, value]) => ({ name: n, value }));
}

test.beforeAll(async () => {
  const ago = (min: number) =>
    new Date(Date.now() - min * 60_000).toISOString();
  const rows = [
    ['V1', 'landing_view', 'visitor', 'client', {}, 50, 'mobile'],
    [
      'V1',
      'landing_cta_click',
      'visitor',
      'client',
      { cta: 'hero', provider: 'google' },
      49,
      'mobile',
    ],
    ['V2', 'landing_view', 'visitor', 'client', {}, 40, 'desktop'],
    [
      'U1',
      'login_success',
      'user',
      'server',
      { provider: 'google', new_user: true },
      30,
      'tablet',
    ],
    [
      'U1',
      'quest_start',
      'user',
      'server',
      { quest_id: 'b1000000-0000-0000-0000-000000000001' },
      29,
      'tablet',
    ],
    [
      'U1',
      'hint_used',
      'user',
      'server',
      { quest_id: 'b1000000-0000-0000-0000-000000000001', level: 2 },
      28,
      'tablet',
    ],
    [
      'U1',
      'tutor_free_question',
      'user',
      'server',
      { result: 'fallback' },
      27,
      'tablet',
    ],
  ] as const;
  const { error } = await adminClient()
    .from('analytics_events')
    .insert(
      rows.map(([k, name, actor, source, props, min, device]) => ({
        anon_id: ANON(k),
        name,
        actor,
        source,
        props,
        device,
        occurred_at: ago(min),
      })),
    );
  if (error) throw new Error(`[e2e] 이벤트 넣기 실패: ${error.message}`);
});

test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

test.afterAll(async () => {
  const db = adminClient();
  await db.from('analytics_events').delete().like('anon_id', 'E2eMon%');
  for (const id of created) await db.auth.admin.deleteUser(id);
});

test('비로그인·학생은 404 (있는 줄 모르게)', async ({
  page,
  browser,
  baseURL,
}) => {
  const student = await page.goto('/admin');
  expect(student?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '운영 지표' })).toHaveCount(0);

  const anon = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    baseURL,
  });
  contexts.push(anon);
  const p = await anon.newPage();
  const res = await p.goto('/admin?d=28');
  expect(res?.status()).toBe(404);
  // 월드맵 메뉴에도 학생에게는 줄이 없음
  await page.goto('/world');
  await page.getByRole('button', { name: /^메뉴/ }).click();
  await expect(page.getByRole('link', { name: '게시판' })).toBeVisible();
  await expect(page.getByRole('link', { name: '운영 지표' })).toHaveCount(0);
});

test('관리자: 메뉴 → 운영 지표, 숫자는 DB 함수와 같음, 기간 전환', async ({
  browser,
  baseURL,
}) => {
  const cookies = await newAdmin();
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    locale: 'ko-KR',
    viewport: { width: 1280, height: 900 },
  });
  contexts.push(context);
  await context.addCookies(
    cookies.map((c) => ({ ...c, url: baseURL!, sameSite: 'Lax' as const })),
  );
  const page = await context.newPage();
  const csp = await watchCspViolations(page);

  await page.goto('/world');
  await page.getByRole('button', { name: /^메뉴/ }).click();
  await page.getByRole('link', { name: '운영 지표' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '운영 지표' }),
  ).toBeVisible();
  const robots = await page
    .locator('meta[name="robots"]')
    .getAttribute('content');
  expect(robots).toContain('noindex');

  const { data } = await adminClient().rpc('monitoring_summary', { p_days: 7 });
  const s = data as {
    events: { active_users: number; landing_sessions: number; hints: number };
    cohort: { signups: number };
  };
  expect(s.events.landing_sessions).toBeGreaterThanOrEqual(2);
  const tile = (label: string) =>
    page
      .locator('.mon-tile')
      .filter({ hasText: label })
      .locator('.mon-tile-value');
  await expect(tile('활동한 학생')).toHaveText(
    s.events.active_users.toLocaleString('ko-KR'),
  );
  await expect(tile('힌트 받음')).toHaveText(
    s.events.hints.toLocaleString('ko-KR'),
  );
  const landingRow = page
    .getByRole('list', { name: '방문에서 로그인까지' })
    .getByRole('listitem')
    .filter({ hasText: '랜딩 방문' });
  await expect(landingRow).toContainText(
    s.events.landing_sessions.toLocaleString('ko-KR'),
  );
  await expect(page.getByTestId('mon-alerts')).toBeVisible();
  await expect(
    page.getByRole('table', { name: '성공 지표와 목표' }),
  ).toBeVisible();
  await expect(page.getByText('여기서는 수집 안 함')).toBeVisible();

  await page.getByRole('link', { name: '오늘' }).click();
  await expect(page).toHaveURL(/\/admin\?d=1$/);
  await expect(page.getByRole('link', { name: '오늘' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  if (process.env.E2E_SHOTS) {
    await page.goto('/admin?d=7');
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      await page.screenshot({
        path: `${process.env.E2E_SHOTS}/admin-monitoring-${width}.png`,
        fullPage: true,
      });
    }
  }
  expect(csp).toEqual([]);
});
