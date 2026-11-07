import { describe, expect, it } from 'vitest';
import {
  compactKorean,
  englishTokens,
  hasVisibleText,
  koreanUnits,
  unicodeFold,
} from '../normalize';

describe('compactKorean (P1-18 금칙어 정규화)', () => {
  it.each([
    ['시 발', '시발'],
    ['시.발', '시발'],
    ['시1발', '시발'],
    ['시x발', '시발'],
    ['시♥발!!', '시발'],
    ['씨빨', '시발'],
    ['ㅅㅣㅂㅏㄹ', '시발'],
    ['ㅅ ㅣ ㅂ ㅏ ㄹ', '시발'],
    ['씨이이발', '시발'],
    ['조오온나', '존나'],
    ['개쌔끼', '게세기'],
    ['개새끼', '게세기'],
    ['ㅆㅂ', 'ㅅㅂ'],
  ])('%s → %s', (input, expected) => {
    expect(compactKorean(input)).toBe(expected);
  });

  it('keepTense: 된소리는 그대로, 나머지 정규화는 같게', () => {
    expect(compactKorean('찐따')).toBe('진다');
    expect(compactKorean('찐따', { keepTense: true })).toBe('찐따');
    expect(compactKorean('찐 1 따', { keepTense: true })).toBe('찐따');
    expect(compactKorean('ㅉㅣㄴㄸㅏ', { keepTense: true })).toBe('찐따');
    expect(compactKorean('찌인따', { keepTense: true })).toBe('찐따');
    expect(compactKorean('짱깨', { keepTense: true })).toBe('짱께');
    expect(compactKorean('가진다', { keepTense: true })).toBe('가진다');
  });

  it('보이지 않는 글자·한글 채움 문자를 끼워 넣어도 같음', () => {
    const zwsp = String.fromCharCode(0x200b);
    const filler = String.fromCharCode(0x3164);
    expect(compactKorean(`시${zwsp}발`)).toBe('시발');
    expect(compactKorean(`시${filler}발`)).toBe('시발');
  });

  it('반각 자모·첫가끝 자모도 호환 자모로', () => {
    // U+FFB5(반각 ㅅ), U+1107(첫가끝 ㅂ)
    expect(compactKorean(String.fromCharCode(0xffb5, 0x1107))).toBe('ㅅㅂ');
  });

  it('단어 경계 정보: 공백으로 나눈 단어의 첫·끝 글자', () => {
    const units = koreanUnits('가자 위로');
    expect(units.map((u) => [u.ch, u.token, u.start, u.end])).toEqual([
      ['가', 0, true, false],
      ['자', 0, false, true],
      ['위', 1, true, false],
      ['로', 1, false, true],
    ]);
  });
});

describe('englishTokens', () => {
  it('숫자·기호 치환, 한 글자씩 띄어 쓴 단어는 붙임', () => {
    expect(englishTokens('sh1t')).toEqual(['shit']);
    expect(englishTokens('f u c k you')).toEqual(['fuck', 'you']);
    expect(englishTokens('ＳＨＩＴ')).toEqual(['shit']);
    expect(englishTokens('has extra')).toEqual(['has', 'extra']);
  });
});

describe('unicodeFold·hasVisibleText', () => {
  it('전각 → 반각, 소문자', () => {
    expect(unicodeFold('ＡＢＣ１２３')).toBe('abc123');
  });
  it('공백·보이지 않는 글자만 있으면 빈 글', () => {
    expect(hasVisibleText('   ')).toBe(false);
    expect(hasVisibleText(String.fromCharCode(0x200b, 0x3164, 0x20))).toBe(
      false,
    );
    expect(hasVisibleText(' 안녕 ')).toBe(true);
  });
});
