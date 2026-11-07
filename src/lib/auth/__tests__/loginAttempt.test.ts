import { describe, expect, it } from 'vitest';
import {
  LOGIN_ATTEMPT_MAX_AGE_MS,
  LOGIN_ATTEMPT_STORAGE_KEY,
  clearLoginAttempt,
  rememberLoginAttempt,
  takeLoginAttempt,
} from '../loginAttempt';

// 방금 시도한 로그인 수단 (B43: redirectTo에 via를 싣지 않고 이 탭에 둔다)

function mem(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: () => null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
const throwing = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
  removeItem() {
    throw new Error('blocked');
  },
} as unknown as Storage;

describe('loginAttempt', () => {
  it('적고 한 번 꺼내면 지워진다 (provider + 시각만)', () => {
    const s = mem();
    rememberLoginAttempt('kakao', s, 1000);
    expect(JSON.parse(s.getItem(LOGIN_ATTEMPT_STORAGE_KEY)!)).toEqual({
      provider: 'kakao',
      at: 1000,
    });
    expect(takeLoginAttempt(s, 2000)).toBe('kakao');
    expect(takeLoginAttempt(s, 2000)).toBeNull();
  });

  it('10분이 지났거나 모양이 틀리면 null', () => {
    const s = mem();
    rememberLoginAttempt('naver', s, 0);
    expect(takeLoginAttempt(s, LOGIN_ATTEMPT_MAX_AGE_MS + 1)).toBeNull();
    s.setItem(LOGIN_ATTEMPT_STORAGE_KEY, '{"provider":"github","at":0}');
    expect(takeLoginAttempt(s, 1)).toBeNull();
    s.setItem(LOGIN_ATTEMPT_STORAGE_KEY, 'not json');
    expect(takeLoginAttempt(s, 1)).toBeNull();
  });

  it('clearLoginAttempt, 저장소가 막혀 있어도 예외 없음', () => {
    const s = mem();
    rememberLoginAttempt('google', s, 1);
    clearLoginAttempt(s);
    expect(takeLoginAttempt(s, 2)).toBeNull();
    expect(() => rememberLoginAttempt('google', throwing)).not.toThrow();
    expect(takeLoginAttempt(throwing)).toBeNull();
    expect(() => clearLoginAttempt(throwing)).not.toThrow();
    expect(takeLoginAttempt(null)).toBeNull();
  });
});
