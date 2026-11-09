import { describe, expect, it } from 'vitest';

import { isKnownWorldSlug, worldSlugOf } from '../knownWorldSlug';

describe('isKnownWorldSlug (P5-14)', () => {
  it('생성물 월드는 준비 중이어도 있는 월드', () => {
    expect(isKnownWorldSlug('python-island', {})).toBe(true);
    expect(isKnownWorldSlug('code-sea', {})).toBe(true);
    expect(isKnownWorldSlug('no-such-world', {})).toBe(false);
  });
  it('테스트 월드 목록은 테스트 페이지가 켜진 서버에서만', () => {
    const e2e = { PYROAD_E2E_WORLD_SLUGS: 'test-meadow' };
    expect(isKnownWorldSlug('test-meadow', e2e)).toBe(false);
    expect(
      isKnownWorldSlug('test-meadow', { ...e2e, PYROAD_TEST_PAGES: '1' }),
    ).toBe(true);
    expect(isKnownWorldSlug('', { PYROAD_TEST_PAGES: '1' })).toBe(false);
  });
  it('worldSlugOf는 /world/<slug> 한 단계만', () => {
    expect(worldSlugOf('/world/code-sea')).toBe('code-sea');
    expect(worldSlugOf('/world/code-sea/')).toBe('code-sea');
    expect(worldSlugOf('/world')).toBeNull();
    expect(worldSlugOf('/worlds')).toBeNull();
    expect(worldSlugOf('/world/a/b')).toBeNull();
    expect(worldSlugOf('/world/%E0%A4')).toBe('%E0%A4');
  });
});
