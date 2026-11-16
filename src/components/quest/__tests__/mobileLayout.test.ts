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

describe('keyGroups 3월드 스테이지 앞자리 (world3 제안 M)', () => {
  const front = (stage: number) =>
    keyGroups(stage, 'maker-city')[0].keys.map((k) => k.label);
  it('스테이지마다 맨 앞에 그 스테이지 키, 기본 앞자리는 그 뒤', () => {
    expect(front(1)).toEqual(['t.', 'forward()']);
    expect(front(2)).toEqual(['input()', 'if']);
    expect(front(3)).toEqual(['input()', 'if']);
    expect(front(4)).toEqual(['class', 'self.']);
    expect(front(5)).toEqual(['for', 'len()']);
    expect(front(6)).toEqual(['get_key()']);
    expect(keyGroups(6, 'maker-city')[2].keys[0].label).toBe('time.sleep()');
    expect(keyGroups(1, 'maker-city')[1].keys[0].label).toBe('print()');
  });
  it('괄호 주문은 커서를 괄호 안에(값이 없으면 끝), 1월드에 있는 키는 그대로, 키는 한 번씩만', () => {
    const key = (stage: number, label: string) =>
      keyGroups(stage, 'maker-city')
        .flatMap((g) => g.keys)
        .find((k) => k.label === label)!;
    expect(key(1, 'forward()')).toMatchObject({ text: 'forward()', caret: 8 });
    expect(key(6, 'get_key()')).toMatchObject({ text: 'get_key()' });
    expect(key(6, 'get_key()').caret).toBeUndefined();
    expect(key(4, 'class')).toMatchObject({
      text: 'class ',
      name: 'class 주문 넣기',
    });
    expect(key(5, 'in').text).toBe(' in ');
    for (const s of [1, 2, 3, 4, 5, 6, 7]) {
      const all = keyGroups(s, 'maker-city').flatMap((g) =>
        g.keys.map((k) => k.name),
      );
      expect(new Set(all).size).toBe(all.length);
    }
  });
  it('다른 월드는 지금 배치 그대로', () => {
    expect(keyGroups(3, 'python-island')).toEqual(keyGroups(3));
  });
});
