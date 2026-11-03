import { describe, it, expect, vi, afterEach } from 'vitest';
import { isAdminUser } from '../admin';

vi.mock('@/lib/supabase/auth', () => ({ getAuthUser: vi.fn() }));

describe('isAdminUser', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ADMIN_EMAIL과 같은 이메일이면 관리자', () => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
    expect(isAdminUser({ email: 'admin@example.com' })).toBe(true);
    expect(isAdminUser({ email: 'kid@example.com' })).toBe(false);
  });

  it('ADMIN_EMAIL이 없으면 이메일 없는 계정도 관리자가 아님', () => {
    vi.stubEnv('ADMIN_EMAIL', '');
    expect(isAdminUser({ email: undefined })).toBe(false);
    expect(isAdminUser({ email: '' })).toBe(false);
  });

  it('로그인하지 않았으면 관리자가 아님', () => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
    expect(isAdminUser(null)).toBe(false);
  });
});
