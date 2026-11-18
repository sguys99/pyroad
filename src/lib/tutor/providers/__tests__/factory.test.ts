import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  FREE_TIER_PROVIDER,
  getUserKeyedProviders,
  resolveUserProvider,
} from '../factory';

describe('getUserKeyedProviders', () => {
  it('알 수 없는 provider와 빈 값은 제외', () => {
    expect(
      getUserKeyedProviders({
        openai: 'k1',
        anthropic: '',
        foo: 'k2',
        gemini: 123,
      }),
    ).toEqual(['openai']);
  });

  it('학생의 Google(Gemini) 키는 쓰지 않음 — Gemini 약관 18세 미만 금지 (B117)', () => {
    expect(getUserKeyedProviders({ gemini: 'AIza-kid', openai: 'k1' })).toEqual(
      ['openai'],
    );
    expect(resolveUserProvider('gemini', { gemini: 'AIza-kid' })).toEqual({
      providerType: FREE_TIER_PROVIDER,
    });
  });

  it('키가 없으면 빈 배열', () => {
    expect(getUserKeyedProviders(null)).toEqual([]);
    expect(getUserKeyedProviders({})).toEqual([]);
  });
});

describe('resolveUserProvider', () => {
  afterEach(() => vi.unstubAllEnvs());

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
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    expect(
      resolveUserProvider(FREE_TIER_PROVIDER, { openai: 'my-key' }),
    ).toEqual({
      providerType: FREE_TIER_PROVIDER,
    });
  });

  it('서버 무료 티어 키가 없으면(v1.0 운영) 무료 티어를 골랐어도 본인 키로 (B117)', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(
      resolveUserProvider(FREE_TIER_PROVIDER, { openai: 'my-key' }),
    ).toEqual({ providerType: 'openai', customApiKey: 'my-key' });
  });
});
