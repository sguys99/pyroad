import { describe, expect, it } from 'vitest';
import { highlightSegments, splitSegments } from '../highlight';

describe('highlightSegments', () => {
  it('문자열만 따로 칠한다 (작은·큰따옴표, 이스케이프)', () => {
    expect(highlightSegments('print("안녕!")')).toEqual([
      { kind: 'plain', text: 'print(' },
      { kind: 'str', text: '"안녕!"' },
      { kind: 'plain', text: ')' },
    ]);
    expect(highlightSegments("print('a\\'b', 3)")).toEqual([
      { kind: 'plain', text: 'print(' },
      { kind: 'str', text: "'a\\'b'" },
      { kind: 'plain', text: ', 3)' },
    ]);
  });
  it('안 닫힌 따옴표는 끝까지 문자열, 빈 줄은 빈 목록', () => {
    expect(highlightSegments('print("hi')).toEqual([
      { kind: 'plain', text: 'print(' },
      { kind: 'str', text: '"hi' },
    ]);
    expect(highlightSegments('')).toEqual([]);
  });
  it('긴 입력도 한 번 훑는다', () => {
    const long = '"'.repeat(5000) + 'x'.repeat(5000);
    const t0 = performance.now();
    const segs = highlightSegments(long);
    expect(performance.now() - t0).toBeLessThan(50);
    expect(segs.map((s) => s.text).join('')).toBe(long);
  });
});

describe('splitSegments', () => {
  it('커서 자리에서 조각을 나눈다', () => {
    const segs = highlightSegments('print("안녕")');
    const [a, b] = splitSegments(segs, 8);
    expect(a.map((s) => s.text).join('')).toBe('print("안');
    expect(b.map((s) => s.text).join('')).toBe('녕")');
    expect(a.at(-1)).toEqual({ kind: 'str', text: '"안' });
    expect(b[0]).toEqual({ kind: 'str', text: '녕"' });
  });
  it('맨 앞·맨 끝', () => {
    const segs = highlightSegments('ab');
    expect(splitSegments(segs, 0)).toEqual([[], segs]);
    expect(splitSegments(segs, 2)).toEqual([segs, []]);
  });
});
