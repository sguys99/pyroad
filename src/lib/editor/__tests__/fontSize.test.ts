import { describe, it, expect } from 'vitest';
import { TYPE } from '@/lib/design/tokens';
import {
  CODE_FONT_SIZES,
  DEFAULT_CODE_FONT_SIZE,
  isCodeFontSize,
  normalizeCodeFontSize,
  stepCodeFontSize,
} from '../fontSize';

describe('코드 글자 크기 단계 (P2-18)', () => {
  it('14~20px 짝수만 (D2Coding은 홀수 px에서 한글 2칸 정렬이 어긋남)', () => {
    expect([...CODE_FONT_SIZES]).toEqual([14, 16, 18, 20]);
    for (const s of CODE_FONT_SIZES) expect(s % 2).toBe(0);
  });

  it('기본은 TYPE.code와 같은 16px', () => {
    expect(DEFAULT_CODE_FONT_SIZE).toBe(16);
    expect(DEFAULT_CODE_FONT_SIZE).toBe(TYPE.code.size);
    expect(TYPE.code.size % 2).toBe(0);
  });

  it('저장소 값은 단계에 있는 것만 받고 나머지는 기본값', () => {
    expect(normalizeCodeFontSize('18')).toBe(18);
    expect(normalizeCodeFontSize(20)).toBe(20);
    for (const bad of [
      '15',
      17,
      '16.5',
      12,
      22,
      '',
      null,
      undefined,
      'abc',
      {},
    ]) {
      expect(normalizeCodeFontSize(bad)).toBe(16);
    }
    expect(isCodeFontSize(15)).toBe(false);
  });

  it('한 단계씩 오가고 양 끝에서 멈춘다', () => {
    expect(stepCodeFontSize(16, 1)).toBe(18);
    expect(stepCodeFontSize(16, -1)).toBe(14);
    expect(stepCodeFontSize(14, -1)).toBe(14);
    expect(stepCodeFontSize(20, 1)).toBe(20);
  });
});
