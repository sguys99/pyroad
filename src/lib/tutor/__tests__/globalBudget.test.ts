import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const observed = vi.hoisted(() => ({ message: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/observability/server', () => ({
  captureServerMessage: observed.message,
  captureServerError: observed.error,
}));

import {
  consumeServerKeyBudget,
  getServerKeyBudget,
  SERVER_KEY_BUDGETS,
} from '../globalBudget';

function adminWith(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { admin: { rpc } as never, rpc };
}

const denied = (deniedMinute: number) => ({
  data: {
    allowed: false,
    retry_after: 40,
    remaining: 0,
    scope: 'minute',
    denied_minute: deniedMinute,
    denied_today: 7,
  },
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('서버 키 전역 예산 (P1-22)', () => {
  it('Gemini 만 예산이 있고, env "분당/하루"로 바꾸며 형식이 틀리면 기본값', () => {
    const def = SERVER_KEY_BUDGETS.gemini!;
    expect(getServerKeyBudget('gemini', {})).toEqual({
      perMinute: def.perMinute,
      perDay: def.perDay,
    });
    expect(
      getServerKeyBudget('gemini', { TUTOR_GLOBAL_LIMIT_GEMINI: '30 / 3000' }),
    ).toEqual({
      perMinute: 30,
      perDay: 3000,
    });
    expect(
      getServerKeyBudget('gemini', { TUTOR_GLOBAL_LIMIT_GEMINI: 'lots' }),
    ).toEqual({
      perMinute: def.perMinute,
      perDay: def.perDay,
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('TUTOR_GLOBAL_LIMIT_GEMINI'),
    );
    expect(getServerKeyBudget('anthropic', {})).toBeNull();
    expect(getServerKeyBudget('openai', {})).toBeNull();
  });

  it('허용이면 true, 예산이 없는 provider 는 DB 를 부르지 않는다', async () => {
    const { admin, rpc } = adminWith({ data: { allowed: true }, error: null });
    expect(await consumeServerKeyBudget(admin, 'gemini', {})).toBe(true);
    expect(rpc).toHaveBeenCalledWith('consume_global_rate_limit', {
      p_bucket: 'tutor:gemini:global',
      p_per_minute: SERVER_KEY_BUDGETS.gemini!.perMinute,
      p_per_day: SERVER_KEY_BUDGETS.gemini!.perDay,
    });
    expect(await consumeServerKeyBudget(admin, 'anthropic', {})).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('넘으면 false + Sentry 경고, 로그는 분 창의 첫 거부에만', async () => {
    expect(
      await consumeServerKeyBudget(adminWith(denied(1)).admin, 'gemini', {}),
    ).toBe(false);
    expect(
      await consumeServerKeyBudget(adminWith(denied(2)).admin, 'gemini', {}),
    ).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(observed.message).toHaveBeenCalledWith(
      'tutor server key budget exhausted',
      'warning',
      expect.objectContaining({
        tags: expect.objectContaining({ provider: 'gemini', scope: 'minute' }),
      }),
    );
  });

  it('DB 실패·알 수 없는 응답은 통과시키고(fail-open) 로그·Sentry', async () => {
    expect(
      await consumeServerKeyBudget(
        adminWith({ data: null, error: { code: '42883', message: 'missing' } })
          .admin,
        'gemini',
        {},
      ),
    ).toBe(true);
    expect(
      await consumeServerKeyBudget(
        adminWith({ data: {}, error: null }).admin,
        'gemini',
        {},
      ),
    ).toBe(true);
    expect(observed.error).toHaveBeenCalledTimes(2);
  });
});
