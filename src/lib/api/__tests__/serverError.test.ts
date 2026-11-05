import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => [] as { error: unknown; context: unknown }[]);
vi.mock('@/lib/observability/server', () => ({
  captureServerError: (error: unknown, context: unknown) =>
    captured.push({ error, context }),
}));

import { describeServerError, isUuid, reportServerError } from '../serverError';

describe('describeServerError', () => {
  it('PostgREST 오류는 코드와 메시지만 (details·hint 제외)', () => {
    expect(
      describeServerError({
        code: '23514',
        message: 'violates check constraint',
        details: 'Failing row contains (아이가 쓴 글)',
        hint: null,
      }),
    ).toBe('23514 violates check constraint');
  });

  it('Error·문자열·이상한 값', () => {
    expect(describeServerError(new Error('boom'))).toBe('boom');
    expect(describeServerError('oops')).toBe('oops');
    expect(describeServerError({ code: 1, message: null })).toBe('');
  });
});

describe('reportServerError', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    captured.length = 0;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it('[area] op 실패 로그 + Sentry 태그, details 는 어디에도 없음', () => {
    reportServerError(
      { code: 'XX000', message: 'db down', details: '비밀 내용' },
      { area: 'notice', op: 'create' },
    );
    expect(consoleError).toHaveBeenCalledWith(
      '[notice] create 실패:',
      'XX000 db down',
    );
    expect(captured).toHaveLength(1);
    const [{ error, context }] = captured;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('[notice] create: XX000 db down');
    expect(context).toEqual({ tags: { area: 'notice', op: 'create' } });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('비밀 내용');
  });

  it('Error 는 그대로 Sentry 로 (스택 유지)', () => {
    const e = new Error('boom');
    reportServerError(e, { area: 'board', op: 'post.create' });
    expect(captured[0].error).toBe(e);
  });
});

describe('isUuid', () => {
  it('uuid 모양만 통과', () => {
    expect(isUuid('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(true);
    expect(isUuid('nope')).toBe(false);
    expect(isUuid(1)).toBe(false);
  });
});
