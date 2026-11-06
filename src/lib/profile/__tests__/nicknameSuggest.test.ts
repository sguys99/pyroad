import { describe, it, expect } from 'vitest';
import { validateNickname } from '../nickname';
import {
  NICKNAME_ADJECTIVES,
  NICKNAME_NOUNS,
  suggestNickname,
  type Rng,
} from '../nicknameSuggest';

/** 정해진 값을 차례로 돌려주는 rng */
const seq =
  (...values: number[]): Rng =>
  () => {
    const v = values.shift();
    if (v === undefined) throw new Error('rng 값이 모자람');
    return v;
  };

describe('추천 닉네임 목록', () => {
  it('목록이 적당한 크기이고 중복이 없다', () => {
    expect(NICKNAME_ADJECTIVES.length).toBeGreaterThanOrEqual(15);
    expect(NICKNAME_NOUNS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(NICKNAME_ADJECTIVES).size).toBe(NICKNAME_ADJECTIVES.length);
    expect(new Set(NICKNAME_NOUNS).size).toBe(NICKNAME_NOUNS.length);
  });

  it('모든 조합(숫자 없음 + 숫자 00~99)이 닉네임 규칙(2~10자·KS X 1001·금칙어·예약어)을 통과한다', () => {
    const suffixes = [
      '',
      ...Array.from({ length: 100 }, (_, n) => String(n).padStart(2, '0')),
    ];
    const failures: string[] = [];
    const bases = new Set<string>();
    for (const adj of NICKNAME_ADJECTIVES) {
      for (const noun of NICKNAME_NOUNS) {
        const base = adj + noun;
        bases.add(base);
        for (const suffix of suffixes) {
          const r = validateNickname(base + suffix);
          if (!r.ok) failures.push(`${base + suffix}: ${r.reason}`);
        }
      }
    }
    expect(failures).toEqual([]);
    // 조합끼리 겹치지 않음 (같은 이름이 두 번 나오지 않게)
    expect(bases.size).toBe(NICKNAME_ADJECTIVES.length * NICKNAME_NOUNS.length);
  });

  it('가장 긴 조합 + 숫자 2개도 10글자 이하', () => {
    const longest =
      Math.max(...NICKNAME_ADJECTIVES.map((a) => a.length)) +
      Math.max(...NICKNAME_NOUNS.map((n) => n.length)) +
      2;
    expect(longest).toBeLessThanOrEqual(10);
  });
});

describe('suggestNickname', () => {
  it('rng 를 넣으면 결과가 정해진다', () => {
    expect(suggestNickname(seq(0, 0))).toBe(
      NICKNAME_ADJECTIVES[0] + NICKNAME_NOUNS[0],
    );
    expect(suggestNickname(seq(0.999999, 0.999999))).toBe(
      NICKNAME_ADJECTIVES[NICKNAME_ADJECTIVES.length - 1] +
        NICKNAME_NOUNS[NICKNAME_NOUNS.length - 1],
    );
  });

  it('withNumber 면 숫자 2개를 붙인다 (0 → 00, 끝값 → 99)', () => {
    expect(suggestNickname(seq(0, 0, 0), { withNumber: true })).toBe(
      `${NICKNAME_ADJECTIVES[0]}${NICKNAME_NOUNS[0]}00`,
    );
    expect(suggestNickname(seq(0, 0, 0.07), { withNumber: true })).toMatch(
      /07$/,
    );
    expect(suggestNickname(seq(0, 0, 0.9999), { withNumber: true })).toMatch(
      /99$/,
    );
  });

  it('rng 가 범위를 벗어나도(1, 음수) 목록 안에서 고른다', () => {
    expect(suggestNickname(seq(1, -0.5, 1), { withNumber: true })).toBe(
      `${NICKNAME_ADJECTIVES[NICKNAME_ADJECTIVES.length - 1]}${NICKNAME_NOUNS[0]}99`,
    );
  });

  it('기본 Math.random 으로 만든 값도 언제나 통과한다', () => {
    for (let i = 0; i < 200; i++) {
      expect(validateNickname(suggestNickname()).ok).toBe(true);
      expect(
        validateNickname(suggestNickname(undefined, { withNumber: true })).ok,
      ).toBe(true);
    }
  });
});
