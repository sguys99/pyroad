import { describe, it, expect } from 'vitest';
import { isTestPagesEnabled } from '../testPages';

describe('테스트 전용 페이지 열기 (P2-18)', () => {
  it('개발 서버와 PYROAD_TEST_PAGES=1(e2e)에서만 연다', () => {
    expect(isTestPagesEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(
      isTestPagesEnabled({ NODE_ENV: 'production', PYROAD_TEST_PAGES: '1' }),
    ).toBe(true);
  });

  it('운영(변수 없음·다른 값)과 테스트 러너는 닫힌다', () => {
    expect(isTestPagesEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(
      isTestPagesEnabled({ NODE_ENV: 'production', PYROAD_TEST_PAGES: 'true' }),
    ).toBe(false);
    expect(isTestPagesEnabled({ NODE_ENV: 'test' })).toBe(false);
  });
});
