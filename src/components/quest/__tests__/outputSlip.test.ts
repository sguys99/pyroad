import { describe, it, expect } from 'vitest';
import {
  compareLines,
  errorSummary,
  mismatchTip,
  outputLines,
  transcriptRows,
} from '../outputSlip';

describe('outputSlip', () => {
  it('outputLines: 마지막 줄바꿈 뒤 빈 줄만 버리고 가운데 빈 줄은 남긴다', () => {
    expect(outputLines('')).toEqual([]);
    expect(outputLines('a\n')).toEqual(['a']);
    expect(outputLines('a\n\nb')).toEqual(['a', '', 'b']);
    expect(outputLines('a')).toEqual(['a']);
  });

  it('compareLines: 같은 줄끼리 견주고, 모자라거나 남는 줄은 null 짝 (P7-17)', () => {
    expect(compareLines('1\n2\n3', '1\n5\n3\n')).toEqual([
      { example: '1', actual: '1', same: true },
      { example: '2', actual: '5', same: false },
      { example: '3', actual: '3', same: true },
    ]);
    expect(compareLines('a\nb', 'a')).toEqual([
      { example: 'a', actual: 'a', same: true },
      { example: 'b', actual: null, same: false },
    ]);
    expect(compareLines('a', 'a\nz')[1]).toEqual({
      example: null,
      actual: 'z',
      same: false,
    });
    // 채점처럼 전체 앞뒤 공백은 무시, 줄 안 띄어쓰기는 다름
    expect(compareLines('안녕', '\n안녕  \n').every((r) => r.same)).toBe(true);
    expect(compareLines('2 x 1', '2x1')[0].same).toBe(false);
    expect(compareLines('', '')).toEqual([]);
  });

  it('errorSummary: traceback 마지막 줄', () => {
    expect(
      errorSummary(
        'Traceback (most recent call last):\n  File "<exec>", line 1\nSyntaxError: invalid syntax\n\n',
      ),
    ).toBe('SyntaxError: invalid syntax');
    expect(errorSummary('')).toBe('');
  });

  it('mismatchTip: 공개 규칙 유형과 출력 유무로만 안내', () => {
    expect(mismatchTip('output_match', '')).toContain('print( )');
    expect(mismatchTip('output_match', 'x')).toContain('한 글자씩');
    expect(mismatchTip('contains_any', 'x')).toContain('들어 있는지');
    // code_check는 출력이 없어도 방법(코드)을 보라고
    expect(mismatchTip('code_check', '')).toContain('방법');
    expect(mismatchTip('all', 'x')).toContain('쓴 방법');
    expect(mismatchTip(undefined, 'x')).toContain('하나씩');
  });
});

describe('transcriptRows (P11-01 input 대화)', () => {
  it('답은 프롬프트 줄 바로 뒤에 내 말로, 답 뒤에는 줄이 바뀜', () => {
    const text = '시작!\n이름? 안녕 철수\n나이? 끝\n';
    expect(
      transcriptRows(text, [
        { at: text.indexOf('안녕'), value: '철수' },
        { at: text.indexOf('끝'), value: '' },
      ]),
    ).toEqual([
      { text: '시작!' },
      { text: '이름? ' },
      { text: '철수', answer: true },
      { text: '안녕 철수' },
      { text: '나이? ' },
      { text: '', answer: true },
      { text: '끝' },
    ]);
  });

  it('프롬프트 없이 줄바꿈 뒤에 물으면 말풍선만, 입력이 없으면 outputLines와 같음', () => {
    expect(transcriptRows('질문\n', [{ at: 3, value: 'a' }])).toEqual([
      { text: '질문' },
      { text: 'a', answer: true },
    ]);
    expect(transcriptRows('a\nb\n')).toEqual([{ text: 'a' }, { text: 'b' }]);
  });

  it('잘린 출력 밖 자리의 답은 끝에 붙임', () => {
    expect(transcriptRows('ab', [{ at: 99, value: 'x' }])).toEqual([
      { text: 'ab' },
      { text: 'x', answer: true },
    ]);
  });
});
