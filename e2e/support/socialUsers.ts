// 소셜 로그인 목업(P3-17)용 로컬 사용자. 실제 provider identity 대신 이메일 사용자를 만들어 두고,
// 목업이 "provider에서 돌아온" 순간에 이 사용자로 로그인한 세션 쿠키를 브라우저에 넣는다(support/oauthMock.ts).
// 로그인은 사용자마다 한 번 (로컬 Auth 로그인 한도 5분 30회). 끝나면 deleteSocialUsers()로 지운다.

import { randomBytes } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { adminClient } from './admin';
import { requireLocalStack } from './env';

const created: string[] = [];

export interface SocialTestUser {
  id: string;
  /** 비밀번호 로그인 → 앱(@supabase/ssr)과 같은 형식의 세션 쿠키 */
  signIn: () => Promise<{ name: string; value: string }[]>;
}

/** @param onboarded true면 온보딩·나이 확인을 끝낸 사용자(바로 /world), false면 새 사용자(관문 → /onboarding, 나이 단계 포함) */
export async function createSocialUser({
  onboarded,
}: {
  onboarded: boolean;
}): Promise<SocialTestUser> {
  const stack = requireLocalStack();
  const admin = adminClient();
  const email = `e2e-social-${Date.now()}-${randomBytes(3).toString('hex')}@e2e.pyroad.test`;
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error(`[e2e] 사용자 생성 실패: ${error?.message}`);
  created.push(data.user.id);
  if (onboarded) {
    // auth.setup.ts 와 같이: 온보딩 + 나이 확인(만 14세 이상, P3-15)을 끝낸 상태 → 제한 모드·동의 띠 없이 월드맵
    const now = new Date().toISOString();
    const { error: e } = await admin
      .from('users')
      .update({ onboarded_at: now, age_band: '14plus', age_checked_at: now })
      .eq('id', data.user.id);
    if (e) throw new Error(`[e2e] 온보딩 표시 실패: ${e.message}`);
  }
  return {
    id: data.user.id,
    signIn: async () => {
      const jar = new Map<string, string>();
      const sb = createServerClient(stack.url, stack.anonKey, {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (cs) =>
            cs.forEach(({ name, value }) =>
              value ? jar.set(name, value) : jar.delete(name),
            ),
        },
      });
      const { error: signInError } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError)
        throw new Error(`[e2e] 로그인 실패: ${signInError.message}`);
      return [...jar].map(([name, value]) => ({ name, value }));
    },
  };
}

export async function deleteSocialUsers(): Promise<void> {
  const admin = adminClient();
  for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
}
