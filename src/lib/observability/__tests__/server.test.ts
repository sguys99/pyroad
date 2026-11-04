import { describe, it, expect, vi, afterEach } from 'vitest';

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException }));

import { captureServerError } from '../server';

async function settle() {
  for (let i = 0; i < 5; i++)
    await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.unstubAllEnvs();
  captureException.mockClear();
});

describe('captureServerError', () => {
  it('DSN이 없으면 SDK를 부르지 않는다', async () => {
    captureServerError(new Error('boom'));
    await settle();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('DSN이 있으면 태그와 함께 보낸다', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1');
    const error = new Error('provider down');
    captureServerError(error, { tags: { area: 'tutor' } });
    await settle();
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { area: 'tutor' },
      extra: undefined,
      fingerprint: undefined,
    });
  });
});
