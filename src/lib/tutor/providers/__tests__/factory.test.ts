import { describe, it, expect } from 'vitest';
import {
  FREE_TIER_PROVIDER,
  getUserKeyedProviders,
  resolveUserProvider,
} from '../factory';

describe('getUserKeyedProviders', () => {
  it('알 수 없는 provider와 빈 값은 제외', () => {
    expect(
      getUserKeyedProviders({ openai: 'k1', anthropic: '', foo: 'k2', gemini: 123 }),
    ).toEqual(['openai']);
  });

  it('키가 없으면 빈 배열', () => {
    expect(getUserKeyedProviders(null)).toEqual([]);
    expect(getUserKeyedProviders({})).toEqual([]);
  });
});

describe('resolveUserProvider', () => {
  it('본인 키가 없으면 선호 provider와 무관하게 무료 티어(서버 키 없음)', () => {
    expect(resolveUserProvider('anthropic', {})).toEqual({
      providerType: FREE_TIER_PROVIDER,
    });
  });

  it('선호 provider에 본인 키가 있으면 그 키로 호출', () => {
    expect(resolveUserProvider('openai', { openai: 'my-key' })).toEqual({
      providerType: 'openai',
      customApiKey: 'my-key',
    });
  });

  it('선호 provider에 본인 키가 없으면 서버 유료 키 대신 본인 키가 있는 provider 사용', () => {
    expect(resolveUserProvider('anthropic', { openai: 'my-key' })).toEqual({
      providerType: 'openai',
      customApiKey: 'my-key',
    });
  });

  it('본인 키가 있어도 무료 티어를 선호하면 서버 무료 티어 사용', () => {
    expect(resolveUserProvider(FREE_TIER_PROVIDER, { openai: 'my-key' })).toEqual({
      providerType: FREE_TIER_PROVIDER,
    });
  });
});
