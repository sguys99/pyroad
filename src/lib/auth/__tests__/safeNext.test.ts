import { describe, it, expect } from 'vitest';
import { safeNext, DEFAULT_NEXT } from '../safeNext';

describe('safeNext (B23)', () => {
  it('값이 없으면 /world', () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext('')).toBe(DEFAULT_NEXT);
  });

  it('같은 출처 경로는 그대로 (쿼리·해시 포함)', () => {
    expect(safeNext('/world')).toBe('/world');
    expect(safeNext('/settings')).toBe('/settings');
    expect(safeNext('/quest/1-1?tab=code#editor')).toBe(
      '/quest/1-1?tab=code#editor',
    );
    expect(safeNext('/')).toBe('/');
  });

  it('한글 등 인코딩된 경로는 유지', () => {
    expect(safeNext('/board?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC')).toBe(
      '/board?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC',
    );
  });

  it('점 세그먼트는 정규화', () => {
    expect(safeNext('/world/../profile')).toBe('/profile');
  });

  it('fallback을 바꿀 수 있음', () => {
    expect(safeNext('//evil.com', '/')).toBe('/');
  });

  const attacks: [string, string][] = [
    ['프로토콜 상대 URL', '//evil.com'],
    ['프로토콜 상대 URL + 경로', '//evil.com/world'],
    ['슬래시 3개', '///evil.com'],
    ['역슬래시', '/\\evil.com'],
    ['역슬래시 2개', '\\\\evil.com'],
    ['경로 중간 역슬래시', '/world\\..\\..\\evil.com'],
    ['절대 URL', 'https://evil.com'],
    ['대문자 스킴', 'HTTPS://evil.com/world'],
    ['javascript 스킴', 'javascript:alert(1)'],
    ['data 스킴', 'data:text/html,<script>alert(1)</script>'],
    ['스킴 없는 호스트', 'evil.com'],
    ['상대 경로', 'world'],
    ['앞 공백', ' /world'],
    ['탭으로 쪼갠 //', '/\t/evil.com'],
    ['줄바꿈으로 쪼갠 //', '/\n/evil.com'],
    ['CR', '/\r/evil.com'],
    ['NUL', '/world\u0000'],
    ['DEL', '/world\u007f'],
    ['C1 제어 문자', '/world\u0085'],
    ['인코딩된 //', '%2F%2Fevil.com'],
    ['한 번 인코딩된 두 번째 /', '/%2Fevil.com'],
    ['한 번 인코딩된 역슬래시', '/%5Cevil.com'],
    ['이중 인코딩된 /', '/%252Fevil.com'],
    ['이중 인코딩된 역슬래시', '/%255Cevil.com'],
    ['인코딩된 탭', '/%09/evil.com'],
    ['인코딩된 줄바꿈', '/%0A/evil.com'],
    ['인코딩된 NUL', '/world%00'],
    ['점 세그먼트로 만든 //', '/.//evil.com'],
    ['잘못된 퍼센트 인코딩', '/world%E0%A4%A'],
    ['사용자 정보가 붙은 호스트', '//user@evil.com'],
  ];

  it.each(attacks)('거부: %s', (_name, value) => {
    expect(safeNext(value)).toBe(DEFAULT_NEXT);
  });

  it('통과한 값은 어떤 출처 뒤에 붙여도 그 출처를 벗어나지 않음', () => {
    const origin = 'https://pyroad.vercel.app';
    for (const [, value] of attacks) {
      expect(new URL(`${origin}${safeNext(value)}`).origin).toBe(origin);
      expect(new URL(safeNext(value), origin).origin).toBe(origin);
    }
  });
});
