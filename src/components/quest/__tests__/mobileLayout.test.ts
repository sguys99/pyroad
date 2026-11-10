import { describe, expect, it } from 'vitest';
import { swipeStep } from '../usePageSwipe';
import { keyGroups } from '../CodeKeyboard';

describe('swipeStep (P6-11 쪽 넘기기)', () => {
  const base = { ms: 400, width: 320, index: 1, count: 3 };
  it('쪽 너비 1/4 이상 끌면 넘김: 왼쪽으로 = 다음, 오른쪽으로 = 앞', () => {
    expect(swipeStep({ ...base, dx: -80 })).toBe(1);
    expect(swipeStep({ ...base, dx: 80 })).toBe(-1);
  });
  it('짧게 천천히 끌면 그대로, 짧아도 빠르게 튕기면 넘김', () => {
    expect(swipeStep({ ...base, dx: -40 })).toBe(0);
    expect(swipeStep({ ...base, dx: -40, ms: 60 })).toBe(1);
    expect(swipeStep({ ...base, dx: -20, ms: 10 })).toBe(0);
  });
  it('끝 쪽 밖으로는 넘기지 않음', () => {
    expect(swipeStep({ ...base, index: 0, dx: 200 })).toBe(0);
    expect(swipeStep({ ...base, index: 2, dx: -200 })).toBe(0);
  });
});

describe('keyGroups (P6-11 스테이지별 코드 키보드)', () => {
  const labels = (stage?: number) =>
    keyGroups(stage).map((g) => [g.name, g.keys.map((k) => k.label)]);
  it('1·2스테이지는 앞자리 print() · " " · ( ) · = 그대로, 이번 스테이지 묶음 없음', () => {
    for (const s of [undefined, 1, 2]) {
      const groups = keyGroups(s);
      expect(groups[0].keys.map((k) => k.label)).toEqual([
        'print()',
        '" "',
        '( )',
        '=',
      ]);
      expect(groups.map((g) => g.name)).not.toContain('이번 스테이지 주문');
    }
  });
  it('3스테이지부터 그 스테이지 주문이 앞자리 바로 뒤로, 키는 한 번씩만', () => {
    expect(labels(3)[1]).toEqual([
      '이번 스테이지 주문',
      ['if', 'elif', 'else:', '==', '!=', '>=', '<='],
    ]);
    expect(labels(4)[1][1]).toEqual(['for', 'in', 'range()', 'while', 'break']);
    expect(labels(5)[1][1]).toContain('[ ]');
    for (const s of [1, 3, 4, 5, 6, 7]) {
      const all = keyGroups(s).flatMap((g) => g.keys.map((k) => k.name));
      expect(new Set(all).size).toBe(all.length);
    }
  });
});
