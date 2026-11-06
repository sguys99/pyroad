import { describe, it, expect } from 'vitest';
import { ksX1001Hangul } from '../../../../scripts/fonts/share-card-chars.mjs';
import { isKsX1001Hangul, ksX1001HangulList } from '../ksX1001';

describe('KS X 1001 완성형 한글 (§12-Q14)', () => {
  it('2,350자, 중복 없음, 코드포인트 순', () => {
    const list = ksX1001HangulList();
    expect(list).toHaveLength(2350);
    expect(new Set(list).size).toBe(2350);
    expect(list[0]).toBe('가');
    expect(list[list.length - 1]).toBe('힝');
    const codes = list.map((c) => c.codePointAt(0)!);
    expect(codes).toEqual([...codes].sort((a, b) => a - b));
  });

  it('폰트 서브셋(scripts/fonts/share-card-chars.mjs)과 같은 집합', () => {
    expect([...ksX1001HangulList()]).toEqual(ksX1001Hangul());
  });

  it('흔한 글자는 있고 똠·햏·뷁은 없다', () => {
    for (const ch of ['가', '나', '뱀', '똥', '힘']) {
      expect(isKsX1001Hangul(ch)).toBe(true);
    }
    for (const ch of ['똠', '햏', '뷁', 'a', 'ㄱ', '', '가나']) {
      expect(isKsX1001Hangul(ch)).toBe(false);
    }
  });
});
