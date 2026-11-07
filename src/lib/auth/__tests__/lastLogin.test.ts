import { describe, expect, it } from 'vitest';
import {
  LAST_LOGIN_MAX_AGE_MS,
  LAST_LOGIN_STORAGE_KEY,
  parseLastLogin,
  readLastLogin,
  takeLastLoginFragment,
  withLastLoginFragment,
  writeLastLogin,
} from '../lastLogin';
import { orderProviders } from '../providerOrder';

// "최근에 ○○로 로그인했어요" 배지의 브라우저 저장값 (P3-08)

const NOW = Date.parse('2026-11-06T09:00:00Z');

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const throwing = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
} as unknown as Storage;

describe('저장값', () => {
  it('키는 pyroad.lastLogin.v1, 값은 provider + 시각만 (계정 식별자 없음)', () => {
    const s = memoryStorage();
    expect(writeLastLogin('naver', s, NOW)).toBe(true);
    expect(JSON.parse(s.getItem(LAST_LOGIN_STORAGE_KEY)!)).toEqual({
      provider: 'naver',
      at: '2026-11-06T09:00:00.000Z',
    });
    expect(readLastLogin(s, NOW)).toEqual({
      provider: 'naver',
      at: '2026-11-06T09:00:00.000Z',
    });
  });

  it('1년이 지났거나 하루 넘게 미래면 무시', () => {
    const at = (t: number) =>
      JSON.stringify({ provider: 'kakao', at: new Date(t).toISOString() });
    expect(
      parseLastLogin(at(NOW - LAST_LOGIN_MAX_AGE_MS + 1000), NOW),
    ).not.toBeNull();
    expect(
      parseLastLogin(at(NOW - LAST_LOGIN_MAX_AGE_MS - 1000), NOW),
    ).toBeNull();
    expect(parseLastLogin(at(NOW + 2 * 24 * 3600_000), NOW)).toBeNull();
  });

  it.each([
    'not json',
    '"kakao"',
    'null',
    '{"provider":"github","at":"2026-11-01T00:00:00Z"}',
    // 짧은 이름 3종만 (custom:naver 같은 원래 이름은 저장하지 않음)
    '{"provider":"custom:naver","at":"2026-11-01T00:00:00Z"}',
    '{"provider":"kakao","at":"어제"}',
    '{"provider":"kakao"}',
  ])('모양이 틀리면 null: %s', (raw) => {
    expect(parseLastLogin(raw, NOW)).toBeNull();
  });

  it('저장소가 막혀 있어도 예외 없이 null·false (사파리 개인 정보 보호 모드)', () => {
    expect(readLastLogin(throwing, NOW)).toBeNull();
    expect(writeLastLogin('google', throwing, NOW)).toBe(false);
    expect(readLastLogin(null, NOW)).toBeNull();
    expect(writeLastLogin('google', null, NOW)).toBe(false);
  });
});

describe('리다이렉트 조각 #lp=', () => {
  it('서버: safeNext를 통과한 경로에 붙이고, 이미 조각이 있거나 provider를 모르면 그대로', () => {
    expect(withLastLoginFragment('/world', 'kakao')).toBe('/world#lp=kakao');
    expect(withLastLoginFragment('/settings?tab=account', 'naver')).toBe(
      '/settings?tab=account#lp=naver',
    );
    expect(withLastLoginFragment('/notice#top', 'google')).toBe('/notice#top');
    expect(withLastLoginFragment('/world', null)).toBe('/world');
  });

  it('클라이언트: provider를 읽고 조각을 지운 경로+쿼리를 돌려준다', () => {
    expect(
      takeLastLoginFragment('https://pyroad.vercel.app/world?x=1#lp=google'),
    ).toEqual({ provider: 'google', cleaned: '/world?x=1' });
    // 모르는 값도 조각은 지운다
    expect(takeLastLoginFragment('https://a.test/world#lp=github')).toEqual({
      provider: null,
      cleaned: '/world',
    });
    expect(
      takeLastLoginFragment('https://a.test/world#lp=custom:naver'),
    ).toEqual({
      provider: null,
      cleaned: '/world',
    });
    // 다른 조각은 건드리지 않음
    expect(takeLastLoginFragment('https://a.test/notice#top')).toBeNull();
    expect(takeLastLoginFragment('https://a.test/world')).toBeNull();
  });
});

describe('orderProviders', () => {
  const ALL = ['kakao', 'naver', 'google'] as const;
  it('priority를 앞으로, 나머지는 원래 순서', () => {
    expect(orderProviders(ALL, ['google'])).toEqual([
      'google',
      'kakao',
      'naver',
    ]);
    expect(orderProviders(ALL, ['naver', 'google'])).toEqual([
      'naver',
      'google',
      'kakao',
    ]);
    expect(orderProviders(ALL, [null, undefined])).toEqual([...ALL]);
    expect(orderProviders(ALL)).toEqual([...ALL]);
  });

  it('보이지 않는 provider·중복은 무시', () => {
    expect(
      orderProviders(['kakao', 'google'], ['naver', 'google', 'google']),
    ).toEqual(['google', 'kakao']);
  });
});
