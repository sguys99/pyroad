import { describe, expect, it } from 'vitest';
import {
  accountLinkRows,
  isLinkNext,
  linkNext,
  linkedIdentities,
  takeLinkedResult,
} from '../accountLinks';
import { safeNext } from '../safeNext';
import { forgetLastLoginIf, LAST_LOGIN_STORAGE_KEY } from '../lastLogin';

// 로그인 계정 연결 규칙 (P3-07)

const ALL = ['kakao', 'naver', 'google'] as const;
const g = {
  provider: 'google',
  identity_id: 'i-g',
  created_at: '2026-11-01T00:00:00Z',
  identity_data: { email: 'kid@example.com' },
};
const k = {
  provider: 'kakao',
  identity_id: 'i-k',
  created_at: '2026-11-02T00:00:00Z',
};
const n = {
  provider: 'custom:naver',
  identity_id: 'i-n',
  created_at: '2026-11-03T00:00:00Z',
};

describe('accountLinkRows', () => {
  it('Google만: 카카오·네이버는 붙일 수 있음, Google은 마지막 수단이라 끊기 불가', () => {
    expect(accountLinkRows([g], ALL)).toEqual([
      {
        provider: 'google',
        state: 'linked',
        linkedAt: g.created_at,
        canUnlink: false,
      },
      { provider: 'kakao', state: 'available' },
      { provider: 'naver', state: 'available' },
    ]);
  });

  it('카카오만: Google은 허용(확인 전, 스모크 L-3), 네이버는 이메일 없는 계정끼리라 막힘', () => {
    expect(accountLinkRows([k], ALL)).toEqual([
      { provider: 'google', state: 'available' },
      {
        provider: 'kakao',
        state: 'linked',
        linkedAt: k.created_at,
        canUnlink: false,
      },
      { provider: 'naver', state: 'blocked', reason: 'needs_google' },
    ]);
  });

  it('둘 이상이면 끊을 수 있고, Google이 붙으면 네이버도 열림', () => {
    const rows = accountLinkRows([k, g], ALL);
    expect(
      rows
        .filter((r) => r.state === 'linked')
        .map((r) => r.state === 'linked' && r.canUnlink),
    ).toEqual([true, true]);
    expect(rows.find((r) => r.provider === 'naver')).toEqual({
      provider: 'naver',
      state: 'available',
    });
  });

  it('숨긴 provider(NEXT_PUBLIC_LOGIN_PROVIDERS)는 연결 안 된 줄을 보이지 않지만, 이미 연결된 것은 보여 해제할 수 있게', () => {
    expect(
      accountLinkRows([g, n], ['kakao', 'google']).map((r) => r.provider),
    ).toEqual(['google', 'kakao', 'naver']);
    expect(
      accountLinkRows([g], ['kakao', 'google']).map((r) => r.provider),
    ).toEqual(['google', 'kakao']);
  });

  it('같은 provider identity가 둘이면 그 provider를 끊어도 남는 수단이 있어야 끊기 가능', () => {
    const k2 = { ...k, identity_id: 'i-k2' };
    const rows = accountLinkRows([k, k2], ALL);
    expect(rows.find((r) => r.provider === 'kakao')).toMatchObject({
      canUnlink: false,
    });
  });

  it('목록에는 이메일·식별자 없이 provider·날짜만', () => {
    const json = JSON.stringify(accountLinkRows([g, k], ALL));
    expect(json).not.toContain('example.com');
    expect(json).not.toContain('i-g');
    expect(linkedIdentities([g])).toEqual([
      { provider: 'google', identityId: 'i-g', linkedAt: g.created_at },
    ]);
  });
});

describe('연결 흐름 주소', () => {
  it('linkNext는 safeNext를 통과하고 콜백이 알아본다', () => {
    for (const p of ALL) {
      expect(safeNext(linkNext(p))).toBe(linkNext(p));
      expect(isLinkNext(linkNext(p))).toBe(true);
    }
    expect(isLinkNext('/settings')).toBe(false);
    expect(isLinkNext('/settings?linked=github')).toBe(false);
    expect(isLinkNext('/world?linked=kakao')).toBe(false);
  });

  it('설정 화면이 ?linked=를 읽고 지운다', () => {
    expect(
      takeLinkedResult('https://a.test/settings?linked=naver&x=1'),
    ).toEqual({
      provider: 'naver',
      cleaned: '/settings?x=1',
    });
    expect(takeLinkedResult('https://a.test/settings')).toBeNull();
    expect(takeLinkedResult('https://a.test/settings?linked=evil')).toBeNull();
  });
});

describe('forgetLastLoginIf (P3-08 배지와 함께)', () => {
  function mem(): Storage {
    const m = new Map<string, string>();
    return {
      get length() {
        return m.size;
      },
      clear: () => m.clear(),
      getItem: (key) => m.get(key) ?? null,
      key: () => null,
      removeItem: (key) => void m.delete(key),
      setItem: (key, v) => void m.set(key, String(v)),
    };
  }
  it('끊은 수단의 기록이면 지우고, 다른 수단이면 둔다', () => {
    const s = mem();
    s.setItem(
      LAST_LOGIN_STORAGE_KEY,
      JSON.stringify({ provider: 'kakao', at: new Date().toISOString() }),
    );
    forgetLastLoginIf('google', s);
    expect(s.getItem(LAST_LOGIN_STORAGE_KEY)).not.toBeNull();
    forgetLastLoginIf('kakao', s);
    expect(s.getItem(LAST_LOGIN_STORAGE_KEY)).toBeNull();
    expect(() => forgetLastLoginIf('kakao', null)).not.toThrow();
  });
});
