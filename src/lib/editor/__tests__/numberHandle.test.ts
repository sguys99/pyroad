import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import {
  callAround,
  formatNumber,
  numberAt,
  numberRange,
} from '../numberHandle';

const at = (doc: string, needle: string) => {
  const state = EditorState.create({ doc, extensions: [python()] });
  ensureSyntaxTree(state, doc.length, 1e4);
  const r = numberAt(state, doc.indexOf(needle) + needle.length - 1);
  return r && doc.slice(r.from, r.to);
};

describe('숫자 손잡이 (world3 제안 L)', () => {
  it('숫자가 들어 있는 함수 이름과 몇 번째 값인지', () => {
    expect(callAround('t.forward(')).toEqual({ name: 'forward', arg: 0 });
    expect(callAround('t.circle(50, ')).toEqual({ name: 'circle', arg: 1 });
    expect(callAround('t.goto(max(1, 2), ')).toEqual({ name: 'goto', arg: 1 });
    expect(callAround('size = ')).toEqual({ name: 'size', arg: 0 });
  });

  it('자리에 맞는 범위: 각도·길이·자리·횟수, 지금 값이 밖이면 넓힘', () => {
    expect(numberRange('t.left(', 90, '90')).toMatchObject({
      label: '각도',
      min: 0,
      max: 360,
      step: 1,
    });
    expect(numberRange('t.circle(50, ', 180, '180').label).toBe('각도');
    expect(numberRange('t.forward(', 500, '500')).toMatchObject({
      label: '길이',
      max: 500,
    });
    expect(numberRange('t.goto(', -300, '300')).toMatchObject({
      label: '자리',
      min: -300,
    });
    expect(numberRange('for i in range(', 4, '4').label).toBe('횟수');
    expect(numberRange('time.sleep(', 0.05, '0.05')).toMatchObject({
      step: 0.01,
      max: 2,
    });
    expect(numberRange('x = ', 7, '7')).toMatchObject({
      label: '숫자',
      min: 0,
      max: 14,
    });
  });

  it('코드 글자: 정수는 정수로, 소수는 원래 자릿수로', () => {
    expect(formatNumber(90, 1)).toBe('90');
    expect(formatNumber(0.1 + 0.2, 0.01)).toBe('0.30');
    expect(formatNumber(-120, 1)).toBe('-120');
  });

  it('숫자 글자만 집음: 음수 기호 포함, 문자열·이름·16진수는 아님', () => {
    expect(at('t.forward(100)', '10')).toBe('100');
    expect(at('t.goto(-300, -100)', '-30')).toBe('-300');
    expect(at('x = 5 - 2', '2')).toBe('2');
    expect(at('print("100")', '10')).toBeNull();
    expect(at('x1 = 3', 'x1')).toBeNull();
    expect(at('n = 0x10', '0x1')).toBeNull();
  });
});
