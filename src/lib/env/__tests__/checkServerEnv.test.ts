import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  findServerEnvProblems,
  reportServerEnvProblems,
} from '../checkServerEnv';

const REQUIRED = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54331',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  GEMINI_API_KEY: 'gemini',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('서버 시작 env 점검 (P1-22)', () => {
  it('필수 값이 다 있고 모델 env 가 정상이면 문제 없음', () => {
    expect(findServerEnvProblems({ ...REQUIRED, GEMINI_MODEL: 'gemini-3.6-flash' })).toEqual({
      missing: [],
      warnings: [],
    });
  });

  it('빠진 필수 값(빈 문자열 포함)을 이름으로 알려 준다', () => {
    const { missing } = findServerEnvProblems({
      ...REQUIRED,
      SUPABASE_SERVICE_ROLE_KEY: ' ',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    expect(missing).toEqual(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
  });

  it('Gemini 키가 없거나 *_MODEL 이 제공 종료 모델이면 경고 (B35)', () => {
    const { warnings } = findServerEnvProblems({
      ...REQUIRED,
      GEMINI_API_KEY: '',
      GEMINI_MODEL: 'gemini-2.0-flash',
      OPENAI_MODEL: 'chatgpt-4o-latest',
    });
    expect(warnings).toHaveLength(3);
    expect(warnings.join('\n')).toContain('GEMINI_MODEL=gemini-2.0-flash');
    expect(warnings.join('\n')).toContain('OPENAI_MODEL=chatgpt-4o-latest');
  });

  it('로그에는 이름만 쓰고 값은 쓰지 않는다', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportServerEnvProblems({ ...REQUIRED, SUPABASE_SERVICE_ROLE_KEY: '' });
    expect(error).toHaveBeenCalledTimes(1);
    const line = String(error.mock.calls[0][0]);
    expect(line).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(line).not.toContain('anon');
  });
});
