import { describe, it, expect } from 'vitest';
import { withObjectParticle } from '../korean';

describe('withObjectParticle', () => {
  it('받침이 있으면 을, 없으면 를, 한글이 아니면 을(를)', () => {
    expect(withObjectParticle('나만의 게임')).toBe('나만의 게임을');
    expect(withObjectParticle('숫자 퀴즈')).toBe('숫자 퀴즈를');
    expect(withObjectParticle('Hello')).toBe('Hello을(를)');
  });
});
