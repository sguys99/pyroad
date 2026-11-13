import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  TUTOR_RATE_LIMITS,
  consumeTutorQuota,
  getTutorRateLimit,
  parseRateLimitEnv,
  rateLimitedResponse,
  type QuotaResult,
} from '../rateLimit';
import { tutorRateLimitMessage } from '../messages';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseRateLimitEnv', () => {
  it.each([
    ['6/60', { perMinute: 6, perDay: 60 }],
    [' 12 / 300 ', { perMinute: 12, perDay: 300 }],
  ])('%s', (raw, expected) => {
    expect(parseRateLimitEnv(raw)).toEqual(expected);
  });

  it.each([
    undefined,
    '',
    '6',
    '6/0',
    '0/10',
    '-1/5',
    '1.5/10',
    'a/b',
    '6/60/1',
    '100001/5',
  ])('잘못된 값 %s → null (기본값)', (raw) => {
    expect(parseRateLimitEnv(raw)).toBeNull();
  });
});

describe('getTutorRateLimit', () => {
  it('모든 요청 유형에 기본 한도가 있고 분당 ≤ 하루', () => {
    for (const [type, limit] of Object.entries(TUTOR_RATE_LIMITS)) {
      expect(limit.perMinute, type).toBeGreaterThan(0);
      expect(limit.perDay, type).toBeGreaterThanOrEqual(limit.perMinute);
      expect(limit.env, type).toMatch(/^TUTOR_LIMIT_[A-Z]+$/);
    }
  });

  it('서버 키 사용자는 기본값, 본인 키 사용자는 분 ×2 · 하루 ×5', () => {
    expect(getTutorRateLimit('hint_generator', false, {})).toEqual({
      perMinute: 6,
      perDay: 60,
    });
    expect(getTutorRateLimit('hint_generator', true, {})).toEqual({
      perMinute: 12,
      perDay: 300,
    });
  });

  it('자유 질문은 분당 3 · 하루 20, 본인 키여도 늘리지 않는다 (P9-17)', () => {
    const limit = { perMinute: 3, perDay: 20 };
    expect(getTutorRateLimit('free_question', false, {})).toEqual(limit);
    expect(getTutorRateLimit('free_question', true, {})).toEqual(limit);
  });

  it('env 로 유형별 한도와 본인 키 배수를 바꾼다', () => {
    const env = {
      TUTOR_LIMIT_HINT: '2/10',
      TUTOR_LIMIT_OWN_KEY_MULTIPLIER: '1/3',
    };
    expect(getTutorRateLimit('hint_generator', false, env)).toEqual({
      perMinute: 2,
      perDay: 10,
    });
    expect(getTutorRateLimit('hint_generator', true, env)).toEqual({
      perMinute: 2,
      perDay: 30,
    });
    // 다른 유형은 그대로
    expect(getTutorRateLimit('stage_summary', false, env)).toEqual({
      perMinute: 3,
      perDay: 20,
    });
  });

  it('형식이 틀린 env 는 기본값을 쓰고 한 번만 경고', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = { TUTOR_LIMIT_SUMMARY: 'lots' };
    expect(getTutorRateLimit('stage_summary', false, env)).toEqual({
      perMinute: 3,
      perDay: 20,
    });
    getTutorRateLimit('stage_summary', false, env);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('TUTOR_LIMIT_SUMMARY');
  });
});

describe('consumeTutorQuota', () => {
  const adminWith = (result: { data: unknown; error: unknown }) => {
    const rpc = vi.fn(async () => result);
    return { admin: { rpc } as never, rpc };
  };

  it('버킷 tutor:<유형> 과 한도를 넘기고 결과를 읽는다', async () => {
    const { admin, rpc } = adminWith({
      data: {
        allowed: false,
        retry_after: 12,
        remaining: 0,
        scope: 'day',
        denied_minute: 2,
        denied_today: 7,
      },
      error: null,
    });
    const r = await consumeTutorQuota(admin, 'u1', 'code_feedback', {
      perMinute: 3,
      perDay: 9,
    });
    expect(rpc).toHaveBeenCalledWith('consume_rate_limit', {
      p_user_id: 'u1',
      p_bucket: 'tutor:code_feedback',
      p_per_minute: 3,
      p_per_day: 9,
    });
    expect(r).toEqual({
      allowed: false,
      retryAfter: 12,
      remaining: 0,
      scope: 'day',
      deniedMinute: 2,
      deniedToday: 7,
    });
  });

  it('DB 오류·알 수 없는 응답이면 통과시키고(fail-open) 오류를 남긴다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const result of [
      {
        data: null,
        error: { code: '42883', message: 'function does not exist' },
      },
      { data: { nope: 1 }, error: null },
    ]) {
      const { admin } = adminWith(result);
      const r = await consumeTutorQuota(admin, 'u1', 'quest_intro', {
        perMinute: 1,
        perDay: 1,
      });
      expect(r).toMatchObject({ allowed: true, failedOpen: true });
    }
    expect(error).toHaveBeenCalledTimes(2);
  });
});

describe('rateLimitedResponse', () => {
  const denied = (
    retryAfter: number,
    scope: 'minute' | 'day',
  ): QuotaResult => ({
    allowed: false,
    retryAfter,
    remaining: 0,
    scope,
    deniedMinute: 1,
    deniedToday: 1,
  });

  it('429 + Retry-After + 아이용 문구', async () => {
    const res = rateLimitedResponse(denied(9, 'minute'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('9');
    expect(await res.json()).toEqual({
      error: 'rate_limited',
      message: '파이뱀 선생님이 잠깐 쉬고 있어요. 9초 뒤에 다시 물어봐요!',
      retry_after: 9,
      scope: 'minute',
    });
  });
});

describe('tutorRateLimitMessage', () => {
  it.each([
    [0.2, 'minute', '1초 뒤에'],
    [59, 'minute', '59초 뒤에'],
    [60, 'minute', '1분 뒤에'],
    [61, 'minute', '2분 뒤에'],
  ] as const)('%s초 %s → %s', (sec, scope, part) => {
    expect(tutorRateLimitMessage(sec, scope)).toContain(part);
  });

  it('하루 한도는 시간 대신 내일', () => {
    expect(tutorRateLimitMessage(30_000, 'day')).toContain(
      '내일 다시 물어봐요',
    );
  });
});
