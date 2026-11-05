import { describe, it, expect, vi, afterEach } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { isAdmin, isAdminUser } from '../admin';

const getAuthUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/auth', () => ({ getAuthUser }));

const CONFIRMED = '2026-01-01T00:00:00Z';

/** getUser() 결과 모양의 최소 사용자 */
function user(over: Partial<User> = {}): User {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    created_at: CONFIRMED,
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: {},
    ...over,
  };
}

describe('isAdminUser (B37)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('app_metadata.role', () => {
    it("role이 'admin'이면 ADMIN_EMAIL과 상관없이 관리자", () => {
      vi.stubEnv('ADMIN_EMAIL', '');
      expect(isAdminUser(user({ app_metadata: { role: 'admin' } }))).toBe(true);
    });

    it('role을 우선: 이메일이 달라도, 이메일이 없어도(Kakao·Naver) 관리자', () => {
      vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
      expect(
        isAdminUser(
          user({
            app_metadata: { provider: 'kakao', role: 'admin' },
            email: undefined,
          }),
        ),
      ).toBe(true);
      expect(
        isAdminUser(
          user({
            app_metadata: { role: 'admin' },
            email: 'other@example.com',
            email_confirmed_at: CONFIRMED,
          }),
        ),
      ).toBe(true);
    });

    it("'admin'이 아닌 role은 관리자가 아님", () => {
      vi.stubEnv('ADMIN_EMAIL', '');
      for (const role of [
        'Admin',
        'authenticated',
        'service_role',
        true,
        ['admin'],
      ]) {
        expect(isAdminUser(user({ app_metadata: { role } }))).toBe(false);
      }
    });

    it('user_metadata.role은 사용자가 바꿀 수 있으므로 무시', () => {
      vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
      expect(isAdminUser(user({ user_metadata: { role: 'admin' } }))).toBe(
        false,
      );
      expect(
        isAdminUser(
          user({
            user_metadata: { role: 'admin', email: 'admin@example.com' },
            email: 'kid@example.com',
            email_confirmed_at: CONFIRMED,
          }),
        ),
      ).toBe(false);
    });
  });

  describe('ADMIN_EMAIL 폴백 (이행 기간)', () => {
    it('확인된 같은 이메일이면 관리자 (대소문자·앞뒤 공백 무시)', () => {
      vi.stubEnv('ADMIN_EMAIL', ' Admin@Example.com ');
      expect(
        isAdminUser(
          user({ email: 'admin@example.com', email_confirmed_at: CONFIRMED }),
        ),
      ).toBe(true);
      expect(
        isAdminUser(
          user({ email: 'kid@example.com', email_confirmed_at: CONFIRMED }),
        ),
      ).toBe(false);
    });

    it('이메일이 확인되지 않았으면 관리자가 아님', () => {
      vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
      expect(isAdminUser(user({ email: 'admin@example.com' }))).toBe(false);
      expect(
        isAdminUser(
          user({ email: 'admin@example.com', email_confirmed_at: '' }),
        ),
      ).toBe(false);
    });

    it('ADMIN_EMAIL이 없으면 폴백 없음 (이메일 없는 계정끼리 같다고 보지 않음)', () => {
      vi.stubEnv('ADMIN_EMAIL', '');
      expect(isAdminUser(user({ email: undefined }))).toBe(false);
      expect(
        isAdminUser(user({ email: '', email_confirmed_at: CONFIRMED })),
      ).toBe(false);
    });

    it('이메일 없는 계정(Kakao·Naver)은 role 없이는 관리자가 아님', () => {
      vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
      expect(
        isAdminUser(
          user({
            app_metadata: { provider: 'custom:naver' },
            email: '',
            email_confirmed_at: CONFIRMED,
          }),
        ),
      ).toBe(false);
    });
  });

  it('로그인하지 않았으면 관리자가 아님', () => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });

  it('isAdmin()은 getAuthUser()의 사용자로 판별', async () => {
    vi.stubEnv('ADMIN_EMAIL', '');
    getAuthUser.mockResolvedValueOnce({
      user: user({ app_metadata: { role: 'admin' } }),
      error: null,
    });
    await expect(isAdmin()).resolves.toBe(true);
    getAuthUser.mockResolvedValueOnce({ user: null, error: null });
    await expect(isAdmin()).resolves.toBe(false);
  });
});
