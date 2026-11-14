import { afterEach, describe, expect, it, vi } from 'vitest';

const cookieValue = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () =>
      cookieValue.value === undefined
        ? undefined
        : { value: cookieValue.value },
  }),
}));

import { isPolicyEffective, PRIVACY_EFFECTIVE_DATE } from '../meta';
import { isPolicyLive, policyNotYet } from '../policyGate';

describe('isPolicyEffective (B79)', () => {
  it('시행일은 2026-11-21', () => {
    expect(PRIVACY_EFFECTIVE_DATE).toBe('2026-11-21');
  });

  it('KST 11-20 23:59:59 는 꺼짐, 11-21 00:00:00 은 켜짐', () => {
    expect(isPolicyEffective(new Date('2026-11-20T23:59:59+09:00'))).toBe(
      false,
    );
    expect(isPolicyEffective(new Date('2026-11-21T00:00:00+09:00'))).toBe(true);
  });

  it('UTC 날짜가 아니라 KST 날짜로 판정', () => {
    // UTC 로는 아직 11-20 15:00 이지만 KST 로는 11-21 00:00
    expect(isPolicyEffective(new Date('2026-11-20T15:00:00Z'))).toBe(true);
    expect(isPolicyEffective(new Date('2026-11-20T14:59:59Z'))).toBe(false);
    expect(isPolicyEffective(new Date('2026-11-21T23:00:00Z'))).toBe(true);
    expect(isPolicyEffective(new Date('2027-01-01T00:00:00Z'))).toBe(true);
  });

  it('공지일(2026-11-14)은 꺼짐', () => {
    expect(isPolicyEffective(new Date('2026-11-14T12:00:00+09:00'))).toBe(
      false,
    );
  });
});

describe('isPolicyLive (B79)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    cookieValue.value = undefined;
  });

  it('운영(테스트 페이지 꺼짐)은 시각만 본다 — 쿠키는 무시', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PYROAD_TEST_PAGES', '');
    cookieValue.value = 'after';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T23:59:59+09:00'));
    expect(await isPolicyLive()).toBe(false);
    vi.setSystemTime(new Date('2026-11-21T00:00:00+09:00'));
    expect(await isPolicyLive()).toBe(true);
    cookieValue.value = 'before';
    expect(await isPolicyLive()).toBe(true);
  });

  it('테스트 서버는 켜 두고, 쿠키 before 일 때만 끈다', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PYROAD_TEST_PAGES', '1');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-14T12:00:00+09:00'));
    expect(await isPolicyLive()).toBe(true);
    cookieValue.value = 'before';
    expect(await isPolicyLive()).toBe(false);
  });

  it('거부 응답은 404 not_yet + no-store', async () => {
    const res = policyNotYet();
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ code: 'not_yet' });
  });
});
