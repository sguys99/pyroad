import { describe, it, expect } from 'vitest';
import { withObjectParticle, withParticle } from '../korean';

describe('withObjectParticle', () => {
  it('받침이 있으면 을, 없으면 를, 한글이 아니면 을(를)', () => {
    expect(withObjectParticle('나만의 게임')).toBe('나만의 게임을');
    expect(withObjectParticle('숫자 퀴즈')).toBe('숫자 퀴즈를');
    expect(withObjectParticle('Hello')).toBe('Hello을(를)');
  });
});

describe('withParticle', () => {
  it('주격·보조사도 받침에 맞게 (P10-03 실력 확인 퀴즈 문구)', () => {
    expect(withParticle('코드 바다', '이', '가')).toBe('코드 바다가');
    expect(withParticle('파이썬 섬', '은', '는')).toBe('파이썬 섬은');
  });
});
