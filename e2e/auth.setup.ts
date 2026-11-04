// 로그인 스펙의 준비 (P1-21): 로컬 Supabase 에 이번 실행 전용 테스트 사용자를 만들고 세션 쿠키를 저장한다.
//
// - 운영 계정·이메일 로그인 화면을 쓰지 않는다 (운영은 Email provider 꺼짐, B34). 사용자는 service_role 의
//   auth.admin.createUser 로 만들고, 로그인은 @supabase/ssr 로 Node 에서 한 번 해서 앱과 같은 형식의 쿠키를 받는다.
// - 로그인은 실행마다 1회 (로컬 Auth 로그인 한도 5분 30회). 테스트마다 진행만 되돌린다 (support/test.ts)
// - 앱 서버가 이 스택을 보는지 확인한다: 쿠키로 /world 가 열려야 하고, CSP connect-src 에 스택 주소가 있어야 함
//   (다른 스택·운영 env 로 빌드된 서버를 잡으면 여기서 실패)

import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { test as setup, expect } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { adminClient, type E2eUser } from './support/admin';
import {
  AUTH_DIR,
  STORAGE_STATE,
  USER_FILE,
  requireLocalStack,
} from './support/env';

setup('테스트 사용자 만들고 로그인', async ({ page, baseURL }) => {
  const stack = requireLocalStack();
  const admin = adminClient();

  // 1. 사용자 (이메일 확인 완료 상태). handle_new_user 트리거가 public.users 행을 만든다
  const email = `e2e-${Date.now()}-${randomBytes(3).toString('hex')}@e2e.pyroad.test`;
  const password = randomBytes(18).toString('base64url');
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E 모험가' },
    });
  if (createError || !created.user) {
    throw new Error(`[e2e] 테스트 사용자 생성 실패: ${createError?.message}`);
  }
  const user: E2eUser = { id: created.user.id, email };
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(USER_FILE, JSON.stringify(user, null, 2));

  // 2. 앱(@supabase/ssr)과 같은 이름·인코딩·청크의 세션 쿠키
  const jar = new Map<string, string>();
  const supabase = createServerClient(stack.url, stack.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(
      `[e2e] 로그인 실패: ${signInError.message} (로컬 config.toml 의 Email provider 가 켜져 있어야 함)`,
    );
  }
  expect(jar.size, '세션 쿠키').toBeGreaterThan(0);
  await page.context().addCookies(
    [...jar].map(([name, value]) => ({
      name,
      value,
      url: baseURL!,
      sameSite: 'Lax' as const,
    })),
  );

  // 3. 이 서버가 같은 스택을 보는지
  const response = await page.goto('/world');
  await expect(page).toHaveURL(/\/world$/);
  await expect(page.getByRole('heading', { name: '모험 지도' })).toBeVisible();
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(
    csp,
    'CSP connect-src 에 로컬 스택 주소 (서버가 e2e env 로 빌드됐는지)',
  ).toContain(stack.url);

  await page.context().storageState({ path: STORAGE_STATE });
});
