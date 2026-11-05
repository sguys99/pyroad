import { describe, it, expect, vi, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ captureServerMessage: vi.fn() }));
vi.mock('@/lib/observability/server', () => ({
  captureServerMessage: mocks.captureServerMessage,
}));

import { hashUserId, reportTutorAbuse, safeQuestId } from '../abuse';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.captureServerMessage.mockClear();
});

describe('hashUserId', () => {
  it('같은 id → 같은 16자 hex, id 자체는 들어 있지 않음', () => {
    const id = '54f3fdb3-124b-4069-94f0-422780d62d06';
    expect(hashUserId(id)).toBe(hashUserId(id));
    expect(hashUserId(id)).toMatch(/^[0-9a-f]{16}$/);
    expect(hashUserId(id)).not.toContain('54f3fdb3');
    expect(hashUserId(id)).not.toBe(hashUserId('other'));
  });
});

describe('safeQuestId', () => {
  it('UUID 만 남긴다', () => {
    expect(safeQuestId('b1000000-0000-0000-0000-000000000001')).toBe(
      'b1000000-0000-0000-0000-000000000001',
    );
    expect(safeQuestId('<script>')).toBe('invalid');
    expect(safeQuestId(42)).toBe('invalid');
  });
});

describe('reportTutorAbuse', () => {
  it('info 는 로그만, warning 은 로그 + Sentry (사용자 해시는 Sentry 에 보내지 않음)', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reportTutorAbuse({
      userId: 'u1',
      reason: 'rate_limited',
      level: 'info',
      type: 'quest_intro',
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(mocks.captureServerMessage).not.toHaveBeenCalled();

    reportTutorAbuse({
      userId: 'u1',
      reason: 'invalid_type',
      level: 'warning',
      type: 'give_me_answers',
      detail: { bytes: 10 },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    const line = JSON.parse(warn.mock.calls[0][1] as string);
    expect(line).toEqual({
      event: 'tutor_abuse',
      level: 'warning',
      reason: 'invalid_type',
      kind: 'unknown',
      user: hashUserId('u1'),
      bytes: 10,
    });
    expect(mocks.captureServerMessage).toHaveBeenCalledWith(
      'tutor abuse: invalid_type',
      'warning',
      {
        tags: { area: 'tutor', reason: 'invalid_type', kind: 'unknown' },
        extra: { bytes: 10 },
        fingerprint: ['tutor-abuse', 'invalid_type'],
      },
    );
  });
});
