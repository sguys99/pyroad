import { test as setup } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@pyroad.local';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'test1234!';

setup('authenticate', async ({ page }) => {
  // Supabase 이메일/비밀번호 로그인으로 세션 획득
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    throw new Error(
      `E2E 인증 실패: ${error.message}\n` +
        'Supabase Dashboard에서 이메일 로그인을 활성화하고 테스트 유저를 생성하세요.\n' +
        'E2E_TEST_EMAIL, E2E_TEST_PASSWORD 환경 변수를 설정하세요.',
    );
  }

  const { access_token, refresh_token } = data.session!;

  // Supabase Auth 쿠키를 브라우저에 세팅
  await page.goto('http://localhost:3000');

  // Supabase SSR 클라이언트가 사용하는 쿠키 형식으로 세션 주입
  const cookieValue = JSON.stringify({
    access_token,
    refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
  });

  // Supabase SSR의 청크 쿠키 설정
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;

  await page.context().addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // 인증 상태로 /world 접근하여 세션 확인
  await page.goto('http://localhost:3000/world');
  await page.waitForURL('**/world', { timeout: 10_000 });

  // storageState 저장
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
