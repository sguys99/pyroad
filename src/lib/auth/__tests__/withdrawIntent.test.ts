import { describe, expect, it } from 'vitest';
import {
  NAVER_WITHDRAW_NEXT,
  WITHDRAW_MAX_AGE_MS,
  isNaverWithdrawNext,
  naverWithdrawResultPath,
  rememberWithdrawStart,
  takeNaverWithdrawResult,
  takeWithdrawStart,
} from '../withdrawIntent';
import { safeNext } from '../safeNext';

// 탈퇴 직전 네이버 재인증 (P3-16)

function memory(): Storage {
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

describe('withdrawIntent', () => {
  it('재인증 next는 safeNext를 그대로 통과하고 알아볼 수 있다', () => {
    expect(safeNext(NAVER_WITHDRAW_NEXT)).toBe(NAVER_WITHDRAW_NEXT);
    expect(isNaverWithdrawNext(NAVER_WITHDRAW_NEXT)).toBe(true);
    expect(isNaverWithdrawNext('/profile')).toBe(false);
    expect(isNaverWithdrawNext('/profile?withdraw=kakao')).toBe(false);
    expect(isNaverWithdrawNext('/world?withdraw=naver')).toBe(false);
  });

  it('결과 주소를 읽고 그 키만 지운다. 결과가 없으면 건너뜀(skipped), 모르는 값은 failed', () => {
    expect(
      takeNaverWithdrawResult(
        `https://a.test${naverWithdrawResultPath('ok')}&tab=x`,
      ),
    ).toEqual({ outcome: 'ok', cleaned: '/profile?tab=x' });
    expect(
      takeNaverWithdrawResult('https://a.test/profile?withdraw=naver'),
    ).toEqual({ outcome: 'skipped', cleaned: '/profile' });
    expect(
      takeNaverWithdrawResult(
        'https://a.test/profile?withdraw=naver&naver=hack',
      )?.outcome,
    ).toBe('failed');
    expect(takeNaverWithdrawResult('https://a.test/profile')).toBeNull();
  });

  it('시작한 사용자는 이 탭에 15분, 한 번 꺼내면 지워진다', () => {
    const s = memory();
    rememberWithdrawStart('u1', s, 1000);
    expect(takeWithdrawStart(s, 2000)).toBe('u1');
    expect(takeWithdrawStart(s, 2000)).toBeNull();
    rememberWithdrawStart('u1', s, 1000);
    expect(takeWithdrawStart(s, 1000 + WITHDRAW_MAX_AGE_MS + 1)).toBeNull();
    expect(takeWithdrawStart(null)).toBeNull();
  });
});
